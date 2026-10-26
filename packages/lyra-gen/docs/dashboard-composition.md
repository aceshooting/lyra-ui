# Composing a live dashboard

The [browser example](../examples/dashboard.ts) mounts ordinary application regions around an
existing `lr-dashboard-grid`, with two keyed `lr-gen-view` children containing a table and a
peer-free `lr-lite-chart`. It introduces no dashboard custom element. Supply translated labels,
a `HostQueryRegistry`, the authenticated query context and any durable layout adapter.

`dashboard-binding.js` is the browser integration entry; use its granular import rather than the
provider-neutral package root. `DashboardGridBinding` validates the layout and panel documents,
keeps the same panel elements when the grid moves or resizes, and maps pinning to the grid's
public `locked` cell property. Its optional `persist(next, previous, signal)` callback must
independently authorize the write and compare the previous revision atomically. A failed write
keeps the old layout. Disposal aborts pending saves and prevents late results from applying.

The portable layout state contains only its format version, revision and panel geometry. Query
results and runtime callbacks are not part of that state. Store allowed personal state separately
through the application persistence policy.

## Query and filter contract

The example calls the registered semantic query with `category`, `offset` and `limit` parameters.
The host applies filtering and paging and returns an array of records shaped as
`{ c0: string, c1: number }` in `DashboardQueryResult.data`. Category identifiers must be nonempty
and unique within a returned page. The example validates these records before updating either
tile. It caps requested pages at 100 records and retains only the current page.

The shared category filter resets the requested offset and updates both the table and chart from
the same authorized response. A table's independent local filter and the personal note remain
untouched. `bindDashboardSelection()` uses the canonical chart activation event once and maps
stable record identities to table selection. `setKeys(keys)` changes the plotted projection while
preserving off-page selections; supply a complete `availableIds` set as its second argument only
when the host knows which records still exist.

`pageSize` chooses the requested page size. `totalRows`, when supplied, is a host-owned bound for
paging; it is not inferred from generated content. Without a total, a full page permits another
request and a shorter page ends forward paging. If a filter changes the applicable count, the
host should provide the corresponding count in its application integration.

The page label receives both the requested offset and the offset of the retained rows. When a
new page fails or is cancelled, this distinction prevents the old rows from being labelled as a
fresh result for the requested page. Loading, partial data, errors, freshness, source timestamps,
sampling and aggregation are exposed through translated status/provenance callbacks. Superseded
or cancelled requests cannot update either tile. A viewer-context reset clears query data, detail
content, selection, shared filters and transient bound note state.

## Typed values and source details

Table columns may opt into `format: { kind: 'number', maximumFractionDigits: 3 }`,
`format: { kind: 'date', timeZone: 'UTC' }`, or
`format: { kind: 'datetime', timeZone: 'UTC' }`. The number format accepts finite numeric data,
never numeric strings. Date columns accept strict `YYYY-MM-DD`; datetime columns require ISO
`YYYY-MM-DDTHH:mm:ss[.fraction]Z` or an explicit `±HH:mm` offset, with one to three
fractional-second digits when present. Calendar dates display in UTC and
instants normalize their offset to UTC before display. Invalid dates and mismatched types retain
their original scalar text; null displays empty. Unformatted columns retain scalar text.

Formatting uses the generated view's inherited effective locale, including host locale changes.
Rows and saved snapshots retain the raw numbers and ISO strings. Static SSR requires an explicit
`locale` option for formatted columns and uses the same formatter. Static Lit export currently
rejects formatted columns because that export has no host locale parameter.

Supply the example's `sources` option to render a source detail for each current numeric value.
It requires translated `label`, `unverified` and `citation(source)` strings, an
`available(source)` callback resolving the current viewer's access, and an `activate(source)`
callback opening the host's approved source view. There are no generated source URLs. The host
must independently reauthorize source activation. Missing, dangling or denied lineage renders the
translated unverified text without exposing the denied source label.

Each source detail uses the actual displayed response's `/index/c1` JSON Pointer. A new page or
shared filter replaces its source controls and resets the pointer to the returned page's local
index. Partial results retain citations only where that response supplies resolvable lineage;
global freshness metadata does not verify a value. Failed or cancelled requests retain sources
for the retained rows. Viewer resets and revocation clear the details with the rows; stale detached
controls cannot activate. Call `refreshSources()` after a source grant changes without a query
refresh. Availability is also checked again on every activation.

## Drilldown and return

Provide `authorizeDrilldown(recordId)` to enable row and chart activation as navigation. The host
checks every entry; an omitted callback leaves activation as selection, and a denied destination
keeps the overview visible with a translated status message. Destinations come from the current
validated records rather than arbitrary generated URLs.

The example uses `DashboardNavigation` for the parent frame and breadcrumbs. During drilldown,
the overview stays connected, hidden and inert, so its controls retain their edits and independent
filters. Pending query work is cancelled. Back reveals the same grid, restores scroll position
and returns focus to the original target or its surviving panel. The detail region contains plain
text for the authorized record. Disposal removes listeners and pending navigation work.

## Export

`exportLyraTemplate()` requires an explicit mapping of public tags, imports and properties plus
host approval for each text/property literal. Actions and runtime bindings are omitted; missing
required values or names reject the export. Arbitrary host `prepareProperties` callbacks reject.
The canonical table adapter has a fixed reviewed export that creates the public table column
`cell` callbacks from admitted column keys; it never serializes a callback supplied by content.
The returned module exports `dashboardTemplate` and token-backed `dashboardStyles`.

The browser fixtures compile that module as an ES module and compare populated table cells,
chart inputs, literal text and structural styles against the generated view. These are bounded
synthetic workflows. Applications still qualify their own storage, authorization, data scale,
localization and assistive-technology behavior.
