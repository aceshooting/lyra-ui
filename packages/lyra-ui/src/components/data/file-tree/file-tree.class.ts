import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { tag } from '../../../internal/prefix.js';
import { styles } from './file-tree.styles.js';
// The registering barrels (not the bare *.class.js modules) -- these side effects are what make
// <lr-tree> and <lr-file-icon> actually-defined tags by the time this component renders them.
import '../tree/tree.js';
import '../../media/file-icon/file-icon.js';
import type { LyraTree, TreeItem, TreeBadge } from '../tree/tree.class.js';
// Value import (not `import type`) -- revealPath() below needs the real constructor at runtime
// for its `instanceof` check.
import { LyraTreeNode } from '../tree/tree-node.class.js';

export type GitStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked' | 'conflicted' | 'ignored';

export interface FileTreeNode {
  path: string;
  name?: string;
  kind?: 'file' | 'directory';
  mimeType?: string;
  gitStatus?: GitStatus;
  additions?: number;
  deletions?: number;
  children?: FileTreeNode[];
  hasChildren?: boolean;
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
  'lr-file-select': CustomEvent<{ path: string; node: FileTreeNode }>;
  'lr-file-open': CustomEvent<{ path: string; node: FileTreeNode }>;
  'lr-load-children': CustomEvent<{ path: string }>;
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
 */
export class LyraFileTree extends LyraElement<LyraFileTreeEventMap> {
  static override styles = [LyraElement.styles, styles];

  @property({ attribute: false }) nodes: FileTreeNode[] = [];
  @property({ attribute: 'selected-path' }) selectedPath: string | null = null;
  @property() label = '';

  private nodesByPath = new Map<string, FileTreeNode>();

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('nodes')) {
      this.nodesByPath = new Map();
      const index = (list: FileTreeNode[]) => {
        for (const n of list) {
          this.nodesByPath.set(n.path, n);
          if (n.children) index(n.children);
        }
      };
      index(this.nodes);
    }
  }

  private toTreeItem(node: FileTreeNode): TreeItem {
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
          additions: node.additions ?? 0,
          deletions: node.deletions ?? 0,
        })
      : undefined;
    let children: TreeItem[] | undefined;
    if (isLazyUnloaded(node)) {
      children = [{ id: `${node.path} loading`, label: this.localize('loading') }];
    } else if (node.children) {
      children = node.children.map((c) => this.toTreeItem(c));
    }
    return {
      id: node.path,
      label: node.name ?? baseName(node.path),
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

  private get treeItems(): TreeItem[] {
    return this.nodes.map((n) => this.toTreeItem(n));
  }

  private onNodeSelect = (e: Event): void => {
    const { id } = (e as CustomEvent<{ id: string }>).detail;
    const node = this.nodesByPath.get(id);
    if (!node || id.includes(' loading')) return;
    const wasSelected = this.selectedPath === id;
    this.selectedPath = id;
    this.emit('lr-file-select', { path: id, node });
    if (!isDirectory(node) && wasSelected) {
      this.emit('lr-file-open', { path: id, node });
    }
  };

  private onNodeToggle = (e: Event): void => {
    const { id, expanded } = (e as CustomEvent<{ id: string; expanded: boolean }>).detail;
    if (!expanded) return;
    const node = this.nodesByPath.get(id);
    if (node && isLazyUnloaded(node)) {
      this.emit('lr-load-children', { path: id });
    }
  };

  /** Fulfills a lazy directory's children in place. Expansion state survives because `<lr-tree>`
   *  reconciles top-level items by id and each `<lr-tree-node>` keeps its own `expanded` state. */
  setChildren(path: string, children: FileTreeNode[]): void {
    const replace = (list: FileTreeNode[]): FileTreeNode[] =>
      list.map((n) => {
        if (n.path === path) return { ...n, children };
        if (n.children) return { ...n, children: replace(n.children) };
        return n;
      });
    this.nodes = replace(this.nodes);
  }

  private ancestorChain(path: string): string[] {
    const walk = (list: FileTreeNode[], trail: string[]): string[] | null => {
      for (const n of list) {
        const nextTrail = [...trail, n.path];
        if (n.path === path) return nextTrail;
        if (n.children) {
          const found = walk(n.children, nextTrail);
          if (found) return found;
        }
      }
      return null;
    };
    return walk(this.nodes, []) ?? [];
  }

  /** Expands every ancestor of `path` and focuses its row. Resolves `false` when `path` isn't
   *  present in `nodes` (including a still-unloaded lazy descendant). */
  async revealPath(path: string): Promise<boolean> {
    const treeEl = this.renderRoot.querySelector(tag('tree')) as LyraTree | null;
    if (!treeEl) return false;
    const chain = this.ancestorChain(path);
    if (chain.length === 0) return false;
    let container: LyraTree | LyraTreeNode = treeEl;
    let node: LyraTreeNode | null = null;
    for (const id of chain) {
      const candidates = (
        container instanceof LyraTreeNode
          ? [...(container.shadowRoot?.querySelectorAll(tag('tree-node')) ?? [])]
          : [...container.querySelectorAll(tag('tree-node'))]
      ) as LyraTreeNode[];
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
    return html`
      <div part="base">
        <lr-tree
          .data=${this.treeItems}
          label=${this.label || this.localize('fileTreeLabel')}
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
