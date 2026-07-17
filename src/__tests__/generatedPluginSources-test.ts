import { getAndroidCarPlayPluginKotlin } from '../../plugin/src/withCarPlayAndroid';
import { getIOSCarPlayPluginSwift } from '../../plugin/src/withCarPlayIOS';

describe('generated CarPlay background-geolocation plugin', () => {
  it('uses the current Android location callback type', () => {
    const source = getAndroidCarPlayPluginKotlin('com.example.app');

    expect(source).toContain('import com.transistorsoft.locationmanager.event.LocationEvent');
    expect(source).toContain('override fun onLocation(event: LocationEvent) = runOnMain {');
    expect(source).not.toContain('import com.transistorsoft.locationmanager.location.TSLocation');
  });

  it('uses the current iOS position-request factory', () => {
    const source = getIOSCarPlayPluginSwift();

    expect(source).toContain('TSCurrentPositionRequest.make(');
    expect(source).toContain('type: .current');
    expect(source).toContain('request.persist = true');
    expect(source).not.toContain('let request = TSCurrentPositionRequest(');
  });
});
