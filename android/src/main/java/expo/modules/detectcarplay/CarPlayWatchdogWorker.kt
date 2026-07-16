package expo.modules.detectcarplay

import android.content.Context
import android.util.Log
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * Periodic safety-net that re-arms the [CarPlayForegroundService] whenever
 * CarPlay observation is enabled but the service has been killed (low memory,
 * OEM cleaners, etc.).
 *
 * [CarPlayForegroundService.enable] is idempotent: if the service is
 * alive this is a cheap no-op; if it is dead it cold-starts a fresh
 * foreground instance and re-attaches [CarPlayMonitor].
 *
 * WorkManager guarantees a minimum 15-minute period. A second, permission-free
 * inexact AlarmManager loop in [BootReceiver] provides an additional recovery
 * opportunity. Android may defer either background path, so failures are
 * returned to WorkManager for retry with its normal backoff policy.
 */
internal class CarPlayWatchdogWorker(
    appContext: Context,
    params: WorkerParameters,
) : Worker(appContext, params) {

    override fun doWork(): Result {
        val ctx = applicationContext
        if (!CarPlayForegroundService.isEnabled(ctx)) {
            Log.d(TAG, "Watchdog tick: CarPlay disabled, no action")
            return Result.success()
        }
        try {
            CarPlayForegroundService.enable(ctx)
            Log.d(TAG, "Watchdog tick: ensured CarPlayForegroundService is running")
        } catch (t: Throwable) {
            // API 31+ can reject a foreground-service start while the app is
            // fully backgrounded. Let WorkManager retry instead of silently
            // treating a failed recovery attempt as successful.
            Log.w(TAG, "Watchdog tick: enableCarPlay failed; requesting retry", t)
            return Result.retry()
        }
        return Result.success()
    }

    companion object {
        private const val TAG = "CarPlayWatchdog"
        private const val WORK_NAME = "expo-detect-carplay-watchdog"

        /**
         * Schedule the periodic watchdog. Idempotent — [ExistingPeriodicWorkPolicy.KEEP]
         * preserves the existing schedule across calls so we don't reset the
         * next-run timer every time the user re-enables CarPlay.
         */
        @JvmStatic
        fun schedule(context: Context) {
            try {
                val request = PeriodicWorkRequestBuilder<CarPlayWatchdogWorker>(
                    15, TimeUnit.MINUTES,
                ).addTag(WORK_NAME).build()
                WorkManager.getInstance(context.applicationContext)
                    .enqueueUniquePeriodicWork(
                        WORK_NAME,
                        ExistingPeriodicWorkPolicy.KEEP,
                        request,
                    )
                Log.d(TAG, "Watchdog scheduled (15 min period)")
            } catch (t: Throwable) {
                Log.w(TAG, "Failed to schedule CarPlay watchdog", t)
            }
        }

        /** Cancel the periodic watchdog. Safe to call when not scheduled. */
        @JvmStatic
        fun cancel(context: Context) {
            try {
                WorkManager.getInstance(context.applicationContext)
                    .cancelUniqueWork(WORK_NAME)
                Log.d(TAG, "Watchdog cancelled")
            } catch (t: Throwable) {
                Log.w(TAG, "Failed to cancel CarPlay watchdog", t)
            }
        }
    }
}
