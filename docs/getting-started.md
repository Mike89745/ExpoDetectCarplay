# Getting started

## 1. Install

```sh
npx expo install expo-detect-carplay
```

Use an Expo development build or bare React Native application. Expo Go cannot
load this package's native code.

## 2. Add the config plugin

```json
{
  "expo": {
    "plugins": ["expo-detect-carplay"]
  }
}
```

The default plugin configuration registers the Android application for Android
Auto. Basic iOS detection observes the active `.carAudio` route and does not add
the Driving Task entitlement.

Rebuild after changing native options:

```sh
npx expo prebuild
npx expo run:android
# or: npx expo run:ios
```

## 3. Request permissions and monitor

```ts
import { Platform } from 'react-native';
import { ExpoDetectCarplay } from 'expo-detect-carplay';

if (Platform.OS === 'android') {
  const granted = await ExpoDetectCarplay.requestPermissionsAsync();
  if (!granted) {
    throw new Error('Vehicle connection permissions were not granted');
  }
}

const subscription = ExpoDetectCarplay.addListener('onCarPlayConnected', ({ transport }) =>
  console.log('vehicle connected over', transport)
);

await ExpoDetectCarplay.startCarPlayMonitoring();
```

Android requires this permission call before persistent monitoring: it requests
Bluetooth permissions on API 31+ and notification permission on API 33+. Basic
iOS audio-route monitoring needs no permission. On iOS,
`requestPermissionsAsync` requests notification and Always Location
authorization, so enable `ios.backgroundLocation` (or otherwise provide both
location usage-description keys) before calling it.

## Next steps

- [Monitoring](monitoring.md)
- [Config plugin](config-plugin.md)
- [Platform support](platform-support.md)
- [Errors](errors.md)
