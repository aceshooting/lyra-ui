/** @internal State projected from an owning reorder list into one of its items. */
export interface ReorderOwnerState {
  readonly atStart: boolean;
  readonly atEnd: boolean;
  readonly listDisabled: boolean;
  readonly pending: boolean;
  readonly busy: boolean;
  readonly validIdentity: boolean;
}

/** @internal Private owner-to-item state bridge. */
export const reorderOwnerUpdate = Symbol('lyra-reorder-owner-update');

/** @internal Private item-to-owner identity notification. */
export const reorderIdentityChange = Symbol('lyra-reorder-identity-change');

/** @internal */
export interface ReorderIdentityOwner {
  [reorderIdentityChange](item: ReorderOwnedItem): void;
}

/** @internal */
export interface ReorderOwnedItem {
  [reorderOwnerUpdate](owner: object, state?: unknown): void;
}

/** @internal */
export function updateReorderOwnerState(
  item: ReorderOwnedItem,
  owner: object,
  state: ReorderOwnerState
): void {
  item[reorderOwnerUpdate](owner, state);
}

/** @internal */
export function releaseReorderOwnerState(
  item: ReorderOwnedItem,
  owner: object
): void {
  item[reorderOwnerUpdate](owner);
}
