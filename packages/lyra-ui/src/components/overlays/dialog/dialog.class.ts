import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { resolveHeadingLevel, type LyraHeadingLevel } from '../../../internal/heading-level.js';
import {
  activateOverlay,
  collectFocusableElements,
  type OverlayDeactivateOptions,
  type OverlayHandle,
} from '../../../internal/overlay-manager.js';
import { nextId } from '../../../internal/a11y.js';
import { closeIcon } from '../../../internal/icons.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import {
  animateRegistered,
  type RegisteredAnimationSpec,
} from '../../../internal/registered-animation.js';
import { styles } from './dialog.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_close } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6, [role="heading"]';

/**
 * Reason a dialog was dismissed, forwarded as the `lr-close` event
 * detail. `'escape'` and `'backdrop'` are emitted by the dialog's own built-in
 * dismiss triggers; `'close-button'` by the built-in header close button
 * (rendered when `closable` is set); `'unmount'` is emitted when the dialog is
 * removed from the DOM while still open by something other than its own
 * `close()` (e.g. a consumer's own cleanup code, or a parent re-render that
 * drops it); any other string is whatever a caller passes to `close()` (e.g. a
 * consumer's own footer close button, or confirm.ts's `'confirm'`/`'cancel'`).
 * `'api'` covers `close()` with no argument, `hide()`, and `open = false`.
 */
export type DialogCloseReason =
  | 'escape'
  | 'backdrop'
  | 'close-button'
  | 'api'
  | 'unmount'
  | (string & Record<never, never>);

/** Shoelace-compatible reason a built-in affordance asked a dialog to close. */
export type LyraDialogRequestCloseSource = 'close-button' | 'keyboard' | 'overlay';

export interface LyraDialogRequestCloseDetail {
  source: LyraDialogRequestCloseSource;
}

/** Web Awesome-compatible source element carried by `lr-hide`. */
export interface LyraDialogHideDetail {
  source: Element;
}

/** Compatibility controller used while a third-party modal temporarily owns focus. */
export interface LyraDialogModalController {
  activateExternal(): void;
  deactivateExternal(): void;
}

