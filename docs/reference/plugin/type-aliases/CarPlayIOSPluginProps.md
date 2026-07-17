[**expo-detect-carplay**](../README.md)

***

[expo-detect-carplay](../README.md) / CarPlayIOSPluginProps

# Type Alias: CarPlayIOSPluginProps

> **CarPlayIOSPluginProps** = `object`

Defined in: [withCarPlayIOS.ts:13](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/plugin/src/withCarPlayIOS.ts#L13)

## Properties

### backgroundGeolocation?

> `optional` **backgroundGeolocation?**: `boolean`

Defined in: [withCarPlayIOS.ts:19](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/plugin/src/withCarPlayIOS.ts#L19)

Generate the optional `react-native-background-geolocation` vehicle
lifecycle bridge. The dependency must be installed in the consuming app.

#### Default Value

```ts
false
```

***

### backgroundLocation?

> `optional` **backgroundLocation?**: `boolean`

Defined in: [withCarPlayIOS.ts:31](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/plugin/src/withCarPlayIOS.ts#L31)

Add background location configuration used to reconcile route changes when
iOS wakes the app for a significant-location or visit event. Default: false.

***

### carplayDrivingTask?

> `optional` **carplayDrivingTask?**: `boolean`

Defined in: [withCarPlayIOS.ts:26](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/plugin/src/withCarPlayIOS.ts#L26)

Enable the Apple-granted CarPlay Driving Task entitlement and scene.
Enable only when the provisioning profile contains the entitlement.
When omitted, existing host configuration is left unchanged. Set `false`
to remove configuration previously owned by this plugin.

***

### locationAlwaysPermission?

> `optional` **locationAlwaysPermission?**: `string`

Defined in: [withCarPlayIOS.ts:35](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/plugin/src/withCarPlayIOS.ts#L35)

Value for `NSLocationAlwaysAndWhenInUseUsageDescription`.

***

### locationWhenInUsePermission?

> `optional` **locationWhenInUsePermission?**: `string`

Defined in: [withCarPlayIOS.ts:33](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/plugin/src/withCarPlayIOS.ts#L33)

Value for `NSLocationWhenInUseUsageDescription`.
