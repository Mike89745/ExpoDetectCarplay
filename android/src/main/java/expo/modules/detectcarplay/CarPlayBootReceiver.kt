package expo.modules.detectcarplay

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class CarPlayBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (!CarPlayForegroundService.isEnabled(context)) return
        try {
            CarPlayForegroundService.enable(context)
        } catch (error: Throwable) {
            Log.w("CarPlayBootReceiver", "Unable to restore CarPlay monitoring", error)
            CarPlayWatchdogWorker.schedule(context)
        }
    }
}