export interface LyraDialogEventMap {
  'lr-show': CustomEvent<null>;
  'lr-after-show': CustomEvent<null>;
  'lr-hide': CustomEvent<LyraDialogHideDetail>;
  'lr-after-hide': CustomEvent<null>;
  'lr-initial-focus': CustomEvent<null>;
  'lr-request-close': CustomEvent<LyraDialogRequestCloseDetail>;
  'lr-close': CustomEvent<DialogCloseReason>;
}
/**
 * `<lr-dialog>` — a general-purpose modal/overlay. `role="dialog"`,
 * focus-trapped while open, dismissible via Escape or (opt-in) a backdrop click, and
 * scroll-locks the document for as long as it's open. While open it is promoted into the
 * browser top layer, so no consumer stacking context can render on top of it. The mapped
 * `label` property renders as a visible title and the close affordance is present by default;
 * `closable="false"` plus either header-suppression spelling support custom chrome. `no-header` is
 * Shoelace's name for it and `without-header` is Web Awesome's; both are current upstream
 * spellings, neither is deprecated, and both are read.
 *
 * Lifecycle: `show()` emits `lr-show` (cancelable) and then, once the enter animation has
 * finished, `lr-after-show`. `hide()`/`close()` emit `lr-hide` (cancelable), then
 * `lr-close` (cancelable, carrying the dismissal reason), then — once the exit animation
 * has finished — `lr-after-hide`. Assigning `open` runs the same lifecycle, so the property, the
 * reflected attribute, and the two method calls can never disagree. Markup that renders open
 * from the start emits nothing, matching `<lr-menu>`.
 * The panel resolves `dialog.show`/`dialog.hide` through the public animation registry; the
 * backdrop resolves `dialog.overlay.show`/`dialog.overlay.hide`. A per-element registration wins
 * over a page default, while keyframes-only overrides retain the dialog's token-derived timing.
 *
 * Accessible naming and visible-title precedence are independent. A host `aria-label` wins by
 * attribute presence, including an explicitly empty value, followed by `accessible-label`, then
 * the text of a direct light-DOM heading. Otherwise the visible title wrapper names the panel.
 * Within that wrapper the rich `label` slot wins over the `label` property, which wins over the
 * legacy `heading` property. Explicit accessible-only naming never suppresses that visible title.
 *
 * The slotted-heading case deliberately uses `aria-label` (a copied string)
 * rather than `aria-labelledby` pointing at the heading's `id`: the heading is
 * *light-DOM* content while `[part="panel"]` lives in this element's
 * *shadow* tree, and an ID-reference attribute can't resolve across that
 * boundary (verified against axe's `aria-dialog-name` rule) — unlike the
 * mapped-title cases above, where the target element is rendered
 * inside the same shadow root it labels, so `aria-labelledby` there is safe.
 * The `label` *slot* is safe for the same reason: `aria-labelledby` targets the shadow-owned
 * `part="heading"` wrapper, and the accessible-name computation flattens the slot inside it.
 * That generated visible title is a level-three heading by default; set `heading-level` from
 * `1`–`6` to fit the surrounding outline, or `none` for visual-only title text. A direct
 * light-DOM heading retains its own level instead.
 *
 * `closable` defaults to true and renders a close (X) button in the header row (creating one, with
 * no heading text, if neither `heading` nor the `label` slot is set) that closes the dialog via
 * the same `close()` path as Escape/backdrop-dismiss, with reason `'close-button'`.
 *
 * The `body` part is the element that scrolls, so it carries `tabindex="-1"`: a dialog holding
 * only prose, a table, or a rendered document would otherwise have no keyboard stop at all and
 * its content would be readable by mouse alone. It joins the Tab order only while it actually
 * overflows, sorts behind any control inside it for initial focus, and shows the standard focus
 * ring on `::part(body)` when it takes focus.
 *
 * Stacking: opening one `<lr-dialog>` while another is already open (e.g. a
 * `confirm()` launched from within an already-open dialog) is supported --
 * Escape and the Tab focus trap only ever act on the topmost open dialog, so
 * dialogs beneath it stay open and untouched until the one on top closes.
 *
 * @customElement lr-dialog
 * @slot - The dialog body.
 * @slot label - Rich header content, rendered in the header row and used as the panel's
 *   accessible name. Wins over the plain-string `label` and legacy `heading` properties.
 * @slot header-actions - Extra controls rendered in the header row, before the built-in close
 *   button.
 * @slot footer - Action buttons, rendered in a bottom row.
 * @event lr-show - The dialog is about to open. Cancelable — `preventDefault()` keeps it closed.
 * @event lr-after-show - The dialog is open and its enter animation has finished.
 * @event lr-hide - The dialog is about to close, for every dismissal path. Cancelable —
 *   `preventDefault()` keeps it open and stops `lr-close` from firing at all. Detail is
 *   `{ source: Element }`, the affordance or host that requested the transition. The single
 *   exception is an open dialog being removed from the document: the close has already happened
 *   and cannot be undone, so that one is announced non-cancelable.
 * @event lr-after-hide - The dialog is closed and its exit animation has finished.
 * @event lr-initial-focus - Emitted immediately before the first automatic focus movement for an
 *   open activation. Cancelable; vetoing it leaves focus where the caller put it. CSS-hidden
 *   dialogs defer it until rendered, and reconnecting the same open dialog does not repeat it.
 * @event lr-request-close - A built-in affordance requested dismissal. Cancelable; detail is
 *   `{ source: 'close-button' | 'keyboard' | 'overlay' }`.
 * @event lr-close - `detail: DialogCloseReason`. Cancelable — a listener calling
 *   `preventDefault()` stops the dialog from closing, for every dismissal path (Escape, backdrop,
 *   the built-in close button, `hide()`, `open = false`, or a consumer's own `close()` call).
 *   Fires after `lr-hide` and carries the one thing `lr-hide` does not: which affordance asked
 *   for the close. The plain `lr-close` spelling matches `<lr-tool-select-dialog>`,
 *   `<lr-tool-result-dialog>`, and `<lr-tool-approval-dialog>`, whose own docs already describe
 *   their close-reason detail as mirroring this shape. Also fired (with reason `'unmount'`,
 *   non-cancelable there since the element is already being removed) when the dialog is removed
 *   from the DOM while still open.
 * @csspart base - Shoelace wrapper alias.
 * @csspart backdrop - The full-viewport scrim behind the panel; also carries `overlay`.
 * @csspart overlay - Shoelace alias on the backdrop.
 * @csspart panel - The dialog panel itself (`role="dialog"` while open); also carries `dialog`.
 *   Shrink-wraps to its
 *   content by default, capped at `--lr-dialog-max-width` (default `32rem`); set
 *   `--lr-dialog-width` for an assertive width instead of only a cap.
 * @csspart dialog - Web Awesome alias on the panel.
 * @csspart header - The header row, rendered when the `label` slot is filled, `label`/`heading`
 *   is set (and no heading is slotted into the default slot), `header-actions` is filled, and/or
 *   `closable` is `true` — and never when `noHeader` or `withoutHeader` is set.
 * @csspart heading - The visible title inside `header`; also carries `title` and `label`, and owns
 *   the configured heading semantics unless opted out.
 * @csspart title - Mapped alias on the visible title.
 * @csspart header-actions - The wrapper around the `header-actions` slot.
 * @csspart close-button - The built-in close button, rendered inside `header`
 *   only when `closable` is `true`.
 * @csspart close-button__base - Exported mapped alias on the close button.
 * @csspart label - Mapped alias on the visible title.
 * @csspart body - The wrapper around the default slot.
 * @csspart footer - The wrapper around the `footer` slot.
 * @cssprop [--lr-dialog-overlay-color=var(--lr-color-overlay)] - Backdrop scrim color.
 * @cssprop [--lr-dialog-backdrop-filter=none] - `backdrop-filter` applied to the scrim, for a
 *   frosted-glass treatment over the page behind it.
 * @cssprop [--backdrop-filter=var(--lr-dialog-backdrop-filter,none)] - Mapped backdrop-filter
 *   alias.
 * @cssprop [--width=var(--lr-dialog-width,auto)] - Mapped panel width alias.
 * @cssprop [--spacing=var(--lr-dialog-spacing,var(--lr-space-l))] - Mapped shared region spacing.
 * @cssprop [--header-spacing] - Mapped header padding override.
 * @cssprop [--body-spacing] - Shoelace body padding override.
 * @cssprop [--footer-spacing] - Shoelace footer padding override.
 * @cssprop [--show-duration] - Mapped opening animation duration.
 * @cssprop [--hide-duration] - Mapped closing animation duration.
 * @cssprop [--lr-dialog-width=auto] - Assertive inline size for the panel. Left at `auto` the panel
 *   shrink-wraps to its content.
 * @cssprop [--lr-dialog-max-width=var(--lr-dialog-width, var(--lr-size-32rem))] - Cap on the
 *   panel's inline size. Falls back to `--lr-dialog-width` when that is set, so an assertive width
 *   is not clipped by the 32rem default; the viewport (`100%`) is always a hard limit on top.
 * @cssprop [--lr-dialog-spacing=var(--lr-space-l)] - Padding inside the body, and the inline
 *   padding of the header and footer rows.
 * @cssprop [--lr-dialog-spacing-block=var(--lr-space-m)] - Block padding of the header and footer
 *   rows, which are tighter than the body by default.
 * @cssprop [--lr-dialog-panel-duration=var(--lr-duration-base)] - Duration of the panel's
 *   enter/exit animation.
 * @cssprop [--lr-dialog-backdrop-duration=var(--lr-duration-fast)] - Duration of the backdrop's
 *   fade.
 * @status stable
 * @since 4.0.0
 */
