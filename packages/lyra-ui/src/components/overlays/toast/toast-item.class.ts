import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import {
  composedParentElement,
  isAccessibilitySubtreeExcluded,
  isAccessibilityVisibilityHidden,
} from '../../../internal/a11y.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { closeIcon } from '../../../internal/icons.js';
import { getSegmenter } from '../../../internal/intl-cache.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { finiteDuration } from '../../../internal/numbers.js';
import { composedContains, deepActiveElement } from '../../../internal/overlay-manager.js';
import {
  normalizeSize,
  type LyraSize,
  type LyraSizeStep,
  type LyraVariant,
} from '../../../internal/variants.js';
import { variants } from '../../../internal/variants.styles.js';
import { styles } from './toast-item.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_close, LYRA_DEFAULT_closeWithContext, LYRA_DEFAULT_closeWithTruncatedContext, LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_duration, LYRA_DEFAULT_open } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** The library's one semantic-tone vocabulary. */
export type ToastVariant = LyraVariant;
/** The library's one size ladder. */
export type ToastSize = LyraSizeStep;

function parseTime(value: string): number {
  const trimmed = value.trim();
  if (trimmed.endsWith('ms')) return Number.parseFloat(trimmed);
  if (trimmed.endsWith('s')) return Number.parseFloat(trimmed) * 1000;
  return 0;
}

function maxCssTime(value: string): number {
  return Math.max(0, ...value.split(',').map(parseTime).filter(Number.isFinite));
}

const CLOSE_LABEL_GRAPHEME_LIMIT = 40;

function isAssertiveVariant(variant: ToastVariant): boolean {
  return variant === 'danger' || variant === 'warning';
}

function truncateGraphemes(
  value: string,
  limit: number,
  locale: string,
): { snippet: string; truncated: boolean } {
  // A code-point fallback would split combining and ZWJ graphemes. Keep the complete label on
  // legacy engines instead of manufacturing a broken close-name context.
  if (typeof Intl.Segmenter !== 'function') return { snippet: value, truncated: false };
  let graphemes: string[];
  try {
    graphemes = [...getSegmenter(locale, { granularity: 'grapheme' }).segment(value)].map(
      ({ segment }) => segment,
    );
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    graphemes = [...getSegmenter(undefined, { granularity: 'grapheme' }).segment(value)].map(
      ({ segment }) => segment,
    );
  }
  return graphemes.length > limit
    ? { snippet: graphemes.slice(0, limit).join(''), truncated: true }
    : { snippet: value, truncated: false };
}

