# Upgrading from v29 to v30

## Migration scope

For Lyra UI 29 → v30, pin the tested package version and verify registry availability before
updating production. Public tags remain unchanged. For import, style, event and SSR contracts see: [imports and registration](./imports-and-registration.md),
[events and types](./events-and-types.md) and [styles and tokens](./styles-and-tokens.md).

## Migrate a project in reviewable steps

1. **Record the baseline:** installed Lyra version, lockfile and unrelated edits (`git status`).
   Isolate migration work in a branch or disposable worktree.
2. **Upgrade only Lyra and its lockfile** to the exact v30 build; confirm the resolved version.
3. **Run the installed CLI's collections review.** It reports without editing source, including
   [Map](#map) `center` assignments. Review each site manually; see [Collections](#collections)
   for acknowledgement comments:

   ```sh
   npx lyra-ui-migrate --rule=immutable-collections --check \
     --report=lyra-immutable-collections.json src
   ```

4. **Fix reported sites** as described below, then rerun until clean. Also review mutations in
   helpers or template bindings: a zero exit cannot validate uses outside the scan's reach.
5. **Verify the application:** typecheck, test, and exercise every screen mutating a listed collection.

## Removed deprecated names

V30 removes the 36 deprecated names whose compatibility window ended. Every replacement already
works in v29, so update first, then upgrade. Run `npx lyra-ui-migrate --origin=lyra-v25 --check src`
to preview safe event renames and report changed payloads, slot content, and listeners whose reach would widen; a `wa-`/`sl-` project is migrated by the upstream
run, which now maps the removed part names and `auto-width`. `wa-file-input` still requires manual review; use its canonical parts after completing that review.

| Component | Removed | Use instead |
| --- | --- | --- |
| `lr-agent-run`, `lr-subagent-panel` | event `lr-cancel` | `lr-run-cancel` |
| `lr-agent-eval-dashboard`, `lr-rag-eval-dashboard` | event `lr-metric-change` | `lr-metric-change-request` |
| `lr-background-runs` | event `lr-run-open` | `lr-run-activate` |
| `lr-change-review` | event `lr-change-decision` | `lr-change-decision-request` |
| `lr-community-card`, `lr-path-strip`, `lr-entity-dossier`, `lr-memory-panel`, `lr-provenance-panel` | event `lr-entity-activate` | `lr-entity-select` |
| `lr-chunk-inspector` | event `lr-chunk-toggle` | `lr-toggle` |
| `lr-memory-panel` | event `lr-memory-toggle` | `lr-toggle` |
| `lr-source-card` | event `lr-expand` | `lr-toggle` |
| `lr-retrieval-trace` | event `lr-stage-toggle` | `lr-toggle` |
| `lr-navigation-menu` | event `lr-expanded-change` | `lr-toggle` |
| `lr-dock-panel`, `lr-widget` | event `lr-collapse-change` | `lr-toggle` (`expanded` is the opposite of `collapsed`) |
| `lr-dock-panel`, `lr-widget` | event `lr-collapse-request` | `lr-toggle-request` |
| `lr-rag-eval-dashboard` | events `lr-run-change`, `lr-slice-change` | `lr-run-activate`, `lr-slice-change-request` |
| `lr-retrieval-results` | event `lr-select` | `lr-selection-change` |
| `lr-source-picker` | event `lr-sources-change` | `lr-selection-change` |
| `lr-app-rail-item`, `lr-flow-node`, `lr-widget` | slot `icon` | slot `start` |
| `lr-tool-call-chip` | slot `icon` | slot `status-icon` |
| `lr-accordion-item`, `lr-file-input`, `lr-qr-code`, `lr-sparkline`, `lr-video-playlist` | part `base` | the part named after the component, e.g. `::part(accordion-item)` |
| `lr-file-input`, `lr-known-date` | part `label` | `::part(form-control-label)` |
| `lr-icon` | `autoWidth` / `auto-width` | `canvas="auto"` |

The disclosure events pass `expanded` (and `itemId` where several items share a component); the
removed names reported the older shapes, so read the new detail rather than renaming blindly.
Content left in a removed `icon` slot is no longer projected.


### Review-required replacement recipes

A rename is automatic only when it preserves both the payload and which events or content reach
that site. The CLI reports ambiguous sites instead of changing them. Merge an existing canonical
listener with the legacy listener deliberately, and update matching `removeEventListener` calls.

| Reviewed source | Concrete replacement |
| --- | --- |
| `lr-chunk-inspector` `lr-chunk-toggle` | Listen to `lr-toggle`; replace `detail.chunkId` with `detail.itemId`, keeping `detail.expanded`. |
| `lr-source-card` `lr-expand` | Listen to `lr-toggle`; replace `detail.sourceId` with `detail.itemId`, keeping `detail.expanded`. |
| `lr-retrieval-trace` `lr-stage-toggle` | Listen to `lr-toggle`; ignore events whose `detail.stageId` is defined, because those report a nested chunk toggle. For the remaining stage disclosures, use `detail.itemId` as the former `stageId`. |
| `lr-retrieval-results` `lr-select` | Listen to `lr-selection-change`; replace `detail.chunkIds` with `detail.selectedChunkIds`. `detail.chunks` stays available. |
| `lr-widget` `lr-collapse-change` / `lr-collapse-request` | Listen to `lr-toggle` / `lr-toggle-request`; replace every read of `detail.collapsed` with `!detail.expanded`. Keep request vetoes on `lr-toggle-request` by calling `preventDefault()` before committing application state. |
| `lr-memory-panel` `lr-memory-toggle` | Listen to `lr-toggle`. To keep only whole-memory disclosure, ignore details whose `section` is defined, then require `memoryId` and `scope` before consuming them with `expanded`. Section disclosures carry the same event name. |
| `lr-rag-eval-dashboard` `lr-run-change` | Listen to `lr-run-activate`; keep reading `detail.run`. The canonical detail also includes `runId`; when passing the old exact payload to another API, construct `{ run: event.detail.run }` explicitly. |
| `lr-entity-dossier`, `lr-memory-panel`, `lr-provenance-panel` `lr-entity-activate` | Listen to `lr-entity-select`. To preserve the former conduit reach, accept community-card/path-strip origins only; canonical events from entity-card/chip/neighbor-list are additional sources. Inspect `composedPath()` rather than a retargeted `event.target`. |

For example, preserve an old collapsed-state consumer without reversing its behavior:

```ts
widget.addEventListener('lr-toggle-request', event => {
  const proposedCollapsed = !event.detail.expanded;
  if (!allowCollapsed(proposedCollapsed)) event.preventDefault();
});
```

For the three entity conduits, an origin filter can preserve the old source set:

```ts
panel.addEventListener('lr-entity-select', event => {
  const origin = event.composedPath().find(node => node instanceof Element &&
    node.matches('lr-community-card, lr-path-strip, lr-entity-card, lr-entity-chip, lr-neighbor-list'));
  if (!(origin instanceof Element) || !origin.matches('lr-community-card, lr-path-strip')) return;
  selectEntity(event.detail.entityId);
});
```

Move retired `icon` content to `start` on `lr-app-rail-item`, `lr-flow-node` and `lr-widget`, or
`status-icon` on `lr-tool-call-chip`. The canonical slot previously won over the `icon` fallback:
keep canonical content and remove unused fallback, or render only one conditional branch.
Renaming both slots would incorrectly display both:

```html
<!-- Before: only Canonical was visible. -->
<lr-widget label="Example"><span slot="start">Canonical</span><span slot="icon">Fallback</span></lr-widget>
<!-- After: preserve the same visible content. -->
<lr-widget label="Example"><span slot="start">Canonical</span></lr-widget>
```

An owned listener can still need review when its canonical event name is also dispatched by
nested components. Choose whether to accept those additional events or filter their origin;
renaming a string alone does not preserve listener reach.

## Map

`lr-map` `center` is compared by value. Assigning a new array that holds the coordinates the map
was last given is a no-op, even after the user has panned or zoomed: before v30 it moved the map
back, so a framework re-render that rebuilt an equal array (or a "reset view" button that assigned
the same home coordinates) re-centred it. A different value still moves the camera, and an initial
`center` is unchanged.

To re-centre explicitly, call a camera command, which also writes the result back to `center` and
`zoom` and reports `lr-map-view-change` with `source: 'command'`:

Before:

```ts
const map = document.querySelector('lr-map');
resetButton.addEventListener('click', () => {
  map.center = home; // moved the map back over the user's pan
});
```

After:

```ts
resetButton.addEventListener('click', () => {
  map.jumpTo({ center: home }); // flyTo() / easeTo() animate, honoring reduced motion
});
```

A binding that only publishes the application's own centre (`.center=${center}` where `center`
changes when the application wants a new view) needs no change. The `immutable-collections` rule
reports every `<receiver>.center = …` assignment in a file that names `lr-map` or `LyraMap` as
`MAP_CENTER_REVIEW`, because a scan cannot tell a re-centre from an initial value. Once a site is
correct, acknowledge it with `lyra-migrate-reviewed: MAP_CENTER_REVIEW:center` on the reported line
or alone on the line above it. The rule never edits source.

