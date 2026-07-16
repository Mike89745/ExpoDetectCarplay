import Foundation
import os.log

private let MAX_RETRIES = 3
private let MAX_QUEUED_EVENTS = 200

/// Native event forwarder with a bounded, disk-backed outbox. Events are sent
/// serially to avoid retry storms. Connection lifecycle events retain retry
/// semantics and are persisted until delivery or terminal failure.
final class CarPlayApiForwarder {
    static let shared = CarPlayApiForwarder(
        defaults: UserDefaults(suiteName: CARPLAY_DEFAULTS_SUITE_NAME) ?? .standard
    )

    private struct QueuedEvent: Codable {
        let id: String
        let url: String
        let apiKey: String?
        let eventType: String
        let coalescingKey: String?
        let body: Data
    }

    private let defaults: UserDefaults
    private let session: URLSession
    private let stateQueue = DispatchQueue(label: "expo.modules.detectcarplay.api-forwarder", qos: .utility)
    private var pending: [QueuedEvent] = []
    private var inFlight = false

    private static var outboxURL: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        return base
            .appendingPathComponent("ExpoDetectCarplay", isDirectory: true)
            .appendingPathComponent("api-outbox.json", isDirectory: false)
    }

    private init(defaults: UserDefaults) {
        self.defaults = defaults
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 10
        config.timeoutIntervalForResource = 30
        config.waitsForConnectivity = true
        self.session = URLSession(configuration: config)

        if let data = try? Data(contentsOf: Self.outboxURL),
           let restored = try? JSONDecoder().decode([QueuedEvent].self, from: data) {
            self.pending = Array(restored.prefix(MAX_QUEUED_EVENTS))
        }
        stateQueue.async { [weak self] in self?.processNextIfNeeded() }
    }

    func configure(url: String, apiKey: String?, id: String? = nil) {
        defaults.set(url, forKey: API_URL_KEY)
        if let key = apiKey {
            defaults.set(key, forKey: API_KEY_KEY)
        } else {
            defaults.removeObject(forKey: API_KEY_KEY)
        }
        if let id = id {
            defaults.set(id, forKey: API_ID_KEY)
        } else {
            defaults.removeObject(forKey: API_ID_KEY)
        }
    }

    func getConfig() -> [String: String?] {
        return [
            "url": defaults.string(forKey: API_URL_KEY),
            "apiKey": defaults.string(forKey: API_KEY_KEY),
            "id": defaults.string(forKey: API_ID_KEY)
        ]
    }

    func forwardEvent(_ params: [String: Any], eventType: String) {
        guard let urlString = defaults.string(forKey: API_URL_KEY),
              !urlString.isEmpty,
              let url = URL(string: urlString),
              let scheme = url.scheme?.lowercased(),
              scheme == "https" || scheme == "http" else { return }

        var payload = params
        payload["eventType"] = eventType
        if let id = defaults.string(forKey: API_ID_KEY), !id.isEmpty {
            payload["id"] = id
        }
        payload["timestamp"] = Int64(Date().timeIntervalSince1970 * 1000)
        payload["platform"] = "ios"
        payload["sdkVersion"] = ProcessInfo.processInfo.operatingSystemVersion.majorVersion

        guard let body = try? JSONSerialization.data(withJSONObject: payload) else {
            os_log(.error, "CarPlayApiForwarder: failed to serialize %{public}@", eventType)
            return
        }

        let queued = QueuedEvent(
            id: UUID().uuidString,
            url: url.absoluteString,
            apiKey: defaults.string(forKey: API_KEY_KEY),
            eventType: eventType,
            coalescingKey: Self.coalescingKey(eventType: eventType, params: params),
            body: body
        )
        stateQueue.async { [weak self] in self?.enqueue(queued) }
    }

    private static func coalescingKey(eventType: String, params: [String: Any]) -> String? {
        let coalescedTypes: Set<String> = []
        guard coalescedTypes.contains(eventType) else { return nil }
        if let identifier = params["identifier"] as? String, !identifier.isEmpty {
            return "\(eventType):\(identifier)"
        }
        if let namespace = params["namespace"] as? String,
           let instance = params["instance"] as? String {
            return "\(eventType):\(namespace):\(instance)"
        }
        if let url = params["url"] as? String {
            return "\(eventType):\(url)"
        }
        if let uuid = params["uuid"] as? String {
            let major = (params["major"] as? NSNumber)?.intValue ?? -1
            let minor = (params["minor"] as? NSNumber)?.intValue ?? -1
            return "\(eventType):\(uuid):\(major):\(minor)"
        }
        return eventType
    }

    private func enqueue(_ event: QueuedEvent) {
        let replaceStartIndex = inFlight ? 1 : 0
        if let key = event.coalescingKey,
           replaceStartIndex < pending.count,
           let index = pending.indices.dropFirst(replaceStartIndex).last(where: {
               pending[$0].coalescingKey == key
           }) {
            pending[index] = event
        } else {
            pending.append(event)
        }

        while pending.count > MAX_QUEUED_EVENTS {
            let removableStart = inFlight ? 1 : 0
            if removableStart < pending.count,
               let coalescedIndex = pending.indices.dropFirst(removableStart).first(where: {
                   pending[$0].coalescingKey != nil
               }) {
                pending.remove(at: coalescedIndex)
            } else if inFlight && pending.count > 1 {
                pending.remove(at: 1)
            } else {
                pending.removeFirst()
            }
        }
        persistOutbox()
        processNextIfNeeded()
    }

    private func processNextIfNeeded() {
        guard !inFlight, let event = pending.first else { return }
        guard let url = URL(string: event.url) else {
            pending.removeFirst()
            persistOutbox()
            processNextIfNeeded()
            return
        }
        inFlight = true
        send(event, to: url, attempt: 1)
    }

    private func send(_ event: QueuedEvent, to url: URL, attempt: Int) {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let key = event.apiKey {
            request.setValue(key, forHTTPHeaderField: "X-CSFR-Token")
        }
        request.httpBody = event.body

        session.dataTask(with: request) { [weak self] _, response, error in
            guard let self else { return }
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0
            self.stateQueue.async {
                guard self.pending.first?.id == event.id else {
                    self.inFlight = false
                    self.processNextIfNeeded()
                    return
                }
                if (200..<300).contains(statusCode) || (400..<500).contains(statusCode) {
                    if (400..<500).contains(statusCode) {
                        os_log(.error, "CarPlayApiForwarder: HTTP %{public}d; dropping %{public}@", statusCode, event.eventType)
                    }
                    self.finish(event)
                    return
                }

                let maxAttempts = event.coalescingKey == nil ? MAX_RETRIES : 1
                guard attempt < maxAttempts else {
                    let message = error?.localizedDescription ?? "HTTP \(statusCode)"
                    os_log(.error, "CarPlayApiForwarder: dropping %{public}@ after %d attempt(s): %{public}@", event.eventType, maxAttempts, message)
                    self.finish(event)
                    return
                }
                let delay = pow(2.0, Double(attempt - 1))
                self.stateQueue.asyncAfter(deadline: .now() + delay) {
                    self.send(event, to: url, attempt: attempt + 1)
                }
            }
        }.resume()
    }

    private func finish(_ event: QueuedEvent) {
        if pending.first?.id == event.id { pending.removeFirst() }
        inFlight = false
        persistOutbox()
        processNextIfNeeded()
    }

    private func persistOutbox() {
        let url = Self.outboxURL
        if pending.isEmpty {
            try? FileManager.default.removeItem(at: url)
            return
        }
        do {
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            let data = try JSONEncoder().encode(pending)
            try data.write(to: url, options: .atomic)
            try? FileManager.default.setAttributes(
                [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
                ofItemAtPath: url.path
            )
        } catch {
            os_log(.error, "CarPlayApiForwarder: failed to persist outbox: %{public}@", error.localizedDescription)
        }
    }
}
