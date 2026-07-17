import {
  ConfigPlugin,
  withDangerousMod,
  withEntitlementsPlist,
  withFinalizedMod,
  withInfoPlist,
  withXcodeProject,
} from '@expo/config-plugins';
import * as fs from 'fs';
import { createRequire } from 'module';
import * as path from 'path';

export type CarPlayIOSPluginProps = {
  /** Generate the optional react-native-background-geolocation bridge. */
  backgroundGeolocation?: boolean;
  /** Enable the Apple-granted CarPlay Driving Task entitlement and scene. */
  carplayDrivingTask?: boolean;
  /**
   * Add background location configuration used to reconcile route changes when
   * iOS wakes the app for a significant-location or visit event. Default: false.
   */
  backgroundLocation?: boolean;
  locationWhenInUsePermission?: string;
  locationAlwaysPermission?: string;
};

const ENTITLEMENT_KEY = 'com.apple.developer.carplay-driving-task';
const MARKER = '.expo-detect-carplay-entitlement';
const SCENE_NAME = 'ExpoDetectCarplay';
const SCENE_CLASS = 'ExpoDetectCarplay.CarPlaySceneDelegate';
const LEGACY_SCENE_CLASSES = new Set([
  'ExpoBeacon.BeaconCarPlaySceneDelegate',
  'BeaconCarPlaySceneDelegate',
]);

export function getIOSCarPlayPluginSwift(): string {
  return `\
import ExpoDetectCarplay
import Foundation
import TSLocationManager

final class CarPlayGeoPlugin: CarPlayLifecycleDelegate {
  private static let stopGrace: TimeInterval = 30
  private static let stationaryTransitionTimeout: TimeInterval = 10

  private var trackingRequested = false
  private var lifecycleGeneration: UInt = 0
  private var pendingFinalization: DispatchWorkItem?
  private var pendingStationaryTransition: DispatchWorkItem?
  private var awaitingStationaryGeneration: UInt?
  private var motionChangeListenerRegistered = false

  func carPlayDidConnect(transport: String) {
    runOnMain {
      self.lifecycleGeneration &+= 1
      self.cancelFinalization()
      self.trackingRequested = true
      self.ensureMotionChangeListener()
      let bgGeo = BackgroundGeolocation.sharedInstance()
      bgGeo.start()
      bgGeo.changePace(true)
    }
  }

  func carPlayDidDisconnect() {
    runOnMain {
      guard self.trackingRequested else { return }
      self.lifecycleGeneration &+= 1
      let generation = self.lifecycleGeneration
      self.pendingFinalization?.cancel()
      let finalization = DispatchWorkItem { [weak self] in
        guard let self = self,
              generation == self.lifecycleGeneration,
              self.trackingRequested else { return }
        self.pendingFinalization = nil
        self.trackingRequested = false
        self.requestFinalPosition(generation: generation)
      }
      self.pendingFinalization = finalization
      DispatchQueue.main.asyncAfter(
        deadline: .now() + Self.stopGrace,
        execute: finalization
      )
    }
  }

  private func canFinalize(_ generation: UInt) -> Bool {
    !trackingRequested && generation == lifecycleGeneration
  }

  private func cancelFinalization() {
    pendingFinalization?.cancel()
    pendingFinalization = nil
    pendingStationaryTransition?.cancel()
    pendingStationaryTransition = nil
    awaitingStationaryGeneration = nil
  }

  private func ensureMotionChangeListener() {
    guard !motionChangeListenerRegistered else { return }
    motionChangeListenerRegistered = true
    _ = BackgroundGeolocation.sharedInstance().onMotionChange { [weak self] _ in
      guard let self = self else { return }
      self.runOnMain {
        self.stationaryTransitionCompleted()
      }
    }
  }

  private func requestFinalPosition(generation: UInt) {
    guard canFinalize(generation) else { return }
    let request = TSCurrentPositionRequest(
      persist: true,
      success: { [weak self] _ in
        self?.runOnMain {
          self?.changeToStationary(generation: generation)
        }
      },
      failure: { [weak self] error in
        NSLog("[CarPlayGeoPlugin] getCurrentPosition failed: %@", error.localizedDescription)
        self?.runOnMain {
          self?.changeToStationary(generation: generation)
        }
      }
    )
    BackgroundGeolocation.sharedInstance().getCurrentPosition(request)
  }

  private func changeToStationary(generation: UInt) {
    guard canFinalize(generation) else { return }
    awaitingStationaryGeneration = generation
    let timeout = DispatchWorkItem { [weak self] in
      guard let self = self,
            self.awaitingStationaryGeneration == generation,
            self.canFinalize(generation) else { return }
      NSLog("[CarPlayGeoPlugin] changePace(false) motion-change timed out")
      self.stationaryTransitionCompleted()
    }
    pendingStationaryTransition = timeout
    DispatchQueue.main.asyncAfter(
      deadline: .now() + Self.stationaryTransitionTimeout,
      execute: timeout
    )
    BackgroundGeolocation.sharedInstance().changePace(false)
  }

  private func stationaryTransitionCompleted() {
    guard let generation = awaitingStationaryGeneration,
          canFinalize(generation) else { return }
    awaitingStationaryGeneration = nil
    pendingStationaryTransition?.cancel()
    pendingStationaryTransition = nil
    syncAndStop(generation: generation)
  }

  private func syncAndStop(generation: UInt) {
    guard canFinalize(generation) else { return }
    BackgroundGeolocation.sharedInstance().sync({ [weak self] _ in
      self?.runOnMain {
        self?.stopTracking(generation: generation)
      }
    }, failure: { [weak self] error in
      NSLog("[CarPlayGeoPlugin] sync failed: %@", error.localizedDescription)
      self?.runOnMain {
        self?.stopTracking(generation: generation)
      }
    })
  }

  private func stopTracking(generation: UInt) {
    guard canFinalize(generation) else { return }
    BackgroundGeolocation.sharedInstance().stop()
  }

  private func runOnMain(_ block: @escaping () -> Void) {
    if Thread.isMainThread { block() }
    else { DispatchQueue.main.async(execute: block) }
  }
}
`;
}

