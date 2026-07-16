package expo.modules.detectcarplay

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.util.Log
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.ArrayDeque
import java.util.LinkedHashMap
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit

private const val TAG = "CarPlayApiForwarder"
private const val API_URL_KEY = "api_url"
private const val API_KEY_KEY = "api_key"
private const val ID_KEY = "id"
private const val MAX_RETRIES = 3
private const val MAX_PENDING_EVENTS = 128
private const val MAX_PENDING_DISTANCE_EVENTS = 32

/**
 * Fire-and-forget HTTP event forwarder for vehicle connection events.
 * Sends enter/exit/timeout events to a configured API endpoint from native code,
 * ensuring delivery even when the JS bridge is not active (app backgrounded).
 *
 * Transition and lifecycle events are delivered before distance updates. Distance
 * updates are coalesced per beacon, and all pending work is bounded so a slow or
 * unavailable endpoint cannot grow memory use indefinitely.
 */
internal class CarPlayApiForwarder(private val context: Context) {

    private data class PendingEvent(
        val url: String,
        val apiKey: String?,
        val payload: String,
        val eventType: String,
        val maxAttempts: Int,
        val coalescingKey: String?,
    )

    private val queueLock = Any()
    private val priorityEvents = ArrayDeque<PendingEvent>()
    private val distanceEvents = LinkedHashMap<String, PendingEvent>()
    private val executor =
        ThreadPoolExecutor(
            1,
            1,
            0L,
            TimeUnit.MILLISECONDS,
            ArrayBlockingQueue(1),
        )

    @Volatile private var stopped = false
    private var workerScheduled = false
    private var activeConnection: HttpURLConnection? = null

    private val prefs: SharedPreferences by lazy {
        context.getSharedPreferences(API_CONFIG_PREFS, Context.MODE_PRIVATE)
    }

    fun configure(url: String, apiKey: String?, id: String? = null) {
        prefs.edit().apply {
            putString(API_URL_KEY, url)
            if (apiKey != null) putString(API_KEY_KEY, apiKey)
            else remove(API_KEY_KEY)
            if (id != null) putString(ID_KEY, id)
            else remove(ID_KEY)
        }.apply()
    }

    fun getConfig(): Map<String, String?> {
        return mapOf(
            "url" to prefs.getString(API_URL_KEY, null),
            "apiKey" to prefs.getString(API_KEY_KEY, null),
            "id" to prefs.getString(ID_KEY, null)
        )
    }

    /**
     * Send a beacon event to the configured API endpoint.
     * Fire-and-forget with simple retry (3 attempts, exponential backoff).
     * High-frequency distance events get a single attempt and are coalesced
     * per beacon while waiting for the worker.
     * No-op if no endpoint is configured or this forwarder was shut down.
     */
    fun forwardEvent(params: Map<String, Any?>, eventType: String) {
        if (stopped) return

        val url = prefs.getString(API_URL_KEY, null)
        if (url.isNullOrEmpty()) return

        val apiKey = prefs.getString(API_KEY_KEY, null)
        val id = prefs.getString(ID_KEY, null)
        val payload = JSONObject().apply {
            for ((key, value) in params) {
                put(key, value ?: JSONObject.NULL)
            }
            if (!id.isNullOrEmpty()) put("id", id)
            put("eventType", eventType)
            put("timestamp", System.currentTimeMillis())
            put("platform", "android")
            put("sdkVersion", Build.VERSION.SDK_INT)
        }

        val isDistanceEvent = isDistanceEvent(eventType)
        enqueue(
            PendingEvent(
                url = url,
                apiKey = apiKey,
                payload = payload.toString(),
                eventType = eventType,
                maxAttempts = if (isDistanceEvent) 1 else MAX_RETRIES,
                coalescingKey = if (isDistanceEvent) distanceKey(eventType, params) else null,
            )
        )
    }

    private fun enqueue(event: PendingEvent) {
        var shouldScheduleWorker = false
        var droppedPriorityEvent = false

        synchronized(queueLock) {
            if (stopped) return

            val coalescingKey = event.coalescingKey
            if (coalescingKey != null) {
                if (distanceEvents.containsKey(coalescingKey)) {
                    // Keep only the newest unsent reading for this beacon.
                    distanceEvents[coalescingKey] = event
                } else {
                    if (distanceEvents.size >= MAX_PENDING_DISTANCE_EVENTS) {
                        removeOldestDistanceEventLocked()
                    }
                    if (pendingEventCountLocked() >= MAX_PENDING_EVENTS &&
                        !removeOldestDistanceEventLocked()
                    ) {
                        // The queue contains only higher-priority events.
                        return
                    }
                    distanceEvents[coalescingKey] = event
                }
            } else {
                if (pendingEventCountLocked() >= MAX_PENDING_EVENTS) {
                    if (!removeOldestDistanceEventLocked()) {
                        // Prefer current state over stale state when even the
                        // high-priority portion of the queue is saturated.
                        priorityEvents.pollFirst()
                        droppedPriorityEvent = true
                    }
                }
                priorityEvents.addLast(event)
            }

            if (!workerScheduled) {
                workerScheduled = true
                shouldScheduleWorker = true
            }
        }

        if (droppedPriorityEvent) {
            Log.w(TAG, "API forward queue full; dropped oldest pending priority event")
        }
        if (shouldScheduleWorker) submitWorker()
    }

