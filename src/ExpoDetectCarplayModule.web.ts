import { registerWebModule, NativeModule } from 'expo';

// ExpoDetectCarplayModule is not available on the web platform.
class ExpoDetectCarplayModule extends NativeModule<{}> {}

export default registerWebModule(ExpoDetectCarplayModule, 'ExpoDetectCarplayModule');
