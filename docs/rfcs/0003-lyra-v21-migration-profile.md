# RFC 0003: Lyra 21 to Lyra 22 migration profile and rename ledger

- **Status:** Accepted
- **Decision:** Accepted by the maintainer on 2026-09-27, with renames shipping additively in 21.x
  minors under the unchanged deprecation rule (no policy amendment); questions 2–11 stay open.
- **Authors:** Lyra UI maintainers
- **Created:** 2026-09-27
- **Tracking issue:** None yet. Implements the migration half of the "Rename and removal policy" in
  [`docs/roadmap.md`](../roadmap.md); prerequisite for harmonization items 17–29 and for the 21.1.0
  deprecations of item 16. Shares the `--origin=lyra-v21` profile with
  [RFC 0001](0001-independent-style-axes.md) (style axes) and
  [RFC 0002](0002-tokens-once-per-document.md) (tokens once per document).
- **Supersedes / superseded by:** None

## Summary

Lyra-only attributes, properties, events, CSS parts, custom properties and slots are renamed
additively in 21.x minor releases. Each rename ships the new canonical name with the old one as a
deprecated alias, recorded with `since` set to that 21.x version and `removalNotBefore: 23.0.0`,
which the unchanged one-full-major deprecation rule already allows. Of these changes, v22 carries
only what an alias cannot keep compatible: a changed event-detail shape or default, and a rename
onto a name another component already exposes (see "Deprecation windows"). v23 removes the 21.x
aliases. This RFC decides three things:

1. **One codemod profile**, `lyra-ui-migrate --origin=lyra-v21`, driven by one authored ledger,
   `packages/lyra-ui/scripts/fixtures/lyra-renames.json`. Member entries must match an implemented
   `@deprecated` alias and its `component-metadata.json` record. The same ledger is projected into
   the packaged CLI and rendered into `llms/migration.md`. The ledger also carries the module
   entries RFC 0001 needs and enables the named structural rule RFC 0002 needs.
2. **A reach-preserving rewrite rule.** A name is rewritten only where the rewrite cannot change
   which components the site reaches. Events bubble and custom properties inherit, so proving the
   owner is not enough for them. Every other site is reported with a location and an explicit
   warning code. It can be acknowledged by a code-qualified comment, so `--check` works as a gate.
3. **Delivery with the renames.** The profile ships in the first 21.x minor that carries a rename
   or an item 16 deprecation, and each later minor adds its entries. A rename applies from its
   record's `since`; detail changes, preserved defaults (with the inverted renames that need them)
   and slot-content reports apply from 22.0.0. The deprecation policy does not change.

A working implementation with an empty ledger, and its tests, exist as feasibility evidence. They
land with that minor.

## Motivation

**The policy needs a tool that does not exist.** The roadmap promises a `--origin=lyra-v21`
profile that "rewrites attributes, properties, events and `::part()` selectors" and "reports
affected listeners" of detail-shape changes. `lyra-ui-migrate` has only two modes:

- Web Awesome/Shoelace to Lyra.
- An opt-in `--origin=lyra-v7` profile that inserts preserved defaults. Item 14 removes it.

Neither mode renames an `lr-*` member. Items 17–29 rename or reshape veto and close events,
`expanded`, contradictory boolean pairs, `accessible-label`, graph naming, `-click` events,
`with-`/`without-` spellings, `compact`, detail naming, `error-text`, `readonly`, `-placement`,
`heading-level` and `__` part names. That is too much to migrate by hand. The same facts feed the
alias, the codemod rule and the consumer reference, and three copies drift.

**Lyra-only names are short and shared.** In the 21.0.0 inventory of 296 components:

- 136 of 360 event names have several dispatchers (`lr-change` 33, `lr-input` 26, `lr-toggle` 19,
  `lr-close` 10).
- 373 of 1,394 part names are shared (`base` on 254 components).
- 152 of 1,866 custom properties are shared.

Renaming one component's copy must not touch another's. Proving the owner is also not enough:

- A listener bound on a component also hears the same event name bubbling from nested components.
- A custom property declared on a component inherits into every component nested below it.

A throwaway ledger of planned renames, checked against the real inventory with each alias
simulated, shows where this matters:

| Planned rename | What a name-only or owner-only rewrite would do |
|---|---|
| item 18, `lr-lightbox-close` → `lr-close` | Ten components already dispatch `lr-close`. Every moved listener would start hearing dialogs, drawers and tabs close. A close handler usually moves focus, so this breaks WCAG 2.4.3 and 3.2.1. |
| item 23, `lr-node-click` → `lr-node-activate` | `lr-flow-canvas` already dispatches `lr-node-activate`. |
| items 22–23, `lr-link-click` → `lr-edge-activate` | Only the graph components rename it; `lr-markdown`, `lr-markdown-core` and `lr-message-parts` keep `lr-link-click` for hyperlinks. |
| item 23, `lr-point-click` → `lr-point-activate` | All 12 dispatchers rename it and no component dispatches the new name yet, so every listener can move. |
| item 20, `arrow` → `without-arrow` | `lr-popup`'s `arrow` mirrors Shoelace and must not change. `lr-dropdown`'s `arrow` defaults to `false`, so an inversion also has to preserve the default. |
| item 21, `accessible-label` → `aria-label` | 9 of the 12 components do not declare `aria-label` on their surface. |

