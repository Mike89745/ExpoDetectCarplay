package expo.modules.detectcarplay

import android.Manifest
import android.content.Context
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import expo.modules.interfaces.permissions.PermissionsStatus
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import org.json.JSONObject

class ExpoDetectCarplayModule : Module() {
    private var eventLogger: CarPlayEventLogger? = null
    private var apiForwarder: CarPlayApiForwarder? = null

    override fun definition() = ModuleDefinition {
        Name("ExpoDetectCarplay")

        Events("onCarPlayConnected", "onCarPlayDisconnected", "onCarPlayError")

        AsyncFunction("startCarPlayMonitoring") { promise: Promise ->
            val context = appContext.reactContext
            if (context == null) {
                promise.reject("NO_CONTEXT", "React context is not available", null)
                return@AsyncFunction
            }
            if (!CarPlayForegroundService.hasForegroundServicePrerequisite(context)) {
                rejectAndEmit(
                    promise,
                    "PERMISSION_DENIED",
                    "Android 14+ requires a Bluetooth permission before starting monitoring. Call requestPermissionsAsync() first.",
                )
                return@AsyncFunction
            }
            try {
                CarPlayForegroundService.enable(context)
                promise.resolve(null)
            } catch (error: Throwable) {
                rejectAndEmit(
                    promise,
                    "CARPLAY_START_FAILED",
                    "Failed to start CarPlay monitoring: ${error.message}",
                    error,
                )
            }
        }

        AsyncFunction("stopCarPlayMonitoring") { promise: Promise ->
            val context = appContext.reactContext
            if (context == null) {
                promise.reject("NO_CONTEXT", "React context is not available", null)
                return@AsyncFunction
            }
            try {
                CarPlayForegroundService.disable(context)
                promise.resolve(null)
            } catch (error: Throwable) {
                rejectAndEmit(
                    promise,
                    "CARPLAY_STOP_FAILED",
                    "Failed to stop CarPlay monitoring: ${error.message}",
                    error,
                )
            }
        }

        Function("isCarPlayMonitoringEnabled") {
            val context = appContext.reactContext ?: return@Function false
            CarPlayForegroundService.isEnabled(context)
        }

        Function("getCarPlayConnectionStatus") {
            val context = appContext.reactContext ?: return@Function mapOf("connected" to false)
            CarPlayForegroundService.getStatus(context)
        }

        Function("getCarPlayDiagnostics") {
            val context = appContext.reactContext
                ?: return@Function mapOf(
                    "isCarAppMetadataPresent" to false,
                    "isCarProviderQueryable" to false,
                    "lastRawConnectionType" to null,
                    "observerActive" to false,
                    "serviceAlive" to false,
                )
            CarPlayForegroundService.getDiagnostics(context)
        }

        Function("setCarPlayNotificationConfig") { config: Map<String, Any?> ->
            val context = appContext.reactContext ?: return@Function
            val normalized = if (config.keys.any { it in NOTIFICATION_SECTION_KEYS }) {
                mapToJson(config)
            } else {
                JSONObject().put("events", mapToJson(config))
            }
            context.getSharedPreferences(NOTIFICATION_CONFIG_PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(NOTIFICATION_CONFIG_KEY, normalized.toString())
                .apply()
        }

        AsyncFunction("requestPermissionsAsync") { promise: Promise ->
            val permissions = buildList {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    add(Manifest.permission.BLUETOOTH_SCAN)
                    add(Manifest.permission.BLUETOOTH_CONNECT)
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    add(Manifest.permission.POST_NOTIFICATIONS)
                }
            }
            if (permissions.isEmpty()) {
                promise.resolve(true)
                return@AsyncFunction
            }
            val manager = appContext.permissions
            if (manager == null) {
                val context = appContext.reactContext
                promise.resolve(
                    context != null && permissions.all {
                        ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
                    },
                )
                return@AsyncFunction
            }
            manager.askForPermissions(
                { results ->
                    promise.resolve(
                        permissions.all { results[it]?.status == PermissionsStatus.GRANTED },
                    )
                },
                *permissions.toTypedArray(),
            )
        }

        Function("enableEventLogging") {
            val context = requireContext()
            if (eventLogger == null) eventLogger = CarPlayEventLogger(context)
            CarPlayEventLogger.setLoggingEnabled(context, true)
        }

        Function("disableEventLogging") {
            appContext.reactContext?.let { CarPlayEventLogger.setLoggingEnabled(it, false) }
        }

        Function("isEventLoggingEnabled") {
            val context = appContext.reactContext ?: return@Function false
            CarPlayEventLogger.isLoggingEnabled(context)
        }

        Function("getEventLogs") { options: Map<String, Any?>? ->
            val logger = getOrCreateEventLogger() ?: return@Function emptyList<Map<String, Any?>>()
            logger.getEvents(
                limit = (options?.get("limit") as? Number)?.toInt() ?: 1000,
                eventType = options?.get("eventType") as? String,
                sinceTimestamp = (options?.get("sinceTimestamp") as? Number)?.toLong(),
            )
        }

        Function("clearEventLogs") { getOrCreateEventLogger()?.clearEvents() }

        Function("destroyEventLogs") {
            val context = appContext.reactContext ?: return@Function null
            CarPlayEventLogger.setLoggingEnabled(context, false)
            eventLogger?.close()
            eventLogger = null
            CarPlayEventLogger.deleteLogDatabase(context)
            null
        }

        Function("setApiEndpoint") { url: String, apiKey: String?, id: String? ->
            getOrCreateApiForwarder()?.configure(url, apiKey, id)
        }

        Function("getApiEndpoint") {
            getOrCreateApiForwarder()?.getConfig()
                ?: mapOf("url" to null, "apiKey" to null, "id" to null)
        }

        OnCreate {
            appContext.reactContext?.let(::migrateLegacyStateIfNeeded)
            CarPlayForegroundService.bindModule(this@ExpoDetectCarplayModule)
        }

        OnDestroy {
            CarPlayForegroundService.bindModule(null)
            eventLogger?.close()
            eventLogger = null
            apiForwarder?.shutdown()
            apiForwarder = null
        }
    }

