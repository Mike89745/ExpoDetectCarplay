import ExpoModulesCore
import CoreLocation
import UserNotifications
import UIKit

public class ExpoDetectCarplayModule: Module {
    internal let defaults = UserDefaults(suiteName: CARPLAY_DEFAULTS_SUITE_NAME) ?? .standard
    internal lazy var locationDelegate = CarPlayLocationDelegate(module: self)
    internal lazy var locationManager: CLLocationManager = {
        let manager = CLLocationManager()
        manager.delegate = locationDelegate
        let modes = Bundle.main.object(forInfoDictionaryKey: "UIBackgroundModes") as? [String] ?? []
        if modes.contains("location") {
            manager.allowsBackgroundLocationUpdates = true
            manager.pausesLocationUpdatesAutomatically = false
        }
        return manager
    }()

    private var foregroundObserver: NSObjectProtocol?
    private var permissionCompletions: [(Bool) -> Void] = []
    private var eventLogger: CarPlayEventLogger?
    private var loggingEnabled = false
    private let apiForwarder = CarPlayApiForwarder.shared
    private var isDestroyed = false

    public func definition() -> ModuleDefinition {
        Name("ExpoDetectCarplay")

        Events("onCarPlayConnected", "onCarPlayDisconnected", "onCarPlayError")

        OnCreate {
            self.onMain {
                self.isDestroyed = false
                _ = self.locationManager
                self.migrateLegacyStateIfNeeded()
                if self.defaults.bool(forKey: CARPLAY_MONITORING_ENABLED_KEY) {
                    self.startMonitoringInternal()
                    CarPlayMonitor.shared.reconcileOnProcessStart()
                }
            }
        }

        OnDestroy {
            self.onMain {
                self.isDestroyed = true
                self.permissionCompletions.removeAll()
                self.loggingEnabled = false
                self.eventLogger = nil
                if self.defaults.bool(forKey: CARPLAY_MONITORING_ENABLED_KEY) {
                    CarPlayMonitor.shared.detach(owner: self)
                } else {
                    CarPlayMonitor.shared.stop()
                }
                self.removeForegroundObserver()
                self.locationManager.delegate = nil
            }
        }

        AsyncFunction("startCarPlayMonitoring") { (promise: Promise) in
            self.defaults.set(true, forKey: CARPLAY_MONITORING_ENABLED_KEY)
            self.startMonitoringInternal()
            promise.resolve(nil)
        }.runOnQueue(.main)

        AsyncFunction("stopCarPlayMonitoring") { (promise: Promise) in
            self.defaults.set(false, forKey: CARPLAY_MONITORING_ENABLED_KEY)
            CarPlayMonitor.shared.stop()
            self.stopBackgroundWakes()
            self.removeForegroundObserver()
            promise.resolve(nil)
        }.runOnQueue(.main)

        Function("isCarPlayMonitoringEnabled") { () -> Bool in
            self.defaults.bool(forKey: CARPLAY_MONITORING_ENABLED_KEY)
        }

        Function("getCarPlayConnectionStatus") { () -> [String: Any] in
            self.connectionStatus()
        }

        Function("getCarPlayDiagnostics") { () -> [String: Any] in
            [
                "isCarAppMetadataPresent": true,
                "isCarProviderQueryable": true,
                "lastRawConnectionType": NSNull(),
                "observerActive": self.defaults.bool(forKey: CARPLAY_MONITORING_ENABLED_KEY),
                "serviceAlive": true,
            ]
        }

        Function("setCarPlayNotificationConfig") { (config: [String: Any]) in
            self.saveNotificationConfig(self.normalizeNotificationConfig(config))
        }

        AsyncFunction("requestPermissionsAsync") { (promise: Promise) in
            self.requestPermissions { granted in promise.resolve(granted) }
        }.runOnQueue(.main)

        Function("enableEventLogging") { () -> Void in
            self.onMainSync {
                if self.eventLogger == nil { self.eventLogger = CarPlayEventLogger() }
                self.defaults.set(true, forKey: EVENT_LOGGING_ENABLED_KEY)
                self.loggingEnabled = true
            }
        }

        Function("disableEventLogging") { () -> Void in
            self.onMainSync {
                self.defaults.set(false, forKey: EVENT_LOGGING_ENABLED_KEY)
                self.loggingEnabled = false
            }
        }

        Function("isEventLoggingEnabled") { () -> Bool in
            self.defaults.bool(forKey: EVENT_LOGGING_ENABLED_KEY)
        }

        Function("getEventLogs") { (options: [String: Any]?) -> [[String: Any]] in
            self.onMainSync {
                self.getOrCreateEventLogger().getEvents(
                    limit: options?["limit"] as? Int ?? 1000,
                    eventType: options?["eventType"] as? String,
                    sinceTimestamp: (options?["sinceTimestamp"] as? NSNumber)?.int64Value
                )
            }
        }

        Function("clearEventLogs") { () -> Void in
            self.onMainSync { self.getOrCreateEventLogger().clearEvents() }
        }

        Function("destroyEventLogs") { () -> Void in
            self.onMainSync {
                self.defaults.set(false, forKey: EVENT_LOGGING_ENABLED_KEY)
                self.loggingEnabled = false
                if let logger = self.eventLogger { logger.destroy() }
                else { CarPlayEventLogger.destroyPersistentStore() }
                self.eventLogger = nil
            }
        }

        Function("setApiEndpoint") { (url: String, apiKey: String?, id: String?) -> Void in
            self.apiForwarder.configure(url: url, apiKey: apiKey, id: id)
        }

        Function("getApiEndpoint") { () -> [String: String?] in
            self.apiForwarder.getConfig()
        }
    }

