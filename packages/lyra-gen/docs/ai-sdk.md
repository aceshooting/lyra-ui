# Interactive SDK answers

This experimental integration is tested against the exact `ai@6.0.292` development dependency.
It uses the SDK's public
[`UIMessageChunk`](https://github.com/vercel/ai/blob/ai%406.0.292/packages/ai/src/ui-message-stream/ui-message-chunks.ts)
and [`readUIMessageStream`](https://github.com/vercel/ai/blob/ai%406.0.292/packages/ai/src/ui-message-stream/read-ui-message-stream.ts)
APIs. This qualification covers the fixture paths below, not arbitrary SDK versions or every
provider. Lyra UI does not import the SDK at runtime.

The existing neutral vocabulary is sufficient: `data-view` becomes a `data` part named `view`,
and `tool-show_view` becomes a `tool-call` part with its parsed input in `invocation.args`.
No new `ui` discriminator or alternate tool parser is needed. The application selects which data
and tool names may carry generated views; every candidate still needs the active catalog's
validation before rendering.

## Server prompt and data events

Use the same reviewed catalog on both sides. A model response must include explicit surface and
node identities, catalog identity/version, and a nonnegative revision. Generate a complete JSON
view with `buildCatalogPrompt()`; a transport or model response is not a validation result.
The server can stream ordinary SDK text events and insert a complete generated view as data:

```ts
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { initialCatalog } from '@aceshooting/lyra-gen/catalog.js';
import { buildCatalogPrompt } from '@aceshooting/lyra-gen/prompts.js';
import { validateView } from '@aceshooting/lyra-gen/runtime.js';

export function answer(generate: (prompt: string) => Promise<unknown>) {
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.write({ type: 'start', messageId: 'answer-1' });
      const candidate = await generate(buildCatalogPrompt(initialCatalog));
      const result = validateView(candidate, initialCatalog);
      if (!result.ok) {
        writer.write({ type: 'error', errorText: 'The generated answer is unavailable.' });
        return;
      }
      writer.write({ type: 'data-view', id: 'answer-view', data: result.value });
      writer.write({ type: 'finish', finishReason: 'stop' });
    },
  });
  return createUIMessageStreamResponse({ stream });
}
```

The application supplies `generate`, its provider credentials, request limits and error policy.
Use a localized fallback for the current viewer. Reusing the data event ID replaces that data
part. A changed view must keep its surface ID and increase its revision. Transient SDK data
notifications are excluded from retained SDK messages and never enter this integration path.

## Client selection and validation

The application's SDK transport supplies a `ReadableStream<UIMessageChunk>` to
`readUIMessageStream()`. The SDK handles chunk assembly and partial tool JSON. Adapt each
snapshot immediately, then give its ordinary parts to `lr-message-parts`:

```ts
import { readUIMessageStream, type UIMessageChunk } from 'ai';
import { html, nothing } from 'lit';
import { adaptAiSdkMessage } from '@aceshooting/lyra-ui/ai';
import { LyraMessageParts } from '@aceshooting/lyra-ui/components/lr-message-parts.js';
import { initialCatalog } from '@aceshooting/lyra-gen/catalog.js';
import { LyraGenAiSdkBridge } from '@aceshooting/lyra-gen/ai-sdk.js';
import { LyraGenViewElement } from '@aceshooting/lyra-gen/gen-view.js';

export async function display(stream: ReadableStream<UIMessageChunk>, root: HTMLElement) {
  const bridge = new LyraGenAiSdkBridge({
    messageId: 'answer-1', catalog: initialCatalog,
    dataNames: ['view'], toolNames: ['show_view'],
  });
  const views = new Map<string, LyraGenViewElement>();
  const transcript = new LyraMessageParts();
  const labels = { loading: 'Loading generated answer', unavailable: 'Generated answer unavailable',
    interrupted: 'This generated answer was interrupted' };
  transcript.renderPart = part => {
    const result = bridge.resolve(part);
    if (!result) return undefined;
    if (!result.document) {
      const label = result.status === 'loading' ? labels.loading
        : result.status === 'interrupted' ? labels.interrupted : labels.unavailable;
      return html`<span role="status">${label}</span>`;
    }
    let view = views.get(part.id);
    if (!view) {
      view = new LyraGenViewElement();
      view.catalog = initialCatalog;
      views.set(part.id, view);
    }
    view.document = result.document;
    return html`<section>${view}${result.status === 'interrupted'
      ? html`<p role="status">${labels.interrupted}</p>` : nothing}</section>`;
  };
  root.append(transcript);
  for await (const snapshot of readUIMessageStream({ stream, terminateOnError: true })) {
    if (snapshot.id !== 'answer-1') throw new Error('Unexpected message identity');
    const message = adaptAiSdkMessage(snapshot);
    if (!message) throw new Error('The SDK snapshot failed the adapter boundary');
    transcript.parts = message.parts ?? [];
  }
}
```

Localize the host labels and handle transport errors around `display()`. One bridge belongs to
one SDK message. Create a new bridge for a different message, and release the transcript/view
references when it leaves the application. `reset()` releases the bridge's retained documents.
A custom `renderPart` replaces the built-in rendering and interactions for that part; keep
returning `undefined` for other parts. Wire the custom renderer's interrupted/error controls to
host-owned resume/retry/cancel operations. The bridge reports states and never reconnects a stream.
For the full chat composition, including localized interruption controls, announcements and focus
preservation, see [interactive chat](interactive-chat.md).

## Streamed tool input

An SDK tool named `show_view` can use the catalog JSON Schema as its input schema. Its complete
input must be the view object itself. Ordinary `tool-*` and `dynamic-tool` parts keep their existing
call/result mapping. The UI adapter records the exact SDK tool state in
`part.metadata.aiSdkInputState`, since neutral transport state alone cannot distinguish a partial
input from a complete input awaiting tool output.

The bridge admits selected inputs at `input-available` or `output-available`. It keeps
`input-streaming` and pending approval states in `loading`, even when the SDK's partial JSON
already resembles a complete view. Denied, failed and incomplete invocations become an error
state without generated controls. Rendering an input is not permission to execute a tool:
SDK execution, generated actions and confirmation remain separate application decisions.

## Limits, identity and failure states

`adaptAiSdkMessage()` omits only recognized optional `undefined` snapshot fields before applying
its existing descriptor-safe ownership and byte/node/depth limits. Undefined values inside data,
metadata or nested tool input still reject the message. Each SDK data payload is an atomic complete
part; later events with its ID replace it. SDK buffering occurs before this adapter boundary, so
apply request/transport limits before handing an unbounded source to the SDK as well.

The bridge validates every selected complete payload against its trusted catalog and configured
hard-capped limits. Its `maxBytes` also bounds the combined serialized documents and part identities
retained for stable references. A rejected update cannot displace an admitted view. Unchanged
snapshots return the same validated document object. Changed content under the same part must
advance the same surface's revision; two parts cannot own the same surface. Unknown data/tool
names delegate to the ordinary renderer. Invalid catalog, unsafe properties, ambiguous identity,
unsupported components and budget breaches return diagnostics without an executable document.

An interrupted selected part reports `interrupted`, its resumable flag and host-owned reason.
It can retain its last validated document. An unfinished input with no admitted document stays
inert. This state does not itself authorize resumption or a follow-up action.

## Fixture checks

From the workspace root, with the repository's pinned Node selected:

```sh
nvm use
pnpm --filter @aceshooting/lyra-ui build
pnpm --filter @aceshooting/lyra-gen exec tsc -p tsconfig.test.json
pnpm --filter @aceshooting/lyra-gen exec node --test .test-output/src/ai-sdk.test.js
WTR_PORT=8320 pnpm --filter @aceshooting/lyra-gen exec wtr --config web-test-runner.config.mjs --files test/browser/ai-sdk.test.ts
```

The Node fixtures use the actual pinned SDK to assemble data and static/dynamic tool snapshots,
including optional undefined fields, partial input, terminal errors/denial and transient data.
The browser fixtures exercise the existing rendering hook, stable document/element identity,
input readiness and retained safe interruption content.
