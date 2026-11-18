import type { LyraTreeNodeData, LyraTreePointerReorderDetail } from './tree-types.js';
import type { LyraTreeItem } from './tree-item.class.js';
import { composedContains, flattenedParentElement } from '../../../internal/composed-tree.js';
import { tag } from '../../../internal/prefix.js';
import { fromInteractiveDescendant } from './tree-owner-controller.js';

interface PointerTree extends HTMLElement {
  readonly data: readonly LyraTreeNodeData[];
  readonly treeSource?: unknown;
  readonly pointerReorderable: boolean;
  readonly allowCrossParentReorder: boolean;
  readonly canDrop?: (detail: LyraTreePointerReorderDetail) => boolean;
}

interface Location {
  readonly parent: LyraTreeItem | null;
  readonly siblings: LyraTreeItem[];
  readonly index: number;
}

interface Gesture {
  readonly node: LyraTreeItem;
  readonly row: Element;
  readonly rowRoot: ShadowRoot;
  readonly parent: LyraTreeItem | null;
  readonly index: number;
  readonly sourceItem: LyraTreeItem['item'];
  readonly sourceParentItem: LyraTreeItem['item'];
  readonly nodeId: string;
  readonly parentId: string | null;
  readonly data: readonly LyraTreeNodeData[];
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly view: Window;
  x: number;
  y: number;
  dragging: boolean;
  painted?: Candidate;
}

interface Candidate {
  readonly item: LyraTreeItem['item'];
  readonly parentItem: LyraTreeItem['item'];
  readonly parent: LyraTreeItem | null;
  readonly row: HTMLElement;
  readonly detail: LyraTreePointerReorderDetail;
}

function sameCandidate(previous: Candidate | undefined, next: Candidate | undefined): boolean {
  if (!previous || !next || previous.row !== next.row || previous.parent !== next.parent ||
      previous.item !== next.item || previous.parentItem !== next.parentItem) return false;
  const a = previous.detail;
  const b = next.detail;
  return a.nodeId === b.nodeId && a.fromParentNodeId === b.fromParentNodeId && a.fromIndex === b.fromIndex &&
    a.toParentNodeId === b.toParentNodeId && a.toIndex === b.toIndex && a.targetNodeId === b.targetNodeId &&
    a.position === b.position;
}

/** Resolves the actual row the pointer hits, even while the owner holds pointer capture. */
function hitRow(tree: PointerTree, x: number, y: number): HTMLElement | undefined {
  const root = tree.getRootNode() as Document | ShadowRoot;
  let hit = root.elementFromPoint?.(x, y) ?? null;
  while (hit?.shadowRoot) {
    const inside = hit.shadowRoot.elementFromPoint?.(x, y);
    if (!inside || inside === hit || !composedContains(hit, inside)) break;
    hit = inside;
  }
  for (let element = hit; element && element !== tree; element = flattenedParentElement(element)) {
    if (element.localName === tag('tree')) return undefined;
    if (element.part?.contains('row') && (element.getRootNode() as ShadowRoot).host?.localName === tag('tree-item')) {
      return element as HTMLElement;
    }
  }
  return undefined;
}

function eligible(tree: PointerTree, node: LyraTreeItem): boolean {
  const row = node.shadowRoot?.querySelector<HTMLElement>('[part="row"]');
  const view = tree.ownerDocument.defaultView;
  if (!row || !view || !row.getClientRects().length || view.getComputedStyle(row).visibility !== 'visible') return false;
  for (let current: Element | null = node; current; current = flattenedParentElement(current)) {
    if (current.hasAttribute('inert') || current.hasAttribute('hidden')) return false;
    if (current.localName === tag('tree')) return current === tree;
    if (current.localName === tag('tree-item')) {
      const ancestor = current as LyraTreeItem;
      if (ancestor.isDisabled || (ancestor !== node && !ancestor.expanded)) return false;
    }
  }
  return false;
}

