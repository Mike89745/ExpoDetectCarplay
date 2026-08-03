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
    expect(source).toContain(
      'Log.w(TAG, "Tracking watchdog restarting disabled background geolocation")'
    );
    expect(source).toContain('ensureTrackingStarted()');
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
    expect(source).toContain(
      'NSLog("[CarPlayGeoPlugin] Tracking watchdog restarting disabled background geolocation")'
    );
    expect(source).toContain('bgGeo.start()');
    expect(source).toContain('bgGeo.changePace(true)');
    expect(source).toContain('self.scheduleHealthCheck(generation: self.lifecycleGeneration)');
    expect(source).toContain('pendingHealthCheck?.cancel()');
    expect(source).toContain('generation == self.lifecycleGeneration');
    expect(source).toMatch(
      /func carPlayDidDisconnect\(\) \{\s+runOnMain \{\s+self\.cancelHealthCheck\(\)/
    );
    expect(source.match(/private var pendingHealthCheck: DispatchWorkItem\?/g)).toHaveLength(1);
  });
});
