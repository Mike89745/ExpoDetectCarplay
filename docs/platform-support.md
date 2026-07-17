# Platform support

| Capability                  | Android                  | iOS                               | Web                 |
| --------------------------- | ------------------------ | --------------------------------- | ------------------- |
| Connection events           | AndroidX `CarConnection` | Car audio route                   | No events           |
| Persistent monitoring       | Foreground service       | Persisted observer state          | Inert               |
| Restore after reboot/update | Supported                | Process-start reconciliation      | Not applicable      |
| Authoritative CarPlay scene | Not applicable           | Optional Driving Task entitlement | Not applicable      |
| Background reconciliation   | Native service           | Optional location wakes           | Not applicable      |
| Event logging               | SQLite                   | SQLite                            | Unsupported         |
| Native API forwarding       | Supported                | Supported                         | Inert configuration |

## Android

- Monitoring runs in a connected-device foreground service.
- API 31+ requires Bluetooth scan/connect permissions; API 33+ can require
  notification permission.
- The config plugin registers Android Auto metadata and an automotive descriptor
  by default.
- Diagnostics report whether car metadata is present, the provider is queryable,
  the observer is active, and the service is alive.

## iOS

- Basic detection watches the active `.carAudio` route and needs no CarPlay
  entitlement.
- Audio-route observation works while the process is alive; it cannot launch a
  terminated application.
- `backgroundLocation` can use significant-location and visit wakes to
  reconcile state when iOS wakes the app.
- `carplayDrivingTask` installs an authoritative CarPlay scene but requires an
  Apple-granted entitlement and matching provisioning profile.

## Web

Monitoring calls resolve without native work, status remains disconnected,
diagnostics return inert values, and event logging operations are unsupported.
