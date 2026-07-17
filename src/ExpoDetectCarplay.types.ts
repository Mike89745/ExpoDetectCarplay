export type ForegroundServiceConfig = {
  title?: string;
  text?: string;
  /** Android drawable resource name. */
  icon?: string;
};

export type CarPlayNotificationConfig = {
  enabled?: boolean;
  connectedTitle?: string;
  disconnectedTitle?: string;
  /** Supports `{event}` and `{transport}` placeholders. */
  body?: string;
  /** iOS only. */
  sound?: boolean;
  /** Android drawable resource name. */
  icon?: string;
};

export type CarPlayChannelConfig = {
  name?: string;
  description?: string;
  importance?: 'low' | 'default' | 'high';
};

export type CarPlayNotificationSettings = {
  events?: CarPlayNotificationConfig;
  foregroundService?: ForegroundServiceConfig;
  channel?: CarPlayChannelConfig;
};

export type CarPlayTransport = 'wired' | 'wireless' | 'projection' | 'native' | 'unknown';

export type CarPlayConnectedEvent = {
  transport: CarPlayTransport;
  /** Milliseconds since the Unix epoch. */
  timestamp: number;
  /** ISO-8601 representation of `timestamp`, when supplied by the platform. */
  timestampIso?: string;
};

export type CarPlayDisconnectedEvent = {
  /** Milliseconds since the Unix epoch. */
  timestamp: number;
  /** ISO-8601 representation of `timestamp`, when supplied by the platform. */
  timestampIso?: string;
  /** Set when persisted state was corrected after process startup. */
  reason?: 'reconciled';
};

export type CarPlayConnectionStatus = {
  connected: boolean;
  transport?: CarPlayTransport;
  timestamp?: number;
  timestampIso?: string;
};

export type CarPlayDiagnostics = {
  isCarAppMetadataPresent: boolean;
  isCarProviderQueryable: boolean;
  lastRawConnectionType: number | null;
  observerActive: boolean;
  serviceAlive: boolean;
};

/** Machine-readable errors rejected or emitted by the native module. */
export type CarPlayErrorCode =
  | 'CARPLAY_OBSERVER_FAILED'
  | 'CARPLAY_START_FAILED'
  | 'CARPLAY_STOP_FAILED'
  | 'NO_CONTEXT'
  | 'PERMISSION_DENIED';

/** Payload emitted through `onCarPlayError`. */
export type CarPlayErrorEvent = {
  code: CarPlayErrorCode;
  message: string;
};

export type EventLogQueryOptions = {
  /** Maximum entries to return. @defaultValue 1000 */
  limit?: number;
  /** Filter by an emitted event name. */
  eventType?: CarPlayEventName;
  /** Return entries at or after this Unix epoch timestamp in milliseconds. */
  sinceTimestamp?: number;
};

export type EventLogEntry = {
  id: number;
  /** Milliseconds since the Unix epoch. */
  timestamp: number;
  eventType: CarPlayEventName;
  identifier?: string;
  data: Record<string, unknown>;
};

export type ExpoDetectCarplayModuleEvents = {
  onCarPlayConnected: (params: CarPlayConnectedEvent) => void;
  onCarPlayDisconnected: (params: CarPlayDisconnectedEvent) => void;
  onCarPlayError: (params: CarPlayErrorEvent) => void;
};

/** Every event name emitted by the module. */
export type CarPlayEventName = keyof ExpoDetectCarplayModuleEvents;
