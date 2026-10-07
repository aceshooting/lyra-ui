import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { finiteCount } from '../../../internal/numbers.js';
import { tag } from '../../../internal/prefix.js';
import { styles } from './file-tree.styles.js';
import { GIT_STATUSES, type GitStatus } from './file-tree-status.js';
export { GIT_STATUSES } from './file-tree-status.js';
export type { GitStatus } from './file-tree-status.js';
import type { LyraTree, LyraTreeNodeData, TreeBadge } from '../tree/tree.class.js';
// Value import (not `import type`) -- revealPath() below needs the real constructor at runtime
// for its `instanceof` check.
import { LyraTreeItem } from '../tree/tree-item.class.js';
import { TREE_MAX_RENDER_NODES } from '../tree/tree-types.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_copy, LYRA_DEFAULT_details, LYRA_DEFAULT_fileTreeDiffSummary, LYRA_DEFAULT_fileTreeLabel, LYRA_DEFAULT_gitStatusAdded, LYRA_DEFAULT_gitStatusConflicted, LYRA_DEFAULT_gitStatusDeleted, LYRA_DEFAULT_gitStatusIgnored, LYRA_DEFAULT_gitStatusModified, LYRA_DEFAULT_gitStatusRenamed, LYRA_DEFAULT_gitStatusUntracked, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_treeLimit } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END



export interface FileTreeNode {
  readonly path: string;
  readonly name?: string;
  readonly kind?: 'file' | 'directory';
  readonly mimeType?: string;
  readonly gitStatus?: GitStatus;
  readonly additions?: number;
  readonly deletions?: number;
  readonly children?: readonly FileTreeNode[];
  readonly hasChildren?: boolean;
}

const MAX_FILE_TREE_NODES = 10_000;
const MAX_FILE_TREE_DEPTH = 64;

interface FileTreeDraft {
  readonly fields: Omit<FileTreeNode, 'children'>;
  readonly children: FileTreeDraft[];
  readonly childrenProvided: boolean;
  normalized?: FileTreeNode;
}

function boundedArrayShape(value: unknown): {
  readonly isArray: boolean;
  readonly length: number;
  readonly truncated: boolean;
} {
  try {
    if (!Array.isArray(value)) return { isArray: false, length: 0, truncated: false };
    const descriptor = Object.getOwnPropertyDescriptor(value, 'length');
    const length = descriptor && 'value' in descriptor ? descriptor.value : 0;
    const valid = typeof length === 'number' && Number.isSafeInteger(length) && length >= 0;
    return {
      isArray: true,
      length: valid ? Math.min(length, MAX_FILE_TREE_NODES) : 0,
      truncated: valid && length > MAX_FILE_TREE_NODES,
    };
  } catch {
    return { isArray: false, length: 0, truncated: true };
  }
}

function normalizeFileTreeNodes(value: unknown): readonly FileTreeNode[] {
  return normalizeFileTreeSnapshot(value).nodes;
}

/** Normalizes a node listing and reports whether any supplied entry was omitted (malformed,
 *  duplicate, cyclic, over-depth, or beyond the inspected-position budget). */
