# Design-token source and interchange

Lyra's authoritative token inventory is
`packages/lyra-ui/tokens/canonical-tokens.json`. It is an authored, Lyra-owned clean-room asset;
the TypeScript stylesheets are runtime implementations checked against it, not metadata sources
that another script scrapes and presents as canonical.

The source records every shared `--lr-*` token and every `--lr-theme-*` value supplied by the
production theme, including type, group, scope, light/dark/forced-colors/reduced-motion values,
theme-input relationships, and compatibility evidence. Run:

```bash
pnpm --filter @aceshooting/lyra-ui exec node scripts/generate-design-tokens.mjs
pnpm --filter @aceshooting/lyra-ui exec node scripts/generate-design-tokens.mjs --check
```

Generation is deterministic and produces:

- `design-tokens.json`, using Design Tokens Community Group `$type`, `$value`, `$description`,
  `$root`, and `$extensions` fields. Non-default modes and Lyra-specific CSS names and
  classifications live in reverse-domain `com.aceshooting.lyra.*` extensions; the file does not
  present Lyra's mode representation as a DTCG-standard field.
- `src/styles/design-tokens.css`, explicit light and dark theme-fixture selectors for CSS/design
  tool previews. It deliberately has no `:root` rule and does not replace `theme.css`, so importing
  it cannot turn production `auto` mode into a pinned light mode.
- `.storybook/token-preview.generated.js`, the grouped data used by Storybook token previews.
- `scripts/fixtures/token-docs.generated.json` and `token-editor.generated.json`, stable inputs for
  authored-reference and editor-data generation. Those consumers never have to parse TypeScript.

The generator also compares every canonical name and mode value with the actual token styles and
fails on either an undocumented runtime token or metadata with no implementation. Update the JSON
first, regenerate, then make the runtime implementation agree. Generated files are never edited by
hand.

## Value-named size compatibility

The 89 legacy `--lr-size-<value>` names are frozen: the family may shrink through an intentional
migration but cannot grow. Every entry has one classification and checked-in call-site evidence:

- `component-role` identifies the role-named component property that owns a single-purpose
  geometry. The old name remains recorded and supported as the compatibility fallback.
- `audited-fixed-geometry` records a genuinely mixed or fixed geometry for which redirecting to a
  semantic scale would change meaning when a theme retunes that scale.
- `semantic-global` is reserved for a token whose call sites all share an existing semantic role.
  None of the current names qualifies: equal numeric values alone are not equal roles.

Current classification is 12 component roles and 77 audited fixed geometries. This is deliberately
more conservative than aliasing `1px` to the border-width scale: that value is also used for gaps,
line stops, and canvas geometry, so such an alias would introduce theme-dependent regressions.
`check:value-named-tokens` requires complete classification, retained compatibility metadata,
evidence that still points at real call sites, the frozen count, runtime parity, and fresh generated
artifacts.

## Review boundaries

The machine-readable color/type labels and generated previews are not a human visual review. The
pseudo-locale and design-token outputs also carry no translation, assistive-technology, or native
speaker approval. Those review states belong in the qualification ledger and must stay pending
until a person actually performs them.
