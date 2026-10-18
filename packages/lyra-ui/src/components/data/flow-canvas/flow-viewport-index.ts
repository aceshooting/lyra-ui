/** Axis-aligned world bounds used to query only visible diagram primitives. */
export interface FlowViewportBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
interface Entry<T> extends FlowViewportBounds { value: T; order: number }
interface Branch<T> extends FlowViewportBounds {
  entries?: Entry<T>[];
  first?: Branch<T>;
  second?: Branch<T>;
}

/** Geometry index rebuilt for model changes, with local bounds updates for measured card sizes. */
export class FlowViewportIndex<T> {
  private readonly root?: Branch<T>;
  private readonly leaves = new Map<T, Branch<T>>();
  private readonly entries = new Map<T, Entry<T>>();
  private readonly parents = new WeakMap<Branch<T>, Branch<T>>();

  constructor(entries: readonly { value: T; bounds: FlowViewportBounds }[]) {
    this.root = this.build(entries.map(({ value, bounds }, order) => ({ value, order, ...bounds })));
  }

  private build(entries: Entry<T>[]): Branch<T> | undefined {
    if (!entries.length) return undefined;
    const bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    for (const entry of entries) {
      bounds.left = Math.min(bounds.left, entry.left); bounds.top = Math.min(bounds.top, entry.top);
      bounds.right = Math.max(bounds.right, entry.right); bounds.bottom = Math.max(bounds.bottom, entry.bottom);
    }
    if (entries.length <= 8) {
      const leaf = { ...bounds, entries };
      for (const entry of entries) { this.entries.set(entry.value, entry); this.leaves.set(entry.value, leaf); }
      return leaf;
    }
    const horizontal = bounds.right - bounds.left >= bounds.bottom - bounds.top;
    entries.sort((a, b) => horizontal
      ? (a.left + a.right) / 2 - (b.left + b.right) / 2
      : (a.top + a.bottom) / 2 - (b.top + b.bottom) / 2);
    const middle = entries.length >>> 1;
    const branch = { ...bounds, first: this.build(entries.slice(0, middle)), second: this.build(entries.slice(middle)) };
    if (branch.first) this.parents.set(branch.first, branch);
    if (branch.second) this.parents.set(branch.second, branch);
    return branch;
  }

  update(value: T, bounds: FlowViewportBounds): void {
    const entry = this.entries.get(value);
    if (!entry) return;
    Object.assign(entry, bounds);
    let branch = this.leaves.get(value);
    while (branch) {
      const children = branch.entries ?? [branch.first!, branch.second!];
      branch.left = Infinity; branch.top = Infinity; branch.right = -Infinity; branch.bottom = -Infinity;
      for (const child of children) {
        branch.left = Math.min(branch.left, child.left); branch.top = Math.min(branch.top, child.top);
        branch.right = Math.max(branch.right, child.right); branch.bottom = Math.max(branch.bottom, child.bottom);
      }
      branch = this.parents.get(branch);
    }
  }

  private intersects(a: FlowViewportBounds, b: FlowViewportBounds): boolean {
    return a.right >= b.left && a.left <= b.right && a.bottom >= b.top && a.top <= b.bottom;
  }

  query(viewport: FlowViewportBounds): T[] {
    const found: Entry<T>[] = [];
    const visit = (branch: Branch<T> | undefined): void => {
      if (!branch || !this.intersects(branch, viewport)) return;
      if (branch.entries) {
        for (const entry of branch.entries) if (this.intersects(entry, viewport)) found.push(entry);
      } else { visit(branch.first); visit(branch.second); }
    };
    visit(this.root);
    found.sort((a, b) => a.order - b.order);
    return found.map(entry => entry.value);
  }
}
