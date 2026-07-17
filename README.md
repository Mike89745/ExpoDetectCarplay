# expo-detect-carplay

Expo native module for observing CarPlay and Android Auto connection state on
iOS and Android, including persistent monitoring, notifications, event logging,
native API forwarding, and optional background-geolocation integration.

| Platform | Detection                                    | Background behavior                                 |
| -------- | -------------------------------------------- | --------------------------------------------------- |
| Android  | AndroidX `CarConnection`                     | Connected-device foreground service                 |
| iOS      | Car audio route; optional Driving Task scene | Foreground observation with optional location wakes |
| Web      | Inert fallback                               | Monitoring methods are no-ops                       |

## Important constraints

- Native code is required. Expo Go is not supported.
- Add the bundled config plugin before creating a development build.
- Basic iOS detection does not require a CarPlay entitlement, but audio-route
  observation cannot launch a terminated app.
- Enable `ios.carplayDrivingTask` only after Apple grants the entitlement and
  the provisioning profile contains it.
- The background-geolocation bridge is optional and requires
  `react-native-background-geolocation` in the consuming app.

## Install

```sh
npx expo install expo-detect-carplay
```

Add the config plugin:

```json
{
  "expo": {
    "plugins": ["expo-detect-carplay"]
  }
}
```

Rebuild the native application after adding or changing the plugin:

```sh
npx expo prebuild
npx expo run:android
# or: npx expo run:ios
```

See [Getting started](docs/getting-started.md) for platform permissions and the
complete installation path.

## Monitor vehicle connections

```ts
import { Platform } from 'react-native';
import { ExpoDetectCarplay } from 'expo-detect-carplay';

if (Platform.OS === 'android') {
  const granted = await ExpoDetectCarplay.requestPermissionsAsync();
  if (!granted) {
    throw new Error('Vehicle connection permissions were not granted');
  }
}

const connected = ExpoDetectCarplay.addListener('onCarPlayConnected', (event) =>
  console.log('connected', event.transport)
);
const disconnected = ExpoDetectCarplay.addListener('onCarPlayDisconnected', (event) =>
  console.log('disconnected', event.reason)
);

await ExpoDetectCarplay.startCarPlayMonitoring();
const status = ExpoDetectCarplay.getCarPlayConnectionStatus();

// When persistent monitoring is no longer wanted:
await ExpoDetectCarplay.stopCarPlayMonitoring();
connected.remove();
disconnected.remove();
```

The default export remains available for backwards compatibility. See
[Monitoring](docs/monitoring.md) for lifecycle, diagnostics, and cleanup.
Basic iOS audio-route monitoring needs no permission; call
`requestPermissionsAsync` on iOS only after configuring the location usage
descriptions through `ios.backgroundLocation`.

## React hook

```tsx
import { useCarPlay } from 'expo-detect-carplay';

function VehicleStatus() {
  const { connected, transport, isMonitoring } = useCarPlay({
    autoStart: true,
  });

  return null; // Render these values in your application UI.
}
```

## Typed config-plugin options

```ts
import type { CarPlayPluginProps } from 'expo-detect-carplay/plugin';
```

See [Config plugin](docs/config-plugin.md) for Android Auto registration, iOS
background location, the Driving Task entitlement, and integration options.

## Documentation

- [Documentation index](docs/index.md)
- [Getting started](docs/getting-started.md)
- [Monitoring](docs/monitoring.md)
- [Platform support](docs/platform-support.md)
- [Config plugin](docs/config-plugin.md)
- [Background geolocation](docs/background-geolocation.md)
- [Event logging and forwarding](docs/event-data.md)
- [Errors](docs/errors.md)
- [Generated runtime API](docs/reference/runtime/README.md)
- [Generated config-plugin API](docs/reference/plugin/README.md)
- [`llms.txt`](llms.txt)

## Contributing

```sh
npm run build
npm test -- --runInBand
npm run test:types
npm run lint
npm run docs:api
npm pack --dry-run
```

Repository-specific guidance is in [AGENTS.md](AGENTS.md).

## License

MIT
