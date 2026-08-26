import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import {
  LyraElement,
  type LyraEventDetailSnapshot,
} from '../../../internal/lyra-element.js';
import { tag } from '../../../internal/prefix.js';
import {
  composedParentElement,
  hasRealContent,
  isAccessibilityVisible,
  nextId,
} from '../../../internal/a11y.js';
import { composedAccessibilityText } from '../../../internal/accessibility-visibility.js';
import { chevronIcon } from '../../../internal/icons.js';
import { finiteDuration } from '../../../internal/numbers.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { attachInternalsSafely } from '../../../internal/form-associated.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { cascadeUpdateComplete } from './update-cascade.js';
import { styles } from './tree-item.styles.js';
import {
  treeItemOwnerContext,
  type TreeItemOwnerContext,
} from './tree-owner-controller.js';
import { TREE_MAX_RENDER_DEPTH, TREE_MAX_RENDER_NODES, type LyraTreeNodeData } from './tree-types.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_fieldRequired } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** Internal slot nested `<lr-tree-item>` children are moved into, so the default slot can stay the
 *  label the way `wa-tree-item`/`sl-tree-item` markup expects. Assigned by this component. */
const CHILDREN_SLOT = 'children';

/** Same-name forwarding keeps every public part reachable through each recursively rendered
 * data-model child. Keep this list aligned with the class JSDoc's complete CSS-part vocabulary. */
const TREE_ITEM_EXPORT_PARTS = [
  'base',
  'tree-item',
  'row',
  'toggle',
  'icon',
  'content',
  'label',
  'description',
  'badge',
  'group',
  'item',
  'item--disabled',
  'item--expanded',
  'item--indeterminate',
  'item--selected',
  'indentation',
  'expand-button',
  'spinner',
  'spinner__base',
  'children',
  'checkbox',
  'checkbox__base',
  'checkbox__control',
  'checkbox__control--checked',
  'checkbox__control--indeterminate',
  'checkbox__checked-icon',
  'checkbox__indeterminate-icon',
  'checkbox__label',
].join(', ');

