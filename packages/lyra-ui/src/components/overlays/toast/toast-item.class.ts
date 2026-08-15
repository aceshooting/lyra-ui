import { html, type TemplateResult, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { keyed } from "lit/directives/keyed.js";
import { composedParentElement } from "../../../internal/a11y.js";
import { composedAccessibilityTextResult } from "../../../internal/accessibility-visibility.js";
import {
  acquireAnnouncementSink,
  type AnnouncementSink,
} from "../../../internal/announcer.js";
import { LyraElement } from "../../../internal/lyra-element.js";
import { closeIcon } from "../../../internal/icons.js";
import { getSegmenter } from "../../../internal/intl-cache.js";
import { prefersReducedMotion } from "../../../internal/motion.js";
import { finiteDuration } from "../../../internal/numbers.js";
import {
  composedContains,
  deepActiveElement,
} from "../../../internal/overlay-manager.js";
import {
  applyComposedFocusRepair,
  captureComposedFocusRepair,
  isActionableElement,
  type ComposedFocusRepairSnapshot,
} from "../../../internal/focus-navigation.js";
import { tag } from "../../../internal/prefix.js";
import {
  normalizeSize,
  type LyraSize,
  type LyraSizeStep,
  type LyraVariant,
} from "../../../internal/variants.js";
import { variants } from "../../../internal/variants.styles.js";
import { styles } from "./toast-item.styles.js";
import {
  TOAST_REGION_ENQUEUE,
  TOAST_REGION_EVICT,
  TOAST_REGION_REJECT,
  TOAST_REGION_SET_ACTIVE,
  toastRegionControllerFor,
  type ToastRegionController,
} from "./toast-region-protocol.js";
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from "../../../internal/localization.js";
import {
  LYRA_DEFAULT_close,
  LYRA_DEFAULT_closeWithContext,
  LYRA_DEFAULT_closeWithTruncatedContext,
  LYRA_DEFAULT_toastContentIncomplete,
} from "../../../internal/default-strings.generated.js";
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** The library's one semantic-tone vocabulary. */
export type ToastVariant = LyraVariant;
/** The library's one size ladder. */
export type ToastSize = LyraSize;

function parseTime(value: string): number {
  const trimmed = value.trim();
  if (trimmed.endsWith("ms")) return Number.parseFloat(trimmed);
  if (trimmed.endsWith("s")) return Number.parseFloat(trimmed) * 1000;
  return 0;
}

function maxCssTime(value: string): number {
  return Math.max(
    0,
    ...value.split(",").map(parseTime).filter(Number.isFinite)
  );
}

const CLOSE_LABEL_GRAPHEME_LIMIT = 40;

function isAssertiveVariant(variant: ToastVariant): boolean {
  return variant === "danger" || variant === "warning";
}

function truncateGraphemes(
  value: string,
  limit: number,
  locale: string
): { snippet: string; truncated: boolean } {
  // A code-point fallback would split combining and ZWJ graphemes. Keep the complete label on
  // legacy engines instead of manufacturing a broken close-name context.
  if (typeof Intl.Segmenter !== "function")
    return { snippet: value, truncated: false };
  let graphemes: string[];
  try {
    graphemes = [
      ...getSegmenter(locale, { granularity: "grapheme" }).segment(value),
    ].map(({ segment }) => segment);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    graphemes = [
      ...getSegmenter(undefined, { granularity: "grapheme" }).segment(value),
    ].map(({ segment }) => segment);
  }
  return graphemes.length > limit
    ? { snippet: graphemes.slice(0, limit).join(""), truncated: true }
    : { snippet: value, truncated: false };
}

export interface LyraToastItemEventMap {
  "lr-show": CustomEvent<null>;
  "lr-after-show": CustomEvent<null>;
  "lr-hide": CustomEvent<null>;
  "lr-after-hide": CustomEvent<null>;
}
/**
 * `<lr-toast-item>` — a single toast notification. Its normalized message is announced through a
 * shared light-DOM sink, leaving the visible close and action controls outside the live subtree.
 * Contextual close names include rich non-interactive message markup and update with its text.
 * Referenced labels and open shadow roots actually traversed for their text remain observed outside
 * the item. Bounded traversal appends an explicit truncation marker to a prefix, or uses a localized
 * incomplete-content fallback when no prefix fits, instead of presenting partial content as whole.
 * When a focused toast finishes hiding, focus moves to an adjacent toast or back to the pre-toast
 * control. An accepted show or hide interrupted by disconnect resumes to one terminal completion
 * if the same item reconnects. Region-owned items beyond the active window stay hidden, inert, and
 * timer-paused until FIFO promotion, including an already-visible standalone item reparented into
 * a full region.
 * Mirrors the Web Awesome `<wa-toast-item>` API under the `lr-` prefix.
 *
 * @customElement lr-toast-item
 * @slot - The message content. Visible non-interactive text, including through forwarding slots,
 * stays synchronized with the close button's contextual accessible name.
 * @slot icon - Optional icon shown at the start.
 * @event lr-show - The item is about to show. Cancelable — `preventDefault()` suppresses and
 *   releases the toast without starting its auto-dismiss timer.
 * @event lr-after-show - Fired after the show animation completes.
 * @event lr-hide - The item is about to hide, including an auto-dismiss expiry. Cancelable —
 *   `preventDefault()` leaves it visible. A vetoed auto-dismiss restarts the full current
 *   normalized duration; a vetoed manual `hide()` leaves any active countdown untouched.
 * @event lr-after-hide - Fired after the hide animation completes (item then removes itself).
 * @csspart toast-item - The outer container.
 * @csspart accent - The colored accent bar.
 * @csspart icon - The icon wrapper.
 * @csspart content - The message wrapper.
 * @csspart close-button - The dismiss button.
 * @csspart close-icon - The close glyph wrapper.
 * @csspart close-icon__svg - The close glyph's SVG element.
 * @csspart progress-ring - The auto-dismiss progress ring around the close glyph.
 * @csspart progress-ring__base - The progress ring's SVG element.
 * @csspart progress-ring__indicator - The elapsed-time indicator circle.
 * @csspart progress-ring__label - The ring's centered close-glyph container.
 * @csspart progress-ring__track - The progress ring's background circle.
 * @cssprop --accent-width - Mapped alias for `--lr-toast-accent-width`.
 * @cssprop --hide-duration - Mapped alias for `--lr-toast-hide-duration`.
 * @cssprop --padding - Mapped alias for `--lr-toast-padding`.
 * @cssprop --show-duration - Mapped alias for `--lr-toast-show-duration`.
 * @cssprop [--lr-toast-accent-width=var(--lr-size-4px)] - Width of the accent bar, and the extra
 *   inline-start padding reserved for it.
 * @cssprop [--lr-toast-accent-color=var(--lr-color-border)] - Color of the accent bar and the icon.
 *   Each non-neutral `variant` sets it to that variant's loud fill from the shared semantic grid;
 *   `neutral` keeps the plain border color, so an informational toast reads as unaccented.
 * @cssprop [--lr-toast-padding=var(--lr-space-m)] - Padding of the item. Its private default follows
 *   `size` across the shared six-step ladder; an inherited or direct public value wins.
 * @cssprop [--lr-toast-font-size=var(--lr-font-size-m)] - Font size of the item. Its private default
 *   follows `size` across the shared six-step ladder; an inherited or direct public value wins.
 * @cssprop [--lr-toast-item-gap=var(--lr-space-s)] - Gap between the item icon, message, and close
 *   button. Unlike `--lr-toast-gap`, this does not affect spacing between stacked items.
 * @cssprop [--lr-toast-item-radius=var(--lr-radius)] - Corner radius of the item surface and its
 *   accent bar's inline-start corners.
 * Pointer-state hooks are inline fallbacks, so they inherit from the item or an ancestor without
 * recoloring the item surface or the stack.
 * @cssprop [--lr-toast-close-button-hover-bg=transparent] - Background of the enabled close button
 *   while hovered.
 * @cssprop [--lr-toast-close-button-hover-color=var(--lr-color-text)] - Foreground of the enabled
 *   close button while hovered.
 * @cssprop [--lr-toast-close-button-active-bg=color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-active))] - Background of the enabled close button
 *   while pressed.
 * @cssprop [--lr-toast-close-button-active-color=var(--lr-color-text)] - Foreground of the enabled
 *   close button while pressed.
 * @cssprop [--lr-toast-show-duration=var(--lr-transition-base, 180ms ease-out)] - Opacity/transform
 *   transition used while showing.
 * @cssprop [--lr-toast-hide-duration=var(--lr-transition-base, 180ms ease-out)] - Opacity/transform
 *   transition used while hiding.
 * @status stable
 * @since 4.0.0
 */
export class LyraToastItem extends LyraElement<LyraToastItemEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> =
    {
      ...super.defaultStrings,
      close: LYRA_DEFAULT_close,
      closeWithContext: LYRA_DEFAULT_closeWithContext,
      closeWithTruncatedContext: LYRA_DEFAULT_closeWithTruncatedContext,
      toastContentIncomplete: LYRA_DEFAULT_toastContentIncomplete,
    };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, variants, styles];

  /** Live visible toast surface, or `null` before the render root is populated. */
  get toastItemElement(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('[part="toast-item"]');
  }

  /** Auto-dismiss delay in ms. Set to `Infinity` (or <= 0) to disable. */
  @property({ type: Number }) duration = 5000;

  /** Visual size. Valid upstream `small`/`medium`/`large` values round-trip verbatim while the CSS
   * maps both spellings onto the same rendered ladder. */
  @property({ reflect: true }) size: ToastSize = "m";
  private get effectiveSize(): LyraSizeStep {
    const value = this.size as string;
    if (
      !["2xs", "xs", "s", "m", "l", "xl", "small", "medium", "large"].includes(
        value
      )
    )
      return "m";
    return normalizeSize(value as LyraSize);
  }

  /** Severity/variant. */
  @property({ reflect: true }) variant: ToastVariant = "neutral";

  /** Show the icon slot. */
  @property({ type: Boolean, attribute: "with-icon" }) withIcon = false;

  private timer?: number;
  private timerOwner?: Window;
  private elapsedMs = 0;
  private startedAt = 0;
  private timerStarted = false;
  private showRafId?: number;
  private showRafOwner?: Window;
  private showGeneration = 0;
  private showCompletionGeneration = 0;
  private showCompletionRunning = false;
  private showAccepted = false;
  private afterShowEmitted = false;
  private regionOwner?: ToastRegionController;
  private admitted = false;
  private requestingRegionAdmission = false;
  private cancelShowAnimation?: () => void;
  private cancelHideAnimation?: () => void;
  private hovering = false;
  private focused = false;
  private pendingFocusRepair?: ComposedFocusRepairSnapshot;
  private focusReturnTarget?: HTMLElement;
  private messageObserver?: MutationObserver;
  private politeSink?: AnnouncementSink;
  private assertiveSink?: AnnouncementSink;
  private lastAnnouncedMessage = "";
  private readonly onMessageSlotChange = (event: Event): void => {
    const target = event.target as Element | null;
    if (target?.nodeType !== 1 || target.localName !== "slot") return;
    this.bindMessageObserverTargets();
    this.recomputeMessageText();
  };
  private hideCompletionRunning = false;
  private hideGeneration = 0;
  private afterHideEmitted = false;
  private hideRequest?: Promise<void>;
  @state() private messageText = "";
  @state() private messageTextTruncated = false;
  @state() private hiding = false;
  @state() private progressRun = 0;
  @state() private surfaceMounted = false;
  @state() private interactionReady = false;

  /** `duration` normalized to a finite, non-negative delay -- *or* `Infinity` verbatim.
   *  `Infinity` is this property's own documented "never auto-dismiss" sentinel (see its doc
   *  comment above), so it must not be coerced into a large-but-finite fallback by
   *  `finiteDuration`'s clamp; only a genuinely invalid raw value (`NaN`, `-Infinity`) falls back
   *  to the constructed default. A finite negative value clamps to `0`, which already means
   *  "disable" per this property's own contract (see `resumeTimer()` below), so that's not a
   *  behavior change either. */
  private get safeDuration(): number {
    return this.duration === Infinity
      ? Infinity
      : finiteDuration(this.duration, 5000, 0);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.setAttribute("data-effective-size", this.effectiveSize);
    // `elapsedMs`/`duration` are re-read fresh every time the timer is
    // (re)scheduled, so a `duration` change while paused (hovering/focused)
    // or before the timer has ever started needs no action here -- the next
    // resumeTimer()/startTimer() call already picks up the new value.
    // Re-evaluate on any duration change once the show sequence has started,
    // not only while a timer is already actively counting down -- this also
    // covers duration flipping from disabled (0/Infinity) back to a positive
    // value, which previously never had `this.timer !== undefined` to gate on.
    //
    // This runs in willUpdate() (before render), not updated(), because a
    // duration shortened below the already-elapsed time makes resumeTimer()
    // call hide(), which sets the `hiding` state property synchronously --
    // doing that from updated() sets a reactive property after Lit considers
    // the update cycle finished, scheduling a redundant extra render pass.
    // willUpdate() runs before that cycle is considered complete, so the same
    // set just folds into the render already in progress.
    if (
      changed.has("duration") &&
      this.timerStarted &&
      this.admitted &&
      this.hasAttribute("data-visible") &&
      !this.hovering &&
      !this.focused
    ) {
      this.pauseTimer();
      this.resumeTimer();
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.hasAttribute("data-visible")) {
      const previousVariant = changed.get("variant") as
        | ToastVariant
        | undefined;
      const urgencyChanged =
        changed.has("variant") &&
        isAssertiveVariant(this.variant) !==
          isAssertiveVariant(previousVariant ?? "neutral");
      if (urgencyChanged) {
        // Preserve the prior urgency contract when a displayed toast changes
        // severity, but announce only the normalized message rather than the
        // visible controls that share this host.
        this.announceMessage(true);
      } else if (
        changed.has("messageText") ||
        changed.has("messageTextTruncated")
      ) {
        this.announceMessage();
      }
    }
    this.shadowRoot
      ?.querySelector<SVGElement>('[part~="close-icon"] svg')
      ?.setAttribute("part", "close-icon__svg");
  }

  override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.requestRegionAdmission();
    if (this.admitted) this.scheduleShow();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.politeSink ??= acquireAnnouncementSink("polite", {
      document: this.ownerDocument,
      source: this,
    });
    this.assertiveSink ??= acquireAnnouncementSink("assertive", {
      document: this.ownerDocument,
      source: this,
    });
    const MutationObserverCtor =
      this.ownerDocument.defaultView?.MutationObserver;
    this.messageObserver = MutationObserverCtor
      ? new MutationObserverCtor(() => {
          this.bindMessageObserverTargets();
          this.recomputeMessageText();
        })
      : undefined;
    this.addEventListener("slotchange", this.onMessageSlotChange);
    this.bindMessageObserverTargets();
    if (this.hasUpdated) this.recomputeMessageText();
    else this.seedFirstRenderState(() => this.recomputeMessageText());
    this.requestRegionAdmission();
    if (!this.hasUpdated) return;
    if (this.hiding) {
      void this.completeHide();
      return;
    }
    if (!this.hasAttribute("data-visible") && this.admitted) {
      this.scheduleShow();
    } else if (
      this.admitted &&
      this.timerStarted &&
      !this.hovering &&
      !this.focused
    ) {
      void this.completeShow();
      this.resumeTimer();
    }
  }

  private requestRegionAdmission(): void {
    const controller = toastRegionControllerFor(this);
    if (controller) {
      this.requestingRegionAdmission = true;
      try {
        controller[TOAST_REGION_ENQUEUE](this);
      } finally {
        this.requestingRegionAdmission = false;
      }
      return;
    }
    const parent = this.parentElement;
    if (parent?.localName === tag("toast")) {
      this.regionOwner = undefined;
      this.admitted = false;
      this.setAttribute("data-toast-queued", "");
      this.cancelPendingShow();
      this.pauseTimer();
      this.setSurfaceAvailability(false);
      const releaseUnavailableOwner = (): void => {
        if (this.parentElement === parent && !toastRegionControllerFor(this))
          this.remove();
      };
      const view = this.ownerDocument.defaultView;
      if (view) view.queueMicrotask(releaseUnavailableOwner);
      else queueMicrotask(releaseUnavailableOwner);
      return;
    }
    this.regionOwner = undefined;
    this.admitted = true;
    this.removeAttribute("data-toast-queued");
    if (this.hasAttribute("data-visible")) {
      this.setSurfaceAvailability(true);
      if (this.pendingFocusRepair) {
        applyComposedFocusRepair(this.pendingFocusRepair);
        this.pendingFocusRepair = undefined;
      }
    }
  }

  /** @internal */
  [TOAST_REGION_SET_ACTIVE](owner: HTMLElement, active: boolean): void {
    if (this.parentElement !== owner) return;
    this.regionOwner = owner as ToastRegionController;
    this.admitted = active;
    this.toggleAttribute("data-toast-queued", !active);
    if (!active) {
      const focusTarget = this.adjacentToastOrReturnTarget();
      const activeElement = deepActiveElement(this.ownerDocument);
      const repair =
        this.pendingFocusRepair ??
        (activeElement &&
        typeof (activeElement as HTMLElement).focus === "function"
          ? captureComposedFocusRepair(this, focusTarget)
          : null);
      this.cancelPendingShow();
      this.pauseTimer();
      this.setSurfaceAvailability(false);
      if (repair) applyComposedFocusRepair(repair, focusTarget);
      this.pendingFocusRepair = undefined;
      return;
    }
    if (this.hasAttribute("data-visible") && !this.hiding) {
      this.setSurfaceAvailability(true);
      if (this.pendingFocusRepair) {
        applyComposedFocusRepair(this.pendingFocusRepair);
        this.pendingFocusRepair = undefined;
      }
      if (
        !this.requestingRegionAdmission &&
        this.timerStarted &&
        !this.hovering &&
        !this.focused
      ) {
        this.resumeTimer();
      }
      void this.completeShow();
      return;
    }
    if (
      this.isConnected &&
      this.hasUpdated &&
      !this.hiding &&
      !this.hasAttribute("data-visible")
    ) {
      this.scheduleShow();
    }
  }

  /** @internal */
  [TOAST_REGION_EVICT](
    owner: HTMLElement,
    _reason: "overflow" | "rejected"
  ): void {
    if (this.regionOwner !== owner) return;
    this.regionOwner = undefined;
    this.admitted = false;
    this.cancelPendingShow();
    this.showAccepted = false;
    this.pauseTimer();
    this.setSurfaceAvailability(false);
    if (this.parentElement === owner) this.remove();
  }

  private setSurfaceAvailability(available: boolean): void {
    this.surfaceMounted = available;
    this.interactionReady = available;
    const surface = this.shadowRoot?.querySelector<HTMLElement>(
      '[part="toast-item"]'
    );
    if (!surface) return;
    surface.hidden = !available;
    surface.inert = !available;
  }

  private cancelPendingShow(): void {
    this.showGeneration += 1;
    if (this.showAccepted && !this.afterShowEmitted)
      this.showCompletionGeneration += 1;
    if (this.showRafId !== undefined) {
      this.showRafOwner?.cancelAnimationFrame(this.showRafId);
      this.showRafId = undefined;
      this.showRafOwner = undefined;
    }
    this.cancelShowAnimation?.();
    this.cancelShowAnimation = undefined;
  }

  private scheduleShow(): void {
    if (this.showRafId !== undefined || this.hiding || !this.admitted) return;
    const view = this.ownerDocument.defaultView;
    if (!view) return;
    const generation = ++this.showGeneration;
    this.showRafOwner = view;
    this.showRafId = view.requestAnimationFrame(() => {
      this.showRafId = undefined;
      this.showRafOwner = undefined;
      // hide() may have already run synchronously before this frame fired
      // (e.g. a caller creates the toast and immediately dismisses it) --
      // don't resurrect the show sequence on top of an already-hiding item.
      if (this.hiding || !this.admitted || generation !== this.showGeneration)
        return;
      void this.prepareShow(generation);
    });
  }

  private async prepareShow(generation: number): Promise<void> {
    await this.updateComplete;
    if (
      generation !== this.showGeneration ||
      !this.isConnected ||
      !this.admitted ||
      this.hiding
    ) {
      return;
    }
    // Keep the surface hidden as well as inert throughout the veto point. Mounting it before event
    // dispatch would expose an opacity-zero box to hit testing, accessibility inspection, and
    // authored layout observers even when the request is rejected.
    if (this.emit("lr-show", null, { cancelable: true }).defaultPrevented) {
      if (generation !== this.showGeneration) return;
      const owner = this.regionOwner;
      if (owner) owner[TOAST_REGION_REJECT](this);
      else this.remove();
      return;
    }
    if (
      generation !== this.showGeneration ||
      !this.isConnected ||
      !this.admitted ||
      this.hiding
    )
      return;
    this.surfaceMounted = true;
    const surface = this.shadowRoot?.querySelector<HTMLElement>(
      '[part="toast-item"]'
    );
    if (surface) {
      // Reactive rendering follows on the next microtask; synchronously release the already-
      // rendered surface after the event so lifecycle listeners observe an atomic commit.
      surface.hidden = false;
      void surface.offsetWidth;
    }
    this.setAttribute("data-visible", "");
    this.interactionReady = true;
    if (surface) surface.inert = false;
    this.announceMessage(true);
    this.showAccepted = true;
    this.afterShowEmitted = false;
    this.showCompletionGeneration += 1;
    void this.completeShow();
    this.startTimer();
  }

  private async completeShow(): Promise<void> {
    if (
      this.showCompletionRunning ||
      !this.showAccepted ||
      this.afterShowEmitted ||
      this.hiding ||
      !this.admitted ||
      !this.hasAttribute("data-visible")
    )
      return;
    this.showCompletionRunning = true;
    const generation = this.showCompletionGeneration;
    await this.waitForVisualCompletion("show");
    this.showCompletionRunning = false;
    if (
      generation !== this.showCompletionGeneration ||
      !this.isConnected ||
      !this.admitted ||
      this.hiding ||
      !this.hasAttribute("data-visible")
    ) {
      if (this.isConnected && this.admitted && !this.hiding)
        void this.completeShow();
      return;
    }
    if (this.afterShowEmitted || !this.showAccepted) return;
    this.afterShowEmitted = true;
    this.showAccepted = false;
    this.emit("lr-after-show");
  }

  override disconnectedCallback(): void {
    const activeElement = deepActiveElement(this.ownerDocument);
    if (
      !this.pendingFocusRepair &&
      !this.hiding &&
      this.hasAttribute("data-visible") &&
      activeElement &&
      typeof (activeElement as HTMLElement).focus === "function"
    ) {
      this.pendingFocusRepair =
        captureComposedFocusRepair(this, activeElement as HTMLElement) ??
        undefined;
    }
    super.disconnectedCallback();
    this.removeEventListener("slotchange", this.onMessageSlotChange);
    this.messageObserver?.disconnect();
    this.messageObserver = undefined;
    this.politeSink?.release();
    this.politeSink = undefined;
    this.assertiveSink?.release();
    this.assertiveSink = undefined;
    if (this.hiding && !this.afterHideEmitted) this.hideGeneration++;
    this.cancelPendingShow();
    this.cancelHideAnimation?.();
    this.cancelHideAnimation = undefined;
    this.pauseTimer();
    this.hovering = false;
    this.focused = false;
    if (!this.hasAttribute("data-visible") && !this.hiding) {
      this.surfaceMounted = false;
      this.interactionReady = false;
    }
  }

  private startTimer(): void {
    this.timerStarted = true;
    this.elapsedMs = 0;
    this.resumeTimer();
  }

  private resumeTimer = (): void => {
    // Guard against an interleaved pointer+focus pause/resume sequence
    // calling resumeTimer() twice without a pauseTimer() in between --
    // without clearing here, the earlier setTimeout is orphaned (not
    // tracked by `this.timer` anymore) and still fires on its own
    // schedule, auto-dismissing the toast early even after it's paused
    // again.
    if (this.timer !== undefined) {
      this.timerOwner?.clearTimeout(this.timer);
      this.timer = undefined;
      this.timerOwner = undefined;
    }
    if (
      !this.isConnected ||
      !this.admitted ||
      this.hiding ||
      !this.hasAttribute("data-visible") ||
      this.hovering ||
      this.focused
    ) {
      return;
    }
    const duration = this.safeDuration;
    if (!isFinite(duration) || duration <= 0) return;
    const remaining = duration - this.elapsedMs;
    // A duration shortened below the already-elapsed time must hide promptly,
    // not silently never schedule anything. It is still a countdown-driven
    // request, so a veto restarts a full duration just like a timeout expiry.
    if (remaining <= 0) {
      void this.requestHide("timer");
      return;
    }
    const view = this.ownerDocument.defaultView;
    if (!view) return;
    this.startedAt = view.performance.now();
    this.timerOwner = view;
    const timer = view.setTimeout(() => {
      // A pause/resume or duration update may have replaced this timeout. Ignore any stale callback
      // that a browser had already queued before clearTimeout() ran.
      if (this.timer !== timer || this.timerOwner !== view) return;
      this.timer = undefined;
      this.timerOwner = undefined;
      void this.requestHide("timer");
    }, remaining);
    this.timer = timer;
  };

  private pauseTimer = (): void => {
    if (this.timer !== undefined) {
      const owner = this.timerOwner;
      owner?.clearTimeout(this.timer);
      this.timer = undefined;
      this.timerOwner = undefined;
      if (owner) this.elapsedMs += owner.performance.now() - this.startedAt;
    }
  };

  private clearTimer(): void {
    if (this.timer !== undefined) this.timerOwner?.clearTimeout(this.timer);
    this.timer = undefined;
    this.timerOwner = undefined;
  }

  /**
   * Wait for the actual CSS transition/animation on the toast surface. The
   * computed duration is intentionally read at runtime so a consumer's
   * `--lr-toast-show-duration`/`--lr-toast-hide-duration` override keeps
   * lifecycle events and removal in sync with the pixels on screen. A small
   * timeout remains as a safety net for zero-duration transitions, disabled
   * animation, and browsers that do not dispatch an end event.
   */
  private waitForVisualCompletion(kind: "show" | "hide"): Promise<void> {
    const previous =
      kind === "show" ? this.cancelShowAnimation : this.cancelHideAnimation;
    previous?.();
    const surface = this.shadowRoot?.querySelector<HTMLElement>(
      '[part="toast-item"]'
    );
    const view = this.ownerDocument.defaultView;
    if (!surface || !view || prefersReducedMotion(view))
      return Promise.resolve();

    const computed = view.getComputedStyle(surface);
    const transitionMs =
      maxCssTime(computed.transitionDuration) +
      maxCssTime(computed.transitionDelay);
    const animationMs =
      maxCssTime(computed.animationDuration) +
      maxCssTime(computed.animationDelay);
    const fallbackMs = Math.max(transitionMs, animationMs);
    if (fallbackMs <= 0) return Promise.resolve();

    return new Promise<void>((resolve) => {
      let settled = false;
      let timeout: number | undefined;
      const cancelKey =
        kind === "show" ? "cancelShowAnimation" : "cancelHideAnimation";
      const finish = (): void => {
        if (settled) return;
        settled = true;
        if (timeout !== undefined) view.clearTimeout(timeout);
        surface.removeEventListener("transitionend", onEnd);
        surface.removeEventListener("animationend", onEnd);
        if (this[cancelKey] === cancel) this[cancelKey] = undefined;
        resolve();
      };
      const onEnd = (event: Event): void => {
        if (event.target === surface) finish();
      };
      const cancel = (): void => finish();
      surface.addEventListener("transitionend", onEnd);
      surface.addEventListener("animationend", onEnd);
      timeout = view.setTimeout(finish, fallbackMs + 50);
      this[cancelKey] = cancel;
    });
  }

  // Hover and focus are tracked as independent pause reasons so that
  // releasing one (e.g. Shift-Tabbing focus away) only resumes the timer
  // once *neither* modality still holds the toast paused -- otherwise a
  // pointer resting on the toast would see it auto-dismiss out from under
  // it the moment focus alone moved away, or vice versa.
  private onPointerEnter = (): void => {
    this.hovering = true;
    this.pauseTimer();
  };

  private onPointerLeave = (): void => {
    this.hovering = false;
    if (!this.focused && !this.hiding) this.resumeTimer();
  };

  private onFocusIn = (event: FocusEvent): void => {
    const previous = event.relatedTarget as HTMLElement | null;
    if (
      previous?.nodeType === 1 &&
      !composedContains(this, previous) &&
      previous.isConnected
    ) {
      this.focusReturnTarget = previous;
    }
    const activeElement = deepActiveElement(this.ownerDocument);
    this.pendingFocusRepair =
      activeElement &&
      typeof (activeElement as HTMLElement).focus === "function"
        ? captureComposedFocusRepair(this, activeElement as HTMLElement) ??
          undefined
        : undefined;
    this.focused = true;
    this.pauseTimer();
  };

  private onFocusOut = (event: FocusEvent): void => {
    if (event.relatedTarget === null && this.hasAttribute("data-visible")) {
      const parent = this.parentElement;
      const clearIfStillOwned = (): void => {
        if (this.isConnected && this.parentElement === parent)
          this.pendingFocusRepair = undefined;
      };
      const view = this.ownerDocument.defaultView;
      if (view) view.queueMicrotask(clearIfStillOwned);
      else queueMicrotask(clearIfStillOwned);
    } else if (
      (event.relatedTarget as Node | null)?.nodeType === 1 &&
      !composedContains(this, event.relatedTarget as Element)
    )
      this.pendingFocusRepair = undefined;
    this.focused = false;
    if (!this.hovering && !this.hiding) this.resumeTimer();
  };

  // A stack of several simultaneously-open toasts otherwise gives every
  // close button the same bare "Close" label, so screen-reader/switch-access
  // users can't tell which toast a given button dismisses without first
  // activating it. Deriving the label from the toast's own message content
  // mirrors combobox's per-item "Remove X" labeling for the same reason.
  //
  // Rich, non-interactive default-slot markup is part of the message. Named-slot content and
  // actionable descendants are excluded so an icon or appended Undo button cannot contaminate
  // the close control's contextual name.
  private observeMessageNode(node: Node): void {
    if (!this.messageObserver) return;
    if (node.nodeType === 3) {
      this.messageObserver.observe(node, { characterData: true });
      return;
    }
    if (node.nodeType !== 1 && node.nodeType !== 11) return;
    this.messageObserver.observe(node, {
      attributes: true,
      attributeFilter: [
        "alt",
        "aria-hidden",
        "aria-label",
        "aria-labelledby",
        "class",
        "contenteditable",
        "hidden",
        "href",
        "inert",
        "id",
        "role",
        "slot",
        "style",
        "tabindex",
      ],
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  private bindMessageObserverTargets(): void {
    if (!this.messageObserver) return;
    this.messageObserver.disconnect();
    this.observeMessageNode(this);
    let ancestor = composedParentElement(this);
    while (ancestor) {
      this.messageObserver.observe(ancestor, {
        attributes: true,
        attributeFilter: ["aria-hidden", "class", "hidden", "inert", "style"],
      });
      ancestor = composedParentElement(ancestor);
    }
    for (const slot of this.querySelectorAll<HTMLSlotElement>("slot")) {
      for (const assigned of slot.assignedNodes({ flatten: true }))
        this.observeMessageNode(assigned);
    }
  }

  private observeLabelReferenceRoot(root: Document | ShadowRoot): void {
    this.messageObserver?.observe(root, {
      attributes: true,
      attributeFilter: ["id"],
      childList: true,
      subtree: true,
    });
  }

  private recomputeMessageText(): void {
    const renderRoot = (this as unknown as { renderRoot?: ParentNode })
      .renderRoot;
    const slot = renderRoot?.querySelector<HTMLSlotElement>("slot:not([name])");
    const lightDomNodes = (
      this as unknown as { childNodes?: NodeListOf<ChildNode> }
    ).childNodes;
    const messageNodes = slot
      ? slot.assignedNodes({ flatten: true })
      : Array.from(lightDomNodes ?? []).filter(
          (node) =>
            node.nodeType !== 1 || !(node as Element).getAttribute("slot")
        );
    const result = composedAccessibilityTextResult(messageNodes, {
      requireRendered: false,
      shouldPrune: (element) => {
        const slotName = element.getAttribute("slot");
        if (slotName !== null && slotName !== "") return true;
        if (isActionableElement(element)) return true;
        return (
          element.hasAttribute("tabindex") &&
          element.getAttribute("tabindex") !== "-1"
        );
      },
      skipRootAncestorValidation: true,
    });
    this.messageText = result.text.trim().replace(/\s+/g, " ");
    this.messageTextTruncated = result.truncated;
    for (const root of result.labelReferenceRoots)
      this.observeLabelReferenceRoot(root);
    for (const reference of result.referencedElements)
      this.observeMessageNode(reference);
    for (const root of result.traversedShadowRoots)
      this.observeMessageNode(root);
  }

  private announceMessage(force = false): void {
    const message = this.messageText;
    const announcement = this.messageTextTruncated
      ? message
        ? `${message}…`
        : this.localize("toastContentIncomplete")
      : message;
    if (!force && announcement === this.lastAnnouncedMessage) return;
    this.lastAnnouncedMessage = announcement;
    (isAssertiveVariant(this.variant)
      ? this.assertiveSink
      : this.politeSink
    )?.announce(announcement);
  }

  private get closeLabel(): string {
    const text = this.messageText;
    if (!text && this.messageTextTruncated) {
      return this.localize("closeWithContext", undefined, {
        snippet: this.localize("toastContentIncomplete"),
      });
    }
    if (!text) return this.localize("close");
    const { snippet, truncated } = truncateGraphemes(
      text,
      CLOSE_LABEL_GRAPHEME_LIMIT,
      this.effectiveLocale
    );
    if (this.messageTextTruncated || truncated) {
      return this.localize("closeWithTruncatedContext", undefined, { snippet });
    }
    return this.localize("closeWithContext", undefined, { snippet });
  }

  /** Hide with animation, then remove from the DOM. A vetoed manual request leaves the current
   * countdown untouched; a vetoed auto-dismiss request restarts the full normalized duration. */
  async hide(): Promise<void> {
    await this.requestHide("manual");
  }

  private requestHide(source: "manual" | "timer"): Promise<void> {
    if (this.hideRequest) return this.hideRequest;
    if (this.hiding) return Promise.resolve();
    let resolve!: () => void;
    let reject!: (reason?: unknown) => void;
    const completion = new Promise<void>(
      (resolveCompletion, rejectCompletion) => {
        resolve = resolveCompletion;
        reject = rejectCompletion;
      }
    );
    this.hideRequest = completion;
    // Emitted before any teardown so a veto leaves the item exactly as it was -- still visible,
    // instead of half-dismissed. A timeout has no remaining countdown once its callback runs, so
    // restart it from the full current duration after a veto; repeated vetoes therefore retry at
    // deterministic intervals instead of making the toast immortal.
    if (this.emit("lr-hide", null, { cancelable: true }).defaultPrevented) {
      if (source === "timer") {
        this.elapsedMs = 0;
        this.startedAt = 0;
        // Recreate the SVG animation in the same transaction as the timer reset. Merely changing
        // elapsedMs leaves the finished CSS animation attached to its existing DOM node, making
        // the ring look expired for the entire retry interval.
        this.progressRun += 1;
        if (this.isConnected && !this.hovering && !this.focused)
          this.resumeTimer();
      }
      if (this.hideRequest === completion) this.hideRequest = undefined;
      resolve();
      return completion;
    }
    this.hiding = true;
    this.showAccepted = false;
    this.showCompletionGeneration += 1;
    // Reflect the disabled state on the DOM node synchronously, not just via the reactive binding
    // in render(). Lit's update lands on the next microtask, which is too late for a screen reader
    // (or a second rapid click) inspecting the control immediately after an accepted dismissal.
    // Keep this after the veto point so a blocked dismissal leaves the close control operable.
    this.shadowRoot
      ?.querySelector<HTMLElement>('[part="close-button"]')
      ?.setAttribute("aria-disabled", "true");
    this.cancelShowAnimation?.();
    this.cancelShowAnimation = undefined;
    this.clearTimer();
    this.removeAttribute("data-visible");
    this.setAttribute("data-hiding", "");
    void this.completeHide().then(
      () => {
        if (this.hideRequest === completion) this.hideRequest = undefined;
        resolve();
      },
      (reason: unknown) => {
        if (this.hideRequest === completion) this.hideRequest = undefined;
        reject(reason);
      }
    );
    return completion;
  }

  private async completeHide(): Promise<void> {
    if (this.hideCompletionRunning || this.afterHideEmitted) return;
    this.hideCompletionRunning = true;
    const generation = this.hideGeneration;
    await this.waitForVisualCompletion("hide");
    this.hideCompletionRunning = false;
    // Disconnect cancels the visual wait. A reconnect must start a fresh wait against the newly
    // rendered surface rather than treating that cancellation as successful completion.
    if (generation !== this.hideGeneration || !this.isConnected) {
      if (this.isConnected) await this.completeHide();
      return;
    }
    if (this.afterHideEmitted) return;
    this.repairFocusBeforeRemoval();
    this.afterHideEmitted = true;
    this.emit("lr-after-hide");
    this.remove();
  }

  private repairFocusBeforeRemoval(): void {
    const active = deepActiveElement(this.ownerDocument);
    if (!composedContains(this, active)) return;

    this.focusAdjacentToastOrReturn();
  }

  private adjacentToastOrReturnTarget(): HTMLElement | null {
    const findAdjacent = (
      direction: "nextElementSibling" | "previousElementSibling"
    ) => {
      let element = this[direction];
      while (element) {
        if (element.localName === tag("toast-item")) {
          const item = element as LyraToastItem;
          const surface = item.shadowRoot?.querySelector<HTMLElement>(
            '[part="toast-item"]'
          );
          if (
            !item.hasAttribute("data-hiding") &&
            !item.hasAttribute("data-toast-queued") &&
            item.hasAttribute("data-visible") &&
            item.isConnected &&
            surface &&
            !surface.hidden &&
            !surface.inert
          ) {
            return (
              item.shadowRoot?.querySelector<HTMLButtonElement>(
                '[part="close-button"]'
              ) ?? null
            );
          }
        }
        element = element[direction];
      }
      return null;
    };
    return (
      findAdjacent("nextElementSibling") ??
      findAdjacent("previousElementSibling") ??
      (this.focusReturnTarget?.isConnected &&
      !composedContains(this, this.focusReturnTarget)
        ? this.focusReturnTarget
        : null)
    );
  }

  private focusAdjacentToastOrReturn(): void {
    this.adjacentToastOrReturnTarget()?.focus();
  }

  private renderCloseControl(): TemplateResult {
    const close = html`<span part="close-icon">${closeIcon()}</span>`;
    const duration = this.safeDuration;
    if (!Number.isFinite(duration) || duration <= 0) return close;

    return html`
      <span part="progress-ring" aria-hidden="true">
        ${keyed(
          this.progressRun,
          html`
            <svg
              part="progress-ring__base"
              viewBox="0 0 20 20"
              focusable="false"
            >
              <circle
                part="progress-ring__track"
                cx="10"
                cy="10"
                r="8"
                pathLength="1"
              ></circle>
              <circle
                part="progress-ring__indicator"
                cx="10"
                cy="10"
                r="8"
                pathLength="1"
                style=${`animation-duration: ${duration}ms; animation-delay: -${Math.min(
                  this.elapsedMs,
                  duration
                )}ms`}
              ></circle>
            </svg>
          `
        )}
        <span part="progress-ring__label">${close}</span>
      </span>
    `;
  }

  override render(): TemplateResult {
    return html`
      <div
        part="toast-item"
        ?hidden=${!this.surfaceMounted}
        ?inert=${!this.interactionReady}
        @pointerenter=${this.onPointerEnter}
        @pointerleave=${this.onPointerLeave}
        @focusin=${this.onFocusIn}
        @focusout=${this.onFocusOut}
      >
        <span part="accent" aria-hidden="true"></span>
        ${this.withIcon
          ? html`<span part="icon"><slot name="icon"></slot></span>`
          : ""}
        <div part="content">
          <slot @slotchange=${this.onMessageSlotChange}></slot>
        </div>
        <button
          part="close-button"
          type="button"
          aria-label=${this.closeLabel}
          aria-disabled=${this.hiding ? "true" : "false"}
          @click=${() => void this.hide()}
        >
          ${this.renderCloseControl()}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lr-toast-item": LyraToastItem;
  }
}
