import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { tag } from '../../../internal/prefix.js';
import { nextId } from '../../../internal/a11y.js';
import { chevronIcon } from '../../../internal/icons.js';
import { finiteInteger } from '../../../internal/numbers.js';
import { cascadeUpdateComplete } from './update-cascade.js';
import { styles } from './tree-item.styles.js';
import type { TreeItem } from './tree-types.js';

const MAX_RENDER_DEPTH = 64;

/** Internal slot nested `<lr-tree-item>` children are moved into, so the default slot can stay the
 *  label the way `wa-tree-item`/`sl-tree-item` markup expects. Assigned by this component. */
const CHILDREN_SLOT = 'children';

export interface LyraTreeItemEventMap {
  'lr-node-toggle': CustomEvent<{ id: string; expanded: boolean }>;
  'lr-node-select': CustomEvent<{ id: string }>;
}
/**
 * `<lr-tree-item>` — one row of `<lr-tree>`, in either of two child models.
 *
 * **Declarative model** (mirrors `wa-tree-item`/`sl-tree-item`, so that markup renames
 * mechanically): the row's label is the default slot's content — or the `label` attribute when the
 * slot is empty — and the hierarchy is nested `<lr-tree-item>` elements written as light-DOM
 * children. Those nested children are moved to the internal `children` slot by this component, so
 * an author never writes `slot=` themselves, exactly as `<lr-tab-group>` assigns the slots for its
 * own `<lr-tab>`/`<lr-tab-panel>` element model. `expanded`, `disabled` and `selected` are plain
 * attributes on each element.
 *
 * **Data model**: `<lr-tree>` assigns an `item` (a `TreeItem` object) and this element renders that
 * object's whole subtree — icon, description, badges and children — into its own shadow root. An
 * assigned `item` always wins: light-DOM children and `label`/`disabled`/`selected` are then
 * ignored, because the object already carries all of it.
 *
 * Deliberately **not** mirrored from the upstream tree components, none of which have a lyra
 * equivalent to rename to: lazy loading (`lazy`, `sl-lazy-load`, `sl-lazy-change`), checkbox
 * multi-select (`sl-tree`'s `selection="multiple"` and the `checkbox` part), the
 * `expand-icon`/`collapse-icon` slots, and the `sl-expand`/`sl-collapse`/`sl-after-*` event
 * quartet — `lr-node-toggle` carries the same information in one event with an `expanded` flag.
 * Per-row icons, secondary descriptions and badges exist only in the data model.
 *
 * `role="treeitem"` (plus `aria-expanded`/`aria-level`/`aria-setsize`/
 * `aria-posinset` and the roving `tabindex`, driven by `<lr-tree>`) live on
 * the *host* element, not the internal `[part="row"]` div — that makes this
 * node's own nested children (rendered in *its own* shadow root, or projected from the light DOM,
 * as further `role="group"` content) genuine DOM descendants of the treeitem, which is
 * what the WAI-ARIA treeitem pattern requires (previously a shadow-root
 * sibling).
 *
 * @customElement lr-tree-item
 * @slot - The row's label content, in the declarative model. Nested `<lr-tree-item>` children written here are moved to the `children` slot automatically; the `label` attribute is used when no label content is slotted.
 * @slot children - Where nested `<lr-tree-item>` children are projected. Assigned by this component — authors write the children in the default slot.
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
 * @cssprop [--lr-tree-selected-bg=var(--lr-color-brand-quiet)] - Background of the selected row.
 * @cssprop [--lr-tree-selected-color=var(--lr-color-brand)] - Text color of the selected row.
 * @cssprop [--lr-tree-badge-neutral-color=var(--lr-color-text-quiet)] - Neutral badge text color.
 * @cssprop [--lr-tree-badge-neutral-bg=var(--lr-color-surface)] - Neutral badge background.
 * @cssprop [--lr-tree-badge-brand-color=var(--lr-color-brand)] - Brand badge text color.
 * @cssprop [--lr-tree-badge-brand-bg=var(--lr-color-brand-quiet)] - Brand badge background.
 * @cssprop [--lr-tree-badge-success-color=var(--lr-color-success)] - Success badge text color.
 * @cssprop [--lr-tree-badge-success-bg=var(--lr-color-success-quiet)] - Success badge background.
 * @cssprop [--lr-tree-badge-warning-color=var(--lr-color-warning)] - Warning badge text color.
 * @cssprop [--lr-tree-badge-warning-bg=var(--lr-color-warning-quiet)] - Warning badge background.
 * @cssprop [--lr-tree-badge-danger-color=var(--lr-color-danger)] - Danger badge text color.
 * @cssprop [--lr-tree-badge-danger-bg=var(--lr-color-danger-quiet)] - Danger badge background.
 */