export class LyraDialog extends LyraElement<LyraDialogEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    close: LYRA_DEFAULT_close,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  private _open = false;

  /**
   * Whether the dialog is open. Assigning it runs the full `lr-show`/`lr-hide` lifecycle, so it
   * stays in sync with `show()`/`hide()`/`close()` and can be vetoed the same way. Markup that
   * renders open from the start emits nothing.
   * @default false
   */
  @property({ type: Boolean, reflect: true })
  get open(): boolean {
    return this._open;
  }
  set open(next: boolean) {
    const normalized = Boolean(next);
    if (this.coalesceOpenRequest(normalized)) return;
    if (normalized === this._open) return;
    // Before the first render this is the initial markup/property state, not a transition:
    // `<lr-dialog open>` and confirm.ts's `dialog.open = true` before mounting both land here.
    if (!this.hasUpdated) {
      this.applyOpenState(normalized);
      return;
    }
    if (normalized) this.show();
    else this.close('api');
  }

  /** Visible mapped title. The richer `label` slot wins when both are supplied. */
  @property({ reflect: true }) label = '';

  /** Semantic level of the generated visible title. Use `none` for visual-only text. A direct
   *  light-DOM heading retains its own native/ARIA level; invalid untyped values use level 3. */
  @property({ attribute: 'heading-level', reflect: true })
  headingLevel: LyraHeadingLevel = '3';

  /** Legacy visible title fallback. The richer `label` slot and mapped `label` property win. Has
   *  no effect when a direct light-DOM heading already supplies custom title chrome. */
  @property() heading?: string;

  /** Renders a built-in close (X) button in the header row (creating one,
   *  with no heading text, if `label` and `heading` are unset), wired to the same
   *  `close()` path Escape/backdrop-dismiss already use, with reason
   *  `'close-button'`. */
  @property({ type: Boolean, converter: trueDefaultBooleanConverter, reflect: true }) closable = true;

  /** Suppresses the header row entirely, whatever `heading`, `closable`, the `label` slot or the
   *  `header-actions` slot would otherwise render. For a dialog that owns its own chrome. This is
   *  Web Awesome's spelling (`wa-dialog`'s `without-header`); `noHeader` below is Shoelace's. Both
   *  are current upstream names, both are read, and neither is deprecated. */
  @property({ type: Boolean, attribute: 'without-header', reflect: true }) withoutHeader = false;

  /** Shoelace's spelling (`sl-dialog`'s `no-header`) for suppressing the header row, read alongside
   *  Web Awesome's `withoutHeader` above so a consumer arriving from either upstream finds their
   *  own attribute working. Neither is deprecated. */
  @property({ type: Boolean, attribute: 'no-header', reflect: true }) noHeader = false;

  /** SSR hint that keeps the footer wrapper rendered before slot assignment is observable. */
  @property({ type: Boolean, attribute: 'with-footer', reflect: true }) withFooter = false;

  /** Explicit accessible-only panel name. Unlike `label`, it never renders visible text. */
  @property({ attribute: 'accessible-label' }) accessibleLabel = '';

  /** Host-level `aria-label` override for the panel's accessible name — wins by attribute
   *  presence, including an explicitly empty value, over every other naming source (a slotted
   *  heading, the `label` slot, `heading`, the `label` property) without suppressing visible
   *  heading chrome, matching `<lr-date-input>`'s `accessibleLabel` pattern. See the class doc for
   *  the full precedence order. Set as a plain `aria-label` attribute on `<lr-dialog>` itself, not
   *  a public JS property. */
  @property({ attribute: 'aria-label' }) private hostAriaLabel: string | null = null;

  /** Dismisses the dialog on a backdrop click. Opt-in and `false` by default, matching
   *  `wa-dialog`. This was previously spelled `no-light-dismiss` — an opt-*out* whose default left
   *  backdrop dismissal on, so a mechanical `wa-dialog` → `lr-dialog` rename silently flipped the
   *  behaviour of every migrated dialog. A rename that changes what the markup does with nothing
   *  to warn on is worse than no rename at all, so the polarity now matches upstream exactly. */
  @property({ type: Boolean, attribute: 'light-dismiss' }) lightDismiss = false;

  @state() private hasFooterSlot = false;
  @state() private hasLabelSlot = false;
  @state() private hasHeaderActionsSlot = false;
  @state() private headingText?: string;

  private overlay?: OverlayHandle;
  /** Set by `deactivateOverlay()` when a close defers releasing the scroll lock. Flushed once the
   *  exit animation actually finishes (`settleTransition()`'s `'lr-after-hide'` branch), or right
   *  away on disconnect/reopen, since nothing is left to visually protect in either case. */
  private pendingScrollLockRelease?: () => void;
  private headingObserver?: MutationObserver;
  private headingObserverDocument?: Document;
  private headingObserverGeneration = 0;
  /** Invalidates any in-flight `lr-after-show`/`lr-after-hide` wait, so a lifecycle interrupted by
   *  the opposite transition (or by a disconnect) never announces a completion that never
   *  happened. */
  private transitionToken = 0;
  /** Target currently in its cancelable lifecycle preflight. Writes from a listener are captured
   * here so same-target requests coalesce and an opposite request supersedes the outer commit. */
  private openRequestTarget?: boolean;
  private openRequestDuringPreflight?: boolean;
  private transitionAnimations: Animation[] = [];
  private initialFocusDecision?: boolean;
  private readonly headingId = nextId('dialog-heading');
  private externalModalDepth = 0;

  /** Shoelace-compatible modal controller. External activation suspends this dialog's focus/Escape
   * ownership without changing its logical `open` state; deactivation restores it. */
  modal: LyraDialogModalController = {
    activateExternal: () => {
      this.externalModalDepth++;
      if (this.externalModalDepth === 1) this.overlay?.suspend();
    },
    deactivateExternal: () => {
      if (this.externalModalDepth === 0) return;
      this.externalModalDepth--;
      if (this.externalModalDepth === 0 && this.open && this.modalSurface) {
        this.overlay?.resume();
        queueMicrotask(() => this.focusInitial());
      }
    },
  };

  /** Drawer overrides this for its nonmodal `contained` mode. */
  protected get modalSurface(): boolean {
    return true;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.hasUpdated) {
      this.hasFooterSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'footer');
      this.detectLightDomChrome();
    }
    if (changed.has('open')) {
      this.flushPendingScrollLockRelease();
      if (this.open) {
        if (this.isConnected && this.modalSurface) this.activateOverlay();
      } else {
        this.pendingScrollLockRelease = this.deactivateOverlay({ deferScrollLockRelease: true });
      }
    }
  }

  /** Releases a scroll lock held past its close so a component's own exit animation can finish
   *  first. Safe to call unconditionally -- a no-op once already flushed or when nothing is
   *  pending. */
  private flushPendingScrollLockRelease(): void {
    const release = this.pendingScrollLockRelease;
    this.pendingScrollLockRelease = undefined;
    release?.();
  }

  // Runs after render so the manager can resolve the panel and its composed
  // focus targets, including controls projected through either slot.
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('open') && this.open && this.isConnected && this.modalSurface) {
      this.enterTopLayer();
      this.focusInitial();
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.armHeadingObserver();
    // A reconnect (e.g. a drag-and-drop reparent keeping this same element
    // instance) fires disconnectedCallback then connectedCallback
    // synchronously with no update in between, so willUpdate never reruns to
    // notice `open` is still true -- restore the scroll lock/trap it dropped.
    // Top-layer membership is dropped by the browser itself on removal, so it is re-established
    // here too.
    if (this.hasUpdated && this.open && this.modalSurface) {
      if (this.overlay?.isActive()) {
        this.overlay.resume();
      } else {
        this.activateOverlay();
      }
      this.enterTopLayer();
      queueMicrotask(() => this.focusInitial());
    }
  }

  override disconnectedCallback(): void {
    this.resetHeadingObserver();
    super.disconnectedCallback();
    this.overlay?.suspend();
    // Transient exit-animation state never survives a detach: a reattached dialog re-runs its
    // own lifecycle from scratch, and a pending after-event must not fire for a transition the
    // element is no longer part of. A scroll lock held past `willUpdate` to survive that
    // now-abandoned animation has nothing left to visually protect either -- release it here
    // rather than leaving it stranded forever (settleTransition()'s own release never runs, since
    // the bumped token makes it return before reaching its `'lr-after-hide'` branch).
    this.transitionToken++;
    this.flushPendingScrollLockRelease();
    this.cancelTransitionAnimations();
    this.removeAttribute('data-closing');
    if (this.open) {
      // A reparent (drag-and-drop moving this same element instance to a new
      // parent) fires disconnectedCallback immediately followed by a
      // synchronous connectedCallback, with no turn of the event loop in
      // between -- deferring this check a microtask lets that case
      // short-circuit here once isConnected is true again, so only a genuine
      // removal (the element still disconnected once microtasks flush) ever
      // reaches the assignment below. Without this, removing an open dialog
      // any way other than its own close() (a consumer's own DOM cleanup, a
      // parent re-render that drops it, etc.) never fires
      // `lr-close`, so e.g. confirm()'s returned promise hangs forever.
      queueMicrotask(() => {
        if (!this.isConnected && this.open) {
          // Dialog removal cannot be vetoed because the element is already gone. A mapped drawer,
          // however, promises an always-cancelable hide request; vetoing that request keeps its
          // open state ready for a later reconnect and suppresses the settled close lifecycle.
          const hide = this.emit(
            'lr-hide',
            { source: this },
            { cancelable: this.disconnectHideCancelable },
          );
          if (hide.defaultPrevented) {
            this.syncOpenAttribute();
            return;
          }
          this.applyOpenState(false);
          this.emit('lr-close', 'unmount');
          this.emit('lr-after-hide');
        }
      });
    }
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.resetHeadingObserver();
  }

  private armHeadingObserver(): void {
    const ownerDocument = this.ownerDocument;
    if (!this.isConnected) return;
    if (this.headingObserver && this.headingObserverDocument === ownerDocument) return;
    this.resetHeadingObserver();
    const MutationObserverCtor = ownerDocument.defaultView?.MutationObserver;
    if (!MutationObserverCtor) return;
    const generation = this.headingObserverGeneration;
    const observer = new MutationObserverCtor(() => {
      if (
        this.headingObserver !== observer ||
        this.headingObserverDocument !== ownerDocument ||
        this.headingObserverGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      this.detectLightDomChrome();
    });
    this.headingObserver = observer;
    this.headingObserverDocument = ownerDocument;
    observer.observe(this, { childList: true, characterData: true, subtree: true });
  }

  private resetHeadingObserver(): void {
    this.headingObserverGeneration += 1;
    this.headingObserver?.disconnect();
    this.headingObserver = undefined;
    this.headingObserverDocument = undefined;
  }

  /** Whether an external-removal hide request can preserve open state for a later reconnect. */
  protected get disconnectHideCancelable(): boolean {
    return false;
  }

  private onDefaultSlotChange = (): void => {
    this.detectLightDomChrome();
  };

  private onFooterSlotChange = (e: Event): void => {
    this.hasFooterSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  // Only direct children are scanned -- a heading nested several layers deep
  // (or inside a slotted custom element's own shadow root) is left to the
  // consumer to label explicitly via `label` instead. Same depth limit
  // lr-widget applies to its own actions-slot presence check. Slot assignment
  // changes and light-DOM character mutations both feed this method so the
  // copied shadow-owner name never becomes stale. The named-slot children are read here
  // rather than from a slotchange handler because the slots they target only exist once the
  // header row is rendered, and the header row's existence depends on this very answer.
  private detectLightDomChrome(): void {
    const children = Array.from(this.children);
    const heading = children.find(
      (el) => el.getAttribute('slot') === null && el.matches(HEADING_SELECTOR),
    ) as HTMLElement | undefined;
    this.headingText = heading?.textContent?.trim() || undefined;
    this.hasLabelSlot = children.some((el) => el.getAttribute('slot') === 'label');
    this.hasHeaderActionsSlot = children.some((el) => el.getAttribute('slot') === 'header-actions');
  }

  /**
   * Open the dialog. Emits `lr-show` first — a listener calling `preventDefault()` leaves the
   * dialog closed and the `open` attribute untouched — then `lr-after-show` once the enter
   * animation has finished.
   */
  show(): Promise<void> {
    if (this.coalesceOpenRequest(true)) return Promise.resolve();
    if (this._open) return Promise.resolve();
    this.beginOpenRequest(true);
    const prevented = this.emit('lr-show', null, { cancelable: true }).defaultPrevented;
    const superseded = this.openRequestWasSuperseded(true);
    this.finishOpenRequest();
    if (prevented || superseded) {
      this.syncOpenAttribute();
      return Promise.resolve();
    }
    this.cancelTransitionAnimations();
    this.removeAttribute('data-closing');
    this.applyOpenState(true);
    return this.settleTransition('lr-after-show');
  }

  /**
   * Close the dialog with reason `'api'`. Identical to `close()`; it exists so every Lyra overlay
   * exposes the same `show()`/`hide()`/`open` surface.
   */
  hide(): Promise<void> {
    return this.close('api');
  }

  /**
   * Close the dialog and return focus to whatever had it before the dialog
   * opened. `reason` is forwarded as the `lr-close` detail --
   * built-in triggers pass `'escape'`/`'backdrop'`/`'close-button'`; a
   * consumer's own close affordance (e.g. a footer Cancel button) should
   * call this directly with its own reason string, so every dismissal path
   * funnels through the same event instead of the consumer having to also
   * toggle `open` itself. `lr-hide` is emitted first and vetoing it stops
   * `lr-close` from being emitted at all.
   */
  close(reason: DialogCloseReason = 'api'): Promise<void> {
    return this.closeFrom(reason, this);
  }

  private closeFrom(reason: DialogCloseReason, source: Element): Promise<void> {
    if (this.coalesceOpenRequest(false)) return Promise.resolve();
    if (!this._open) return Promise.resolve();
    this.beginOpenRequest(false);
    if (
      this.emit('lr-hide', { source }, { cancelable: true }).defaultPrevented ||
      this.openRequestWasSuperseded(false)
    ) {
      this.finishOpenRequest();
      this.syncOpenAttribute();
      return Promise.resolve();
    }
    const close = this.emit('lr-close', reason, { cancelable: true });
    if (close.defaultPrevented || this.openRequestWasSuperseded(false)) {
      this.finishOpenRequest();
      this.syncOpenAttribute();
      return Promise.resolve();
    }
    this.finishOpenRequest();
    this.cancelTransitionAnimations();
    if (this.isConnected) this.setAttribute('data-closing', '');
    this.applyOpenState(false);
    return this.settleTransition('lr-after-hide');
  }

  private coalesceOpenRequest(next: boolean): boolean {
    if (this.openRequestTarget === undefined) return false;
    this.openRequestDuringPreflight = next;
    return true;
  }

  private beginOpenRequest(next: boolean): void {
    this.openRequestTarget = next;
    this.openRequestDuringPreflight = undefined;
  }

  private openRequestWasSuperseded(next: boolean): boolean {
    return this.openRequestDuringPreflight !== undefined &&
      this.openRequestDuringPreflight !== next;
  }

  private finishOpenRequest(): void {
    this.openRequestTarget = undefined;
    this.openRequestDuringPreflight = undefined;
  }

  private applyOpenState(next: boolean): void {
    const old = this._open;
    this._open = next;
    if (next) this.initialFocusDecision = undefined;
    this.requestUpdate('open', old);
  }

  /** A vetoed transition must leave the reflected attribute agreeing with the property. Lit only
   *  reflects properties it saw change, and an attribute a consumer wrote by hand (or a Lit
   *  `?open=` binding wrote) is already on the element by the time the veto is known. */
  private syncOpenAttribute(): void {
    this.toggleAttribute('open', this._open);
  }

  protected panelAnimationName(showing: boolean): string {
    return showing ? 'dialog.show' : 'dialog.hide';
  }

  protected overlayAnimationName(showing: boolean): string {
    return showing ? 'dialog.overlay.show' : 'dialog.overlay.hide';
  }

  protected panelAnimationSpec(showing: boolean): RegisteredAnimationSpec {
    const offset = 'translateY(calc(-1 * var(--lr-size-0-5rem)))';
    return {
      keyframes: showing
        ? [{ opacity: 0, transform: offset }, { opacity: 1, transform: 'translateY(0)' }]
        : [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: offset }],
      durationProperties: [
        showing ? '--show-duration' : '--hide-duration',
        '--lr-dialog-panel-duration',
        '--lr-duration-base',
      ],
      easingProperties: ['--lr-easing-standard'],
    };
  }

  protected overlayAnimationSpec(showing: boolean): RegisteredAnimationSpec {
    return {
      keyframes: showing ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }],
      durationProperties: [
        showing ? '--show-duration' : '--hide-duration',
        '--lr-dialog-backdrop-duration',
        '--lr-duration-fast',
      ],
      easingProperties: ['--lr-easing-standard'],
    };
  }

  private cancelTransitionAnimations(): void {
    for (const animation of this.transitionAnimations) animation.cancel();
    this.transitionAnimations = [];
  }

  /** Resolves once the registry-backed panel/backdrop animation has finished, then emits the
   * matching `lr-after-*` event. A `null` registration intentionally skips native motion but
   * retains the same event and promise lifecycle. */
  private async settleTransition(event: 'lr-after-show' | 'lr-after-hide'): Promise<void> {
    const token = ++this.transitionToken;
    await this.updateComplete;
    if (this.transitionToken !== token) return;
    // Nothing animates while detached, so the wait below is skipped there rather than swallowing
    // the event -- a dialog opened before it was ever mounted still completes its lifecycle. A
    // dialog *removed* mid-transition is different: disconnectedCallback bumps the token, and the
    // unmount path emits its own complete close sequence.
    if (this.isConnected) {
      const root = this.renderRoot as ShadowRoot;
      const panel = root.querySelector<HTMLElement>('[part~="panel"]');
      const backdrop = root.querySelector<HTMLElement>('[part~="backdrop"]');
      const showing = event === 'lr-after-show';
      const animations = [
        panel
          ? animateRegistered(
              this,
              panel,
              this.panelAnimationName(showing),
              this.effectiveDirection,
              this.panelAnimationSpec(showing),
            )
          : undefined,
        this.modalSurface && backdrop
          ? animateRegistered(
              this,
              backdrop,
              this.overlayAnimationName(showing),
              this.effectiveDirection,
              this.overlayAnimationSpec(showing),
            )
          : undefined,
      ].filter((animation): animation is Animation => animation !== undefined);
      this.transitionAnimations = animations;
      await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
      if (this.transitionToken !== token) return;
      this.cancelTransitionAnimations();
    }
    if (event === 'lr-after-hide') {
      this.removeAttribute('data-closing');
      this.leaveTopLayer();
      this.flushPendingScrollLockRelease();
    }
    this.emit(event);
  }

  /**
   * Promotes the host into the browser top layer for as long as it is open, so a consumer's
   * stacking context (a `transform`ed ancestor, an `isolation: isolate` wrapper, a
   * `z-index: 2147483647` header) cannot render on top of a modal dialog — which no `z-index`
   * value can prevent on its own. `manual` rather than `auto`: light dismiss and Escape are this
   * component's own contract, routed through the shared overlay manager so only the topmost
   * dialog reacts, and an `auto` popover would close on the user agent's terms instead. The
   * `z-index` in the stylesheet remains as the fallback for a user agent without popover support.
   */
  protected enterTopLayer(): void {
    if (!this.isConnected || typeof this.showPopover !== 'function') return;
    if (this.getAttribute('popover') !== 'manual') this.setAttribute('popover', 'manual');
    try {
      if (!this.isTopLayer()) this.showPopover();
    } catch {
      // A user agent that rejects the call leaves the dialog on the z-index fallback path.
    }
  }

  protected leaveTopLayer(): void {
    if (typeof this.hidePopover !== 'function') return;
    try {
      if (this.isTopLayer()) this.hidePopover();
    } catch {
      // Already hidden, or never promoted.
    }
  }

  private isTopLayer(): boolean {
    try {
      return this.matches(':popover-open');
    } catch {
      return false;
    }
  }

  private onBackdropClick = (): void => {
    if (!this.lightDismiss) return;
    this.overlay?.dismissBackdrop();
  };

  private onCloseButtonClick = (): void => {
    const button = this.renderRoot.querySelector('[part~="close-button"]') ?? this;
    this.requestClose('close-button', 'close-button', button);
  };

  private requestClose(
    source: LyraDialogRequestCloseSource,
    reason: DialogCloseReason,
    sourceElement: Element,
  ): void {
    if (this.emit('lr-request-close', { source }, { cancelable: true }).defaultPrevented) {
      return;
    }
    void this.closeFrom(reason, sourceElement);
  }

  protected focusInitial(): void {
    this.overlay?.focusInitial();
  }

  protected activateOverlay(): void {
    if (!this.isConnected || this.overlay?.isActive()) return;
    this.overlay = activateOverlay({
      host: this,
      panel: () => this.shadowRoot?.querySelector<HTMLElement>('[part~="panel"]') ?? null,
      onEscape: () => {
        const panel = this.renderRoot.querySelector('[part~="panel"]') ?? this;
        this.requestClose('keyboard', 'escape', panel);
      },
      onBackdrop: () => {
        const backdrop = this.renderRoot.querySelector('[part~="backdrop"]') ?? this;
        this.requestClose('overlay', 'backdrop', backdrop);
      },
      // Preserve Lyra's body-first initial-focus contract now that the mapped close affordance is
      // present by default. Explicit autofocus still wins inside the manager; with no body target,
      // the panel itself is the safe fallback instead of an unexpectedly destructive close action.
      preferredInitialFocus: () => {
        const panel = this.renderRoot.querySelector<HTMLElement>('[part~="panel"]');
        const body = this.renderRoot.querySelector<HTMLElement>('[part="body"]');
        const stops = body ? collectFocusableElements(body) : [];
        // The body itself is in that list only while it is an overflowing scroll region, and it
        // sorts ahead of its own descendants. A real control inside it still wins the body-first
        // contract; the scroller is the fallback that keeps pure prose reachable.
        return stops.find((stop) => stop !== body) ?? stops[0] ?? panel;
      },
      beforeInitialFocus: () => {
        if (this.initialFocusDecision === undefined) {
          this.initialFocusDecision = !this.emit('lr-initial-focus', null, { cancelable: true }).defaultPrevented;
        }
        return this.initialFocusDecision;
      },
      lockScroll: true,
      suspendWhenUnrendered: true,
    });
    if (this.externalModalDepth > 0) this.overlay.suspend();
  }

  protected deactivateOverlay(options?: OverlayDeactivateOptions): (() => void) | undefined {
    const overlay = this.overlay;
    this.overlay = undefined;
    return overlay?.deactivate(options);
  }

  override render(): TemplateResult {
    // Naming precedence (see class doc): host aria-label, accessible-label, a direct light-DOM
    // heading, then the shadow-owned visible title. Only the final case uses aria-labelledby.
    const suppressHeader = this.withoutHeader || this.noHeader;
    const renderHeading =
      !suppressHeader && !this.headingText && (this.hasLabelSlot || this.label.length > 0 || !!this.heading);
    const hasHostName = this.hostAriaLabel !== null;
    const explicitName = hasHostName ? this.hostAriaLabel : this.accessibleLabel || this.headingText;
    const hasExplicitName = hasHostName || Boolean(explicitName);
    const useHeadingForName = !hasExplicitName && renderHeading;
    const showHeader =
      !suppressHeader && (renderHeading || this.hasHeaderActionsSlot || this.closable);
    const headingLevel = resolveHeadingLevel(this.headingLevel);
    return html`
      <div part="base">
        <div part="backdrop overlay" @click=${this.onBackdropClick}></div>
        <div
          part="panel dialog"
          role=${this.open ? 'dialog' : nothing}
          aria-modal=${this.open && this.modalSurface ? 'true' : nothing}
          aria-label=${hasExplicitName ? explicitName : nothing}
          aria-labelledby=${useHeadingForName ? this.headingId : nothing}
          tabindex="-1"
        >
          ${showHeader
            ? html`
                <div part="header">
                  ${renderHeading
                    ? html`<span
                        id=${this.headingId}
                        part="heading title label"
                        role=${headingLevel ? 'heading' : nothing}
                        aria-level=${headingLevel ?? nothing}
                        ><slot name="label">${this.label || this.heading}</slot></span
                      >`
                    : nothing}
                  ${this.hasHeaderActionsSlot
                    ? html`<span part="header-actions"><slot name="header-actions"></slot></span>`
                    : nothing}
                  ${this.closable
                    ? html`
                        <button
                          part="close-button close-button__base"
                          type="button"
                          aria-label=${this.localize('close')}
                          @click=${this.onCloseButtonClick}
                        >
                          ${closeIcon()}
                        </button>
                      `
                    : nothing}
                </div>
              `
            : nothing}
          <!-- tabindex keeps the scrolling body reachable: it is the element that overflows, so a
               dialog holding only prose, a table, or a rendered document would otherwise be
               mouse-scrollable with no keyboard way in at all. -1 keeps it out of the page's
               sequential order; the overlay manager promotes it to a stop only while it actually
               scrolls (see isOverflowingAndTabbable in internal/overlay-manager.ts). -->
          <div part="body" tabindex="-1">
            <slot @slotchange=${this.onDefaultSlotChange}></slot>
          </div>
          <div part="footer" ?hidden=${!this.hasFooterSlot && !this.withFooter}>
            <slot name="footer" @slotchange=${this.onFooterSlotChange}></slot>
          </div>
        </div>
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-dialog': LyraDialog;
  }
}