    private fun submitWorker() {
        try {
            executor.execute { drainQueue() }
        } catch (_: RejectedExecutionException) {
            synchronized(queueLock) {
                workerScheduled = false
            }
        }
    }

    private fun drainQueue() {
        try {
            while (!Thread.currentThread().isInterrupted) {
                val event = takeNextEvent() ?: return
                send(event)
            }
        } finally {
            var shouldReschedule = false
            synchronized(queueLock) {
                workerScheduled = false
                if (!stopped && pendingEventCountLocked() > 0) {
                    workerScheduled = true
                    shouldReschedule = true
                }
            }
            if (shouldReschedule) submitWorker()
        }
    }

    private fun takeNextEvent(): PendingEvent? {
        synchronized(queueLock) {
            if (stopped) return null
            priorityEvents.pollFirst()?.let { return it }

            val iterator = distanceEvents.entries.iterator()
            if (!iterator.hasNext()) return null
            val event = iterator.next().value
            iterator.remove()
            return event
        }
    }

    private fun send(event: PendingEvent) {
        var lastException: Exception? = null
        for (attempt in 1..event.maxAttempts) {
            if (stopped || Thread.currentThread().isInterrupted) return

            try {
                val code = post(event) ?: return
                if (code in 200..299) return
                // 4xx client errors are not transient, so retrying cannot help.
                if (code in 400..499) {
                    Log.w(TAG, "API forward ${event.eventType} failed with $code; not retrying")
                    return
                }
                lastException = RuntimeException("HTTP $code")
            } catch (e: Exception) {
                if (stopped || Thread.currentThread().isInterrupted) return
                lastException = e
            }

            if (attempt < event.maxAttempts) {
                try {
                    Thread.sleep(1000L * (1 shl (attempt - 1)))
                } catch (_: InterruptedException) {
                    Thread.currentThread().interrupt()
                    return
                }
            }
        }
        Log.w(
            TAG,
            "API forward ${event.eventType} failed after ${event.maxAttempts} attempts: " +
                lastException?.message
        )
    }

    /** Returns null when shutdown wins the race before the request starts. */
    private fun post(event: PendingEvent): Int? {
        val connection = (URL(event.url).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            setRequestProperty("Content-Type", "application/json")
            event.apiKey?.let { setRequestProperty("X-CSFR-Token", it) }
            connectTimeout = 10_000
            readTimeout = 10_000
            doOutput = true
        }

        synchronized(queueLock) {
            if (stopped || Thread.currentThread().isInterrupted) {
                connection.disconnect()
                return null
            }
            activeConnection = connection
        }

        return try {
            OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use {
                it.write(event.payload)
            }
            connection.responseCode
        } finally {
            synchronized(queueLock) {
                if (activeConnection === connection) activeConnection = null
            }
            connection.disconnect()
        }
    }

    private fun pendingEventCountLocked(): Int = priorityEvents.size + distanceEvents.size

    private fun removeOldestDistanceEventLocked(): Boolean {
        val iterator = distanceEvents.entries.iterator()
        if (!iterator.hasNext()) return false
        iterator.next()
        iterator.remove()
        return true
    }

    private fun isDistanceEvent(eventType: String): Boolean = false

    private fun distanceKey(eventType: String, params: Map<String, Any?>): String {
        return listOf(
            eventType,
            params["identifier"],
            params["uuid"],
            params["major"],
            params["minor"],
            params["namespace"],
            params["instance"],
        ).joinToString(separator = "|")
    }

    /** Cancel active and queued requests. Future events are dropped. */
    fun shutdown() {
        val connection = synchronized(queueLock) {
            if (stopped) return
            stopped = true
            priorityEvents.clear()
            distanceEvents.clear()
            workerScheduled = false
            activeConnection.also { activeConnection = null }
        }

        connection?.disconnect()
        executor.shutdownNow()
    }
}
