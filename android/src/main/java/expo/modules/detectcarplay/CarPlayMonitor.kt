package expo.modules.detectcarplay

import android.content.Context
import android.content.SharedPreferences
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.car.app.connection.CarConnection
import androidx.lifecycle.LiveData
import androidx.lifecycle.Observer
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Wraps [CarConnection] LiveData to surface Android Auto / Automotive OS
 * connection events. No special permissions or Android Auto certification
 * are required — `CarConnection.type` is read-only state.
 *
 * Lifecycle: this monitor uses `observeForever` and therefore must be
 * explicitly stopped to avoid leaks. The owning module is responsible for
 * calling [stop] in `OnDestroy`.
 *
 * All observer registration / removal happens on the main thread because
 * [LiveData.observeForever] requires it.
 */
internal class CarPlayMonitor(private val context: Context) {

    /** Emit callback signature: (eventName, payload). */
    fun interface Emit {
        operator fun invoke(eventName: String, payload: Map<String, Any?>)
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private val liveData: LiveData<Int> = CarConnection(context.applicationContext).type
    private val stateLock = Any()
    @Volatile private var observer: Observer<Int>? = null
    private var emit: Emit? = null
    @Volatile private var lastConnected: Boolean? = null
    @Volatile private var lastConnectedAtMs: Long? = null
    @Volatile private var lastConnectedType: Int = CarConnection.CONNECTION_TYPE_NOT_CONNECTED
    /**
     * Pending bootstrap-grace runnable that will re-check the connection state
     * after [BOOTSTRAP_GRACE_MS] before emitting a `disconnected` event.
     * Used only when the persisted state was `connected` but the first
     * observed value after [start] is `NOT_CONNECTED` — this absorbs the
     * LiveData/Content-Provider initial-value race that occurs after a
     * cold service restart.
     */
    private var pendingDisconnectCheck: Runnable? = null
    /** Pending diagnostic-probe runnable posted by [start]; cancelled in [stop]. */
    private var diagnosticProbe: Runnable? = null
    /** Most recent raw type seen from the LiveData; used by the grace re-check. */
    @Volatile internal var lastObservedType: Int = CarConnection.CONNECTION_TYPE_NOT_CONNECTED
        private set

    /**
     * Whether the observer has ever received a value from the LiveData since
     * [start] was called. Useful for diagnostics — if this is `false` 5+
     * seconds after `start()`, the `CarConnection` content provider isn't
     * resolving (most commonly because the host app isn't registered as an
     * Android Auto app via `automotive_app_desc.xml`).
     */
    @Volatile internal var hasObservedValue: Boolean = false
        private set

    /**
     * Begin observing connection state. Idempotent — calling twice replaces the
     * emit callback but does not register a duplicate observer.
     * Emits `onCarPlayConnected` immediately if already connected.
     */
    fun start(emit: Emit) {
        runOnMain {
            this.emit = emit
            // Seed in-memory state from persisted last-known connection so a
            // cold restart can distinguish "we lost a previously-active
            // connection" from "we have no prior knowledge yet".
            if (synchronized(stateLock) { lastConnected == null }) {
                seedFromPersistedState()
            }
            if (observer == null) {
                val obs = Observer<Int> { type -> handleType(type) }
                try {
                    liveData.observeForever(obs)
                    // Only publish the observer after registration succeeds. Otherwise a failed
                    // observeForever call permanently wedges future start() attempts.
                    observer = obs
                    Log.d(TAG, "CarPlay monitoring started (seeded lastConnected=$lastConnected, lib=androidx.car.app)")
                    // Diagnostic safety-net: if no value arrives within
                    // [DIAGNOSTIC_PROBE_MS], emit a loud warning. The most
                    // common cause is a missing `com.google.android.gms.car.application`
                    // meta-data entry in the host app's manifest — Gearhead
                    // then silently returns NOT_CONNECTED and the LiveData
                    // never updates beyond the bootstrap value.
                    val probe = Runnable {
                        diagnosticProbe = null
                        if (!hasObservedValue) {
                            Log.w(TAG, "CarPlay diagnostic: no CarConnection value received after ${DIAGNOSTIC_PROBE_MS}ms. " +
                                "Host app is likely missing the AndroidAuto registration meta-data " +
                                "(<meta-data android:name=\"com.google.android.gms.car.application\" android:resource=\"@xml/automotive_app_desc\"/>). " +
                                "Enable the expo-detect-carplay plugin's `android.androidAuto.register` option and re-run `expo prebuild`.")
                        } else {
                            Log.d(TAG, "CarPlay diagnostic: lastObservedType=$lastObservedType after ${DIAGNOSTIC_PROBE_MS}ms (OK)")
                        }
                    }
                    diagnosticProbe = probe
                    mainHandler.postDelayed(probe, DIAGNOSTIC_PROBE_MS)
                } catch (e: Exception) {
                    observer = null
                    Log.w(TAG, "Failed to start CarPlay monitoring: ${e.message}")
                }
            }
        }
    }

    /** Stop observing connection state and release the emit callback. */
    fun stop() {
        runOnMain {
            cancelPendingDisconnectCheck()
            diagnosticProbe?.let { mainHandler.removeCallbacks(it) }
            diagnosticProbe = null
            observer?.let {
                try { liveData.removeObserver(it) } catch (_: Exception) {}
            }
            observer = null
            emit = null
            synchronized(stateLock) {
                lastConnected = null
                lastConnectedAtMs = null
                lastConnectedType = CarConnection.CONNECTION_TYPE_NOT_CONNECTED
            }
            // Reset observation state so diagnostics never report stale values.
            hasObservedValue = false
            lastObservedType = CarConnection.CONNECTION_TYPE_NOT_CONNECTED
            Log.d(TAG, "CarPlay monitoring stopped")
        }
    }

    // MARK: - State inspection (called by CarPlayForegroundService)

    /** Returns `true` if the LiveData observer is currently registered. */
    internal fun isObserving(): Boolean = observer != null

    /**
     * Builds an `onCarPlayConnected` payload from the last observed state.
     * Returns `null` if the monitor is not currently in a connected state.
     * Thread-safe: reads only `@Volatile` fields and calls the synchronized
     * [formatIso] helper.
     */
    internal fun buildConnectedPayload(): Map<String, Any?>? {
        return synchronized(stateLock) {
            if (lastConnected != true) return@synchronized null
            val timestamp =
                    lastConnectedAtMs
                            ?: System.currentTimeMillis().also { migratedTimestamp ->
                                lastConnectedAtMs = migratedTimestamp
                                writePersistedState(true, migratedTimestamp, lastConnectedType)
                            }
            mapOf(
                    "transport" to transportForType(lastConnectedType),
                    "timestamp" to timestamp,
                    "timestampIso" to formatIso(timestamp),
            )
        }
    }

    private fun handleType(type: Int) {
        lastObservedType = type
        hasObservedValue = true
        val connected = type != CarConnection.CONNECTION_TYPE_NOT_CONNECTED
        val previous = synchronized(stateLock) { lastConnected }

        // Same state as last emitted/seeded value → cancel any pending grace
        // re-check (the connection came back) and bail.
        if (previous == connected) {
            if (connected) {
                cancelPendingDisconnectCheck()
                // Projection/native may change without a disconnect. Preserve the original
                // connection time while keeping the transport accurate.
                synchronized(stateLock) {
                    if (lastConnected == true) {
                        lastConnectedType = type
                        writePersistedState(true, lastConnectedAtMs, type)
                    }
                }
            }
            return
        }

        // First-ever observation in this process AND no persisted prior state:
        // the LiveData's initial value during a cold start is frequently
        // NOT_CONNECTED before the underlying Content-Provider query resolves.
        // Treat this purely as a state seed; do not emit a spurious disconnect.
        if (previous == null && !connected) {
            synchronized(stateLock) {
                lastConnected = false
                lastConnectedAtMs = null
                lastConnectedType = CarConnection.CONNECTION_TYPE_NOT_CONNECTED
                writePersistedState(false, null, CarConnection.CONNECTION_TYPE_NOT_CONNECTED)
            }
            Log.d(TAG, "Suppressed initial NOT_CONNECTED — seeded lastConnected=false")
            return
        }

        // Persisted/known state was `connected` but we just observed
        // `NOT_CONNECTED`. This is the most likely false-positive path on
        // process restart — defer emission for a short grace period and
        // re-check; only emit if it's still NOT_CONNECTED.
        if (previous == true && !connected) {
            scheduleDisconnectCheck()
            return
        }

        // Genuine transition — emit immediately.
        emitTransition(connected, type)
    }

    private fun scheduleDisconnectCheck() {
        cancelPendingDisconnectCheck()
        val r = Runnable {
            pendingDisconnectCheck = null
            val nowType = lastObservedType
            val nowConnected = nowType != CarConnection.CONNECTION_TYPE_NOT_CONNECTED
            if (nowConnected) {
                Log.d(TAG, "Disconnect grace re-check: connection recovered (type=$nowType) — suppressed")
                // lastConnected stays true; no event.
                return@Runnable
            }
            // Still disconnected after grace — emit the real transition.
            emitTransition(false, nowType)
        }
        pendingDisconnectCheck = r
        mainHandler.postDelayed(r, BOOTSTRAP_GRACE_MS)
        Log.d(TAG, "Deferred CarPlay disconnect by ${BOOTSTRAP_GRACE_MS}ms (grace re-check pending)")
    }

    private fun cancelPendingDisconnectCheck() {
        pendingDisconnectCheck?.let { mainHandler.removeCallbacks(it) }
        pendingDisconnectCheck = null
    }

    private fun emitTransition(connected: Boolean, type: Int) {
        val now = System.currentTimeMillis()
        synchronized(stateLock) {
            lastConnected = connected
            if (connected) {
                lastConnectedAtMs = now
                lastConnectedType = type
            } else {
                lastConnectedAtMs = null
                lastConnectedType = CarConnection.CONNECTION_TYPE_NOT_CONNECTED
            }
            writePersistedState(connected, lastConnectedAtMs, lastConnectedType)
        }
        val callback = emit ?: return
        val nowIso = formatIso(now)
        if (connected) {
            callback("onCarPlayConnected", mapOf(
                "transport" to transportForType(type),
                "timestamp" to now,
                "timestampIso" to nowIso,
            ))
        } else {
            callback("onCarPlayDisconnected", mapOf(
                "timestamp" to now,
                "timestampIso" to nowIso,
            ))
        }
    }

    private fun seedFromPersistedState() {
        val prefs = prefs() ?: return
        if (!prefs.contains(KEY_LAST_CONNECTED)) return
        val connected = prefs.getBoolean(KEY_LAST_CONNECTED, false)
        if (!connected) {
            synchronized(stateLock) {
                lastConnected = false
                lastConnectedAtMs = null
                lastConnectedType = CarConnection.CONNECTION_TYPE_NOT_CONNECTED
            }
            return
        }

        val persistedTimestamp = prefs.getLong(KEY_LAST_CONNECTED_AT, 0L).takeIf { it > 0L }
        val timestamp = persistedTimestamp ?: System.currentTimeMillis()
        val type =
                prefs.getInt(
                        KEY_LAST_CONNECTED_TYPE,
                        CarConnection.CONNECTION_TYPE_NOT_CONNECTED
                )
        synchronized(stateLock) {
            lastConnected = true
            lastConnectedAtMs = timestamp
            lastConnectedType = type
            if (persistedTimestamp == null) {
                // Migrate the old boolean-only state once so subsequent status queries are stable.
                writePersistedState(true, timestamp, type)
            }
        }
    }

    private fun writePersistedState(connected: Boolean, timestamp: Long?, type: Int) {
        prefs()?.edit()?.apply {
            putBoolean(KEY_LAST_CONNECTED, connected)
            if (connected && timestamp != null) {
                putLong(KEY_LAST_CONNECTED_AT, timestamp)
                putInt(KEY_LAST_CONNECTED_TYPE, type)
            } else {
                remove(KEY_LAST_CONNECTED_AT)
                remove(KEY_LAST_CONNECTED_TYPE)
            }
        }?.apply()
    }

    private fun prefs(): SharedPreferences? = try {
        context.applicationContext.getSharedPreferences(CARPLAY_MONITOR_PREFS, Context.MODE_PRIVATE)
    } catch (e: Throwable) {
        Log.w(TAG, "Failed to open CarPlayMonitor prefs", e)
        null
    }

    private fun formatIso(millis: Long): String {
        // SimpleDateFormat is not thread-safe — synchronize on the shared instance.
        synchronized(ISO_FORMAT) {
            return ISO_FORMAT.format(Date(millis))
        }
    }

    private fun runOnMain(block: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            block()
        } else {
            mainHandler.post(block)
        }
    }

