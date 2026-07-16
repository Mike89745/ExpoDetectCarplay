package expo.modules.detectcarplay

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONObject

/**
 * SQLite-backed event logger for CarPlay and Android Auto events.
 * Thread-safe — all writes go through a single SQLiteOpenHelper.
 */
internal class CarPlayEventLogger(context: Context) :
    SQLiteOpenHelper(context.applicationContext, DB_NAME, null, DB_VERSION) {

    companion object {
        private const val DB_NAME = "expo_carplay_events.db"
        private const val DB_VERSION = 1
        private const val TABLE = "events"
        private const val MAX_STORED_EVENTS = 10000

        fun isLoggingEnabled(context: Context): Boolean {
            return context.applicationContext
                .getSharedPreferences(EVENT_LOGGING_PREFS, Context.MODE_PRIVATE)
                .getBoolean(EVENT_LOGGING_ENABLED_KEY, false)
        }

        fun setLoggingEnabled(context: Context, enabled: Boolean) {
            context.applicationContext
                .getSharedPreferences(EVENT_LOGGING_PREFS, Context.MODE_PRIVATE)
                .edit()
                .putBoolean(EVENT_LOGGING_ENABLED_KEY, enabled)
                .apply()
        }

        fun deleteLogDatabase(context: Context) {
            context.applicationContext.deleteDatabase(DB_NAME)
        }
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS $TABLE (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp INTEGER NOT NULL,
                event_type TEXT NOT NULL,
                identifier TEXT,
                data TEXT NOT NULL
            )
        """.trimIndent())
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_events_ts ON $TABLE (timestamp)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_events_type ON $TABLE (event_type)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS $TABLE")
        onCreate(db)
    }

    fun logEvent(eventType: String, identifier: String?, data: Map<String, Any?>) {
        val json = JSONObject()
        data.forEach { (k, v) -> json.put(k, v ?: JSONObject.NULL) }
        val values = ContentValues().apply {
            put("timestamp", System.currentTimeMillis())
            put("event_type", eventType)
            put("identifier", identifier)
            put("data", json.toString())
        }
        val db = writableDatabase
        db.beginTransaction()
        try {
            db.insert(TABLE, null, values)
            // AUTOINCREMENT ids are monotonic. Keeping only the latest id range
            // enforces a strict row bound without a full COUNT scan per event.
            db.delete(
                TABLE,
                "id <= (SELECT MAX(id) - ? FROM $TABLE)",
                arrayOf(MAX_STORED_EVENTS.toString())
            )
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    fun getEvents(limit: Int = 1000, eventType: String? = null, sinceTimestamp: Long? = null): List<Map<String, Any?>> {
        val args = mutableListOf<String>()
        val clauses = mutableListOf<String>()
        if (eventType != null) {
            clauses.add("event_type = ?")
            args.add(eventType)
        }
        if (sinceTimestamp != null) {
            clauses.add("timestamp >= ?")
            args.add(sinceTimestamp.toString())
        }
        val where = if (clauses.isEmpty()) "" else "WHERE ${clauses.joinToString(" AND ")}"
        val safeLimit = limit.coerceIn(1, 10000)
        val cursor = readableDatabase.rawQuery(
            "SELECT id, timestamp, event_type, identifier, data FROM $TABLE $where ORDER BY timestamp DESC LIMIT ?",
            (args + safeLimit.toString()).toTypedArray()
        )
        val results = mutableListOf<Map<String, Any?>>()
        cursor.use {
            while (it.moveToNext()) {
                results.add(buildMap {
                    put("id", it.getLong(0))
                    put("timestamp", it.getLong(1))
                    put("eventType", it.getString(2))
                    // Omit the key entirely for NULL identifiers (matches iOS; the TS type is optional).
                    if (!it.isNull(3)) put("identifier", it.getString(3))
                    put("data", try {
                        val json = JSONObject(it.getString(4))
                        val map = mutableMapOf<String, Any?>()
                        json.keys().forEach { k -> map[k] = json.opt(k) }
                        map
                    } catch (_: Exception) { emptyMap<String, Any?>() })
                })
            }
        }
        return results
    }

    fun clearEvents() {
        writableDatabase.delete(TABLE, null, null)
    }
}
