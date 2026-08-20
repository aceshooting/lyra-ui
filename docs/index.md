# Lyra UI documentation

Lyra UI is a free, independent alternative to Shoelace and Web Awesome: a MIT-licensed,
framework-agnostic [Lit](https://lit.dev) web-component library covering accessible form controls,
navigation, overlays, dashboards, data visualization, file workflows, and a complete
Conversation & Agent UI kit — 285 custom elements across 11 component families.

This file is a short index. The primary documentation lives on the sites linked below, not here.

## Where to go

- **[Live component docs (Storybook)](https://aceshooting.github.io/lyra-ui/)** — every component
  with a live, interactive example, source code, and full API reference (props, events, slots, CSS
  parts/custom properties).
- **[www.lyra-ui.com](https://www.lyra-ui.com/)** — project website.
- **[Package README](../packages/lyra-ui/README.md)** — install instructions, quick start,
  theming/i18n/RTL, framework integration (React/Vue/Angular/Svelte), SSR & Declarative Shadow DOM,
  and browser/Node support matrix.
- **[Root README](../README.md)** — monorepo overview and links to every companion package
  (`@aceshooting/lyra-flags`, etc.).
- **[llms.txt](../packages/lyra-ui/llms.txt)** — the entry index for AI coding assistants, pointing
  into `packages/lyra-ui/llms/`: one reference file per component (`llms/components/<tag>.md`), plus
  the library-wide contracts, design tokens, optional peers, and `wa-*`/`sl-*` migration tables.
- **[Component quality dashboard](component-quality.md)** — per-tag qualification evidence,
  exemptions, known limitations, and honest pending human review.
- **[Component integration cards](component-integration.md)** — per-tag imports, optional peers,
  direct/transitive component dependencies, and bundle measurements when available.

## Contributing & policies

- **[CONTRIBUTING.md](../CONTRIBUTING.md)** — local setup, running tests/lint/build.
- **[AGENTS.md](../AGENTS.md)** — compact coding-conventions and architecture contract; read this
  before touching component internals. Its full normative detail (per-topic rules, incidents,
  exact patterns) lives in [`docs/agents/`](agents/).
- **[SECURITY.md](../SECURITY.md)** — supported versions and how to report a vulnerability
  privately.
- **[SUPPORT.md](../SUPPORT.md)** — public support routes and the information needed to triage an
  issue.
- **[GOVERNANCE.md](../GOVERNANCE.md)** — project roles, decision authority, release responsibility,
  and the boundary for proposals that need an RFC.
- **[RFC process](rfcs/process.md)** — lifecycle and review criteria for consequential public or
  cross-component changes; start from the [proposal template](rfcs/template.md).
- **[Executable framework recipes](../examples/frameworks/)** — React 19, Vue, and Svelte Vite
  applications checked against the packed package.

## This directory

`docs/` holds this index, public policy/RFC material, and `docs/agents/` — the detailed contributor
reference behind [AGENTS.md](../AGENTS.md); it does not duplicate the Storybook site or the package
README.
