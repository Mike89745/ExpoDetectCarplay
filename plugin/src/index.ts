import { ConfigPlugin, createRunOncePlugin } from '@expo/config-plugins';

import withCarPlayAndroid, { CarPlayAndroidPluginProps } from './withCarPlayAndroid';
import withCarPlayIOS, { CarPlayIOSPluginProps } from './withCarPlayIOS';

const pkg = require('../../package.json');

export type CarPlayPluginProps = {
  ios?: CarPlayIOSPluginProps;
  android?: CarPlayAndroidPluginProps;
};

const withCarPlay: ConfigPlugin<CarPlayPluginProps | void> = (config, props) => {
  const options = props ?? {};
  config = withCarPlayIOS(config, options.ios);
  config = withCarPlayAndroid(config, options.android);
  return config;
};

export default createRunOncePlugin(withCarPlay, 'expo-detect-carplay', pkg.version);
