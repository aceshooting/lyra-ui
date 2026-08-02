import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { tag } from '../../../internal/prefix.js';
import { nextId } from '../../../internal/a11y.js';
import { chevronIcon } from '../../../internal/icons.js';
import { finiteInteger } from '../../../internal/numbers.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { cascadeUpdateComplete } from './update-cascade.js';
import { styles } from './tree-item.styles.js';
import type { TreeItem, TreeSelection } from './tree-types.js';

const MAX_RENDER_DEPTH = 64;

/** Internal slot nested `<lr-tree-item>` children are moved into, so the default slot can stay the
 *  label the way `wa-tree-item`/`sl-tree-item` markup expects. Assigned by this component. */
const CHILDREN_SLOT = 'children';

export interface LyraTreeItemEventMap {
  'lr-node-toggle': CustomEvent<{ id: string; expanded: boolean }>;
  'lr-node-select': CustomEvent<{ id: string }>;
  'lr-expand': CustomEvent<{ item: LyraTreeItem }>;
  'lr-after-expand': CustomEvent<{ item: LyraTreeItem }>;
  'lr-collapse': CustomEvent<{ item: LyraTreeItem }>;
  'lr-after-collapse': CustomEvent<{ item: LyraTreeItem }>;
  'lr-lazy-change': CustomEvent<{ item: LyraTreeItem; loading: boolean }>;
  'lr-lazy-load': CustomEvent<{ item: LyraTreeItem; generation: number }>;
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
 * assigned `item` always wins for label, disabled state, and children; its `selected`/`lazy`
 * values seed the element whenever a refreshed object identity is assigned. The owning tree then
 * manages selection on the element without mutating the caller's object.
 *
 * Both models share the owning tree's selection engine, lazy-loading lifecycle, disclosure-icon
 * slots, and expansion lifecycle. Lyra's richer `lr-node-*` notifications remain available beside
 * the normalized `lr-expand`/`lr-collapse`/`lr-lazy-*` surface. Per-row icons, secondary
 * descriptions and badges remain additive data-model features.
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
 * @slot expand-icon - The disclosure icon shown while expanded. Falls back to the owning tree's slot, then the built-in chevron.
 * @slot collapse-icon - The disclosure icon shown while collapsed. Falls back to the owning tree's slot, then the built-in chevron.
 * @event lr-node-toggle - `detail: { id, expanded }`, fired when this node is expanded or collapsed (via `expand()`/`collapse()`, the toggle button, or ArrowRight/ArrowLeft).
 * @event lr-node-select - `detail: { id }`, fired when this node's primary action is activated (via `select()`, clicking anywhere in its row, or Enter/Space).
 * @event lr-expand - Fired when expansion begins. `detail: { item }`.
 * @event lr-after-expand - Fired after the expansion motion completes. `detail: { item }`.
 * @event lr-collapse - Fired when collapse begins. `detail: { item }`.
 * @event lr-after-collapse - Fired after the collapse motion completes. `detail: { item }`.
 * @event lr-lazy-change - Fired when the pending lazy-loading state changes. `detail: { item, loading }`.
 * @event lr-lazy-load - Requests children for a lazy item. `detail: { item, generation }`; consumers can ignore stale generations.
 * @csspart base - Compatibility name for the outer wrapper; `tree-item` is the component-specific alias.
 * @csspart tree-item - The outer wrapper around the row and child group. It is the same node as
 *   `base`.
 * @csspart row - The tree row.
 * @csspart toggle - The expand/collapse button.
 * @csspart icon - The optional decorative leading icon.
 * @csspart content - The primary and secondary text wrapper.
 * @csspart label - The node label.
 * @csspart description - The optional secondary description.
 * @csspart badge - The optional node badge (the legacy `item.badge`, and/or one chip per
 *   `item.badges` entry, tone-mapped via `data-tone`).
 * @csspart group - The wrapper around a node's expanded child items.
 * @csspart item - The row container, excluding nested children.
 * @csspart item--disabled - The item container while disabled.
 * @csspart item--expanded - The item container while expanded.
 * @csspart item--indeterminate - The item container while partially selected.
 * @csspart item--selected - The item container while selected.
 * @csspart indentation - The indentation and guide container.
 * @csspart expand-button - The disclosure button and lazy spinner container.
 * @csspart spinner - The lazy-loading spinner.
 * @csspart spinner__base - The spinner's base.
 * @csspart children - The nested-children container.
 * @csspart checkbox - The checkbox shown by `multiple` and `leaf-multiple` selection.
 * @csspart checkbox__base - The checkbox base.
 * @csspart checkbox__control - The checkbox control.
 * @csspart checkbox__control--checked - The checked checkbox control.
 * @csspart checkbox__control--indeterminate - The indeterminate checkbox control.
 * @csspart checkbox__checked-icon - The checked glyph.
 * @csspart checkbox__indeterminate-icon - The indeterminate glyph.
 * @csspart checkbox__label - The checkbox label wrapper.
 * @cssstate disabled - The item is disabled.
 * @cssstate expanded - The item is expanded.
 * @cssstate indeterminate - The item is partially selected.
 * @cssstate selected - The item is selected.
 * @cssprop [--show-duration=var(--lr-duration-base)] - Expansion motion duration.
 * @cssprop [--hide-duration=var(--lr-duration-base)] - Collapse motion duration.
 * @cssprop [--lr-tree-depth=0] - Internal indent plumbing, not a retheming knob: this node's
 *   `depth`, written inline onto `[part="row"]` by the component and multiplied by
 *   `--indent-size` (capped at `--lr-size-8rem`) to produce the row's `padding-inline-start`.
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
 * @status stable
 * @since 8.0.0
 */
export class LyraTreeItem extends LyraElement<LyraTreeItemEventMap> {
  static override styles = [LyraElement.styles, styles];

