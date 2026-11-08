/**
 * Normalizes a computed box-alignment keyword across engines.
 *
 * Chromium 158 serializes a computed `flex-start`/`flex-end` as the equivalent CSS Box Alignment
 * keywords `flow-start`/`flow-end`; Firefox and WebKit keep the declared spelling. Both pack the
 * same way, so an assertion about rendered alignment compares the normalized keyword.
 */
export function alignmentKeyword(value: string): string {
  if (value === 'flow-start') return 'flex-start';
  if (value === 'flow-end') return 'flex-end';
  return value;
}
