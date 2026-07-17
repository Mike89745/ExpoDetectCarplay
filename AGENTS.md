# Repository guidance

## Purpose

`expo-detect-carplay` is one npm package with two public surfaces:

- The Expo runtime module and React hook exported from `src/index.ts`.
- The bundled Expo config plugin exported from `plugin/src/index.ts` and loaded
  through `app.plugin.js`.

Preserve backwards compatibility for both surfaces. Native method contracts
must remain aligned across TypeScript, Kotlin, Swift, and the web fallback.

## Repository map

- `src/`: public TypeScript API, web fallback, hook, and tests.
- `android/src/main/`: Android Auto monitor, foreground service, logging, and
  native API forwarding.
- `ios/`: CarPlay monitor, optional scene/location integration, logging, and
  native API forwarding.
- `plugin/src/`: Expo config plugin and generated native bridge templates.
- `docs/`: focused consumer guides and generated API Markdown.
- `internal/module_scripts/`: local build/test replacements for Expo scripts.
- `build/` and `plugin/build/`: generated output; do not edit by hand.

## Commands

- Install exactly from the lockfile: `npm ci`
- Build runtime and plugin: `npm run build`
- Run tests non-interactively: `CI=1 npm test -- --runInBand`
- Type-check package consumers: `npm run test:types`
- Lint: `npm run lint`
- Generate API Markdown: `npm run docs:api`
- Verify generated API Markdown: `npm run docs:check`
- Inspect the package: `npm pack --dry-run`

On PowerShell, set noninteractive mode with `$env:CI='1'` before test or build
commands that would otherwise enter watch mode.

## Public API rules

- Keep the default runtime export compatible; prefer named exports in new docs.
- Document defaults, units, platform behavior, persistence, and error codes in
  TSDoc on exported declarations.
- Add new native events to `ExpoDetectCarplayModuleEvents`, both platform event
  declarations, event logging/forwarding, and `docs/errors.md` when applicable.
- Runtime changes normally require Android, iOS, web, type, and documentation
  updates.

## Config plugin rules

- Mods must be idempotent and removable when an option is disabled.
- Never enable the Driving Task entitlement implicitly. It is Apple-granted and
  must match the consuming app's provisioning profile.
- Preserve host-owned Android automotive descriptors, iOS scene manifests,
  entitlements, and permission strings.
- Generated background-geolocation sources must be deterministic and compile
  against the supported SDK callback types.
- Keep all option types exported from `expo-detect-carplay/plugin`.

## Documentation rules

- `docs/getting-started.md` is the canonical installation path.
- `llms.txt` is a concise routing file, not a full reference.
- Prefer one canonical example per task and type-check public import patterns in
  `tests/consumer/index.ts`.
- Run `npm run docs:api` after exported declaration or TSDoc changes.

## Worktree safety

Preserve unrelated user changes. Review `git status` before and after work, and
do not edit generated build output directly.
