import { html, type PropertyValues, type TemplateResult } from "lit";
import { property } from "lit/decorators.js";
import {
  composedParentElement,
  deepActiveElementIn,
} from "../../../internal/active-element.js";
import { isAccessibilitySubtreeExcluded } from "../../../internal/accessibility-visibility.js";
import { LyraElement } from "../../../internal/lyra-element.js";
import { tag } from "../../../internal/prefix.js";
import type { LyraAccordionItem } from "./accordion-item.class.js";
import type {
  LyraAccordionAppearance,
  LyraAccordionHeadingLevel,
  LyraAccordionIconPlacement,
} from "./accordion-types.js";
import {
  applyAccordionItemOwnerState,
  bindAccordionItemOwner,
  releaseAccordionItemOwner,
} from "./accordion-owner.js";
import type { AccordionItemTransitionSource } from "./accordion-types.js";
import { styles } from "./accordion.styles.js";

export type LyraAccordionMode = "single" | "single-collapsible" | "multiple";
export interface LyraAccordionEventDetail {
  item: LyraAccordionItem;
}
export interface LyraAccordionEventMap {
  "lr-expand": CustomEvent<LyraAccordionEventDetail>;
  "lr-after-expand": CustomEvent<LyraAccordionEventDetail>;
  "lr-collapse": CustomEvent<LyraAccordionEventDetail>;
  "lr-after-collapse": CustomEvent<LyraAccordionEventDetail>;
}

function normalizeMode(value: unknown): LyraAccordionMode {
  return value === "single" || value === "single-collapsible"
    ? value
    : "multiple";
}

