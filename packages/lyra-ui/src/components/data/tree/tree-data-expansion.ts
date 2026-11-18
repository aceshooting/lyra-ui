import { TREE_MAX_RENDER_DEPTH, type LyraTreeNodeData } from './tree-types.js';

type Expansion = 'closed' | 'open' | 'awaiting-children';

interface ExpansionEntry {
  readonly item: LyraTreeNodeData;
  readonly branch: boolean;
  state: Expansion;
}

/** Stores disclosure for normalized data rows, including rows with no current element. @internal */
export class TreeDataExpansion {
  private entries = new Map<string, ExpansionEntry>();

  constructor(private readonly isActive: () => boolean) {}

  replace(roots: readonly LyraTreeNodeData[]): void {
    const next = new Map<string, ExpansionEntry>();
    const stack = roots.map((item) => ({ item, depth: 0 })).reverse();
    while (stack.length > 0) {
      const { item, depth } = stack.pop()!;
      const previous = this.entries.get(item.id);
      const children = item.children ?? [];
      const loaded = children.length > 0;
      const branch = !item.disabled && depth < TREE_MAX_RENDER_DEPTH && (item.lazy === true || loaded);
      let state: Expansion = 'closed';
      if (branch) {
        const reseeds = !previous || (item.expanded !== undefined && item.expanded !== previous.item.expanded);
        if (reseeds) {
          if (item.expanded) state = loaded ? 'open' : 'awaiting-children';
        } else if (previous.state === 'awaiting-children') {
          state = loaded ? 'open' : 'awaiting-children';
        } else if (loaded) {
          state = previous.state;
        }
      }
      next.set(item.id, { item, branch, state });
      for (let index = children.length - 1; index >= 0; index--) {
        stack.push({ item: children[index]!, depth: depth + 1 });
      }
    }
    this.entries = next;
  }

  private entry(item: LyraTreeNodeData): ExpansionEntry | undefined {
    if (!this.isActive()) return undefined;
    const entry = this.entries.get(item.id);
    return entry?.item === item ? entry : undefined;
  }

  read(item: LyraTreeNodeData): Expansion | undefined {
    return this.entry(item)?.state;
  }

  write(item: LyraTreeNodeData, expanded: boolean): void {
    const entry = this.entry(item);
    if (!entry?.branch) return;
    if (!expanded) entry.state = 'closed';
    else if (item.children?.length) entry.state = 'open';
  }

  /** Closes dormant rows and drops pending intent. Requests do not count as opened branches. */
  closeAll(changed: Set<string>, mounted: ReadonlySet<LyraTreeNodeData>): void {
    for (const [id, entry] of this.entries) {
      if (entry.state === 'open' && !mounted.has(entry.item)) changed.add(id);
      entry.state = 'closed';
    }
  }
}
