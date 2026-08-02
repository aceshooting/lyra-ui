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
