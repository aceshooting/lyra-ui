import { html, nothing, type TemplateResult, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { resolveCssLength } from "../../../internal/css-length.js";
import { LyraElement } from "../../../internal/lyra-element.js";
import { literalSetConverter } from "../../../internal/converters.js";
import {
  activateOverlay,
  deepActiveElement,
  type OverlayHandle,
} from "../../../internal/overlay-manager.js";
import { styles } from "./responsive-panel.styles.js";
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_responsivePanel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6, [role="heading"]';
const DEFAULT_OVERLAY_BREAKPOINT = "768px";

/** The `mode` property's literal value -- `'auto'` tracks the allocation
 * breakpoint live; `'inline'`/`'overlay'` force that presentation. */
export type LyraResponsivePanelMode = "inline" | "overlay" | "auto";

const RESPONSIVE_PANEL_MODE = literalSetConverter<LyraResponsivePanelMode>(
  ["inline", "overlay", "auto"],
  "auto"
);

/** What `mode` actually resolves to once the breakpoint is taken into
 *  account -- `'auto'` never appears here. */
export type LyraResponsivePanelEffectiveMode = "inline" | "overlay";

export type LyraResponsivePanelVariant = "fullscreen" | "bottom-sheet";

/** Reason the panel was closed, forwarded as the `lr-close` event detail --
 *  mirrors lr-dialog's own `DialogCloseReason` shape. `'escape'` and
 *  `'backdrop'` are emitted by the overlay presentation's own built-in
 *  dismiss triggers (they can't occur while inline, since there's no
 *  backdrop/document-keydown trap wired up then); any other string is
 *  whatever a caller passes to `close()`. */
export type LyraResponsivePanelCloseReason =
  | "escape"
  | "backdrop"
  | "api"
  | (string & Record<never, never>);

export interface LyraResponsivePanelModeChangeDetail {
  mode: LyraResponsivePanelEffectiveMode;
}

export interface LyraResponsivePanelEventMap {
  "lr-close": CustomEvent<LyraResponsivePanelCloseReason>;
  "lr-mode-change": CustomEvent<LyraResponsivePanelModeChangeDetail>;
}

/**
 * Pure resolution of the `mode` prop + current viewport into the actual
 * presentation. Kept separate from the allocation observer wiring below so
 * it's independently unit-testable, and so the live allocation-response logic
 * can be exercised in tests by calling it (or the instance method that wraps
 * it) directly instead of needing control over the real browser window,
 * which `@web/test-runner` doesn't give.
 */
export function resolveResponsivePanelEffectiveMode(
  mode: LyraResponsivePanelMode,
  belowBreakpoint: boolean
): LyraResponsivePanelEffectiveMode {
  if (mode === "inline" || mode === "overlay") return mode;
  return belowBreakpoint ? "overlay" : "inline";
}

/**
 * `<lr-responsive-panel>` — the same slotted content either docked inline
 * in the page's normal layout flow (desktop) or presented as a full-screen/
 * bottom-sheet overlay, depending on its allocated inline size. Typical uses:
 * a settings panel or a conversation-history sidebar that's a permanent
 * docked pane on a wide screen but a modal on a phone.
 *
 * Breakpoint detection observes this component and compares its allocation with
 * `overlayBreakpoint`. Resizing a containing layout across the breakpoint while
 * `mode="auto"` (the default) updates the
 * effective presentation without unmounting or re-creating the slotted
 * content: inline and overlay presentation share the exact same shadow DOM
 * structure (only a css class, and the overlay-only `role`/`aria-modal`
 * attributes and backdrop element, differ), so lit-html's diffing keeps
 * `[part="body"]` and its `<slot>` as the same DOM node across the
 * transition -- scroll position and focus inside the slotted content survive
 * it for free. When an open inline panel becomes modal, focus already inside
 * is preserved and outside focus moves to the first available target. Closing
 * still returns to the opener captured by the original inline open.
 *
 * The overlay presentation uses the library's shared overlay coordinator for
 * focus trapping, Escape/backdrop dismissal, inerting, and stack ordering,
 * while retaining this component's own responsive rendering and close event.
 *
 * Accessible name (overlay presentation only -- the inline presentation has
 * no dialog semantics to name), in priority order: if the host element itself
 * has an `aria-label` attribute set, its value wins outright, overriding
 * every source below -- the standard ARIA convention for a consumer that
 * wants full control over the announced name, matching lr-dialog's
 * `accessibleLabel` pattern. Otherwise `label`, when set, is used verbatim.
 * When both are empty, this falls back to the `header` slot's content -- a
 * heading element (`h1`–`h6` or `[role="heading"]`) among the slotted header
 * content wins if present, otherwise the header slot's full text content is
 * used, mirroring lr-dialog's `detectHeading()`/`headingText` fallback (see
 * dialog.ts's module doc for why this uses `aria-label`, a copied string,
 * rather than `aria-labelledby`: the header content is light DOM while
 * `[part="panel"]` lives in this element's shadow tree, and an ID-reference
 * attribute can't resolve across that boundary). A panel opened without a
 * host `aria-label`, `label`, or header content receives the localized
 * `responsivePanel` fallback, so every overlay dialog remains named.
 *
 * @customElement lr-responsive-panel
 * @slot - The panel body.
 * @slot header - Optional header content, rendered above the body.
 * @slot footer - Optional footer content (e.g. action buttons), rendered below the body.
 * @event lr-close - `detail: LyraResponsivePanelCloseReason`. Cancelable pre-close veto, fired by
 *   the overlay presentation's built-in dismiss triggers (Escape, backdrop click) and by any
 *   `close()` call, in either presentation. Calling `preventDefault()` keeps the panel open and
 *   leaves any active overlay chrome/focus trap intact. A plain `open = false` property write
 *   does not fire it (matching lr-dialog's own precedent: only going through `close()` counts as
 *   a dismissal), and this is deliberately the same event/semantics in both presentations,
 *   rather than only being meaningful for the overlay case, so a consumer only has to wire up one
 *   listener regardless of which presentation is currently active.
 * @event lr-mode-change - `detail: LyraResponsivePanelModeChangeDetail`. Fired whenever the
 *   *effective* mode (not the `mode` prop's literal value, which may be `'auto'`) changes between
 *   `'inline'` and `'overlay'` -- crossing the breakpoint while `mode="auto"`, or the host
 *   reassigning `mode` to a value that changes the effective presentation. Never fired for the
 *   initial render, only for a live change thereafter.
 * @csspart base - The root wrapper; `display: none` while closed, positioned `fixed` while open
 *   and in the overlay presentation.
 * @csspart backdrop - The full-viewport scrim behind the panel -- only rendered in the overlay
 *   presentation.
 * @csspart panel - The panel surface itself (`role="dialog"` while open and in the overlay
 *   presentation).
 * @csspart header - The wrapper around the `header` slot.
 * @csspart body - The wrapper around the default slot.
 * @csspart footer - The wrapper around the `footer` slot.
 * Overlay state properties are resolved as inline fallbacks, so setting one on a panel or any
 * ancestor themes the overlay without changing docked panel chrome or shared tokens.
 * @cssprop [--lr-responsive-panel-overlay-color=var(--lr-color-overlay)] - The overlay
 *   presentation's scrim color, applied to `[part="backdrop"]`.
 * @cssprop [--lr-responsive-panel-overlay-panel-bg=var(--lr-color-surface-overlay)] - Background
 *   of `[part="panel"]` in the overlay presentation.
 * @cssprop [--lr-responsive-panel-overlay-panel-shadow=var(--lr-shadow-l)] - Shadow of
 *   `[part="panel"]` in the overlay presentation.
 * @cssprop [--lr-responsive-panel-sheet-max-block-size=85dvh] - Maximum height of the
 *   `variant="bottom-sheet"` overlay panel (falls back to `85vh` where `dvh` is unsupported).
 * @status stable
 * @since 4.0.0
 */
export class LyraResponsivePanel extends LyraElement<LyraResponsivePanelEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    responsivePanel: LYRA_DEFAULT_responsivePanel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Whether the panel is open. In the inline presentation this just means visible/mounted; in
   *  the overlay presentation this is the actual modal open/closed state. */
  @property({ type: Boolean, reflect: true }) open = false;

  /** `'auto'` (default) tracks `overlay-breakpoint` against this element's allocation;
   * `'inline'`/`'overlay'` force that presentation. */
  private _mode: LyraResponsivePanelMode = "auto";

  @property({ reflect: true, converter: RESPONSIVE_PANEL_MODE })
  get mode(): LyraResponsivePanelMode {
    return this._mode;
  }
  set mode(next: LyraResponsivePanelMode) {
    const normalized = RESPONSIVE_PANEL_MODE.normalizeReflected(
      this,
      "mode",
      next
    );
    const old = this._mode;
    if (old === normalized) return;
    this._mode = normalized;
    this.requestUpdate("mode", old);
  }

  /** Only affects the overlay presentation's visual treatment -- `'fullscreen'` (default) covers
   *  the whole viewport; `'bottom-sheet'` anchors to the block-end edge and doesn't cover the full
   *  height. No entrance motion is implied by the variant. */
  @property({ reflect: true }) variant: LyraResponsivePanelVariant = "fullscreen";

  /** Accessible name for the overlay presentation's `role="dialog"`. Unused in the inline
   *  presentation, which has no dialog semantics to name. When empty, falls back to the `header`
   *  slot's content -- see the class doc for the full fallback order. */
  @property() label = "";

  /** CSS length compared with this element's allocated inline size in `mode="auto"`.
   * At or below the breakpoint, the effective presentation is `'overlay'`. */
  @property({ attribute: "overlay-breakpoint" }) overlayBreakpoint = DEFAULT_OVERLAY_BREAKPOINT;

  /** Host-level `aria-label` override for the overlay presentation's accessible name -- wins over
   *  every other source (`label`, the header-slot fallback), matching `<lr-dialog>`'s
   *  `accessibleLabel` pattern. See the class doc for the full precedence order. Set as a plain
   *  `aria-label` attribute on `<lr-responsive-panel>` itself, not a public JS property. */
  @property({ attribute: "aria-label" }) private accessibleLabel:
    | string
    | null = null;

  @state() private belowBreakpoint = false;
  @state() private resolvedMode: LyraResponsivePanelEffectiveMode = "inline";
  @state() private hasHeaderSlot = false;
  @state() private hasFooterSlot = false;
  /** Fallback accessible name sourced from the `header` slot's content -- see `detectHeadingText()`. */
  @state() private headingText?: string;

  private resizeObserver?: ResizeObserver;
  private resizeView?: Window;
  private lastTrigger?: HTMLElement;
  private overlayHandle?: OverlayHandle;
  private headerObserver?: MutationObserver;
  private headerObserverDocument?: Document;
  private headerObserverGeneration = 0;
  private ownerRealmGeneration = 0;
  /** Whether the overlay-only mechanics (scroll-lock and shared overlay registration) are currently
   *  engaged -- derived from `effectiveMode === 'overlay' && open`, tracked separately from those
   *  two properties so willUpdate can diff "was engaged" vs "should be engaged now" regardless of
   *  which of the two changed. */
  private overlayChromeActive = false;
  private focusOverlayAfterUpdate = false;
  private isFirstUpdate = true;

  /** The currently resolved presentation. Composition/measurement is the sole write authority. */
  get effectiveMode(): LyraResponsivePanelEffectiveMode {
    return this.resolvedMode;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.isFirstUpdate = !this.hasUpdated;
    if (this.isFirstUpdate) {
      this.hasHeaderSlot = Array.from(this.children).some(
        (el) => el.getAttribute("slot") === "header"
      );
      this.hasFooterSlot = Array.from(this.children).some(
        (el) => el.getAttribute("slot") === "footer"
      );
      this.headingText = this.detectHeadingText();
    }
    if (!this.isFirstUpdate && changed.has("overlayBreakpoint") && this.isConnected) {
      this.measureAllocation();
    }
    if (
      this.isFirstUpdate ||
      changed.has("mode") ||
      changed.has("belowBreakpoint")
    ) {
      this.resolvedMode = resolveResponsivePanelEffectiveMode(
        this.mode,
        this.belowBreakpoint
      );
    }

    // Captured on a genuine open transition only, independent of
    // effectiveMode at that moment -- so it reflects whatever triggered the
    // open even if a later breakpoint crossing (while still open) switches
    // the presentation to overlay before close() runs. Deliberately not
    // folded into the overlayOpen-engage branch below: that branch also
    // fires when only effectiveMode (not open) changes, which would
    // re-capture whatever currently has focus (e.g. something inside the
    // panel) instead of the original external trigger.
    if (changed.has("open") && this.open) {
      const active = deepActiveElement(this.ownerDocument);
      this.lastTrigger =
        active && typeof (active as HTMLElement).focus === "function"
          ? (active as HTMLElement)
          : undefined;
    }

    const overlayOpen = this.resolvedMode === "overlay" && this.open;
    if (overlayOpen !== this.overlayChromeActive) {
      this.overlayChromeActive = overlayOpen;
      if (overlayOpen) {
        this.activateOverlayChrome();
        // Once the presentation becomes modal, focus cannot remain behind
        // it. The manager preserves focus that is already inside the panel
        // and otherwise moves it to the first composed focus target.
        this.focusOverlayAfterUpdate = true;
      } else {
        // Removing modal chrome while the still-open panel becomes inline
        // must preserve focus in that same panel. Only a real open -> closed
        // transition restores the opener.
        this.deactivateOverlayChrome(changed.has("open") && !this.open);
      }
    }
    if (changed.has("open") && !this.open) this.lastTrigger = undefined;
  }

  // Runs after render (not willUpdate) so [part="panel"] has already landed
  // in the DOM before the fallback .focus() call below can rely on it --
  // mirrors lr-dialog's identical ordering rationale.
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (!this.isFirstUpdate && changed.has("resolvedMode")) {
      this.emit("lr-mode-change", {
        mode: this.resolvedMode,
      });
    }
    if (this.focusOverlayAfterUpdate) {
      this.focusOverlayAfterUpdate = false;
      this.overlayHandle?.focusInitial();
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.measureAllocation();
    this.observeAllocation();
    // A reconnect (e.g. a drag-and-drop reparent keeping this same element
    // instance) fires disconnectedCallback then connectedCallback
    // synchronously with no update in between, so willUpdate never reruns to
    // notice overlay chrome is still supposed to be active -- restore it.
    const overlayOpen =
      resolveResponsivePanelEffectiveMode(this.mode, this.belowBreakpoint) === "overlay" &&
      this.open;
    if (this.hasUpdated && overlayOpen) {
      if (this.overlayHandle?.isActive()) {
        this.overlayHandle.resume();
      } else {
        this.activateOverlayChrome();
      }
      this.queueOwnerMicrotask(() => this.overlayHandle?.focusInitial());
    }
    if (this.hasUpdated) {
      this.queueOwnerMicrotask(() => {
        const slot = this.shadowRoot?.querySelector<HTMLSlotElement>(
          'slot[name="header"]'
        );
        if (slot) this.syncHeaderSlot(slot.assignedElements({ flatten: true }));
      });
    }
  }

  override disconnectedCallback(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.resizeView?.removeEventListener("resize", this.onWindowResize);
    this.resizeView = undefined;
    this.overlayHandle?.suspend();
    this.resetOwnerRealmWork();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.resizeView?.removeEventListener("resize", this.onWindowResize);
    this.resizeView = undefined;
    this.resetOwnerRealmWork();
    if (this.isConnected) {
      this.measureAllocation();
      this.observeAllocation();
    }
  }

  private resetOwnerRealmWork(): void {
    this.ownerRealmGeneration += 1;
    this.resetHeaderObserver();
  }

  private queueOwnerMicrotask(callback: VoidFunction): void {
    const ownerDocument = this.ownerDocument;
    const ownerWindow = ownerDocument.defaultView;
    if (!ownerWindow || !this.isConnected) return;
    const generation = this.ownerRealmGeneration;
    ownerWindow.queueMicrotask(() => {
      if (
        this.ownerRealmGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      callback();
    });
  }

  private activateOverlayChrome(): void {
    this.overlayHandle = activateOverlay({
      host: this,
      panel: () =>
        this.shadowRoot?.querySelector<HTMLElement>('[part="panel"]') ?? null,
      onEscape: () => this.close("escape"),
      onBackdrop: () => this.close("backdrop"),
      restoreFocusTo: this.lastTrigger ?? null,
      lockScroll: true,
      suspendWhenUnrendered: true,
    });
  }

  private deactivateOverlayChrome(restoreFocus = true): void {
    this.overlayHandle?.deactivate({ restoreFocus });
    this.overlayHandle = undefined;
  }

  private observeAllocation(): void {
    if (!this.isConnected) return;
    this.resizeView?.removeEventListener("resize", this.onWindowResize);
    this.resizeView = undefined;
    const view = this.ownerDocument.defaultView;
    const ResizeObserverConstructor = view?.ResizeObserver;
    if (ResizeObserverConstructor) {
      this.resizeObserver ??= new ResizeObserverConstructor((entries) => {
        const entry = entries.find((candidate) => candidate.target === this) ?? entries[0];
        const inlineSize = entry?.contentBoxSize?.[0]?.inlineSize ?? entry?.contentRect.width;
        if (inlineSize !== undefined) {
          // A mode flip can change fixed/flow descendants. Commit after the ResizeObserver
          // delivery checkpoint so Chromium never reports a loop merely because presentation
          // chrome changed during observation.
          this.queueOwnerMicrotask(() => this.applyMeasuredInlineSize(inlineSize));
        }
      });
      this.resizeObserver.observe(this);
      return;
    }
    if (view) {
      this.resizeView = view;
      view.addEventListener("resize", this.onWindowResize);
    }
  }

  private readonly onWindowResize = (): void => this.measureAllocation();

  private measureAllocation(): void {
    const inlineSize = this.getBoundingClientRect().width;
    if (inlineSize > 0) this.applyMeasuredInlineSize(inlineSize);
  }

  /** Applies an authoritative allocation measurement. Kept separate from observer delivery for
   * deterministic tests and reconnect/adoption reconciliation. */
  private applyMeasuredInlineSize(inlineSize: number): void {
    if (!Number.isFinite(inlineSize) || inlineSize < 0) return;
    const resolved = resolveCssLength(this.overlayBreakpoint, { host: this });
    const fallback = resolveCssLength(DEFAULT_OVERLAY_BREAKPOINT, { host: this }) ?? 768;
    const breakpoint = Math.max(
      0,
      resolved !== undefined && Number.isFinite(resolved) ? resolved : fallback
    );
    this.belowBreakpoint = inlineSize <= breakpoint;
  }

  private onHeaderSlotChange = (e: Event): void => {
    this.syncHeaderSlot(
      (e.target as HTMLSlotElement).assignedElements({ flatten: true })
    );
  };

  private syncHeaderSlot(assigned: Element[]): void {
    this.hasHeaderSlot = assigned.length > 0;
    this.headingText = this.detectHeadingText();
    this.resetHeaderObserver();
    if (assigned.length === 0 || !this.isConnected) return;
    const ownerDocument = this.ownerDocument;
    const MutationObserverCtor = ownerDocument.defaultView?.MutationObserver;
    if (!MutationObserverCtor) return;
    const generation = this.headerObserverGeneration;
    const observer = new MutationObserverCtor(() => {
      if (
        this.headerObserver !== observer ||
        this.headerObserverDocument !== ownerDocument ||
        this.headerObserverGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      this.headingText = this.detectHeadingText();
    });
    this.headerObserver = observer;
    this.headerObserverDocument = ownerDocument;
    for (const element of assigned) {
      observer.observe(element, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    }
  }

  private resetHeaderObserver(): void {
    this.headerObserverGeneration += 1;
    this.headerObserver?.disconnect();
    this.headerObserver = undefined;
    this.headerObserverDocument = undefined;
  }

  private onFooterSlotChange = (e: Event): void => {
    this.hasFooterSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };

  // Only direct children slotted into `header` are scanned -- same depth
  // limit lr-dialog's own detectHeading() applies to its direct children.
  // A heading tag among them wins (its own text only, so a header slot mixing
  // a heading with e.g. a trailing icon button doesn't pull the button's
  // label into the accessible name); otherwise the header slot's combined
  // text stands in for it, since this component (unlike lr-dialog) has a
  // dedicated header slot that's already the conventional place a heading
  // would go. Recomputed only on slot assignment changes, not on every
  // render -- same rationale as lr-dialog's detectHeading().
  private detectHeadingText(): string | undefined {
    const headerChildren = Array.from(this.children).filter(
      (el) => el.getAttribute("slot") === "header"
    );
    if (headerChildren.length === 0) return undefined;
    const heading = headerChildren.find((el) => el.matches(HEADING_SELECTOR));
    if (heading) return heading.textContent?.trim() || undefined;
    return (
      headerChildren
        .map((el) => el.textContent?.trim())
        .filter(Boolean)
        .join(" ") || undefined
    );
  }

  /**
   * Close the panel. `reason` is forwarded as the `lr-close` detail --
   * built-in overlay triggers pass `'escape'`/`'backdrop'`; a consumer's own
   * close affordance (e.g. a footer button, or a docked panel's own toggle)
   * should call this directly with its own reason string. `lr-close` is a
   * cancelable, pre-mutation veto point: a listener calling
   * `preventDefault()` leaves the panel and any active overlay chrome open.
   * It fires in both presentations (see the class doc's `lr-close` note) but
   * only returns focus to the trigger that opened it when the overlay
   * presentation is active, since the inline presentation never took focus
   * away from anything to begin with.
   */
  close(reason: LyraResponsivePanelCloseReason = "api"): void {
    if (!this.open) return;
    if (this.emit("lr-close", reason, { cancelable: true }).defaultPrevented) {
      return;
    }
    this.open = false;
  }

  private onBackdropClick = (): void => {
    this.overlayHandle?.dismissBackdrop();
  };

  override render(): TemplateResult {
    const overlay = this.effectiveMode === "overlay";
    const accessibleName =
      this.accessibleLabel ?? (this.label || this.headingText || this.localize("responsivePanel"));
    return html`
      <div part="base" class=${overlay ? "overlay" : "inline"}>
        ${overlay
          ? html`<div part="backdrop" @click=${this.onBackdropClick}></div>`
          : nothing}
        <div
          part="panel"
          role=${overlay ? "dialog" : nothing}
          aria-modal=${overlay ? "true" : nothing}
          aria-label=${overlay ? accessibleName : nothing}
          tabindex=${overlay ? "-1" : nothing}
        >
          <div part="header" ?hidden=${!this.hasHeaderSlot}>
            <slot name="header" @slotchange=${this.onHeaderSlotChange}></slot>
          </div>
          <div part="body">
            <slot></slot>
          </div>
          <div part="footer" ?hidden=${!this.hasFooterSlot}>
            <slot name="footer" @slotchange=${this.onFooterSlotChange}></slot>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lr-responsive-panel": LyraResponsivePanel;
  }
}