function normalizeFileTreeSnapshot(value: unknown): {
  readonly nodes: readonly FileTreeNode[];
  readonly truncated: boolean;
  readonly limitReached: boolean;
} {
  let truncated = false;
  let limitReached = false;
  const rootShape = boundedArrayShape(value);
  const roots = rootShape.isArray ? (value as readonly unknown[]) : [];
  const drafts: FileTreeDraft[] = [];
  const rootDrafts: FileTreeDraft[] = [];
  const seenObjects = new WeakSet<object>();
  const seenPaths = new Set<string>();
  const stack: Array<{
    input: readonly unknown[];
    output: FileTreeDraft[];
    depth: number;
    index: number;
    length: number;
  }> = [
    { input: roots, output: rootDrafts, depth: 0, index: 0, length: rootShape.length },
  ];
  let inspected = 0;
  if (rootShape.truncated) truncated = true;
  while (stack.length > 0) {
    const frame = stack[stack.length - 1]!;
    if (frame.index >= frame.length) {
      stack.pop();
      continue;
    }
    if (drafts.length >= MAX_FILE_TREE_NODES || inspected >= MAX_FILE_TREE_NODES) {
      truncated = true;
      limitReached = drafts.length >= MAX_FILE_TREE_NODES;
      break;
    }
    const sourceIndex = frame.index++;
    inspected += 1;
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(frame.input, String(sourceIndex));
    } catch {
      truncated = true;
      continue;
    }
    if (!descriptor || !('value' in descriptor)) {
      truncated = true;
      continue;
    }
    const candidate = descriptor.value;
    if (typeof candidate !== 'object' || candidate === null || seenObjects.has(candidate)) {
      truncated = true;
      continue;
    }
    try {
      const record = candidate as Record<string, unknown>;
      const path = record['path'];
      if (typeof path !== 'string' || path.trim().length === 0 || seenPaths.has(path)) {
        truncated = true;
        continue;
      }
      const name = record['name'];
      const kind = record['kind'];
      const mimeType = record['mimeType'];
      const gitStatus = record['gitStatus'];
      const additions = record['additions'];
      const deletions = record['deletions'];
      const hasChildren = record['hasChildren'];
      const rawChildren = record['children'];
      const fields: Omit<FileTreeNode, 'children'> = {
        path,
        ...(typeof name === 'string' ? { name } : {}),
        ...(kind === 'file' || kind === 'directory' ? { kind } : {}),
        ...(typeof mimeType === 'string' ? { mimeType } : {}),
        ...(typeof gitStatus === 'string' && GIT_STATUSES.has(gitStatus as GitStatus)
          ? { gitStatus: gitStatus as GitStatus }
          : {}),
        ...(additions === undefined ? {} : { additions: finiteCount(typeof additions === 'number' ? additions : 0) }),
        ...(deletions === undefined ? {} : { deletions: finiteCount(typeof deletions === 'number' ? deletions : 0) }),
        ...(hasChildren === undefined ? {} : { hasChildren: Boolean(hasChildren) }),
      };
      const childShape = boundedArrayShape(rawChildren);
      const childrenProvided = childShape.isArray;
      const draft: FileTreeDraft = { fields, children: [], childrenProvided };
      seenObjects.add(candidate);
      seenPaths.add(path);
      frame.output.push(draft);
      drafts.push(draft);
      if (childShape.truncated) truncated = true;
      if (childrenProvided && frame.depth < MAX_FILE_TREE_DEPTH) {
        stack.push({
          input: rawChildren as readonly unknown[],
          output: draft.children,
          depth: frame.depth + 1,
          index: 0,
          length: childShape.length,
        });
      } else if (childShape.length > 0) {
        truncated = true;
      }
    } catch {
      // Retain later valid siblings when a hostile record getter fails.
      truncated = true;
    }
  }
  for (let index = drafts.length - 1; index >= 0; index--) {
    const draft = drafts[index]!;
    draft.normalized = Object.freeze({
      ...draft.fields,
      ...(draft.childrenProvided
        ? { children: Object.freeze(draft.children.map((child) => child.normalized!)) }
        : {}),
    });
  }
  return { nodes: Object.freeze(rootDrafts.map((draft) => draft.normalized!)), truncated, limitReached };
}

const GIT_STATUS_LETTER: Record<GitStatus, string> = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
  untracked: 'U',
  conflicted: 'C',
  ignored: '!',
};

const GIT_STATUS_TONE: Record<GitStatus, TreeBadge['tone']> = {
  added: 'success',
  untracked: 'success',
  modified: 'brand',
  renamed: 'brand',
  deleted: 'danger',
  conflicted: 'danger',
  ignored: 'neutral',
};

