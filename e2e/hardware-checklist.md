# Physical CarPlay and Android Auto E2E checklist

Run every scenario on the release candidate built from a clean prebuild. Use a
real iPhone with an authorized CarPlay environment and a real Android phone with
Android Auto. Capture the app screen, OS notifications, exported native event
log, and receiving-server request log.

Record before testing:

- commit, package version, build type, phone model, OS/API version;
- vehicle/head-unit or simulator version and wired/wireless transport;
- granted Bluetooth, location, and notification state;
- iOS provisioning entitlements and Android automotive descriptor metadata.

## Installation and permissions

- Inspect the clean prebuild. Confirm the config plugin produced one copy of
  every requested manifest, scene, background-mode, and generated integration
  entry without replacing host-owned configuration.
- Start from a clean install. Deny each requested permission once and confirm the
  result/error, then grant the permissions required by the selected options.
- Verify diagnostics report expected metadata/provider availability before
  starting monitoring.

## Connection transitions

- Start monitoring and connect wired CarPlay. Verify one
  `onCarPlayConnected`, `transport`, timestamps, status snapshot, diagnostics,
  notification, native log entry, and forwarded request.
- Disconnect and verify one `onCarPlayDisconnected` plus cleared connection
  snapshot. Repeat rapidly to detect duplicate/debounced callbacks.
- Repeat the full transition for wireless CarPlay when supported.
- Repeat the full transition for wired and wireless Android Auto. Verify the
  raw connection type and mapped transport in diagnostics/payloads.
- Keep the accessory connected while backgrounding, swiping away, and
  cold-starting the app. Verify persisted status reconciliation and that the JS
  event subscriber resumes without duplicate events.
- On Android, reboot with monitoring enabled and verify foreground service and
  watchdog recovery. Kill the app process and repeat connect/disconnect.
- Stop monitoring and verify observer/service/watchdog shutdown and a cleared
  connection snapshot.

## Notifications, storage, forwarding, and errors

- Verify default and custom connected/disconnected notifications and Android
  channel/foreground-service configuration. Disable event notifications and
  prove they stop.
- Enable event logging, generate all event types, filter by type/time/limit,
  clear entries, then destroy the database and verify logging is disabled.
- Point native forwarding at a controlled HTTPS receiver. Verify headers,
  optional ID, connected/disconnected/error payloads, offline queue/retry, and
  ordering. Never use production credentials for this test.
- Remove required Android metadata or use an unsupported provider build and
  verify actionable start/observer errors through the promise, event listener,
  native log, and forwarding path.
- On iOS, test only entitlements granted to the consuming app; do not enable the
  Driving Task entitlement merely to make a test build pass.

The run is complete only when both platform rows have evidence for every item;
an emulator-only pass is not a substitute for this checklist.
