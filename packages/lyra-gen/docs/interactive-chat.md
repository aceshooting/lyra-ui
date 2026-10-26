# Interactive chat

Keep provider transport in the application. Pass generated data through syntax parsing and catalog
validation, then render complete safe boundaries. Lyra Gen does not request a model, register new
tools from model text or make a follow-up turn automatically.

## One generated island in message parts

For mixed streamed prose and islands, prefer `createChatStream()` from `chat.js`. It maintains
ordinary `MessagePart[]` and exposes generated island metadata to the existing `renderPart` hook.
The complete [browser composition](../examples/chat.ts) wires this controller to `lr-chat-viewport`,
suggestions, citations and an artifact panel. Its host callbacks supply transport, current source
permissions and side effects; it is an application example, not a hosted generation service.

```ts
import { initialCatalog } from '@aceshooting/lyra-gen/catalog.js';
import { createChatStream } from '@aceshooting/lyra-gen/chat.js';

const chat = createChatStream({
  messageId: 'assistant-1', surfaceId: 'answer-1', catalog: initialCatalog,
  strings: { loading: 'Loading…', incomplete: 'Answer interrupted.',
    invalid: 'This answer could not be displayed.', sourceUnavailable: 'Source unavailable.' },
  provenance: 'Generated answer',
});
chat.push('Here is the result.\n```lyra\n<text id="summary">Ready.</text>\n');
const snapshot = chat.push('```\n');
const island = snapshot.islands.find(item => item.status === 'ready');
const sameIsland = island && chat.islandForPart(island.partId);
chat.finish();
```

The host localizes the supplied strings and renders provenance outside model-authored nodes.
Use `chat.snapshot.parts` for message parts and `islandForPart(part.id)` inside `renderPart`.
Cache one shell/view per island part; an island's `.document` can then update without reconstructing
the generated element. The lower-level single-island recipe below demonstrates that same hook.

`lr-message-parts.renderPart(part, index)` is the existing host extension point. Returning
`undefined` delegates to the built-in renderer; any other return replaces the entire part,
including its built-in interactions. The following browser recipe uses a text part as a portable
fallback and supplies the generated view for that specific part identity.

```ts
import { LyraMessageParts } from '@aceshooting/lyra-ui/components/lr-message-parts.js';
import { LyraGenViewElement } from '@aceshooting/lyra-gen/gen-view.js';
import { initialCatalog } from '@aceshooting/lyra-gen/catalog.js';
import { parseMarkup } from '@aceshooting/lyra-gen/parser.js';
import { validateView } from '@aceshooting/lyra-gen/runtime.js';

const parsed = parseMarkup('<text id="answer">Your report is ready.</text>', {
  catalog: initialCatalog, surfaceId: 'report-answer', revision: 0,
  allowedTags: Object.keys(initialCatalog.components),
});
if (parsed.status !== 'complete' || !parsed.view) throw new Error('Incomplete answer.');
const checked = validateView(parsed.view, initialCatalog);
if (!checked.ok) throw new Error('The answer was rejected.');

