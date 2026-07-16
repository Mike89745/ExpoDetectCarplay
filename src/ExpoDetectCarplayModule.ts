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
  startCarPlayMonitoring(): Promise<void>;
  stopCarPlayMonitoring(): Promise<void>;
  isCarPlayMonitoringEnabled(): boolean;
  getCarPlayConnectionStatus(): CarPlayConnectionStatus;
  getCarPlayDiagnostics(): CarPlayDiagnostics;
  setCarPlayNotificationConfig(
    config: CarPlayNotificationSettings | CarPlayNotificationConfig
  ): void;
  requestPermissionsAsync(): Promise<boolean>;
  enableEventLogging(): void;
  disableEventLogging(): void;
  isEventLoggingEnabled(): boolean;
  getEventLogs(options?: EventLogQueryOptions): EventLogEntry[];
  clearEventLogs(): void;
  destroyEventLogs(): void;
  setApiEndpoint(url: string, apiKey?: string, id?: string): void;
  getApiEndpoint(): {
    url: string | null;
    apiKey: string | null;
    id: string | null;
  };
}

export default requireNativeModule<ExpoDetectCarplayModule>('ExpoDetectCarplay');
