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
