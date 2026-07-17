# Expo config plugin

The minimal configuration is:

```json
{
  "expo": {
    "plugins": ["expo-detect-carplay"]
  }
}
```

For dynamic app configuration, import the option type from the public plugin
subpath:

```ts
import type { CarPlayPluginProps } from 'expo-detect-carplay/plugin';

const options = {
  ios: {
    backgroundLocation: false,
    carplayDrivingTask: false,
    backgroundGeolocation: false,
  },
  android: {
    backgroundGeolocation: false,
    androidAuto: {
      register: true,
      usesName: 'template',
    },
  },
} satisfies CarPlayPluginProps;
```

## Android options

| Option                          | Default    | Purpose                                                                 |
| ------------------------------- | ---------- | ----------------------------------------------------------------------- |
| `android.androidAuto.register`  | `true`     | Adds Android Auto application metadata and the automotive descriptor.   |
| `android.androidAuto.usesName`  | `template` | Sets the descriptor category to `template`, `media`, or `notification`. |
| `android.backgroundGeolocation` | `false`    | Generates the optional background-geolocation vehicle bridge.           |

When registration is disabled, the plugin removes only metadata and descriptor
content that it owns.

## iOS options

| Option                            | Default                         | Purpose                                                                  |
| --------------------------------- | ------------------------------- | ------------------------------------------------------------------------ |
| `ios.backgroundLocation`          | `false`                         | Enables significant-location and visit wakes for state reconciliation.   |
| `ios.locationWhenInUsePermission` | Existing value or built-in text | Sets the When-In-Use permission description.                             |
| `ios.locationAlwaysPermission`    | Existing value or built-in text | Sets the Always permission description.                                  |
| `ios.carplayDrivingTask`          | Unmanaged                       | `true` adds and `false` removes plugin-owned Driving Task configuration. |
| `ios.backgroundGeolocation`       | `false`                         | Generates the optional background-geolocation vehicle bridge.            |

Do not enable `carplayDrivingTask` unless Apple granted the entitlement and the
distribution provisioning profile includes it. Basic audio-route detection does
not require this option.

Rebuild native projects after changing any option.