**A detail-shape change breaks silently.** Item 18 gives close events an object detail. An old
listener keeps compiling and keeps receiving events, but it reads `undefined`. No alias can fix
that, so every listener that may receive the event needs a person to review it.

**The deprecation window decides when renames ship.** `component-metadata.mjs` requires:

- `removalNotBefore` ≥ `since.major + minimumFullMajorsAfterDeprecation (1) + 1`, and
- `since` ≤ the current package version.

A rename deprecated in `22.0.0` could not be removed before 24.0.0. Only a rename made additively
in a 21.x minor, as item 16's 21.1.0 deprecations are, reaches removal in v23, so the profile ships
with the first such minor rather than with 22.0.0.

## Goals and non-goals

### Goals

1. **One authored source.** Every `lyra-v21` codemod input lives in the ledger: member renames and
   reviews, preserved defaults, detail changes, deprecated slot content, module entries, and
   enabled structural rules.
2. **Consistency with the implementation.**
   - A member entry must name a deprecated Lyra-only member, a matching record and an existing
     canonical name.
   - Completeness is enforced in `pnpm lint` only (`check-migration-coverage.mjs`): every Lyra-only
     record removed in 23.0.0 has an entry. A missing entry therefore never breaks `pnpm build`,
     `pnpm test` or a Web Awesome run.
3. **Coverage.**
   - Bindings in HTML, Lit, JSX/TSX, Vue, Svelte and Angular templates.
   - CSS files, `<style>` blocks, Lit `css`, `style` attributes, JSX style objects and
     `setProperty()`.
   - `exportparts`.
   - `querySelector`/`closest`/`createElement`-rooted calls.
   - `addEventListener`, `removeEventListener` and `@HostListener` (including `document:`,
     `window:` and `body:` targets).
4. **Reach never changes silently.** A site is rewritten only when it will reach exactly the
   components it reached before, apart from the owner-bound narrowing stated in the rule table.
   Everything else gets a report with a file, line, column and code.
5. **Behavior changes are reported.** This covers a listener that may receive an event whose detail
   changed, and a listener, `::part()` selector or declaration of a name that more components use
   after the upgrade.
6. **Reviewable operation.**
   - `--diff` preview and a stable JSON report.
   - Byte-identical idempotence.
   - Acknowledgements qualified by warning code, with stale acknowledgements reported.
7. **A self-contained published CLI.** It reads a prevalidated projection and applies only entries
   available in the installed release.

### Non-goals

- **Tag renames.** A deprecated tag is reported; tag aliases stay in the tag-alias registry.
- **Editing handler bodies or translating values.** `compact` → `size="s"` is reported, not
  rewritten.
- **Any change to a name mirrored from Web Awesome or Shoelace, or to its default.** The ledger gate
  rejects such entries.
- **Data flow and type-aware rewriting.** An element held in a variable is reported.
- **Removing the Lyra 7 profile.** That is item 14; its default-insertion mechanism is reused.

## Proposed public contract

### Deprecation windows (no policy change)

The ledger adds two per-profile checks on each rename and review record: `removalNotBefore` falls in
major 23, and `since` is no later than `22.0.0`. The unchanged gate adds `removalNotBefore` ≥
`since.major + 2`. Together they mean:

- A `lyra-v21` rename ships additively in a 21.x minor, as item 16 does, and its record's `since` is
  that minor.
- A rename onto a name another component already exposes (item 18's `lr-close`, item 23's
  `lr-node-activate`, or a shared part or custom property) is not additive. The moment the new name
  ships, existing listeners, `::part()` selectors and declarations of that name reach the renamed
  component too, so it lands in 22.0.0 and is removed in 24.0.0 through a `lyra-v22` profile.
- A rename that misses 21.x is deprecated in 22.x, removed in 24.0.0, and belongs to a later
  `lyra-v22` profile.
- `defaults`, `detailChanges` and `slotContent` entries have no record. `defaults` and
  `detailChanges` describe v22 changes; the projection stamps them, and `slotContent` entries,
  `since: "22.0.0"`, so item 16's `lr-menu` content is reported from 22.0.0 on.
- An inverted rename paired with a `defaults` entry changes what absence means, so the profile
  applies it from 22.0.0 with that entry. Applied under 21.x, removing `lr-dropdown`'s `arrow` would
  hide the arrow, because the default flips only in 22.0.0.
- The `lyra-v21` ledger is complete at 22.0.0, so the CLI of any 22.x release applies the same
  profile.

### CLI (compatible, additive)

```bash
# Run the CLI of the installed release, after upgrading. Preview (writes nothing):
npx lyra-ui-migrate --origin=lyra-v21 --diff src > lyra-v21.patch
# Gate (exits 1 while a rewrite or an unacknowledged report remains):
npx lyra-ui-migrate --origin=lyra-v21 --check --report=lyra-v21.json src
npx lyra-ui-migrate --origin=lyra-v21 src   # apply
```

