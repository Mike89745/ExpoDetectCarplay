# Errors

Promise rejections expose machine-readable codes. Native observer failures can
also be emitted through `onCarPlayError`:

```ts
import { ExpoDetectCarplay } from 'expo-detect-carplay';
import type { CarPlayErrorEvent } from 'expo-detect-carplay';

const subscription = ExpoDetectCarplay.addListener('onCarPlayError', (error: CarPlayErrorEvent) =>
  console.error(error.code, error.message)
);
```

`CarPlayErrorCode` is exported as a string union.

| Code                      | Meaning and corrective action                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `PERMISSION_DENIED`       | Android 14+ is missing a required Bluetooth permission. Call `requestPermissionsAsync` before monitoring.   |
| `CARPLAY_START_FAILED`    | Android could not start persistent monitoring. Inspect native logs and foreground-service prerequisites.    |
| `CARPLAY_STOP_FAILED`     | Android could not stop or clean up monitoring. Inspect native logs.                                         |
| `CARPLAY_OBSERVER_FAILED` | The Android car connection observer failed. Check Android Auto metadata and diagnostics.                    |
| `NO_CONTEXT`              | The React Native context was unavailable during the requested operation. Retry after module initialization. |