export class LyraTreeItem extends LyraElement<LyraTreeItemEventMap> {
  static override styles = [LyraElement.styles, styles];

  /**
   * The data model: the whole subtree as one object, assigned by `<lr-tree>` from its `data`. When
   * set it wins over the declarative model — `label`/`disabled`/`selected` and any light-DOM
   * children are ignored, since the object already describes all of them.
   */
  @property({ attribute: false }) item!: TreeItem;
  /**
   * The row's label in the declarative model, used when no label content is slotted. Ignored when
   * an `item` object is assigned (`item.label` is the label then).
   */
  @property() label = '';
  /**
   * Removes this item from roving focus and prevents select/toggle activation, in the declarative
   * model. Ignored when an `item` is assigned (`item.disabled` decides then).
   */
  @property({ type: Boolean, reflect: true }) disabled = false;
  /**
   * Whether this item is the current selection, in the declarative model — it renders the selected
   * state and is exposed as `aria-selected`. Ignored when an `item` is assigned (`item.selected`
   * decides then, and is left off `aria-selected` entirely when undefined).
   */
  @property({ type: Boolean, reflect: true }) selected = false;
  @property({ type: Boolean, reflect: true }) expanded = false;
  /** The id of the tree's roving-tabindex-focused item, pushed down from `<lr-tree>`. */
  @property({ attribute: false }) activeId: string | null = null;
  /** Ancestor object identities used to stop cyclic caller graphs before recursive rendering. */
  @property({ attribute: false }) ancestry: TreeItem[] = [];

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

  private generatedId?: string;

  /**
   * This item's identity, in whichever child model is in use: `item.id` in the data model, or a
   * generated, per-element id in the declarative one (where the markup carries no id of its own).
   * `<lr-tree>` tracks its roving tabindex by this value, and it is the `id` every `lr-node-toggle`
   * / `lr-node-select` / `lr-reorder` detail carries.
   */
  get nodeId(): string {
    if (this.item) return this.item.id;
    return (this.generatedId ??= nextId('tree-item'));
  }

  /** Whether this item is disabled, in whichever child model is in use. */
  get isDisabled(): boolean {
    return this.item ? Boolean(this.item.disabled) : this.disabled;
  }

  /**
   * This item's spoken name, in whichever child model is in use — used for `<lr-tree>`'s reorder
   * announcements. Falls back through `item.accessibleLabel`/`item.label`, then a host
   * `aria-label`, the `label` attribute, and finally the slotted label text (nested items excluded).
   */
  get nodeLabel(): string {
    if (this.item) return this.item.accessibleLabel || this.item.label;
    const ariaLabel = this.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;
    if (this.label) return this.label;
    let text = '';
    for (const node of this.childNodes) {
      if (this.isChildItem(node)) continue;
      text += node.textContent ?? '';
    }
    return text.trim();
  }

  /**
   * This node's child `<lr-tree-item>` elements, in whichever child model is in use: rendered into
   * this node's own shadow root from `item.children` (data model), or authored as its own light-DOM
   * children (declarative model). Only ever direct children — a grandchild lives inside its own
   * parent's shadow root, or under its own parent element.
   */
  childItems(): LyraTreeItem[] {
    if (this.item) {
      return [...(this.shadowRoot?.querySelectorAll(tag('tree-item')) ?? [])] as LyraTreeItem[];
    }
    return [...this.children].filter((child) => this.isChildItem(child)) as LyraTreeItem[];
  }

  private isChildItem(node: Node): boolean {
    return node.nodeType === Node.ELEMENT_NODE && (node as Element).localName === tag('tree-item');
  }

