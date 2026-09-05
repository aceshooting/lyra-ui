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
