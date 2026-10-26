# AG-UI adapter

`AgUiStreamAdapter` accepts structural records without an AG-UI SDK dependency. Its supported
subset follows the [official event reference](https://docs.ag-ui.com/sdk/js/core/events).
Feed the returned events into `reduceAgentStreamEvents()`; bind the resulting messages to
`lr-message-parts`. Data parts use the host's existing named renderer registration.

| Input | Neutral output |
| --- | --- |
| `REASONING_MESSAGE_START`, `REASONING_MESSAGE_CONTENT`, `REASONING_MESSAGE_END` | Assistant message containing a `reasoning` part; deltas append, end completes it |
| `ACTIVITY_SNAPSHOT` | Complete `data` part named by `activityType`, under `messageId`, with part ID `${messageId}:activity` |
| `ACTIVITY_DELTA` | Updated activity part with the same ID; `patch` applies to the cached content |
| `CUSTOM` | Complete named `data` part only when the host supplies a target |

Activity content must be an object. `replace: false` ignores a snapshot when its message ID
already exists. An activity delta needs a previous snapshot with the same activity type. Activity
and text/reasoning message IDs cannot overlap; a conflicting event is ignored. Activity patches
support the runtime's `add`, `replace`, and `remove` operations and reject prototype-mutating paths.
Invalid activity roots leave the previous activity intact. Activity payloads are copied at the input,
cache, and output boundaries, so provider or consumer writes cannot alter later patches.

Custom events carry no protocol message identity. Supply host-owned identities explicitly:

```ts
import { AgUiStreamAdapter } from '@aceshooting/lyra-ui/ai';

const adapter = new AgUiStreamAdapter({}, {
  customEventTarget: ({ name }) => name === 'search-results'
    ? { messageId: 'answer-1', partId: 'search-results' }
    : null,
});

const events = adapter.push({
  type: 'CUSTOM',
  name: 'search-results',
  value: { count: 3 },
});
```

The target callback is local application code. Returning `null` ignores an event. Reusing its
message and part IDs replaces that part, and the host may deliberately target a text message to
interleave data with its text. Choose part IDs distinct from the message's existing parts.
The event's `name` selects a named data renderer; its value stays in `part.data`, including values
that resemble widgets or actions. The adapter does not interpret that value as executable UI.
Register renderers only for the data types the application supports. Callback failures emit a
generic adapter error; thrown details do not become user-facing messages.

`maxBufferedMessages` defaults to 512 and bounds retained message identities. The snapshot
`maxBytes` limit also caps the combined cached activity content. Exceeding either budget emits
`stream_limit_exceeded` and preserves the previous activity. `reset()`, `RUN_STARTED`,
`RUN_FINISHED`, and `RUN_ERROR` clear retained identities and activity baselines. A
`MESSAGES_SNAPSHOT` replaces those baselines and maps reasoning/activity history into the same
part shapes. Like the neutral runtime's snapshot event, it replaces the complete message list;
hosts must include every message they want to retain. It does not implement AG-UI's role-specific
preservation rule for an omitted reasoning or activity role.

Reducer idempotency uses the emitted generation and sequence. Reapplying returned events is
safe; passing the same provider event through `push()` again creates a new cursor. Provider
`eventId` is correlation metadata, not a deduplication key.

The deliberately ignored set is tested explicitly:

- `REASONING_START` and `REASONING_END`: phase notifications have no message content.
- `REASONING_ENCRYPTED_VALUE`: opaque continuation material remains with the host transport.
- `RAW`, `STEP_STARTED`, `STEP_FINISHED`, `SUBAGENT_STARTED`, `SUBAGENT_FINISHED`, and
  `SUBAGENT_ERROR`: no matching neutral rendering event.
- `TEXT_MESSAGE_CHUNK`, `REASONING_MESSAGE_CHUNK`, and `TOOL_CALL_CHUNK`: expand compact events
  into their start/content-or-args/end forms before adapting.
- `THINKING_START`, `THINKING_END`, `THINKING_TEXT_MESSAGE_START`,
  `THINKING_TEXT_MESSAGE_CONTENT`, and `THINKING_TEXT_MESSAGE_END`: normalize deprecated names
  to their reasoning equivalents before adapting.
- `CUSTOM` without host routing, unknown event types, and malformed supported payloads.

Serializable ignored events leave the sequence unchanged. All incoming records still pass the
provider snapshot boundary, so non-serializable or over-budget records produce an adapter error.
