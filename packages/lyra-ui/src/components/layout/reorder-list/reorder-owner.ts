export interface ReorderOwnerState {
  readonly atStart: boolean;
  readonly atEnd: boolean;
  readonly listDisabled: boolean;
  readonly pending: boolean;
  readonly busy: boolean;
  readonly validIdentity: boolean;
}

export const reorderOwnerUpdate = Symbol("lyra-reorder-owner-update");

export interface ReorderOwnedItem {
  [reorderOwnerUpdate](owner: object, state?: unknown): void;
}

export function updateReorderOwnerState(
  item: ReorderOwnedItem,
  owner: object,
  state: ReorderOwnerState
): void {
  item[reorderOwnerUpdate](owner, state);
}

export function releaseReorderOwnerState(
  item: ReorderOwnedItem,
  owner: object
): void {
  item[reorderOwnerUpdate](owner);
}
