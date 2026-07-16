import type {
  CarPlayNotificationConfig,
  CarPlayNotificationSettings,
  EventLogQueryOptions,
  ExpoDetectCarplayModuleEvents,
} from './ExpoDetectCarplay.types';
import type { ExpoDetectCarplayModule } from './ExpoDetectCarplayModule';

const notSupported = (): never => {
  throw new Error('expo-detect-carplay is not supported on web.');
};

const stub: ExpoDetectCarplayModule = {
  startCarPlayMonitoring: async () => {},
  stopCarPlayMonitoring: async () => {},
  isCarPlayMonitoringEnabled: () => false,
  getCarPlayConnectionStatus: () => ({ connected: false }),
  getCarPlayDiagnostics: () => ({
    isCarAppMetadataPresent: false,
    isCarProviderQueryable: false,
    lastRawConnectionType: null,
    observerActive: false,
    serviceAlive: false,
  }),
  setCarPlayNotificationConfig: (
    _config: CarPlayNotificationSettings | CarPlayNotificationConfig
  ) => {},
  requestPermissionsAsync: async () => true,
  enableEventLogging: () => notSupported(),
  disableEventLogging: () => notSupported(),
  isEventLoggingEnabled: () => false,
  getEventLogs: (_options?: EventLogQueryOptions) => notSupported(),
  clearEventLogs: () => notSupported(),
  destroyEventLogs: () => notSupported(),
  setApiEndpoint: (_url: string, _apiKey?: string, _id?: string) => {},
  getApiEndpoint: () => ({ url: null, apiKey: null, id: null }),
  addListener: (_eventName: keyof ExpoDetectCarplayModuleEvents, _listener: any) => ({
    remove: () => {},
  }),
  removeListener: (_eventName: keyof ExpoDetectCarplayModuleEvents, _listener: any) => {},
  removeAllListeners: (_eventName: keyof ExpoDetectCarplayModuleEvents) => {},
  emit: (_eventName: keyof ExpoDetectCarplayModuleEvents, ..._args: unknown[]) => {},
  listenerCount: (_eventName: keyof ExpoDetectCarplayModuleEvents) => 0,
};

export default stub;