| Option | Status | Behavior |
|---|---|---|
| `--origin=lyra-v21` | new value | Runs this profile. It never touches `wa-*`/`sl-*` code and does not combine with an upstream run. |
| `--diff` | new, every mode | Implies `--dry-run`. Stdout carries only a `git apply` patch; per-site lines and the summary go to stderr. Paths are relative to the working directory; in a monorepo package, apply with `git apply --directory=<package>`. A target outside the working directory fails the run instead of emitting `a/../x`. |
| `--lyra-version=x.y.z` | new | Applies only entries whose `since` is at or below this version. It defaults to the `@aceshooting/lyra-ui` found in `node_modules` above the working directory, and to every entry when none is found. Withheld entries are counted in `summary.skipped`. |
| `--dry-run`, `--check`, `--report`, `--ext` | unchanged | `--check` fails while a file would change or an unacknowledged warning remains. |

### JSON report (compatible, additive)

- `schemaVersion` stays 1, and entry fields are unchanged.
- `origin` is `"lyra-v21"`.
- `upstreamTag` is the owning Lyra tag, or `null` when several own the name.
- `upstreamMember` is the old name. For the default slot it is `""`, acknowledged as `#default`.
- `summary` gains `acknowledged` (rename profiles) and `skipped` (when a version is known).

Actions:

- `rewrite-attribute`, `rewrite-property`, `rewrite-event`, `rewrite-part`, `rewrite-css-property`,
  `rewrite-slot`.
- `remove-attribute`: an inverted boolean that restated its default.
- `insert-default`.

| Warning code | Emitted when |
|---|---|
| `RENAME_REVIEW` | An old name the tool cannot move for any other reason: a site that does not prove its owner while some exposer keeps the name; a `::part()` selector whose compound does not name the owner; an attribute selector whose new attribute does not reflect; a listener of an event the scanned code dispatches itself; an event-name string outside a listener call; a Svelte shorthand. |
| `RENAME_TARGET_SHARED_REVIEW` | The new name is already exposed by a component that did not rename onto it, so moving the site would widen it. This applies to owner-bound listeners too. |
| `NAME_GAINED_OWNER_REVIEW` | A listener, `::part()` selector or custom-property declaration of a name that components renamed onto. It is emitted when the site does not prove an owner that already exposes the name. |
| `POLARITY_REVIEW` | An inverted boolean is bound, assigned or selected, or is set statically where the framework may assign a property (JSX, Vue, Svelte, untagged template strings). |
| `RETIRED_EVENT_REVIEW` | A listener or event-name string may use an alias already removed in the target release. Review its replacement, nested targets and existing canonical handlers together. |
| `DETAIL_SHAPE_REVIEW` | A listener may receive an event whose detail changed. It is never rewritten away. |
| `DEPRECATED_MEMBER_REVIEW`, `DEPRECATED_CONTENT_REVIEW` | A deprecated member, tag, default slot, or listed slotted element without a mechanical replacement. |
| `RENAME_CONFLICT_REVIEW` | The rewrite would bind one name twice on an element (Lit throws, Vue and Svelte refuse to compile, TSX reports TS17001), or the element already binds the new name. |
| `DYNAMIC_VALUE_REVIEW` | A JSX/Svelte spread, a `v-bind`/`v-on` object or a Lit element binding on a component with renamed or deprecated members. |
| `UNUSED_ACKNOWLEDGEMENT` | An acknowledgement token is malformed or matches no report on the lines it covers. |
| `ALIASED_MEMBER_REVIEW`, `MAPPING_REVIEW_BLOCKED` | Existing default-insertion hazards, as in the Lyra 7 profile. |

Tooling that switches on `warningCode` treats an unknown code as "manual review required".

### Acknowledgement comment

A report is acknowledged by `lyra-migrate-reviewed: CODE:name`, for example
`DETAIL_SHAPE_REVIEW:lr-close`. Several tokens may share one comment. Accepted forms are
`<!-- -->` (including inside Lit/Angular template literals), `/* */`, `//` and JSX `{/* */}`.

A token covers:

- the comment's own lines;
- the next line, when the comment stands alone on its line;
- every line of the opening tag that directly follows the comment, so a Prettier-wrapped element
  needs one comment.

Accepting one code never hides another. Acknowledged reports are counted, not listed. Rewrites
cannot be acknowledged.

### Ledger

The file is `packages/lyra-ui/scripts/fixtures/lyra-renames.json`, schema 1, with one entry in
`profiles` per supported origin. The entries below are illustrative.

```json
{
  "origin": "lyra-v21", "fromMajor": 21, "toMajor": 22, "aliasRemovalMajor": 23,
  "renames": [
    { "tag": "lr-tooltip", "kind": "attribute", "from": "arrow", "to": "without-arrow",
      "polarity": "inverted" }
  ],
  "defaults": [{ "tag": "lr-dropdown", "attribute": "without-arrow", "value": true }],
  "detailChanges": [
    { "tag": "lr-lightbox", "event": "lr-close", "summary": "The detail is now { reason }." }
  ],
  "reviews": [{ "tag": "lr-stat", "kind": "slot", "name": "" }],
  "slotContent": [
    { "tag": "lr-menu", "slot": "", "allow": ["lr-divider", "lr-menu-item"],
      "summary": "Only items belong in the default slot." }
  ]
}
```