    companion object {
        private const val TAG = "CarPlayMonitor"
        /** Persisted last-known connection state. */
        internal const val CARPLAY_MONITOR_PREFS = "expo_detect_carplay_monitor"
        internal const val KEY_LAST_CONNECTED = "last_connected"
        private const val KEY_LAST_CONNECTED_AT = "last_connected_at"
        private const val KEY_LAST_CONNECTED_TYPE = "last_connected_type"
        /**
         * Grace window before emitting a `disconnected` event when the
         * persisted state was `connected` but the freshly-attached observer
         * reports `NOT_CONNECTED`. Absorbs the LiveData / Content-Provider
         * initial-value race that occurs during a cold service restart
         * (e.g. after the app is swiped away and START_STICKY revives us).
         */
        private const val BOOTSTRAP_GRACE_MS = 3_000L
        /**
         * Delay after which [start] emits a loud diagnostic log if the
         * LiveData has not delivered a single value. 5 s comfortably covers
         * the cold-start content-provider resolution path even on slow
         * devices.
         */
        private const val DIAGNOSTIC_PROBE_MS = 5_000L
        // ISO 8601 UTC with millisecond precision. Safe for all supported APIs (minSdk 23).
        private val ISO_FORMAT = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }

        private fun transportForType(type: Int): String =
                when (type) {
                    CarConnection.CONNECTION_TYPE_PROJECTION -> "projection"
                    CarConnection.CONNECTION_TYPE_NATIVE -> "native"
                    else -> "unknown"
                }

