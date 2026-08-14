import { finiteInteger } from '../../../internal/numbers.js';
import type { LyraTreeNodeData, TreeIdentityContext, TreeSelection } from './tree-types.js';

/**
 * Owner-only state pushed from `<lr-tree>` through its item hierarchy. Keeping it in a WeakMap
 * prevents consumers from manufacturing a partly-owned tree item through public element fields.
 * @internal
 */
export interface TreeItemOwnerContext {
  readonly activeId: string | null;
  readonly ancestry: readonly LyraTreeNodeData[];
  readonly depth: number;
  readonly setSize: number;
  readonly posInSet: number;
  readonly selection: TreeSelection;
  readonly ownsSelection: boolean;
  readonly identity?: TreeIdentityContext;
  readonly expandIcon: Element | null;
  readonly collapseIcon: Element | null;
  readonly indeterminate: boolean;
}

interface TreeItemOwner extends HTMLElement {
  selected: boolean;
  requestUpdate(): unknown;
}

const DEFAULT_CONTEXT: TreeItemOwnerContext = Object.freeze({
  activeId: null,
  ancestry: Object.freeze([]),
  depth: 0,
  setSize: 1,
  posInSet: 1,
  selection: 'single',
  ownsSelection: false,
  expandIcon: null,
  collapseIcon: null,
  indeterminate: false,
});

const contexts = new WeakMap<TreeItemOwner, TreeItemOwnerContext>();

/** @internal */
export function treeItemOwnerContext(owner: TreeItemOwner): TreeItemOwnerContext {
  return contexts.get(owner) ?? DEFAULT_CONTEXT;
}

function sameAncestry(
  left: readonly LyraTreeNodeData[],
  right: readonly LyraTreeNodeData[],
): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function sameIdentity(
  left: TreeIdentityContext | undefined,
  right: TreeIdentityContext | undefined,
): boolean {
  return (
    left?.path === right?.path &&
    left?.ownerPaths === right?.ownerPaths &&
    left?.collisionIds === right?.collisionIds &&
    left?.declaredChildrenAtPath === right?.declaredChildrenAtPath
  );
}

/**
 * Installs a complete owner snapshot. Numeric ARIA inputs are normalized at this private boundary,
 * and the item is only invalidated when a value it consumes actually changes.
 * @internal
 */
export function configureTreeItemOwner(
  owner: TreeItemOwner,
  next: Omit<TreeItemOwnerContext, 'depth' | 'setSize' | 'posInSet' | 'indeterminate'> & {
    readonly depth: number;
    readonly setSize: number;
    readonly posInSet: number;
    readonly indeterminate?: boolean;
  },
): void {
  const previous = treeItemOwnerContext(owner);
  const normalized: TreeItemOwnerContext = Object.freeze({
    ...next,
    ancestry: Object.freeze([...next.ancestry]),
    depth: finiteInteger(next.depth, 0, 0),
    setSize: next.setSize === -1 ? -1 : finiteInteger(next.setSize, 1, 1),
    posInSet: finiteInteger(next.posInSet, 1, 1),
    indeterminate: next.indeterminate ?? previous.indeterminate,
  });
  if (
    previous.activeId === normalized.activeId &&
    sameAncestry(previous.ancestry, normalized.ancestry) &&
    previous.depth === normalized.depth &&
    previous.setSize === normalized.setSize &&
    previous.posInSet === normalized.posInSet &&
    previous.selection === normalized.selection &&
    previous.ownsSelection === normalized.ownsSelection &&
    sameIdentity(previous.identity, normalized.identity) &&
    previous.expandIcon === normalized.expandIcon &&
    previous.collapseIcon === normalized.collapseIcon &&
    previous.indeterminate === normalized.indeterminate
  ) {
    return;
  }
  contexts.set(owner, normalized);
  owner.requestUpdate();
}

/** Sets tree-owned selected/mixed state without exposing a public controller method. @internal */
export function setTreeItemSelection(
  owner: TreeItemOwner,
  selected: boolean,
  indeterminate: boolean,
): void {
  const previous = treeItemOwnerContext(owner);
  const nextIndeterminate = Boolean(indeterminate);
  const contextChanged = !previous.ownsSelection || previous.indeterminate !== nextIndeterminate;
  if (contextChanged) {
    contexts.set(
      owner,
      Object.freeze({
        ...previous,
        ownsSelection: true,
        indeterminate: nextIndeterminate,
      }),
    );
  }
  const selectedChanged = owner.selected !== Boolean(selected);
  if (selectedChanged) owner.selected = Boolean(selected);
  else if (contextChanged) owner.requestUpdate();
}