## Collections

Identity-preserving collections (feeds, queues, traces, task lists, virtual lists and similar)
now ignore reassignment of their current array. Before v30, reassigning it rendered item edits
and in-place mutations such as `push()`, `splice()` or `sort()`. Now:

- **Create a new array to publish a change.** `el.items = [...el.items, item]`,
  `el.items = el.items.filter(...)`, `el.items = el.items.map(...)` and `el.items = next` where
  `next` is a different array all update the component.
- **Mutating an array and assigning it again does not update.** `el.items.push(item);
  el.items = el.items;` and `const rows = el.items; rows.push(item); el.items = rows;` are ignored,
  and so is assigning the snapshot the getter returned.
- **Item objects keep their identity.** Editing a field of an item and assigning the same array does
  not update the view either; assign a new array (it may contain the same, edited item objects).
- Opaque indexed sources keep their own refresh rule: `lr-virtual-list` `source`, and the
  components' `treeSource`, `dataSource` and similar provider objects, refresh when you assign the
  same provider again or call `requestUpdate()`. The map `choropleth` object does the same.

Before:

```ts
const queue = document.querySelector('lr-prompt-queue');
queue.items.push(next);
queue.items = queue.items; // re-read the mutated array

const feed = document.querySelector('lr-activity-feed');
feed.entries[0].text = 'Updated';
feed.entries = feed.entries;
```

