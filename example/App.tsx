import { useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ExpoDetectCarplay, { useCarPlay } from 'expo-detect-carplay';

type RunState = 'idle' | 'running' | 'passed' | 'failed';
type LifecycleState = 'idle' | 'seeded' | 'restored';
type VirtualCarPlayDriver = {
  __e2eEmitVirtualCarPlayEvent: (connected: boolean, transport?: string) => void;
  __e2eEmitVirtualCarPlayError: (code: string, message: string) => void;
};

const virtualDriver = ExpoDetectCarplay as typeof ExpoDetectCarplay & VirtualCarPlayDriver;
const VIRTUAL_TRANSPORT = Platform.OS === 'ios' ? 'wireless' : 'projection';
const API_BASE_URL = 'http://127.0.0.1:19099';

function invariant(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function waitFor(predicate: () => boolean, message: string, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(message);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

export default function App() {
  const virtualEvents = useRef<string[]>([]);
  const virtualErrors = useRef<string[]>([]);
  const hook = useCarPlay({
    onConnected: (event) => {
      if (event.transport === VIRTUAL_TRANSPORT) {
        virtualEvents.current.push(`connected:${event.transport}`);
      }
    },
    onDisconnected: () => virtualEvents.current.push('disconnected'),
  });
  const hookSnapshot = useRef({ connected: hook.connected, transport: hook.transport });
  const [state, setState] = useState<RunState>('idle');
  const [currentStep, setCurrentStep] = useState('Ready');
  const [completed, setCompleted] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastNativeEvent, setLastNativeEvent] = useState('No accessory event received');
  const [virtualPassed, setVirtualPassed] = useState(false);
  const [lifecycleState, setLifecycleState] = useState<LifecycleState>('idle');

  useEffect(() => {
    hookSnapshot.current = { connected: hook.connected, transport: hook.transport };
  }, [hook.connected, hook.transport]);

  useEffect(() => {
    setLifecycleState(
      ExpoDetectCarplay.isCarPlayMonitoringEnabled() ? 'restored' : 'idle'
    );
  }, []);

  useEffect(() => {
    const connected = ExpoDetectCarplay.addListener('onCarPlayConnected', (event) => {
      setLastNativeEvent(`connected:${event.transport}`);
    });
    const disconnected = ExpoDetectCarplay.addListener('onCarPlayDisconnected', () => {
      setLastNativeEvent('disconnected');
    });
    const nativeError = ExpoDetectCarplay.addListener('onCarPlayError', (event) => {
      setLastNativeEvent(`error:${event.code}`);
      if (event.message.startsWith('Virtual E2E')) virtualErrors.current.push(event.code);
    });
    return () => {
      connected.remove();
      disconnected.remove();
      nativeError.remove();
    };
  }, []);

  const seedLifecycle = async () => {
    setError(null);
    try {
      invariant(
        await ExpoDetectCarplay.requestPermissionsAsync(),
        'Required permissions were not granted'
      );
      await ExpoDetectCarplay.startCarPlayMonitoring();
      setLifecycleState('seeded');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const cleanupLifecycle = async () => {
    await ExpoDetectCarplay.stopCarPlayMonitoring().catch(() => undefined);
    setLifecycleState('idle');
  };

  const run = async () => {
    setState('running');
    setCurrentStep('Starting');
    setCompleted([]);
    setError(null);
    setVirtualPassed(false);
    const passed: string[] = [];

    const check = async (name: string, action: () => void | Promise<void>) => {
      setCurrentStep(name);
      await action();
      passed.push(name);
      setCompleted([...passed]);
    };

    try {
      await check('native module is linked', () => {
        invariant(
          typeof ExpoDetectCarplay.getCarPlayConnectionStatus === 'function',
          'ExpoDetectCarplay native module is not linked'
        );
        invariant(
          typeof virtualDriver.__e2eEmitVirtualCarPlayEvent === 'function',
          'Virtual ride driver is not installed'
        );
      });

      await check('clean previous test state', async () => {
        await ExpoDetectCarplay.stopCarPlayMonitoring().catch(() => undefined);
        ExpoDetectCarplay.destroyEventLogs();
        ExpoDetectCarplay.setApiEndpoint('');
      });

      await check('permission bridge', async () => {
        const granted = await ExpoDetectCarplay.requestPermissionsAsync();
        invariant(granted, 'Required permissions were not granted');
      });

      await check('status and diagnostics bridge', () => {
        const status = ExpoDetectCarplay.getCarPlayConnectionStatus();
        const diagnostics = ExpoDetectCarplay.getCarPlayDiagnostics();
        invariant(typeof status.connected === 'boolean', 'Connection status is invalid');
        invariant(
          typeof diagnostics.observerActive === 'boolean' &&
            typeof diagnostics.serviceAlive === 'boolean',
          'Diagnostics payload is invalid'
        );
      });

      await check('notification configuration', () => {
        ExpoDetectCarplay.setCarPlayNotificationConfig({
          events: { enabled: false, body: '{event}:{transport}' },
          foregroundService: { title: 'E2E monitoring', text: 'Running' },
          channel: { name: 'E2E', importance: 'low' },
        });
      });

      await check('native forwarding configuration', () => {
        ExpoDetectCarplay.setApiEndpoint(
          `${API_BASE_URL}/carplay-events`,
          'e2e-key',
          'e2e-device'
        );
        const config = ExpoDetectCarplay.getApiEndpoint();
        invariant(
          config.url === `${API_BASE_URL}/carplay-events` &&
            config.apiKey === 'e2e-key' &&
            config.id === 'e2e-device',
          'API configuration did not round-trip'
        );
      });

      await check('virtual connected-car ride', async () => {
        if (Platform.OS === 'android') {
          await waitFor(
            () => !ExpoDetectCarplay.getCarPlayDiagnostics().serviceAlive,
            'Foreground service did not stop before the virtual ride'
          );
        }
        virtualEvents.current = [];
        virtualErrors.current = [];
        ExpoDetectCarplay.enableEventLogging();
        ExpoDetectCarplay.clearEventLogs();

        virtualDriver.__e2eEmitVirtualCarPlayEvent(true, VIRTUAL_TRANSPORT);
        await waitFor(
          () =>
            virtualEvents.current[0] === `connected:${VIRTUAL_TRANSPORT}` &&
            hookSnapshot.current.connected &&
            hookSnapshot.current.transport === VIRTUAL_TRANSPORT,
          'Virtual connection did not reach useCarPlay'
        );
        const connectedStatus = ExpoDetectCarplay.getCarPlayConnectionStatus();
        invariant(
          connectedStatus.connected && connectedStatus.transport === VIRTUAL_TRANSPORT,
          'Virtual connected state was not persisted'
        );

        virtualDriver.__e2eEmitVirtualCarPlayEvent(false);
        await waitFor(
          () => virtualEvents.current[1] === 'disconnected' && !hookSnapshot.current.connected,
          'Virtual disconnection did not reach useCarPlay'
        );
        invariant(
          !ExpoDetectCarplay.getCarPlayConnectionStatus().connected,
          'Virtual disconnected state was not persisted'
        );
        virtualDriver.__e2eEmitVirtualCarPlayError(
          'CARPLAY_OBSERVER_FAILED',
          'Virtual E2E observer error'
        );
        await waitFor(
          () => virtualErrors.current.includes('CARPLAY_OBSERVER_FAILED'),
          'Virtual error did not reach the native event listener'
        );

        const loggedTypes = new Set(
          ExpoDetectCarplay.getEventLogs({ limit: 10 }).map((item) => item.eventType)
        );
        invariant(
          loggedTypes.has('onCarPlayConnected') &&
            loggedTypes.has('onCarPlayDisconnected') &&
            loggedTypes.has('onCarPlayError'),
          'Virtual ride did not pass through native event logging'
        );
        invariant(
          !JSON.stringify(ExpoDetectCarplay.getEventLogs({ limit: 10 })).includes('e2e-key'),
          'API key leaked into native event logs'
        );
        setVirtualPassed(true);
      });

      await check('virtual connection burst', async () => {
        ExpoDetectCarplay.setApiEndpoint('');
        virtualEvents.current = [];
        for (let sequence = 0; sequence < 30; sequence += 1) {
          virtualDriver.__e2eEmitVirtualCarPlayEvent(true, VIRTUAL_TRANSPORT);
          virtualDriver.__e2eEmitVirtualCarPlayEvent(false);
        }
        await waitFor(
          () => virtualEvents.current.length === 60,
          `Only ${virtualEvents.current.length}/60 burst transitions reached useCarPlay`,
          10_000
        );
        invariant(
          !ExpoDetectCarplay.getCarPlayConnectionStatus().connected,
          'Burst journey did not finish disconnected'
        );
      });

      await check('native forwarding retry policy', () => {
        ExpoDetectCarplay.setApiEndpoint(
          `${API_BASE_URL}/retry/carplay-events`,
          'e2e-key',
          'e2e-device'
        );
        virtualDriver.__e2eEmitVirtualCarPlayError(
          'CARPLAY_START_FAILED',
          'Virtual E2E retry error'
        );
        ExpoDetectCarplay.setApiEndpoint(
          `${API_BASE_URL}/client-error/carplay-events`,
          'e2e-key',
          'e2e-device'
        );
        virtualDriver.__e2eEmitVirtualCarPlayError(
          'CARPLAY_STOP_FAILED',
          'Virtual E2E client error'
        );
      });

      await check('monitoring lifecycle', async () => {
        await ExpoDetectCarplay.startCarPlayMonitoring();
        invariant(
          ExpoDetectCarplay.isCarPlayMonitoringEnabled(),
          'Monitoring did not become enabled'
        );
        await ExpoDetectCarplay.stopCarPlayMonitoring();
        invariant(
          !ExpoDetectCarplay.isCarPlayMonitoringEnabled(),
          'Monitoring did not become disabled'
        );
      });

      await check('event-log lifecycle', () => {
        ExpoDetectCarplay.enableEventLogging();
        invariant(ExpoDetectCarplay.isEventLoggingEnabled(), 'Event logging did not enable');
        invariant(
          Array.isArray(ExpoDetectCarplay.getEventLogs({ limit: 2 })),
          'Logs are not an array'
        );
        ExpoDetectCarplay.clearEventLogs();
        invariant(
          ExpoDetectCarplay.getEventLogs({ limit: 2 }).length === 0,
          'Logs were not cleared'
        );
        ExpoDetectCarplay.disableEventLogging();
        invariant(!ExpoDetectCarplay.isEventLoggingEnabled(), 'Event logging did not disable');
      });

      await check('cleanup', async () => {
        await ExpoDetectCarplay.stopCarPlayMonitoring().catch(() => undefined);
        ExpoDetectCarplay.destroyEventLogs();
        ExpoDetectCarplay.setApiEndpoint('');
      });

      setCurrentStep('All deterministic native checks passed');
      setState('passed');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      setCurrentStep('Failed');
      setState('failed');
      await ExpoDetectCarplay.stopCarPlayMonitoring().catch(() => undefined);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>expo-detect-carplay</Text>
        <View style={styles.lab} testID="e2e-ready">
          <Text style={styles.title}>Native E2E Test Lab</Text>
          <Text style={styles.copy}>
            Exercises the installed native module, persistence, foreground service, and JS bridge.
            Connect CarPlay or Android Auto to complete the hardware event checks.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={state === 'running'}
            onPress={run}
            style={styles.button}
            testID="e2e-run">
            <Text style={styles.buttonText}>
              {state === 'running' ? 'Running…' : 'Run native E2E checks'}
            </Text>
          </Pressable>
          <Text style={styles.status} testID={`e2e-${state}`}>
            {state.toUpperCase()}: {currentStep}
          </Text>
          <Text style={styles.copy}>{completed.length} checks completed</Text>
          <Text style={styles.copy} testID="e2e-hook-probe">
            Hook: {hook.connected ? `connected:${hook.transport}` : 'disconnected'}, monitoring{' '}
            {hook.isMonitoring ? 'on' : 'off'}
          </Text>
          <Text
            style={styles.copy}
            testID={virtualPassed ? 'virtual-ride-passed' : 'virtual-ride-pending'}>
            Virtual ride: {virtualPassed ? 'passed' : 'not run'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={seedLifecycle}
            style={styles.button}
            testID="e2e-lifecycle-seed">
            <Text style={styles.buttonText}>Seed lifecycle recovery</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={cleanupLifecycle}
            style={styles.button}
            testID="e2e-lifecycle-cleanup">
            <Text style={styles.buttonText}>Clean lifecycle recovery</Text>
          </Pressable>
          <Text style={styles.copy} testID={`e2e-lifecycle-${lifecycleState}`}>
            Lifecycle recovery: {lifecycleState}
          </Text>
          {error ? (
            <Text style={styles.error} testID="e2e-error">
              {error}
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Hardware event probe</Text>
          <Text style={styles.copy} testID="hardware-last-event">
            {lastNativeEvent}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#eef2f5', flex: 1 },
  content: { padding: 18, paddingBottom: 48 },
  header: {
    color: '#1d2b36',
    fontSize: 27,
    fontWeight: '800',
    marginBottom: 18,
    textAlign: 'center',
  },
  lab: {
    backgroundColor: '#e8f4fd',
    borderColor: '#3498db',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  card: { backgroundColor: '#fff', borderRadius: 12, marginTop: 16, padding: 16 },
  title: { color: '#1f4e79', fontSize: 17, fontWeight: '700', marginBottom: 6 },
  copy: { color: '#34495e', fontSize: 13, lineHeight: 19, marginTop: 6 },
  button: {
    alignItems: 'center',
    backgroundColor: '#2471a3',
    borderRadius: 7,
    marginTop: 14,
    padding: 12,
  },
  buttonText: { color: '#fff', fontWeight: '700' },
  status: { color: '#1f4e79', fontSize: 12, fontWeight: '600', marginTop: 12 },
  error: { color: '#b03a2e', fontSize: 12, marginTop: 8 },
});
