import { nothing } from 'lit';

/** Preserve the selected-range overload when callers omit either explicit endpoint. */
export function setNativeRangeText(
  target: Pick<HTMLInputElement, 'setRangeText'>,
  replacement: string,
  start?: number,
  end?: number,
  selectionMode?: SelectionMode,
): void {
  if (start === undefined || end === undefined) target.setRangeText(replacement);
  else target.setRangeText(replacement, start, end, selectionMode);
}

/** Keep the browser's autocorrect default until the author supplies a hint or disables it. */
export function nativeAutocorrectAttribute(host: Element, enabled: boolean): 'on' | 'off' | typeof nothing {
  return host.hasAttribute('autocorrect') || !enabled ? enabled ? 'on' : 'off' : nothing;
}