function scrollContainer(tree: PointerTree, source: LyraTreeItem): Element | null {
  const view = tree.ownerDocument.defaultView;
  if (!view) return null;
  for (let element: Element | null = source; element; element = flattenedParentElement(element)) {
    if (element.scrollHeight > element.clientHeight &&
      /^(auto|scroll|overlay)$/.test(view.getComputedStyle(element).overflowY)) return element;
  }
  return tree.ownerDocument.scrollingElement;
}

/** A live pointer gesture for the displayed tree. The host decides whether to apply a request. */
export class TreePointerReorder {
  private gesture?: Gesture;
  private animation?: number;

  constructor(
    private readonly tree: PointerTree,
    private readonly locate: (node: LyraTreeItem) => Location | undefined,
    private readonly uniqueIds: (ids: ReadonlySet<string>) => boolean,
    private readonly request: (detail: LyraTreePointerReorderDetail) => void,
  ) {}

  start = (event: PointerEvent): void => {
    if (this.gesture || !this.tree.pointerReorderable || this.tree.treeSource !== undefined ||
        !event.isPrimary || event.button !== 0) return;
    const path = event.composedPath();
    const treeTag = tag('tree');
    const itemTag = tag('tree-item');
    const firstTree = path.find(target => (target as Element).localName === treeTag);
    if (firstTree !== this.tree || fromInteractiveDescendant(event, target => (target as Element).localName === itemTag)) return;
    const node = path.find(target => (target as Element).localName === itemTag) as LyraTreeItem | undefined;
    const rowRoot = node?.shadowRoot;
    const row = rowRoot?.querySelector('[part="row"]');
    if (!node || !rowRoot || !row || !path.includes(row) || !eligible(this.tree, node)) return;
    const checkbox = rowRoot.querySelector('[part="checkbox"]');
    if (checkbox && path.includes(checkbox)) return;
    if (event.pointerType === 'touch' && !path.some(target => (target as Element).part?.contains('reorder-handle'))) return;
    const location = this.locate(node);
    const view = this.tree.ownerDocument.defaultView;
    if (!location || !view) return;
    this.clearClick();
    this.gesture = { node, row, rowRoot, parent: location.parent, index: location.index, data: this.tree.data,
      sourceItem: node.item, sourceParentItem: location.parent?.item,
      nodeId: node.nodeId, parentId: location.parent?.nodeId ?? null,
      pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      x: event.clientX, y: event.clientY, dragging: false, view };
    // Selection starts within the item's shadow root. Native image/text dragging can otherwise
    // cancel captured pointer events before the tree can receive the release.
    rowRoot.addEventListener('selectstart', this.preventNativeDrag, true);
    rowRoot.addEventListener('dragstart', this.preventNativeDrag, true);
    node.addEventListener('selectstart', this.preventNativeDrag, true);
    node.addEventListener('dragstart', this.preventNativeDrag, true);
    view.addEventListener('pointermove', this.move, true);
    view.addEventListener('pointerup', this.up, true);
    view.addEventListener('pointercancel', this.interrupt, true);
    this.tree.addEventListener('lostpointercapture', this.interrupt);
    view.addEventListener('keydown', this.keyDown, true);
    view.addEventListener('blur', this.cancel);
  };

  private preventNativeDrag = (event: Event): void => {
    const gesture = this.gesture;
    if (!gesture || !this.tree.pointerReorderable || this.tree.treeSource !== undefined ||
        !eligible(this.tree, gesture.node) || !event.composedPath().includes(gesture.row) ||
        fromInteractiveDescendant(event, target => target === gesture.row)) return;
    event.preventDefault();
  };

  private move = (event: PointerEvent): void => {
    const gesture = this.gesture;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    gesture.x = event.clientX;
    gesture.y = event.clientY;
    if (!gesture.dragging) {
      if (Math.hypot(gesture.x - gesture.startX, gesture.y - gesture.startY) < 5) return;
      gesture.dragging = true;
      // Window listeners keep the gesture usable when capture is unavailable or the pointer ended.
      try { this.tree.setPointerCapture(gesture.pointerId); } catch { /* No active native pointer. */ }
    }
    if (event.cancelable) event.preventDefault();
    this.updateTarget();
  };

