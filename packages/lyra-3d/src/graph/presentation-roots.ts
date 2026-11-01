import { Group, Object3D } from 'three';

export interface GraphPresentationRootSet {
  readonly world: Group;
  readonly pick: Group;
  readonly overlay: Group;
}
export interface GraphPresentationSlots extends GraphPresentationRootSet {
  readonly current: GraphPresentationRootSet | null;
}
export interface GraphPresentationParents {
  readonly world: Object3D;
  readonly pick: Object3D;
  readonly overlay: Object3D;
}
declare const swapBrand: unique symbol;
/** Internal owned operation; deliberately not a public graph entry-point type. */
export interface GraphPresentationSwap { readonly [swapBrand]: true }

type RootPhase = 'fresh' | 'prepared' | 'attached' | 'retired' | 'failed';
interface RootsRecord {
  readonly roots: GraphPresentationRootSet;
  readonly links: readonly [Group[], Group[], Group[]];
  phase: RootPhase;
}
interface SlotsRecord {
  readonly wrappers: readonly [Group, Group, Group];
  current: RootsRecord | null;
}
interface SwapRecord {
  readonly slots: SlotsRecord;
  readonly next: RootsRecord;
  readonly previous: RootsRecord | null;
  readonly oldLinks: readonly [Object3D[], Object3D[], Object3D[]];
  readonly dirty: readonly [boolean, boolean, boolean];
  active: boolean;
}
const roots = new WeakMap<GraphPresentationRootSet, RootsRecord>();
const slots = new WeakMap<GraphPresentationSlots, SlotsRecord>();
const swaps = new WeakMap<GraphPresentationSwap, SwapRecord>();
const issuedSwaps = new WeakSet<GraphPresentationSwap>();

function invalidState(): never { throw new DOMException('Graph presentation roots are unavailable', 'InvalidStateError'); }
function invalidType(): never { throw new TypeError('Invalid graph presentation roots'); }
function writable(object: object, name: string, expected: unknown): boolean {
  const descriptor = Object.getOwnPropertyDescriptor(object, name);
  return !!descriptor && Object.hasOwn(descriptor, 'value') && descriptor.writable === true && descriptor.value === expected;
}
function ownedValue(object: object, name: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(object, name);
  if (!descriptor || !Object.hasOwn(descriptor, 'value') || descriptor.writable !== true) return invalidState();
  return descriptor.value as unknown;
}
function rootAt(record: RootsRecord, index: number): Group {
  return index === 0 ? record.roots.world : index === 1 ? record.roots.pick : record.roots.overlay;
}
function linksMatch(value: Object3D[], expected: Group | null): boolean {
  const length = Object.getOwnPropertyDescriptor(value, 'length');
  if (length?.value !== (expected ? 1 : 0)) return false;
  if (!expected) return true;
  const child = Object.getOwnPropertyDescriptor(value, '0');
  return !!child && Object.hasOwn(child, 'value') && child.value === expected;
}

/** Each root set has one lifetime: preparation, attachment, then retirement or failure. */
export function createGraphPresentationRoots(): GraphPresentationRootSet {
  const value = Object.freeze({ world: new Group(), pick: new Group(), overlay: new Group() });
  roots.set(value, { roots: value, links: [[value.world], [value.pick], [value.overlay]], phase: 'fresh' });
  return value;
}

/** Install stable wrappers once; Three's attachment events occur outside any commit barrier. */
export function createGraphPresentationSlots(parents: GraphPresentationParents): GraphPresentationSlots {
  if (!parents || !(parents.world instanceof Object3D) || !(parents.pick instanceof Object3D) || !(parents.overlay instanceof Object3D) ||
    parents.world === parents.pick || parents.world === parents.overlay || parents.pick === parents.overlay) return invalidType();
  const world = new Group(), pick = new Group(), overlay = new Group();
  const record: SlotsRecord = { wrappers: [world, pick, overlay], current: null };
  const value = Object.freeze({ world, pick, overlay, get current() { return record.current?.roots ?? null; } });
  parents.world.add(world); parents.pick.add(pick); parents.overlay.add(overlay);
  slots.set(value, record);
  return value;
}

