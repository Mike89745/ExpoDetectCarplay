import fs from 'fs';
import path from 'path';

const serviceSource = fs
  .readFileSync(
    path.resolve(
      __dirname,
      '../../android/src/main/java/expo/modules/detectcarplay/CarPlayForegroundService.kt'
    ),
    'utf8'
  )
  .replace(/\r\n/g, '\n');
const moduleSource = fs
  .readFileSync(
    path.resolve(
      __dirname,
      '../../android/src/main/java/expo/modules/detectcarplay/ExpoDetectCarplayModule.kt'
    ),
    'utf8'
  )
  .replace(/\r\n/g, '\n');

function sourceBetween(start: string, end: string): string {
  const startIndex = serviceSource.indexOf(start);
  const endIndex = serviceSource.indexOf(end, startIndex + start.length);

  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return serviceSource.slice(startIndex, endIndex);
}

describe('Android foreground service lifecycle', () => {
  it('promotes a pending service before honoring a rapid stop', () => {
    const startCommand = sourceBetween(
      'override fun onStartCommand',
      'private fun enterForeground'
    );
    const disableFunction = sourceBetween('fun disable(context: Context)', 'fun bindModule');

    expect(serviceSource).toContain('@Volatile private var foregroundStarted = false');
    expect(startCommand.indexOf('enterForeground()')).toBeLessThan(
      startCommand.indexOf('if (!isEnabled(this))')
    );
    expect(serviceSource.indexOf('foregroundStarted = true')).toBeGreaterThan(
      serviceSource.indexOf('startForeground(')
    );
    expect(disableFunction).toContain('if (service == null || !service.foregroundStarted)');
    expect(disableFunction.indexOf('!service.foregroundStarted')).toBeLessThan(
      disableFunction.indexOf('appContext.stopService')
    );
  });

  it('restores desired monitoring when the application process is relaunched', () => {
    const onCreate = moduleSource.slice(
      moduleSource.indexOf('OnCreate {'),
      moduleSource.indexOf('OnDestroy {')
    );
    expect(onCreate).toContain('CarPlayForegroundService.isEnabled(context)');
    expect(onCreate).toContain('CarPlayForegroundService.enable(context)');
    expect(onCreate).toContain('CarPlayForegroundService.bindModule(this@ExpoDetectCarplayModule)');
  });
});
