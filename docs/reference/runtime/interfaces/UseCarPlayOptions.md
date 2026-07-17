[**expo-detect-carplay**](../README.md)

***

[expo-detect-carplay](../README.md) / UseCarPlayOptions

# Interface: UseCarPlayOptions

Defined in: [src/hooks/useCarPlay.ts:13](https://github.com/Mike89745/ExpoDetectCarplay/blob/737c91cdcc1fd580257efa4ccfbdc66fc6fc2046/src/hooks/useCarPlay.ts#L13)

## Properties

### autoStart?

> `optional` **autoStart?**: `boolean`

Defined in: [src/hooks/useCarPlay.ts:17](https://github.com/Mike89745/ExpoDetectCarplay/blob/737c91cdcc1fd580257efa4ccfbdc66fc6fc2046/src/hooks/useCarPlay.ts#L17)

Start persistent observation on mount. Default: `false`.

***

### onConnected?

> `optional` **onConnected?**: (`event`) => `void`

Defined in: [src/hooks/useCarPlay.ts:14](https://github.com/Mike89745/ExpoDetectCarplay/blob/737c91cdcc1fd580257efa4ccfbdc66fc6fc2046/src/hooks/useCarPlay.ts#L14)

#### Parameters

##### event

[`CarPlayConnectedEvent`](../type-aliases/CarPlayConnectedEvent.md)

#### Returns

`void`

***

### onDisconnected?

> `optional` **onDisconnected?**: (`event`) => `void`

Defined in: [src/hooks/useCarPlay.ts:15](https://github.com/Mike89745/ExpoDetectCarplay/blob/737c91cdcc1fd580257efa4ccfbdc66fc6fc2046/src/hooks/useCarPlay.ts#L15)

#### Parameters

##### event

[`CarPlayDisconnectedEvent`](../type-aliases/CarPlayDisconnectedEvent.md)

#### Returns

`void`
