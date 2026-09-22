import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function read(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('virtual connected-car E2E driver', () => {
  it('is installed on both native platforms behind the example opt-in flag', () => {
    const android = read(
      'android/src/main/java/expo/modules/detectcarplay/ExpoDetectCarplayModule.kt'
    );
    const ios = read('ios/ExpoDetectCarplayModule.swift');
    const examplePlugin = read('example/plugins/withVirtualCarPlayTesting.js');

    expect(android).toContain('Function("__e2eEmitVirtualCarPlayEvent")');
    expect(android).toContain('Function("__e2eEmitVirtualCarPlayError")');
    expect(android).toContain('expo.modules.detectcarplay.VIRTUAL_TESTING_ENABLED');
    expect(ios).toContain('Function("__e2eEmitVirtualCarPlayEvent")');
    expect(ios).toContain('Function("__e2eEmitVirtualCarPlayError")');
    expect(ios).toContain('ExpoDetectCarPlayVirtualTestingEnabled');
    expect(examplePlugin).toContain('expo.modules.detectcarplay.VIRTUAL_TESTING_ENABLED');
    expect(examplePlugin).toContain('ExpoDetectCarPlayVirtualTestingEnabled');
    expect(examplePlugin).toContain('android:usesCleartextTraffic');
    expect(examplePlugin).toContain('NSAllowsLocalNetworking');
  });

  it('does not add the test seam to the public TypeScript contract', () => {
    expect(read('src/ExpoDetectCarplayModule.ts')).not.toContain('__e2eEmitVirtualCarPlayEvent');
    expect(read('src/ExpoDetectCarplayModule.ts')).not.toContain('__e2eEmitVirtualCarPlayError');
  });
});
