package expo.modules.detectcarplay

import android.util.Log
import java.util.concurrent.CopyOnWriteArrayList

object CarPlayPluginRegistry {
    private val plugins = CopyOnWriteArrayList<CarPlayEventPlugin>()

    fun register(plugin: CarPlayEventPlugin) {
        plugins.addIfAbsent(plugin)
    }

    fun unregister(plugin: CarPlayEventPlugin) {
        plugins.remove(plugin)
    }

    internal fun dispatchConnected(transport: String) {
        dispatch("connected") { it.onCarPlayConnected(transport) }
    }

    internal fun dispatchDisconnected() {
        dispatch("disconnected") { it.onCarPlayDisconnected() }
    }

    private inline fun dispatch(event: String, callback: (CarPlayEventPlugin) -> Unit) {
        plugins.forEach { plugin ->
            try {
                callback(plugin)
            } catch (error: Throwable) {
                Log.e("CarPlayPluginRegistry", "Plugin failed for $event", error)
            }
        }
    }
}