    private func startMonitoringInternal() {
        CarPlayMonitor.shared.start(owner: self, emit: { [weak self] eventName, payload in
            guard let self, !self.isDestroyed else { return false }
            self.sendConnectionEvent(eventName, payload)
            return true
        }, defaults: defaults)
        startBackgroundWakesIfConfigured()
        observeForeground()
    }

    private func sendConnectionEvent(_ eventName: String, _ payload: [String: Any]) {
        if isLoggingEnabled() {
            getOrCreateEventLogger().logEvent(eventType: eventName, identifier: nil, data: payload)
        }
        apiForwarder.forwardEvent(payload, eventType: eventName)
        postNotification(
            eventType: eventName == "onCarPlayConnected" ? "connected" : "disconnected",
            transport: payload["transport"] as? String
        )
        sendEvent(eventName, payload)
    }

    private func connectionStatus() -> [String: Any] {
        let connected = defaults.bool(forKey: CARPLAY_LAST_CONNECTED_KEY)
        var status: [String: Any] = ["connected": connected]
        if connected {
            if let transport = defaults.string(forKey: CARPLAY_LAST_TRANSPORT_KEY) {
                status["transport"] = transport
            }
            if let timestamp = defaults.object(forKey: CARPLAY_LAST_CONNECTED_AT_KEY) as? Double {
                status["timestamp"] = timestamp
                status["timestampIso"] = CarPlayMonitor.isoFormatter.string(
                    from: Date(timeIntervalSince1970: timestamp / 1000.0)
                )
            }
        }
        return status
    }

    private func startBackgroundWakesIfConfigured() {
        let modes = Bundle.main.object(forInfoDictionaryKey: "UIBackgroundModes") as? [String] ?? []
        guard modes.contains("location"), CLLocationManager.significantLocationChangeMonitoringAvailable() else {
            return
        }
        locationManager.startMonitoringSignificantLocationChanges()
        locationManager.startMonitoringVisits()
    }

    private func stopBackgroundWakes() {
        locationManager.stopMonitoringSignificantLocationChanges()
        locationManager.stopMonitoringVisits()
    }

    internal func handleBackgroundWake() {
        if defaults.bool(forKey: CARPLAY_MONITORING_ENABLED_KEY) {
            CarPlayMonitor.shared.resyncIfNeeded()
        }
    }

    private func observeForeground() {
        guard foregroundObserver == nil else { return }
        foregroundObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { _ in CarPlayMonitor.shared.resyncIfNeeded() }
    }

    private func removeForegroundObserver() {
        if let foregroundObserver {
            NotificationCenter.default.removeObserver(foregroundObserver)
            self.foregroundObserver = nil
        }
    }