| List | Entry | Record | Codemod |
|---|---|---|---|
| `renames` | `tag`, `kind` (`attribute`, `property`, `event`, `part`, `css-property`, `slot`), `from`, `to`, `polarity?` | required | rewrite or report |
| `reviews` | `tag`, `kind` (any record kind), `name`; `""` is the default slot | required | report with the record's replacement |
| `defaults` | `tag`, `attribute`, `value` (string, number, `true`) | — | insert where the attribute and its renamed counterpart are both absent |
| `detailChanges` | `tag`, `event` (Lyra 22 name), one-line `summary` | — | report listeners |
| `retiredEvents` (optional) | `tag`, `event` (removed name), `replacement` (current event), one-line `summary` | published policy history, not a current deprecation | report listeners and strings; never rewrite listener reach |
| `propertyChanges` (optional) | `tag`, `property`, one-line `summary` | — | report assignments whose accepted values or behavior change without a rename |
| `slotContent` | `tag`, `slot`, exactly one of `report` or `allow` (element names), `summary` | — | report matching direct children |

`retiredEvents` may also be omitted by older profiles and runtime projections. Its entries apply
from the profile's target major. They describe aliases that are already absent, so reports never
promise a remaining compatibility window. The current inventory must omit the old event on its
owner and expose its nondeprecated replacement. The coverage gate checks every entry against
`scripts/fixtures/retired-event-history.json`, a bounded snapshot of the published policy records
and release metadata digest. It rejects missing reports, changed replacements, unsupported
historical claims, and removals before the published policy floor or before one whole later major.
Current deprecation records remain reserved for aliases that still exist.

The Lyra 21 profile covers nine such events retained in 21.2.0 after deprecation in 19.0.1
(removal floor 21.0.0): eight `lr-before-*` veto aliases on box-plot, chart, graph-legend and
graph-query-builder, plus command-palette's `lr-open` lifecycle alias. Move veto logic to the
canonical `*-request` event. For the palette use `lr-show`; preserve unrelated `lr-open` item
activation listeners on document-library and source-card. Reports leave source unchanged because
nested components, global listeners, custom dispatches, and existing canonical registrations can
make even a spelling replacement change which events a handler receives or how often it runs.

`propertyChanges` may be omitted by older profiles and published runtime projections. Like detail
changes, it applies from the profile's target major. It reports `PROPERTY_CHANGE_REVIEW` at property
bindings and assignments without guessing how to rewrite runtime values. For example,
`lr-app-rail-group.headingLevel` now accepts the shared string vocabulary: a numeric property
assignment needs review, while the HTML `heading-level="3"` spelling remains valid. These changes
do not create deprecation notices for a surviving property name.

**Validation.** The ledger is shape-checked by the published CLI too, and entry-checked against the
inventory in the repository.

- Entries are sorted and unique, and names match their kind's grammar.
- No rename target is itself renamed (idempotence), and no member is both renamed and reviewed.
- The component exists. `from` is public and `@deprecated`, and its record names `to` with the
  removal and `since` windows above. `to` exists and is not deprecated.
- `from`, a detail event and a preserved attribute are not mirrored.
  - A member is mirrored when a counterpart mapping keeps or rewrites an upstream member onto it.
  - Mirrored deprecations are also exempt from completeness: they follow their upstream.
  - The one exception is a preserved attribute that completes an inversion.
- A custom property in `tokens/canonical-tokens.json` is rejected. Twenty component custom
  properties (`--lr-graph-cat-*`, `--lr-color-chart-*` and others) are shared design tokens, not
  component-owned names.
