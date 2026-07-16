import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  CarPlayConnectedEvent,
  CarPlayDiagnostics,
  CarPlayDisconnectedEvent,
  CarPlayNotificationConfig,
  CarPlayNotificationSettings,
  CarPlayTransport,
} from '../ExpoDetectCarplay.types';
import ExpoDetectCarplay from '../ExpoDetectCarplayModule.js';

export interface UseCarPlayOptions {
  onConnected?: (event: CarPlayConnectedEvent) => void;
  onDisconnected?: (event: CarPlayDisconnectedEvent) => void;
  /** Start persistent observation on mount. Default: `false`. */
  autoStart?: boolean;
}

export interface UseCarPlayResult {
  connected: boolean;
  transport: CarPlayTransport | null;
  isMonitoring: boolean;
  lastConnectedAt: number | null;
  lastDisconnectedAt: number | null;
  startMonitoring: () => Promise<void>;
  stopMonitoring: () => Promise<void>;
  refresh: () => void;
  getDiagnostics: () => CarPlayDiagnostics;
  setCarPlayNotificationConfig: (
    config: CarPlayNotificationSettings | CarPlayNotificationConfig
  ) => void;
}

export function useCarPlay(options: UseCarPlayOptions = {}): UseCarPlayResult {
  const handlers = useRef(options);
  // Keep callbacks current synchronously without re-subscribing native listeners.
  // eslint-disable-next-line react-hooks/refs
  handlers.current = options;

  const [connected, setConnected] = useState(false);
  const [transport, setTransport] = useState<CarPlayTransport | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastConnectedAt, setLastConnectedAt] = useState<number | null>(null);
  const [lastDisconnectedAt, setLastDisconnectedAt] = useState<number | null>(null);

  const refresh = useCallback(() => {
    const status = ExpoDetectCarplay.getCarPlayConnectionStatus();
    setConnected(status.connected);
    setTransport(status.connected ? (status.transport ?? null) : null);
    if (status.connected && typeof status.timestamp === 'number') {
      setLastConnectedAt(status.timestamp);
    }
    setIsMonitoring(ExpoDetectCarplay.isCarPlayMonitoringEnabled());
  }, []);

  const startMonitoring = useCallback(async () => {
    await ExpoDetectCarplay.startCarPlayMonitoring();
    setIsMonitoring(true);
  }, []);

  const stopMonitoring = useCallback(async () => {
    await ExpoDetectCarplay.stopCarPlayMonitoring();
    setIsMonitoring(false);
    setConnected(false);
    setTransport(null);
  }, []);

  const getDiagnostics = useCallback(() => ExpoDetectCarplay.getCarPlayDiagnostics(), []);

  const setCarPlayNotificationConfig = useCallback(
    (config: CarPlayNotificationSettings | CarPlayNotificationConfig) =>
      ExpoDetectCarplay.setCarPlayNotificationConfig(config),
    []
  );

  useEffect(() => {
    try {
      // Hydrate the external native snapshot before subscribing to later changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      refresh();
    } catch {
      // Unsupported platform.
    }

    const connectSub = ExpoDetectCarplay.addListener('onCarPlayConnected', (event) => {
      setConnected(true);
      setTransport(event.transport);
      setLastConnectedAt(event.timestamp);
      handlers.current.onConnected?.(event);
    });
    const disconnectSub = ExpoDetectCarplay.addListener('onCarPlayDisconnected', (event) => {
      setConnected(false);
      setTransport(null);
      setLastDisconnectedAt(event.timestamp);
      handlers.current.onDisconnected?.(event);
    });

    if (handlers.current.autoStart && !ExpoDetectCarplay.isCarPlayMonitoringEnabled()) {
      startMonitoring().catch(() => {});
    }

    return () => {
      connectSub.remove();
      disconnectSub.remove();
    };
  }, [refresh, startMonitoring]);

  return {
    connected,
    transport,
    isMonitoring,
    lastConnectedAt,
    lastDisconnectedAt,
    startMonitoring,
    stopMonitoring,
    refresh,
    getDiagnostics,
    setCarPlayNotificationConfig,
  };
}
