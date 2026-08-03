# Framework recipes

These small Vite applications are executable integration recipes for Lyra's plain custom elements.
They deliberately use no runtime wrapper package:

- [`react/`](react/) uses React 19 custom-element property and event support.
- [`vue/`](vue/) uses explicit property modifiers for non-string values.
- [`svelte/`](svelte/) binds values directly to known custom-element properties.

Each recipe imports the opt-in framework declarations once, registers only the tags it renders via
stable tag-shaped paths such as `@aceshooting/lyra-ui/components/lr-input.js`, binds an array through
the `lr-table.rows` property, and handles the `lr-change` DOM event.

Run one recipe independently:

```bash
cd examples/frameworks/react # or vue / svelte
pnpm install
pnpm dev
```

Run its typecheck and production build with `pnpm build`. Repository CI installs all three recipes
against the package tarball it just built, rather than resolving Lyra from this checkout:

```bash
pnpm build
node scripts/check-framework-recipes.mjs
```

Use `node scripts/check-framework-recipes.mjs --validate-only` for the fast, install-free source
contract check.
