import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { tag } from '../../../internal/prefix.js';
import { chevronIcon } from '../../../internal/icons.js';
import { finiteInteger } from '../../../internal/numbers.js';
import { cascadeUpdateComplete } from './update-cascade.js';
import { styles } from './tree-node.styles.js';
import type { TreeItem } from './tree.class.js';

export interface LyraTreeNodeEventMap {
  'lr-node-toggle': CustomEvent<{ id: string; expanded: boolean }>;
  'lr-node-select': CustomEvent<{ id: string }>;
}
/**
 * `<lr-tree-node>` — internal recursive renderer for `<lr-tree>`.
 *
 * `role="treeitem"` (plus `aria-expanded`/`aria-level`/`aria-setsize`/
 * `aria-posinset` and the roving `tabindex`, driven by `<lr-tree>`) live on
 * the *host* element, not the internal `[part="row"]` div — that makes this
 * node's own nested children (rendered in *its own* shadow root as further
 * `role="group"` content) genuine DOM descendants of the treeitem, which is
 * what the WAI-ARIA treeitem pattern requires (previously a shadow-root
 * sibling).
 *
 * @customElement lr-tree-node
 * @event lr-node-toggle - `detail: { id, expanded }`, fired when this node is expanded or collapsed (via `expand()`/`collapse()`, the toggle button, or ArrowRight/ArrowLeft).
 * @event lr-node-select - `detail: { id }`, fired when this node's primary action is activated (via `select()`, clicking anywhere in its row, or Enter/Space).
 * @csspart row - The tree row.
 * @csspart toggle - The expand/collapse button.
 * @csspart icon - The optional decorative leading icon.
 * @csspart content - The primary and secondary text wrapper.
 * @csspart label - The node label.
 * @csspart description - The optional secondary description.
 * @csspart badge - The optional node badge (the legacy `item.badge`, and/or one chip per
 *   `item.badges` entry, tone-mapped via `data-tone`).
 * @csspart group - The wrapper around a node's expanded child items.
 * @cssprop [--lr-tree-depth=0] - Internal indent plumbing, not a retheming knob: this node's
 *   `depth`, written inline onto `[part="row"]` by the component and multiplied by
 *   `--lr-space-l` (capped at `--lr-size-8rem`) to produce the row's `padding-inline-start`.
 */
export class LyraTreeNode extends LyraElement<LyraTreeNodeEventMap> {
  static override styles = [LyraElement.styles, styles];

  @property({ attribute: false }) item!: TreeItem;
  @property({ type: Boolean, reflect: true }) expanded = false;
  /** The id of the tree's roving-tabindex-focused item, pushed down from `<lr-tree>`. */
  @property({ attribute: false }) activeId: string | null = null;

  private _depth = 0;
  /** Nesting depth, 0 = top-level. Feeds `aria-level` (`depth + 1`) in `willUpdate()` below and the
   *  `--lr-tree-depth` custom property, and is passed down `+ 1` to each rendered child --
   *  per the ARIA spec `aria-level` must be a positive integer, so a NaN/negative `depth` would
   *  produce invalid ARIA output (and, recursively, poison every descendant's own depth too).
   *  Clamped to a finite integer `>= 0` (never negative -- `0` is the legitimate top-level value,
   *  matching `aria-level="1"`). */
  @property({ type: Number })
  get depth(): number {
    return this._depth;
  }
  set depth(value: number) {
    const old = this._depth;
    this._depth = finiteInteger(value, 0, 0);
    this.requestUpdate('depth', old);
  }

