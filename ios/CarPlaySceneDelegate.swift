import Foundation
import UIKit
import CarPlay
import os.log

/// CarPlay scene delegate used when the consumer app is provisioned with the
/// `com.apple.developer.carplay-driving-task` entitlement (driver / fleet
/// workflow apps).
///
/// Wiring is performed by the config plugin (`carplayDrivingTask: true`):
///   1. The entitlement is added to the app's `*.entitlements`.
///   2. `Info.plist` `UIApplicationSceneManifest` declares a
///      `CPTemplateApplicationSceneSessionRoleApplication` configuration with
///      `UISceneDelegateClassName = "ExpoDetectCarplay.CarPlaySceneDelegate"`.
///
/// When CarPlay attaches, iOS launches (or wakes) the app and instantiates this
/// delegate. We notify the shared `CarPlayMonitor` which produces an
/// `onCarPlayConnected` event through the standard pipeline (JS bridge,
/// SQLite log, HTTP forwarder, lifecycle plugin registry).
///
/// Apple requires that a CarPlay-entitled app present a meaningful CarPlay UI.
/// We install a minimal `CPInformationTemplate` titled "Driver tracking active"
/// as the root template so the app passes review without forcing every consumer
/// to build a full CarPlay UX. Consumers that need richer UI can subclass this
/// delegate (or replace the scene class) and override `makeRootTemplate()`.
///
/// IMPORTANT: Do not give this class a custom bare `@objc` name. The config
/// plugin references the Swift runtime name
/// `ExpoDetectCarplay.CarPlaySceneDelegate` from Info.plist.
open class CarPlaySceneDelegate: NSObject, CPTemplateApplicationSceneDelegate {

    private static let log = OSLog(subsystem: "expo.modules.detectcarplay", category: "CarPlayScene")

    private var interfaceController: CPInterfaceController?

    public override init() {
        super.init()
    }

    // MARK: - CPTemplateApplicationSceneDelegate

    public func templateApplicationScene(
        _ templateApplicationScene: CPTemplateApplicationScene,
        didConnect interfaceController: CPInterfaceController
    ) {
        os_log("CarPlay templateApplicationScene didConnect", log: Self.log, type: .info)
        self.interfaceController = interfaceController
        let template = makeRootTemplate()
        interfaceController.setRootTemplate(template, animated: false, completion: nil)
        CarPlayMonitor.shared.notifyEntitledConnect()
    }

    public func templateApplicationScene(
        _ templateApplicationScene: CPTemplateApplicationScene,
        didDisconnectInterfaceController interfaceController: CPInterfaceController
    ) {
        os_log("CarPlay templateApplicationScene didDisconnect", log: Self.log, type: .info)
        self.interfaceController = nil
        CarPlayMonitor.shared.notifyEntitledDisconnect()
    }

    // MARK: - Override hooks

    /// Build the root template shown when CarPlay attaches. Override in a
    /// consumer subclass to install a richer template (e.g. `CPListTemplate`,
    /// `CPMapTemplate`, `CPNowPlayingTemplate`). Default is a minimal
    /// `CPInformationTemplate` confirming the app is tracking.
    open func makeRootTemplate() -> CPTemplate {
        let item = CPInformationItem(title: "Status", detail: "Tracking active")
        return CPInformationTemplate(
            title: "Driver tracking",
            layout: .leading,
            items: [item],
            actions: []
        )
    }
}