const GIT_STATUS_KEY: Record<GitStatus, string> = {
  added: 'gitStatusAdded',
  modified: 'gitStatusModified',
  deleted: 'gitStatusDeleted',
  renamed: 'gitStatusRenamed',
  untracked: 'gitStatusUntracked',
  conflicted: 'gitStatusConflicted',
  ignored: 'gitStatusIgnored',
};

function baseName(path: string): string {
  const segments = path.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? path;
}

function isDirectory(node: FileTreeNode): boolean {
  return node.kind === 'directory' || node.children !== undefined || node.hasChildren === true;
}

/** True for a directory whose children haven't loaded yet (hasChildren, but no children array). */
function isLazyUnloaded(node: FileTreeNode): boolean {
  return isDirectory(node) && node.hasChildren === true && node.children === undefined;
}

export interface LyraFileTreeEventMap {
  'lr-file-select': CustomEvent<Readonly<{ filePath: string; node: FileTreeNode }>>;
  'lr-file-open': CustomEvent<Readonly<{ filePath: string; node: FileTreeNode }>>;
  'lr-load-children': CustomEvent<Readonly<{ filePath: string }>>;
}

/**
 * `<lr-file-tree>` — a file-explorer preset over `<lr-tree>` + `<lr-file-icon>`: path-keyed
 * nodes with git-status/diff-count badges, lazy directory loading, and select/open events.
 *
 * **The composed `<lr-tree>`'s `reorderable`/`lr-reorder` capability is deliberately not
 * forwarded.** The tree it renders is not a model this component owns: `treeItems` is derived
 * from `nodes` on every render and keyed by filesystem path, so sibling order is whatever the
 * host's own listing produced (name, type, git status), not an authored sequence a user can
 * rearrange. `<lr-tree>`'s reorder is also strictly sibling-scoped — it never crosses a subtree
 * boundary, precisely so a reorder can never become a reparent — which is the one file operation
 * ("move this file into that directory") that would change a path and therefore mean something
 * here. Forwarding it would have to invent a second, path-shaped event alongside
 * `lr-file-select`/`lr-file-open`/`lr-load-children`, permanently, for a gesture whose result the
 * host would have to discard. A consumer that genuinely needs orderable rows composes `<lr-tree>`
 * directly, where the capability already lives.
 *
 * @customElement lr-file-tree
 * @event lr-file-select - `detail: { filePath, node }` — a row was activated.
 * @event lr-file-open - `detail: { filePath, node }` — Enter/click on an already-selected file row
 *   (keyboard-open parity: a second activation of the same file opens it).
 * @event lr-load-children - `detail: { filePath }` — a lazy (hasChildren, unloaded) directory expanded.
 * @csspart base - The root wrapper.
 * @csspart limit - Localized notice when the source listing exceeds its 10,000-item snapshot.
 * @status stable
 * @since 4.0.0
 */
