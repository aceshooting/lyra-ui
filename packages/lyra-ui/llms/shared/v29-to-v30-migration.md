# Upgrading from v29 to v30

## Migration scope

This guide is for applications moving from Lyra UI 29 to v30. Keep the exact package version you
test pinned while you migrate, and verify its availability in the package registry before updating
production dependencies.

V30 keeps the public component tags. The sections below list each behavior that changed; this
document is the project cleanup sequence, not a duplicate member inventory. For import, style, event
and SSR contracts use the focused guides: [imports and registration](./imports-and-registration.md),
[events and types](./events-and-types.md) and [styles and tokens](./styles-and-tokens.md).

## Migrate a project in reviewable steps

1. **Establish a clean comparison point.** Record the installed Lyra version, package manager lock
   and unrelated edits (`git status`). Use a branch or disposable worktree so a codemod report
   cannot mix with in-progress application work.
2. **Upgrade only Lyra and its lockfile.** Install the exact v30 package build being evaluated and
   confirm the resolved version. Do not change unrelated dependencies in this step.
3. **Run the collections review.** The `immutable-collections` rule only reports; it never edits
   source. Run it with the CLI of the installed release, review each site by hand, and acknowledge
   a reviewed site with a comment (see [Collections](#collections)):

   ```sh
   npx lyra-ui-migrate --rule=immutable-collections --check \
     --report=lyra-immutable-collections.json src
   ```

4. **Fix each reported site** by assigning a new array, as described below, then rerun the command.
   A clean second pass reports nothing. A zero exit is not proof that a dynamic use the scan cannot
   see (an array mutated in a helper and bound through a template) is correct.
5. **Verify the migrated application.** Run the project's typecheck and tests, and exercise every
   screen that mutates a list shown by one of the components in the table below.

## Collections

Components that keep the caller's own item objects (the identity-preserving collections: feeds,
queues, traces, task lists, virtual lists and similar) now ignore an assignment of the array they
already hold. Before v30, assigning the same array again re-read it, so code that changed an item or
called `push()`, `splice()` or `sort()` on the array and then assigned it back still rendered. In
v30 the one rule for every such property is:

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
| `lr-map` | `markers`, `dataLayers` |
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
- a local alias of the bound array that is changed in place and then assigned back.

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
