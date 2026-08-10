import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { composedParentElement, deepActiveElementIn } from '../../../internal/active-element.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { tag } from '../../../internal/prefix.js';
import type { LyraAccordionItem } from './accordion-item.class.js';
import type {
  LyraAccordionAppearance,
  LyraAccordionHeadingLevel,
  LyraAccordionIconPlacement,
} from './accordion-item.class.js';
import type { LyraDetails } from './details.class.js';
import { styles } from './accordion.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_expand } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type LyraAccordionMode = 'single' | 'single-collapsible' | 'multiple';
export type LyraAccordionPanel = LyraAccordionItem | LyraDetails;
type LyraAccordionTransition = 'expand' | 'collapse';
export interface LyraAccordionEventDetail { item: LyraAccordionPanel }
export interface LyraAccordionEventMap {
  'lr-expand': CustomEvent<LyraAccordionEventDetail>;
  'lr-after-expand': CustomEvent<LyraAccordionEventDetail>;
  'lr-collapse': CustomEvent<LyraAccordionEventDetail>;
  'lr-after-collapse': CustomEvent<LyraAccordionEventDetail>;
}

function normalizeMode(value: unknown): LyraAccordionMode {
  return value === 'single' || value === 'single-collapsible' ? value : 'multiple';
}

/**
 * `<lr-accordion>` — coordinates accessible, vertically stacked expandable sections.
 *
 * `mode="multiple"` allows any number of items to expand. `single` permits at most one and keeps
 * the active item open when it is activated again. `single-collapsible` also permits at most one,
 * but allows all items to be collapsed. Direct `<lr-details>` children remain supported for
 * compatibility; the full accordion presentation and roving-keyboard contract applies to
 * `<lr-accordion-item>` children.
 *
 * @customElement lr-accordion
 * @slot - Direct `<lr-accordion-item>` elements, or legacy `<lr-details>` panels.
 * @event lr-expand - Emitted before a direct item expands. `detail: { item }`. Cancelable.
 * @event lr-after-expand - Emitted after a direct item finishes expanding. `detail: { item }`.
 * @event lr-collapse - Emitted before a direct item collapses. `detail: { item }`. Cancelable.
 * @event lr-after-collapse - Emitted after a direct item finishes collapsing. `detail: { item }`.
 * @csspart base - The accordion wrapper.
 * @cssprop [--lr-accordion-outlined-bg=var(--lr-color-surface)] - Outlined group background.
 * @cssprop [--lr-accordion-outlined-border-color=var(--lr-color-border)] - Outlined border color.
 * @cssprop [--lr-accordion-filled-bg=var(--lr-color-surface-raised)] - Filled group background.
 * @cssprop [--lr-accordion-filled-border-color=transparent] - Filled border color.
 * @cssprop [--lr-accordion-filled-outlined-bg=var(--lr-color-surface-raised)] - Filled-outlined
 *   group background.
 * @cssprop [--lr-accordion-filled-outlined-border-color=var(--lr-color-border)] - Filled-outlined
 *   border color.
 * @status stable
 * @since 4.0.0
 */
