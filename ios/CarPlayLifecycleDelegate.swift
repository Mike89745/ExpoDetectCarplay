import Foundation

public protocol CarPlayLifecycleDelegate: AnyObject {
    func carPlayDidConnect(transport: String)
    func carPlayDidDisconnect()
}

public extension CarPlayLifecycleDelegate {
    func carPlayDidConnect(transport: String) {}
    func carPlayDidDisconnect() {}
}

public final class CarPlayLifecycleRegistry {
    public static let shared = CarPlayLifecycleRegistry()

    private let lock = NSLock()
    private var delegates: [any CarPlayLifecycleDelegate] = []
    private var connectedTransport: String?

    private init() {}

    public static func register(_ delegate: any CarPlayLifecycleDelegate) {
        shared.register(delegate)
    }

    public static func unregister(_ delegate: any CarPlayLifecycleDelegate) {
        shared.unregister(delegate)
    }

    public func register(_ delegate: any CarPlayLifecycleDelegate) {
        lock.lock()
        if delegates.contains(where: { $0 === delegate }) {
            lock.unlock()
            return
        }
        delegates.append(delegate)
        let transport = connectedTransport
        lock.unlock()
        if let transport { delegate.carPlayDidConnect(transport: transport) }
    }

    public func unregister(_ delegate: any CarPlayLifecycleDelegate) {
        lock.lock()
        delegates.removeAll { $0 === delegate }
        lock.unlock()
    }

    internal func dispatchCarPlayConnect(transport: String) {
        lock.lock()
        connectedTransport = transport
        let snapshot = delegates
        lock.unlock()
        snapshot.forEach { $0.carPlayDidConnect(transport: transport) }
    }

    internal func dispatchCarPlayDisconnect() {
        lock.lock()
        connectedTransport = nil
        let snapshot = delegates
        lock.unlock()
        snapshot.forEach { $0.carPlayDidDisconnect() }
    }
}
