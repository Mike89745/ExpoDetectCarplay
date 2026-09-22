const { AndroidConfig, withAndroidManifest, withInfoPlist } = require('@expo/config-plugins');

const ANDROID_FLAG = 'expo.modules.detectcarplay.VIRTUAL_TESTING_ENABLED';
const IOS_FLAG = 'ExpoDetectCarPlayVirtualTestingEnabled';

module.exports = function withVirtualCarPlayTesting(config) {
  config = withAndroidManifest(config, (androidConfig) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(androidConfig.modResults);
    application.$ = application.$ ?? {};
    application.$['android:usesCleartextTraffic'] = 'true';
    application['meta-data'] = application['meta-data'] ?? [];

    const existing = application['meta-data'].find(
      (item) => item.$?.['android:name'] === ANDROID_FLAG
    );
    if (existing) {
      existing.$['android:value'] = 'true';
    } else {
      application['meta-data'].push({
        $: {
          'android:name': ANDROID_FLAG,
          'android:value': 'true',
        },
      });
    }
    return androidConfig;
  });

  return withInfoPlist(config, (iosConfig) => {
    iosConfig.modResults[IOS_FLAG] = true;
    iosConfig.modResults.NSAppTransportSecurity = {
      ...(iosConfig.modResults.NSAppTransportSecurity ?? {}),
      NSAllowsLocalNetworking: true,
    };
    return iosConfig;
  });
};