export interface LyraToastItemEventMap {
  'lr-show': CustomEvent<undefined>;
  'lr-after-show': CustomEvent<undefined>;
  'lr-hide': CustomEvent<undefined>;
  'lr-after-hide': CustomEvent<undefined>;
}
/**
 * `<lr-toast-item>` — a single toast notification. Its normalized message is announced through a
 * shared light-DOM sink, leaving the visible close and action controls outside the live subtree.
 * Contextual close names include rich non-interactive message markup and update with its text.
 * When a focused toast finishes hiding, focus moves to an adjacent toast or back to the pre-toast
 * control. A hide interrupted by disconnect resumes to one terminal completion if the same item
 * reconnects.
 * Mirrors the Web Awesome `<wa-toast-item>` API under the `lr-` prefix.
 *
 * @customElement lr-toast-item
 * @slot - The message content. Visible non-interactive text, including through forwarding slots,
 * stays synchronized with the close button's contextual accessible name.
 * @slot icon - Optional icon shown at the start.
 * @event lr-show - The item is about to show. Cancelable — `preventDefault()` suppresses the
 *   toast, leaving it in the region invisible and with no auto-dismiss timer; the listener then
 *   owns removing it.
 * @event lr-after-show - Fired after the show animation completes.
 * @event lr-hide - The item is about to hide, including an auto-dismiss expiry. Cancelable —
 *   `preventDefault()` leaves it visible and still counting down.
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
 * @cssprop [--lr-toast-padding=var(--lr-space-m)] - Padding of the item, auto-swapped per `size`
 *   across the shared six-step ladder.
 * @cssprop [--lr-toast-font-size=var(--lr-font-size-m)] - Font size of the item, auto-swapped per
 *   `size` across the shared six-step ladder.
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
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    close: LYRA_DEFAULT_close,
    closeWithContext: LYRA_DEFAULT_closeWithContext,
    closeWithTruncatedContext: LYRA_DEFAULT_closeWithTruncatedContext,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    duration: LYRA_DEFAULT_duration,
    open: LYRA_DEFAULT_open,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, variants, styles];

  /** Auto-dismiss delay in ms. Set to `Infinity` (or <= 0) to disable. */
  @property({ type: Number }) duration = 5000;

  private _size: ToastSize = 'm';
  /** Visual size. Upstream `small`/`medium`/`large` writes normalize to canonical `s`/`m`/`l`
   * reads without changing the constructed `m` default. */
  @property({ reflect: true })
  get size(): ToastSize {
    return this._size;
  }
  set size(value: LyraSize) {
    const old = this._size;
    this._size = normalizeSize(value ?? 'm');
    this.requestUpdate('size', old);
  }

  /** Severity/variant. */
  @property({ reflect: true }) variant: ToastVariant = 'neutral';

  /** Show the icon slot. */
  @property({ type: Boolean, attribute: 'with-icon' }) withIcon = false;

  private timer?: number;
  private timerOwner?: Window;
  private elapsedMs = 0;
  private startedAt = 0;
  private timerStarted = false;
  private showRafId?: number;
  private showRafOwner?: Window;
  private cancelShowAnimation?: () => void;
  private cancelHideAnimation?: () => void;
  private hovering = false;
  private focused = false;
  private focusReturnTarget?: HTMLElement;
  private messageObserver?: MutationObserver;
  private politeSink?: AnnouncementSink;
  private assertiveSink?: AnnouncementSink;
  private lastAnnouncedMessage = '';
  private readonly onMessageSlotChange = (event: Event): void => {
    const target = event.target as Element | null;
    if (target?.nodeType !== 1 || target.localName !== 'slot') return;
    this.bindMessageObserverTargets();
    this.recomputeMessageText();
  };
  private hideCompletionRunning = false;
  private hideGeneration = 0;
  private afterHideEmitted = false;
  @state() private messageText = '';
  @state() private hiding = false;

  /** `duration` normalized to a finite, non-negative delay -- *or* `Infinity` verbatim.
   *  `Infinity` is this property's own documented "never auto-dismiss" sentinel (see its doc
   *  comment above), so it must not be coerced into a large-but-finite fallback by
   *  `finiteDuration`'s clamp; only a genuinely invalid raw value (`NaN`, `-Infinity`) falls back
   *  to the constructed default. A finite negative value clamps to `0`, which already means
   *  "disable" per this property's own contract (see `resumeTimer()` below), so that's not a
   *  behavior change either. */
  private get safeDuration(): number {
    return this.duration === Infinity ? Infinity : finiteDuration(this.duration, 5000, 0);
  }

  protected override willUpdate(changed: PropertyValues): void {
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
    if (changed.has('duration') && this.timerStarted && !this.hovering && !this.focused) {
      this.pauseTimer();
      this.resumeTimer();
    }
  }

  protected override updated(changed: PropertyValues): void {
    if (this.hasAttribute('data-visible')) {
      const previousVariant = changed.get('variant') as ToastVariant | undefined;
      const urgencyChanged = changed.has('variant') &&
        isAssertiveVariant(this.variant) !== isAssertiveVariant(previousVariant ?? 'neutral');
      if (urgencyChanged) {
        // Preserve the prior urgency contract when a displayed toast changes
        // severity, but announce only the normalized message rather than the
        // visible controls that share this host.
        this.announceMessage(true);
      } else if (changed.has('messageText')) {
        this.announceMessage();
      }
    }
    this.shadowRoot
      ?.querySelector<SVGElement>('[part~="close-icon"] svg')
      ?.setAttribute('part', 'close-icon__svg');
  }

  override firstUpdated(): void {
    this.scheduleShow();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.politeSink ??= acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
    this.assertiveSink ??= acquireAnnouncementSink('assertive', {
      document: this.ownerDocument,
      source: this,
    });
    const MutationObserverCtor = this.ownerDocument.defaultView?.MutationObserver;
    this.messageObserver = MutationObserverCtor
      ? new MutationObserverCtor(() => {
          this.bindMessageObserverTargets();
          this.recomputeMessageText();
        })
      : undefined;
    this.addEventListener('slotchange', this.onMessageSlotChange);
    this.bindMessageObserverTargets();
    if (this.hasUpdated) this.recomputeMessageText();
    else this.seedFirstRenderState(() => this.recomputeMessageText());
    if (!this.hasUpdated) return;
    if (this.hiding) {
      void this.completeHide();
      return;
    }
    if (!this.hasAttribute('data-visible')) {
      this.scheduleShow();
    } else if (this.timerStarted && !this.hovering && !this.focused) {
      this.resumeTimer();
    }
  }

  private scheduleShow(): void {
    if (this.showRafId !== undefined || this.hiding) return;
    const view = this.ownerDocument.defaultView;
    if (!view) return;
    this.showRafOwner = view;
    this.showRafId = view.requestAnimationFrame(() => {
      this.showRafId = undefined;
      this.showRafOwner = undefined;
      // hide() may have already run synchronously before this frame fired
      // (e.g. a caller creates the toast and immediately dismisses it) --
      // don't resurrect the show sequence on top of an already-hiding item.
      if (this.hiding) return;
      // The veto point precedes the state change, so `preventDefault()` genuinely suppresses the
      // toast rather than hiding one that already animated in. A vetoed item stays in the toast
      // region, invisible and with no auto-dismiss timer -- a listener that blocks a toast owns
      // removing it, exactly as a listener that blocks `lr-hide` owns dismissing it later.
      if (this.emit('lr-show', undefined, { cancelable: true }).defaultPrevented) return;
      this.setAttribute('data-visible', '');
      this.announceMessage(true);
      void this.waitForVisualCompletion('show').then(() => {
        if (this.isConnected && !this.hiding) this.emit('lr-after-show');
      });
      this.startTimer();
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('slotchange', this.onMessageSlotChange);
    this.messageObserver?.disconnect();
    this.messageObserver = undefined;
    this.politeSink?.release();
    this.politeSink = undefined;
    this.assertiveSink?.release();
    this.assertiveSink = undefined;
    if (this.hiding && !this.afterHideEmitted) this.hideGeneration++;
    if (this.showRafId !== undefined) {
      this.showRafOwner?.cancelAnimationFrame(this.showRafId);
      this.showRafId = undefined;
      this.showRafOwner = undefined;
    }
    this.cancelShowAnimation?.();
    this.cancelShowAnimation = undefined;
    this.cancelHideAnimation?.();
    this.cancelHideAnimation = undefined;
    this.pauseTimer();
    this.hovering = false;
    this.focused = false;
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
    const duration = this.safeDuration;
    if (!isFinite(duration) || duration <= 0) return;
    const remaining = duration - this.elapsedMs;
    // A duration shortened below the already-elapsed time must hide promptly,
    // not silently never schedule anything.
    if (remaining <= 0) {
      void this.hide();
      return;
    }
    const view = this.ownerDocument.defaultView;
    if (!view) return;
    this.startedAt = view.performance.now();
    this.timerOwner = view;
    this.timer = view.setTimeout(() => this.hide(), remaining);
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
  private waitForVisualCompletion(kind: 'show' | 'hide'): Promise<void> {
    const previous = kind === 'show' ? this.cancelShowAnimation : this.cancelHideAnimation;
    previous?.();
    const surface = this.shadowRoot?.querySelector<HTMLElement>('[part="toast-item"]');
    const view = this.ownerDocument.defaultView;
    if (!surface || !view || prefersReducedMotion(view)) return Promise.resolve();

    const computed = view.getComputedStyle(surface);
    const transitionMs = maxCssTime(computed.transitionDuration) + maxCssTime(computed.transitionDelay);
    const animationMs = maxCssTime(computed.animationDuration) + maxCssTime(computed.animationDelay);
    const fallbackMs = Math.max(transitionMs, animationMs);
    if (fallbackMs <= 0) return Promise.resolve();

    return new Promise<void>((resolve) => {
      let settled = false;
      let timeout: number | undefined;
      const cancelKey = kind === 'show' ? 'cancelShowAnimation' : 'cancelHideAnimation';
      const finish = (): void => {
        if (settled) return;
        settled = true;
        if (timeout !== undefined) view.clearTimeout(timeout);
        surface.removeEventListener('transitionend', onEnd);
        surface.removeEventListener('animationend', onEnd);
        if (this[cancelKey] === cancel) this[cancelKey] = undefined;
        resolve();
      };
      const onEnd = (event: Event): void => {
        if (event.target === surface) finish();
      };
      const cancel = (): void => finish();
      surface.addEventListener('transitionend', onEnd);
      surface.addEventListener('animationend', onEnd);
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
    this.focused = true;
    this.pauseTimer();
  };

  private onFocusOut = (): void => {
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
    if (node.nodeType !== 1) return;
    this.messageObserver.observe(node, {
      attributes: true,
      attributeFilter: [
        'aria-hidden',
        'aria-label',
        'class',
        'contenteditable',
        'hidden',
        'href',
        'inert',
        'role',
        'slot',
        'style',
        'tabindex',
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
        attributeFilter: ['aria-hidden', 'class', 'hidden', 'inert', 'style'],
      });
      ancestor = composedParentElement(ancestor);
    }
    for (const slot of this.querySelectorAll<HTMLSlotElement>('slot')) {
      for (const assigned of slot.assignedNodes({ flatten: true })) this.observeMessageNode(assigned);
    }
  }

  private recomputeMessageText(): void {
    const collectText = (node: Node): string => {
      if (node.nodeType === 3) return node.textContent ?? '';
      if (node.nodeType !== 1) return '';
      const element = node as Element;
      if (isAccessibilitySubtreeExcluded(element)) return '';
      const visibilityHidden = isAccessibilityVisibilityHidden(element);
      const slotName = element.getAttribute('slot');
      if (slotName !== null && slotName !== '') return '';
      if (
        element.matches(
          'a[href],button,input,select,textarea,[contenteditable]:not([contenteditable="false"]),' +
          '[tabindex]:not([tabindex="-1"]),[role="button"],[role="link"],[role="menuitem"]',
        )
      ) {
        return '';
      }
      const accessibleLabel = visibilityHidden ? null : element.getAttribute('aria-label');
      if (accessibleLabel?.trim()) return accessibleLabel;
      const childNodes =
        element.localName === 'slot' && (element as HTMLSlotElement).assignedNodes().length > 0
          ? (element as HTMLSlotElement).assignedNodes({ flatten: true })
          : element.childNodes;
      return Array.from(childNodes, (child) =>
        child.nodeType === 3 && visibilityHidden ? '' : collectText(child),
      ).join(' ');
    };
    const renderRoot = (this as unknown as { renderRoot?: ParentNode }).renderRoot;
    const slot = renderRoot?.querySelector<HTMLSlotElement>('slot:not([name])');
    const lightDomNodes = (this as unknown as { childNodes?: NodeListOf<ChildNode> }).childNodes;
    const messageNodes = slot
      ? slot.assignedNodes({ flatten: true })
      : Array.from(lightDomNodes ?? []).filter(
          (node) => node.nodeType !== 1 || !(node as Element).getAttribute('slot'),
        );
    this.messageText = messageNodes
      .map(collectText)
      .join(' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private announceMessage(force = false): void {
    const message = this.messageText;
    if (!force && message === this.lastAnnouncedMessage) return;
    this.lastAnnouncedMessage = message;
    (isAssertiveVariant(this.variant) ? this.assertiveSink : this.politeSink)?.announce(message);
  }

  private get closeLabel(): string {
    const text = this.messageText;
    if (!text) return this.localize('close');
    const { snippet, truncated } = truncateGraphemes(text, CLOSE_LABEL_GRAPHEME_LIMIT, this.effectiveLocale);
    if (truncated) return this.localize('closeWithTruncatedContext', undefined, { snippet });
    return this.localize('closeWithContext', undefined, { snippet });
  }

  /** Hide with animation, then remove from the DOM. */
  async hide(): Promise<void> {
    if (this.hiding) return;
    // Emitted before any teardown so a veto leaves the item exactly as it was -- still visible,
    // still counting down -- instead of half-dismissed.
    if (this.emit('lr-hide', undefined, { cancelable: true }).defaultPrevented) return;
    this.hiding = true;
    this.cancelShowAnimation?.();
    this.cancelShowAnimation = undefined;
    this.clearTimer();
    this.removeAttribute('data-visible');
    this.setAttribute('data-hiding', '');
    await this.completeHide();
  }

  private async completeHide(): Promise<void> {
    if (this.hideCompletionRunning || this.afterHideEmitted) return;
    this.hideCompletionRunning = true;
    const generation = this.hideGeneration;
    await this.waitForVisualCompletion('hide');
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
    this.emit('lr-after-hide');
    this.remove();
  }

  private repairFocusBeforeRemoval(): void {
    const active = deepActiveElement(this.ownerDocument);
    if (!composedContains(this, active)) return;

    const adjacent = [this.nextElementSibling, this.previousElementSibling].find(
      (element): element is LyraToastItem =>
        element?.localName === 'lr-toast-item' &&
        !element.hasAttribute('data-hiding') &&
        element.isConnected,
    );
    const adjacentClose =
      adjacent?.shadowRoot?.querySelector<HTMLButtonElement>('[part="close-button"]') ?? null;
    if (adjacentClose) {
      adjacentClose.focus();
      return;
    }
    if (
      this.focusReturnTarget?.isConnected &&
      !composedContains(this, this.focusReturnTarget)
    ) {
      this.focusReturnTarget.focus();
    }
  }

  private renderCloseControl(): TemplateResult {
    const close = html`<span part="close-icon">${closeIcon()}</span>`;
    const duration = this.safeDuration;
    if (!Number.isFinite(duration) || duration <= 0) return close;

    return html`
      <span part="progress-ring" aria-hidden="true">
        <svg part="progress-ring__base" viewBox="0 0 20 20" focusable="false">
          <circle part="progress-ring__track" cx="10" cy="10" r="8" pathLength="1"></circle>
          <circle
            part="progress-ring__indicator"
            cx="10"
            cy="10"
            r="8"
            pathLength="1"
            style=${`animation-duration: ${duration}ms`}
          ></circle>
        </svg>
        <span part="progress-ring__label">${close}</span>
      </span>
    `;
  }

  override render(): TemplateResult {
    return html`
      <div
        part="toast-item"
        @pointerenter=${this.onPointerEnter}
        @pointerleave=${this.onPointerLeave}
        @focusin=${this.onFocusIn}
        @focusout=${this.onFocusOut}
      >
        <span part="accent" aria-hidden="true"></span>
        ${this.withIcon ? html`<span part="icon"><slot name="icon"></slot></span>` : ''}
        <div part="content"><slot @slotchange=${this.onMessageSlotChange}></slot></div>
        <button
          part="close-button"
          type="button"
          aria-label=${this.closeLabel}
          aria-disabled=${this.hiding ? 'true' : 'false'}
          @click=${(e: Event) => {
            // Reflect the disabled state on the DOM node synchronously, not
            // just via the reactive binding above -- Lit's re-render from
            // `this.hiding = true` (inside hide()) lands on the next
            // microtask, which is too late for a screen reader (or a second
            // rapid click) that inspects the attribute right after this
            // handler returns.
            (e.currentTarget as HTMLElement).setAttribute('aria-disabled', 'true');
            void this.hide();
          }}
        >
          ${this.renderCloseControl()}
        </button>
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-toast-item': LyraToastItem;
  }
}
