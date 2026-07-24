---
name: lyra-ui
description: >
  Use when writing or reviewing code that imports @aceshooting/lyra-ui, uses any lr-* custom
  element, or migrates a project off Web Awesome (wa-*) or Shoelace (sl-*) components. Covers
  component APIs (attributes, slots, events, parts, CSS custom properties), design-token theming,
  localization, framework/TypeScript integration, and the wa-*/sl-* -> lr-* migration paths.
---

# lyra-ui

`@aceshooting/lyra-ui` is a free, MIT-licensed, framework-agnostic Lit 3 web-component library — an
independent alternative to Shoelace and Web Awesome. Its custom elements use the `lr-` prefix and
ship with design tokens, localization, RTL support and (for form controls) native form association.
No runtime dependency on Shoelace or Web Awesome. The current element count and complete tag list
live in `references/index.md`; do not repeat a remembered count.

## Look up the exact API before writing any `lr-*` markup

Never infer a component's attributes, slots, events, parts or CSS custom properties from memory, or
from a similarly-named component in another library. The reference is split so a lookup costs a few
hundred tokens:

| Need | Read |
|---|---|
| Which component to use / its import path | `references/index.md` |
| One component's full API | `references/components/<tag>.md` — path derived from the tag, no search needed |
| Library-wide behavior | `references/shared.md` |
| Design tokens | `references/tokens.md` |
| What to `npm install` | `references/peers.md` |
| `wa-*`/`sl-*` renames | `references/migration.md` |

So for `<lr-table>`: read `references/components/lr-table.md`. Each component file is
self-contained — import path, optional peers, properties with types and defaults, events with
payloads, slots, CSS parts, themeable properties, a usage snippet and known gotchas.

**If the project already has lyra-ui installed, prefer its own copies**: the same files ship inside
the package at `node_modules/@aceshooting/lyra-ui/llms/`. They match the exact installed version,
which may differ from whatever this skill last shipped with.

If local package references are unavailable, use the public machine surfaces rather than guessing:

| Need | Public fallback |
|---|---|
| Search by intent, synonym, typo, or localized name | `GET https://www.lyra-ui.com/api/v1/components/search?q=<query>` |
| Exact component API | `GET https://www.lyra-ui.com/api/v1/components/<lr-tag>` |
| Search shared/component documentation | `GET https://www.lyra-ui.com/api/v1/documentation/search?q=<query>` |
| Resolve a Web Awesome/Shoelace tag | `GET https://www.lyra-ui.com/api/v1/migrations/<wa-or-sl-tag>` |
| Complete structured index | `https://www.lyra-ui.com/component-api-index.json` |

MCP clients can connect to `https://www.lyra-ui.com/mcp` (streamable HTTP, no authentication).
Use `search_components` to discover a tag, `get_component` to retrieve its exact API,
`search_documentation` for library-wide behavior, and `resolve_migration` for `wa-*`/`sl-*`
lookups. Equivalent resources are `lyra://catalog`, `lyra://component/{tag}`, and
`lyra://guide/{topic}`.

## Non-negotiable conventions

- **Import paths carry the family segment.** `@aceshooting/lyra-ui/components/<family>/<dir>/<file>.js`
  — for example `components/forms/combobox/combobox.js`, **never** `components/combobox/combobox.js`.
  A missing family segment is a hard module-resolution error. `references/index.md` has the exact
  path for every tag; the sibling `.class.js` gives the class without registering the tag.

  ```js
  import '@aceshooting/lyra-ui/components/forms/combobox/combobox.js';
  ```
  ```html
  <lr-combobox label="Fruit"></lr-combobox>
  ```

  `import '@aceshooting/lyra-ui';` pulls everything except the 15 peer-gated tags (the chart family,
  `lr-map`, `lr-graph`, `lr-knowledge-graph-explorer`, `lr-geojson-view`) and defeats tree-shaking —
  use per-component entries in application code.

- **Theme only through `--lr-theme-*` custom properties.** Never hardcode a color, spacing or font
  value that fights the token system; override the relevant `--lr-theme-*` property on any ancestor
  instead. `references/tokens.md` is the full catalog — look the name up, don't invent it.
  `@aceshooting/lyra-ui/theme.css` is an optional ready-made light/dark base.