  private _setSize = 1;
  /** Feeds `aria-setsize` directly. Per the ARIA spec this must be a positive integer, with `-1`
   *  as the sole legitimate sentinel meaning "set size unknown" (e.g. a virtualized/lazily-loaded
   *  tree) -- that sentinel is passed through unchanged; every other value is clamped to a finite
   *  integer `>= 1` (current usage in `<lr-tree>` never assigns `-1`, but the accessor still
   *  honors it since it's valid ARIA and a future virtualized consumer may need it). */
  @property({ type: Number, attribute: false })
  get setSize(): number {
    return this._setSize;
  }
  set setSize(value: number) {
    const old = this._setSize;
    this._setSize = value === -1 ? -1 : finiteInteger(value, 1, 1);
    this.requestUpdate('setSize', old);
  }

  private _posInSet = 1;
  /** Feeds `aria-posinset` directly. Per the ARIA spec this must be a positive integer -- unlike
   *  `aria-setsize`, there is no "unknown position" sentinel, so this is always clamped to a
   *  finite integer `>= 1`. */
  @property({ type: Number, attribute: false })
  get posInSet(): number {
    return this._posInSet;
  }
  set posInSet(value: number) {
    const old = this._posInSet;
    this._posInSet = finiteInteger(value, 1, 1);
    this.requestUpdate('posInSet', old);
  }

  get hasChildren(): boolean {
    // `item` is required in normal use (`<lr-tree>` always assigns it), but a
    // bare `document.createElement('lr-tree-node')` reaches the first update
    // with it unset — degrade to a leaf instead of throwing mid-lifecycle.
    return Boolean(this.item?.children?.length);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.setAttribute('role', 'treeitem');
    this.setAttribute('aria-level', String(this.depth + 1));
    this.setAttribute('aria-setsize', String(this.setSize));
    this.setAttribute('aria-posinset', String(this.posInSet));
    if (this.hasChildren) this.setAttribute('aria-expanded', String(this.expanded));
    else this.removeAttribute('aria-expanded');
    if (this.item?.accessibleLabel) this.setAttribute('aria-label', this.item.accessibleLabel);
    else this.removeAttribute('aria-label');
    this.tabIndex = this.item?.id === this.activeId ? 0 : -1;
  }

  /** Expand this node (no-op if already expanded or a leaf). */
  expand(): void {
    if (!this.hasChildren || this.expanded) return;
    this.expanded = true;
    this.emit('lr-node-toggle', { id: this.item.id, expanded: true });
  }

  /** Collapse this node (no-op if already collapsed or a leaf). */
  collapse(): void {
    if (!this.hasChildren || !this.expanded) return;
    this.expanded = false;
    this.emit('lr-node-toggle', { id: this.item.id, expanded: false });
  }

  /**
   * Fire this item's primary "select" action (Enter/Space, or clicking
   * anywhere in the row). Emits *before* calling `.focus()`: `<lr-tree>`'s
   * `onNodeActivate` listener for `lr-node-select` runs synchronously
   * (native `dispatchEvent` is sync) and updates `activeId`, which pushes
   * `tabIndex = 0` down onto this node via its own render -- calling
   * `.focus()` after that emit, rather than before, means real DOM focus
   * lands correctly the very first time a previously-inactive node is
   * clicked, not one render late.
   */
  select(): void {
    this.emit('lr-node-select', { id: this.item.id });
    this.focus();
  }

  /** See `cascadeUpdateComplete` and the matching override on `<lr-tree>`. */
  protected override async getUpdateComplete(): Promise<boolean> {
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

  override render(): TemplateResult {
    // No item yet (see `hasChildren`): render nothing rather than dereferencing
    // `this.item` — the row appears as soon as the owner assigns the property.
    if (!this.item) return html``;
    return html`
      <div part="row" style=${`--lr-tree-depth:${this.depth}`} @click=${() => this.select()}>
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
              (child, i) => html`<lr-tree-node
                .item=${child}
                .depth=${this.depth + 1}
                .activeId=${this.activeId}
                .setSize=${this.item.children!.length}
                .posInSet=${i + 1}
              ></lr-tree-node>`,
            )}
          </div>`
        : nothing}
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-tree-node': LyraTreeNode;
  }
}
