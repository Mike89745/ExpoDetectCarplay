import { getAndroidCarPlayPluginKotlin } from '../../plugin/src/withCarPlayAndroid';
import { getIOSCarPlayPluginSwift } from '../../plugin/src/withCarPlayIOS';

describe('generated CarPlay background-geolocation plugin', () => {
  it('uses the current Android location callback type', () => {
    const source = getAndroidCarPlayPluginKotlin('com.example.app');

    expect(source).toContain('import com.transistorsoft.locationmanager.event.LocationEvent');
    expect(source).toContain('override fun onLocation(event: LocationEvent) = runOnMain {');
    expect(source).not.toContain('import com.transistorsoft.locationmanager.location.TSLocation');
  });

  it('generates a cancellable Android tracking watchdog', () => {
    const source = getAndroidCarPlayPluginKotlin('com.example.app');

    expect(source).toContain('private const val HEALTH_CHECK_INTERVAL_MS = 300_000L');
    expect(source).toContain(
      'TSConfig.getInstance(appContext).toMap(false)["enabled"] as? Boolean'
    );
    expect(source).toContain('logWatchdog("Tracking watchdog health check: enabled=$enabled")');
    expect(source).toContain('TSLog.log(level, "[$TAG] $message")');
    expect(source).toContain(
      'logWatchdog("Tracking watchdog restarting disabled background geolocation", "warn")'
    );
    expect(source).toContain('ensureTrackingStarted(watchdogRecovery = true)');
    expect(source).toContain('logWatchdog("Tracking watchdog recovery completed")');
    expect(source).toContain('scheduleHealthCheck(lifecycleGeneration)');
    expect(source).toContain('pendingHealthCheck?.let(mainHandler::removeCallbacks)');
    expect(source).toContain(
      'if (generation != lifecycleGeneration || !trackingRequested) return@Runnable'
    );
    expect(source).toMatch(
      /override fun onCarPlayDisconnected\(\) = runOnMain \{\s+cancelPendingHealthCheck\(\)/
    );
    expect(source.match(/private var pendingHealthCheck: Runnable\?/g)).toHaveLength(1);
  });

  it('uses the current iOS position-request factory', () => {
    const source = getIOSCarPlayPluginSwift();

    expect(source).toContain('TSCurrentPositionRequest.make(');
    expect(source).toContain('type: .current');
    expect(source).toContain('request.persist = true');
    expect(source).not.toContain('let request = TSCurrentPositionRequest(');
  });

  it('generates a cancellable iOS tracking watchdog', () => {
    const source = getIOSCarPlayPluginSwift();

    expect(source).toContain('private static let healthCheckInterval: TimeInterval = 300');
    expect(source).toContain('let enabled = bgGeo.getState()["enabled"] as? Bool');
    expect(source).toContain('source=\\(source), enabled=\\(String(describing: enabled))');
    expect(source).toContain('BackgroundGeolocation.sharedInstance().log(');
    expect(source).toContain('logWatchdog("Tracking watchdog recovery completed")');
    expect(source).toContain('BackgroundGeolocation.sharedInstance().onHeartbeat');
    expect(source).toContain('"preventSuspend": true');
    expect(source).toContain('"heartbeatInterval": Self.healthCheckInterval');
    expect(source).toContain('TSConfig.sharedInstance().update(with: restored)');
    expect(source).toContain('source: "heartbeat"');
    expect(source).toContain('self.nextHealthCheckAt = Date().addingTimeInterval');
    expect(source).toContain('bgGeo.start()');
    expect(source).toContain('bgGeo.changePace(true)');
    expect(source).toContain('self.scheduleHealthCheck(generation: self.lifecycleGeneration)');
    expect(source).toContain('pendingHealthCheck?.cancel()');
    expect(source).toContain('generation == self.lifecycleGeneration');
    expect(source).toMatch(
      /func carPlayDidDisconnect\(\) \{\s+runOnMain \{\s+self\.cancelHealthCheck\(\)/
    );
    expect(source).toMatch(
      /private func stopTracking\(generation: UInt\) \{[\s\S]*?BackgroundGeolocation\.sharedInstance\(\)\.stop\(\)\s+restoreBackgroundWatchdogConfiguration\(\)/
    );
    expect(source.match(/private var pendingHealthCheck: DispatchWorkItem\?/g)).toHaveLength(1);
  });
});
