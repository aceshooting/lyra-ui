import type { Lyra3dState } from './contract.js';

/** null denotes every logical row's paint, not geometry/style invalidation; [] denotes no paint. */
export type VisualStateRows = readonly number[] | null;

function coversRows(values: ReadonlySet<number>, count: number): boolean {
  if (count <= 0 || values.size < count) return false;
  let valid = 0;
  for (const row of values) if (Number.isInteger(row) && row >= 0 && row < count && ++valid === count) return true;
  return false;
}

/** Membership changes affect paint; insertion order may independently affect bounded labels. */
export function changedVisualRows(previous: Lyra3dState, next: Lyra3dState, count: number): VisualStateRows {
  for (const key of ['selected', 'dimmed'] as const) {
    if ((previous[key].size === 0 && coversRows(next[key], count)) || (next[key].size === 0 && coversRows(previous[key], count))) return null;
  }
  const rows = new Set<number>();
  if (!Object.is(previous.hover, next.hover)) { rows.add(previous.hover); rows.add(next.hover); }
  if (!Object.is(previous.focus, next.focus)) { rows.add(previous.focus); rows.add(next.focus); }
  for (const key of ['selected', 'dimmed'] as const) {
    for (const row of previous[key]) if (!next[key].has(row)) rows.add(row);
    for (const row of next[key]) if (!previous[key].has(row)) rows.add(row);
  }
  return [...rows].filter(row => Number.isInteger(row) && row >= 0 && row < count);
}

function sameOrder(previous: ReadonlySet<number>, next: ReadonlySet<number>): boolean {
  if (previous.size !== next.size) return false;
  const iterator = previous.values();
  for (const value of next) if (!Object.is(iterator.next().value, value)) return false;
  return true;
}

function sameMembership(previous: ReadonlySet<number>, next: ReadonlySet<number>): boolean {
  if (previous.size !== next.size) return false;
  for (const value of previous) if (!next.has(value)) return false;
  return true;
}

/** Snapshot caller sets before comparing them; identical state keeps its existing owned identity. */
export function snapshotVisualState(next: Lyra3dState, previous: Lyra3dState, count: number) {
  const state: Lyra3dState = { ...next, selected: new Set(next.selected), dimmed: new Set(next.dimmed) };
  const changed = !Object.is(previous.hover, state.hover) || !Object.is(previous.focus, state.focus)
    || !sameOrder(previous.selected, state.selected) || !sameMembership(previous.dimmed, state.dimmed);
  return { state: changed ? state : previous, changed, rows: changed ? changedVisualRows(previous, state, count) : [] };
}
