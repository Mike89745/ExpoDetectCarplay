# Monitoring

Monitoring is persistent. Once enabled, native code stores that preference and
restores observation after process recreation. Android additionally restores
its foreground service after app update and device reboot.

```ts
import { ExpoDetectCarplay } from 'expo-detect-carplay';

const connected = ExpoDetectCarplay.addListener('onCarPlayConnected', (event) => {
  console.log(event.transport, event.timestamp, event.timestampIso);
});
const disconnected = ExpoDetectCarplay.addListener('onCarPlayDisconnected', (event) =>
  console.log(event.reason ?? 'observed')
);
const errors = ExpoDetectCarplay.addListener('onCarPlayError', (event) => {
  console.error(event.code, event.message);
});

await ExpoDetectCarplay.startCarPlayMonitoring();

const status = ExpoDetectCarplay.getCarPlayConnectionStatus();
const diagnostics = ExpoDetectCarplay.getCarPlayDiagnostics();

// Call only when the app no longer wants persistent monitoring:
await ExpoDetectCarplay.stopCarPlayMonitoring();
connected.remove();
disconnected.remove();
errors.remove();
```

`stopCarPlayMonitoring` disables persistent monitoring and clears the active
connection state. Removing JavaScript subscriptions alone does not stop native
monitoring.

## React hook

```tsx
const {
  connected,
  transport,
  isMonitoring,
  lastConnectedAt,
  lastDisconnectedAt,
  startMonitoring,
  stopMonitoring,
  getDiagnostics,
} = useCarPlay({ autoStart: true });
```

The hook owns JS subscriptions for the component lifetime. `autoStart` defaults
to `false`; when enabled, it starts monitoring only if native monitoring is not
already active.