    fun forwardEventFromService(eventName: String, payload: Map<String, Any?>) {
        try { sendEvent(eventName, payload) } catch (_: Throwable) {}
    }

    private fun requireContext(): Context =
        appContext.reactContext ?: throw IllegalStateException("React context is not available")

    private fun getOrCreateEventLogger(): CarPlayEventLogger? {
        val context = appContext.reactContext ?: return null
        return eventLogger ?: CarPlayEventLogger(context).also { eventLogger = it }
    }

    private fun getOrCreateApiForwarder(): CarPlayApiForwarder? {
        val context = appContext.reactContext ?: return null
        return apiForwarder ?: CarPlayApiForwarder(context).also { apiForwarder = it }
    }

    private fun rejectAndEmit(
        promise: Promise,
        code: String,
        message: String,
        cause: Throwable? = null,
    ) {
        promise.reject(code, message, cause)
        val payload = mapOf<String, Any?>("code" to code, "message" to message)
        try {
            if (appContext.reactContext?.let { CarPlayEventLogger.isLoggingEnabled(it) } == true) {
                getOrCreateEventLogger()?.logEvent("onCarPlayError", null, payload)
            }
            getOrCreateApiForwarder()?.forwardEvent(payload, "onCarPlayError")
            sendEvent("onCarPlayError", payload)
        } catch (_: Throwable) {}
    }

    private fun mapToJson(map: Map<String, Any?>): JSONObject {
        val json = JSONObject()
        map.forEach { (key, value) ->
            when (value) {
                null -> json.put(key, JSONObject.NULL)
                is Map<*, *> -> {
                    @Suppress("UNCHECKED_CAST")
                    json.put(key, mapToJson(value as Map<String, Any?>))
                }
                else -> json.put(key, value)
            }
        }
        return json
    }

    private fun migrateLegacyStateIfNeeded(context: Context) {
        val migration = context.getSharedPreferences(MIGRATION_PREFS, Context.MODE_PRIVATE)
        if (migration.getBoolean(MIGRATION_KEY, false)) return

        copyBooleanPreference(
            context,
            "expo.beacon.carplay_enabled",
            "enabled",
            ENABLED_PREFS,
            ENABLED_KEY,
        )
        copyPreferences(context, "expo_beacon_carplay_monitor", CarPlayMonitor.CARPLAY_MONITOR_PREFS)
        copyBooleanPreference(
            context,
            "expo.beacon.event_logging",
            "enabled",
            EVENT_LOGGING_PREFS,
            EVENT_LOGGING_ENABLED_KEY,
        )
        copyPreferences(context, "expo.beacon.api_config", API_CONFIG_PREFS)

        val newNotificationPrefs =
            context.getSharedPreferences(NOTIFICATION_CONFIG_PREFS, Context.MODE_PRIVATE)
        if (!newNotificationPrefs.contains(NOTIFICATION_CONFIG_KEY)) {
            val raw = context.getSharedPreferences(
                "expo.beacon.notification_config",
                Context.MODE_PRIVATE,
            ).getString("config", null)
            if (raw != null) {
                try {
                    val old = JSONObject(raw)
                    val carPlay = old.optJSONObject("carPlay")
                        ?: old.optJSONObject("carPlayEvents")?.let { JSONObject().put("events", it) }
                    if (carPlay != null) {
                        newNotificationPrefs.edit()
                            .putString(NOTIFICATION_CONFIG_KEY, carPlay.toString())
                            .apply()
                    }
                } catch (_: Throwable) {}
            }
        }
        migration.edit().putBoolean(MIGRATION_KEY, true).apply()
    }

    private fun copyBooleanPreference(
        context: Context,
        oldPrefsName: String,
        oldKey: String,
        newPrefsName: String,
        newKey: String,
    ) {
        val destination = context.getSharedPreferences(newPrefsName, Context.MODE_PRIVATE)
        if (destination.contains(newKey)) return
        val source = context.getSharedPreferences(oldPrefsName, Context.MODE_PRIVATE)
        if (source.contains(oldKey)) {
            destination.edit().putBoolean(newKey, source.getBoolean(oldKey, false)).apply()
        }
    }

    private fun copyPreferences(context: Context, oldName: String, newName: String) {
        val source = context.getSharedPreferences(oldName, Context.MODE_PRIVATE)
        val destination = context.getSharedPreferences(newName, Context.MODE_PRIVATE)
        val editor = destination.edit()
        source.all.forEach { (key, value) ->
            if (destination.contains(key)) return@forEach
            when (value) {
                is String -> editor.putString(key, value)
                is Boolean -> editor.putBoolean(key, value)
                is Int -> editor.putInt(key, value)
                is Long -> editor.putLong(key, value)
                is Float -> editor.putFloat(key, value)
                is Set<*> -> {
                    @Suppress("UNCHECKED_CAST")
                    editor.putStringSet(key, value as Set<String>)
                }
            }
        }
        editor.apply()
    }

    companion object {
        private val NOTIFICATION_SECTION_KEYS =
            setOf("events", "foregroundService", "channel")
        private val ISO_FORMAT = SimpleDateFormat(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            Locale.US,
        ).apply { timeZone = TimeZone.getTimeZone("UTC") }

        internal fun formatIsoTimestamp(timestamp: Long): String =
            synchronized(ISO_FORMAT) { ISO_FORMAT.format(Date(timestamp)) }
    }
}
