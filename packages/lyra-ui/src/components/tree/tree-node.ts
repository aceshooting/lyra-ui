import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { css } from 'lit';
import type { TreeItem } from './tree.js';

const styles = css`
  :host {
    display: block;
    outline: none; /* the host is the focusable treeitem; the visible ring lives on [part=row] */
  }
  :host(:focus-visible) [part='row'] {
    outline: 2px solid var(--lyra-color-brand);
    outline-offset: -2px;
  }
  [part='row'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    padding-inline-start: calc(var(--lyra-space-s) + var(--lyra-tree-depth, 0) * 1rem);
    cursor: pointer;
    border-radius: var(--lyra-radius);
  }
  [part='row']:hover {
    background: var(--lyra-color-brand-quiet);
  }
  [part='toggle'] {
    inline-size: 1rem;
    block-size: 1rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    color: var(--lyra-color-text-quiet);
    cursor: pointer;
    flex: 0 0 auto;
  }
  [part='toggle']:empty {
    visibility: hidden;
  }
  [part='label'] {
    flex: 1 1 auto;
  }
  [part='badge'] {
    font-size: 0.75rem;
    color: var(--lyra-color-text-quiet);
    background: var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    padding: 0 0.35rem;
  }
`;

/**
 * `<lyra-tree-node>` — internal recursive renderer for `<lyra-tree>`.
 *
 * `role="treeitem"` (plus `aria-expanded`/`aria-level`/`aria-setsize`/
 * `aria-posinset` and the roving `tabindex`, driven by `<lyra-tree>`) live on
 * the *host* element, not the internal `[part="row"]` div — that makes this
 * node's own nested children (rendered in *its own* shadow root as further
 * `role="group"` content) genuine DOM descendants of the treeitem, which is
 * what the WAI-ARIA treeitem pattern requires (2026-07-10 audit,
 * "temporal-graph" §lyra-tree, Medium — previously a shadow-root sibling).
 *
 * @customElement lyra-tree-node
 * @csspart row, toggle, label, badge
 */
export class LyraTreeNode extends LyraElement {
  static styles = [LyraElement.styles, styles];

  @property({ attribute: false }) item!: TreeItem;
  @property({ type: Number }) depth = 0;
  @property({ type: Boolean, reflect: true }) expanded = false;
  /** The id of the tree's roving-tabindex-focused item, pushed down from `<lyra-tree>`. */
  @property({ attribute: false }) activeId: string | null = null;
  @property({ type: Number, attribute: false }) setSize = 1;
  @property({ type: Number, attribute: false }) posInSet = 1;

  get hasChildren(): boolean {
    return Boolean(this.item.children?.length);
  }

  protected willUpdate(): void {
    this.setAttribute('role', 'treeitem');
    this.setAttribute('aria-level', String(this.depth + 1));
    this.setAttribute('aria-setsize', String(this.setSize));
    this.setAttribute('aria-posinset', String(this.posInSet));
    if (this.hasChildren) this.setAttribute('aria-expanded', String(this.expanded));
    else this.removeAttribute('aria-expanded');
    this.tabIndex = this.item?.id === this.activeId ? 0 : -1;
  }

  /** Expand this node (no-op if already expanded or a leaf). */
  expand(): void {
    if (!this.hasChildren || this.expanded) return;
    this.expanded = true;
    this.emit('lyra-node-toggle', { id: this.item.id, expanded: true });
  }

  /** Collapse this node (no-op if already collapsed or a leaf). */
  collapse(): void {
    if (!this.hasChildren || !this.expanded) return;
    this.expanded = false;
    this.emit('lyra-node-toggle', { id: this.item.id, expanded: false });
  }

  /** Fire this item's primary "select" action (Enter/Space, or clicking the label). */
  select(): void {
    this.emit('lyra-node-select', { id: this.item.id });
  }

  /**
   * Cascade `updateComplete`: a nested `<lyra-tree-node>` rendered by this
   * one (in its own shadow root) only receives a pushed-down `activeId` (and
   * the `tabIndex` that comes from it) once *this* node's own render has
   * committed. Without this override, awaiting a parent's `updateComplete`
   * doesn't guarantee an arbitrarily-nested descendant's own pending update
   * has also settled — see the matching override on `<lyra-tree>`.
   */
  protected async getUpdateComplete(): Promise<boolean> {
    const result = await super.getUpdateComplete();
    await Promise.all(
      [...(this.shadowRoot?.querySelectorAll('lyra-tree-node') ?? [])].map(
        (n) => (n as LyraTreeNode).updateComplete,
      ),
    );
    return result;
  }

  render(): TemplateResult {
    return html`
      <div part="row" style=${`--lyra-tree-depth:${this.depth}`}>
        <button
          part="toggle"
          type="button"
          tabindex="-1"
          aria-hidden="true"
          @click=${(e: Event) => {
            e.stopPropagation();
            this.expanded ? this.collapse() : this.expand();
          }}
        >
          ${this.hasChildren ? (this.expanded ? '▾' : '▸') : ''}
        </button>
        <span part="label" @click=${() => this.select()}>${this.item.label}</span>
        ${this.item.badge != null ? html`<span part="badge">${this.item.badge}</span>` : nothing}
      </div>
      ${this.expanded && this.hasChildren
        ? html`<div role="group">
            ${repeat(
              this.item.children!,
              (child) => child.id,
              (child, i) => html`<lyra-tree-node
                .item=${child}
                .depth=${this.depth + 1}
                .activeId=${this.activeId}
                .setSize=${this.item.children!.length}
                .posInSet=${i + 1}
              ></lyra-tree-node>`,
            )}
          </div>`
        : nothing}
    `;
  }
}

defineElement('tree-node', LyraTreeNode);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-tree-node': LyraTreeNode;
  }
}