  private candidate(gesture: Gesture): Candidate | undefined {
    const tree = this.tree;
    if (!tree.pointerReorderable || tree.treeSource !== undefined || tree.data !== gesture.data ||
        gesture.node.item !== gesture.sourceItem || gesture.node.nodeId !== gesture.nodeId || !eligible(tree, gesture.node)) return undefined;
    const row = hitRow(tree, gesture.x, gesture.y);
    if (!row) return undefined;
    const target = (row.getRootNode() as ShadowRoot).host as LyraTreeItem;
    if (!eligible(tree, target) || composedContains(gesture.node, target)) return undefined;
    const source = this.locate(gesture.node);
    const dest = this.locate(target);
    if (!source || source.parent !== gesture.parent || source.index !== gesture.index || !dest) return undefined;
    if (source.parent?.item !== gesture.sourceParentItem || (source.parent?.nodeId ?? null) !== gesture.parentId) return undefined;
    if (dest.parent !== source.parent && !tree.allowCrossParentReorder) return undefined;
    const ids = new Set([gesture.node.nodeId, target.nodeId]);
    if (source.parent) ids.add(source.parent.nodeId);
    if (dest.parent) ids.add(dest.parent.nodeId);
    if (!this.uniqueIds(ids)) return undefined;
    const box = row.getBoundingClientRect();
    if (gesture.x < box.left || gesture.x >= box.right || gesture.y < box.top || gesture.y >= box.bottom) return undefined;
    const position = gesture.y < box.top + box.height / 2 ? 'before' : 'after';
    const insertion = dest.index + (position === 'after' ? 1 : 0);
    const toIndex = insertion - (dest.parent === source.parent && source.index < insertion ? 1 : 0);
    if (dest.parent === source.parent && toIndex === source.index) return undefined;
    return { row, parent: dest.parent, parentItem: dest.parent?.item, item: target.item, detail: Object.freeze({ nodeId: gesture.node.nodeId, fromParentNodeId: source.parent?.nodeId ?? null,
      fromIndex: source.index, toParentNodeId: dest.parent?.nodeId ?? null, toIndex, targetNodeId: target.nodeId, position }) };
  }

  private allowed(gesture: Gesture): Candidate | undefined {
    const candidate = this.candidate(gesture);
    if (!candidate) return undefined;
    const canDrop = this.tree.canDrop;
    if (canDrop === undefined) return candidate;
    try {
      if (typeof canDrop !== 'function') return undefined;
      const answer: unknown = canDrop(candidate.detail);
      if (answer !== true) {
        if (answer && typeof (answer as Partial<PromiseLike<unknown>>).then === 'function') {
          void Promise.resolve(answer).catch(() => undefined);
        }
        return undefined;
      }
    } catch { return undefined; }
    // The synchronous host predicate can itself refresh data, disable a row or change the policy.
    if (this.gesture !== gesture || this.tree.canDrop !== canDrop) return undefined;
    const current = this.candidate(gesture);
    return sameCandidate(candidate, current) ? current : undefined;
  }

  private get indicator(): HTMLElement | null {
    return this.tree.shadowRoot?.querySelector<HTMLElement>('[part="drop-indicator"]') ?? null;
  }

  private updateTarget(): void {
    const gesture = this.gesture;
    if (!gesture?.dragging) return;
    const candidate = this.allowed(gesture);
    gesture.painted = candidate;
    const line = this.indicator;
    const base = line?.parentElement;
    if (line && base) {
      line.hidden = !candidate;
      if (candidate) {
        const row = candidate.row.getBoundingClientRect();
        const origin = base.getBoundingClientRect();
        const style = gesture.view.getComputedStyle(candidate.row);
        const indent = Number.parseFloat(style.paddingInlineStart) || 0;
        const y = candidate.detail.position === 'before' ? row.top : row.bottom;
        line.style.left = `${row.left - origin.left + base.scrollLeft + (style.direction === 'rtl' ? 0 : indent)}px`;
        line.style.top = `${y - origin.top + base.scrollTop}px`;
        line.style.width = `${Math.max(0, row.width - indent)}px`;
      }
    }
    if (this.gesture === gesture && this.animation === undefined) this.autoScroll(gesture);
  }