  private readonly itemInternals = this.attachInternals();

  /**
   * The data model: the whole subtree as one object, assigned by `<lr-tree>` from its `data`. When
   * set it wins over the declarative model for label, disabled state, and children. Its selected
   * and lazy values seed the corresponding element state when a refreshed identity is assigned.
   */
  @property({ attribute: false })
  get item(): TreeItem {
    return this._item!;
  }
  set item(value: TreeItem) {
    const old = this._item;
    if (old === value) return;
    this._item = value;
    this.selected = Boolean(value?.selected);
    this.lazy = Boolean(value?.lazy);
    const hasResolvedChildren = Boolean(value.children?.length);
    if (this._loading && (hasResolvedChildren || !this.lazy)) {
      // A data refresh supplies its children before this item's next render. Resolve the request
      // here so `updated()` never has to schedule a second update merely to leave loading state.
      this.finishLazyLoad(this.lazyGeneration, hasResolvedChildren);
    }
    this.requestUpdate('item', old);
  }
  private _item?: TreeItem;
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
   * Whether this item is the current selection. Declarative markup can seed it with the reflected
   * attribute; data objects seed it on assignment; an owning tree then maintains it directly.
   */
  @property({ type: Boolean, reflect: true }) selected = false;
  @property({ type: Boolean, reflect: true }) expanded = false;
  /** Enables asynchronous child loading. Expanding emits `lr-lazy-load` and waits for children. */
  @property({ type: Boolean, reflect: true }) lazy = false;
  @state() private _loading = false;
  /** Whether a lazy expansion is waiting for children. */
  get loading(): boolean {
    return this._loading;
  }
  @state() private _indeterminate = false;
  /** Whether only part of this branch is selected. Managed by the owning tree. */
  get indeterminate(): boolean {
    return this._indeterminate;
  }
  /** The id of the tree's roving-tabindex-focused item, pushed down from `<lr-tree>`. */
  @property({ attribute: false }) activeId: string | null = null;
  /** Ancestor object identities used to stop cyclic caller graphs before recursive rendering. */
  @property({ attribute: false }) ancestry: TreeItem[] = [];

