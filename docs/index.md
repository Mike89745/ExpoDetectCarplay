# expo-detect-carplay documentation

`expo-detect-carplay` observes CarPlay and Android Auto connection state from
Expo development builds and bare React Native applications.

## Choose a task

- New installation: [Getting started](getting-started.md)
- Observe connection changes: [Monitoring](monitoring.md)
- Configure native detection: [Config plugin](config-plugin.md)
- Start or stop location tracking with the vehicle lifecycle:
  [Background geolocation](background-geolocation.md)
- Persist or forward events: [Event data](event-data.md)
- Compare platforms: [Platform support](platform-support.md)
- Handle failures: [Errors](errors.md)

Generated references are under `reference/runtime` and `reference/plugin` after
running `npm run docs:api`.

## Rules that prevent most integration mistakes

- The package contains native code and does not work in Expo Go.
- Add the config plugin and rebuild the native app before importing the module.
- Call `requestPermissionsAsync` before monitoring on Android.
- Basic iOS audio-route detection needs no entitlement but cannot wake a
  terminated app.
- `ios.carplayDrivingTask` is not a generic CarPlay switch; enable it only with
  the Apple-granted entitlement in the provisioning profile.
- Background geolocation is optional and owned/configured by the consuming app.