After:

```ts
queue.items = [...queue.items, next];

feed.entries = feed.entries.map((entry, index) =>
  index === 0 ? { ...entry, text: 'Updated' } : entry);
```

Declarative templates (`.items=${items}` in Lit, a bound property in a framework) behave the same:
return a new array from your state update instead of mutating the one already bound. A framework
that already replaces state immutably needs no change.

### Affected properties

| Component | Properties |
| --- | --- |
| `lr-activity-feed` | `entries` |
| `lr-agent-trace`, `lr-span-waterfall`, `lr-trace-tree` | `spans` |
| `lr-calendar` | `events` |
| `lr-claim-evidence` | `claims`, `citations` |
| `lr-command-palette` | `commands` |
| `lr-date-picker` | `presets` |
| `lr-eval-dataset`, `lr-eval-run` | `examples` |
| `lr-grounding-summary` | `citations` |
| `lr-ingestion-queue`, `lr-node-palette`, `lr-prompt-queue`, `lr-task-list`, `lr-virtual-list`, `lr-mention-popover`, `lr-swatch-picker` | `items` |
| `lr-map` | `markers`, `dataLayers`, `images`, `styleOverrides` |
| `lr-memory-panel` | `shortTerm`, `longTerm` |
| `lr-retrieval-results` | `chunks` |
| `lr-test-results` | `suites` |
| `lr-thread-list` | `threads` (already ignored the same array before v30) |
| `lr-tool-timeline` | `entries` |

Properties that copy their input (most other array properties) already behaved this way: they
ignore the same array and their getter returns a frozen snapshot. `lr-stepper`, `lr-file-tree`,
`lr-document-library` and `lr-sequence-strip` ignore a repeated assignment of the same array too.

### The migration rule

`lyra-ui-migrate --rule=immutable-collections` scans HTML, JavaScript, TypeScript, JSX and
Vue/Svelte/Astro sources, runs without `--origin`, and reports the warning code
`IMMUTABLE_COLLECTION_REVIEW` with a file, line and column for:

- `<receiver>.<property>.push|splice|pop|shift|unshift|sort|reverse|fill|copyWithin(` on a property
  from the table, when the file mentions a component that owns it (its `lr-` tag or class name);
- `<receiver>.<property> = <receiver>.<property>` with nothing else on the right;
- a local alias of the bound array that is changed in place and then assigned back;
- `<receiver>.center = …` in a file that names `lr-map` or `LyraMap`, as `MAP_CENTER_REVIEW` (see
  [Map](#map)).

It does not follow arrays across files or into helpers, and it cannot see a mutation behind a
template binding, so also search for the table's properties in code that edits shared state in
place. After you have reviewed a site and it is correct, add a comment containing
`lyra-migrate-reviewed: IMMUTABLE_COLLECTION_REVIEW:<property>` (for example
`IMMUTABLE_COLLECTION_REVIEW:items`) on the reported line or alone on the line above it; the site no
longer fails `--check`.

### Removed opt-in

`immutableSourceCollectionProperties`, the protected static list that `lr-thread-list` used to opt
into this behavior, is removed from `LyraElement`: the rule is now the default for every identity
collection, so a custom subclass that declared it needs no replacement.

## Fine-grained syntax highlighting engines

Core renderers and explicit `languages`/`languageLoaders` paths now use Shiki's JavaScript engine
by default. The full components' automatic language highlighting keeps its existing engine.
Custom grammars may require Oniguruma; replace `setShikiCoreEngine('oniguruma')` with:

```js
import { setShikiCoreEngine } from '@aceshooting/lyra-ui/components/lr-code-block-core.js';
import { createShikiOnigurumaEngine } from '@aceshooting/lyra-ui/components/conversation/code-block/shiki-oniguruma.js';
setShikiCoreEngine(createShikiOnigurumaEngine);
```

Configure the factory before rendering. The JavaScript preset and custom engine factories remain
supported. The opt-in import keeps the packaged binary outside default component import graphs.
