import Foundation
import SQLite3

/// SQLite must copy Swift-owned UTF-8 buffers before their temporary bridge
/// objects go out of scope.
private let CARPLAY_SQLITE_TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
private let MAX_STORED_EVENTS = 10_000

/// SQLite-backed event logger for CarPlay and Android Auto connection events.
/// All access is expected from the main thread.
final class CarPlayEventLogger {
    private static let databaseFileName = "expo_carplay_events.db"

    private static var databaseURL: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        return dir.appendingPathComponent(databaseFileName)
    }

    private var db: OpaquePointer?
    private let dbPath: String

    init() {
        let dir = Self.databaseURL.deletingLastPathComponent()
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        dbPath = Self.databaseURL.path
        openDatabase()
        createTableIfNeeded()
    }

    static func destroyPersistentStore() {
        try? FileManager.default.removeItem(at: databaseURL)
    }

    private func openDatabase() {
        guard sqlite3_open(dbPath, &db) == SQLITE_OK else {
            print("[ExpoDetectCarplay] Failed to open event log database")
            db = nil
            return
        }
        // Enable WAL for better concurrent read performance
        sqlite3_exec(db, "PRAGMA journal_mode=WAL", nil, nil, nil)
    }

    private func createTableIfNeeded() {
        let sql = """
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp INTEGER NOT NULL,
                event_type TEXT NOT NULL,
                identifier TEXT,
                data TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_events_ts ON events (timestamp);
            CREATE INDEX IF NOT EXISTS idx_events_type ON events (event_type);
        """
        sqlite3_exec(db, sql, nil, nil, nil)
    }

    func logEvent(eventType: String, identifier: String?, data: [String: Any]) {
        guard let db = db else { return }
        let jsonData = (try? JSONSerialization.data(withJSONObject: data)) ?? Data()
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "{}"
        let timestamp = Int64(Date().timeIntervalSince1970 * 1000)

        let sql = "INSERT INTO events (timestamp, event_type, identifier, data) VALUES (?, ?, ?, ?)"
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
        defer { sqlite3_finalize(stmt) }
        sqlite3_bind_int64(stmt, 1, timestamp)
        sqlite3_bind_text(stmt, 2, (eventType as NSString).utf8String, -1, CARPLAY_SQLITE_TRANSIENT)
        if let id = identifier {
            sqlite3_bind_text(stmt, 3, (id as NSString).utf8String, -1, CARPLAY_SQLITE_TRANSIENT)
        } else {
            sqlite3_bind_null(stmt, 3)
        }
        sqlite3_bind_text(stmt, 4, (jsonString as NSString).utf8String, -1, CARPLAY_SQLITE_TRANSIENT)
        if sqlite3_step(stmt) == SQLITE_DONE {
            // Distance logging can produce a row every scan cycle. Keep the
            // database bounded while retaining the newest events; the primary
            // key makes this pruning query inexpensive.
            let pruneSql = """
                DELETE FROM events
                WHERE id <= (
                    SELECT id FROM events
                    ORDER BY id DESC
                    LIMIT 1 OFFSET \(MAX_STORED_EVENTS)
                )
                """
            sqlite3_exec(db, pruneSql, nil, nil, nil)
        }
    }

    func getEvents(limit: Int = 1000, eventType: String? = nil, sinceTimestamp: Int64? = nil) -> [[String: Any]] {
        guard let db = db else { return [] }

        var clauses: [String] = []
        if eventType != nil { clauses.append("event_type = ?") }
        if sinceTimestamp != nil { clauses.append("timestamp >= ?") }
        let whereClause = clauses.isEmpty ? "" : "WHERE \(clauses.joined(separator: " AND "))"
        let safeLimit = max(1, min(limit, 10000))
        let sql = "SELECT id, timestamp, event_type, identifier, data FROM events \(whereClause) ORDER BY timestamp DESC LIMIT ?"

        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return [] }
        defer { sqlite3_finalize(stmt) }

        var bindIndex: Int32 = 1
        if let et = eventType {
            sqlite3_bind_text(stmt, bindIndex, (et as NSString).utf8String, -1, CARPLAY_SQLITE_TRANSIENT)
            bindIndex += 1
        }
        if let ts = sinceTimestamp {
            sqlite3_bind_int64(stmt, bindIndex, ts)
            bindIndex += 1
        }
        sqlite3_bind_int(stmt, bindIndex, Int32(safeLimit))

        var results: [[String: Any]] = []
        while sqlite3_step(stmt) == SQLITE_ROW {
            let id = sqlite3_column_int64(stmt, 0)
            let ts = sqlite3_column_int64(stmt, 1)
            let evType = String(cString: sqlite3_column_text(stmt, 2))
            let identifier: String? = sqlite3_column_type(stmt, 3) == SQLITE_NULL ? nil : String(cString: sqlite3_column_text(stmt, 3))
            let dataStr = String(cString: sqlite3_column_text(stmt, 4))

            let parsedData: [String: Any]
            if let jsonData = dataStr.data(using: .utf8),
               let obj = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {
                parsedData = obj
            } else {
                parsedData = [:]
            }

            var entry: [String: Any] = [
                "id": id,
                "timestamp": ts,
                "eventType": evType,
                "data": parsedData
            ]
            if let identifier = identifier {
                entry["identifier"] = identifier
            }
            results.append(entry)
        }
        return results
    }

    func clearEvents() {
        guard let db = db else { return }
        sqlite3_exec(db, "DELETE FROM events", nil, nil, nil)
    }

    func destroy() {
        if db != nil {
            sqlite3_close(db)
            db = nil
        }
        Self.destroyPersistentStore()
    }

    deinit {
        if db != nil {
            sqlite3_close(db)
        }
    }
}
