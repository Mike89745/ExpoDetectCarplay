package expo.modules.detectcarplay

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import java.lang.ref.WeakReference
import org.json.JSONObject

class CarPlayForegroundService : Service() {
    private val mainHandler = Handler(Looper.getMainLooper())
    private var monitor: CarPlayMonitor? = null
    private var eventLogger: CarPlayEventLogger? = null
    private var apiForwarder: CarPlayApiForwarder? = null

    override fun onCreate() {
        super.onCreate()
        activeService = this
        if (isEnabled(this)) {
            enterForeground()
            startObserver()
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (!isEnabled(this)) {
            stopSelf()
            return START_NOT_STICKY
        }
        enterForeground()
        startObserver()
        return START_STICKY
    }

    private fun enterForeground() {
        val notification = buildForegroundNotification(this)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                FOREGROUND_NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE,
            )
        } else {
            startForeground(FOREGROUND_NOTIFICATION_ID, notification)
        }
    }

    private fun startObserver(): Boolean {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            mainHandler.post { startObserver() }
            return true
        }
        val current = monitor ?: try {
            CarPlayMonitor(applicationContext).also { monitor = it }
        } catch (error: Throwable) {
            observerFailed("Failed to create connection observer", error)
            return false
        }
        return try {
            current.start { eventName, payload -> emitConnectionEvent(eventName, payload) }
            if (!current.isObserving()) {
                observerFailed("Connection observer did not become active", null)
                false
            } else {
                true
            }
        } catch (error: Throwable) {
            observerFailed("Failed to start connection observer", error)
            false
        }
    }

    private fun observerFailed(message: String, error: Throwable?) {
        Log.e(TAG, message, error)
        setEnabled(this, false)
        CarPlayWatchdogWorker.cancel(this)
        emitError("CARPLAY_OBSERVER_FAILED", message)
        stopSelf()
    }

    private fun emitConnectionEvent(eventName: String, payload: Map<String, Any?>) {
        try {
            if (CarPlayEventLogger.isLoggingEnabled(this)) {
                getOrCreateLogger().logEvent(eventName, null, payload)
            }
        } catch (error: Throwable) {
            Log.w(TAG, "Failed to log $eventName", error)
        }
        try {
            getOrCreateForwarder().forwardEvent(payload, eventName)
        } catch (error: Throwable) {
            Log.w(TAG, "Failed to forward $eventName", error)
        }
        when (eventName) {
            "onCarPlayConnected" ->
                CarPlayPluginRegistry.dispatchConnected(payload["transport"] as? String ?: "unknown")
            "onCarPlayDisconnected" -> CarPlayPluginRegistry.dispatchDisconnected()
        }
        try {
            boundModule?.get()?.forwardEventFromService(eventName, payload)
            writeJsConnected(eventName == "onCarPlayConnected")
        } catch (_: Throwable) {}
        showEventNotification(
            eventName == "onCarPlayConnected",
            payload["transport"] as? String,
        )
    }

    private fun emitError(code: String, message: String) {
        val payload = mapOf<String, Any?>("code" to code, "message" to message)
        try {
            if (CarPlayEventLogger.isLoggingEnabled(this)) {
                getOrCreateLogger().logEvent("onCarPlayError", null, payload)
            }
            getOrCreateForwarder().forwardEvent(payload, "onCarPlayError")
            boundModule?.get()?.forwardEventFromService("onCarPlayError", payload)
        } catch (_: Throwable) {}
    }

    private fun reEmitStateIfNeeded(module: ExpoDetectCarplayModule) {
        val current = monitor ?: return
        if (!current.isObserving()) return
        val connectedPayload = current.buildConnectedPayload()
        if (connectedPayload != null) {
            module.forwardEventFromService("onCarPlayConnected", connectedPayload)
            writeJsConnected(true)
        } else if (readJsConnected()) {
            val now = System.currentTimeMillis()
            module.forwardEventFromService(
                "onCarPlayDisconnected",
                mapOf(
                    "timestamp" to now,
                    "timestampIso" to ExpoDetectCarplayModule.formatIsoTimestamp(now),
                    "reason" to "reconciled",
                ),
            )
            writeJsConnected(false)
        }
    }

    private fun readJsConnected(): Boolean =
        getSharedPreferences(JS_STATE_PREFS, Context.MODE_PRIVATE)
            .getBoolean(JS_CONNECTED_KEY, false)

    private fun writeJsConnected(connected: Boolean) {
        getSharedPreferences(JS_STATE_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(JS_CONNECTED_KEY, connected)
            .apply()
    }

    private fun getOrCreateLogger(): CarPlayEventLogger =
        eventLogger ?: CarPlayEventLogger(this).also { eventLogger = it }

    private fun getOrCreateForwarder(): CarPlayApiForwarder =
        apiForwarder ?: CarPlayApiForwarder(this).also { apiForwarder = it }

    private fun showEventNotification(connected: Boolean, transport: String?) {
        val events = notificationConfig(this).optJSONObject("events")
        if (events?.optBoolean("enabled", true) == false) return
        ensureEventChannel(this)
        val event = if (connected) "connected" else "disconnected"
        val titleKey = if (connected) "connectedTitle" else "disconnectedTitle"
        val defaultTitle = if (connected) "CarPlay Connected" else "CarPlay Disconnected"
        val title = events?.optString(titleKey)?.takeIf { it.isNotEmpty() } ?: defaultTitle
        val body = (events?.optString("body")?.takeIf { it.isNotEmpty() }
            ?: "CarPlay session {event}")
            .replace("{event}", event)
            .replace("{transport}", transport ?: "")
        val notification = NotificationCompat.Builder(this, EVENT_CHANNEL_ID)
            .setSmallIcon(resolveIcon(this, events))
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build()
        try {
            NotificationManagerCompat.from(this)
                .notify(if (connected) CONNECTED_NOTIFICATION_ID else DISCONNECTED_NOTIFICATION_ID, notification)
        } catch (_: SecurityException) {}
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        if (isEnabled(this)) CarPlayWatchdogWorker.schedule(this)
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        if (activeService === this) activeService = null
        try { monitor?.stop() } catch (_: Throwable) {}
        monitor = null
        eventLogger?.close()
        eventLogger = null
        apiForwarder?.shutdown()
        apiForwarder = null
        mainHandler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        private const val TAG = "CarPlayService"
        private const val FOREGROUND_CHANNEL_ID = "expo_carplay_foreground"
        private const val EVENT_CHANNEL_ID = "expo_carplay_events"
        private const val FOREGROUND_NOTIFICATION_ID = 0xCA71
        private const val CONNECTED_NOTIFICATION_ID = 0xCA72
        private const val DISCONNECTED_NOTIFICATION_ID = 0xCA73

        @Volatile private var activeService: CarPlayForegroundService? = null
        @Volatile private var boundModule: WeakReference<ExpoDetectCarplayModule>? = null

        internal fun setEnabled(context: Context, enabled: Boolean) {
            context.applicationContext
                .getSharedPreferences(ENABLED_PREFS, Context.MODE_PRIVATE)
                .edit()
                .putBoolean(ENABLED_KEY, enabled)
                .apply()
        }

        fun isEnabled(context: Context): Boolean =
            context.applicationContext
                .getSharedPreferences(ENABLED_PREFS, Context.MODE_PRIVATE)
                .getBoolean(ENABLED_KEY, false)

        fun hasForegroundServicePrerequisite(context: Context): Boolean {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return true
            return ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) ==
                PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_SCAN) ==
                PackageManager.PERMISSION_GRANTED
        }

        fun enable(context: Context) {
            val appContext = context.applicationContext
            if (!hasForegroundServicePrerequisite(appContext)) {
                throw SecurityException(
                    "Android 14+ requires a Bluetooth permission for connected-device foreground service monitoring",
                )
            }
            val wasEnabled = isEnabled(appContext)
            setEnabled(appContext, true)
            try {
                ensureForegroundChannel(appContext)
                ensureEventChannel(appContext)
                CarPlayWatchdogWorker.schedule(appContext)
                val intent = Intent(appContext, CarPlayForegroundService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    appContext.startForegroundService(intent)
                } else {
                    appContext.startService(intent)
                }
            } catch (error: Throwable) {
                if (!wasEnabled) {
                    setEnabled(appContext, false)
                    CarPlayWatchdogWorker.cancel(appContext)
                }
                throw error
            }
        }

        fun disable(context: Context) {
            val appContext = context.applicationContext
            setEnabled(appContext, false)
            CarPlayWatchdogWorker.cancel(appContext)
            CarPlayMonitor.clearPersistedState(appContext)
            appContext.getSharedPreferences(JS_STATE_PREFS, Context.MODE_PRIVATE)
                .edit().clear().apply()
            appContext.stopService(Intent(appContext, CarPlayForegroundService::class.java))
        }

        fun bindModule(module: ExpoDetectCarplayModule?) {
            boundModule = module?.let(::WeakReference)
            if (module != null) activeService?.reEmitStateIfNeeded(module)
        }

        fun getStatus(context: Context): Map<String, Any?> {
            val current = activeService?.monitor
            if (current != null && current.isObserving()) {
                return current.buildConnectedPayload()?.plus("connected" to true)
                    ?: mapOf("connected" to false)
            }
            return CarPlayMonitor.getPersistedStatus(context)
        }

        fun getDiagnostics(context: Context): Map<String, Any?> {
            val packageManager = context.packageManager
            val metadataPresent = try {
                val info = packageManager.getApplicationInfo(
                    context.packageName,
                    PackageManager.GET_META_DATA,
                )
                info.metaData?.containsKey("com.google.android.gms.car.application") == true
            } catch (_: Throwable) {
                false
            }
            val providerQueryable = try {
                packageManager.queryIntentContentProviders(
                    Intent("androidx.car.app.connection.action.CAR_PROVIDER"),
                    0,
                ).isNotEmpty()
            } catch (_: Throwable) {
                false
            }
            val current = activeService?.monitor
            return mapOf(
                "isCarAppMetadataPresent" to metadataPresent,
                "isCarProviderQueryable" to providerQueryable,
                "lastRawConnectionType" to
                    if (current?.hasObservedValue == true) current.lastObservedType else null,
                "observerActive" to (current?.isObserving() == true),
                "serviceAlive" to (activeService != null),
            )
        }

        internal fun notificationConfig(context: Context): JSONObject {
            val raw = context.applicationContext
                .getSharedPreferences(NOTIFICATION_CONFIG_PREFS, Context.MODE_PRIVATE)
                .getString(NOTIFICATION_CONFIG_KEY, null)
                ?: return JSONObject()
            return try { JSONObject(raw) } catch (_: Throwable) { JSONObject() }
        }

        private fun resolveIcon(context: Context, config: JSONObject?): Int {
            val name = config?.optString("icon")?.takeIf { it.isNotEmpty() }
            return name?.let {
                context.resources.getIdentifier(it, "drawable", context.packageName)
                    .takeIf { id -> id != 0 }
            } ?: android.R.drawable.stat_sys_data_bluetooth
        }

        private fun ensureForegroundChannel(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val manager = context.getSystemService(NotificationManager::class.java)
            if (manager?.getNotificationChannel(FOREGROUND_CHANNEL_ID) == null) {
                manager?.createNotificationChannel(
                    NotificationChannel(
                        FOREGROUND_CHANNEL_ID,
                        "Connected vehicle monitoring",
                        NotificationManager.IMPORTANCE_LOW,
                    ).apply {
                        description = "Persistent status for CarPlay and Android Auto monitoring"
                        setSound(null, null)
                        enableVibration(false)
                    },
                )
            }
        }

        private fun ensureEventChannel(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val config = notificationConfig(context).optJSONObject("channel")
            val manager = context.getSystemService(NotificationManager::class.java)
            if (manager?.getNotificationChannel(EVENT_CHANNEL_ID) == null) {
                val importance = when (config?.optString("importance")) {
                    "low" -> NotificationManager.IMPORTANCE_LOW
                    "high" -> NotificationManager.IMPORTANCE_HIGH
                    else -> NotificationManager.IMPORTANCE_DEFAULT
                }
                manager?.createNotificationChannel(
                    NotificationChannel(
                        EVENT_CHANNEL_ID,
                        config?.optString("name")?.takeIf { it.isNotEmpty() }
                            ?: "CarPlay / Android Auto",
                        importance,
                    ).apply {
                        description = config?.optString("description")?.takeIf { it.isNotEmpty() }
                            ?: "CarPlay and Android Auto connection events"
                    },
                )
            }
        }

        private fun buildForegroundNotification(context: Context): Notification {
            ensureForegroundChannel(context)
            val config = notificationConfig(context).optJSONObject("foregroundService")
            return NotificationCompat.Builder(context, FOREGROUND_CHANNEL_ID)
                .setSmallIcon(resolveIcon(context, config))
                .setContentTitle(
                    config?.optString("title")?.takeIf { it.isNotEmpty() }
                        ?: "Connected device monitoring active",
                )
                .setContentText(
                    config?.optString("text")?.takeIf { it.isNotEmpty() }
                        ?: "Monitoring CarPlay / Android Auto",
                )
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setSilent(true)
                .setOngoing(true)
                .build()
        }
    }
}
