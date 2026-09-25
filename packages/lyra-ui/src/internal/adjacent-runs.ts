/** Where one item sits inside a visually joined run of adjacent controls. */
export type AdjacentRunPosition = 'standalone' | 'start' | 'middle' | 'end';

/** Options for {@link measureAdjacentRuns}. */
export interface AdjacentRunOptions {
  /** The inline direction the items flow in, normally the owner's computed `direction`. */
  readonly direction: 'ltr' | 'rtl';
  /**
   * Whether the item at `index` may take part in a run at all. An item that is not joinable never
   * joins its predecessor and never lets its successor join it.
   */
  readonly joinable: (item: Element, index: number) => boolean;
}

/**
 * Whether two items render edge to edge on the same line. A new flex line is not a continuation
 * even when its inline edges happen to align. The tolerance absorbs sub-pixel zoom and engine
 * rounding plus the one collapsed border a joined item already carries on a later measurement.
 * An item with no box (hidden, `display: none`) is never adjacent to anything.
 */
function areActuallyAdjacent(first: Element, second: Element, direction: 'ltr' | 'rtl'): boolean {
  const firstRect = first.getBoundingClientRect();
  const secondRect = second.getBoundingClientRect();
  if (firstRect.width <= 0 || firstRect.height <= 0 || secondRect.width <= 0 || secondRect.height <= 0) {
    return false;
  }
  const sameRow = Math.abs(firstRect.top - secondRect.top) <= 1 &&
    Math.abs(firstRect.bottom - secondRect.bottom) <= 1;
  if (!sameRow) return false;
  const gap = direction === 'rtl'
    ? firstRect.left - secondRect.right
    : secondRect.left - firstRect.right;
  return gap >= -2 && gap <= 1;
}

/**
 * Measures which of `items` (in DOM order) render as one visually joined run, from their rendered
 * rects alone. Pure: it reads geometry and writes nothing, so the caller owns scheduling (a
 * ResizeObserver plus one animation frame) and projecting each position onto its item.
 *
 * Adjacency is measured rather than inferred from sibling order, so a separated, wrapped, hidden or
 * vertically stacked item keeps all four corners instead of guessing.
 */
export function measureAdjacentRuns(
  items: readonly Element[],
  options: AdjacentRunOptions,
): AdjacentRunPosition[] {
  const { direction, joinable } = options;
  const eligible = items.map((item, index) => joinable(item, index));
  const joinsPrevious = items.map(() => false);
  for (let index = 1; index < items.length; index += 1) {
    joinsPrevious[index] = eligible[index - 1]! && eligible[index]! &&
      areActuallyAdjacent(items[index - 1]!, items[index]!, direction);
  }
  return items.map((_, index) => {
    const joinsBefore = joinsPrevious[index] ?? false;
    const joinsAfter = joinsPrevious[index + 1] ?? false;
    return joinsBefore
      ? joinsAfter ? 'middle' : 'end'
      : joinsAfter ? 'start' : 'standalone';
  });
}
