[**expo-detect-carplay**](../README.md)

***

[expo-detect-carplay](../README.md) / UseCarPlayResult

# Interface: UseCarPlayResult

Defined in: [src/hooks/useCarPlay.ts:20](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/src/hooks/useCarPlay.ts#L20)

## Properties

### connected

> **connected**: `boolean`

Defined in: [src/hooks/useCarPlay.ts:21](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/src/hooks/useCarPlay.ts#L21)

***

### getDiagnostics

> **getDiagnostics**: () => [`CarPlayDiagnostics`](../type-aliases/CarPlayDiagnostics.md)

Defined in: [src/hooks/useCarPlay.ts:29](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/src/hooks/useCarPlay.ts#L29)

#### Returns

[`CarPlayDiagnostics`](../type-aliases/CarPlayDiagnostics.md)

***

### isMonitoring

> **isMonitoring**: `boolean`

Defined in: [src/hooks/useCarPlay.ts:23](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/src/hooks/useCarPlay.ts#L23)

***

### lastConnectedAt

> **lastConnectedAt**: `number` \| `null`

Defined in: [src/hooks/useCarPlay.ts:24](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/src/hooks/useCarPlay.ts#L24)

***

### lastDisconnectedAt

> **lastDisconnectedAt**: `number` \| `null`

Defined in: [src/hooks/useCarPlay.ts:25](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/src/hooks/useCarPlay.ts#L25)

***

### refresh

> **refresh**: () => `void`

Defined in: [src/hooks/useCarPlay.ts:28](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/src/hooks/useCarPlay.ts#L28)

#### Returns

`void`

***

### setCarPlayNotificationConfig

> **setCarPlayNotificationConfig**: (`config`) => `void`

Defined in: [src/hooks/useCarPlay.ts:30](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/src/hooks/useCarPlay.ts#L30)

#### Parameters

##### config

[`CarPlayNotificationConfig`](../type-aliases/CarPlayNotificationConfig.md) \| [`CarPlayNotificationSettings`](../type-aliases/CarPlayNotificationSettings.md)

#### Returns

`void`

***

### startMonitoring

> **startMonitoring**: () => `Promise`\<`void`\>

Defined in: [src/hooks/useCarPlay.ts:26](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/src/hooks/useCarPlay.ts#L26)

#### Returns

`Promise`\<`void`\>

***

### stopMonitoring

> **stopMonitoring**: () => `Promise`\<`void`\>

Defined in: [src/hooks/useCarPlay.ts:27](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/src/hooks/useCarPlay.ts#L27)

#### Returns

`Promise`\<`void`\>

***

### transport

> **transport**: [`CarPlayTransport`](../type-aliases/CarPlayTransport.md) \| `null`

Defined in: [src/hooks/useCarPlay.ts:22](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/src/hooks/useCarPlay.ts#L22)
