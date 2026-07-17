[**expo-detect-carplay**](../README.md)

***

[expo-detect-carplay](../README.md) / CarPlayDisconnectedEvent

# Type Alias: CarPlayDisconnectedEvent

> **CarPlayDisconnectedEvent** = `object`

Defined in: [src/ExpoDetectCarplay.types.ts:42](https://github.com/Mike89745/ExpoDetectCarplay/blob/737c91cdcc1fd580257efa4ccfbdc66fc6fc2046/src/ExpoDetectCarplay.types.ts#L42)

## Properties

### reason?

> `optional` **reason?**: `"reconciled"`

Defined in: [src/ExpoDetectCarplay.types.ts:48](https://github.com/Mike89745/ExpoDetectCarplay/blob/737c91cdcc1fd580257efa4ccfbdc66fc6fc2046/src/ExpoDetectCarplay.types.ts#L48)

Set when persisted state was corrected after process startup.

***

### timestamp

> **timestamp**: `number`

Defined in: [src/ExpoDetectCarplay.types.ts:44](https://github.com/Mike89745/ExpoDetectCarplay/blob/737c91cdcc1fd580257efa4ccfbdc66fc6fc2046/src/ExpoDetectCarplay.types.ts#L44)

Milliseconds since the Unix epoch.

***

### timestampIso?

> `optional` **timestampIso?**: `string`

Defined in: [src/ExpoDetectCarplay.types.ts:46](https://github.com/Mike89745/ExpoDetectCarplay/blob/737c91cdcc1fd580257efa4ccfbdc66fc6fc2046/src/ExpoDetectCarplay.types.ts#L46)

ISO-8601 representation of `timestamp`, when supplied by the platform.