/** Own fixed rollback records before publishing anything; descendants are never inspected. */
export function prepareGraphPresentationSwap(slot: GraphPresentationSlots, candidate: GraphPresentationRootSet): GraphPresentationSwap {
  const owner = slots.get(slot), next = roots.get(candidate);
  if (!owner || !next) return invalidType();
  if (next.phase !== 'fresh') return invalidState();
  const oldLinks: Object3D[][] = [], dirty: boolean[] = [];
  for (let index = 0; index < 3; index++) {
    const root = rootAt(next, index), wrapper = owner.wrappers[index]!;
    const previous = owner.current ? rootAt(owner.current, index) : null;
    const flag = ownedValue(root, 'matrixWorldNeedsUpdate'), children = ownedValue(wrapper, 'children');
    if (typeof flag !== 'boolean' || !Array.isArray(children) || !linksMatch(children as Object3D[], previous) || !writable(root, 'parent', null) ||
      (previous && !writable(previous, 'parent', wrapper))) return invalidState();
    oldLinks.push(children as Object3D[]); dirty.push(flag);
  }
  const operation = Object.freeze({}) as GraphPresentationSwap;
  issuedSwaps.add(operation);
  swaps.set(operation, { slots: owner, next, previous: owner.current,
    oldLinks: [oldLinks[0]!, oldLinks[1]!, oldLinks[2]!], dirty: [dirty[0]!, dirty[1]!, dirty[2]!], active: true });
  next.phase = 'prepared';
  return operation;
}

function staleSwap(operation: GraphPresentationSwap, swap: SwapRecord): never {
  swap.active = false; swap.next.phase = 'failed'; swaps.delete(operation); return invalidState();
}
function checkFailure(writes: number, failAfterWrite: number): void {
  if (writes === failAfterWrite) throw new Error('Graph presentation swap interrupted');
}

/** Swap only owned links/flags. The optional internal numeric fault point invokes no callback. */
export function commitGraphPresentationSwap(operation: GraphPresentationSwap, failAfterWrite = 0): GraphPresentationRootSet | null {
  const swap = swaps.get(operation);
  if (!swap) return issuedSwaps.has(operation) ? invalidState() : invalidType();
  if (!swap.active) return invalidState();
  if (!Number.isSafeInteger(failAfterWrite) || failAfterWrite < 0) throw new RangeError('Invalid graph presentation fault point');
  const { slots: owner, next, previous } = swap;
  if (owner.current !== previous || next.phase !== 'prepared') return staleSwap(operation, swap);
  // Fixed descriptor checks prevent a changed accessor from running during owned writes.
  for (let index = 0; index < 3; index++) {
    const root = rootAt(next, index), wrapper = owner.wrappers[index]!;
    if (!writable(root, 'parent', null) || !writable(root, 'matrixWorldNeedsUpdate', swap.dirty[index]) ||
      !writable(wrapper, 'children', swap.oldLinks[index]) || !linksMatch(swap.oldLinks[index]!, previous ? rootAt(previous, index) : null) ||
      (previous && !writable(rootAt(previous, index), 'parent', wrapper))) return staleSwap(operation, swap);
  }
  let writes = 0;
  try {
    for (let index = 0; index < 3; index++) {
      const wrapper = owner.wrappers[index]!, root = rootAt(next, index);
      if (previous) { rootAt(previous, index).parent = null; checkFailure(++writes, failAfterWrite); }
      root.parent = wrapper; checkFailure(++writes, failAfterWrite);
      wrapper.children = next.links[index]!; checkFailure(++writes, failAfterWrite);
      root.matrixWorldNeedsUpdate = true; checkFailure(++writes, failAfterWrite);
    }
    owner.current = next; checkFailure(++writes, failAfterWrite);
  } catch {
    for (let index = 0; index < 3; index++) {
      const wrapper = owner.wrappers[index]!, root = rootAt(next, index);
      wrapper.children = swap.oldLinks[index]!;
      root.parent = null; root.matrixWorldNeedsUpdate = swap.dirty[index]!;
      if (previous) rootAt(previous, index).parent = wrapper;
    }
    owner.current = previous; swap.active = false; next.phase = 'failed'; swaps.delete(operation);
    throw new DOMException('Graph presentation swap failed', 'OperationError');
  }
  swap.active = false; next.phase = 'attached';
  if (previous) previous.phase = 'retired';
  // A retained consumed handle keeps only its weak identity marker, never the old scene trees.
  swaps.delete(operation);
  return previous?.roots ?? null;
}
