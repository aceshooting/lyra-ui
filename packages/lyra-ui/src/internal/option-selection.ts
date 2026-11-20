import { isHtmlElement } from './dom-guards.js';
import { finiteCount } from './numbers.js';
import { tag } from './prefix.js';

/** Whether `value` is an option element under the active tag prefix. */
export function isOptionElement(value: unknown): value is HTMLElementTagNameMap['lr-option'] {
  return isHtmlElement(value) && value.localName === tag('option');
}

/**
 * Normalizes a `value`/`defaultValue` assignment to the committed array form. `undefined` and
 * `null` mean "clear" -- the documented contract for an unset assignment -- while every string,
 * INCLUDING `''`, is a candidate value to resolve against the current options: `<lr-option
 * value="">` is a legitimate row, so an empty string must round-trip as a real selection rather
 * than being silently folded into "clear" the way a falsy check would. Duplicates and order are
 * kept; non-string array members are dropped.
 */
export function normalizeSelectionValues(next: string | string[] | null | undefined): string[] {
  if (Array.isArray(next)) return next.filter((value): value is string => typeof value === 'string');
  return typeof next === 'string' ? [next] : [];
}

/** @internal */
export const SET_OPTION_SELECTED_FROM_OWNER = Symbol('lr-set-option-selected-from-owner');

/** @internal */
export const RESET_OPTION_SELECTED_FROM_OWNER = Symbol('lr-reset-option-selected-from-owner');

const dirtyOptions = new WeakMap<object, boolean>();
const initialDirtySelection = new WeakMap<object, boolean>();

/** @internal Records consumer selectedness dirtiness without adding a public CEM member. */
export function markOptionSelectedDirty(option: object, dirty: boolean): void {
  if (dirty && !dirtyOptions.has(option)) initialDirtySelection.set(option, true);
  dirtyOptions.set(option, dirty);
  if (!dirty) initialDirtySelection.delete(option);
}

/** @internal Reads consumer selectedness dirtiness without adding a public CEM member. */
export function isOptionSelectedDirty(option: object): boolean {
  return dirtyOptions.get(option) === true;
}

/** @internal Whether a consumer selected the option before its owner initialized. */
export function wasOptionInitiallySelected(option: object): boolean {
  return initialDirtySelection.get(option) === true;
}

const selectedWriters = new WeakMap<EventTarget, number>();

/** @internal Emits an owner's existing child notification with live-write provenance. */
export function notifyOptionSelectedWrite(option: EventTarget, notify: () => void): void {
  const depth = selectedWriters.get(option) ?? 0;
  selectedWriters.set(option, depth + 1);
  try {
    notify();
  } finally {
    if (depth) selectedWriters.set(option, depth);
    else selectedWriters.delete(option);
  }
}

/** @internal Identifies an existing option-change notification from a consumer live write. */
export function isOptionSelectedWrite(event: Event): boolean {
  return event.composedPath().some((target) => (selectedWriters.get(target) ?? 0) > 0);
}

/** Maximum mounted option identities, including retained selections. */
export const MAX_RENDERED_OPTION_ROWS = 1_000;

/** Keep a source-ordered prefix and preferred identities within one absolute DOM budget.
 * Put the active/focused identity first in retained; excess selected identities remain selected
 * but cannot all be mounted. A zero prefix still retains preferred rows. */
export function capOptionRows<T>(
  all: readonly T[], maxRender: number, retained: readonly T[] = [],
): { rows: readonly T[]; overflow: number } {
  const limit = finiteCount(maxRender, 200, MAX_RENDERED_OPTION_ROWS);
  if (all.length <= limit) return { rows: all, overflow: 0 };
  const positions = new Map<T, number>();
  all.forEach((row, index) => { if (!positions.has(row)) positions.set(row, index); });
  const included = new Set<T>();
  for (const row of retained) {
    if (positions.has(row)) included.add(row);
    if (included.size >= MAX_RENDERED_OPTION_ROWS) break;
  }
  for (let index = 0; index < limit && included.size < MAX_RENDERED_OPTION_ROWS; index++) included.add(all[index]!);
  const rows = [...included].sort((a, b) => positions.get(a)! - positions.get(b)!);
  return { rows: rows.length === all.length && rows.every((row, index) => row === all[index]) ? all : rows, overflow: all.length - rows.length };
}
