import ExpoDetectCarplayWeb from '../ExpoDetectCarplayModule.web';

describe('web fallback', () => {
  it('returns deterministic unsupported-platform state', async () => {
    await expect(ExpoDetectCarplayWeb.startCarPlayMonitoring()).resolves.toBeUndefined();
    await expect(ExpoDetectCarplayWeb.stopCarPlayMonitoring()).resolves.toBeUndefined();
    await expect(ExpoDetectCarplayWeb.requestPermissionsAsync()).resolves.toBe(true);
    expect(ExpoDetectCarplayWeb.isCarPlayMonitoringEnabled()).toBe(false);
    expect(ExpoDetectCarplayWeb.getCarPlayConnectionStatus()).toEqual({ connected: false });
    expect(ExpoDetectCarplayWeb.getApiEndpoint()).toEqual({
      url: null,
      apiKey: null,
      id: null,
    });
  });

  it('fails clearly for unavailable persistent storage', () => {
    expect(() => ExpoDetectCarplayWeb.enableEventLogging()).toThrow(
      'expo-detect-carplay is not supported on web.'
    );
    expect(() => ExpoDetectCarplayWeb.getEventLogs()).toThrow(
      'expo-detect-carplay is not supported on web.'
    );
  });

  it('provides inert event subscriptions', () => {
    const listener = jest.fn();
    const subscription = ExpoDetectCarplayWeb.addListener('onCarPlayConnected', listener);
    expect(ExpoDetectCarplayWeb.listenerCount('onCarPlayConnected')).toBe(0);
    expect(() => subscription.remove()).not.toThrow();
    expect(listener).not.toHaveBeenCalled();
  });
});
