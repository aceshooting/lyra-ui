interface LitWarningGlobal {
  litIssuedWarnings?: Set<string>;
}

/**
 * Declares that this test file deliberately authors `attribute` on `<tag>` even though the
 * component does not observe it -- the "a removed attribute stays inert" regression tests this
 * library keeps for every rename it has shipped.
 *
 * Those tests are the reason the dev-mode unknown-attribute diagnostic exists, so the diagnostic
 * firing on them is correct behaviour, not a bug: what it costs is that under
 * `WTR_STRICT_CONSOLE=1` the warning throws, and because that check is one-shot per page, whichever
 * such test a shard happens to run first is the only one that fails. The result is a failure that
 * moves between files as sharding changes -- which is exactly how these first surfaced, on the
 * `edge` and `safari` lanes only.
 *
 * Seeding Lit's own dedupe key is deliberate: it silences precisely one (tag, attribute) pair and
 * leaves the diagnostic fully armed for every other attribute in the same file, so a genuine typo
 * still fails. State the pair, and the diagnostic stays useful.
 *
 * Call at module scope, before any fixture mounts.
 */
export function expectStaleAttribute(tag: string, attribute: string): void {
  // Only ever narrows an existing store. Creating one would *enable* Lit's dev-mode warnings in a
  // context that had them off, which is the opposite of this helper's job.
  (globalThis as LitWarningGlobal).litIssuedWarnings?.add(
    `lyra-unknown-attribute:${tag}:${attribute}`
  );
}