function markerPath(platformProjectRoot: string): string {
  return path.join(platformProjectRoot, MARKER);
}

const withDrivingTask: ConfigPlugin = (config) => {
  let ownsEntitlement = false;
  config = withEntitlementsPlist(config, (cfg) => {
    ownsEntitlement = cfg.modResults[ENTITLEMENT_KEY] !== true;
    cfg.modResults[ENTITLEMENT_KEY] = true;
    return cfg;
  });
  config = withFinalizedMod(config, [
    'ios',
    (cfg) => {
      if (ownsEntitlement) {
        fs.writeFileSync(
          markerPath(cfg.modRequest.platformProjectRoot),
          'Managed by expo-detect-carplay.\n'
        );
      }
      return cfg;
    },
  ]);
  return withInfoPlist(config, (cfg) => {
    const info = cfg.modResults as Record<string, any>;
    const manifest = info.UIApplicationSceneManifest ?? (info.UIApplicationSceneManifest = {});
    manifest.UIApplicationSupportsMultipleScenes = true;
    const configurations = manifest.UISceneConfigurations ?? (manifest.UISceneConfigurations = {});
    const role =
      configurations.CPTemplateApplicationSceneSessionRoleApplication ??
      (configurations.CPTemplateApplicationSceneSessionRoleApplication = []);
    const existing = role.find(
      (entry: any) =>
        entry?.UISceneConfigurationName === SCENE_NAME ||
        entry?.UISceneDelegateClassName === SCENE_CLASS ||
        LEGACY_SCENE_CLASSES.has(entry?.UISceneDelegateClassName)
    );
    const scene = {
      UISceneClassName: 'CPTemplateApplicationScene',
      UISceneConfigurationName: SCENE_NAME,
      UISceneDelegateClassName: SCENE_CLASS,
    };
    if (existing) Object.assign(existing, scene);
    else role.push(scene);
    return cfg;
  });
};

const withoutDrivingTask: ConfigPlugin = (config) => {
  config = withEntitlementsPlist(config, (cfg) => {
    if (fs.existsSync(markerPath(cfg.modRequest.platformProjectRoot))) {
      delete cfg.modResults[ENTITLEMENT_KEY];
    }
    return cfg;
  });
  config = withInfoPlist(config, (cfg) => {
    const info = cfg.modResults as Record<string, any>;
    const manifest = info.UIApplicationSceneManifest;
    const configurations = manifest?.UISceneConfigurations;
    const key = 'CPTemplateApplicationSceneSessionRoleApplication';
    const role = configurations?.[key];
    if (!Array.isArray(role)) return cfg;
    configurations[key] = role.filter(
      (entry: any) =>
        entry?.UISceneConfigurationName !== SCENE_NAME &&
        entry?.UISceneDelegateClassName !== SCENE_CLASS
    );
    if (configurations[key].length === 0) delete configurations[key];
    return cfg;
  });
  return withFinalizedMod(config, [
    'ios',
    (cfg) => {
      const file = markerPath(cfg.modRequest.platformProjectRoot);
      if (fs.existsSync(file)) fs.rmSync(file);
      return cfg;
    },
  ]);
};

