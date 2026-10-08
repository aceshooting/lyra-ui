# Report gaps, bugs, and improvement ideas on a user's behalf

`https://www.lyra-ui.com/api/v1/feature-requests` is the single automated intake for anything an
assistant finds wrong with, missing from, or worth improving in lyra-ui on a user's behalf (a person
filing their own report can use the GitHub routes in `SUPPORT.md`). Reportable:

- **Missing component:** no `lr-*` tag covers the need.
- **Missing capability** on an existing component: a prop, variant, slot, event or CSS part.
- **Bug or inconsistency:** behavior that is wrong, contradicts the component's documented contract
  (`references/components/<tag>.md`) or differs from a sibling component.
- **Optimization:** unnecessarily slow, heavy (bundle size) or awkward (API friction) with a
  concretely better shape in mind.

For a *missing component* first rule out a naming mismatch (skip this for the other kinds): check
`references/index.md` for a component with the same job under another name, then the live catalog,
a free read-only call that files nothing, as many phrasings as you like:

```bash
curl -sS 'https://www.lyra-ui.com/api/v1/components/search?q=kanban+board+swimlane'
```

**Ask before you file.** Filing sends the user's description to an external service. Show the user
exactly what you will submit and get explicit agreement before POSTing; never file as a silent side
effect of noticing something, for any kind of report.

```bash
curl -sS -X POST https://www.lyra-ui.com/api/v1/feature-requests \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Kanban board",
    "description": "Needed a drag-and-drop board with swimlanes for a task view; nothing in the catalog covers it.",
    "use_case": "A task-tracking view where cards move between status columns.",
    "searched_for": ["kanban", "board", "swimlane", "drag drop"],
    "settled_for": "a hand-rolled div grid with HTML5 drag events",
    "kind": "feature",
    "labels": ["feature:new-component"],
    "agent": "claude-code",
    "model": "claude-opus-4-1"
  }'
```

**Fill in every field on every report**; the optional ones exist only so older clients keep working.
An unclassified report waits in a manual triage queue.

- `title`: short and specific (`"lr-select ignores disabled on keyboard nav"`, not "select bug"),
  at most 120 characters. Name components by tag (`lr-kanban-board`) so the gap is searchable.
- `description` (at most 4000): missing component, the behavior needed plus the `lr-*` components
  checked and why each fell short (this separates a real gap from a naming mismatch); bug, the
  component and version, the exact attribute/property/event/part, what the contract promises
  versus what happens; gap, what is missing and why; optimization, the concrete cost (bundle KB,
  render count, boilerplate) and the shape you expect.
- `use_case`: generic context, one or two sentences, no product or client names.
- `searched_for`: names tried (missing component) or related keywords looked up (anything else).
- `settled_for`: what was used instead, the workaround applied, or the current approach.
- `kind`, `labels`: the classification below.
- `agent`: your agent or client name (e.g. `claude-code`). `model`: the exact id of the model that
  wrote the report.

`name` and `email` are optional; anonymous is the default. Ask the user whether they want to be
reachable before adding either, and never invent, guess or reuse an address from git config, an
earlier message or the environment. Submissions are stored privately and shown only to the
maintainer. The response lists the closest existing components (often answering a missing-component
report outright, so read it) and an `id`; status is readable at
`https://www.lyra-ui.com/api/v1/feature-requests/{id}`.

**Never include private material.** Submissions leave the user's machine: no source code, client or
product names, file paths or credentials. If the report cannot be made generic, do not file it. Use
the API even when working inside the lyra-ui repo itself; never write the report into a local file
or open a GitHub issue on the user's behalf.

## Classify every report

Set `kind` to exactly one category and `labels` to every sub-category label that applies (at most
12; a label from another category is fine as a secondary facet, e.g. `"kind": "harmonization"` with
`"bug:keyboard"`). Values are validated — an unknown one is rejected with a 422 that lists the
allowed values. Do not send `component:`, `family:`, `resolution:` or `topic:` labels: component and
family tags are added automatically from the `lr-*` tag names in your text (so name components by
tag), and the rest are set by the maintainer. The response lists every label stored.

Categories (`kind`) and their sub-category `labels`:

