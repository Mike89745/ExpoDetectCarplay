import {
  __androidCarPlayPluginInternals,
  getAndroidCarPlayPluginKotlin,
} from '../../plugin/src/withCarPlayAndroid';
import {
  __iosCarPlayPluginInternals,
  getIOSCarPlayPluginSwift,
} from '../../plugin/src/withCarPlayIOS';

describe('generated vehicle background-geolocation plugins', () => {
  it('generates an Android CarPlay lifecycle bridge', () => {
    const source = getAndroidCarPlayPluginKotlin('com.example.app');
    expect(source).toContain('CarPlayEventPlugin');
    expect(source).toContain('onCarPlayConnected');
    expect(source).toContain('bgGeo.start(noOp)');
    expect(source).not.toContain('BeaconEventPlugin');
  });

  it('generates an iOS CarPlay lifecycle bridge', () => {
    const source = getIOSCarPlayPluginSwift();
    expect(source).toContain('CarPlayLifecycleDelegate');
    expect(source).toContain('carPlayDidDisconnect');
    expect(source).toContain('BackgroundGeolocation.sharedInstance().stop()');
    expect(source).not.toContain('BeaconLifecycleDelegate');
  });

  it('adds and removes only its Android registration', () => {
    const original = `package com.example\n\nclass MainApplication {\n  override fun onCreate() {\n    super.onCreate()\n  }\n}\n`;
    const modified = __androidCarPlayPluginInternals.modifyMainApplication(original);
    expect(modified).toContain('CarPlayPluginRegistry.register(CarPlayGeoPlugin(this))');
    expect(__androidCarPlayPluginInternals.unmodifyMainApplication(modified)).not.toContain(
      'CarPlayPluginRegistry'
    );
  });

  it('preserves other AppDelegate registrations during cleanup', () => {
    const contents = `import ExpoDetectCarplay // expo-detect-carplay-generated\n\nfinal class AppDelegate {\n  func setup() {\n    CarPlayLifecycleRegistry.register(CarPlayGeoPlugin())\n    BeaconLifecycleRegistry.register(BeaconGeoPlugin())\n  }\n}\n`;
    const cleaned = __iosCarPlayPluginInternals.unmodifyAppDelegate(contents);
    expect(cleaned).toContain('BeaconLifecycleRegistry');
    expect(cleaned).not.toContain('CarPlayGeoPlugin');
  });
});
