package expo.modules.detectcarplay

interface CarPlayEventPlugin {
    fun onCarPlayConnected(transport: String) {}
    fun onCarPlayDisconnected() {}
}