/**
 * `<lr-accordion>` — coordinates accessible, vertically stacked expandable sections.
 *
 * `mode="multiple"` allows any number of items to expand. `single` permits at most one and keeps
 * the active item open when it is activated again. `single-collapsible` also permits at most one,
 * but allows all items to be collapsed.
 *
 * Only direct `<lr-accordion-item>` children are coordinated. Direct `<lr-details>` panels were
 * accepted before 9.0.0 and no longer are: migrate `summary` to `label`, `open` to `expanded`, and
 * `show()`/`hide()` to `expand()`/`collapse()`. A `<lr-details>` slotted into an accordion today is
 * ordinary content that owns its own disclosure lifecycle -- the group does not apply its
 * presentation, single-panel invariant, roving keyboard model, or lifecycle to it.
 *
 * @customElement lr-accordion
 * @slot - Direct `<lr-accordion-item>` elements.
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
  static override styles = [LyraElement.styles, styles];

  #_mode: LyraAccordionMode = "multiple";
  private readonly panels = new Set<LyraAccordionItem>();
  #rovingItem?: LyraAccordionItem;
  #lastFocusedItem?: LyraAccordionItem;
  #availabilityObserver?: MutationObserver;
  #panelsInitialized = false;

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
    if (
      this.#panelsInitialized &&
      normalized !== "multiple" &&
      !this.#reconcileExpandedPanels(false, normalized)
    ) {
      // Reflect the still-authoritative old value after an attribute write whose required policy
      // close was vetoed. A direct property write observes the same rejection synchronously.
      this.requestUpdate("mode", normalized);
      return;
    }
    this.#_mode = normalized;
    this.requestUpdate("mode", old);
  }

  /** Icon position applied to direct accordion items. */
  @property({ attribute: "icon-placement", reflect: true })
  iconPlacement: LyraAccordionIconPlacement = "end";

  /** Heading level applied to direct items. Values other than 1–6 and `none` use h3. */
  @property({ attribute: "heading-level", reflect: true })
  headingLevel: LyraAccordionHeadingLevel = "3";

  /** Visual treatment applied to the group and its direct items. */
  @property({ reflect: true })
  appearance: LyraAccordionAppearance = "outlined";

  override connectedCallback(): void {
    super.connectedCallback();
    this.#armAvailabilityObserver();
    if (this.hasUpdated) {
      queueMicrotask(() => {
        if (!this.isConnected) return;
        const slot = this.renderRoot.querySelector<HTMLSlotElement>("slot");
        if (slot) this.#bindPanels(slot.assignedElements({ flatten: true }));
      });
    }
  }

  override disconnectedCallback(): void {
    this.#resetAvailabilityObserver();
    for (const panel of this.panels) releaseAccordionItemOwner(panel, this);
    this.panels.clear();
    this.#rovingItem = undefined;
    this.#lastFocusedItem = undefined;
    super.disconnectedCallback();
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    if (
      changed.has("iconPlacement") ||
      changed.has("headingLevel") ||
      changed.has("appearance")
    ) {
      this.#syncPresentation();
    }
  }

  /** Expand every direct enabled item. No-op outside `multiple` mode. */
  expandAll(): void {
    if (this.mode !== "multiple") return;
    for (const panel of this.panels) {
      if (panel.disabled || panel.expanded) continue;
      panel.expand();
    }
  }

  /** Collapse every direct expanded item. */
  collapseAll(): void {
    for (const panel of this.panels) {
      if (!panel.expanded) continue;
      this.#requestCollapse(panel);
    }
  }

  #bindPanels(assigned: Element[]): void {
    const itemTag = tag("accordion-item");
    const next = assigned.filter(
      (element): element is LyraAccordionItem => element.localName === itemTag
    );
    const previous = new Set(this.panels);
    this.panels.clear();
    for (const panel of next) this.panels.add(panel);
    for (const panel of previous) {
      if (!this.panels.has(panel)) releaseAccordionItemOwner(panel, this);
    }
    this.#syncPresentation();
    this.#reconcileExpandedPanels(!this.#panelsInitialized);
    this.#panelsInitialized = true;
    this.#syncRovingTabIndex();
  }

  #syncPresentation(): void {
    for (const panel of this.panels) {
      bindAccordionItemOwner(panel, {
        owner: this,
        iconPlacement: this.iconPlacement,
        headingLevel: this.headingLevel,
        appearance: this.appearance,
        requestTransition: this.#handleOwnedItemTransition,
        transitionSettled: this.#handleOwnedItemTransitionSettled,
        stateChanged: this.#handleOwnedItemStateChange,
      });
    }
  }

  #reconcileExpandedPanels(silent = false, mode = this.mode): boolean {
    if (mode === "multiple") return true;
    let foundExpanded = false;
    for (const panel of this.panels) {
      if (!panel.expanded) continue;
      if (!foundExpanded) {
        foundExpanded = true;
        continue;
      }
      const reconciled = silent
        ? this.#performPanelState(panel, false)
        : this.#requestCollapse(panel);
      if (!reconciled) return false;
    }
    return true;
  }

  #isNavigableItem(item: LyraAccordionItem): boolean {
    if (item.disabled) return false;
    for (
      let current: Element | null = item;
      current;
      current = composedParentElement(current)
    ) {
      if (isAccessibilitySubtreeExcluded(current)) return false;
    }
    return true;
  }

  #navigableItems(): LyraAccordionItem[] {
    return [...this.panels].filter((panel) => this.#isNavigableItem(panel));
  }

  #syncRovingTabIndex(
    preferred?: LyraAccordionItem
  ): LyraAccordionItem | undefined {
    const items = this.#navigableItems();
    const active =
      preferred && items.includes(preferred)
        ? preferred
        : this.#rovingItem && items.includes(this.#rovingItem)
        ? this.#rovingItem
        : items.find((item) => item.isTabbable) ?? items[0];
    if (active) this.#rovingItem = active;
    for (const panel of this.panels) panel.isTabbable = panel === active;
    return active;
  }

  #nextNavigableItem(
    displaced: LyraAccordionItem
  ): LyraAccordionItem | undefined {
    const items = [...this.panels];
    const index = items.indexOf(displaced);
    if (index < 0) return this.#navigableItems()[0];
    return (
      items.slice(index + 1).find((item) => this.#isNavigableItem(item)) ??
      items
        .slice(0, index)
        .reverse()
        .find((item) => this.#isNavigableItem(item))
    );
  }

  #reconcileRovingFocus(displaced = this.#lastFocusedItem): void {
    const unavailable =
      displaced !== undefined &&
      this.panels.has(displaced) &&
      !this.#isNavigableItem(displaced);
    const focused = deepActiveElementIn(this.ownerDocument);
    const wasFocused =
      displaced === this.#lastFocusedItem &&
      (focused === null ||
        focused === this.ownerDocument.body ||
        focused === displaced ||
        (focused !== null && displaced?.shadowRoot?.contains(focused)));
    const active = this.#syncRovingTabIndex(
      unavailable ? this.#nextNavigableItem(displaced!) : undefined
    );
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
      attributeFilter: [
        "disabled",
        "hidden",
        "aria-hidden",
        "inert",
        "class",
        "style",
      ],
    });
    for (
      let ancestor = composedParentElement(this);
      ancestor;
      ancestor = composedParentElement(ancestor)
    ) {
      observer.observe(ancestor, {
        attributes: true,
        attributeFilter: ["hidden", "aria-hidden", "inert", "class", "style"],
      });
    }
  }

  #resetAvailabilityObserver(): void {
    this.#availabilityObserver?.disconnect();
    this.#availabilityObserver = undefined;
  }

  #performPanelState(
    panel: LyraAccordionItem,
    expanded: boolean,
    announce = false
  ): boolean {
    void applyAccordionItemOwnerState(panel, expanded, announce);
    return panel.expanded === expanded;
  }

  #requestCollapse(panel: LyraAccordionItem): boolean {
    if (!panel.expanded) return true;
    const before = this.emit(
      "lr-collapse",
      { item: panel },
      { cancelable: true }
    );
    if (before.defaultPrevented) return false;
    return this.#performPanelState(panel, false, true);
  }

  #collapseSiblings(source: LyraAccordionItem): boolean {
    for (const panel of this.panels) {
      if (panel === source || !panel.expanded) continue;
      if (!this.#requestCollapse(panel)) return false;
    }
    return true;
  }

  #handleSlotChange = (event: Event): void => {
    this.#bindPanels(
      (event.target as HTMLSlotElement).assignedElements({ flatten: true })
    );
  };

  #handleOwnedItemStateChange = (item: LyraAccordionItem): void => {
    if (!this.panels.has(item)) return;
    queueMicrotask(() => {
      if (this.panels.has(item)) this.#reconcileRovingFocus(item);
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
    if (
      !current ||
      !this.#isNavigableItem(current) ||
      !this.#itemTriggerOwnsEvent(current, event)
    )
      return;
    const items = this.#navigableItems();
    if (items.length === 0) return;
    const currentIndex = items.indexOf(current);
    if (currentIndex < 0) return;

    const forwardKey =
      this.effectiveDirection === "rtl" ? "ArrowLeft" : "ArrowRight";
    const backwardKey =
      this.effectiveDirection === "rtl" ? "ArrowRight" : "ArrowLeft";
    let nextIndex: number | undefined;
    if (event.key === "ArrowDown" || event.key === forwardKey) {
      nextIndex = (currentIndex + 1) % items.length;
    } else if (event.key === "ArrowUp" || event.key === backwardKey) {
      nextIndex = (currentIndex - 1 + items.length) % items.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
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
    const item = event
      .composedPath()
      .find(
        (node): node is LyraAccordionItem =>
          (node as Partial<Node> | null)?.nodeType === 1 &&
          (node as Element).localName === tag("accordion-item")
      );
    return item && this.panels.has(item) ? item : undefined;
  }

  #itemTriggerOwnsEvent(item: LyraAccordionItem, event: Event): boolean {
    return event.composedPath().some((node) => {
      if ((node as Partial<Node> | null)?.nodeType !== 1) return false;
      const element = node as Element;
      return (
        element.localName === "button" &&
        element.getRootNode() === item.shadowRoot &&
        element.getAttribute("part")?.split(/\s+/u).includes("button") === true
      );
    });
  }

  #handleOwnedItemTransition = (
    item: LyraAccordionItem,
    expanded: boolean,
    source: AccordionItemTransitionSource
  ): boolean => {
    if (!this.panels.has(item) || item.disabled) return false;
    if (!expanded && source === "user" && this.mode === "single") return false;

    if (expanded) {
      if (
        this.emit("lr-expand", { item }, { cancelable: true }).defaultPrevented
      )
        return false;
      return this.mode === "multiple" || this.#collapseSiblings(item);
    }
    return !this.emit("lr-collapse", { item }, { cancelable: true })
      .defaultPrevented;
  };

  #handleOwnedItemTransitionSettled = (
    item: LyraAccordionItem,
    expanded: boolean
  ): void => {
    if (!this.panels.has(item) || item.expanded !== expanded) return;
    this.emit(expanded ? "lr-after-expand" : "lr-after-collapse", { item });
  };

  override render(): TemplateResult {
    return html`<div
      part="base"
      @focusin=${this.handleFocusIn}
      @keydown=${this.handleKeyDown}
    >
      <slot @slotchange=${this.#handleSlotChange}></slot>
    </div>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    "lr-accordion": LyraAccordion;
  }
}
