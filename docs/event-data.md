# Event logging, notifications, and forwarding

## SQLite event logging

```ts
import { ExpoDetectCarplay } from 'expo-detect-carplay';

ExpoDetectCarplay.enableEventLogging();

const events = ExpoDetectCarplay.getEventLogs({
  eventType: 'onCarPlayConnected',
  limit: 100,
  sinceTimestamp: Date.now() - 86_400_000,
});
```

- `disableEventLogging` stops new writes and retains existing data.
- `clearEventLogs` removes rows and leaves the logging setting unchanged.
- `destroyEventLogs` removes the database and disables logging.

## Notifications

```ts
ExpoDetectCarplay.setCarPlayNotificationConfig({
  events: {
    enabled: true,
    connectedTitle: 'Vehicle connected',
    disconnectedTitle: 'Vehicle disconnected',
    body: 'CarPlay session {event} via {transport}',
  },
  foregroundService: {
    title: 'Vehicle monitoring active',
    text: 'Watching CarPlay and Android Auto',
  },
});
```

Event notification bodies support `{event}` and `{transport}` placeholders.
Foreground-service and notification-channel settings apply to Android.

## Native HTTP forwarding

```ts
ExpoDetectCarplay.setApiEndpoint('https://example.com/vehicle-events', 'api-key', 'vehicle-42');
```

Native forwarding does not depend on the JavaScript bridge being active. Use
`getApiEndpoint` to inspect the persisted configuration. Event logging,
notifications, API forwarding, and monitoring state are owned by this package
and remain separate from `expo-beacon`.
