# Saved dashboards in applications

A saved dashboard is a declarative application artifact. Reopening it uses its saved definition;
it does not require another model request. Lyra Gen supplies document validation, revision and
publication orchestration, and application lifecycle helpers. The host supplies the durable
database, authenticated viewer, authorization policy, routes and UI for editing or sharing.

An adapter interface, a test fixture or a browser-storage example
does not establish a deployed multiuser storage service.

## Definition, state and authority

`DashboardDefinition` contains `format: 'lyra-dashboard'`, numeric `version: 1`, `title`, a
validated `view` and `dataSources`. Each source reference has an `id`, a semantic `source` name
and optional JSON `parameters`. Definitions contain no callbacks, provider credentials, routes
or permission grants. Source parameters are refused unless the store's host policy explicitly
admits them.

`DashboardInstanceState` separately contains `version: 1` and `values`. The store's `allowState`
callback must admit each saved key; omission admits no state. Decide which fields may persist
before saving them. Do not persist passwords, sessions, pending confirmations, tool handles or
private datasets as convenient form state.

`instanceState()` validates a proposal; `saveState()` and `loadState()` persist it only when the
adapter implements the optional `compareAndSwapInstance` and `readInstance` methods. Scope every
instance-state record by authenticated tenant, workspace, actor, dashboard and instance identity.
Instance-state writes have their own expected revision and must be atomic as well.

The host supplies `DashboardContext` (`actorId`, `tenantId`, `workspaceId`) from authenticated
session state. It must not trust those fields from a browser request or a stored definition.
Metadata records owner, tenant, workspace, storage revision and the selected publication. View
revisions and storage revisions are different counters: patching the view and saving a draft each
have their own preconditions.

## Connect durable storage

Implement `DashboardHostAdapter.read`, `.list` and `.compareAndSwap` on the trusted server.
Compare-and-swap must atomically check the expected storage revision and update the entire record,
including history, publications and deletion. `expectedRevision: null` creates only if absent;
numeric revisions update or delete only the matching record. Return `{ ok: false }` for a conflict.
Do not implement this as a separate unprotected read followed by a write.

Records, including retained history and publications, remain subject to document bounds. Plan
archival and retention in the host before a record reaches those bounds; overflowing a record is
a failed write, not permission to drop history silently.

```ts
import { initialCatalog } from '@aceshooting/lyra-gen/catalog.js';
import { DashboardStore } from '@aceshooting/lyra-gen/persistence.js';
import type { DashboardStoreOptions } from '@aceshooting/lyra-gen/persistence.js';

export function connectDashboardStore(
  adapter: DashboardStoreOptions['adapter'],
  authorize: DashboardStoreOptions['authorize'],
): DashboardStore {
  return new DashboardStore({
    adapter, authorize, catalog: initialCatalog,
    createId: () => crypto.randomUUID(),
  });
}
```

The store checks operation-specific permissions before and after reads. The adapter and server
must independently enforce tenant and access rules. `read()` requires `draft` permission;
`resolve()` reads an authorized published revision. Authorize view, edit, publish, fork, export,
history and data access separately. Never grant every operation because a user can view a screen.

Use `create(context, definition)` for a draft and `update(context, id, expectedRevision,
definition)` for changes. `DashboardConflict` retains the proposal for deliberate conflict
resolution. Keep the unsaved draft, reload the current record and let the user review competing
changes. Do not resolve a conflict by overwriting the current revision automatically. The executable
[saved-dashboard host](../examples/saved-dashboard/README.md) demonstrates file-backed storage,
simulated server sessions and an explicit diff review before saving or publishing. Cancel retains
edits; approval submits the previewed proposal and expected revision. This review is example host
policy, not a mandatory confirmation step in `DashboardStore`.

## Publish, follow, pin and fork

`publish(context, id, expectedRevision)` creates an immutable publication and advances the followed
published revision. Updating the draft leaves viewers on the existing publication. Resolve with
`{ mode: 'follow' }` for the selected publication or `{ mode: 'pin', revision }` for an explicit
published revision. A pin addresses the storage publication revision, not the view revision.

`history()` exposes authorized revisions. `undo()` creates a new draft from a selected history
entry; it does not republish. `rollback()` changes the followed publication while retaining the
immutable published values. `fork()` requires permission, creates a new document and surface id,
and starts an independent draft. Editing the shared original and editing a fork should be visibly
different host UI actions.

`list()` returns authorized metadata for a host gallery. `export()` returns an authorized portable
definition without host metadata or instance state. `import()` validates and creates a new draft.
Export is not permission to disclose the data referenced by that definition. Share links and route
ids confer no rights beyond the host's current authorization policy.

