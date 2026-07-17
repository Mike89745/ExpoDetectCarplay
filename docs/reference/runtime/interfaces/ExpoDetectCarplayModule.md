[**expo-detect-carplay**](../README.md)

***

[expo-detect-carplay](../README.md) / ExpoDetectCarplayModule

# Interface: ExpoDetectCarplayModule

Defined in: [src/ExpoDetectCarplayModule.ts:13](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/src/ExpoDetectCarplayModule.ts#L13)

## Extends

- `NativeModule`\<[`ExpoDetectCarplayModuleEvents`](../type-aliases/ExpoDetectCarplayModuleEvents.md)\>

## Methods

### addListener()

> **addListener**\<`EventName`\>(`eventName`, `listener`): `EventSubscription`

Defined in: node\_modules/expo/node\_modules/expo-modules-core/build/ts-declarations/EventEmitter.d.ts:44

Adds a listener for the given event name.

#### Type Parameters

##### EventName

`EventName` *extends* keyof [`ExpoDetectCarplayModuleEvents`](../type-aliases/ExpoDetectCarplayModuleEvents.md)

#### Parameters

##### eventName

`EventName`

##### listener

[`ExpoDetectCarplayModuleEvents`](../type-aliases/ExpoDetectCarplayModuleEvents.md)\[`EventName`\]

#### Returns

`EventSubscription`

#### Inherited from

`NativeModule.addListener`

***

### clearEventLogs()

> **clearEventLogs**(): `void`

Defined in: [src/ExpoDetectCarplayModule.ts:46](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/src/ExpoDetectCarplayModule.ts#L46)

Delete all event-log entries without disabling logging.

#### Returns

`void`

***

### destroyEventLogs()

> **destroyEventLogs**(): `void`

Defined in: [src/ExpoDetectCarplayModule.ts:48](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/src/ExpoDetectCarplayModule.ts#L48)

Delete the event-log database and disable logging.

#### Returns

`void`

***

### disableEventLogging()

> **disableEventLogging**(): `void`

Defined in: [src/ExpoDetectCarplayModule.ts:40](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/src/ExpoDetectCarplayModule.ts#L40)

Disable logging without deleting existing entries.

#### Returns

`void`

***

### emit()

> **emit**\<`EventName`\>(`eventName`, ...`args`): `void`

Defined in: node\_modules/expo/node\_modules/expo-modules-core/build/ts-declarations/EventEmitter.d.ts:57

Synchronously calls all the listeners attached to that specific event.
The event can include any number of arguments that will be passed to the listeners.

#### Type Parameters

##### EventName

`EventName` *extends* keyof [`ExpoDetectCarplayModuleEvents`](../type-aliases/ExpoDetectCarplayModuleEvents.md)

#### Parameters

##### eventName

`EventName`

##### args

...`Parameters`\<[`ExpoDetectCarplayModuleEvents`](../type-aliases/ExpoDetectCarplayModuleEvents.md)\[`EventName`\]\>

#### Returns

`void`

#### Inherited from

`NativeModule.emit`

***

### enableEventLogging()

> **enableEventLogging**(): `void`

Defined in: [src/ExpoDetectCarplayModule.ts:38](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/src/ExpoDetectCarplayModule.ts#L38)

Enable persistent SQLite event logging.

#### Returns

`void`

***

### getApiEndpoint()

> **getApiEndpoint**(): `object`

Defined in: [src/ExpoDetectCarplayModule.ts:52](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/src/ExpoDetectCarplayModule.ts#L52)

Return the persisted native event-forwarding configuration.

#### Returns

`object`

##### apiKey

> **apiKey**: `string` \| `null`

##### id

> **id**: `string` \| `null`

##### url

> **url**: `string` \| `null`

***

### getCarPlayConnectionStatus()

> **getCarPlayConnectionStatus**(): [`CarPlayConnectionStatus`](../type-aliases/CarPlayConnectionStatus.md)

Defined in: [src/ExpoDetectCarplayModule.ts:21](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/src/ExpoDetectCarplayModule.ts#L21)

Return the most recent native connection snapshot.

#### Returns

[`CarPlayConnectionStatus`](../type-aliases/CarPlayConnectionStatus.md)

***

### getCarPlayDiagnostics()

> **getCarPlayDiagnostics**(): [`CarPlayDiagnostics`](../type-aliases/CarPlayDiagnostics.md)

Defined in: [src/ExpoDetectCarplayModule.ts:23](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/src/ExpoDetectCarplayModule.ts#L23)

Return platform-specific observer and service diagnostics.

#### Returns

[`CarPlayDiagnostics`](../type-aliases/CarPlayDiagnostics.md)

***

### getEventLogs()

> **getEventLogs**(`options?`): [`EventLogEntry`](../type-aliases/EventLogEntry.md)[]

Defined in: [src/ExpoDetectCarplayModule.ts:44](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/src/ExpoDetectCarplayModule.ts#L44)

Read persisted connection and error events.

#### Parameters

##### options?

[`EventLogQueryOptions`](../type-aliases/EventLogQueryOptions.md)

#### Returns

[`EventLogEntry`](../type-aliases/EventLogEntry.md)[]

***

### isCarPlayMonitoringEnabled()

> **isCarPlayMonitoringEnabled**(): `boolean`

Defined in: [src/ExpoDetectCarplayModule.ts:19](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/src/ExpoDetectCarplayModule.ts#L19)

Return whether persistent monitoring is enabled.

#### Returns

`boolean`

***

### isEventLoggingEnabled()

> **isEventLoggingEnabled**(): `boolean`

Defined in: [src/ExpoDetectCarplayModule.ts:42](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/src/ExpoDetectCarplayModule.ts#L42)

Return the persisted event-logging state.

#### Returns

`boolean`

***

### listenerCount()

> **listenerCount**\<`EventName`\>(`eventName`): `number`

Defined in: node\_modules/expo/node\_modules/expo-modules-core/build/ts-declarations/EventEmitter.d.ts:61

Returns a number of listeners added to the given event.

#### Type Parameters

##### EventName

`EventName` *extends* keyof [`ExpoDetectCarplayModuleEvents`](../type-aliases/ExpoDetectCarplayModuleEvents.md)

#### Parameters

##### eventName

`EventName`

#### Returns

`number`

#### Inherited from

`NativeModule.listenerCount`

***

### removeAllListeners()

> **removeAllListeners**(`eventName`): `void`

Defined in: node\_modules/expo/node\_modules/expo-modules-core/build/ts-declarations/EventEmitter.d.ts:52

Removes all listeners for the given event name.

#### Parameters

##### eventName

keyof [`ExpoDetectCarplayModuleEvents`](../type-aliases/ExpoDetectCarplayModuleEvents.md)

#### Returns

`void`

#### Inherited from

`NativeModule.removeAllListeners`

***

### removeListener()

> **removeListener**\<`EventName`\>(`eventName`, `listener`): `void`

Defined in: node\_modules/expo/node\_modules/expo-modules-core/build/ts-declarations/EventEmitter.d.ts:48

Removes a listener for the given event name.

#### Type Parameters

##### EventName

`EventName` *extends* keyof [`ExpoDetectCarplayModuleEvents`](../type-aliases/ExpoDetectCarplayModuleEvents.md)

#### Parameters

##### eventName

`EventName`

##### listener

[`ExpoDetectCarplayModuleEvents`](../type-aliases/ExpoDetectCarplayModuleEvents.md)\[`EventName`\]

#### Returns

`void`

#### Inherited from

`NativeModule.removeListener`

***

### requestPermissionsAsync()

> **requestPermissionsAsync**(): `Promise`\<`boolean`\>

Defined in: [src/ExpoDetectCarplayModule.ts:36](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/src/ExpoDetectCarplayModule.ts#L36)

Request the platform permissions used by monitoring and notifications.

Android requests Bluetooth permissions on API 31+ and notifications on
API 33+. iOS requests notification authorization and Always Location
authorization; add the location usage descriptions through
`ios.backgroundLocation` before calling this method.

#### Returns

`Promise`\<`boolean`\>

***

### setApiEndpoint()

> **setApiEndpoint**(`url`, `apiKey?`, `id?`): `void`

Defined in: [src/ExpoDetectCarplayModule.ts:50](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/src/ExpoDetectCarplayModule.ts#L50)

Configure native event forwarding to an HTTP endpoint.

#### Parameters

##### url

`string`

##### apiKey?

`string`

##### id?

`string`

#### Returns

`void`

***

### setCarPlayNotificationConfig()

> **setCarPlayNotificationConfig**(`config`): `void`

Defined in: [src/ExpoDetectCarplayModule.ts:25](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/src/ExpoDetectCarplayModule.ts#L25)

Persist connection-event and foreground-service notification settings.

#### Parameters

##### config

[`CarPlayNotificationConfig`](../type-aliases/CarPlayNotificationConfig.md) \| [`CarPlayNotificationSettings`](../type-aliases/CarPlayNotificationSettings.md)

#### Returns

`void`

***

### startCarPlayMonitoring()

> **startCarPlayMonitoring**(): `Promise`\<`void`\>

Defined in: [src/ExpoDetectCarplayModule.ts:15](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/src/ExpoDetectCarplayModule.ts#L15)

Start persistent CarPlay and Android Auto connection monitoring.

#### Returns

`Promise`\<`void`\>

***

### startObserving()?

> `optional` **startObserving**\<`EventName`\>(`eventName`): `void`

Defined in: node\_modules/expo/node\_modules/expo-modules-core/build/ts-declarations/EventEmitter.d.ts:66

Function that is automatically invoked when the first listener for an event with the given name is added.
Override it in a subclass to perform some additional setup once the event started being observed.

#### Type Parameters

##### EventName

`EventName` *extends* keyof [`ExpoDetectCarplayModuleEvents`](../type-aliases/ExpoDetectCarplayModuleEvents.md)

#### Parameters

##### eventName

`EventName`

#### Returns

`void`

#### Inherited from

`NativeModule.startObserving`

***

### stopCarPlayMonitoring()

> **stopCarPlayMonitoring**(): `Promise`\<`void`\>

Defined in: [src/ExpoDetectCarplayModule.ts:17](https://github.com/Mike89745/ExpoDetectCarplay/blob/master/src/ExpoDetectCarplayModule.ts#L17)

Stop monitoring and clear the persisted connection snapshot.

#### Returns

`Promise`\<`void`\>

***

### stopObserving()?

> `optional` **stopObserving**\<`EventName`\>(`eventName`): `void`

Defined in: node\_modules/expo/node\_modules/expo-modules-core/build/ts-declarations/EventEmitter.d.ts:71

Function that is automatically invoked when the last listener for an event with the given name is removed.
Override it in a subclass to perform some additional cleanup once the event is no longer observed.

#### Type Parameters

##### EventName

`EventName` *extends* keyof [`ExpoDetectCarplayModuleEvents`](../type-aliases/ExpoDetectCarplayModuleEvents.md)

#### Parameters

##### eventName

`EventName`

#### Returns

`void`

#### Inherited from

`NativeModule.stopObserving`