  private autoScroll(gesture: Gesture): void {
    const scroller = scrollContainer(this.tree, gesture.node);
    if (!scroller) return;
    const doc = this.tree.ownerDocument;
    const treeBounds = this.tree.getBoundingClientRect();
    if (gesture.x < treeBounds.left || gesture.x >= treeBounds.right) return;
    const bounds = scroller === doc.scrollingElement
      ? { top: 0, bottom: gesture.view.innerHeight, left: 0, right: gesture.view.innerWidth }
      : scroller.getBoundingClientRect();
    if (gesture.x < bounds.left || gesture.x >= bounds.right || gesture.y < bounds.top || gesture.y >= bounds.bottom) return;
    const edge = Math.min(36, (bounds.bottom - bounds.top) / 4);
    const distance = gesture.y < bounds.top + edge ? gesture.y - bounds.top - edge
      : gesture.y > bounds.bottom - edge ? gesture.y - bounds.bottom + edge : 0;
    if (!distance) return;
    const delta = Math.sign(distance) * Math.ceil(Math.abs(distance) / 2);
    if (delta < 0 ? scroller.scrollTop <= 0 : scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1) return;
    this.animation = gesture.view.requestAnimationFrame(() => {
      this.animation = undefined;
      if (gesture !== this.gesture) return;
      scroller.scrollTop += delta;
      this.updateTarget();
    });
  }

  private up = (event: PointerEvent): void => {
    const gesture = this.gesture;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gesture.x = event.clientX;
    gesture.y = event.clientY;
    const candidate = gesture.dragging ? this.allowed(gesture) : undefined;
    this.cancel();
    if (candidate && sameCandidate(gesture.painted, candidate)) this.request(candidate.detail);
  };

  private interrupt = (event: PointerEvent): void => {
    if (event.pointerId === this.gesture?.pointerId && (event.type !== 'lostpointercapture' || event.composedPath()[0] === this.tree)) this.cancel();
  };

  private keyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    this.cancel();
  };

  /** Ends gesture-owned listeners and animation on cancellation, mode changes or detachment. */
  cancel = (): void => {
    const gesture = this.gesture;
    if (!gesture) return;
    this.gesture = undefined;
    const { view, pointerId } = gesture;
    if (this.animation !== undefined) view.cancelAnimationFrame(this.animation);
    this.animation = undefined;
    gesture.rowRoot.removeEventListener('selectstart', this.preventNativeDrag, true);
    gesture.rowRoot.removeEventListener('dragstart', this.preventNativeDrag, true);
    gesture.node.removeEventListener('selectstart', this.preventNativeDrag, true);
    gesture.node.removeEventListener('dragstart', this.preventNativeDrag, true);
    view.removeEventListener('pointermove', this.move, true);
    view.removeEventListener('pointerup', this.up, true);
    view.removeEventListener('pointercancel', this.interrupt, true);
    this.tree.removeEventListener('lostpointercapture', this.interrupt);
    view.removeEventListener('keydown', this.keyDown, true);
    view.removeEventListener('blur', this.cancel);
    if (this.tree.hasPointerCapture?.(pointerId)) this.tree.releasePointerCapture(pointerId);
    const line = this.indicator;
    if (line) line.hidden = true;
    if (gesture.dragging && this.tree.isConnected) {
      this.tree.addEventListener('click', this.onClick, true);
      this.tree.addEventListener('pointerdown', this.clearClick, true);
    }
  };

  private onClick = (event: MouseEvent): void => {
    if (event.detail > 0) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.clearClick();
    }
  };

  clearClick = (): void => {
    this.tree.removeEventListener('click', this.onClick, true);
    this.tree.removeEventListener('pointerdown', this.clearClick, true);
  };
}