  private treeSelection: TreeSelection = 'single';
  private treeOwnsSelection = false;
  private expandIconSource: Element | null = null;
  private collapseIconSource: Element | null = null;
  private lifecycleGeneration = 0;
  private lazyGeneration = 0;
  private lifecycleTimer?: number;

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
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        ['expand-icon', 'collapse-icon'].includes((node as Element).getAttribute('slot') ?? '')
      ) {
        continue;
      }
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

  /** Gets this node's direct child items, optionally excluding disabled children. */
  getChildrenItems({ includeDisabled = true }: { includeDisabled?: boolean } = {}): LyraTreeItem[] {
    const children = this.childItems();
    return includeDisabled ? children : children.filter((child) => !child.isDisabled);
  }

  /**
   * Internal tree-controller seam shared by declarative and data-created items.
   * @internal
   */
  setTreeContext(options: {
    selection: TreeSelection;
    expandIcon: Element | null;
    collapseIcon: Element | null;
  }): void {
    const changed =
      this.treeSelection !== options.selection ||
      this.expandIconSource !== options.expandIcon ||
      this.collapseIconSource !== options.collapseIcon ||
      !this.treeOwnsSelection;
    this.treeSelection = options.selection;
    this.expandIconSource = options.expandIcon;
    this.collapseIconSource = options.collapseIcon;
    this.treeOwnsSelection = true;
    if (changed) this.requestUpdate();
  }

