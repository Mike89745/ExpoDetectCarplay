import { ConfigPlugin, createRunOncePlugin } from '@expo/config-plugins';

import withCarPlayAndroid, { CarPlayAndroidPluginProps } from './withCarPlayAndroid';
import withCarPlayIOS, { CarPlayIOSPluginProps } from './withCarPlayIOS';

const pkg = require('../../package.json');

/** Options accepted by the bundled Expo config plugin. */
export type CarPlayPluginProps = {
  /** iOS detection, entitlement, location-wake, and integration settings. */
  ios?: CarPlayIOSPluginProps;
  /** Android Auto registration and optional integration settings. */
  android?: CarPlayAndroidPluginProps;
};

export type { AndroidAutoUsesName, CarPlayAndroidPluginProps } from './withCarPlayAndroid';
export type { CarPlayIOSPluginProps } from './withCarPlayIOS';

const withCarPlay: ConfigPlugin<CarPlayPluginProps | void> = (config, props) => {
  const options = props ?? {};
  config = withCarPlayIOS(config, options.ios);
  config = withCarPlayAndroid(config, options.android);
  return config;
};

export default createRunOncePlugin(withCarPlay, 'expo-detect-carplay', pkg.version);
