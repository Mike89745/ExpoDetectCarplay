import DefaultExpoDetectCarplay, { ExpoDetectCarplay, useCarPlay } from 'expo-detect-carplay';
import type { CarPlayErrorCode, CarPlayEventName, CarPlayTransport } from 'expo-detect-carplay';
import type { CarPlayPluginProps } from 'expo-detect-carplay/plugin';

const pluginOptions = {
  ios: {
    backgroundLocation: false,
    carplayDrivingTask: false,
    backgroundGeolocation: false,
  },
  android: {
    backgroundGeolocation: false,
    androidAuto: { register: true, usesName: 'template' },
  },
} satisfies CarPlayPluginProps;
const eventName: CarPlayEventName = 'onCarPlayConnected';
const errorCode: CarPlayErrorCode = 'CARPLAY_OBSERVER_FAILED';
const transport: CarPlayTransport = 'projection';

void DefaultExpoDetectCarplay;
void ExpoDetectCarplay;
void useCarPlay;
void pluginOptions;
void eventName;
void errorCode;
void transport;

void ExpoDetectCarplay.startCarPlayMonitoring();
void ExpoDetectCarplay.getCarPlayConnectionStatus();