    private func requestPermissions(completion: @escaping (Bool) -> Void) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
        switch locationManager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse:
            completion(true)
        case .denied, .restricted:
            completion(false)
        case .notDetermined:
            permissionCompletions.append(completion)
            locationManager.requestAlwaysAuthorization()
        @unknown default:
            completion(false)
        }
    }

    internal func handleAuthorizationChange(_ status: CLAuthorizationStatus) {
        guard !permissionCompletions.isEmpty else { return }
        switch status {
        case .authorizedAlways, .authorizedWhenInUse:
            drainPermissionCompletions(true)
        case .denied, .restricted:
            drainPermissionCompletions(false)
        default:
            break
        }
    }

    private func drainPermissionCompletions(_ granted: Bool) {
        let completions = permissionCompletions
        permissionCompletions.removeAll()
        completions.forEach { $0(granted) }
    }

    private func notificationConfig() -> [String: Any] {
        guard let json = defaults.string(forKey: NOTIFICATION_CONFIG_KEY),
              let data = json.data(using: .utf8),
              let config = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return [:]
        }
        return config
    }

    private func saveNotificationConfig(_ config: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: config),
              let json = String(data: data, encoding: .utf8) else { return }
        defaults.set(json, forKey: NOTIFICATION_CONFIG_KEY)
    }

    private func normalizeNotificationConfig(_ config: [String: Any]) -> [String: Any] {
        if config.keys.contains(where: { ["events", "foregroundService", "channel"].contains($0) }) {
            return config
        }
        return ["events": config]
    }

    private func postNotification(eventType: String, transport: String?) {
        let events = notificationConfig()["events"] as? [String: Any]
        if events?["enabled"] as? Bool == false { return }
        let defaultTitle = eventType == "connected" ? "CarPlay Connected" : "CarPlay Disconnected"
        let configuredTitleKey = eventType == "connected" ? "connectedTitle" : "disconnectedTitle"
        let title = (events?[configuredTitleKey] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? defaultTitle
        let bodyTemplate = (events?["body"] as? String).flatMap { $0.isEmpty ? nil : $0 }
            ?? "CarPlay session {event}"
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = bodyTemplate
            .replacingOccurrences(of: "{event}", with: eventType)
            .replacingOccurrences(of: "{transport}", with: transport ?? "")
        if events?["sound"] as? Bool ?? true { content.sound = .default }
        let request = UNNotificationRequest(
            identifier: "carplay_\(eventType)_\(Date().timeIntervalSince1970)",
            content: content,
            trigger: nil
        )
        UNUserNotificationCenter.current().add(request, withCompletionHandler: nil)
    }

    private func getOrCreateEventLogger() -> CarPlayEventLogger {
        if let eventLogger { return eventLogger }
        let logger = CarPlayEventLogger()
        eventLogger = logger
        return logger
    }

    private func isLoggingEnabled() -> Bool {
        if loggingEnabled { return true }
        if defaults.bool(forKey: EVENT_LOGGING_ENABLED_KEY) {
            loggingEnabled = true
            return true
        }
        return false
    }

    private func migrateLegacyStateIfNeeded() {
        guard !defaults.bool(forKey: CARPLAY_MIGRATION_KEY) else { return }
        let legacy = UserDefaults(suiteName: LEGACY_BEACON_DEFAULTS_SUITE_NAME) ?? .standard
        let mappings = [
            ("expo.beacon.carplay_monitoring_enabled", CARPLAY_MONITORING_ENABLED_KEY),
            ("expo.beacon.carplay_last_connected", CARPLAY_LAST_CONNECTED_KEY),
            ("expo.beacon.carplay_last_transport", CARPLAY_LAST_TRANSPORT_KEY),
            ("expo.beacon.carplay_last_connected_at", CARPLAY_LAST_CONNECTED_AT_KEY),
            ("expo.beacon.event_logging_enabled", EVENT_LOGGING_ENABLED_KEY),
            ("expo.beacon.api_url", API_URL_KEY),
            ("expo.beacon.api_key", API_KEY_KEY),
            ("expo.beacon.id", API_ID_KEY),
        ]
        for (oldKey, newKey) in mappings where defaults.object(forKey: newKey) == nil {
            if let value = legacy.object(forKey: oldKey) { defaults.set(value, forKey: newKey) }
        }
        if defaults.object(forKey: NOTIFICATION_CONFIG_KEY) == nil,
           let json = legacy.string(forKey: "expo.beacon.notification_config"),
           let data = json.data(using: .utf8),
           let oldConfig = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if let carPlay = oldConfig["carPlay"] as? [String: Any] {
                saveNotificationConfig(carPlay)
            } else if let events = oldConfig["carPlayEvents"] as? [String: Any] {
                saveNotificationConfig(["events": events])
            }
        }
        defaults.set(true, forKey: CARPLAY_MIGRATION_KEY)
    }

    private func onMain(_ block: @escaping () -> Void) {
        if Thread.isMainThread { block() }
        else { DispatchQueue.main.async(execute: block) }
    }

    private func onMainSync<T>(_ block: () throws -> T) rethrows -> T {
        if Thread.isMainThread { return try block() }
        return try DispatchQueue.main.sync(execute: block)
    }
}
