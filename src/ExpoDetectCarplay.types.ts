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
  timestamp: number;
  timestampIso?: string;
};

export type CarPlayDisconnectedEvent = {
  timestamp: number;
  timestampIso?: string;
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

export type CarPlayErrorEvent = {
  code: string;
  message: string;
};

export type EventLogQueryOptions = {
  limit?: number;
  eventType?: string;
  sinceTimestamp?: number;
};

export type EventLogEntry = {
  id: number;
  timestamp: number;
  eventType: string;
  identifier?: string;
  data: Record<string, unknown>;
};

export type ExpoDetectCarplayModuleEvents = {
  onCarPlayConnected: (params: CarPlayConnectedEvent) => void;
  onCarPlayDisconnected: (params: CarPlayDisconnectedEvent) => void;
  onCarPlayError: (params: CarPlayErrorEvent) => void;
};