export class LyraAccordion extends LyraElement<LyraAccordionEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    expand: LYRA_DEFAULT_expand,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  #_mode: LyraAccordionMode = 'multiple';
  private readonly panels = new Set<LyraAccordionPanel>();
  #pendingTransitions = new WeakMap<LyraAccordionPanel, LyraAccordionTransition>();
  #performingTransitions = new WeakMap<LyraAccordionPanel, LyraAccordionTransition>();
  #rovingItem?: LyraAccordionItem;
  #lastFocusedItem?: LyraAccordionItem;
  #availabilityObserver?: MutationObserver;

  /**
   * Controls whether one or multiple items can be expanded.
   * @default 'multiple'
   */
  @property({ reflect: true })
  get mode(): LyraAccordionMode {
    return this.#_mode;
  }
  set mode(next: LyraAccordionMode) {
    const normalized = normalizeMode(next);
    const old = this.#_mode;
    if (normalized === old) return;
    this.#_mode = normalized;
    this.requestUpdate('mode', old);
    this.requestUpdate('multiple', old === 'multiple');
  }

  /**
   * Compatibility alias for `mode`: true means `multiple`; false means `single-collapsible`.
   * When both attributes occur in initial markup, the explicit `mode` attribute wins.
   * @default true
   */
  @property({ reflect: true, converter: trueDefaultBooleanConverter })
  get multiple(): boolean {
    return this.mode === 'multiple';
  }
  set multiple(next: boolean) {
    const old = this.multiple;
    this.mode = next ? 'multiple' : 'single-collapsible';
    if (this.multiple !== old) this.requestUpdate('multiple', old);
  }

  /** Icon position applied to direct accordion items. */
  @property({ attribute: 'icon-placement', reflect: true })
  iconPlacement: LyraAccordionIconPlacement = 'end';

  /** Heading level applied to direct items. Values other than 1–6 and `none` use h3. */
  @property({ attribute: 'heading-level', reflect: true })
  headingLevel: LyraAccordionHeadingLevel = '3';

  /** Visual treatment applied to the group and its direct items. */
  @property({ reflect: true })
  appearance: LyraAccordionAppearance = 'outlined';

  override connectedCallback(): void {
    const authoredMode = this.getAttribute('mode');
    super.connectedCallback();
    this.#armAvailabilityObserver();
    // Attribute upgrade order must not decide the meaning of conflicting legacy/canonical markup.
    if (authoredMode !== null) this.mode = normalizeMode(authoredMode);
    if (this.hasUpdated) {
      queueMicrotask(() => {
        if (!this.isConnected) return;
        const slot = this.renderRoot.querySelector<HTMLSlotElement>('slot');
        if (slot) this.#bindPanels(slot.assignedElements({ flatten: true }));
      });
    }
  }

  override disconnectedCallback(): void {
    this.#resetAvailabilityObserver();
    this.panels.clear();
    this.#rovingItem = undefined;
    this.#lastFocusedItem = undefined;
    super.disconnectedCallback();
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    if (changed.has('iconPlacement') || changed.has('headingLevel') || changed.has('appearance')) {
      this.#syncPresentation();
    }
    if (changed.has('mode')) this.#reconcileExpandedPanels();
  }

  /** Expand every direct enabled item. No-op outside `multiple` mode. */
  expandAll(): void {
    if (this.mode !== 'multiple') return;
    for (const panel of this.panels) {
      if (panel.disabled || this.#isExpanded(panel)) continue;
      if (this.#isAccordionItem(panel)) panel.expand();
      else panel.show();
    }
  }

  /** Collapse every direct expanded item. */
  collapseAll(): void {
    for (const panel of this.panels) {
      if (!this.#isExpanded(panel)) continue;
      this.#requestCollapse(panel);
    }
  }

  #isAccordionItem(panel: LyraAccordionPanel): panel is LyraAccordionItem {
    return panel.localName === tag('accordion-item');
  }

  #isExpanded(panel: LyraAccordionPanel): boolean {
    return this.#isAccordionItem(panel) ? panel.expanded : panel.open;
  }

  #bindPanels(assigned: Element[]): void {
    const itemTag = tag('accordion-item');
    const detailsTag = tag('details');
    const next = assigned.filter(
      (element): element is LyraAccordionPanel =>
        element.localName === itemTag || element.localName === detailsTag,
    );
    this.panels.clear();
    for (const panel of next) this.panels.add(panel);
    this.#syncPresentation();
    this.#reconcileExpandedPanels();
    this.#syncRovingTabIndex();
  }

  #syncPresentation(): void {
    for (const panel of this.panels) {
      if (!this.#isAccordionItem(panel)) continue;
      panel.iconPlacement = this.iconPlacement;
      panel.headingLevel = this.headingLevel;
      panel.appearance = this.appearance;
    }
  }

  #reconcileExpandedPanels(): void {
    if (this.mode === 'multiple') return;
    let foundExpanded = false;
    for (const panel of this.panels) {
      if (!this.#isExpanded(panel)) continue;
      if (!foundExpanded) {
        foundExpanded = true;
        continue;
      }
      this.#performPanelState(panel, false);
    }
  }

  #isNavigableItem(item: LyraAccordionItem): boolean {
    if (item.disabled || item.hidden || item.getAttribute('aria-hidden') === 'true') {
      return false;
    }
    for (let current: Element | null = item; current; current = composedParentElement(current)) {
      if (current.hasAttribute('inert')) return false;
    }
    return true;
  }

  #navigableItems(): LyraAccordionItem[] {
    return [...this.panels].filter(
      (panel): panel is LyraAccordionItem => this.#isAccordionItem(panel) && this.#isNavigableItem(panel),
    );
  }

  #syncRovingTabIndex(preferred?: LyraAccordionItem): LyraAccordionItem | undefined {
    const items = this.#navigableItems();
    const active = preferred && items.includes(preferred)
      ? preferred
      : this.#rovingItem && items.includes(this.#rovingItem)
        ? this.#rovingItem
        : items.find((item) => item.isTabbable) ?? items[0];
    if (active) this.#rovingItem = active;
    for (const panel of this.panels) {
      if (this.#isAccordionItem(panel)) panel.isTabbable = panel === active;
    }
    return active;
  }

  #nextNavigableItem(displaced: LyraAccordionItem): LyraAccordionItem | undefined {
    const items = [...this.panels].filter(
      (panel): panel is LyraAccordionItem => this.#isAccordionItem(panel),
    );
    const index = items.indexOf(displaced);
    if (index < 0) return this.#navigableItems()[0];
    return items.slice(index + 1).find((item) => this.#isNavigableItem(item))
      ?? items.slice(0, index).reverse().find((item) => this.#isNavigableItem(item));
  }

  #reconcileRovingFocus(displaced = this.#lastFocusedItem): void {
    const unavailable =
      displaced !== undefined && this.panels.has(displaced) && !this.#isNavigableItem(displaced);
    const focused = deepActiveElementIn(this.ownerDocument);
    const wasFocused =
      displaced === this.#lastFocusedItem &&
      (focused === null ||
        focused === this.ownerDocument.body ||
        focused === displaced ||
        (focused !== null && displaced?.shadowRoot?.contains(focused)));
    const active = this.#syncRovingTabIndex(unavailable ? this.#nextNavigableItem(displaced!) : undefined);
    if (!unavailable || !active || !wasFocused) return;
    active.focus();
  }

  #armAvailabilityObserver(): void {
    const ownerDocument = this.ownerDocument;
    if (!this.isConnected) return;
    if (this.#availabilityObserver) return;
    const MutationObserverCtor = ownerDocument.defaultView?.MutationObserver;
    if (!MutationObserverCtor) return;
    const observer = new MutationObserverCtor(() => {
      if (
        this.#availabilityObserver !== observer ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      this.#reconcileRovingFocus();
    });
    this.#availabilityObserver = observer;
    observer.observe(this, {
      attributes: true,
      subtree: true,
      attributeFilter: ['disabled', 'hidden', 'aria-hidden', 'inert'],
    });
    for (
      let ancestor = composedParentElement(this);
      ancestor;
      ancestor = composedParentElement(ancestor)
    ) {
      observer.observe(ancestor, { attributes: true, attributeFilter: ['inert'] });
    }
  }

  #resetAvailabilityObserver(): void {
    this.#availabilityObserver?.disconnect();
    this.#availabilityObserver = undefined;
  }

  #markPending(panel: LyraAccordionPanel, transition: LyraAccordionTransition): void {
    this.#pendingTransitions.set(panel, transition);
    queueMicrotask(() => {
      if (this.#pendingTransitions.get(panel) !== transition) return;
      const expectedExpanded = transition === 'expand';
      if (this.#isExpanded(panel) !== expectedExpanded) this.#pendingTransitions.delete(panel);
    });
  }

  #performPanelState(panel: LyraAccordionPanel, expanded: boolean): boolean {
    const transition: LyraAccordionTransition = expanded ? 'expand' : 'collapse';
    this.#performingTransitions.set(panel, transition);
    try {
      if (expanded) panel.show();
      else panel.hide();
    } finally {
      this.#performingTransitions.delete(panel);
    }
    const changed = this.#isExpanded(panel) === expanded;
    if (!changed && this.#pendingTransitions.get(panel) === transition) {
      this.#pendingTransitions.delete(panel);
    }
    return changed;
  }

  #requestCollapse(panel: LyraAccordionPanel): boolean {
    if (!this.#isExpanded(panel)) return true;
    const before = this.emit('lr-collapse', { item: panel }, { cancelable: true });
    if (before.defaultPrevented) return false;
    this.#markPending(panel, 'collapse');
    return this.#performPanelState(panel, false);
  }

  #collapseSiblings(source: LyraAccordionPanel): boolean {
    for (const panel of this.panels) {
      if (panel === source || !this.#isExpanded(panel)) continue;
      if (!this.#requestCollapse(panel)) return false;
    }
    return true;
  }

  #handleSlotChange = (event: Event): void => {
    this.#bindPanels((event.target as HTMLSlotElement).assignedElements({ flatten: true }));
  };

  #handleItemStateChange = (event: CustomEvent<{ item: LyraAccordionItem }>): void => {
    if (!this.panels.has(event.detail.item)) return;
    event.stopPropagation();
    queueMicrotask(() => {
      if (this.panels.has(event.detail.item)) this.#reconcileRovingFocus(event.detail.item);
    });
  };

  private handleFocusIn = (event: FocusEvent): void => {
    const item = this.#itemFor(event);
    if (!item || !this.#isNavigableItem(item)) return;
    this.#lastFocusedItem = item;
    this.#syncRovingTabIndex(item);
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    const current = this.#itemFor(event);
    if (!current || !this.#isNavigableItem(current)) return;
    const items = this.#navigableItems();
    if (items.length === 0) return;
    const currentIndex = items.indexOf(current);
    if (currentIndex < 0) return;

    const forwardKey = this.effectiveDirection === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = this.effectiveDirection === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    let nextIndex: number | undefined;
    if (event.key === 'ArrowDown' || event.key === forwardKey) {
      nextIndex = (currentIndex + 1) % items.length;
    } else if (event.key === 'ArrowUp' || event.key === backwardKey) {
      nextIndex = (currentIndex - 1 + items.length) % items.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = items.length - 1;
    }
    if (nextIndex === undefined) return;

    event.preventDefault();
    event.stopPropagation();
    const next = items[nextIndex]!;
    this.#syncRovingTabIndex(next);
    next.focus();
  };

  #itemFor(event: Event): LyraAccordionItem | undefined {
    const item = event.composedPath().find(
      (node): node is LyraAccordionItem =>
        (node as Partial<Node> | null)?.nodeType === 1 &&
        (node as Element).localName === tag('accordion-item'),
    );
    return item && this.panels.has(item) ? item : undefined;
  }

  #handleItemTrigger = (event: CustomEvent<{ item: LyraAccordionItem }>): void => {
    const { item } = event.detail;
    if (!this.panels.has(item)) return;
    event.stopPropagation();
    if (item.disabled || (item.expanded && this.mode === 'single')) event.preventDefault();
  };

  #directPanel(event: Event): LyraAccordionPanel | undefined {
    const panel = event.target as LyraAccordionPanel;
    return this.panels.has(panel) ? panel : undefined;
  }

  #handlePanelShow = (event: Event): void => {
    const panel = this.#directPanel(event);
    if (!panel || event.defaultPrevented) return;
    if (this.#performingTransitions.get(panel) === 'expand') return;
    const before = this.emit('lr-expand', { item: panel }, { cancelable: true });
    if (before.defaultPrevented) {
      event.preventDefault();
      return;
    }
    if (this.mode !== 'multiple' && !this.#collapseSiblings(panel)) {
      event.preventDefault();
      return;
    }
    this.#markPending(panel, 'expand');
  };

  #handlePanelHide = (event: Event): void => {
    const panel = this.#directPanel(event);
    if (!panel || event.defaultPrevented) return;
    if (this.#performingTransitions.get(panel) === 'collapse') return;
    // Legacy Details panels do not expose the item's internal activation request, so retain the
    // historical single-mode guard for them. Group-owned sibling/collapseAll changes carry the
    // `performingTransitions` marker above and can still close them.
    if (!this.#isAccordionItem(panel) && this.mode === 'single') {
      event.preventDefault();
      return;
    }
    if (this.emit('lr-collapse', { item: panel }, { cancelable: true }).defaultPrevented) {
      event.preventDefault();
      return;
    }
    this.#markPending(panel, 'collapse');
  };

  #handlePanelAfterShow = (event: Event): void => {
    const panel = this.#directPanel(event);
    if (!panel || this.#pendingTransitions.get(panel) !== 'expand' || !this.#isExpanded(panel)) return;
    this.#pendingTransitions.delete(panel);
    this.emit('lr-after-expand', { item: panel });
  };

  #handlePanelAfterHide = (event: Event): void => {
    const panel = this.#directPanel(event);
    if (!panel || this.#pendingTransitions.get(panel) !== 'collapse' || this.#isExpanded(panel)) return;
    this.#pendingTransitions.delete(panel);
    this.emit('lr-after-collapse', { item: panel });
  };

  override render(): TemplateResult {
    return html`<div
      part="base"
      @lr-accordion-item-trigger=${this.#handleItemTrigger}
      @lr-accordion-item-state-change=${this.#handleItemStateChange}
      @lr-show=${this.#handlePanelShow}
      @lr-hide=${this.#handlePanelHide}
      @lr-after-show=${this.#handlePanelAfterShow}
      @lr-after-hide=${this.#handlePanelAfterHide}
      @focusin=${this.handleFocusIn}
      @keydown=${this.handleKeyDown}
    ><slot @slotchange=${this.#handleSlotChange}></slot></div>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-accordion': LyraAccordion; } }