  /** Whether the default slot has real label content — any element that is not a nested item, or a
   *  non-whitespace text node. Read straight off the light DOM rather than from `slotchange` so the
   *  very first render already knows, instead of flashing the `label` fallback under slotted text.
   *  Indentation whitespace around nested items does not count, which is why the fallback still
   *  renders for the (extremely common) `<lr-tree-item label="…">` + nested-children shape. */
  private get hasSlottedLabel(): boolean {
    for (const node of this.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        if ((node.nodeValue ?? '').trim() !== '') return true;
        continue;
      }
      if (node.nodeType === Node.ELEMENT_NODE && !this.isChildItem(node)) return true;
    }
    return false;
  }

  /** Moves nested `<lr-tree-item>` children onto the `children` slot so the default slot can stay
   *  the label, the way the upstream markup this mirrors expects. Writing `slot` here rather than
   *  asking consumers to is what keeps that markup a pure tag rename (same approach as
   *  `<lr-tab-group>`'s element model), and it is idempotent, so the mutation observer that sees the
   *  write does not re-enter. */
  private assignChildSlots(): void {
    for (const child of this.children) {
      if (!this.isChildItem(child)) continue;
      if (child.getAttribute('slot') !== CHILDREN_SLOT) child.setAttribute('slot', CHILDREN_SLOT);
    }
  }

  /** `slotchange` alone cannot see a child appended with a `slot` attribute already set while this
   *  node is collapsed (the `children` slot is not rendered then), nor a label edited in place — a
   *  childList observer sees both, and is the same mechanism `<lr-tab-group>` uses for its own
   *  light-DOM child model. */
  private childObserver?: MutationObserver;

  override connectedCallback(): void {
    super.connectedCallback();
    this.assignChildSlots();
    this.childObserver = new MutationObserver(() => {
      this.assignChildSlots();
      this.requestUpdate();
    });
    this.childObserver.observe(this, { childList: true });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.childObserver?.disconnect();
    this.childObserver = undefined;
  }

  get hasChildren(): boolean {
    if (this.depth >= MAX_RENDER_DEPTH) return false;
    // `item` is required in the data model (`<lr-tree>` always assigns it), but a bare
    // `document.createElement('lr-tree-item')` reaches the first update with it unset — fall through
    // to the declarative model's own children instead of throwing mid-lifecycle.
    if (!this.item) return this.childItems().length > 0;
    return Boolean(this.item.children?.length && !this.ancestry.includes(this.item));
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    // Runs before render so a nested child is never briefly painted inside [part="label"].
    this.assignChildSlots();
    // A same-id data refresh deliberately reuses this element and its disclosure state. Once the
    // refreshed item becomes disabled, though, the owning tree removes this entire subtree from
    // keyboard navigation. Collapse immediately so enabled descendants cannot remain visibly
    // stranded outside that navigation walk. Same for a declarative item disabled in place.
    if ((changed.has('item') || changed.has('disabled')) && this.isDisabled && this.expanded) {
      this.expanded = false;
    }
    this.setAttribute('role', 'treeitem');
    this.setAttribute('aria-level', String(this.depth + 1));
    this.setAttribute('aria-setsize', String(this.setSize));
    this.setAttribute('aria-posinset', String(this.posInSet));
    if (this.hasChildren) this.setAttribute('aria-expanded', String(this.expanded));
    else this.removeAttribute('aria-expanded');
    // Only the data model owns `aria-label` (from `item.accessibleLabel`). In the declarative model
    // the attribute is the author's own, so it is never written *or* removed here.
    if (this.item) {
      if (this.item.accessibleLabel) this.setAttribute('aria-label', this.item.accessibleLabel);
      else this.removeAttribute('aria-label');
    }
    // `item.selected` is tri-state: undefined means "this tree does not express selection", so the
    // attribute stays off entirely. The declarative `selected` property is a plain boolean, so it
    // renders both states, as a stateful ARIA property must.
    const selected = this.item ? this.item.selected : this.selected;
    if (selected !== undefined) this.setAttribute('aria-selected', String(selected));
    else this.removeAttribute('aria-selected');
    this.setAttribute('aria-disabled', String(this.isDisabled));
    this.tabIndex = !this.isDisabled && this.nodeId === this.activeId ? 0 : -1;
  }

  /** Pushes the tree-wide roving `activeId` and this node's own depth/set-position down onto
   *  light-DOM children, which render themselves rather than being rendered from `item.children`.
   *  A no-op in the data model, where `render()` binds all four onto each child directly. */
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.item) return;
    const children = this.childItems();
    children.forEach((child, index) => {
      child.depth = this.depth + 1;
      child.activeId = this.activeId;
      child.setSize = children.length;
      child.posInSet = index + 1;
    });
  }

  /** Expand this node (no-op if already expanded or a leaf). */
  expand(): void {
    if (this.isDisabled || !this.hasChildren || this.expanded) return;
    this.expanded = true;
    this.emit('lr-node-toggle', { id: this.nodeId, expanded: true });
  }

  /** Collapse this node (no-op if already collapsed or a leaf). */
  collapse(): void {
    if (this.isDisabled || !this.hasChildren || !this.expanded) return;
    this.expanded = false;
    this.emit('lr-node-toggle', { id: this.nodeId, expanded: false });
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
    if (this.isDisabled) return;
    this.emit('lr-node-select', { id: this.nodeId });
    this.focus();
  }

  /** See `cascadeUpdateComplete` and the matching override on `<lr-tree>`. */
  protected override async getUpdateComplete(): Promise<boolean> {
    const result = await super.getUpdateComplete();
    await cascadeUpdateComplete(this.childItems());
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
    if (this.isDisabled) return;
    this.focus();
  };

  /** The row itself, shared by both child models — same disclosure toggle, hit area, indent
   *  plumbing and click-to-select behavior either way. `icon`/`description`/`badges` only ever
   *  come from the data model; the declarative one passes `nothing` for all three. */
  private renderRow(content: {
    icon: unknown;
    label: unknown;
    description: unknown;
    badges: unknown;
  }): TemplateResult {
    return html`
      <div part="row" style=${`--lr-tree-depth:${this.depth}`} @click=${() => this.select()}>
        <button
          part="toggle"
          type="button"
          tabindex="-1"
          aria-hidden="true"
          ?disabled=${this.isDisabled}
          ?hidden=${!this.hasChildren}
          @mousedown=${this.onToggleMouseDown}
          @click=${(e: Event) => {
            e.stopPropagation();
            this.expanded ? this.collapse() : this.expand();
          }}
        >
          ${this.hasChildren ? chevronIcon() : nothing}
        </button>
        ${content.icon}
        <span part="content">
          <span part="label">${content.label}</span>
          ${content.description}
        </span>
        ${content.badges}
      </div>
    `;
  }

  override render(): TemplateResult {
    const item = this.item;
    // No item: the declarative model. The default slot carries the label (the `label` attribute is
    // the fallback when nothing is slotted), and nested `<lr-tree-item>` children — moved onto the
    // `children` slot by `assignChildSlots()` — render themselves inside this node's own
    // `role="group"`, which is what makes a mechanically renamed `wa-tree-item`/`sl-tree-item`
    // subtree render at all.
    if (!item) {
      return html`
        ${this.renderRow({
          icon: nothing,
          label: this.hasSlottedLabel ? html`<slot></slot>` : this.label,
          description: nothing,
          badges: nothing,
        })}
        ${this.expanded && this.hasChildren
          ? html`<div part="group" role="group"><slot name=${CHILDREN_SLOT}></slot></div>`
          : nothing}
      `;
    }
    return html`
      ${this.renderRow({
        icon: item.icon != null ? html`<span part="icon" aria-hidden="true">${item.icon}</span>` : nothing,
        label: item.label,
        description: item.description
          ? html`<span part="description">${item.description}</span>`
          : nothing,
        badges: html`${item.badge != null ? html`<span part="badge">${item.badge}</span>` : nothing}
        ${(item.badges ?? []).map(
          (b) => html`<span part="badge" data-tone=${b.tone ?? 'neutral'} aria-label=${b.label ?? b.text}
            >${b.text}</span
          >`,
        )}`,
      })}
      ${this.expanded && this.hasChildren
        ? html`<div part="group" role="group">
            ${repeat(
              item.children!,
              (child) => child.id,
              (child, i) => html`<lr-tree-item
                .item=${child}
                .depth=${this.depth + 1}
                .ancestry=${[...this.ancestry, item]}
                .activeId=${this.activeId}
                .setSize=${item.children!.length}
                .posInSet=${i + 1}
              ></lr-tree-item>`,
            )}
          </div>`
        : nothing}
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-tree-item': LyraTreeItem;
  }
}