function assertBackgroundGeolocationInstalled(projectRoot: string): void {
  try {
    createRequire(path.join(projectRoot, 'package.json')).resolve(
      'react-native-background-geolocation'
    );
  } catch {
    throw new Error(
      '[expo-detect-carplay] backgroundGeolocation: true requires react-native-background-geolocation to be installed.'
    );
  }
}

function findAppDir(platformRoot: string) {
  for (const entry of fs.readdirSync(platformRoot)) {
    const appDelegatePath = path.join(platformRoot, entry, 'AppDelegate.swift');
    if (fs.existsSync(appDelegatePath)) return { appDir: entry, appDelegatePath };
  }
  return null;
}

function getXcodeGroupKey(project: any, groupName: string) {
  const groups = project.hash.project.objects.PBXGroup as Record<string, any>;
  return Object.keys(groups).find(
    (key) =>
      !key.endsWith('_comment') &&
      (groups[key].name === groupName || groups[key].path === groupName)
  );
}

function findClosingBrace(contents: string, openingIndex: number): number {
  let depth = 0;
  for (let index = openingIndex; index < contents.length; index += 1) {
    if (contents[index] === '{') depth += 1;
    if (contents[index] === '}' && --depth === 0) return index;
  }
  return -1;
}

function modifyAppDelegate(contents: string): string {
  const importLine = 'import ExpoDetectCarplay';
  if (!contents.includes(importLine)) {
    const lines = contents.split('\n');
    const lastImport = lines.reduce(
      (last, line, index) => (line.trimStart().startsWith('import ') ? index : last),
      -1
    );
    lines.splice(lastImport + 1, 0, `${importLine} // expo-detect-carplay-generated`);
    contents = lines.join('\n');
  }
  const call = 'CarPlayLifecycleRegistry.register(CarPlayGeoPlugin())';
  if (contents.includes(call)) return contents;
  const launchMethod =
    /^([ \t]*)(?:(?:public|open)\s+)?override\s+func\s+application\s*\([\s\S]{0,1000}?didFinishLaunchingWithOptions[\s\S]{0,1000}?\)\s*->\s*Bool\s*\{/m;
  const match = launchMethod.exec(contents);
  if (match) {
    return (
      contents.slice(0, match.index) +
      match[0] +
      `\n${match[1]}  ${call}\n` +
      contents.slice(match.index + match[0].length)
    );
  }
  const appDelegate = /^([ \t]*)(?:(?:public|open|final)\s+)*class\s+AppDelegate\b[^{]*\{/m.exec(
    contents
  );
  if (!appDelegate) return contents;
  const opening = appDelegate.index + appDelegate[0].lastIndexOf('{');
  const closing = findClosingBrace(contents, opening);
  if (closing < 0) return contents;
  const indent = `${appDelegate[1]}  `;
  const method = `\n${indent}override func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {\n${indent}  ${call}\n${indent}  return super.application(application, didFinishLaunchingWithOptions: launchOptions)\n${indent}}\n`;
  return contents.slice(0, closing) + method + contents.slice(closing);
}

function unmodifyAppDelegate(contents: string): string {
  contents = contents.replace(
    /\r?\n[ \t]*override func application\(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: \[UIApplication\.LaunchOptionsKey: Any\]\?\) -> Bool \{\r?\n[ \t]*CarPlayLifecycleRegistry\.register\(CarPlayGeoPlugin\(\)\)\r?\n[ \t]*return super\.application\(application, didFinishLaunchingWithOptions: launchOptions\)\r?\n[ \t]*\}\r?\n?/g,
    '\n'
  );
  contents = contents.replace(
    /^[ \t]*CarPlayLifecycleRegistry\.register\(CarPlayGeoPlugin\(\)\)\r?\n/gm,
    ''
  );
  const generatedImport = /^import ExpoDetectCarplay \/\/ expo-detect-carplay-generated\r?\n/m;
  const withoutImport = contents.replace(generatedImport, '');
  if (!/\bCarPlayLifecycleRegistry\b/.test(withoutImport)) contents = withoutImport;
  return contents;
}

const withGeoPlugin: ConfigPlugin = (config) => {
  config = withDangerousMod(config, [
    'ios',
    (cfg) => {
      assertBackgroundGeolocationInstalled(cfg.modRequest.projectRoot);
      const app = findAppDir(cfg.modRequest.platformProjectRoot);
      if (app) {
        fs.writeFileSync(
          path.join(cfg.modRequest.platformProjectRoot, app.appDir, 'CarPlayGeoPlugin.swift'),
          getIOSCarPlayPluginSwift()
        );
      }
      return cfg;
    },
  ]);
  config = withXcodeProject(config, (cfg) => {
    const app = findAppDir(cfg.modRequest.platformProjectRoot);
    const group = app?.appDir ?? cfg.modRequest.projectName;
    if (!group) return cfg;
    const file = `${group}/CarPlayGeoPlugin.swift`;
    if (!cfg.modResults.hasFile(file)) {
      cfg.modResults.addSourceFile(
        file,
        { target: cfg.modResults.getFirstTarget().uuid },
        getXcodeGroupKey(cfg.modResults, group)
      );
    }
    return cfg;
  });
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const app = findAppDir(cfg.modRequest.platformProjectRoot);
      if (app) {
        fs.writeFileSync(
          app.appDelegatePath,
          modifyAppDelegate(fs.readFileSync(app.appDelegatePath, 'utf8'))
        );
      }
      return cfg;
    },
  ]);
};

