/**
 * Finds every `hover: none, pointer: coarse` touch-target-floor media rule reachable from `el`'s
 * own adopted stylesheets and forces ALL of them to apply by rewriting each rule's
 * `media.mediaText` to `'all'`. No real device/pointer emulation is available in this harness, so
 * rewriting `CSSMediaRule.media.mediaText` is the only reliable way to prove a conditional rule is
 * both syntactically real (parsed into a `CSSMediaRule`, not just present as stylesheet text) and
 * has the effect the source claims.
 *
 * `LyraElement.styles` puts `internal/tokens.styles.ts`'s `baseTokens` -- which carries its own
 * copy of this rule for the shared `--lr-icon-button-size` touch-target floor -- ahead of every
 * component's own stylesheet in `shadowRoot.adoptedStyleSheets`, and `internal/sizes.styles.ts`
 * carries a second copy for the form-control size ladder. A single `.find()` therefore matches
 * whichever of those sorts first, not necessarily the rule under test, and can silently prove
 * nothing. Forcing (and restoring) every reachable rule, not just the first, is correct regardless
 * of how many coarse-pointer rules a given component composes -- now or after a future change.
 *
 * Returns a restore function -- callers MUST invoke it in a `finally` block, or a left-forced rule
 * poisons every later test in the same file.
 */
export function forceCoarsePointer(el: Element): () => void {
  const mediaRules = (el.shadowRoot?.adoptedStyleSheets ?? [])
    .flatMap((sheet) => [...sheet.cssRules])
    .filter(
      (rule): rule is CSSMediaRule =>
        rule instanceof CSSMediaRule &&
        rule.conditionText.includes('hover: none') &&
        rule.conditionText.includes('pointer: coarse'),
    );
  if (mediaRules.length === 0) {
    throw new Error(
      'forceCoarsePointer: no `hover: none, pointer: coarse` media rule was found in el.shadowRoot.adoptedStyleSheets.',
    );
  }
  const originals = mediaRules.map((rule) => rule.media.mediaText);
  for (const rule of mediaRules) rule.media.mediaText = 'all';
  return () => {
    mediaRules.forEach((rule, index) => {
      rule.media.mediaText = originals[index]!;
    });
  };
}
