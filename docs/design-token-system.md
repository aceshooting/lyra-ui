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

## Portable look definitions

Authored look inputs live in `packages/lyra-ui/tokens/looks/<id>.json`. The style and design-token
generators validate them with the same look schema and CSS-value grammar before emitting artifacts.
A definition contains an `id` and a `tokens` map of `--lr-theme-*` inputs. Values are CSS strings or
sparse `{ light, dark }` pairs; an omitted or `null` branch uses the base value for that mode.
Surface-treatment inputs and cross-axis references are rejected. The filename must match the id,
and `lyra` is reserved for the canonical base.

`design-tokens.json` exposes the portable definitions at
`$extensions['com.aceshooting.lyra.looks']`:

```json
{
  "schemaVersion": 1,
  "base": "lyra",
  "definitions": {
    "lyra": { "id": "lyra", "tokens": {} },
    "example": { "id": "example", "tokens": { "--lr-theme-border-radius-container": "1rem" } }
  }
}
```

The shipped entries are `lyra`, `material` and `shadcn`; `example` above illustrates the shape.
Each `definitions[id]` can be passed to `defineLyraLook()` and then to `setLyraStyle({ look })` or
`lyraLookCss()`. Omitted inputs are not expanded into copied defaults. The empty Lyra definition
selects the canonical base already described by the ordinary DTCG token tree, avoiding a second copy
of that inventory. Compatibility-only fixed-stylesheet ownership metadata is not exported.
Consumers should reject unsupported extension versions and revalidate definitions before applying
edited or imported data. No component or runtime module imports this JSON artifact; tools and
applications load it explicitly when they need interchange data.

## Optional token presets

`packages/lyra-ui/tokens/options/{shape,typography,elevation}.json` owns the optional preset maps.
The structural schema is `tokens/option-presets.schema.json`; `generate-option-presets.mjs` also
validates every value with the shared look grammar, restricts inputs to their option's category and
rejects mode pairs without a runtime resolver. Generate the modules with:

```bash
pnpm --filter @aceshooting/lyra-ui exec node scripts/generate-option-presets.mjs
```

The generated `theme/options/*.js` subpaths export frozen maps with type-only imports. Consumers
spread selected maps into `overrides`; these choices do not add new style axes or replace a look.
Shape preserves explicit pill/circle geometry, typography references local fonts without downloads,
and elevation changes existing shadow roles without changing surface colors or stacking contexts.

Design-token generation validates the same sources and exposes their plain maps at
`$extensions['com.aceshooting.lyra.options']`, with `schemaVersion: 1` and a `presets` object keyed by
`shape`, `typography` and `elevation`. Importers check the extension version, then validate edited
maps before applying them. Generated artifacts preserve sparse mode branches and never expand a
preset into unrelated look inputs.

## Accessibility preferences

`preferences.css` and the optional `theme/preferences.js` helper expose independent scoped
contrast (`system`/`more`) and motion (`system`/`reduce`) preferences through `data-lr-contrast` and
`data-lr-motion`. These are inherited accessibility choices, not additional look axes or persisted
fields in a style record. Shared component tokens consume private inherited switches so a nested
look resolves its own foreground and timing values. A local `system` boundary restores OS-driven
behavior; operating-system reduction remains a floor.

The helper supports ownership-safe apply/reset, an SSR attribute object, and effective-state
queries without importing Lit, presets, fonts, or chart engines. Long-running motion components
share ref-counted root/media listeners; one-shot animation and scrolling queries do not import the
observation layer. Existing component and animation-utility motion opt-outs remain explicit.

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