const generated = new LyraGenViewElement();
generated.catalog = initialCatalog;
generated.document = checked.value;
const transcript = new LyraMessageParts();
transcript.parts = [
  { id: 'intro', type: 'text', text: 'Here is the result.' },
  { id: 'report-island', type: 'text', text: 'Your report is ready.' },
];
transcript.renderPart = part => part.id === 'report-island' ? generated : undefined;
document.body.append(transcript);
```

Keep the same part id and generated element while sibling prose changes. For a refinement, update
`.document` with the same `surfaceId`, stable logical node ids and a higher revision. Use
`applyViewPatch()` for atomic identity-addressed replacements/removals with `expectedRevision`.
Conflicts reject; they must not overwrite a newer user interaction or be retried against a guessed
revision.

This recipe is a host composition using an existing text-part fallback. It does not introduce a
new message-part wire type. The stable widget-v2 route remains available through a `data` part's
`widget` root, `widgetRegistry` and `widgetBindingState`; its documents and events differ from
Lyra Gen's [view contract](compatibility.md#other-contracts).

## Stream boundaries

Use `createIslandParser()` from `@aceshooting/lyra-gen/islands.js` when the model returns prose
with fenced `lyra` blocks. Supply `catalog`, `surfaceId`, `revision` and `allowedTags` as in the
example. Call `push(chunk)` for each text delta and `finish()` at the transport's end. Its parts
contain either verbatim prose or an island with `closed`, `bodyStart` and a syntax `result`.

Only mount an island with `closed: true` and `result.status === 'complete'`, after `validateView`
succeeds. Parser source offsets are relative to `bodyStart`; add it to obtain transcript offsets.
The scanner derives distinct surface identities as `<base>:island-<ordinal>` from the host's base
identity. Retain the same base and part identities when continuing that answer; do not replace them
with model-selected or randomly reassigned surface ids.

An unclosed block stays incomplete and inert. `cancel()` retains already completed islands but
does not complete a partial control. Show a localized interrupted/retry state and preserve the
transport cursor under host policy. `createMarkupParser()` commits a whole view only at
`finish()`; neither parser promises interactive partial attributes or per-tag progressive mounting.
Raw markup outside a `lyra` fence remains prose in the island API.

The chat controller's `interrupt(resumable, reason?)` preserves completed islands and marks an
unfinished tail. `resume()` permits more deltas only for a resumable interruption. `cancel()` makes
the unfinished stream inert; `retry()` restarts only the unfinished tail, whose replacement input
must include its opening fence. The host still restarts or resumes its provider request and cursor.
Call `dispose()` to abort outstanding host requests and release retained controller data.

After saving the permitted presentation, `releaseSource()` drops the parser/raw transport source
while retaining admitted parts, documents and host provenance. `.sourceAvailable` becomes false
and `.retainedSourceCharacters` becomes zero; that is a logical source count, not a measured heap
size. Source replay, push, retry and resume then require a new controller. `refreshSources()` can
still revoke unavailable sources in the retained presentation. Never retain raw prompts or tool
payloads solely to make a saved view reopen.

Retain the chat viewport's existing follow/scroll policy and avoid replacing the transcript
container on each delta. Announce meaningful completion through the application's accessible
chat surface; do not announce every text token or move focus when a generated control arrives.
Loading placeholders reserve space. The complete browser composition waits for `lr-gen-ready`
before clearing shell busy state and issuing one completion announcement per island. That event
means renderer/module/child update settlement, not arbitrary remote data readiness. Its follow
policy honors readers who have scrolled away. Browser fixture coverage and human assistive-
technology review remain distinct evidence; the example itself establishes neither a universal
scroll guarantee nor a human review result.

## Local controls and actions

Only catalog-declared control properties can bind to local JSON Pointers. For example, an input
node can declare `bindings: { value: '/query' }`; it needs its catalog-required accessible label.
The view tracks edits separately from generated defaults and retains dirty values when the same
binding owner survives a higher revision. Reassigning `.bindingState` intentionally replaces that
local state. In controlled mode the host accepts a proposal by setting a fresh `.bindingState`
from `lr-gen-state-change.detail.values`.

Action names, payload schemas and confirmation policy come from a trusted catalog created with
`createCatalog()`. For example, this adds a host-approved follow-up action:

```ts
import { createCatalog, initialCatalog } from '@aceshooting/lyra-gen/catalog.js';

const catalog = createCatalog({
  ...initialCatalog,
  actions: {
    'ask-more': {
      payload: { type: 'object', properties: {
        question: { type: 'string', minLength: 1, maxLength: 512 },
      }, required: ['question'], additionalProperties: false },
    },
  },
});
// A button may now declare:
const action = { name: 'ask-more', payload: { question: 'Explain the trend.' } };
```

The host listens for `lr-gen-action`, checks its surface/revision and current permissions, then
decides whether to send a next turn. For effects requiring approval, set `confirm: true` in the
catalog and provide `.confirmAction(action, signal)`; no callback denies the action. An affirmative
callback permits an action request event, not an unrestricted tool execution. See the
[approval composition](approval.md) for a real confirmation bar and the
[security contract](security.md#actions-and-confirmation) for effect authorization.

For host-configured `ask:` suggestions, `requestSuggestion(id, activationId)` deduplicates the
activation, checks `canAsk()` and calls `onAsk()` with an abort signal. Read `.asking` to disable
concurrent suggestion controls. Generated text cannot add a suggestion, change its trusted context
or authorize a new turn. The browser composition connects these calls to real `lr-suggestion-chips`.

Forms use native validation and form-associated Lyra controls. A form action without an explicit
payload receives current bound values; its declared payload schema must admit those values.
`reset()` restores generated defaults through the native reset lifecycle. Submit only fields and
actions the host authorizes; generated input names are not access-control rules. For reviewed
collection purposes and exact field approvals, use the [field policy](security.md#field-collection-policy).

Source ids and citations are caller data. Resolve them against sources authorized for the current
viewer; an apparent citation or a source-shaped label does not establish evidence or permission.
The controller accepts a viewer-authorized `sources` map, replaces generated source labels from
that map, and turns unavailable citations into inert fallback text. Call `refreshSources()` after
permissions change, and `resolveCitation(surfaceId, nodeId)` immediately before opening a source.
`moveChatSurface()` moves an existing shell between transcript and panel; the example leaves a
return link and reuses the view. Keep host state, focus return and teardown within that lifecycle.