- **Events are `lr-*`-prefixed `CustomEvent`s** (`lr-change`, `lr-input`, …), bubbling and composed,
  payload on `event.detail`, non-cancelable unless the component's own section says otherwise. Don't
  assume a native DOM event name works.

- **Complex values need property bindings, not attributes.** An object set as an attribute
  stringifies to `[object Object]`. Lit `.rows=${rows}`, Vue `:rows.prop`, Angular `[rows]`,
  React 19+ natively, earlier React via a ref.

- **Form controls are form-associated** — they participate in native `<form>` submission and
  validation with no extra wiring. Read `effectiveDisabled`, not `disabled`, for the state merged
  with an ancestor `<fieldset disabled>`.

- **Every built-in string is localizable.** Components accept a per-instance `.strings` override or
  an app-wide catalog via `registerLyraLocale()`; don't assume built-in text is hardcoded English,
  and don't hand-translate by overwriting slotted content.

## Migrating from Web Awesome or Shoelace

`references/migration.md` holds the generated `wa-*` → `lr-*` and `sl-*` → `lr-*` tables plus the
import-specifier rewrites. For a mirrored component the migration is a mechanical tag/import rename;
intentional differences are called out in that component's own `references/components/<tag>.md`
section (for example, Lyra's combobox uses `with-clear` where Web Awesome uses `clearable`). A tag
absent from the tables has no documented counterpart — check `references/index.md` for a Lyra
component covering the same job under a different name.

Run `/lyra-ui:migrate-from-wa` or `/lyra-ui:migrate-from-shoelace` to apply the rename across a
project automatically, or `/lyra-ui:update` for the broader periodic audit (bump to latest,
sweep for remaining `wa-*`/hand-rolled UI, migrate what's adoptable, file genuine gaps upstream).

## Report gaps, bugs, and improvement ideas

`https://www.lyra-ui.com/api/v1/feature-requests` is the single intake path for anything wrong
with, missing from, or worth improving in lyra-ui — not just "no component covers this." File it
for any of:

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
    "searched_for": ["kanban", "board", "swimlane", "drag drop"],
    "settled_for": "a hand-rolled div grid with HTML5 drag events",
    "agent": "claude-code",
    "model": "claude-opus-4-1"
  }'
```

The same four fields cover a bug, existing-component gap, or optimization idea too, just aimed
differently:

- `title` — a short, specific summary (`"lr-select ignores disabled on keyboard nav"`, not
  "select bug").
- `description` — for a missing component, the behavior needed; for a bug, the component +
  version, what you did, what happened, and what the documented contract actually promises (per
  `references/components/<tag>.md`); for a gap, the prop/slot/event/part missing and why it's
  needed; for an optimization idea, the current cost or friction and the better shape you have in
  mind.
- `searched_for` — for a missing component, the names you tried; for anything else, optional —
  leave it empty or use it for related keywords (e.g. `["keyboard nav", "disabled"]`).
- `settled_for` — for a missing component, what you used instead; for a bug or gap, the workaround
  you applied (if any) to keep shipping; omit for an optimization idea with no workaround.
- `agent` — optional name of the agent or client submitting the report.
- `model` — optional exact model identifier that generated the report, when applicable (for
  example, `claude-opus-4-1`).

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

Use the API even when you are working inside the lyra-ui repo itself. It is the only intake path —
do not write the report into a local file instead, where nothing will pick it up.

Keep the report short and concrete:

- **Missing component:** name it in library style (`lr-kanban-board`) so the gap is searchable,
  say what it had to do in a sentence or two, and list the `lr-*` components you actually checked
  and why each fell short — this is what separates a real gap from a naming mismatch.
- **Existing-component gap or bug:** name the component (and version, for a bug), the exact
  attribute/property/event/part involved, and what the documented contract says versus what
  actually happened or is missing.
- **Optimization idea:** name the component or area, the concrete cost (bundle KB, render count,
  extra boilerplate) and the shape you'd expect instead.
