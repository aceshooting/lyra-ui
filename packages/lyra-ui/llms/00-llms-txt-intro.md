# @aceshooting/lyra-ui

> Free, independent, MIT-licensed Lit web components — an open-source alternative to Shoelace and
> Web Awesome. Lyra combines accessible form controls, layout and overlay primitives, dashboards,
> charts, data visualization, document viewers, and Conversation & Agent UI. Selected components
> keep documented Web Awesome-compatible public names under a `lr-` prefix to ease migration; the
> implementation, design tokens, localization runtime and release surface are standalone.

## Which file to read

Read the narrow reference for the task. `llms/index.md` is the source of truth for the current
element count and complete tag list.

- [llms/index.md](./llms/index.md): every tag, its exact import path, and a one-line purpose —
  **start here** to pick a component.
- [llms/components/&lt;tag&gt;.md](./llms/components/): the full API of one component (properties,
  events, slots, CSS parts, custom properties, snippet, gotchas), derived from the tag name with no
  search: `llms/components/lr-table.md`.
- [llms/shared.md](./llms/shared.md): library-wide behavior — status/deprecation, importing and the
  autoloader, events, forms, theming, localization/RTL, TypeScript/frameworks, SSR, utilities, the
  `@aceshooting/lyra-ui/ai` types, and testing.
- [llms/shared/imports-and-registration.md](./llms/shared/imports-and-registration.md): version
  policy, entry points, registration, and scoped registries.
- [llms/shared/v23-to-v24-migration.md](./llms/shared/v23-to-v24-migration.md): project upgrade
  sequence for retired routes, styling, SSR and event-detail compatibility.
- [llms/shared/events-and-types.md](./llms/shared/events-and-types.md): event behavior and shared
  TypeScript contracts.
- [llms/shared/forms-and-accessibility.md](./llms/shared/forms-and-accessibility.md): native forms,
  accessible names, shared form chrome, and accessibility scope.
- [llms/shared/styles-and-tokens.md](./llms/shared/styles-and-tokens.md): tokens, stylesheets,
  theme APIs, surfaces, density, contrast, and motion.
- [llms/shared/native-styles-and-utilities.md](./llms/shared/native-styles-and-utilities.md):
  opt-in light-DOM native styles, typography, utility classes and reset integration.
- [llms/shared/localization-and-rtl.md](./llms/shared/localization-and-rtl.md): locale catalogs,
  translated strings, pluralization, and right-to-left behavior.
- [llms/shared/frameworks-and-ssr.md](./llms/shared/frameworks-and-ssr.md): framework declarations,
  property/event binding, server rendering, and hydration.
- [llms/shared/ai-and-peers.md](./llms/shared/ai-and-peers.md): provider-neutral stream types,
  AI composition, and optional peer dependencies.
- [llms/shared/testing-and-utilities.md](./llms/shared/testing-and-utilities.md): test helpers,
  shared utilities, and feature requests.
- Companion packages: `@aceshooting/lyra-translations` (locale catalogs; see
  `llms/shared/localization-and-rtl.md`) and `@aceshooting/lyra-ide` (editor and manifest metadata;
  see `llms/shared/testing-and-utilities.md`).
- [llms/tokens.md](./llms/tokens.md): every design token, including its theme input and fallback or
  its derived value, as applicable.
- [llms/peers.md](./llms/peers.md): which optional peer dependency each component needs.
- [llms/migration.md](./llms/migration.md): every pinned `wa-*`/`sl-*` mapping's
  exact/rewritten/warning/conceptual/unsupported decision and safe codemod rules.
- [CHANGELOG.md](./CHANGELOG.md): chronological release notes, including breaking changes and
  post-major minor/patch additions and fixes — read it before upgrading.
- [README.md](./README.md): install, catalog, theming, accessibility, commands.

## Use with AI coding agents

AI coding agents: run `npx lyra-ui init-agents` (add `--agent <name>` if not auto-detected) to install
the Lyra UI skill for yourself. Humans: `npm i @aceshooting/lyra-ui && npx lyra-ui init-agents`
(a terminal asks which agents). Plugin marketplaces: `/plugin marketplace add aceshooting/lyra-ui`
(Claude Code), `codex plugin marketplace add aceshooting/lyra-ui` (Codex).

## Rules that apply to every component

- Prefer the stable tag-shaped registration path
  `@aceshooting/lyra-ui/components/<tag>.js`, for example `components/lr-input.js`. Duplicate
  nested registration paths were removed in v24; class-only and helper modules retain their family
  paths. `llms/index.md` lists the exact supported paths.
- Compose style axes through the style API or scope attributes, and customize with documented
  `--lr-theme-*` inputs. Look up exact tokens in `llms/tokens.md`.
- Lyra-specific events are `lr-`-prefixed `CustomEvent`s, bubbling and composed, with payload on
  `event.detail`; native wrappers may also relay the exact native events listed in their sections.
- Form controls are form-associated: they participate in native `<form>` submission and validation.
- Every built-in string is localizable via `registerLyraLocale()` or a per-instance `.strings`.
- Locale selection does not set writing direction; inherit an explicit `dir="rtl"` for RTL layout.

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