- **Absent must keep meaning what it meant.** A boolean that defaults to `true` becoming one that
  defaults to `false` must either declare `polarity: "inverted"` or preserve presence through a
  `defaults` entry. The `editable` → `readonly` and `arrow` → `with-arrow` cases need no
  name-prefix heuristic.
  - An inverted rename must target a `false`-defaulting boolean.
  - A `false`-defaulting source (`lr-dropdown`'s `arrow`) additionally needs the `defaults` entry
    that inserts the target where both are absent.
- `check-migration-coverage.mjs` keeps the prefix rule on top: a negating prefix against an
  asserting prefix or against none needs a declared inversion, and a declared inversion between
  agreeing prefixes is rejected.

### Module entries and structural rules (reconciles RFCs 0001 and 0002)

RFC 0001's facade migration and RFC 0002's theme-scope marker are part of this one profile, not
separate tools. The schema reserves two further lists. Each is implemented by the first change
that needs it, with its tests: `globals` by item 16's module deprecations or RFC 0001's stage 1,
whichever lands first; `rules` by RFC 0002's delivery.

- **`globals`** are entries not owned by an `lr-*` tag. Each has a `kind` (`module`, `export`,
  `document-event`, `attribute-selector`), `from`, an optional `module` and `to`, and a one-line
  `summary`.
  - A `module` entry rewrites literal specifiers in `import`/`export … from`, `import()`, CSS
    `@import` and `<link href>` when the new module is a drop-in replacement.
  - An `export` entry rewrites only the import clause, as `New as Old`, so no scope analysis is
    needed and local references keep working.
  - Everything else is reported: facade functions, `lr-theme-change`, `data-lr-theme-preset`
    selectors, and RFC 0001's `themes/shadcn.css` and `theme/presets/shadcn.js` imports, which are
    not drop-in.
  - Item 16's `DocumentFile` and `DocumentRendererDefinition` types and its retired localization
    entry point are `globals` entries.
  - A `module` entry is checked against `package.json#exports`, and an `export` entry against the
    public declaration surface.
- **`rules`** lists named structural rules that are implemented and tested in the codemod, such as
  RFC 0002's `theme-scopes`. A rule may insert markup or report, and its data stays in the code
  that tests it. A profile with an enabled rule is never treated as empty.

Completeness covers `component-metadata.json` records. RFC 0001's stage 1 adds module-level records;
from then the check pairs `globals` entries with them, and their window follows question 11.

### Rewrite rules

The **owner** of a site is proven by:

- the opening tag of a markup binding;
- the type selector of the compound in front of `::part()`, `[attr]` or `:state()` (including
  Svelte's `:global(lr-x)`);
- or a `querySelector`/`closest`/`createElement('lr-…')` call followed directly by a member.

For an exposure kind (event, part, custom property) and a rename `from` → `to`:

- **Movers** are the components that rename `from` to exactly `to`.
- A rename is **global** when:
  - every exposer of `from` is a mover;
  - every exposer of `to` is a mover;
  - and there is no polarity flip.

The projection records exposers of both names, so the published CLI decides this without the
inventory.

| Kind | Rewritten | Reported |
|---|---|---|
| attribute, property | `a`, `?a`, `.p`, `[attr.a]`, `[p]`, `:a`/`v-bind:a` (spelling kept), `bind:p`, JSX `a={…}`/`p={…}` on the owner; anchored `.p` and `*Attribute('a')`; `T[a]` only when `to` reflects | `*Attribute('a')` and `.p` on unproven receivers in a file that uses the component; `T[a]` when `to` does not reflect; Svelte `{p}` shorthand; spreads |
| inverted boolean | static presence, `""`, `"true"` or `"a"` is removed, and the exact literal `"false"` becomes presence of `to`. Only in HTML/Markdown files and Lit `html`/`svg` templates, without a companion default insertion | every binding, selector, assignment, other literal, any explicit value with a companion default insertion, and any static value in JSX, Vue, Svelte or untagged templates |
| event | an owner-bound listener when no non-mover exposes `to`, even if a non-mover still dispatches `from` (the owner-bound listener stops hearing it from nested elements; the change message names them). Any listener when the rename is global. Never a name the scanned code constructs (`new CustomEvent('lr-…')`) | everything else, as `RENAME_REVIEW` or `RENAME_TARGET_SHARED_REVIEW`; event-name strings outside listener calls; listeners of gained names |
| part | `T::part(a)` when `T` renames `a`; `exportparts` on the owner (`a` becomes `b:a`, keeping the exported name) | every other `::part(a)` (class, foreign type, untyped); unowned selectors of gained names |
| css-property | every occurrence, only when the rename is global | every other occurrence; declarations of gained names |
| slot | `slot="s"`, `v-slot:s`, `#s` on direct children of the owner | default-slot reviews on unslotted children; `slotContent` matches |
| detail change | never | every listener or event-name string that may receive the changed event, except one bound on a component that dispatches the name with an unchanged detail |

A listener bound on a component that dispatches the same name already hears nested dispatchers, so
it gets no `NAME_GAINED_OWNER_REVIEW` or detail report for them.

An inverted rename with a companion default insertion is withheld until that default change ships.
Explicit values then require review: removing a true alias would let a second migration pass insert
the inverse default and change the result, and a false-defaulting presence boolean can treat even
the literal `"false"` as true. Keep those aliases until default insertion is complete, then migrate
them by hand using the old converter's behavior.

Comments are never scanned for names, including HTML comments inside template literals. Default
insertion is blocked for a component across the whole scanned set when a DOM alias or an opaque
spread reaches it, as in the Lyra 7 profile. The acknowledgement name for those reports is the tag.

### Packaged CLI (internal, compatible)

- `dist/cli/` gains `lyra-rename-ledger.mjs`.
- `migration-contract.json` gains `lyraRenames`, the validated projection: entries plus `since`,
  `reflects` for attribute renames, review replacement and removal text, and exposure lists for old
  and new names.
- `migrationRuntimeSchemaVersion` becomes 2.
- The build refuses to run without a ledger or with an invalid entry, but accepts an incomplete
  ledger. `dist/cli/` is not reachable through `package.json#exports`.

### Consumer reference

`llms/migration.md` (and the packaged skill copy) gains a generated section. It contains the
commands, the rules, the code table, the acknowledgement syntax and the SSR note, plus one table per
non-empty ledger list. With an empty ledger it states that no Lyra 21 names are scheduled to change.

## Composition and interaction

**Pipeline.**

1. The authored ledger.
2. `validateRenameLedger()` checks entries against the inventory (completeness only in lint).
3. `projectRenameLedger()`.
4. `createRenameProfiles()` answers movers, keepers, gained owners and version gating from data, so
   the scanners never hard-code a component.
5. `migrateText()` collects non-overlapping edits and located reports.
6. `migrateFiles()` runs two passes over the scanned set. The first collects default-insertion
   hazards and constructed event names; the second applies edits.

**States.**

- An empty profile returns its input unscanned. With `globals` or `rules`, "empty" means no entries
  and no enabled rules.
- A malformed ledger or projection fails closed, listing every problem.
- An unknown origin, no matching files and write failures behave as today.

**Idempotence.** A rerun of the output makes no edit and reproduces the same report identities
(line, code and member).

**Ordering.** The upstream inventory maps `wa-*`/`sl-*` straight to current Lyra names, so an
upstream migration never needs this profile. A Lyra 21 application runs it after upgrading, within
21.x or to 22.

Keyboard, focus, pointer, loading and narrow-allocation behavior do not apply: this is build-time
tooling with no rendered interface.

## Accessibility, localization, and RTL

The tool renders no interface. Semantics, focus, live regions, form behavior, forced colors and
reduced motion therefore do not apply to it. Its messages are developer-facing English, like the
existing CLI.

Its effects on consumer code:

- **Focus and context changes.** A rename that would make a close or activate handler hear more
  components is never applied, because those handlers move focus. It is reported instead
  (`RENAME_TARGET_SHARED_REVIEW`, `NAME_GAINED_OWNER_REVIEW`).
- **Accessible names (item 21).** `accessible-label` may be renamed to `aria-label` only on a
  component that declares `aria-label` on its public surface and tests the computed name. The gate
  enforces this, because `to` must be on the surface. Every other component gets a `reviews` entry.
  Item 21 owns normalizing the `''` and `undefined` defaults.
- **Polarity.** An inverted boolean that controls a visible affordance never flips from a dynamic
  value, or from a string a framework may assign as a property.
- **Defaults.** A `defaults` entry preserves only a deliberate re-styling or re-layout. A default
  change that fixes hit area (the 24px floor), contrast or focus behavior never gets one, so the fix
  reaches every consumer.
- **RTL.** A name that mentions a physical direction is renamed verbatim. Logical-property
  conversion stays each component's responsibility.

Pending evidence: none for the tool. Each harmonization change owns its own assistive-technology,
RTL and forced-colors evidence.

## Platform, security, and packaging

**Runtime.**

- Node only, on the package's supported versions: Node 20 today, 22 after item 34.
- Browser support and the Popover floor (item 35) do not apply. There are no optional peers, no
  remote content, no dependencies and no network access.
- The CLI reads and writes only the target files and the report. It never evaluates scanned code.

**Performance.** The scanners are linear. Two quadratic paths are replaced:

- a rule-body regular expression, which took 10 s on 80 KB of brace-free text;
- edit assembly that re-sliced the whole file per edit. It is shared with the Web Awesome mode, and
  its output is byte-identical.

Repeated fixtures of 400 KB now take 75–150 ms, and a test bounds 400 KB inputs.

**SSR and hydration.** The codemod changes Lit template strings, and Lit hydration compares a digest
of those strings. Prerendered or cached server HTML must therefore be regenerated after migrating,
and server and client code deployed together. The generated reference says so.

**Component graph.** The CLI is not part of the component graph. It has no side-effect, tree-shaking
or bundle impact.

**Package cost**, measured on modules compacted by the build's own `compactBuildJavaScript()`,
before the version bump:

| Artifact | Before | After | Change |
|---|---:|---:|---:|
| `dist/cli/*.mjs` (2 → 3 files), raw | 228,389 B | 305,137 B | +76,748 B |
| `dist/cli/*.mjs`, gzip | 51,593 B | 71,864 B | +20,271 B |
| `migration-contract.json`, raw / gzip | 404,601 / 32,041 B | 404,849 / 32,161 B | +248 / +120 B |
| `llms/migration.md`, raw / gzip | 39,106 / 7,732 B | 41,970 / 8,843 B | +2,864 / +1,111 B |

Against `scripts/package-budgets.json`, measured before the version bump:

- **Packed:** about 21.5 KB of the 34,000 B headroom. This is a sum of per-file gzip sizes, an
  upper bound for the tarball.
- **Unpacked:** about 80 KB of the 140,000 B headroom.
- **Files:** +1 of the 7-file headroom reserved for the next component's artifacts.

Each future entry adds about 150 B of projection. Moving repository-only validation out of
`dist/cli` would save about 2.3 KB gzip; item 36 recovers far more. `check:package-size` runs in
CI but is not part of `pnpm lint`. It, the full `pnpm build` and `check-packed-consumer.mjs` must
run in CI before the implementation merges (unresolved question 6).

**Clean room and security.** The design derives only from this repository's inventory,
deprecation records, roadmap and public platform behavior. No third-party codemod source, rules or
fixtures were consulted. Synthetic fixtures use invented components (`lr-sample-panel`,
`lr-sample-other`, `lr-sample-legacy`).

## Compatibility and migration

**Semver.**

- Each rename minor is additive: a canonical name, a deprecated alias and a ledger entry; a rename
  onto an already-exposed name is the exception (see "Deprecation windows").
- The CLI change is additive and ships with the profile: a new origin, `--diff`,
  `--lyra-version`, and new codes, actions and summary keys.
- Web Awesome, Shoelace and Lyra 7 runs keep their output, messages and exit codes. Only the usage
  text and the `parseArgs()` result shape (a `lyraVersion` key) change.
- What no alias can keep compatible lands in 22.0.0: a changed event-detail shape with a
  `detailChanges` entry, and a changed default with a `defaults` entry where the old value is kept.
- No release or deprecation policy changes; every record passes today's gate.

**The alias contract.**

- Old and new names reach the same behavior.
- An aliased event fires once per dispatch under each name.
- Through 21.x both names carry the Lyra 21 detail. When 22.0.0 changes a detail, only the canonical
  name carries the new shape; the deprecated name keeps its Lyra 21 detail. A listener left on the
  old name is therefore correct until v23, and one moved during 21.x is reported
  (`DETAIL_SHAPE_REVIEW`) when the profile runs on 22. When its rename is reported, the report
  carries the detail summary.

**Consumer sequence.**

1. After upgrading to a 21.x rename minor, run `--diff`, then apply. This step is optional: the old
   names keep working until v23, and the Lyra 22 CLI applies every rename too.
2. After upgrading to Lyra 22, run the profile again. It adds the detail-change, default and
   slot-content entries, and the `globals` and `rules` of RFCs 0001 and 0002.
3. Resolve or acknowledge each report.
4. Keep `--check` in CI until the migration merges, then remove it.

`DETAIL_SHAPE_REVIEW` and `NAME_GAINED_OWNER_REVIEW` also fire on code written for Lyra 22, so a
permanent gate would demand acknowledgements on new code (unresolved question 7). Old names
reintroduced later keep working until v23 and show as deprecated in editors.

**Invalid or unsupported input is reported:** dynamic values, spreads and shorthands, element
aliases, unknown receivers, selectors without a proven owner, and dynamic slot names. The code keeps
working through the aliases until v23.

**Lyra 7 profile.** Unchanged. Its default-insertion code is now shared with this profile, and its
messages are byte-identical.

## Alternatives considered

1. **Deprecation window.** Chosen: additive 21.x minors under today's gate. Rejected:
   - Renaming in 22.0.0 and amending the gate so that a deprecation made in `N.0.0` counts major N
     as its full supported major: it changes the deprecation policy for every record.
   - Renaming in 22.0.0 and removing the aliases in v24: it keeps two alias generations alive at
     once.
   - Renaming in 22.0.0 with `since` backdated to 21.x: this makes the record false.

   The accepted cost: each rename lands on the 21.x line and is carried into v22, and a rename that
   misses 21.x waits for a `lyra-v22` profile.
2. **A migration marker on each deprecation record** instead of a ledger. Defaults, detail changes,
   slot content and structural rules are not deprecations. The marker would also leak into
   `custom-elements.json` and editor data. The two-way check gives the same no-drift guarantee.
3. **Generating records from the ledger.** Records carry authored `since`, rationale and usage text
   that the ledger does not own.
4. **Rewriting by name, or by owner alone.** The planned renames above show that
   it would widen close and activate listeners, reinterpret `::part()` selectors behind
   `exportparts`, and move inherited custom properties away from nested components.
5. **Declaring both custom-property names side by side** instead of reporting shared names. This is
   idempotent in stylesheets, but fragile in `style` attributes, JSX objects and `setProperty()`.
   It remains a possible later mode (unresolved question 8).
6. **A parser-based codemod.** It would need HTML, Vue, Svelte, JSX, CSS and MDX parsers in a
   dependency-free binary. Reach through bubbling and inheritance would still be unknowable without
   running the application, so the "unchanged reach or report" contract would not change.
7. **Aliases with console warnings and no codemod.** Every consumer would rename by hand before v23.
8. **Rewriting handlers for detail changes.** Whether and how a handler reads `detail` cannot be
   decided mechanically.
9. **Name-only acknowledgements, or a baseline file.** A name-only token hides later reports of
   other kinds. A line-keyed baseline goes stale as code moves. Code-qualified comments with stale
   detection avoid both (unresolved question 5 keeps a baseline for generated code).
10. **Separate codemods per RFC.** Consumers would run three tools for one upgrade, and each tool
    would reimplement comment handling, reports and acknowledgements.

## Test, documentation, and rollout plan

### Feasibility evidence (lands with the profile)

The evidence is an implementation with an empty checked-in ledger, and synthetic fixtures under
`scripts/fixtures/lyra-renames/`:

- **`lyra-rename-ledger.test.mjs`, 42 tests.**
  - Every schema, record, window, mirroring, shared-token and default-meaning rejection.
  - Completeness in lint only.
  - Exposure of old and new names, version gating, and tampering.
  - Reviewed snapshots for HTML, Lit, JSX, Vue, Svelte and CSS. Together they exercise all eight
    actions and all twelve codes, each checked for byte-identical reruns.
  - Focused tests: duplicate bindings in Lit, Vue and JSX; Angular and opaque object bindings;
    listener reach; `@HostListener('document:…')`; `customElements.get()`/`matches()` versus
    `handlers.get()`; `::part()` behind `exportparts`; shared and global custom properties;
    inversion per file syntax; reflection; default slot and slot content; scoped, stale and
    Lit-template acknowledgements; dispatch-blocked events across files; linear time; `--diff`
    path safety; and the packaged CLI's diff, check, apply, version and acknowledge cycle.
- **`migrate-wa.test.mjs`** keeps its 85 tests green.
- **`check-migration-coverage.mjs`**, `build-llms.test.mjs`, `llms-freshness`, `llms:check`,
  `check:script-paths`, `check:source-policy` and `check:test-assertions` pass.
- **A throwaway ledger** of the planned renames produced the table in the motivation against the
  real inventory. It is not checked in.

### Implementation change (with the profile)

1. The infrastructure above with an empty ledger. `test:migrate-wa` and `test:tooling` run the new
   suite.
2. 22.0.0 version gating for an inverted rename paired with a `defaults` entry, which the evidence
   does not yet do: the projection stamps such a rename with that entry's `since`.
3. The `docs/agents/upstream-parity.md` rule and its `AGENTS.md` digest line: alias, record and
   ledger entry land in one change.
4. A `minor` changeset that describes only what ships.
5. In CI: full `pnpm build`, `check-packed-consumer.mjs` (four-file `dist/cli`, and
   `--origin=lyra-v21` from the packed tarball) and `check:package-size`. The packed check proves
   loading only, because an empty profile scans nothing.
6. Multi-engine, visual and hydration lanes do not apply: nothing renders.

### Rollout

1. Accepted with RFCs 0001 and 0002 on 2026-09-27; their migration sections cite the `globals` and
   `rules` lists here.
2. The implementation lands in the first 21.x minor that carries a rename or an item 16
   deprecation, with that minor's entries.
3. Each harmonization change adds its alias, record (`since` set to the 21.x minor that ships it,
   `removalNotBefore: "23.0.0"`; 22.0.0 and 24.0.0 for a rename onto an already-exposed name) and
   ledger entry together. The gate rejects any partial combination.
4. Item 16's 21.1.0 member records each need a `renames` or `reviews` entry before lint passes; its
   slot-content, type and localization-entry deprecations also get `slotContent` and `globals`
   entries, which completeness does not gate (for `globals`, see question 3).
5. Each rename minor, and 22.0.0, runs `--origin=lyra-v21 --check` over the repository's own
   stories, examples and docs. The rename lists close with the last 21.x minor; 22.0.0 adds the
   detail-change, default and slot-content entries and the `globals` and `rules` of RFCs 0001 and
   0002, and the profile is then frozen.
6. In 23.0.0 the aliases and records are removed (see unresolved question 2).

**Rollback.** Revert the profile, the ledger and the `dist/cli` module. Every run can be previewed,
and every rewrite targets a name that keeps working until v23.

## Unresolved questions

Numbers are stable; closed questions keep their place.

1. **Closed: deprecation window.** Renames ship additively in 21.x minors under the unchanged
   one-full-major rule; the deprecation policy is not amended.
2. **Keep `--origin=lyra-v21` after v23?** It would help consumers who skip a major, but it needs a
   "retired profile" validated against the Lyra 22 release manifest instead of live aliases.
3. **Module-level deprecations made before RFC 0001's stage 1** (item 16): record them
   retroactively, or keep their completeness a review duty?
4. **A `token` kind** for shared design tokens (item 22's `--lr-graph-*`), validated against the
   compatibility metadata in `tokens/canonical-tokens.json`.
5. **An optional acknowledgement baseline file** for generated code that cannot carry comments.
6. **Package budget.** Accept about 21.5 KB packed within the current headroom, or first move
   repository-only validation out of `dist/cli`?
7. **A code filter for `--check`** (for example `--ignore-code=DETAIL_SHAPE_REVIEW`), for teams that
   want a permanent gate.
8. **Side-by-side declarations** for shared custom properties instead of reports.
9. **Narrower default-insertion blocking.** Today a single `querySelector('lr-x')` anywhere blocks
   insertion for `lr-x` everywhere and needs an acknowledgement. Should only property writes through
   the alias block it?
10. **Recording `since` before the release.** The gate caps `since` at the package version, which
    changesets raises only when it releases. Does a rename minor bump the version when its work
    opens, or land its records with the release? Item 16's 21.1.0 records face the same choice.
11. **Other deprecations made in 22.0.0.** The unchanged rule keeps them through v23, so RFC 0001's
    theming facade, preset API and fixed `themes/shadcn.css` are removable no earlier than 24.0.0.
    Their `globals` entries report them either way; the actual removal release remains open.
    An earlier deprecation must ship in a real 21.x minor and cannot be backdated. RFC 0002's bare
    `.light`/`.dark` scopes leave with that stylesheet.
