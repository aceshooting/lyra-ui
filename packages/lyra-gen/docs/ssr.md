# Static server snapshots and client restoration

`@aceshooting/lyra-gen/ssr.js` is an opt-in route. It produces visible native HTML with a bounded,
validated snapshot and restores that snapshot into the existing keyed renderer in the browser.
The package root does not import this route, component registrations, or a server renderer.

This is **static semantic SSR with explicit client restoration**. It does not hydrate existing
custom-element shadow roots in place. The ordinary `lr-gen-view` Lit template is a client shell;
rendering that shell with a server renderer does not render a generated document. Lyra UI's
separate `hydration.js` support installs Lit's DSD hydration machinery, but is not needed by this
restore profile and does not make the imperative generated tree hydratable.

## Supported profile

`GEN_SSR_PROFILE` is `lyra-gen-static-v1`. Supported roles are unmodified definitions from the
reviewed initial catalog: `stack`, `row`, `text`, `heading`, `form`, `input`, `textarea`, `select`,
`option`, `checkbox`, `switch`, `button`, and `table`. A host may select those definitions into a
narrower catalog and declare actions. Replaced definitions, custom loaders/adapters, named slots,
and other roles are rejected explicitly. An `option` must belong to a `select`.

Tables render a native caption, column headers and escaped scalar cells in their original order.
They must contain complete data fitting the first page and `maxRows`; loading/error tables and
pagination beyond the initial page are rejected. The default first-page ceiling is 100 rows.
Forms render their names, labels, values, hints, errors, selections and required state. Multiline
values use a preformatted, read-only ARIA textbox because Lit SSR does not support dynamic
textarea text content; restoration supplies the regular Lyra textarea. Server
controls are disabled, and buttons have no submit action. This preserves readable content without
activating form submission, catalog actions, data providers or component loaders on the server.
Styling and interactive affordances are supplied when the client renderer takes over; pixel
identity between native server controls and Lyra controls is not claimed.

The projection contains caller data, including selected bound state. Authorize the viewer and
redact sensitive values before creating a server snapshot. Safe serialization is not redaction.

## Server

The host installs its preferred compatible Lit SSR renderer; it is not a runtime dependency of
Lyra Gen. For example, with `@lit-labs/ssr`:

```ts
import { render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';
import { renderGenSnapshot } from '@aceshooting/lyra-gen/ssr.js';

const result = renderGenSnapshot(authorizedSnapshot, hostCatalog, {
  locale: 'en',
  direction: 'rtl',
  limits: { maxBytes: 262144 },
});
if (!result.ok) throw new Error('Snapshot was rejected');
const markup = await collectResult(render(result.value.template));
```

The template contains real native content and one inert `template[data-lyra-gen-state]` carrying
the snapshot in its data attribute. Text is escaped by Lit; the JSON payload also escapes `<`, `>`, `&` and Unicode line
separators. No generated HTML or script is interpreted. `result.value.serialized` exposes the same
bounded JSON when the host needs it separately. Do not replace the inert payload with executable
JavaScript or use generated strings as HTML.

## Browser

```ts
import { restoreGenSnapshotElement } from '@aceshooting/lyra-gen/ssr.js';

const container = document.querySelector<HTMLElement>('[data-lyra-gen-snapshot]')!;
const restored = await restoreGenSnapshotElement(container, hostCatalog, {
  signal: cancellation.signal,
  limits: { maxBytes: 262144 },
});
if (restored.ok) {
  const view = restored.value;
  view.addEventListener('lr-gen-action', event => authorizeOnServer(event.detail));
  view.enabledActions = ['save'];
}
```

Activate only host-authorized actions after successful restoration. On failure, leave the static
content available and present localized recovery using `restored.diagnostics`.

Restoration checks the profile, document/catalog versions, node identities, state ownership,
property schemas, resource limits, and the container's identity and locale/direction context.
It stages the ordinary renderer hidden and inert, with an empty action allowlist, then waits for
its public readiness contract. On success it removes the native snapshot without disconnecting
the prepared client element. The context-bearing container remains in place. Saved dirty binding
ownership survives restoration and later document revisions. No saved action is replayed.

Invalid, canceled, detached, superseded or failed restoration leaves the native snapshot in place
and returns diagnostics. Concurrent calls for one container supersede the previous attempt. A
host can cancel a loader that never settles using the supplied abort signal. Restoring the same
container twice after successful replacement is rejected because its inert payload is gone.

`LyraGenViewElement.restoreSnapshot(input)` is also available for an already-created renderer.
It validates against the current catalog and instance `limits`, stages the document and saved dirty
state, and returns a diagnosed result. Rendering and module loading remain asynchronous: use
`lr-gen-ready` or `status` to determine readiness. It does not enable actions or replay them.

## Resource limits and evidence

The renderer's `limits` property accepts host resource ceilings. Omitted values retain the runtime
defaults; invalid overrides use defaults, and excessive finite overrides are clamped to hard
ceilings. Lowering a ceiling revalidates the current document and bound state before new component
loaders run. User edits are subject to the same instance limits.

Tests render actual server HTML through Lit SSR and inspect its table/form semantics, escaped
content and serialized state. Browser tests restore that HTML and compare visible values, context,
action activation and dirty-state behavior, including tampered and canceled snapshots. This
qualifies the stated static profile and restoration route; arbitrary component SSR and in-place
DSD hydration remain separate capabilities.
