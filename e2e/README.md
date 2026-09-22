# End-to-end test environment

This repository has three complementary test layers. An emulator can verify the
installed bridge and native service, but it cannot prove real CarPlay or Android
Auto accessory callbacks. Those claims therefore stay in the physical-device
layer.

## 1. Deterministic checks

From the package root:

```sh
npm ci
npm --prefix example ci
npm run test:all
```

`test:all` runs Jest with coverage, tests the controlled HTTP receiver and
hardware-evidence validator, validates that every public native method and event
is assigned to an E2E scenario, builds both package entry points, type-checks
consumer imports and the example app, lints, checks generated API docs, and
inspects the actual npm tarball.

## 2. Emulator/device native bridge suite

Install [Maestro](https://maestro.mobile.dev/), boot one target, and run:

```sh
npm run test:e2e:doctor -- android
npm run test:e2e:android
```

On macOS with a booted iOS simulator:

```sh
npm run test:e2e:doctor -- ios
npm run test:e2e:ios
```

The command builds the package, performs a clean Expo prebuild, creates a
release app, installs it, and runs the permission-denial, native API, lifecycle,
resilience, and APK-update flows. It uses the real native module—not a
JavaScript mock—and cleans monitoring, API, and event-log test state. The clean
prebuild replaces the ignored `example/android` or `example/ios` directory.

The automated run also drives virtual connected, disconnected, and error events
through native persistence, lifecycle delegates, event logging, JS listeners,
and the `useCarPlay` hook. It emits a 60-transition stress burst and sends real
native HTTP requests to a controlled local receiver, checking event payloads,
ordering, headers, secret redaction, retry-on-503, and no retry on a 4xx
response. The driver and local HTTP exception are guarded by example-only
native opt-in configuration; normal consumer apps cannot emit virtual events or
enable that exception.

On Android, the same command checks the foreground service and notification
while the app is backgrounded, the screen is locked, and Doze is forced. It
then verifies force-stop semantics, persisted-state recovery on relaunch, and
recovery after an in-place APK replacement. Optional destructive-to-device
checks are opt-in:

```powershell
$env:E2E_INCLUDE_BLUETOOTH_TOGGLE = "1"
$env:E2E_INCLUDE_REBOOT = "1"
npm run test:e2e:android
```

To test migration from a particular previously released APK, supply both that
APK and a Maestro flow that seeds its persisted monitoring state:

```powershell
$env:E2E_PREVIOUS_APK = "C:\path\to\previous-release.apk"
$env:E2E_PREVIOUS_SEED_FLOW = "C:\path\to\seed-previous-release.yaml"
npm run test:e2e:android:upgrade
```

To check only config-plugin generation and repeated-prebuild stability:

```sh
npm run test:e2e:prebuild:android
# macOS only
npm run test:e2e:prebuild:ios
```

## 3. Physical accessory suite

Run [hardware-checklist.md](./hardware-checklist.md) with a real CarPlay head
unit or simulator approved for the app and with Android Auto over both available
transports. Copy `hardware-evidence.example.json`, replace every pending check,
attach recordings/logs, and validate the record:

```sh
npm run test:e2e:hardware:evidence -- path/to/hardware-evidence.json
```

This layer is required before claiming release-level E2E coverage of actual
accessory transitions, real-device background delivery, and external-network
forwarding.

`coverage.json` is executable inventory. `npm run test:e2e:coverage` fails when
a public method or event is added without a mapped automated or hardware
scenario.

Virtual transitions validate the application and native-forwarding pipelines,
but they do not replace the physical suite for real CarPlay or Android Auto
callbacks, real-device power management, or external network loss.

`.github/workflows/mobile-e2e.yml` runs deterministic checks on pushes and pull
requests. Scheduled and manually dispatched runs execute Android API 23, 31,
and 36 plus an iOS simulator, retaining `.e2e-artifacts` for 14 days.
