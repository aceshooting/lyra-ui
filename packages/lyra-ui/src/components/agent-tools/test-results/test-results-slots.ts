/** URI-encode a slot-name segment without throwing on an isolated UTF-16 surrogate. For
 * well-formed strings this is exactly `encodeURIComponent(value)`; malformed code units get their
 * own `%uXXXX` escape so distinct public ids remain distinct instead of crashing or collapsing. */
function encodeDetailSlotSegment(value: string): string {
  let encoded = '';
  for (let index = 0; index < value.length;) {
    const codePoint = value.codePointAt(index)!;
    const character = String.fromCodePoint(codePoint);
    encoded += codePoint >= 0xd800 && codePoint <= 0xdfff
      ? `%u${codePoint.toString(16).toUpperCase().padStart(4, '0')}`
      : encodeURIComponent(character);
    index += character.length;
  }
  return encoded;
}

/** Returns the canonical collision-free rich-detail slot name for one suite/test pair.
 *
 * Well-formed ids use the same segment encoding as `encodeURIComponent`. Isolated UTF-16
 * surrogates, which `encodeURIComponent` rejects, are encoded as uppercase `%uXXXX` code units so
 * every string accepted by the component still has a deterministic, distinct slot name.
 */
export function testResultDetailSlotName(suiteId: string, testId: string): string {
  return `detail-${encodeDetailSlotSegment(suiteId)}:${encodeDetailSlotSegment(testId)}`;
}