export interface LyraTreeItemEventMap {
  'lr-node-toggle': CustomEvent<{ nodeId: string; expanded: boolean }>;
  'lr-node-select': CustomEvent<{ nodeId: string }>;
  'lr-expand': CustomEvent<LyraEventDetailSnapshot<{ readonly item: LyraTreeItem }>>;
  'lr-after-expand': CustomEvent<LyraEventDetailSnapshot<{ readonly item: LyraTreeItem }>>;
  'lr-collapse': CustomEvent<LyraEventDetailSnapshot<{ readonly item: LyraTreeItem }>>;
  'lr-after-collapse': CustomEvent<LyraEventDetailSnapshot<{ readonly item: LyraTreeItem }>>;
  'lr-lazy-change': CustomEvent<
    LyraEventDetailSnapshot<{ readonly item: LyraTreeItem; readonly loading: boolean }>
  >;
  'lr-lazy-load': CustomEvent<
    LyraEventDetailSnapshot<{ readonly item: LyraTreeItem; readonly generation: number }>
  >;
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
 * **Data model**: `<lr-tree>` assigns an `item` (a `LyraTreeNodeData` object) and this element renders that
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
 * Every documented CSS part is forwarded under the same name through recursively rendered data-
 * model children. A consumer selector on the outer item therefore reaches matching row, label,
 * state, checkbox, badge, and disclosure parts at every rendered depth. Declarative children stay
 * in consumer light DOM and remain directly selectable as their own `<lr-tree-item>` hosts.
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
 * @event lr-node-toggle - `detail: { nodeId, expanded }`, fired when this node is expanded or collapsed (via `expand()`/`collapse()`, the toggle button, or ArrowRight/ArrowLeft).
 * @event lr-node-select - `detail: { nodeId }`, fired when this node's primary action is activated (via `select()`, clicking anywhere in its row, or Enter/Space).
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
 * @csspart toggle - The expand/collapse button, with pointer hover/pressed feedback while enabled.
 * @csspart icon - The optional decorative leading icon.
 * @csspart content - The primary and secondary text wrapper.
 * @csspart label - The node label.
 * @csspart description - The optional secondary description.
 * @csspart badge - One optional chip per `item.badges` entry, tone-mapped via `data-tone`.
 * @csspart group - The wrapper around a node's expanded child items.
 * @csspart item - The painted row container, excluding nested children; state backgrounds and
 *   opacity applied through the mirrored item parts reach the visible row.
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
 * @cssprop [--indent-size=var(--lr-space-l)] - Indentation step applied once per nesting depth.
 * @cssprop [--indent-guide-color=var(--lr-color-border)] - Indentation guide color.
 * @cssprop [--indent-guide-offset=0] - Block-axis inset at both ends of the indentation guide.
 * @cssprop [--indent-guide-style=solid] - Indentation guide border style.
 * @cssprop [--indent-guide-width=0] - Indentation guide width.
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
    fieldRequired: LYRA_DEFAULT_fieldRequired,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-expand',
    'lr-after-expand',
    'lr-collapse',
    'lr-after-collapse',
    'lr-lazy-change',
    'lr-lazy-load',
  ]);
  protected static override readonly identityEventDetailProperties = Object.freeze({
    'lr-expand': Object.freeze(['item']),
    'lr-after-expand': Object.freeze(['item']),
    'lr-collapse': Object.freeze(['item']),
    'lr-after-collapse': Object.freeze(['item']),
    'lr-lazy-change': Object.freeze(['item']),
    'lr-lazy-load': Object.freeze(['item']),
  });

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
  get item(): LyraTreeNodeData | undefined {
    return this._item;
  }
  set item(value: LyraTreeNodeData | undefined) {
    const old = this._item;
    if (old === value) return;
    this._item = value;
    this.selected = Boolean(value?.selected);
    this.lazy = Boolean(value?.lazy);
    const hasResolvedChildren = Boolean(value?.children?.length);
    if (this._loading && (hasResolvedChildren || !this.lazy)) {
      // A data refresh supplies its children before this item's next render. Resolve the request
      // here so `updated()` never has to schedule a second update merely to leave loading state.
      this.finishLazyLoad(this.lazyGeneration, hasResolvedChildren);
    }
    this.requestUpdate('item', old);
  }
  private _item?: LyraTreeNodeData;
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
  /** Whether only part of this branch is selected. Managed by the owning tree. */
  get indeterminate(): boolean {
    return this.ownerContext.indeterminate;
  }

  /** Owner-only hierarchy state. None of these values are consumer-settable item properties. */
  private get ownerContext(): TreeItemOwnerContext {
    return treeItemOwnerContext(this);
  }
  private lifecycleGeneration = 0;
  private lazyGeneration = 0;
  private lifecycleTimer?: { owner: Window; handle: number };
  private lifecycleAnimation?: { node: HTMLElement; listener: (event: AnimationEvent) => void };
  @state() private _collapsing = false;

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
    const context = this.ownerContext.identity;
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

  private get slottedLabelText(): string {
    return composedAccessibilityText(this.declarativeLabelRoots(), {
      requireRendered: false,
      shouldPruneNode: (node) => {
        if (this.contains(node)) return false;
        const target = node.nodeType === 1 ? node as Element : node.parentElement;
        return target === null || !isAccessibilityVisible(target);
      },
      skipRootAncestorValidation: true,
    })
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
      attributeFilter: [
        'alt',
        'aria-hidden',
        'aria-label',
        'aria-labelledby',
        'class',
        'hidden',
        'id',
        'inert',
        'open',
        'slot',
        'style',
      ],
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
    this.rebuildChildObserver();
    this.addEventListener('slotchange', this.handleLabelSlotChange);
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

  /**
   * `MutationObserver` instances are bound to the realm (`window`) that constructed them, not to
   * the node they observe: one built from a stale `window.MutationObserver` keeps delivering
   * through that window's microtask queue even after this element is adopted into a different
   * document, instead of the adopted document's own. Adoption (`document.adoptNode()`, or an
   * implicit cross-document `appendChild`) always runs `adoptedCallback()` -- while this element is
   * momentarily disconnected, ahead of any later `connectedCallback()` -- so this rebuilds the
   * observer here rather than only lazily on the next connect, the same realm-follows-adoption
   * treatment this file's own lifecycle timer already gives the owner realm in
   * `scheduleAfterEvent()`.
   */
  override adoptedCallback(): void {
    super.adoptedCallback();
    this.rebuildChildObserver();
  }

  /** Tears down and reconstructs `childObserver` bound to the current `ownerDocument`'s realm, then
   *  rebinds every current target. Called on connect and on adoption -- see `adoptedCallback()`. */
  private rebuildChildObserver(): void {
    this.childObserver?.disconnect();
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
    this.bindChildObserverTargets();
  }

  private actualChildItems(): LyraTreeItem[] {
    return this.childItems();
  }

  get hasChildren(): boolean {
    const context = this.ownerContext;
    if (context.depth >= TREE_MAX_RENDER_DEPTH) return false;
    // `item` is required in the data model (`<lr-tree>` always assigns it), but a bare
    // `document.createElement('lr-tree-item')` reaches the first update with it unset — fall through
    // to the declarative model's own children instead of throwing mid-lifecycle.
    if (!this.item) return this.lazy || this.childItems().length > 0;
    return Boolean(this.lazy || (this.item.children?.length && !context.ancestry.includes(this.item)));
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
    const context = this.ownerContext;
    this.setAttribute('aria-level', String(context.depth + 1));
    this.setAttribute('aria-setsize', String(context.setSize));
    this.setAttribute('aria-posinset', String(context.posInSet));
    if (this.hasChildren) this.setAttribute('aria-expanded', String(this.expanded));
    else this.removeAttribute('aria-expanded');
    // Guarded writes inside syncItemAriaLabel() distinguish the component's reflected data label
    // from an author's host override and avoid a self-triggering MutationObserver loop.
    this.syncItemAriaLabel();
    // One semantic owner per row. Multiple selection exposes checked/mixed state on this treeitem;
    // its checkbox-shaped visual is decorative. Single selection uses aria-selected instead.
    if (this.multipleSelection) {
      this.setAttribute('aria-checked', context.indeterminate ? 'mixed' : String(this.selected));
      this.removeAttribute('aria-selected');
    } else {
      this.removeAttribute('aria-checked');
      // A bare data-model item keeps the prior tri-state contract: omitted item.selected means the
      // standalone element does not express selection. An owning tree always manages selection, so
      // every treeitem then renders an explicit true/false value as stateful ARIA requires.
      const selectedIsExpressed = context.ownsSelection || !this.item || this.item.selected !== undefined;
      if (selectedIsExpressed) this.setAttribute('aria-selected', String(this.selected));
      else this.removeAttribute('aria-selected');
    }
    this.setAttribute('aria-disabled', String(this.isDisabled));
    if (this._loading) this.setAttribute('aria-busy', 'true');
    else this.removeAttribute('aria-busy');
    this.tabIndex = !this.isDisabled && this.nodeId === context.activeId ? 0 : -1;
    setCustomState(this.itemInternals, 'disabled', this.isDisabled);
    setCustomState(this.itemInternals, 'expanded', this.expanded);
    setCustomState(this.itemInternals, 'indeterminate', context.indeterminate);
    setCustomState(this.itemInternals, 'selected', this.selected);
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
    this._collapsing = !expanded;
    this.expanded = expanded;
    this.emit(expanded ? 'lr-expand' : 'lr-collapse', { item: this });
    this.emit('lr-node-toggle', { nodeId: this.nodeId, expanded });
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
      const animationNode = this.renderRoot.querySelector<HTMLElement>('[part="children"]');
      const duration = this.motionDuration(expanded, owner);
      const finish = (): void => {
        this.cancelLifecycleTimer();
        if (
          generation !== this.lifecycleGeneration ||
          !this.isConnected ||
          this.expanded !== expanded ||
          this.ownerDocument.defaultView !== owner
        ) {
          return;
        }
        if (!expanded && this._collapsing) {
          this._collapsing = false;
          void this.updateComplete.then(() => {
            if (
              generation === this.lifecycleGeneration &&
              this.isConnected &&
              !this.expanded &&
              !this._collapsing &&
              this.ownerDocument.defaultView === owner
            ) {
              this.emit('lr-after-collapse', { item: this });
            }
          });
          return;
        }
        this.emit('lr-after-expand', { item: this });
      };

      const computedAnimation = animationNode ? owner.getComputedStyle(animationNode).animationName : 'none';
      if (!animationNode || duration === 0 || computedAnimation === 'none') {
        finish();
        return;
      }
      const listener = (event: AnimationEvent): void => {
        if (event.target !== animationNode) return;
        finish();
      };
      animationNode.addEventListener('animationend', listener);
      this.lifecycleAnimation = { node: animationNode, listener };
      const timer = { owner, handle: 0 };
      timer.handle = owner.setTimeout(finish, duration);
      this.lifecycleTimer = timer;
    });
  }

  private cancelLifecycleTimer(): void {
    const animation = this.lifecycleAnimation;
    if (animation) {
      this.lifecycleAnimation = undefined;
      animation.node.removeEventListener('animationend', animation.listener);
    }
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
    return finiteDuration(match[2] === 's' ? amount * 1000 : amount, 0);
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
    this.emit('lr-node-select', { nodeId: this.nodeId });
    this.focus();
  }

  /** Activates the same row-selection path as a pointer click, with disabled gating. */
  override click(): void {
    if (this.isDisabled) return;
    const row = this.renderRoot.querySelector<HTMLElement>('[part="row"]');
    if (row) row.click();
    else this.select();
  }

  /** See `cascadeUpdateComplete` and the matching override on `<lr-tree>`. */
  protected override async getUpdateComplete(): Promise<boolean> {
    const result = await super.getUpdateComplete();
    const context = this.ownerContext;
    if (context.ownsSelection && context.depth < TREE_MAX_RENDER_DEPTH) {
      await cascadeUpdateComplete(this.childItems().slice(0, TREE_MAX_RENDER_NODES));
    }
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

  /** Firefox suppresses native `:active` when the mousedown default is prevented above. */
  private onTogglePointerDown = (event: PointerEvent): void => {
    const toggle = event.currentTarget as HTMLElement | null;
    if (toggle?.nodeType !== 1) return;
    toggle.setAttribute('data-pressed', '');
    toggle.setPointerCapture(event.pointerId);
  };

  private onTogglePointerEnd = (event: PointerEvent): void => {
    const toggle = event.currentTarget as HTMLElement | null;
    if (toggle?.nodeType !== 1) return;
    toggle.removeAttribute('data-pressed');
    if (toggle.hasPointerCapture(event.pointerId)) toggle.releasePointerCapture(event.pointerId);
  };

  private get multipleSelection(): boolean {
    const selection = this.ownerContext.selection;
    return selection === 'multiple' || selection === 'leaf-multiple';
  }

  private itemPartNames(): string {
    return [
      'item',
      this.isDisabled ? 'item--disabled' : '',
      this.expanded ? 'item--expanded' : '',
      this.indeterminate ? 'item--indeterminate' : '',
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
    const context = this.ownerContext;
    const inherited = this.inheritedIcon(this.expanded ? context.expandIcon : context.collapseIcon);
    return html`<slot name=${slotName}>${inherited === nothing ? chevronIcon() : inherited}</slot>`;
  }

  private renderSpinner(): TemplateResult {
    return html`<span part="spinner" aria-hidden="true"><span part="spinner__base"></span></span>`;
  }

  private renderCheckbox(): TemplateResult | typeof nothing {
    if (!this.multipleSelection) return nothing;
    const controlParts = [
      'checkbox__control',
      this.selected ? 'checkbox__control--checked' : '',
      this.indeterminate ? 'checkbox__control--indeterminate' : '',
    ]
      .filter(Boolean)
      .join(' ');
    return html`
      <span
        part="checkbox"
        aria-hidden="true"
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
      <div part="row" style=${`--lr-tree-depth:${this.ownerContext.depth}`} @click=${() => this.select()}>
        <span part="indentation" aria-hidden="true"></span>
        <span part="expand-button">
          <button
            part="toggle"
            type="button"
            tabindex="-1"
            aria-hidden="true"
            ?disabled=${this.isDisabled || this._loading}
            ?hidden=${!this.hasChildren}
            @pointerdown=${this.onTogglePointerDown}
            @pointerup=${this.onTogglePointerEnd}
            @pointercancel=${this.onTogglePointerEnd}
            @lostpointercapture=${this.onTogglePointerEnd}
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
    const context = this.ownerContext;
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
        ${(this.expanded || this._collapsing) && this.slottedChildren
          ? html`<div part="group" role="group">
              <div part="children" ?data-collapsing=${this._collapsing}><slot name=${CHILDREN_SLOT}></slot></div>
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
          badges: html`${(item.badges ?? []).map(
            (b) => html`<span
                part="badge"
                data-tone=${b.tone ?? 'neutral'}
                role=${b.label ? 'img' : nothing}
                aria-label=${b.label || nothing}
              >${b.text}</span
            >`
          )}`,
        })}
      </div>
      ${!this.isDisabled &&
      context.depth < TREE_MAX_RENDER_DEPTH &&
      item.children?.length &&
      !context.ancestry.includes(item) &&
      (this.expanded || this._collapsing)
        ? html`<div part="group" role="group">
            <div part="children" ?data-collapsing=${this._collapsing}>
              ${repeat(
                this.keyedChildren(item.children),
                (entry) => entry.key,
                ({ child }) => html`<lr-tree-item
                  exportparts=${TREE_ITEM_EXPORT_PARTS}
                  .item=${child}
                ></lr-tree-item>`
              )}
            </div>
          </div>`
        : nothing}
    </div>`;
  }

  /** Stable sibling-local reconciliation keys remain unique even when invalid input repeats an
   * id. The occurrence suffix preserves normal id-based reuse for valid data. */
  private keyedChildren(children: readonly LyraTreeNodeData[]): Array<{ child: LyraTreeNodeData; key: string }> {
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
