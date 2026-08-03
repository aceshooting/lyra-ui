# Component qualification

Qualification is evidence about a component, not a second name for API maturity.
`maturity.status` continues to describe semver support. The independent qualification ledger
records which behavioral, platform, visual, and human evidence exists for every public tag,
including experimental tags. A missing qualification record never silently changes maturity.

The machine-readable sources are:

- `packages/lyra-ui/scripts/fixtures/component-qualification.json` — per-tag evidence and gaps;
- `packages/lyra-ui/scripts/fixtures/component-integration.json` — imports, peers, dependency graph,
  and standalone gzip measurement;
- `packages/lyra-ui/scripts/qualification-exemptions.json` — narrowly reviewed exceptions to the
  one blocking per-tag evidence rule;
- `packages/lyra-ui/visual-baselines/manifest.json` — visual enrollment, axes, provenance, and
  human-review status.

The public projections are [the quality dashboard](../component-quality.md) and
[the integration cards](../component-integration.md). They are generated; edit the evidence or
generator rather than editing those pages.

## Blocking rule: meaningful same-instance axe evidence

`check-qualification.mjs` requires every inventory tag, stable or experimental, to have either:

1. an axe assertion in that component’s own directory which targets the exact instance mounted by
   the same test case in a populated or open state; or
2. a narrowly scoped, dated exception with reviewer provenance and evidence references.

The checker follows the expression passed to `expect(...).to.be.accessible()` back to its fixture,
query, or local fixture helper. Merely mentioning a tag somewhere in the directory, mounting it in
another test, checking a sibling instance, or checking only an empty default does not qualify.
Tests in `check-qualification.test.mjs` pin those evasion cases.

The current exceptions are `lr-skeleton` and `lr-spinner`: neither exposes a distinct data-bearing
or open state. Their default rendered state is their complete state model. The records explicitly
say that an automated source audit, not a human accessibility review, accepted that narrow scope.
Delete an exception as soon as a meaningful state exists or qualifying evidence lands; the gate
reports stale, removed-tag, duplicate, and unused exceptions.

### Evidence-scanner changes

The library’s primary axe idiom is:

```ts
await expect(element).to.be.accessible();
```

Do not replace exact expression analysis with a directory-wide regex. Before changing the scanner,
add synthetic tests that prove both the real spelling and the intended instance flow pass, while
separate-test, sibling-instance, prefix-collision, empty-state, and negative assertions fail. Then
run the checker across the complete inventory and review every tag whose result changes.

## Tracked dimensions

Only the exact axe-state rule is blocking today. Other dimensions remain visible as explicit
`source-evidence`, `not-recorded`, `not-enrolled`, `not-verified`, or `not-applicable` states. A
source signal is a review pointer, not a claim that behavior passed.

| Dimension | Recorded evidence and interpretation |
|---|---|
| Accessibility | Exact populated/open axe evidence or the narrow exception above. Blocking. |
| Keyboard | Component-local keyboard assertion signal when the component owns interaction. |
| RTL | Component-local rendered RTL test signal. Arrow semantics and logical layout still require review. |
| Reduced motion | Motion applicability from implementation plus a component-local reduced-motion test signal. |
| Narrow allocation | Component-local 320px allocation assertion signal. |
| Engines | Per-commit Chromium full suite and Firefox/WebKit platform subset, plus weekly/manual full Firefox/WebKit shards. |
| SSR/hydration | Per-tag mode from `LYRA_SSR_SUPPORT_MATRIX`, exercised by the SSR and hydration crawls. |
| Visual | Per-tag story/axis enrollment from the visual manifest and its separate human-review record. |
| Optional-peer failure | Applicability from declared peers and a component-local failure-path test signal. |
| Security | Applicability and source pointers for remote-content or peer trust boundaries; never an external-audit claim. |
| Forced colors | Per-tag forced-colors screenshot enrollment; emulation is not Windows High Contrast manual verification. |
| Assistive technology | `not-verified` until a real manual record names the AT/browser/OS versions, date, scope, reviewer, and findings. |

`qualification.status` is `incomplete` while any tracked evidence gap remains. If automated evidence
becomes complete, it can advance only to `pending-human-review` until a real review record exists.
The checked-in ledger deliberately records no library-wide reviewer or review date.

## Browser and human-review truth

The browser entries describe automation, not an evergreen compatibility promise:

| Engine | Per-commit coverage | Additional coverage |
|---|---|---|
| Chromium | Complete test suite | Visual-regression captures use the manifest-pinned Playwright browser. |
| Firefox | Curated `test:platform` subset | Complete deterministic shards run weekly and by manual dispatch. |
| WebKit | Curated `test:platform` subset | Complete deterministic shards run weekly and by manual dispatch. |

Axe does not replace screen-reader or voice-control testing. Chromium forced-colors emulation and
pixel probes do not replace a Windows High Contrast review. Screenshot stability does not prove
design correctness. The visual manifest therefore carries capture provenance separately from
`baselineReview`; generated captures remain `pending-human-review` until a person actually reviews
the complete enrolled set.

Never fill reviewer, date, AT result, security-review, or human-visual-review fields from an agent
run, an axe pass, a green screenshot comparison, or an inference. Record unknown work as pending.

## Qualification and integration generation

After authored source, the inventory, SSR matrix, and visual manifest stabilize:

```bash
pnpm --filter @aceshooting/lyra-ui build
node packages/lyra-ui/scripts/generate-component-quality.mjs --write --measure-gzip
node packages/lyra-ui/scripts/generate-component-quality.mjs --check --measure-gzip
```

The measured pass bundles each built registration entry independently with esbuild, minifies it,
externalizes optional peers, and records gzip level-9 bytes plus a bundle SHA-256. This is an
integration cost, not a prediction of application chunk sharing: each card counts Lit and shared
Lyra layers again.

A source-only `--check` preserves the last measured gzip record while reproducing all source-derived
evidence and docs. Release qualification should also run `--check --measure-gzip` after the build so
the checked measurement cannot drift from `dist`.

The quality generator also projects compact fields into each inventory component:

- `qualification`: overall status, pending human-review state, accessibility status, and ledger;
- `dependencies`: direct/transitive tag edges and integration ledger.

`generate-component-inventory.mjs` retains those fields during upstream-surface refreshes. New tags
default to `pending-generation` and empty dependency edges, so they cannot inherit another tag’s
evidence accidentally.

## Adding or changing a component

1. Add an axe assertion for that exact instance in a populated/open state before enrolling the tag.
2. Add keyboard, RTL, reduced-motion, and 320px assertions wherever applicable; absence remains
   visible in the dashboard.
3. Declare optional peers in all required package fields and cover the localized fail-closed path.
4. Keep the SSR matrix reason truthful and exercise both render and hydration behavior.
5. Enroll risk-representative Storybook states and axes in the visual manifest. Do not mark human
   review complete when only automated capture or inspection occurred.
6. Build, regenerate quality artifacts with gzip measurement, inspect both public pages, and run the
   qualification, dependency, and generator tests.