## Mount on a host route

`DashboardApplication` resolves a fresh context for navigation and refresh, aborts superseded work,
and calls host mount/cleanup hooks. This browser recipe receives a configured store and a host
session resolver; the host still owns URLs, navigation entries, errors and unsaved-edit prompts.

```ts
import { DashboardApplication } from '@aceshooting/lyra-gen/application.js';
import type { DashboardContext, DashboardStore } from '@aceshooting/lyra-gen/persistence.js';
import { LyraGenViewElement } from '@aceshooting/lyra-gen/gen-view.js';
import { initialCatalog } from '@aceshooting/lyra-gen/catalog.js';

export function mountDashboards(
  store: DashboardStore,
  context: () => Promise<DashboardContext>,
  container: HTMLElement,
): DashboardApplication {
  return new DashboardApplication({
    store, context,
    mount: ({ dashboard, signal }) => {
      const view = new LyraGenViewElement();
      view.catalog = initialCatalog;
      view.document = dashboard.definition.view;
      if (!signal.aborted) container.append(view);
      return () => view.remove();
    },
  });
}
```

Call `.navigate({ documentId, policy: { mode: 'follow' } })` from the host router. `.refresh()`
reauthorizes the selected route and update policy. Call `.revoke()` immediately on logout, tenant
change or grant revocation to remove mounted content; call `.dispose()` when the host page closes.
Wire data and action handlers under the mount's `signal`, and release subscriptions in cleanup.
The helper does not register browser routes or generate share URLs.

`.gallery(cursor)` provides authorized gallery metadata. `.openLink(link)` requires a trusted
host `resolveLink` callback and then follows the normal authorized navigation path; resolving a
link never grants permission by itself.

## Live data, filters and layout

`HostQueryRegistry` in `live-data.js` maps semantic query names to host-owned `authorize` and
`execute` callbacks with byte and row bounds. `LiveDataController` exposes loading, empty, ready,
partial, error, cancelled and denied snapshots, aborts superseded requests, and rechecks permission
before accepting results. Update its context when viewer or authorization revision changes;
revoke or dispose it when access ends. The host's data service must enforce the same permissions.

Data references do not bind themselves to arbitrary component properties. The host resolves a
source, validates the returned data and explicitly applies it to the intended view/props. Display
snapshot freshness, partial results, sampling and aggregation information where users need them.
`resolveDashboardLineage()` reports whether a value's source id resolves to supplied provenance;
it does not independently verify that the source is truthful.

`DashboardDataQueue` is a bounded pull queue with explicit reject, drop-oldest or drop-newest
overflow policy and drop metrics. The application drives batch consumption and decides how to
report loss. It does not create an unbounded subscription or a network transport.

`dashboard.js` provides scoped `SharedDashboardState` for filters/selection with origin suppression,
`DashboardNavigation` for authorized drilldown history, bounded `dashboardPageWindow()` queries,
and layout constraint/edit helpers. The host connects these to controls, loads pages and renders
keyboard-accessible move/resize actions. These helpers alone do not supply an automatic dashboard
grid editor or complete large-data backend.

`dashboard-binding.js` is the browser integration entry. `DashboardGridBinding` connects keyed
`lr-gen-view` panels to the existing controlled `lr-dashboard-grid`, preserves those view elements
during panel updates, and accepts host conditional layout persistence. Rejected saves retain the
previous layout; pending saves receive an abort signal. `bindDashboardSelection()` connects real
chart activation and stable table row selection through shared state without replacing independent
filters. Import this entry only in a browser composition: it registers the grid/view dependencies.

The [live dashboard example](../examples/dashboard.ts) wires these adapters to refresh/cancel/pin
controls, bounded data, freshness/provenance metadata and a pull queue. Its tests exercise an
application composition; it still requires a host registry, localized presentation and a durable
authorized persistence implementation. Large-data latency/memory campaigns and a production
multiuser deployment cannot be inferred from the example.

## Restore and migration

Runtime `createSnapshot()` / `restoreSnapshot()` preserve a validated view and declared binding
ownership. Apply an explicit privacy policy before storing even a valid snapshot; runtime validity
does not mean every field may be shared.

For dashboard documents, `migrateDashboard(input, catalog, migrations)` accepts trusted,
host-registered forward migration callbacks and validates their final definition. The current
format is numeric version `1`; unsupported or ambiguous routes fail. Migrations never come from
document callbacks or a generated module URL. Keep the original, migrate a copy and write a new
revision. See [compatibility](compatibility.md) and [security](security.md) for the full policy.

Simultaneous collaborative editing and production storage deployment remain separate work. No
test adapter or successful restore implies multiuser, browser or protocol qualification.
