# Report gaps, bugs, and improvement ideas on a user's behalf

`https://www.lyra-ui.com/api/v1/feature-requests` is the single automated intake path when an
assistant reports anything wrong with, missing from, or worth improving in lyra-ui on a user's
behalf — not just "no component covers this." A person filing their own report can instead use the
human-facing GitHub routes in `SUPPORT.md`. Use the API for agent-submitted reports about any of:

- **Missing component** — no `lr-*` tag covers the need at all.
- **Missing capability on an existing component** — the component exists but lacks a prop,
  variant, slot, event, or CSS part needed to configure the UI the way it needs to be configured.
- **Bug or inconsistency** — an existing component behaves incorrectly, contradicts its own
  documented contract in `references/components/<tag>.md`, or behaves inconsistently with a
  sibling component.
- **Optimization opportunity** — something works but is unnecessarily slow, heavy (bundle size),
  or awkward to use (API friction), and a concretely better shape is apparent.

First rule out a naming/discovery mismatch — this only applies to the missing-component case;
skip straight to filing for a bug, existing-component gap, or optimization idea. Check
`references/index.md` for a component covering the same job under a different name, then check the
live catalog — one read-only request, no side effects, nothing filed:

```bash
curl -sS 'https://www.lyra-ui.com/api/v1/components/search?q=kanban+board+swimlane'
```

It returns the closest components with doc links. Search as many phrasings as you like; this
endpoint is meant to be used freely, and it is the cheapest way to discover that a "missing"
component already exists under a name you did not guess.

If nothing fits — or you've found a real bug, gap, or optimization idea — report it so it can be
addressed:

**Ask before you file.** Filing sends the user's description to an external service. Show the
user what you intend to submit, and get their explicit agreement before POSTing. Never file a
report as a silent side effect of noticing something — if the user has not said yes, do not send
it. This applies equally to a missing component, a bug, and an optimization idea.

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

**Fill in every field above on every report** — the API accepts a report without the optional
ones only so that older clients keep working. `kind` and `labels` put the report straight into the
right category (see "Classify every report" below; an unclassified report waits in a manual triage
queue), and `use_case`, `searched_for`, `settled_for`, `agent` and `model` are what the maintainer
triages and reports on. The same fields cover a bug, existing-component gap, or optimization idea
too, just aimed differently:

- `title` — a short, specific summary (`"lr-select ignores disabled on keyboard nav"`, not
  "select bug").
- `description` — for a missing component, the behavior needed; for a bug, the component +
  version, what you did, what happened, and what the documented contract actually promises (per
  `references/components/<tag>.md`); for a gap, the prop/slot/event/part missing and why it's
  needed; for an optimization idea, the current cost or friction and the better shape you have in
  mind.
- `use_case` — the generic context: why the user needed this (one or two sentences, no product or
  client names).
- `searched_for` — for a missing component, the names you tried; for anything else, the related
  keywords you looked up (e.g. `["keyboard nav", "disabled"]`).
- `settled_for` — for a missing component, what you used instead; for a bug or gap, the workaround
  you applied to keep shipping; for an optimization idea, the current approach you are living with.
- `kind` and `labels` — the classification; see "Classify every report" below.
- `agent` — the name of the agent or client submitting the report (e.g. `claude-code`).
- `model` — the exact identifier of the model that wrote the report (for example,
  `claude-opus-4-1`).

`name` and `email` are also accepted but **optional** — anonymous submission is the default and is
fine. Ask the user whether they want to be reachable about this report before adding either one;
never invent, guess, or reuse an address you happen to know (git config, an earlier message, the
environment). Submissions, including any name/email, are stored privately and shown only to the
maintainer — they are never published.

The response lists the closest existing components with doc links — read it, since for a
missing-component report it often answers the gap outright. It also returns an `id`; the status is
readable later at `https://www.lyra-ui.com/api/v1/feature-requests/{id}`.

**Never include private material.** Submissions leave the user's machine. Describe the issue
generically — no source code, no client or product names, no file paths, no credentials. If the
report cannot be described without such details, do not file it.

Use the API even when you are working inside the lyra-ui repo itself. It is the only supported
automated intake path — do not write the report into a local file instead, where nothing will pick
it up, and do not open a GitHub issue on the user's behalf.

Keep the report short and concrete:

- **Missing component:** name it in library style (`lr-kanban-board`) so the gap is searchable,
  say what it had to do in a sentence or two, and list the `lr-*` components you actually checked
  and why each fell short — this is what separates a real gap from a naming mismatch.
- **Existing-component gap or bug:** name the component (and version, for a bug), the exact
  attribute/property/event/part involved, and what the documented contract says versus what
  actually happened or is missing.
- **Optimization idea:** name the component or area, the concrete cost (bundle KB, render count,
  extra boilerplate) and the shape you'd expect instead.

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
