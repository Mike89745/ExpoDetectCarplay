import { NativeModule, requireNativeModule } from 'expo';

import type {
  CarPlayConnectionStatus,
  CarPlayDiagnostics,
  CarPlayNotificationConfig,
  CarPlayNotificationSettings,
  EventLogEntry,
  EventLogQueryOptions,
  ExpoDetectCarplayModuleEvents,
} from './ExpoDetectCarplay.types';

export declare class ExpoDetectCarplayModule extends NativeModule<ExpoDetectCarplayModuleEvents> {
  /** Start persistent CarPlay and Android Auto connection monitoring. */
  startCarPlayMonitoring(): Promise<void>;
  /** Stop monitoring and clear the persisted connection snapshot. */
  stopCarPlayMonitoring(): Promise<void>;
  /** Return whether persistent monitoring is enabled. */
  isCarPlayMonitoringEnabled(): boolean;
  /** Return the most recent native connection snapshot. */
  getCarPlayConnectionStatus(): CarPlayConnectionStatus;
  /** Return platform-specific observer and service diagnostics. */
  getCarPlayDiagnostics(): CarPlayDiagnostics;
  /** Persist connection-event and foreground-service notification settings. */
  setCarPlayNotificationConfig(
    config: CarPlayNotificationSettings | CarPlayNotificationConfig
  ): void;
  /**
   * Request the platform permissions used by monitoring and notifications.
   *
   * Android requests Bluetooth permissions on API 31+ and notifications on
   * API 33+. iOS requests notification authorization and Always Location
   * authorization; add the location usage descriptions through
   * `ios.backgroundLocation` before calling this method.
   */
  requestPermissionsAsync(): Promise<boolean>;
  /** Enable persistent SQLite event logging. */
  enableEventLogging(): void;
  /** Disable logging without deleting existing entries. */
  disableEventLogging(): void;
  /** Return the persisted event-logging state. */
  isEventLoggingEnabled(): boolean;
  /** Read persisted connection and error events. */
  getEventLogs(options?: EventLogQueryOptions): EventLogEntry[];
  /** Delete all event-log entries without disabling logging. */
  clearEventLogs(): void;
  /** Delete the event-log database and disable logging. */
  destroyEventLogs(): void;
  /** Configure native event forwarding to an HTTP endpoint. */
  setApiEndpoint(url: string, apiKey?: string, id?: string): void;
  /** Return the persisted native event-forwarding configuration. */
  getApiEndpoint(): {
    url: string | null;
    apiKey: string | null;
    id: string | null;
  };
}

export default requireNativeModule<ExpoDetectCarplayModule>('ExpoDetectCarplay');
