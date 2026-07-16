# expo-detect-carplay

An Expo native module for observing CarPlay and Android Auto connection state on iOS and Android.

This package is independent from `expo-beacon`. Install either package on its own, or install both when an app needs beacon and vehicle-connection features.

## Installation

```sh
npx expo install expo-detect-carplay
```

This package contains native code, so it requires a development build or bare React Native app; it does not run in Expo Go.

Add the config plugin to your app config:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-detect-carplay",
        {
          "ios": {
            "backgroundGeolocation": false,
            "backgroundLocation": false,
            "carplayDrivingTask": false
          },
          "android": {
            "backgroundGeolocation": false,
            "androidAuto": {
              "register": true,
              "usesName": "template"
            }
          }
        }
      ]
    ]
  }
}
```

Run `npx expo prebuild` after changing native plugin options. In a bare iOS app, also run `npx pod-install`.

### Plugin options

- `android.androidAuto.register` defaults to `true` and adds the Android Auto application metadata and automotive descriptor required by `CarConnection`.
- `android.androidAuto.usesName` defaults to `template`; supported values are `template`, `media`, and `notification`.
- `ios.backgroundGeolocation` and `android.backgroundGeolocation` default to `false`. Enable them to generate a native vehicle lifecycle bridge for `react-native-background-geolocation`; that dependency must already be installed and configured.
- `ios.backgroundLocation` defaults to `false`. Enable it if the app should use significant-location and visit wakes to reconcile state in the background; provide the matching location permission text as needed.
- `ios.carplayDrivingTask` defaults to unmanaged. Set it to `true` only after Apple grants the Driving Task entitlement and the provisioning profile contains it. This installs `ExpoDetectCarplay.CarPlaySceneDelegate` for authoritative lifecycle callbacks.

Basic iOS detection uses the active `.carAudio` route and does not require a CarPlay entitlement. Audio-route observation alone cannot launch a terminated app.

## Usage

```ts
import ExpoDetectCarplay from "expo-detect-carplay";

await ExpoDetectCarplay.requestPermissionsAsync();
await ExpoDetectCarplay.startCarPlayMonitoring();

const connected = ExpoDetectCarplay.addListener("onCarPlayConnected", (event) => {
  console.log("vehicle connected", event.transport);
});

const disconnected = ExpoDetectCarplay.addListener(
  "onCarPlayDisconnected",
  (event) => console.log("vehicle disconnected", event.reason),
);

const status = ExpoDetectCarplay.getCarPlayConnectionStatus();
const diagnostics = ExpoDetectCarplay.getCarPlayDiagnostics();

connected.remove();
disconnected.remove();
await ExpoDetectCarplay.stopCarPlayMonitoring();
```

Or use the hook:

```tsx
import { useCarPlay } from "expo-detect-carplay";

const { connected, transport, startMonitoring, stopMonitoring } = useCarPlay({
  autoStart: true,
});
```

## API

- `startCarPlayMonitoring()` / `stopCarPlayMonitoring()`
- `isCarPlayMonitoringEnabled()`
- `getCarPlayConnectionStatus()`
- `getCarPlayDiagnostics()`
- `requestPermissionsAsync()`
- `setCarPlayNotificationConfig(config)`
- `enableEventLogging()` / `disableEventLogging()` / `isEventLoggingEnabled()`
- `getEventLogs(options?)` / `clearEventLogs()` / `destroyEventLogs()`
- `setApiEndpoint(url, apiKey?, id?)` / `getApiEndpoint()`
- events: `onCarPlayConnected`, `onCarPlayDisconnected`, `onCarPlayError`

Event logs, notification settings, API forwarding, and monitoring state are owned by this package and are separate from `expo-beacon`.

## Platform behavior

- Android uses `androidx.car.app.connection.CarConnection` and a connected-device foreground service. Monitoring is restored after process death, app updates, and reboot while it remains enabled.
- iOS observes `AVAudioSession` route changes, with optional location wakes and optional entitlement-backed CarPlay scene callbacks.
- Web exports inert status values and no-op async monitoring methods.

## License

MIT
