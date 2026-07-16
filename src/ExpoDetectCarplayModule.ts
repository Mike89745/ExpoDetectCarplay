import { NativeModule, requireNativeModule } from 'expo';

declare class ExpoDetectCarplayModule extends NativeModule<{}> {}

export default requireNativeModule<ExpoDetectCarplayModule>('ExpoDetectCarplay');