- `bug` — existing behaviour is wrong against the docs or a reasonable expectation:
  `bug:crash` (throws, blank or broken render) · `bug:state-data` (wrong value or state,
  controlled vs uncontrolled drift, numeric guards) · `bug:events` (missing, duplicate, mistimed or
  misshaped events) · `bug:lifecycle` (connect/disconnect/reconnect, SSR/hydration, teardown) ·
  `bug:async-race` (stale async results, races, ordering) · `bug:leak` (listeners, observers,
  timers or memory not released) · `bug:accessibility` (names, roles, ARIA relationships,
  screen-reader output, live regions) · `bug:keyboard` (keyboard interaction, roving tabindex,
  shortcuts) · `bug:focus` (focus management, return, trap, visibility) · `bug:i18n`
  (localization, translated strings, Intl formatting) · `bug:rtl` (right-to-left layout, mirroring,
  arrow direction) · `bug:forms` (form participation, validation, reset, native-control contracts)
  · `bug:layout` (sizing, overflow, responsive/container behaviour, scroll) ·
  `bug:overlay-positioning` (popups, top layer, stacking, anchoring) · `bug:styling-theming`
  (tokens, parts, custom properties, dark mode) · `bug:visual-states` (hover, active,
  focus-visible, disabled, selected affordances) · `bug:motion` (animation, transitions, reduced
  motion) · `bug:cross-engine` (Gecko-, WebKit- or Chromium-specific) · `bug:security` (XSS, unsafe
  URLs, sanitization, remote content) · `bug:packaging` (exports, side effects, registration,
  bundling, peers) · `bug:types-contracts` (TypeScript types, element manifest, generated
  contracts) · `bug:docs` (documentation or examples are wrong) · `bug:tooling` (CI, gates,
  build/test tooling)
- `optimization` — runtime cost: `optimization:render` · `optimization:layout-thrash` ·
  `optimization:observers-listeners` · `optimization:memory` · `optimization:algorithmic` ·
  `optimization:loading`
- `size` — bytes shipped or bundled: `size:js-bundle` · `size:css` · `size:dependencies` ·
  `size:lazy-loading` · `size:package`
- `dedup` — the same thing implemented more than once: `dedup:logic` · `dedup:styles` ·
  `dedup:tests` · `dedup:tooling` · `dedup:docs`
- `harmonization` — siblings spell, behave, style, event or document the same concept
  differently: `harmonization:naming` · `harmonization:behavior` · `harmonization:visual` ·
  `harmonization:events` · `harmonization:docs`
- `improvement` — engineering quality not covered above: `improvement:dx-types` ·
  `improvement:diagnostics` · `improvement:tests` · `improvement:tooling-ci` · `improvement:docs`
- `feature` — a genuinely new capability: `feature:new-component` · `feature:capability`
- Add one of `scope:library-wide`, `scope:tooling`, `scope:docs`, `scope:lyra-docs` or
  `scope:website` when the report is not about one component family.

How to pick:

1. The root cause decides `kind`; record the other facets as extra labels.
2. Broken existing behaviour → `bug` plus every `bug:` label that applies.
3. A new option, mode or API → `feature` — unless a close sibling already has it or the library
   spells it differently elsewhere (`harmonization`), or its absence breaks existing behaviour
   (`bug`).
4. Slow → `optimization`; heavy bytes → `size`; duplicated implementation → `dedup`.
5. Docs that state something false → `bug:docs`; docs that are hard to find → `improvement:docs`.

Examples:

| report | `kind` | `labels` |
| --- | --- | --- |
| No kanban board component | `feature` | `feature:new-component` |
| `lr-select` loses focus to `<body>` when closed with Escape | `bug` | `bug:focus`, `bug:keyboard` |
| `lr-table` select editor opens on its first option instead of the row's value | `bug` | `bug:state-data`, `bug:events` |
| `lr-dialog` lacks a placement option that `lr-drawer` already offers | `harmonization` | `harmonization:behavior` |
| Importing one small component pulls a charting peer into the bundle | `size` | `size:js-bundle`, `size:dependencies` |
| `lr-table` re-renders every row on each sort | `optimization` | `optimization:render` |
| A reference page documents an event the component never fires | `bug` | `bug:docs`, `bug:events` |
