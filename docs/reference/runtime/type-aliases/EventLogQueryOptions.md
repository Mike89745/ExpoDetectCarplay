[**expo-detect-carplay**](../README.md)

***

[expo-detect-carplay](../README.md) / EventLogQueryOptions

# Type Alias: EventLogQueryOptions

> **EventLogQueryOptions** = `object`

Defined in: [src/ExpoDetectCarplay.types.ts:80](https://github.com/Mike89745/ExpoDetectCarplay/blob/737c91cdcc1fd580257efa4ccfbdc66fc6fc2046/src/ExpoDetectCarplay.types.ts#L80)

## Properties

### eventType?

> `optional` **eventType?**: [`CarPlayEventName`](CarPlayEventName.md)

Defined in: [src/ExpoDetectCarplay.types.ts:84](https://github.com/Mike89745/ExpoDetectCarplay/blob/737c91cdcc1fd580257efa4ccfbdc66fc6fc2046/src/ExpoDetectCarplay.types.ts#L84)

Filter by an emitted event name.

***

### limit?

> `optional` **limit?**: `number`

Defined in: [src/ExpoDetectCarplay.types.ts:82](https://github.com/Mike89745/ExpoDetectCarplay/blob/737c91cdcc1fd580257efa4ccfbdc66fc6fc2046/src/ExpoDetectCarplay.types.ts#L82)

Maximum entries to return.

#### Default Value

```ts
1000
```

***

### sinceTimestamp?

> `optional` **sinceTimestamp?**: `number`

Defined in: [src/ExpoDetectCarplay.types.ts:86](https://github.com/Mike89745/ExpoDetectCarplay/blob/737c91cdcc1fd580257efa4ccfbdc66fc6fc2046/src/ExpoDetectCarplay.types.ts#L86)

Return entries at or after this Unix epoch timestamp in milliseconds.
