# @aceshooting/lyra-ui

> Free, independent, MIT-licensed Lit web components — an open-source alternative to Shoelace and
> Web Awesome. Lyra combines accessible form controls, layout and overlay primitives, dashboards,
> charts, data visualization, document viewers, and Conversation & Agent UI. Selected components
> keep documented Web Awesome-compatible public names under a `lr-` prefix to ease migration; the
> implementation, design tokens, localization runtime and release surface are standalone.

Every component styles itself through this library's own `--lr-theme-*` design tokens with hardcoded
fallbacks, so it works standalone with no theme or runtime dependency.

## Which file to read

Prefer the narrow file. `llms-full.txt` is the whole catalog concatenated (~250 components) and
costs several hundred thousand tokens; you almost never want all of it.

- [llms/index.md](./llms/index.md): every tag, its exact import path, and a one-line purpose —
  **start here** to pick a component.
- [llms/components/&lt;tag&gt;.md](./llms/components/): the full API of one component (properties,
  events, slots, CSS parts, themeable custom properties, usage snippet, gotchas). The path is
  derived from the tag name, so no search is needed: `llms/components/lr-table.md`.
- [llms/shared.md](./llms/shared.md): library-wide behavior — importing/registration, the event
  contract, form association, theming, localization, RTL, TypeScript, framework integration, SSR,
  the `@aceshooting/lyra-ui/ai` data types, and testing.
- [llms/tokens.md](./llms/tokens.md): every design token and its `--lr-theme-*` input.
- [llms/peers.md](./llms/peers.md): which optional peer dependency each component needs.
- [llms/migration.md](./llms/migration.md): `wa-*`/`sl-*` → `lr-*` rename tables.
- [llms-full.txt](./llms-full.txt): all of the above component sections in one file.
- [README.md](./README.md): install, catalog, theming, accessibility, and package-level commands.
- [Live docs site](https://aceshooting.github.io/lyra-ui/): interactive examples per component —
  useful for a human reviewer, redundant for an assistant reading these files.

Claude Code users can install the matching skill (component APIs, theming rules, migration
codemods) from the marketplace at <https://github.com/aceshooting/lyra-ui>.

## Rules that apply to every component

- Import path is `@aceshooting/lyra-ui/components/<family>/<dir>/<file>.js` — always with the family
  segment, never `components/<tag>/`. `llms/index.md` has the exact path per tag.
- Theme only by setting `--lr-theme-*` custom properties; never hardcode a value that fights them.
- Public events are `lr-`-prefixed `CustomEvent`s, bubbling and composed, payload on `event.detail`.
- Form controls are form-associated: they participate in native `<form>` submission and validation.
- Every built-in string is localizable via `registerLyraLocale()` or a per-instance `.strings`.

## When no component fits, file it

Check `llms/index.md` first — most apparent gaps are a different name, not a missing component. If
nothing fits, **ask the user for explicit agreement before filing anything** (filing sends their
description to an external service — never do it as a silent side effect of noticing a gap), then
`POST` to `https://www.lyra-ui.com/api/v1/feature-requests` with `title`, `description`, and
`searched_for` (the terms tried). `name`/`email` are accepted but optional contact fields — ask the
user before adding either, and never invent, guess, or reuse one from context. The response's
`matches` often names an existing component — read it before telling the user the gap is real. See
`llms/shared.md`'s "When no component fits, file it" for the full payload, response shape, and
privacy rules.

## Component catalog
