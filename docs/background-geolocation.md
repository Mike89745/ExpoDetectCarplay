# Background geolocation integration

The optional bridge connects vehicle lifecycle events to
`react-native-background-geolocation`:

- A CarPlay or Android Auto connection starts tracking and switches to moving.
- While connected, a native watchdog checks the SDK every five minutes. If the
  SDK is disabled, the bridge starts it again and restores moving pace.
- A disconnect waits 30 seconds to absorb short reconnects.
- After the grace period, it persists a final position, switches to stationary,
  synchronizes pending records, and stops tracking.

The watchdog is canceled immediately when the vehicle disconnects. Its
five-minute cadence is best-effort on iOS because the operating system can
suspend the app between background execution opportunities.

## Enable the bridge

Install and configure `react-native-background-geolocation` in the consuming
application, then enable each target platform:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-detect-carplay",
        {
          "ios": { "backgroundGeolocation": true },
          "android": { "backgroundGeolocation": true }
        }
      ]
    ]
  }
}
```

The config plugin fails during prebuild with an actionable error if the option
is enabled but the dependency cannot be resolved.

## Ownership boundaries

- The app owns SDK configuration, licensing, location permissions, HTTP
  endpoints, and authorization.
- This package only translates vehicle connect/disconnect events into tracking
  lifecycle operations.
- Disabling the option removes generated bridge source and registration code on
  the next prebuild.
- Generated native sources target the background-geolocation v5 Android
  `LocationEvent` callback and iOS `TSCurrentPositionRequest.make` factory.