const withoutGeoPlugin: ConfigPlugin = (config) => {
  config = withXcodeProject(config, (cfg) => {
    const app = findAppDir(cfg.modRequest.platformProjectRoot);
    const group = app?.appDir ?? cfg.modRequest.projectName;
    if (!group) return cfg;
    const file = `${group}/CarPlayGeoPlugin.swift`;
    if (cfg.modResults.hasFile(file) && cfg.modResults.removeSourceFile) {
      cfg.modResults.removeSourceFile(
        file,
        { target: cfg.modResults.getFirstTarget().uuid },
        getXcodeGroupKey(cfg.modResults, group)
      );
    }
    return cfg;
  });
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const app = findAppDir(cfg.modRequest.platformProjectRoot);
      if (!app) return cfg;
      const generated = path.join(
        cfg.modRequest.platformProjectRoot,
        app.appDir,
        'CarPlayGeoPlugin.swift'
      );
      if (fs.existsSync(generated)) fs.rmSync(generated);
      const original = fs.readFileSync(app.appDelegatePath, 'utf8');
      const cleaned = unmodifyAppDelegate(original);
      if (cleaned !== original) fs.writeFileSync(app.appDelegatePath, cleaned);
      return cfg;
    },
  ]);
};

const withCarPlayIOS: ConfigPlugin<CarPlayIOSPluginProps | void> = (config, props) => {
  const options = props ?? {};
  config = options.backgroundGeolocation ? withGeoPlugin(config) : withoutGeoPlugin(config);
  if (options.backgroundLocation === true) {
    config = withInfoPlist(config, (cfg) => {
      const modes: string[] = Array.isArray(cfg.modResults.UIBackgroundModes)
        ? cfg.modResults.UIBackgroundModes
        : [];
      if (!modes.includes('location')) modes.push('location');
      cfg.modResults.UIBackgroundModes = modes;
      cfg.modResults.NSLocationWhenInUseUsageDescription =
        options.locationWhenInUsePermission ??
        cfg.modResults.NSLocationWhenInUseUsageDescription ??
        'Allow $(PRODUCT_NAME) to observe connected vehicle sessions.';
      cfg.modResults.NSLocationAlwaysAndWhenInUseUsageDescription =
        options.locationAlwaysPermission ??
        cfg.modResults.NSLocationAlwaysAndWhenInUseUsageDescription ??
        'Allow $(PRODUCT_NAME) to reconcile connected vehicle sessions in the background.';
      return cfg;
    });
  }
  if (options.carplayDrivingTask === true) return withDrivingTask(config);
  if (options.carplayDrivingTask === false) return withoutDrivingTask(config);
  return config;
};

export const __iosCarPlayPluginInternals = {
  modifyAppDelegate,
  unmodifyAppDelegate,
};

export default withCarPlayIOS;
