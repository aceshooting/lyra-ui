import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { tag } from '../../../internal/prefix.js';
import {
  composedParentElement,
  hasRealContent,
  isAccessibilitySubtreeExcluded,
  isAccessibilityVisible,
  isAccessibilityVisibilityHidden,
  nextId,
} from '../../../internal/a11y.js';
import { chevronIcon } from '../../../internal/icons.js';
import { finiteInteger } from '../../../internal/numbers.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { attachInternalsSafely } from '../../../internal/form-associated.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { cascadeUpdateComplete } from './update-cascade.js';
import { styles } from './tree-item.styles.js';
import { TREE_MAX_RENDER_DEPTH, type TreeIdentityContext, type TreeItem, type TreeSelection } from './tree-types.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_item, LYRA_DEFAULT_open, LYRA_DEFAULT_restore } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

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
 * In the declarative model, flattened real-content presence chooses between the visual slot and
 * `label` fallback, so decorative or element-only visuals remain rendered. Spoken `nodeLabel`
 * text is resolved separately from accessibility-visible assigned content and updates through
 * forwarding slots; a host `aria-label` keeps precedence by presence in both models. A data
 * item's `accessibleLabel` is reflected only while the component owns that attribute, so an
 * initial or later author override survives object refreshes.
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
 * @cssprop [--lr-tree-checkbox-checked-border-color=var(--lr-color-brand)] - Checked control border.
 * @cssprop [--lr-tree-checkbox-checked-bg=var(--lr-color-brand)] - Checked control background.
 * @cssprop [--lr-tree-checkbox-checked-color=var(--lr-color-on-brand)] - Checked glyph color.
 * @cssprop [--lr-tree-checkbox-indeterminate-border-color=var(--lr-color-brand)] - Indeterminate
 *   control border.
 * @cssprop [--lr-tree-checkbox-indeterminate-bg=var(--lr-color-brand)] - Indeterminate control
 *   background.
 * @cssprop [--lr-tree-checkbox-indeterminate-color=var(--lr-color-on-brand)] - Indeterminate glyph
 *   color.
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
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    item: LYRA_DEFAULT_item,
    open: LYRA_DEFAULT_open,
    restore: LYRA_DEFAULT_restore,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Custom states are progressive enhancement. DOM shims and partial polyfills may omit, throw
   *  from, or return no value from `attachInternals()`; none may make the public item unconstructible. */
  private readonly itemInternals = attachInternalsSafely(this);
  private managedItemAriaLabel: string | null = null;
  private writingItemAriaLabel = false;

  override attributeChangedCallback(name: string, oldValue: string | null, value: string | null): void {
    super.attributeChangedCallback(name, oldValue, value);
    if (name === 'aria-label' && !this.writingItemAriaLabel) {
      // Any author write, including writing the same value the data model had reflected, transfers
      // ownership. A later item refresh must not silently replace that explicit host name.
      this.managedItemAriaLabel = null;
    }
  }

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
  private treeIdentityContext?: TreeIdentityContext;
  private expandIconSource: Element | null = null;
  private collapseIconSource: Element | null = null;
  private lifecycleGeneration = 0;
  private lazyGeneration = 0;
  private lifecycleTimer?: { owner: Window; handle: number };

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
    return this.item ? Boolean(this.item.disabled || this.hasDuplicateDataId) : this.disabled;
  }

  /** Whether this rendered occurrence conflicts with an earlier data item that owns the same
   * public id. The owner is deterministic depth-first order; later occurrences fail closed. */
  private get hasDuplicateDataId(): boolean {
    const context = this.treeIdentityContext;
    const item = this.item;
    return Boolean(
      context &&
        item &&
        context.collisionIds.has(item.id) &&
        context.ownerPaths.get(item.id) !== context.path
    );
  }

  /**
   * This item's spoken name, in whichever child model is in use — used for `<lr-tree>`'s reorder
   * announcements. Falls back through `item.accessibleLabel`/`item.label`, then a host
   * `aria-label`, flattened accessible slotted label text (nested items excluded), and finally the
   * `label` attribute fallback.
   */
  get nodeLabel(): string {
    const ariaLabel = this.getAttribute('aria-label');
    if (ariaLabel !== null) return ariaLabel;
    if (this.item) return this.item.accessibleLabel || this.item.label;
    return this.slottedLabelText || this.label;
  }

  /** Reflects the data model's richer spoken name without taking ownership of an author-supplied
   * host name. Component-owned attributes may be refreshed or removed; author-owned ones are
   * presence-authoritative until the author removes them. */
  private syncItemAriaLabel(): void {
    const current = this.getAttribute('aria-label');
    if (this.managedItemAriaLabel === null && current !== null) return;

    const next = this.item?.accessibleLabel || null;
    if (next === null) {
      if (this.managedItemAriaLabel !== null && current === this.managedItemAriaLabel) {
        this.writingItemAriaLabel = true;
        try {
          this.removeAttribute('aria-label');
        } finally {
          this.writingItemAriaLabel = false;
        }
      }
      this.managedItemAriaLabel = null;
      return;
    }

    if (current !== next) {
      this.writingItemAriaLabel = true;
      try {
        this.setAttribute('aria-label', next);
      } finally {
        this.writingItemAriaLabel = false;
      }
    }
    this.managedItemAriaLabel = next;
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

  /** Internal collision-analysis context supplied by the owning data-driven tree.
   * @internal */
  setTreeIdentityContext(context: TreeIdentityContext | undefined): void {
    const old = this.treeIdentityContext;
    if (
      old?.path === context?.path &&
      old?.ownerPaths === context?.ownerPaths &&
      old?.collisionIds === context?.collisionIds
    ) {
      return;
    }
    this.treeIdentityContext = context;
    this.requestUpdate();
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
    return node.nodeType === 1 && (node as Element).localName === tag('tree-item');
  }

  private isDeclarativeLabelNode(node: Node): boolean {
    if (this.isChildItem(node)) return false;
    if (node.nodeType !== 1) return true;
    const slotName = (node as Element).getAttribute('slot');
    return slotName === null || slotName === '';
  }

  private labelForwardingSlots(): HTMLSlotElement[] {
    return Array.from(this.querySelectorAll<HTMLSlotElement>('slot')).filter((slot) => {
      let top: Node = slot;
      while (top.parentNode && top.parentNode !== this) top = top.parentNode;
      return top.parentNode === this && this.isDeclarativeLabelNode(top);
    });
  }

  private accessibleLabelText(node: Node, inheritedTextVisible?: boolean, requireComposedVisibility = false): string {
    if (node.nodeType === 3) {
      if (inheritedTextVisible === undefined) {
        const parent = this.composedParentForLabelNode(node);
        inheritedTextVisible =
          parent !== null &&
          !isAccessibilitySubtreeExcluded(parent) &&
          !isAccessibilityVisibilityHidden(parent) &&
          (!requireComposedVisibility || isAccessibilityVisible(parent));
      }
      return inheritedTextVisible ? node.textContent ?? '' : '';
    }
    if (node.nodeType !== 1) return '';
    const element = node as Element;
    if (isAccessibilitySubtreeExcluded(element)) return '';
    const ownTextVisible = !isAccessibilityVisibilityHidden(element);
    if (requireComposedVisibility && ownTextVisible && !isAccessibilityVisible(element)) return '';
    const ariaLabel = ownTextVisible ? element.getAttribute('aria-label')?.trim() : '';
    if (ariaLabel) return ariaLabel;
    const forwardingSlot = element.localName === 'slot' ? (element as HTMLSlotElement) : null;
    const hasAssignment = forwardingSlot !== null && forwardingSlot.assignedNodes().length > 0;
    const children = hasAssignment ? forwardingSlot.assignedNodes({ flatten: true }) : Array.from(element.childNodes);
    return Array.from(children)
      .map((child) => {
        const externalAssignment = hasAssignment && !this.contains(child);
        return this.accessibleLabelText(
          child,
          externalAssignment ? undefined : ownTextVisible,
          requireComposedVisibility || externalAssignment
        );
      })
      .join(' ');
  }

  private get slottedLabelText(): string {
    return this.declarativeLabelRoots()
      .map((node) => this.accessibleLabelText(node, true, false))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private declarativeLabelRoots(): Node[] {
    const childNodes = (this as unknown as { childNodes?: NodeListOf<ChildNode> }).childNodes;
    if (!childNodes) return [];
    return Array.from(childNodes).filter((node) => this.isDeclarativeLabelNode(node));
  }

  private declarativeLabelNodes(): Node[] {
    const renderRoot = this.renderRoot as ParentNode | undefined;
    if (!renderRoot) return [];
    const slot = renderRoot.querySelector<HTMLSlotElement>('slot:not([name])');
    if (slot) return slot.assignedNodes({ flatten: true });
    return this.declarativeLabelRoots().flatMap((node) => {
      if (node.nodeType !== 1 || (node as Element).localName !== 'slot') return [node];
      const forwardingSlot = node as HTMLSlotElement;
      return forwardingSlot.assignedNodes().length > 0
        ? forwardingSlot.assignedNodes({ flatten: true })
        : Array.from(forwardingSlot.childNodes);
    });
  }

  /** Whether the default slot has real label content — any element that is not a nested item, or a
   *  non-whitespace text node. Read straight off the light DOM rather than from `slotchange` so the
   *  very first render already knows, instead of flashing the `label` fallback under slotted text.
   *  Indentation whitespace around nested items does not count, which is why the fallback still
   *  renders for the (extremely common) `<lr-tree-item label="…">` + nested-children shape. */
  private get hasSlottedLabel(): boolean {
    return hasRealContent(this.declarativeLabelNodes());
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

  private observeLabelNode(node: Node): void {
    if (!this.childObserver) return;
    if (node.nodeType === 3) {
      this.childObserver.observe(node, { characterData: true });
      return;
    }
    if (node.nodeType !== 1) return;
    this.childObserver.observe(node, {
      attributes: true,
      attributeFilter: ['aria-hidden', 'aria-label', 'class', 'hidden', 'inert', 'open', 'slot', 'style'],
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  private composedParentForLabelNode(node: Node): Element | null {
    const assignedSlot = (node as Node & { assignedSlot?: HTMLSlotElement | null }).assignedSlot;
    if (assignedSlot) return assignedSlot;
    if (node.parentElement) return node.parentElement;
    const root = node.getRootNode() as Document | ShadowRoot;
    return 'host' in root && root.host.nodeType === 1 ? root.host : null;
  }

  private observeLabelAncestors(node: Node): void {
    const observer = this.childObserver;
    if (!observer) return;
    let ancestor = this.composedParentForLabelNode(node);
    while (ancestor) {
      // Preserve the full host-subtree registration while also watching consumer-owned composed
      // ancestors whose class/style can retheme an assigned root through `::slotted()` CSS.
      if (ancestor !== this && !this.contains(ancestor)) {
        observer.observe(ancestor, {
          attributes: true,
          attributeFilter: ['aria-hidden', 'class', 'hidden', 'inert', 'open', 'style'],
        });
      }
      ancestor = composedParentElement(ancestor);
    }
  }

  private bindChildObserverTargets(): void {
    if (!this.childObserver) return;
    this.childObserver.disconnect();
    this.observeLabelNode(this);
    for (const slot of this.labelForwardingSlots()) {
      if (slot.assignedNodes().length === 0) continue;
      for (const assigned of slot.assignedNodes({ flatten: true })) {
        this.observeLabelNode(assigned);
        this.observeLabelAncestors(assigned);
      }
    }
  }

  private handleLabelSlotChange = (event: Event): void => {
    const target = event.target as Element | null;
    if (target?.nodeType !== 1 || target.localName !== 'slot') return;
    if (target.getRootNode() !== this.renderRoot && !this.labelForwardingSlots().includes(target as HTMLSlotElement))
      return;
    this.bindChildObserverTargets();
    this.requestUpdate();
  };

  /** `hasSlottedLabel` and the declarative model's own `hasChildren`, sampled once per update in
   *  `willUpdate()` rather than read live from `render()`. Both answers come from the light DOM,
   *  which a server renderer cannot see at all, so a hydrating item has to reproduce the server's
   *  "no children" render first and sample one update later — see `seedFirstRenderState()`. Every
   *  later update re-samples, so they stay exactly as live as the getters they cache. */
  @state() private slottedLabel = false;
  @state() private slottedChildren = false;

  private sampleLightDomState(): void {
    this.slottedLabel = this.hasSlottedLabel;
    // Only the declarative model answers this from the light DOM; the data model's children come
    // from `item`, which a server render receives as an ordinary property binding.
    this.slottedChildren = !this.item && this.hasChildren;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.assignChildSlots();
    // The observer is intentionally absent while detached. A reconnect must therefore sample once
    // before relying on future mutations; first connections remain hydration-aware in willUpdate().
    if (this.hasUpdated) this.sampleLightDomState();
    const MutationObserverCtor = this.ownerDocument.defaultView?.MutationObserver;
    this.childObserver = MutationObserverCtor
      ? new MutationObserverCtor(() => {
          this.assignChildSlots();
          this.bindChildObserverTargets();
          this.requestUpdate();
          if (this._loading && this.actualChildItems().length > 0) {
            this.finishLazyLoad(this.lazyGeneration);
          }
        })
      : undefined;
    this.addEventListener('slotchange', this.handleLabelSlotChange);
    this.bindChildObserverTargets();
  }

  override disconnectedCallback(): void {
    this.removeEventListener('slotchange', this.handleLabelSlotChange);
    this.childObserver?.disconnect();
    this.childObserver = undefined;
    this.lifecycleGeneration++;
    this.lazyGeneration++;
    this.cancelLifecycleTimer();
    // Loading is transient request state. A reconnected item can be expanded again to issue a
    // fresh generation, but a response to the detached request must never expand it later.
    this._loading = false;
    if (this.lazy) this.expanded = false;
    super.disconnectedCallback();
  }

  private actualChildItems(): LyraTreeItem[] {
    return this.childItems();
  }

  get hasChildren(): boolean {
    if (this.depth >= TREE_MAX_RENDER_DEPTH) return false;
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
    if (this.hasUpdated) this.sampleLightDomState();
    else this.seedFirstRenderState(() => this.sampleLightDomState());
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
    // Guarded writes inside syncItemAriaLabel() distinguish the component's reflected data label
    // from an author's host override and avoid a self-triggering MutationObserver loop.
    this.syncItemAriaLabel();
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
      child.setTreeIdentityContext(this.childIdentityContext(index));
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

  private childIdentityContext(index: number): TreeIdentityContext | undefined {
    const context = this.treeIdentityContext;
    if (!context) return undefined;
    return {
      path: `${context.path}/${index}`,
      ownerPaths: context.ownerPaths,
      collisionIds: context.collisionIds,
    };
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
    this.cancelLifecycleTimer();
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

  private finishLazyLoad(generation: number, hasResolvedChildren = this.actualChildItems().length > 0): void {
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
    const owner = this.ownerDocument.defaultView;
    if (!owner) return;
    void this.updateComplete.then(() => {
      if (
        generation !== this.lifecycleGeneration ||
        !this.isConnected ||
        this.expanded !== expanded ||
        this.ownerDocument.defaultView !== owner
      ) {
        return;
      }
      const duration = this.motionDuration(expanded, owner);
      const timer = { owner, handle: 0 };
      timer.handle = owner.setTimeout(() => {
        if (this.lifecycleTimer === timer) this.lifecycleTimer = undefined;
        if (
          generation !== this.lifecycleGeneration ||
          !this.isConnected ||
          this.expanded !== expanded ||
          this.ownerDocument.defaultView !== owner
        ) {
          return;
        }
        this.emit(expanded ? 'lr-after-expand' : 'lr-after-collapse', { item: this });
      }, duration);
      this.lifecycleTimer = timer;
    });
  }

  private cancelLifecycleTimer(): void {
    const timer = this.lifecycleTimer;
    if (!timer) return;
    this.lifecycleTimer = undefined;
    timer.owner.clearTimeout(timer.handle);
  }

  private motionDuration(expanded: boolean, owner: Window): number {
    if (prefersReducedMotion(owner)) return 0;
    const property = expanded ? '--show-duration' : '--hide-duration';
    const ownStyle = owner.getComputedStyle(this);
    const raw = ownStyle.getPropertyValue(property).trim() || ownStyle.getPropertyValue('--lr-duration-base').trim();
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
    const inherited = this.inheritedIcon(this.expanded ? this.expandIconSource : this.collapseIconSource);
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
  private renderRow(content: { icon: unknown; label: unknown; description: unknown; badges: unknown }): TemplateResult {
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
        ${this.renderCheckbox()} ${content.icon}
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
            label: this.slottedLabel ? html`<slot @slotchange=${this.handleLabelSlotChange}></slot>` : this.label,
            description: nothing,
            badges: nothing,
          })}
        </div>
        ${this.expanded && this.slottedChildren
          ? html`<div part="group" role="group">
              <div part="children"><slot name=${CHILDREN_SLOT}></slot></div>
            </div>`
          : nothing}
      </div>`;
    }
    return html`<div part="base tree-item">
      <div part=${this.itemPartNames()}>
        ${this.renderRow({
          icon: item.icon != null ? html`<span part="icon" aria-hidden="true">${item.icon}</span>` : nothing,
          label: item.label,
          description: item.description ? html`<span part="description">${item.description}</span>` : nothing,
          badges: html`${item.badge != null ? html`<span part="badge">${item.badge}</span>` : nothing}
          ${(item.badges ?? []).map(
            (b) => html`<span part="badge" data-tone=${b.tone ?? 'neutral'} aria-label=${b.label ?? b.text}
              >${b.text}</span
            >`
          )}`,
        })}
      </div>
      ${!this.isDisabled && this.depth < TREE_MAX_RENDER_DEPTH && item.children?.length && !this.ancestry.includes(item)
        ? html`<div part="group" role="group" ?hidden=${!this.expanded}>
            <div part="children">
              ${repeat(
                this.keyedChildren(item.children),
                (entry) => entry.key,
                ({ child }, i) => html`<lr-tree-item
                  .item=${child}
                  .treeIdentityContext=${this.childIdentityContext(i)}
                  .depth=${this.depth + 1}
                  .ancestry=${[...this.ancestry, item]}
                  .activeId=${this.activeId}
                  .setSize=${item.children!.length}
                  .posInSet=${i + 1}
                ></lr-tree-item>`
              )}
            </div>
          </div>`
        : nothing}
    </div>`;
  }

  /** Stable sibling-local reconciliation keys remain unique even when invalid input repeats an
   * id. The occurrence suffix preserves normal id-based reuse for valid data. */
  private keyedChildren(children: TreeItem[]): Array<{ child: TreeItem; key: string }> {
    const occurrences = new Map<string, number>();
    return children.map((child) => {
      const occurrence = occurrences.get(child.id) ?? 0;
      occurrences.set(child.id, occurrence + 1);
      return { child, key: `${child.id}\u0000${occurrence}` };
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-tree-item': LyraTreeItem;
  }
}
