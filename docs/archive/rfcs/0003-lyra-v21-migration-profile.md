# Archived: RFC 0003: Lyra 21 to Lyra 22 migration profile and rename ledger

Moved from [0003-lyra-v21-migration-profile.md](../../rfcs/0003-lyra-v21-migration-profile.md); history before 30.0.0, not current guidance.

## Test, documentation, and rollout plan

### Feasibility evidence (lands with the profile)

The evidence is an implementation with an empty checked-in ledger, and synthetic fixtures under
`scripts/fixtures/lyra-renames/`:

- **`lyra-rename-ledger.test.mjs`.**
  - Every schema, record, window, mirroring, shared-token and default-meaning rejection.
  - Completeness in lint only.
  - Exposure of old and new names, version gating, and tampering.
  - Reviewed snapshots for HTML, Lit, JSX, Vue, Svelte and CSS. Together they exercise all eight
    actions and all twelve codes, each checked for byte-identical reruns.
  - Focused tests: duplicate bindings in Lit, Vue and JSX; Angular and opaque object bindings;
    listener reach; `@HostListener('document:…')`; `customElements.get()`/`matches()` versus
    `handlers.get()`; `::part()` behind `exportparts`; shared and global custom properties;
    inversion per file syntax; reflection; default slot and slot content; scoped, stale and
    Lit-template acknowledgements; dispatch-blocked events across files; linear time; `--diff`
    path safety; and the packaged CLI's diff, check, apply, version and acknowledge cycle.
- **`migrate-wa.test.mjs`** stays green.
- **`check-migration-coverage.mjs`**, `build-llms.test.mjs`, `llms-freshness`, `llms:check`,
  `check:script-paths`, `check:source-policy` and `check:test-assertions` pass.
- **A throwaway ledger** of the planned renames produced the table in the motivation against the
  real inventory. It is not checked in.

### Implementation change (with the profile)

1. The infrastructure above with an empty ledger. `test:migrate-wa` and `test:tooling` run the new
   suite.
2. 22.0.0 version gating for an inverted rename paired with a `defaults` entry, which the evidence
   does not yet do: the projection stamps such a rename with that entry's `since`.
3. The `docs/agents/upstream-parity.md` rule and its `AGENTS.md` digest line: alias, record and
   ledger entry land in one change.
4. A `minor` changeset that describes only what ships.
5. In CI: full `pnpm build`, `check-packed-consumer.mjs` (four-file `dist/cli`, and
   `--origin=lyra-v21` from the packed tarball) and `check:package-size`. The packed check proves
   loading only, because an empty profile scans nothing.
6. Multi-engine, visual and hydration lanes do not apply: nothing renders.

### Rollout

1. Accepted with RFCs 0001 and 0002 on 2026-09-27; their migration sections cite the `globals` and
   `rules` lists here.
2. The implementation lands in the first 21.x minor that carries a rename or an item 16
   deprecation, with that minor's entries.
3. Each harmonization change adds its alias, record (`since` set to the 21.x minor that ships it,
   `removalNotBefore: "23.0.0"`; 22.0.0 and 24.0.0 for a rename onto an already-exposed name) and
   ledger entry together. The gate rejects any partial combination.
4. Item 16's 21.1.0 member records each need a `renames` or `reviews` entry before lint passes; its
   slot-content, type and localization-entry deprecations also get `slotContent` and `globals`
   entries, which completeness does not gate (for `globals`, see question 3).
5. Each rename minor, and 22.0.0, runs `--origin=lyra-v21 --check` over the repository's own
   stories, examples and docs. The rename lists close with the last 21.x minor; 22.0.0 adds the
   detail-change, default and slot-content entries and the `globals` and `rules` of RFCs 0001 and
   0002, and the profile is then frozen.
6. In 23.0.0 the aliases and records are removed (see unresolved question 2).

**Delivery record.** The profile, ledger and CLI shipped with 22.0.0. Each later profile was added
with the release that deprecated what it covers; `globals`, `rules` and `lyra-v26` ship with 27.0.0.

**Rollback.** Revert the profile, the ledger and the `dist/cli` module. Every run can be previewed,
and every rewrite targets a name that keeps working until v23.
