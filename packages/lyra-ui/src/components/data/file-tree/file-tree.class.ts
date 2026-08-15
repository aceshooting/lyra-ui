import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { finiteCount } from '../../../internal/numbers.js';
import { tag } from '../../../internal/prefix.js';
import { styles } from './file-tree.styles.js';
import type { LyraTree, LyraTreeNodeData, TreeBadge } from '../tree/tree.class.js';
// Value import (not `import type`) -- revealPath() below needs the real constructor at runtime
// for its `instanceof` check.
import { LyraTreeItem } from '../tree/tree-item.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_fileTreeDiffSummary, LYRA_DEFAULT_fileTreeLabel, LYRA_DEFAULT_gitStatusAdded, LYRA_DEFAULT_gitStatusConflicted, LYRA_DEFAULT_gitStatusDeleted, LYRA_DEFAULT_gitStatusIgnored, LYRA_DEFAULT_gitStatusModified, LYRA_DEFAULT_gitStatusRenamed, LYRA_DEFAULT_gitStatusUntracked, LYRA_DEFAULT_loading, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_restore, LYRA_DEFAULT_search, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type GitStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked' | 'conflicted' | 'ignored';

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
const GIT_STATUSES = new Set<GitStatus>(['added', 'modified', 'deleted', 'renamed', 'untracked', 'conflicted', 'ignored']);

interface FileTreeDraft {
  readonly fields: Omit<FileTreeNode, 'children'>;
  readonly children: FileTreeDraft[];
  readonly childrenProvided: boolean;
  normalized?: FileTreeNode;
}

function normalizeFileTreeNodes(value: unknown): readonly FileTreeNode[] {
  let roots: readonly unknown[];
  try { roots = Array.isArray(value) ? value : []; } catch { roots = []; }
  const drafts: FileTreeDraft[] = [];
  const rootDrafts: FileTreeDraft[] = [];
  const seenObjects = new WeakSet<object>();
  const seenPaths = new Set<string>();
  const stack: Array<{ input: readonly unknown[]; output: FileTreeDraft[]; depth: number; index: number }> = [
    { input: roots, output: rootDrafts, depth: 0, index: 0 },
  ];
  while (stack.length > 0 && drafts.length < MAX_FILE_TREE_NODES) {
    const frame = stack[stack.length - 1]!;
    if (frame.index >= frame.input.length) {
      stack.pop();
      continue;
    }
    let candidate: unknown;
    try { candidate = frame.input[frame.index++]; } catch { continue; }
    if (typeof candidate !== 'object' || candidate === null || seenObjects.has(candidate)) continue;
    seenObjects.add(candidate);
    try {
      const record = candidate as Record<string, unknown>;
      const path = record['path'];
      if (typeof path !== 'string' || path.length === 0 || seenPaths.has(path)) continue;
      seenPaths.add(path);
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
      const childrenProvided = Array.isArray(rawChildren);
      const draft: FileTreeDraft = { fields, children: [], childrenProvided };
      frame.output.push(draft);
      drafts.push(draft);
      if (childrenProvided && frame.depth < MAX_FILE_TREE_DEPTH) {
        stack.push({ input: rawChildren, output: draft.children, depth: frame.depth + 1, index: 0 });
      }
    } catch {
      // Retain later valid siblings when a hostile record getter fails.
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
  return Object.freeze(rootDrafts.map((draft) => draft.normalized!));
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
  'lr-file-select': CustomEvent<Readonly<{ path: string; node: FileTreeNode }>>;
  'lr-file-open': CustomEvent<Readonly<{ path: string; node: FileTreeNode }>>;
  'lr-load-children': CustomEvent<Readonly<{ path: string }>>;
}

/**
 * `<lr-file-tree>` — a file-explorer preset over `<lr-tree>` + `<lr-file-icon>`: path-keyed
 * nodes with git-status/diff-count badges, lazy directory loading, and select/open events.
 *
 * @customElement lr-file-tree
 * @event lr-file-select - `detail: { path, node }` — a row was activated.
 * @event lr-file-open - `detail: { path, node }` — Enter/click on an already-selected file row
 *   (keyboard-open parity: a second activation of the same file opens it).
 * @event lr-load-children - `detail: { path }` — a lazy (hasChildren, unloaded) directory expanded.
 * @csspart base - The root wrapper.
 * @status stable
 * @since 4.0.0
 */
export class LyraFileTree extends LyraElement<LyraFileTreeEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    fileTreeDiffSummary: LYRA_DEFAULT_fileTreeDiffSummary,
    fileTreeLabel: LYRA_DEFAULT_fileTreeLabel,
    gitStatusAdded: LYRA_DEFAULT_gitStatusAdded,
    gitStatusConflicted: LYRA_DEFAULT_gitStatusConflicted,
    gitStatusDeleted: LYRA_DEFAULT_gitStatusDeleted,
    gitStatusIgnored: LYRA_DEFAULT_gitStatusIgnored,
    gitStatusModified: LYRA_DEFAULT_gitStatusModified,
    gitStatusRenamed: LYRA_DEFAULT_gitStatusRenamed,
    gitStatusUntracked: LYRA_DEFAULT_gitStatusUntracked,
    loading: LYRA_DEFAULT_loading,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    restore: LYRA_DEFAULT_restore,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  private _nodes: readonly FileTreeNode[] = [];
  /** Clone-owned, cycle-safe readonly node snapshot. Duplicate paths use the first valid node;
   *  projection is bounded to 10,000 nodes and 64 descendant levels. */
  @property({ attribute: false })
  get nodes(): readonly FileTreeNode[] { return this._nodes; }
  set nodes(value: readonly FileTreeNode[]) {
    const previous = this._nodes;
    this._nodes = normalizeFileTreeNodes(value);
    this.requestUpdate('nodes', previous);
  }
  @property({ attribute: 'selected-path' }) selectedPath: string | null = null;
  @property() label = '';

  private nodesByPath = new Map<string, FileTreeNode>();
  private parentPathByPath = new Map<string, string>();

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
    if (isLazyUnloaded(node)) {
      children = [{ id: `${node.path} loading`, label: this.localize('loading'), disabled: true }];
    } else if (node.children) {
      children = node.children.map((c) => this.toTreeItem(c));
    }
    return {
      id: node.path,
      label: node.name ?? baseName(node.path),
      selected: this.selectedPath === node.path,
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
    const { id } = (e as CustomEvent<{ id: string }>).detail;
    const node = this.nodesByPath.get(id);
    if (!node) return;
    const wasSelected = this.selectedPath === id;
    this.selectedPath = id;
    this.emit('lr-file-select', Object.freeze({ path: id, node }));
    if (!isDirectory(node) && wasSelected) {
      this.emit('lr-file-open', Object.freeze({ path: id, node }));
    }
  };

  private onNodeToggle = (e: Event): void => {
    e.stopPropagation();
    const { id, expanded } = (e as CustomEvent<{ id: string; expanded: boolean }>).detail;
    if (!expanded) return;
    const node = this.nodesByPath.get(id);
    if (node && isLazyUnloaded(node)) {
      this.emit('lr-load-children', Object.freeze({ path: id }));
    }
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
    return (this.renderRoot.querySelector(tag('tree')) as LyraTree | null)?.expandAll();
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
          label=${hostLabel ?? (this.label || this.localize('fileTreeLabel'))}
          @lr-node-select=${this.onNodeSelect}
          @lr-node-toggle=${this.onNodeToggle}
        ></lr-tree>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-file-tree': LyraFileTree;
  }
}
