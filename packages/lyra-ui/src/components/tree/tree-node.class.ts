import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { tag } from '../../internal/prefix.js';
import { chevronIcon } from '../../internal/icons.js';
import { cascadeUpdateComplete } from './update-cascade.js';
import { styles } from './tree-node.styles.js';
import type { TreeItem } from './tree.class.js';

export interface LyraTreeNodeEventMap {
  'lyra-node-toggle': CustomEvent<{ id: string; expanded: boolean }>;
  'lyra-node-select': CustomEvent<{ id: string }>;
}
/**
 * `<lyra-tree-node>` — internal recursive renderer for `<lyra-tree>`.
 *
 * `role="treeitem"` (plus `aria-expanded`/`aria-level`/`aria-setsize`/
 * `aria-posinset` and the roving `tabindex`, driven by `<lyra-tree>`) live on
 * the *host* element, not the internal `[part="row"]` div — that makes this
 * node's own nested children (rendered in *its own* shadow root as further
 * `role="group"` content) genuine DOM descendants of the treeitem, which is
 * what the WAI-ARIA treeitem pattern requires (previously a shadow-root
 * sibling).
 *
 * @customElement lyra-tree-node
 * @event lyra-node-toggle - `detail: { id, expanded }`, fired when this node is expanded or collapsed (via `expand()`/`collapse()`, the toggle button, or ArrowRight/ArrowLeft).
 * @event lyra-node-select - `detail: { id }`, fired when this node's primary action is activated (via `select()`, clicking anywhere in its row, or Enter/Space).
 * @csspart row - The tree row.
 * @csspart toggle - The expand/collapse button.
 * @csspart icon - The optional decorative leading icon.
 * @csspart content - The primary and secondary text wrapper.
 * @csspart label - The node label.
 * @csspart description - The optional secondary description.
 * @csspart badge - The optional node badge (the legacy `item.badge`, and/or one chip per
 *   `item.badges` entry, tone-mapped via `data-tone`).
 * @csspart group - The wrapper around a node's expanded child items.
 */
export class LyraTreeNode extends LyraElement<LyraTreeNodeEventMap> {
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
    if (this.item.accessibleLabel) this.setAttribute('aria-label', this.item.accessibleLabel);
    else this.removeAttribute('aria-label');
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

  /**
   * Fire this item's primary "select" action (Enter/Space, or clicking
   * anywhere in the row). Emits *before* calling `.focus()`: `<lyra-tree>`'s
   * `onNodeActivate` listener for `lyra-node-select` runs synchronously
   * (native `dispatchEvent` is sync) and updates `activeId`, which pushes
   * `tabIndex = 0` down onto this node via its own render -- calling
   * `.focus()` after that emit, rather than before, means real DOM focus
   * lands correctly the very first time a previously-inactive node is
   * clicked, not one render late.
   */
  select(): void {
    this.emit('lyra-node-select', { id: this.item.id });
    this.focus();
  }

  /** See `cascadeUpdateComplete` and the matching override on `<lyra-tree>`. */
  protected async getUpdateComplete(): Promise<boolean> {
    const result = await super.getUpdateComplete();
    await cascadeUpdateComplete(
      [...(this.shadowRoot?.querySelectorAll(tag('tree-node')) ?? [])] as LyraTreeNode[],
    );
    return result;
  }

  /**
   * A `<button>` is a real focusable click target even with
   * `tabindex="-1" aria-hidden="true"` -- only *sequential* (Tab-key)
   * navigation honors `tabindex="-1"`, a mouse click does not. Left
   * unguarded, clicking this toggle parks real DOM focus on this hidden,
   * non-treeitem button instead of the host, which is both an a11y dead end
   * and invisible to `:host(:focus-visible)`'s ring. `preventDefault()` on
   * `mousedown` blocks that default focus move; focusing the host instead
   * keeps focus on the actual `role="treeitem"` element the row represents.
   */
  private onToggleMouseDown = (e: MouseEvent): void => {
    e.preventDefault();
    this.focus();
  };

  render(): TemplateResult {
    return html`
      <div part="row" style=${`--lyra-tree-depth:${this.depth}`} @click=${() => this.select()}>
        <button
          part="toggle"
          type="button"
          tabindex="-1"
          aria-hidden="true"
          ?hidden=${!this.hasChildren}
          @mousedown=${this.onToggleMouseDown}
          @click=${(e: Event) => {
            e.stopPropagation();
            this.expanded ? this.collapse() : this.expand();
          }}
        >
          ${this.hasChildren ? chevronIcon() : nothing}
        </button>
        ${this.item.icon != null
          ? html`<span part="icon" aria-hidden="true">${this.item.icon}</span>`
          : nothing}
        <span part="content">
          <span part="label">${this.item.label}</span>
          ${this.item.description
            ? html`<span part="description">${this.item.description}</span>`
            : nothing}
        </span>
        ${this.item.badge != null ? html`<span part="badge">${this.item.badge}</span>` : nothing}
        ${(this.item.badges ?? []).map(
          (b) => html`<span part="badge" data-tone=${b.tone ?? 'neutral'} aria-label=${b.label ?? b.text}
            >${b.text}</span
          >`,
        )}
      </div>
      ${this.expanded && this.hasChildren
        ? html`<div part="group" role="group">
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


declare global {
  interface HTMLElementTagNameMap {
    'lyra-tree-node': LyraTreeNode;
  }
}
