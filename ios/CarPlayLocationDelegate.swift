import CoreLocation

internal final class CarPlayLocationDelegate: NSObject, CLLocationManagerDelegate {
    private weak var module: ExpoDetectCarplayModule?

    init(module: ExpoDetectCarplayModule) {
        self.module = module
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        module?.handleAuthorizationChange(manager.authorizationStatus)
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        module?.handleBackgroundWake()
    }

    func locationManager(_ manager: CLLocationManager, didVisit visit: CLVisit) {
        module?.handleBackgroundWake()
    }
}