  /**
   * Internal selection-controller seam. The public state remains `selected`/`indeterminate`.
   * @internal
   */
  setSelectionState(selected: boolean, indeterminate: boolean): void {
    this.treeOwnsSelection = true;
    this.selected = selected;
    if (this._indeterminate !== indeterminate) {
      this._indeterminate = indeterminate;
      this.requestUpdate('_indeterminate');
    }
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
      if (node.nodeType === Node.ELEMENT_NODE && !this.isChildItem(node)) {
        const slot = (node as Element).getAttribute('slot');
        if (slot !== 'expand-icon' && slot !== 'collapse-icon') return true;
      }
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
      if (this._loading && this.actualChildItems().length > 0) this.finishLazyLoad(this.lazyGeneration);
    });
    this.childObserver.observe(this, { childList: true });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.childObserver?.disconnect();
    this.childObserver = undefined;
    this.lifecycleGeneration++;
    this.lazyGeneration++;
    if (this.lifecycleTimer !== undefined) window.clearTimeout(this.lifecycleTimer);
    this.lifecycleTimer = undefined;
    // Loading is transient request state. A reconnected item can be expanded again to issue a
    // fresh generation, but a response to the detached request must never expand it later.
    this._loading = false;
    if (this.lazy) this.expanded = false;
  }

  private actualChildItems(): LyraTreeItem[] {
    return this.childItems();
  }

  get hasChildren(): boolean {
    if (this.depth >= MAX_RENDER_DEPTH) return false;
    // `item` is required in the data model (`<lr-tree>` always assigns it), but a bare
    // `document.createElement('lr-tree-item')` reaches the first update with it unset — fall through
    // to the declarative model's own children instead of throwing mid-lifecycle.
    if (!this.item) return this.lazy || this.childItems().length > 0;
    return Boolean(this.lazy || (this.item.children?.length && !this.ancestry.includes(this.item)));
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
    if ((changed.has('item') || changed.has('disabled')) && this.isDisabled && this._loading) {
      this.cancelLazyLoad(true);
    }
    if (changed.has('lazy') && this._loading && !this.lazy) {
      this.finishLazyLoad(this.lazyGeneration, this.actualChildItems().length > 0);
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
    // A bare data-model item keeps the prior tri-state contract: omitted item.selected means the
    // standalone element does not express selection. An owning tree always manages selection, so
    // every treeitem then renders an explicit true/false value as stateful ARIA requires.
    const selectedIsExpressed = this.treeOwnsSelection || !this.item || this.item.selected !== undefined;
    if (selectedIsExpressed) this.setAttribute('aria-selected', String(this.selected));
    else this.removeAttribute('aria-selected');
    this.setAttribute('aria-disabled', String(this.isDisabled));
    if (this._loading) this.setAttribute('aria-busy', 'true');
    else this.removeAttribute('aria-busy');
    this.tabIndex = !this.isDisabled && this.nodeId === this.activeId ? 0 : -1;
    setCustomState(this.itemInternals, 'disabled', this.isDisabled);
    setCustomState(this.itemInternals, 'expanded', this.expanded);
    setCustomState(this.itemInternals, 'indeterminate', this._indeterminate);
    setCustomState(this.itemInternals, 'selected', this.selected);
  }

  /** Pushes roving, set-position, selection-mode, and inherited-icon context onto direct children
   * in either model. */
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const children = this.childItems();
    children.forEach((child, index) => {
      child.depth = this.depth + 1;
      child.activeId = this.activeId;
      child.setSize = children.length;
      child.posInSet = index + 1;
      child.setTreeContext({
        selection: this.treeSelection,
        expandIcon: this.expandIconSource,
        collapseIcon: this.collapseIconSource,
      });
    });
  }

  /** Expand this node (no-op if already expanded, disabled, loading, or a leaf). */
  expand(): void {
    if (this.isDisabled || this._loading || this.expanded) return;
    if (this.lazy) {
      this.beginLazyLoad();
      return;
    }
    if (!this.hasChildren) return;
    this.commitExpanded(true);
  }

  private commitExpanded(expanded: boolean): void {
    if (this.expanded === expanded) return;
    this.lifecycleGeneration++;
    if (this.lifecycleTimer !== undefined) window.clearTimeout(this.lifecycleTimer);
    this.lifecycleTimer = undefined;
    this.expanded = expanded;
    this.emit(expanded ? 'lr-expand' : 'lr-collapse', { item: this });
    this.emit('lr-node-toggle', { id: this.nodeId, expanded });
    this.scheduleAfterEvent(expanded, this.lifecycleGeneration);
  }

  private beginLazyLoad(): void {
    if (this._loading || this.isDisabled) return;
    this._loading = true;
    const generation = ++this.lazyGeneration;
    this.emit('lr-lazy-change', { item: this, loading: true });
    this.emit('lr-lazy-load', { item: this, generation });
  }

  private finishLazyLoad(
    generation: number,
    hasResolvedChildren = this.actualChildItems().length > 0,
  ): void {
    if (!this._loading || generation !== this.lazyGeneration) return;
    this._loading = false;
    this.emit('lr-lazy-change', { item: this, loading: false });
    if (!this.isConnected || this.isDisabled || !hasResolvedChildren) return;
    this.commitExpanded(true);
  }

  private cancelLazyLoad(emitChange: boolean): void {
    if (!this._loading) return;
    this.lazyGeneration++;
    this._loading = false;
    if (emitChange) this.emit('lr-lazy-change', { item: this, loading: false });
  }

  private scheduleAfterEvent(expanded: boolean, generation: number): void {
    void this.updateComplete.then(() => {
      if (generation !== this.lifecycleGeneration || !this.isConnected || this.expanded !== expanded) return;
      const duration = this.motionDuration(expanded);
      this.lifecycleTimer = window.setTimeout(() => {
        this.lifecycleTimer = undefined;
        if (generation !== this.lifecycleGeneration || !this.isConnected || this.expanded !== expanded) return;
        this.emit(expanded ? 'lr-after-expand' : 'lr-after-collapse', { item: this });
      }, duration);
    });
  }

  private motionDuration(expanded: boolean): number {
    if (prefersReducedMotion()) return 0;
    const property = expanded ? '--show-duration' : '--hide-duration';
    const ownStyle = getComputedStyle(this);
    const raw =
      ownStyle.getPropertyValue(property).trim() ||
      ownStyle.getPropertyValue('--lr-duration-base').trim();
    const match = /^([0-9]*\.?[0-9]+)(ms|s)$/.exec(raw);
    if (!match) return 0;
    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount < 0) return 0;
    return match[2] === 's' ? amount * 1000 : amount;
  }

  /** Collapse this node (no-op if already collapsed or a leaf). */
  collapse(): void {
    if (this.isDisabled || !this.hasChildren || !this.expanded) return;
    this.commitExpanded(false);
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

  private get multipleSelection(): boolean {
    return this.treeSelection === 'multiple' || this.treeSelection === 'leaf-multiple';
  }

  private itemPartNames(): string {
    return [
      'item',
      this.isDisabled ? 'item--disabled' : '',
      this.expanded ? 'item--expanded' : '',
      this._indeterminate ? 'item--indeterminate' : '',
      this.selected ? 'item--selected' : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  private inheritedIcon(source: Element | null): Node | typeof nothing {
    if (!source) return nothing;
    const clone = source.cloneNode(true) as Element;
    clone.removeAttribute('slot');
    clone.removeAttribute('id');
    clone.setAttribute('aria-hidden', 'true');
    return clone;
  }

  private renderDisclosureIcon(): TemplateResult {
    const slotName = this.expanded ? 'expand-icon' : 'collapse-icon';
    const inherited = this.inheritedIcon(
      this.expanded ? this.expandIconSource : this.collapseIconSource,
    );
    return html`<slot name=${slotName}>${inherited === nothing ? chevronIcon() : inherited}</slot>`;
  }

  private renderSpinner(): TemplateResult {
    return html`<span part="spinner" aria-hidden="true"><span part="spinner__base"></span></span>`;
  }

  private renderCheckbox(): TemplateResult | typeof nothing {
    if (!this.multipleSelection) return nothing;
    const checked = this._indeterminate ? 'mixed' : String(this.selected);
    const controlParts = [
      'checkbox__control',
      this.selected ? 'checkbox__control--checked' : '',
      this._indeterminate ? 'checkbox__control--indeterminate' : '',
    ]
      .filter(Boolean)
      .join(' ');
    return html`
      <span
        part="checkbox"
        role="checkbox"
        aria-label=${this.nodeLabel}
        aria-checked=${checked}
        aria-disabled=${String(this.isDisabled)}
        @click=${(event: Event) => {
          event.stopPropagation();
          this.select();
        }}
      >
        <span part="checkbox__base">
          <span part=${controlParts}>
            <span part="checkbox__checked-icon" aria-hidden="true">✓</span>
            <span part="checkbox__indeterminate-icon" aria-hidden="true">−</span>
          </span>
        </span>
      </span>
    `;
  }

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
        <span part="indentation" aria-hidden="true"></span>
        <span part="expand-button">
          <button
            part="toggle"
            type="button"
            tabindex="-1"
            aria-hidden="true"
            ?disabled=${this.isDisabled || this._loading}
            ?hidden=${!this.hasChildren}
            @mousedown=${this.onToggleMouseDown}
            @click=${(e: Event) => {
              e.stopPropagation();
              this.expanded ? this.collapse() : this.expand();
            }}
          >
            ${this._loading ? this.renderSpinner() : this.hasChildren ? this.renderDisclosureIcon() : nothing}
          </button>
        </span>
        ${this.renderCheckbox()}
        ${content.icon}
        <span part="content">
          <span part="checkbox__label">
            <span part="label">${content.label}</span>
            ${content.description}
          </span>
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
      return html`<div part="base tree-item">
        <div part=${this.itemPartNames()}>
          ${this.renderRow({
            icon: nothing,
            label: this.hasSlottedLabel ? html`<slot></slot>` : this.label,
            description: nothing,
            badges: nothing,
          })}
        </div>
        ${this.expanded && this.hasChildren
          ? html`<div part="group" role="group"><div part="children"><slot name=${CHILDREN_SLOT}></slot></div></div>`
          : nothing}
      </div>`;
    }
    return html`<div part="base tree-item">
      <div part=${this.itemPartNames()}>
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
      </div>
      ${!this.isDisabled &&
      this.depth < MAX_RENDER_DEPTH &&
      item.children?.length &&
      !this.ancestry.includes(item)
        ? html`<div part="group" role="group" ?hidden=${!this.expanded}>
            <div part="children">
              ${repeat(
                item.children,
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
            </div>
          </div>`
        : nothing}
    </div>`;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-tree-item': LyraTreeItem;
  }
}