        /** Return the durable last-known state when the foreground service is not running. */
        fun getPersistedStatus(context: Context): Map<String, Any?> {
            return try {
                val prefs =
                        context.applicationContext.getSharedPreferences(
                                CARPLAY_MONITOR_PREFS,
                                Context.MODE_PRIVATE
                        )
                if (!prefs.getBoolean(KEY_LAST_CONNECTED, false)) {
                    mapOf("connected" to false)
                } else {
                    val persistedTimestamp =
                            prefs.getLong(KEY_LAST_CONNECTED_AT, 0L).takeIf { it > 0L }
                    val timestamp = persistedTimestamp ?: System.currentTimeMillis()
                    val type =
                            prefs.getInt(
                                    KEY_LAST_CONNECTED_TYPE,
                                    CarConnection.CONNECTION_TYPE_NOT_CONNECTED
                            )
                    if (persistedTimestamp == null) {
                        prefs.edit()
                                .putLong(KEY_LAST_CONNECTED_AT, timestamp)
                                .putInt(KEY_LAST_CONNECTED_TYPE, type)
                                .apply()
                    }
                    mapOf(
                            "connected" to true,
                            "transport" to transportForType(type),
                            "timestamp" to timestamp,
                            "timestampIso" to formatIsoUtc(timestamp)
                    )
                }
            } catch (error: Throwable) {
                Log.w(TAG, "Failed to read persisted CarPlay status", error)
                mapOf("connected" to false)
            }
        }

        private fun formatIsoUtc(millis: Long): String {
            synchronized(ISO_FORMAT) {
                return ISO_FORMAT.format(Date(millis))
            }
        }

        /**
         * Clear the persisted last-known connection state. Call when CarPlay
         * monitoring is being explicitly disabled by the user, so that a
         * subsequent re-enable does not assume a stale prior connection.
         */
        @JvmStatic
        fun clearPersistedState(context: Context) {
            try {
                context.applicationContext
                    .getSharedPreferences(CARPLAY_MONITOR_PREFS, Context.MODE_PRIVATE)
                    .edit()
                    .clear()
                    .apply()
            } catch (_: Throwable) { /* best-effort */ }
        }
    }
}
