import { html, nothing, type PropertyValues, type TemplateResult } from "lit";
import { property, query, state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import type { DocumentLocator } from "../../../ai/types.js";
import { deepActiveElementIn } from "../../../internal/active-element.js";
import { resolveCssLength } from "../../../internal/css-length.js";
import { composedParentElement } from "../../../internal/active-element.js";
import {
  applyComposedFocusRepair,
  captureComposedFocusRepair,
  collectComposedFocusTargets,
  isActionableElement,
  isSemanticActionElement,
  type ComposedFocusRepairSnapshot,
} from "../../../internal/focus-navigation.js";
import { LyraElement } from "../../../internal/lyra-element.js";
import { finiteNumber, finiteRange } from "../../../internal/numbers.js";
import {
  writeClipboardText,
  type LyraClipboardWriteFailure,
  type LyraClipboardWriteSuccess,
} from "../../../internal/clipboard.js";
import {
  activateOverlay,
  composedContains,
  type OverlayHandle,
} from "../../../internal/overlay-manager.js";
import { styles } from "./selection-toolbar.styles.js";
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_copy, LYRA_DEFAULT_copyFailed, LYRA_DEFAULT_selectionAsk, LYRA_DEFAULT_selectionCite, LYRA_DEFAULT_selectionQuote, LYRA_DEFAULT_selectionToolbarLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type SelectionAction = "ask" | "quote" | "cite" | "copy";

const SELECTION_ACTIONS: readonly SelectionAction[] = [
  "ask",
  "quote",
  "cite",
  "copy",
];

export interface SelectionActionDetail {
  action: SelectionAction;
  text: string;
  anchor: DocumentLocator | null;
}

export interface LyraSelectionToolbarEventMap {
  "lr-selection-action": CustomEvent<SelectionActionDetail>;
  "lr-dismiss": CustomEvent<null>;
  "lr-copy": CustomEvent<LyraClipboardWriteSuccess>;
  "lr-error": CustomEvent<null>;
  "lr-copy-error": CustomEvent<LyraClipboardWriteFailure>;
}

const DEFAULT_PLACEMENT_GAP_PX = 8;

interface ActionFocusRepair {
  action?: SelectionAction;
  index: number;
  repair: ComposedFocusRepairSnapshot;
  stop: HTMLElement;
}

/**
 * `<lr-selection-toolbar>` — a nonmodal action toolbar positioned above selected text. It carries
 * the selected text and a format-neutral document anchor into ask, quote, cite, or copy actions.
 * Controlled action refreshes preserve a focused action by id, otherwise move to the nearest
 * survivor, or focus the toolbar when no actions remain, without overriding newer focus moves.
 *
 * The four built-in actions are the shipped set; `actions` reorders or subsets them. Anything
 * beyond them -- "translate", "define", "search web" -- goes in the `actions` slot, which renders
 * after the built-ins inside the same `role="toolbar"` element and joins the same roving-tabindex
 * group (Home/End/Arrow, RTL-mirrored), so a fifth action does not mean reimplementing the
 * positioning, keyboard, and dismissal behavior from scratch. The toolbar traverses open shadow
 * roots and slots to manage each real action rather than treating a custom-element or wrapper root
 * as a focus target merely because it exposes `focus()`. A slotted action carries its own
 * accessible name and click handling; this component only manages its tab stop. Availability,
 * actionability, and `tabindex` changes are reconciled live; focused removals/unavailable actions
 * move to the nearest survivor or stable toolbar without overriding newer external focus.
 *
 * @customElement lr-selection-toolbar
 * @slot actions - Extra actions rendered after the built-in ask/quote/cite/copy buttons, inside
 *   the same `role="toolbar"` element and roving-tabindex group.
 * @event lr-selection-action - An action was chosen. `detail: { action, text, anchor }`.
 * @event lr-dismiss - The toolbar was dismissed with Escape.
 * @event lr-copy - Clipboard writing fulfilled. Frozen `detail: { ok: true, text }`.
 * @event lr-error - Clipboard writing failed; generic no-detail notification.
 * @event lr-copy-error - Clipboard writing failed. Frozen
 *   `detail: { ok: false, text, reason, error }`.
 * @csspart toolbar - The floating `role="toolbar"` surface.
 * @csspart action - Every action button.
 * @csspart action-ask - The ask action.
 * @csspart action-quote - The quote action.
 * @csspart action-cite - The cite action.
 * @csspart action-copy - The copy action.
 * @cssprop [--lr-selection-toolbar-placement-gap=var(--lr-space-s)] - Non-negative distance
 *   between the selection and toolbar, and between the toolbar and viewport during collision
 *   avoidance. Unitless pixel values and `px`, `rem`, and `em` values are resolved live; invalid values
 *   fall back to the default and negative values clamp to `0`.
 * @status stable
 * @since 7.0.0
 */
export class LyraSelectionToolbar extends LyraElement<LyraSelectionToolbarEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    copy: LYRA_DEFAULT_copy,
    copyFailed: LYRA_DEFAULT_copyFailed,
    selectionAsk: LYRA_DEFAULT_selectionAsk,
    selectionCite: LYRA_DEFAULT_selectionCite,
    selectionQuote: LYRA_DEFAULT_selectionQuote,
    selectionToolbarLabel: LYRA_DEFAULT_selectionToolbarLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  @property({ type: Boolean, reflect: true }) open = false;
  @property() text = "";
  @property({ attribute: false }) anchor: DocumentLocator | null = null;
  @property({ attribute: false }) rect: DOMRectReadOnly | null = null;
  /**
   * Controlled action set. A focused action survives reordering by id; if it is removed, focus
   * moves to the nearest action or the stable toolbar when the set becomes empty.
   */
  @property({ attribute: false }) actions: SelectionAction[] = [
    "ask",
    "quote",
    "cite",
    "copy",
  ];
  @property() label = "";
  @property({ attribute: "aria-label" }) accessibleLabel: string | null = null;
  @state() private copyFailed = false;

  @query('[part="toolbar"]') private toolbar?: HTMLElement;
  private overlay?: OverlayHandle;
  private stopPositioning?: () => void;
  private activeActionIndex = 0;
  private lifecycleGeneration = 0;
  private positioningGeneration = 0;
  private rovingGeneration = 0;
  private pendingActionFocus?: ActionFocusRepair;
  private focusedAction?: ActionFocusRepair;
  private actionObserver?: MutationObserver;
  private managedActionStops = new Set<HTMLElement>();
  private authoredActionTabIndex = new WeakMap<HTMLElement, string | null>();

  override connectedCallback(): void {
    super.connectedCallback();
    // A reconnect (e.g. a drag-and-drop reparent keeping this same element instance) fires
    // disconnectedCallback then connectedCallback synchronously with no update in between, so
    // updated()'s `changed.has('open')` branch never reruns to notice `open` is still true --
    // resume the overlay registration *and* restart the positioning subscription
    // disconnectedCallback tore down (mirrors lr-tooltip's identical reconnect handling).
    if (this.hasUpdated) {
      this.syncOpenLifecycle();
      void this.syncRovingStops();
    }
  }

  override disconnectedCallback(): void {
    this.lifecycleGeneration++;
    this.rovingGeneration++;
    this.pendingActionFocus = undefined;
    this.focusedAction = undefined;
    this.actionObserver?.disconnect();
    this.actionObserver = undefined;
    this.retirePositioning();
    this.overlay?.suspend();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    // Adoption can happen after a node was already disconnected, so independently invalidate
    // every continuation and exact owner-window subscription retained by the old document.
    this.lifecycleGeneration++;
    this.rovingGeneration++;
    this.pendingActionFocus = undefined;
    this.focusedAction = undefined;
    this.actionObserver?.disconnect();
    this.actionObserver = undefined;
    this.retirePositioning();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!changed.has("actions")) return;
    const active = deepActiveElementIn(this.ownerDocument);
    const toolbar = this.toolbar;
    if (!active || !toolbar) return;
    const index = this.actionButtons().indexOf(active as HTMLElement);
    if (index < 0) return;
    const repair = captureComposedFocusRepair(active, toolbar);
    if (!repair) return;
    this.pendingActionFocus = {
      action: this.actionForStop(active),
      index,
      repair,
      stop: active as HTMLElement,
    };
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has("open") || changed.has("text")) this.syncOpenLifecycle();
    if (
      this.open &&
      this.text &&
      (changed.has("rect") || changed.has("actions"))
    ) {
      this.updateToolbarPosition();
    }
    if (
      this.open &&
      this.text &&
      (changed.has("open") || changed.has("text") || changed.has("actions"))
    ) {
      const pending = changed.has("actions")
        ? this.pendingActionFocus
        : undefined;
      this.pendingActionFocus = undefined;
      if (!pending) {
        void this.syncRovingStops();
        return;
      }
      void this.syncRovingStops(pending.index, pending);
    }
  }

  private syncOpenLifecycle(): void {
    if (!this.isConnected) {
      // Lit can finish a queued update after removal. Never let that detached update resume the
      // suspended handle against its former document (or activate a fresh document listener).
      // Retiring the handle here also means the next connectedCallback necessarily registers
      // against the element's then-current owner document.
      this.retirePositioning();
      this.overlay?.deactivate();
      this.overlay = undefined;
      return;
    }
    if (!this.open || !this.text) {
      this.retirePositioning();
      this.overlay?.deactivate();
      this.overlay = undefined;
      return;
    }
    if (this.overlay?.isActive()) {
      this.overlay.resume();
    } else {
      this.overlay = activateOverlay({
        host: this,
        panel: () => this.toolbar ?? null,
        onEscape: () => this.dismiss(),
        modal: false,
        trapFocus: false,
      });
    }
    this.startPositioning();
  }

  private dismiss(): void {
    if (!this.open) return;
    this.open = false;
    this.emit("lr-dismiss", null);
  }

  private async activate(action: SelectionAction): Promise<void> {
    const text = this.text;
    const anchor = this.anchor;
    const generation = this.lifecycleGeneration;
    const owner = this.isConnected ? this.ownerDocument.defaultView : null;
    this.copyFailed = false;
    if (action === "copy") {
      const outcome = await writeClipboardText(owner, text);
      if (!this.isCurrentLifecycle(generation, owner)) return;
      if (!outcome.ok) {
        this.copyFailed = true;
        this.emit("lr-error", null);
        this.emit("lr-copy-error", outcome);
        return;
      }
      this.emit("lr-copy", outcome);
    }
    if (!this.isCurrentLifecycle(generation, owner)) return;
    this.emit("lr-selection-action", { action, text, anchor });
  }

  private isCurrentLifecycle(
    generation: number,
    owner: Window | null
  ): boolean {
    return (
      generation === this.lifecycleGeneration &&
      this.isConnected &&
      this.ownerDocument.defaultView === owner
    );
  }

  /** Every stop in the `role="toolbar"` roving group, in rendered order: the built-in actions
   *  first, then whatever a consumer slotted into `actions`. Slotted stops live in the host's
   *  light DOM (not `renderRoot`), so every containment check below has to accept both. */
  private actionButtons(): HTMLElement[] {
    const toolbar = this.toolbar;
    if (!toolbar) return [];
    return collectComposedFocusTargets(toolbar, {
      mode: "programmatic",
      includeRoot: false,
    }).elements.filter(
      (button) =>
        Boolean(isSemanticActionElement(button)) ||
        (this.authoredActionTabIndex.has(button)
          ? this.authoredActionTabIndex.get(button) !== null
          : button.hasAttribute("tabindex"))
    );
  }

  private actionRoots(): Element[] {
    const builtIn = [
      ...this.renderRoot.querySelectorAll<HTMLElement>(
        "lr-button[data-action]"
      ),
    ];
    const slot = this.renderRoot.querySelector<HTMLSlotElement>(
      'slot[name="actions"]'
    );
    return [...builtIn, ...(slot?.assignedElements({ flatten: true }) ?? [])];
  }

  private actionForStop(stop: Element): SelectionAction | undefined {
    const owner = [
      ...this.renderRoot.querySelectorAll<HTMLElement>(
        "lr-button[data-action]"
      ),
    ].find((button) => composedContains(button, stop));
    const action = owner?.getAttribute("data-action");
    return action && SELECTION_ACTIONS.includes(action as SelectionAction)
      ? (action as SelectionAction)
      : undefined;
  }

  /** Whether `button` is still one of this toolbar's own stops -- rendered inside the shadow root,
   *  or slotted as a light-DOM child of the host. */
  private ownsActionButton(button: HTMLElement): boolean {
    return this.actionButtons().includes(button);
  }

  private onActionsSlotChange = (): void => {
    // A consumer adding or removing a slotted action changes the stop count without changing any
    // reactive property, so nothing else would re-derive the roving tab stops.
    void this.syncRovingStops();
  };

  private async syncRovingStops(
    preferredIndex = this.activeActionIndex,
    requestedRepair?: ActionFocusRepair
  ): Promise<HTMLElement | undefined> {
    const generation = this.lifecycleGeneration;
    const owner = this.ownerDocument.defaultView;
    const request = ++this.rovingGeneration;
    if (!owner || !this.isConnected) return undefined;
    const roots = this.actionRoots();
    await Promise.all(
      roots.map(
        (root) =>
          (root as Element & { updateComplete?: Promise<unknown> })
            .updateComplete
      )
    );
    await Promise.resolve();
    const buttons = this.actionButtons();
    if (
      request !== this.rovingGeneration ||
      !this.isCurrentLifecycle(generation, owner) ||
      buttons.some(
        (button) =>
          !button.isConnected ||
          button.ownerDocument !== this.ownerDocument ||
          !this.ownsActionButton(button)
      )
    )
      return undefined;
    const focused = requestedRepair ?? this.focusedAction;
    const exactIndex = focused ? buttons.indexOf(focused.stop) : -1;
    const retainedIndex =
      exactIndex >= 0
        ? exactIndex
        : focused?.action
        ? buttons.findIndex(
            (button) => this.actionForStop(button) === focused.action
          )
        : -1;
    const targetIndex =
      retainedIndex >= 0
        ? retainedIndex
        : focused
        ? Math.min(Math.max(0, focused.index), Math.max(0, buttons.length - 1))
        : Math.min(
            Math.max(0, preferredIndex),
            Math.max(0, buttons.length - 1)
          );
    this.setRovingStops(buttons, targetIndex);
    const target = buttons[targetIndex];
    if (focused && target !== focused.stop) {
      applyComposedFocusRepair(focused.repair, target ?? this.toolbar ?? null);
      if (this.focusedAction === focused) this.focusedAction = undefined;
    }
    return target;
  }

  private setRovingStops(buttons: HTMLElement[], index: number): void {
    this.actionObserver?.disconnect();
    for (const button of buttons) {
      if (!this.authoredActionTabIndex.has(button)) {
        this.authoredActionTabIndex.set(
          button,
          button.getAttribute("tabindex")
        );
      }
    }
    for (const previous of this.managedActionStops) {
      if (
        !buttons.includes(previous) &&
        (previous.hasAttribute("tabindex") ||
          Boolean(isActionableElement(previous)))
      ) {
        previous.tabIndex = -1;
      }
    }
    this.activeActionIndex =
      buttons.length === 0
        ? 0
        : Math.min(Math.max(0, index), buttons.length - 1);
    buttons.forEach((button, buttonIndex) => {
      button.tabIndex = buttonIndex === this.activeActionIndex ? 0 : -1;
    });
    this.managedActionStops = new Set(buttons);
    this.observeActionChanges(buttons);
  }

  private observeActionChanges(buttons: HTMLElement[]): void {
    this.actionObserver?.disconnect();
    const Observer = this.ownerDocument.defaultView?.MutationObserver;
    const toolbar = this.toolbar;
    if (!Observer || !toolbar || !this.isConnected) {
      this.actionObserver = undefined;
      return;
    }
    const observer = new Observer(this.onActionMutations);
    const roots = new Set<Node>([toolbar, ...this.actionRoots()]);
    for (const button of buttons) {
      let current: Element | null = button;
      while (current && current !== this) {
        const root = current.getRootNode();
        if (root.nodeType === 11 && "host" in root) roots.add(root);
        current = composedParentElement(current);
      }
    }
    const options: MutationObserverInit = {
      attributes: true,
      attributeOldValue: true,
      attributeFilter: [
        "aria-disabled",
        "aria-hidden",
        "contenteditable",
        "controls",
        "disabled",
        "hidden",
        "href",
        "inert",
        "open",
        "role",
        "tabindex",
        "type",
      ],
      childList: true,
      subtree: true,
    };
    for (const root of roots) observer.observe(root, options);
    this.actionObserver = observer;
  }

  private onActionMutations = (records: MutationRecord[]): void => {
    for (const record of records) {
      if (record.type !== "attributes" || record.attributeName !== "tabindex")
        continue;
      const target = record.target as HTMLElement;
      if (this.authoredActionTabIndex.has(target)) {
        this.authoredActionTabIndex.set(
          target,
          target.getAttribute("tabindex")
        );
      }
    }
    void this.syncRovingStops();
  };

  private onToolbarFocusIn = (event: FocusEvent): void => {
    const buttons = this.actionButtons();
    const path = event.composedPath();
    const index = buttons.findIndex((button) => path.includes(button));
    if (index < 0) {
      this.focusedAction = undefined;
      return;
    }
    const origin = path[0] as Partial<HTMLElement> | undefined;
    const stop =
      origin?.nodeType === 1 && typeof origin.focus === "function"
        ? (origin as HTMLElement)
        : buttons[index];
    const toolbar = this.toolbar;
    const repair =
      stop && toolbar ? captureComposedFocusRepair(stop, toolbar) : null;
    this.focusedAction =
      stop && repair
        ? { action: this.actionForStop(stop), index, repair, stop }
        : undefined;
    void this.syncRovingStops(index);
  };

  private onToolbarFocusOut = (event: FocusEvent): void => {
    const destination = event.relatedTarget;
    if (
      destination &&
      (destination as Node).nodeType === 1 &&
      !composedContains(this, destination as Element)
    ) {
      this.focusedAction = undefined;
    }
  };

  private onToolbarKeyDown = (event: KeyboardEvent): void => {
    const buttons = this.actionButtons();
    if (buttons.length === 0) return;
    const originIndex = buttons.findIndex((button) =>
      event.composedPath().includes(button)
    );
    const currentIndex =
      originIndex >= 0 ? originIndex : this.activeActionIndex;
    const forward =
      this.effectiveDirection === "rtl" ? "ArrowLeft" : "ArrowRight";
    const backward =
      this.effectiveDirection === "rtl" ? "ArrowRight" : "ArrowLeft";
    let next: number;
    if (event.key === forward) next = (currentIndex + 1) % buttons.length;
    else if (event.key === backward)
      next = (currentIndex - 1 + buttons.length) % buttons.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = buttons.length - 1;
    else return;
    event.preventDefault();
    // Arrow/Home/End is an intentional move away from the currently focused stop, so the live
    // repair snapshot must not pin reconciliation to that old stop.
    this.focusedAction = undefined;
    const generation = this.lifecycleGeneration;
    const owner = this.ownerDocument.defaultView;
    void this.syncRovingStops(next).then((button) => {
      if (
        !button ||
        !this.isCurrentLifecycle(generation, owner) ||
        !button.isConnected ||
        button.ownerDocument !== this.ownerDocument ||
        !this.ownsActionButton(button)
      )
        return;
      button.focus();
    });
  };

  private actionPartNames(action: SelectionAction): string {
    const parts = ["action"];
    switch (action) {
      case "ask":
        parts.push("action-ask");
        break;
      case "quote":
        parts.push("action-quote");
        break;
      case "cite":
        parts.push("action-cite");
        break;
      case "copy":
        parts.push("action-copy");
        break;
    }
    return parts.join(" ");
  }

  private actionLabel(action: SelectionAction): string {
    switch (action) {
      case "ask":
        return this.localize("selectionAsk");
      case "quote":
        return this.localize("selectionQuote");
      case "cite":
        return this.localize("selectionCite");
      case "copy":
        return this.localize(this.copyFailed ? "copyFailed" : "copy");
    }
  }

  /** Coerces a caller-supplied `rect` to finite geometry before it reaches any style sink --
   *  `rect` is typed `DOMRectReadOnly`, but TS cannot enforce that across the property boundary,
   *  and `coordinates()` feeds a `styleMap()` whose first commit serializes the whole `style`
   *  value as one string (see `sanitizeSwatchColor`'s doc comment for why that matters). */
  private safeRect(rect: DOMRectReadOnly): {
    left: number;
    top: number;
    width: number;
    bottom: number;
  } {
    return {
      left: finiteNumber(rect.left, 0),
      top: finiteNumber(rect.top, 0),
      width: finiteNumber(rect.width, 0),
      bottom: finiteNumber(rect.bottom, 0),
    };
  }

  private viewportBounds(view: Window): {
    left: number;
    top: number;
    width: number;
    height: number;
    right: number;
    bottom: number;
    layoutWidth: number;
  } {
    const layoutWidth = Math.max(0, finiteNumber(view.innerWidth, 0));
    const layoutHeight = Math.max(0, finiteNumber(view.innerHeight, 0));
    const viewport = view.visualViewport;
    const left = Math.max(0, finiteNumber(viewport?.offsetLeft ?? 0, 0));
    const top = Math.max(0, finiteNumber(viewport?.offsetTop ?? 0, 0));
    const width = Math.max(
      0,
      finiteNumber(viewport?.width ?? layoutWidth, layoutWidth)
    );
    const height = Math.max(
      0,
      finiteNumber(viewport?.height ?? layoutHeight, layoutHeight)
    );
    return {
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      layoutWidth,
    };
  }

  private coordinates(): Record<string, string> {
    const view = this.ownerDocument.defaultView;
    const viewport = view
      ? this.viewportBounds(view)
      : {
          left: 0,
          top: 0,
          width: 0,
          height: 0,
          right: 0,
          bottom: 0,
          layoutWidth: 0,
        };
    const rect = this.rect ? this.safeRect(this.rect) : undefined;
    const desiredInline = rect
      ? rect.left + rect.width / 2
      : viewport.left + viewport.width / 2;
    const block = rect?.top ?? viewport.top;
    return {
      "--_lr-selection-toolbar-inline-start": `${
        this.effectiveDirection === "rtl"
          ? viewport.layoutWidth - desiredInline
          : desiredInline
      }px`,
      "--_lr-selection-toolbar-block-start": `${block}px`,
    };
  }

  /** Resolves the shared selection-anchor and collision-edge distance from the host's live
   *  custom property. Placement works in viewport pixels, so it must not pass an unresolved CSS
   *  expression into geometry math; unsupported values retain the historical 8px fallback. */
  private placementGapPx(): number {
    const raw =
      this.ownerDocument.defaultView
        ?.getComputedStyle(this)
        .getPropertyValue("--lr-selection-toolbar-placement-gap")
        .trim() ?? "";
    return finiteRange(
      resolveCssLength(raw, { host: this }) ?? DEFAULT_PLACEMENT_GAP_PX,
      DEFAULT_PLACEMENT_GAP_PX,
      0
    );
  }

  private updateToolbarPosition = (): void => {
    const toolbar = this.toolbar;
    const view = this.ownerDocument.defaultView;
    if (!toolbar || !view) return;
    const gap = this.placementGapPx();
    const edge = gap;
    const viewport = this.viewportBounds(view);
    const rect = this.safeRect(
      this.rect ??
        new view.DOMRect(viewport.left + viewport.width / 2, viewport.top, 0, 0)
    );
    toolbar.style.setProperty(
      "--_lr-selection-toolbar-max-inline-size",
      `${Math.max(0, viewport.width - edge * 2)}px`
    );
    toolbar.style.setProperty(
      "--_lr-selection-toolbar-max-block-size",
      `${Math.max(0, viewport.height - edge * 2)}px`
    );
    const width = toolbar.offsetWidth;
    const height = toolbar.offsetHeight;
    const desiredInline = rect.left + rect.width / 2;
    const desiredLeft = desiredInline - width / 2;
    const minLeft = viewport.left + edge;
    const maxLeft = Math.max(minLeft, viewport.right - width - edge);
    const left = Math.min(maxLeft, Math.max(minLeft, desiredLeft));
    const above = rect.top - height - gap;
    const below = rect.bottom + gap;
    const minTop = viewport.top + edge;
    const desiredTop = above >= minTop ? above : below;
    const maxTop = Math.max(minTop, viewport.bottom - height - edge);
    const top = Math.min(maxTop, Math.max(minTop, desiredTop));
    const logicalInline =
      this.effectiveDirection === "rtl"
        ? viewport.layoutWidth - desiredInline
        : desiredInline;
    toolbar.style.setProperty(
      "--_lr-selection-toolbar-inline-start",
      `${logicalInline}px`
    );
    toolbar.style.setProperty(
      "--_lr-selection-toolbar-block-start",
      `${rect.top}px`
    );
    toolbar.style.setProperty(
      "--_lr-selection-toolbar-inline-shift",
      `${left - (desiredInline - width / 2)}px`
    );
    toolbar.style.setProperty(
      "--_lr-selection-toolbar-block-shift",
      `${top - (rect.top - height)}px`
    );
    toolbar.toggleAttribute("data-positioned", true);
  };

  private startPositioning(): void {
    this.retirePositioning();
    const toolbar = this.toolbar;
    const view = this.ownerDocument.defaultView;
    if (!toolbar || !view || !this.isConnected) return;
    const generation = this.positioningGeneration;
    const update = (): void => {
      if (
        generation !== this.positioningGeneration ||
        !this.isConnected ||
        this.ownerDocument.defaultView !== view ||
        this.toolbar !== toolbar
      )
        return;
      this.updateToolbarPosition();
    };
    let resizeFrame: number | undefined;
    const scheduleResizeUpdate = (): void => {
      if (resizeFrame !== undefined) return;
      resizeFrame = view.requestAnimationFrame(() => {
        resizeFrame = undefined;
        update();
      });
    };
    const observer =
      typeof view.ResizeObserver === "undefined"
        ? undefined
        : new view.ResizeObserver(scheduleResizeUpdate);
    observer?.observe(toolbar);
    view.addEventListener("resize", update);
    view.visualViewport?.addEventListener("resize", update);
    view.visualViewport?.addEventListener("scroll", update);
    update();
    this.stopPositioning = () => {
      observer?.disconnect();
      if (resizeFrame !== undefined) view.cancelAnimationFrame(resizeFrame);
      resizeFrame = undefined;
      view.removeEventListener("resize", update);
      view.visualViewport?.removeEventListener("resize", update);
      view.visualViewport?.removeEventListener("scroll", update);
    };
  }

  private retirePositioning(): void {
    this.positioningGeneration++;
    const stop = this.stopPositioning;
    this.stopPositioning = undefined;
    stop?.();
  }

  override render(): TemplateResult {
    if (!this.open || !this.text) return html`${nothing}`;
    const label =
      this.accessibleLabel ??
      (this.label || this.localize("selectionToolbarLabel"));
    return html`<div
      part="toolbar"
      role="toolbar"
      aria-label=${label}
      tabindex="-1"
      style=${styleMap(this.coordinates())}
      @focusin=${this.onToolbarFocusIn}
      @focusout=${this.onToolbarFocusOut}
      @keydown=${this.onToolbarKeyDown}
    >
      ${this.actions.map(
        (action) => html`<lr-button
          part=${this.actionPartNames(action)}
          data-action=${action}
          size="xs"
          appearance="plain"
          @click=${() => void this.activate(action)}
          >${this.actionLabel(action)}</lr-button
        >`
      )}<slot name="actions" @slotchange=${this.onActionsSlotChange}></slot>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lr-selection-toolbar": LyraSelectionToolbar;
  }
}
