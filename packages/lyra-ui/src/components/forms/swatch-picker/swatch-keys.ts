/**
 * Where a roving swatch group moves for `key`, or -1 when `key` does not navigate. Arrow Right/Down
 * advance and Left/Up go back (Left/Right swap under RTL), Home/End jump to the ends, movement
 * wraps, and `isDisabled` entries are skipped. `current` below 0 means no origin yet.
 */
export function swatchKeyTarget(
  key: string,
  current: number,
  count: number,
  isDisabled: (index: number) => boolean,
  rtl: boolean,
): number {
  const forward = key === 'ArrowDown' || key === (rtl ? 'ArrowLeft' : 'ArrowRight');
  const backward = key === 'ArrowUp' || key === (rtl ? 'ArrowRight' : 'ArrowLeft');
  if (!forward && !backward && key !== 'Home' && key !== 'End') return -1;
  const step = backward || key === 'End' ? -1 : 1;
  const from = key === 'Home' ? -1 : key === 'End' || (current < 0 && backward) ? count : current < 0 ? -1 : current;
  for (let moved = 1; moved <= count; moved += 1) {
    const index = (((from + step * moved) % count) + count) % count;
    if (!isDisabled(index)) return index;
  }
  return -1;
}