export class LyraFileTree extends LyraElement<LyraFileTreeEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    copy: LYRA_DEFAULT_copy,
    details: LYRA_DEFAULT_details,
    fileTreeDiffSummary: LYRA_DEFAULT_fileTreeDiffSummary,
    fileTreeLabel: LYRA_DEFAULT_fileTreeLabel,
    gitStatusAdded: LYRA_DEFAULT_gitStatusAdded,
    gitStatusConflicted: LYRA_DEFAULT_gitStatusConflicted,
    gitStatusDeleted: LYRA_DEFAULT_gitStatusDeleted,
    gitStatusIgnored: LYRA_DEFAULT_gitStatusIgnored,
    gitStatusModified: LYRA_DEFAULT_gitStatusModified,
    gitStatusRenamed: LYRA_DEFAULT_gitStatusRenamed,
    gitStatusUntracked: LYRA_DEFAULT_gitStatusUntracked,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
    treeLimit: LYRA_DEFAULT_treeLimit,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  private _nodes: readonly FileTreeNode[] = [];
  private nodesTruncated = false;
  private nodesLimitReached = false;
  private lastNodesSource: unknown = undefined;
  /** Clone-owned, cycle-safe readonly node snapshot. Empty/blank paths are omitted and duplicate
   * paths use the first valid node; projection inspects at most 10,000 source positions across 64
   * descendant levels. An unreadable optional field rejects only its node, without reserving the
   * path against a later valid occurrence. The composed `<lr-tree>` holds at most 1,000 rows, so
   * a larger listing projects each collapsed directory as a single row whose children load from
   * this snapshot when it expands; `dataTruncated` reports anything still omitted. Reassign after
   * changes. */
  @property({ attribute: false })
  get nodes(): readonly FileTreeNode[] { return this._nodes; }
  set nodes(value: readonly FileTreeNode[]) {
    // A re-render that rebinds the same listing (or this getter's own snapshot) changes nothing.
    if (value === this.lastNodesSource || value === this._nodes) return;
    const previous = this._nodes;
    const snapshot = normalizeFileTreeSnapshot(value);
    this.lastNodesSource = value;
    this._nodes = snapshot.nodes;
    this.nodesTruncated = snapshot.truncated;
    this.nodesLimitReached = snapshot.limitReached;
    this.requestUpdate('nodes', previous);
  }

  /** Whether any supplied node is not shown: omitted while normalizing `nodes` (malformed,
   *  duplicate, cyclic, over-depth, or over-budget entries) or beyond the composed `<lr-tree>`'s
   *  1,000-row budget for the directories currently expanded. */
  get dataTruncated(): boolean {
    const tree = this.renderRoot?.querySelector?.(tag('tree')) as LyraTree | null | undefined;
    return this.nodesTruncated || Boolean(tree?.dataTruncated);
  }
  @property({ attribute: 'selected-path' }) selectedPath: string | null = null;
  /** Accessible-name override for the internal `<lr-tree>`; falls back to the localized default
   *  when unset. An explicitly empty string renders as an empty label rather than falling back. */
  @property() label?: string;

  private nodesByPath = new Map<string, FileTreeNode>();
  private parentPathByPath = new Map<string, string>();
  /** Directories the inner tree reports expanded. Only consulted when the whole listing exceeds
   *  the inner tree's row budget: then just these directories project their children. */
  private expandedPaths = new Set<string>();

  /** Whether every normalized node fits the composed tree's row budget at once. */
  private get projectsAllNodes(): boolean {
    return this.nodesByPath.size <= TREE_MAX_RENDER_NODES;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('nodes')) {
      this.nodesByPath = new Map();
      this.parentPathByPath = new Map();
      const stack = [...this.nodes].reverse().map((node) => ({ node, parentPath: undefined as string | undefined }));
      while (stack.length > 0) {
        const { node, parentPath } = stack.pop()!;
        this.nodesByPath.set(node.path, node);
        if (parentPath !== undefined) this.parentPathByPath.set(node.path, parentPath);
        if (node.children) {
          for (let index = node.children.length - 1; index >= 0; index--) {
            stack.push({ node: node.children[index]!, parentPath: node.path });
          }
        }
      }
    }
  }

  private toTreeItem(node: FileTreeNode): LyraTreeNodeData {
    const badges: TreeBadge[] = [];
    if (node.gitStatus) {
      badges.push({
        text: GIT_STATUS_LETTER[node.gitStatus],
        tone: GIT_STATUS_TONE[node.gitStatus],
        label: this.localize(GIT_STATUS_KEY[node.gitStatus]),
      });
    }
    const hasDiff = node.additions !== undefined || node.deletions !== undefined;
    const description = hasDiff
      ? this.localize('fileTreeDiffSummary', undefined, {
          additions: getNumberFormat(this.effectiveLocale).format(node.additions ?? 0),
          deletions: getNumberFormat(this.effectiveLocale).format(node.deletions ?? 0),
        })
      : undefined;
    let children: LyraTreeNodeData[] | undefined;
    // An unloaded directory uses the inner tree's own lazy lifecycle (busy state, one request per
    // expansion, stale-response rejection). Over the row budget, a collapsed loaded directory is
    // projected the same way and its children load from the snapshot when it expands.
    let lazy = isLazyUnloaded(node);
    if (!lazy && node.children) {
      if (this.projectsAllNodes || this.expandedPaths.has(node.path)) {
        children = node.children.map((c) => this.toTreeItem(c));
      } else {
        lazy = node.children.length > 0;
      }
    }
    return {
      id: node.path,
      label: node.name ?? baseName(node.path),
      selected: this.selectedPath === node.path,
      ...(lazy ? { lazy } : {}),
      children,
      badges: badges.length > 0 ? badges : undefined,
      description,
      icon: isDirectory(node)
        ? undefined
        : html`<lr-file-icon
            mime-type=${node.mimeType ?? ''}
            name=${node.name ?? baseName(node.path)}
            decorative
          ></lr-file-icon>`,
    };
  }

  private get treeItems(): LyraTreeNodeData[] {
    return this.nodes.map((n) => this.toTreeItem(n));
  }

  private onNodeSelect = (e: Event): void => {
    e.stopPropagation();
    const { nodeId } = (e as CustomEvent<{ nodeId: string }>).detail;
    const node = this.nodesByPath.get(nodeId);
    if (!node) return;
    const wasSelected = this.selectedPath === nodeId;
    this.selectedPath = nodeId;
    this.emit('lr-file-select', Object.freeze({ filePath: nodeId, node }));
    if (!isDirectory(node) && wasSelected) {
      this.emit('lr-file-open', Object.freeze({ filePath: nodeId, node }));
    }
  };

  private onNodeToggle = (e: Event): void => {
    e.stopPropagation();
    const { nodeId, expanded } = (e as CustomEvent<{ nodeId: string; expanded: boolean }>).detail;
    if (expanded) {
      this.expandedPaths.add(nodeId);
      return;
    }
    if (!this.expandedPaths.delete(nodeId)) return;
    // Forget expanded descendants too, so a re-expanded directory starts collapsed beneath.
    for (const path of [...this.expandedPaths]) {
      for (let parent = this.parentPathByPath.get(path); parent !== undefined; parent = this.parentPathByPath.get(parent)) {
        if (parent === nodeId) {
          this.expandedPaths.delete(path);
          break;
        }
      }
    }
    if (!this.projectsAllNodes) this.requestUpdate();
  };

  /** The inner tree's lazy request for a directory: an unloaded one asks the host for children;
   *  a loaded one (projected lazily over the row budget) is answered from the snapshot. */
  private onLazyLoad = (e: Event): void => {
    e.stopPropagation();
    const nodeId = (e as CustomEvent<{ item: LyraTreeItem }>).detail.item.nodeId;
    const node = this.nodesByPath.get(nodeId);
    if (!node) return;
    if (isLazyUnloaded(node)) {
      this.emit('lr-load-children', Object.freeze({ filePath: nodeId }));
      return;
    }
    this.expandedPaths.add(nodeId);
    this.requestUpdate();
  };

  /** Keeps the composed tree's own events, whose details reference its shadow-internal items,
   *  inside this component; `lr-file-select`, `lr-file-open` and `lr-load-children` are the
   *  public contract. */
  private stopInnerEvent = (e: Event): void => {
    e.stopPropagation();
  };

  /** Fulfills a lazy directory's children in place. Expansion state survives because `<lr-tree>`
   *  reconciles top-level items by id and each `<lr-tree-item>` keeps its own `expanded` state. */
  setChildren(path: string, children: readonly FileTreeNode[]): void {
    const target = this.nodesByPath.get(path);
    if (!target) return;
    let currentPath = path;
    let replacement: FileTreeNode = { ...target, children: normalizeFileTreeNodes(children) };
    for (;;) {
      const parentPath = this.parentPathByPath.get(currentPath);
      if (parentPath === undefined) break;
      const parent = this.nodesByPath.get(parentPath)!;
      replacement = {
        ...parent,
        children: parent.children?.map((child) => child.path === currentPath ? replacement : child),
      };
      currentPath = parentPath;
    }
    this.nodes = this.nodes.map((node) => node.path === currentPath ? replacement : node);
  }

  private ancestorChain(path: string): string[] {
    if (!this.nodesByPath.has(path)) return [];
    const chain: string[] = [];
    let current: string | undefined = path;
    while (current !== undefined) {
      chain.push(current);
      current = this.parentPathByPath.get(current);
    }
    return chain.reverse();
  }

  /** Expands every ancestor of `path` and focuses its row. Resolves `false` when `path` isn't
   *  present in `nodes` (including a still-unloaded lazy descendant). */
  async revealPath(path: string): Promise<boolean> {
    const treeEl = this.renderRoot.querySelector(tag('tree')) as LyraTree | null;
    if (!treeEl) return false;
    const chain = this.ancestorChain(path);
    if (chain.length === 0) return false;
    // Over the row budget, project each ancestor's children before expanding it.
    if (!this.projectsAllNodes && chain.slice(0, -1).some((id) => !this.expandedPaths.has(id))) {
      for (const id of chain.slice(0, -1)) this.expandedPaths.add(id);
      this.requestUpdate();
      await this.updateComplete;
      await treeEl.updateComplete;
    }
    let container: LyraTree | LyraTreeItem = treeEl;
    let node: LyraTreeItem | null = null;
    for (const id of chain) {
      const candidates = (
        container instanceof LyraTreeItem
          ? [...(container.shadowRoot?.querySelectorAll(tag('tree-item')) ?? [])]
          : [...container.querySelectorAll(tag('tree-item'))]
      ) as LyraTreeItem[];
      node = candidates.find((n) => n.item?.id === id) ?? null;
      if (!node) return false;
      if (id !== chain[chain.length - 1] && !node.expanded) {
        node.expand();
        await node.updateComplete;
      }
      container = node;
    }
    node?.focus();
    return true;
  }

  expandAll(): Promise<void> | void {
    const expandTree = (): Promise<void> | undefined =>
      (this.renderRoot.querySelector(tag('tree')) as LyraTree | null)?.expandAll();
    if (this.projectsAllNodes) return expandTree();
    // Over the row budget, project every loaded directory first; the inner tree then shows as
    // many rows as its budget allows and `dataTruncated` reports the rest.
    for (const [path, node] of this.nodesByPath) {
      if (node.children?.length) this.expandedPaths.add(path);
    }
    this.requestUpdate();
    return this.updateComplete.then(() => expandTree());
  }

  collapseAll(): void {
    (this.renderRoot.querySelector(tag('tree')) as LyraTree | null)?.collapseAll();
  }

  override render(): TemplateResult {
    const hostLabel = this.getAttribute('aria-label');
    return html`
      <div part="base">
        <lr-tree
          .data=${this.treeItems}
          label=${hostLabel ?? (this.label == null ? this.localize('fileTreeLabel') : this.label)}
          @lr-node-select=${this.onNodeSelect}
          @lr-node-toggle=${this.onNodeToggle}
          @lr-lazy-load=${this.onLazyLoad}
          @lr-lazy-change=${this.stopInnerEvent}
          @lr-selection-change=${this.stopInnerEvent}
          @lr-expand=${this.stopInnerEvent}
          @lr-after-expand=${this.stopInnerEvent}
          @lr-collapse=${this.stopInnerEvent}
          @lr-after-collapse=${this.stopInnerEvent}
        ></lr-tree>
        ${this.nodesLimitReached
          ? html`<div part="limit">${this.localize('treeLimit', undefined, {
              count: getNumberFormat(this.effectiveLocale).format(MAX_FILE_TREE_NODES),
            })}</div>`
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-file-tree': LyraFileTree;
  }
}
