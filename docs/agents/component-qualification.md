# Component qualification — what "stable" is allowed to mean

`maturity.status` in `packages/lyra-ui/scripts/fixtures/component-inventory.json` is a public
claim: it drives the docs badge, the `llms/` reference, and a consumer's decision to depend on a
component. This file defines what has to be *true* before a component may carry
`status: "stable"`, and which gate proves each part.

Enforced by `packages/lyra-ui/scripts/check-qualification.mjs`
(`pnpm run check:qualification`, part of `contract-policy`, so `pnpm lint` fails on a violation).

## Why this exists

Measured on 8.0.0, before the gate landed: **280 of 283 components claimed `stable`, and no gate
checked that claim per-tag.**

`check-component-coverage.mjs` did not catch this and structurally cannot. Its `exercisesTag()`
is a substring/regex probe — it proves a tag is *mentioned* somewhere in its family's tests. A
test that mounts `<lr-thing>` and asserts only `expect(el).to.exist` satisfies it completely. That
gate answers "does a test file mention this tag", never "is this tag asserted to be accessible in
a populated state".

What the gate found once it ran: the claim was already true. **All 280 stable components carry a
populated-state axe assertion in their own directory** — in fact all 283 components do, including
the three experimental ones, across 271 of the package's 423 test files. That independently
matches the "283 of 283" figure in [docs/accessibility.md](../accessibility.md); if the two ever
disagree, one of them is measuring wrong. The unproven claim was the defect, not the coverage.

### The false-negative incident (2026-08-02) — read before touching the predicate

The gate's first `evidence` predicate was
`/\baxe\b|toBeAccessible|isAccessible/`, which does **not** match this package's actual idiom,
chai-a11y-axe's `await expect(el).to.be.accessible()` (re-exported by `@open-wc/testing`, 692
calls across 268 component test files). That single omission made the gate a near-total false
negative: it passed only 46 of 280 components, and the exemption file was seeded with **234
entries that were all wrong** — every one of those tags had a real axe assertion in its own
directory. The repo briefly published a far worse accessibility picture than reality, and 234
phantom entries would have hidden any genuine future gap.

Two lessons, both binding:

- The predicate lives in the exported `AXE_ASSERTION` regex in `check-qualification.mjs` and is
  pinned by `check-qualification.test.mjs`. **Any change that narrows it must be measured against
  the whole inventory** — count how many components flip — never spot-checked on one component.
- A seeded ratchet is a measurement, so **verify a large seed before committing it**. A gate that
  suddenly needs an exemption for 84% of the library is reporting its own bug, not the library's.

## The dimensions

| Dimension | Evidence required | Proven by |
|---|---|---|
| **Accessibility** | An axe assertion in the component's **own directory**, in a test that **mounts that tag** | `check:qualification` (blocking) |
| **Keyboard** | Focus/activation assertions in the component's own tests | review — see [testing.md](testing.md) |
| **RTL** | A `dir="rtl"` fixture asserting rendered result | review — see [i18n-rtl-theming.md](i18n-rtl-theming.md) |
| **Narrow layout** | 320px + long-content coverage | review — see [a11y-responsive-motion.md](a11y-responsive-motion.md) |
| **Reduced motion** | Both `prefers-reduced-motion` branches tested | review — see [a11y-responsive-motion.md](a11y-responsive-motion.md) |
| **Browser engines** | Green on the support matrix below | CI `platform-contracts` (matrix) |
| **SSR** | Declared in `LYRA_SSR_SUPPORT_MATRIX` (`src/ssr.ts`) | CI `test:ssr` / `test:hydration` |
| **Visual review** | A reviewed baseline | CI `visual-regression` |
| **Optional-peer failure** | Fails closed with a localized `role="alert"` | review — see [peers-and-remote-content.md](peers-and-remote-content.md) |

Only **accessibility** is machine-checked per tag today. That is deliberate: a dimension belongs
in the blocking gate only when its presence can be proven from source without running the suite.
The rest are proven by the CI job named beside them, or by review against the linked contract —
re-deriving them from greps would rot silently and read as coverage that does not exist.

Widening the gate means adding an entry to `DIMENSIONS` in `check-qualification.mjs`, with an
`evidence` predicate and a test in `check-qualification.test.mjs` proving it both accepts real
evidence and rejects the near-miss. "Accepts real evidence" means *the spelling this repo actually
writes* — pin it against a copied-verbatim line from a real test file, not a paraphrase of one.

## Reviewed exemptions

`packages/lyra-ui/scripts/qualification-exemptions.json` records components that claim `stable`
without the evidence, each with a substantive reason and a `recordedAt` date.

**It is a ratchet, not an escape hatch.** The gate reports an exemption as *stale* — and fails —
when:

- the evidence has since landed (delete the exemption; the component now qualifies on its own),
- the tag no longer exists, or
- the component is no longer `stable`.

So the file can only shrink. **It is currently empty**: all 280 stable components qualify on their
own evidence, so nothing is exempted and nothing needs driving down. (Its 234-entry seed was the
false-negative incident above, not a real backlog — see that section before reading any large seed
as a coverage gap.)

An empty ratchet is the state to hold. Every new component is gated from its first commit and must
never appear here; an entry is only ever an individually reviewed exception, and re-populating the
file in bulk means the predicate broke, not the library.

This mirrors `coverage-floors.json` and `public-api-semver-exceptions.json`, which already work
this way in this package.

## Browser and assistive-technology support matrix

**Browser engines.** Proven per commit by the `platform-contracts` matrix job in
`.github/workflows/ci.yml` (`pnpm test:platform`), plus `build-and-coverage` on Chromium.

| Engine | Versions | Coverage | Proven by |
|---|---|---|---|
| Chromium | current stable | Full suite | CI `build-and-coverage` (all tests) |
| Firefox | current stable | `test:platform` contract subset | CI `platform-contracts` (Node 20, 22) |
| WebKit | current stable | `test:platform` contract subset | CI `platform-contracts` (Node 20, 22) |

`test:platform` is a curated subset, not the full suite — its exact file list is the
`test:platform` script entry in `packages/lyra-ui/package.json`. One known engine gap it does
**not** cover: WebKit silently drops a programmatic `addRange()` into a shadow tree, so
cross-shadow selection behavior is unverified there. Every selection-dependent test file is
currently outside `test:platform`, which is why that gap is latent rather than red — adding one
of those files to the matrix requires a WebKit guard first.

**Assistive technology.** No screen reader runs in CI; axe is a static-rule engine and does not
substitute for one. The library's AT contract is therefore: correct roles, names, and states as
asserted by the accessibility dimension above and the rules in
[a11y-responsive-motion.md](a11y-responsive-motion.md). Manual AT verification (VoiceOver/Safari,
NVDA/Firefox, Orca/Firefox) is a release activity, recorded per release rather than per commit.
Claiming verified support for a specific screen reader requires that record — the gate cannot
produce it.

## Adding a component

`pnpm create:component` scaffolds a component at `status: "unclassified"`, which this gate does
not check (nor is `"experimental"` checked — as of 2026-08-02 only `lr-data-grid`,
`lr-date-input`, and `lr-date-picker` carry it). Promoting a component to `"stable"` means
satisfying the accessibility dimension outright — new components do not get exemptions.
