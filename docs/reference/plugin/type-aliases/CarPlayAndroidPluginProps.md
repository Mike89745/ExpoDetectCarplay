[**expo-detect-carplay**](../README.md)

***

[expo-detect-carplay](../README.md) / CarPlayAndroidPluginProps

# Type Alias: CarPlayAndroidPluginProps

> **CarPlayAndroidPluginProps** = `object`

Defined in: [withCarPlayAndroid.ts:14](https://github.com/Mike89745/ExpoDetectCarplay/blob/737c91cdcc1fd580257efa4ccfbdc66fc6fc2046/plugin/src/withCarPlayAndroid.ts#L14)

## Properties

### androidAuto?

> `optional` **androidAuto?**: `object`

Defined in: [withCarPlayAndroid.ts:22](https://github.com/Mike89745/ExpoDetectCarplay/blob/737c91cdcc1fd580257efa4ccfbdc66fc6fc2046/plugin/src/withCarPlayAndroid.ts#L22)

Android Auto application registration settings.

#### register?

> `optional` **register?**: `boolean`

Register the host as Android-Auto-aware.

##### Default Value

```ts
true
```

#### usesName?

> `optional` **usesName?**: [`AndroidAutoUsesName`](AndroidAutoUsesName.md)

Automotive application category.

##### Default Value

```ts
'template'
```

***

### backgroundGeolocation?

> `optional` **backgroundGeolocation?**: `boolean`

Defined in: [withCarPlayAndroid.ts:20](https://github.com/Mike89745/ExpoDetectCarplay/blob/737c91cdcc1fd580257efa4ccfbdc66fc6fc2046/plugin/src/withCarPlayAndroid.ts#L20)

Generate the optional `react-native-background-geolocation` vehicle
lifecycle bridge. The dependency must be installed in the consuming app.

#### Default Value

```ts
false
```
