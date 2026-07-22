/**
 * Shared `minlength`/`maxlength` evaluation for the text controls that wrap a native
 * `<input>`/`<textarea>` (`<lr-input>`, `<lr-textarea>`).
 *
 * Both of those elements forward the two limits to their internal native control, which is what
 * enforces them while a user types. But the native `tooShort`/`tooLong` flags are raised *only*
 * for a value the user edited — a value that arrived from script (`el.value = …`, a form-state
 * restore, a `setRangeText()` splice) leaves both flags `false` however far out of range it is,
 * so an over-length value would submit as valid. These helpers recompute the same two conditions
 * from the component's own `value`, to be OR-ed into the native flags.
 *
 * They deliberately reproduce the platform's own rules rather than a simpler approximation:
 * an absent or unparseable limit constrains nothing, an empty value is never too short, and
 * lengths are counted in **UTF-16 code units** — the "code-unit length" the HTML spec measures
 * `minlength`/`maxlength` in, i.e. plain `String.prototype.length`. A single astral character such
 * as an emoji therefore counts as *two*, exactly as the native control counts it: a `<input
 * maxlength="3">` refuses the second half of a second emoji, and `minlength="2"` is already
 * satisfied by one emoji alone. Counting code points instead would make these helpers disagree
 * with the very control they supplement, in both directions — and the OR-with-native bridge in
 * `input.class.ts`/`textarea.class.ts` depends on the two agreeing.
 */

/** Whether `limit` is usable as a length bound, matching the platform's "rules for parsing
 *  non-negative integers": anything else (absent, `NaN`, negative, fractional) is ignored. */
function isLengthLimit(limit: number | undefined): limit is number {
  return typeof limit === 'number' && Number.isInteger(limit) && limit >= 0;
}

/** The `tooShort`/`tooLong` conditions `value` violates under the supplied limits. */
export function lengthViolations(
  value: string,
  minlength: number | undefined,
  maxlength: number | undefined,
): { tooShort: boolean; tooLong: boolean } {
  const hasMin = isLengthLimit(minlength);
  const hasMax = isLengthLimit(maxlength);
  if (!hasMin && !hasMax) return { tooShort: false, tooLong: false };
  // UTF-16 code units — the platform's "code-unit length". See the module comment.
  const length = value.length;
  return {
    // Native `minlength` never fires on an empty value — an optional field left blank stays
    // valid, and `required` is what rejects empty.
    tooShort: hasMin && length > 0 && length < minlength,
    tooLong: hasMax && length > maxlength,
  };
}
