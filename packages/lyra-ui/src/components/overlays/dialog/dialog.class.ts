import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { activateOverlay, type OverlayHandle } from '../../../internal/overlay-manager.js';
import { nextId, srOnly } from '../../../internal/a11y.js';
import { closeIcon } from '../../../internal/icons.js';
import { styles } from './dialog.styles.js';

const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6, [role="heading"]';

/**
 * Reason a dialog was dismissed, forwarded as the `lr-dialog-close` event
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

export interface LyraDialogEventMap {
  'lr-show': CustomEvent<undefined>;
  'lr-after-show': CustomEvent<undefined>;
  'lr-hide': CustomEvent<undefined>;
  'lr-after-hide': CustomEvent<undefined>;
  'lr-dialog-close': CustomEvent<DialogCloseReason>;
}
/**
 * `<lr-dialog>` — a general-purpose modal/overlay. `role="dialog"`,
 * focus-trapped while open, dismissible via Escape or (opt-in) a backdrop click, and
 * scroll-locks the document for as long as it's open. While open it is promoted into the
 * browser top layer, so no consumer stacking context can render on top of it. Chrome stays
 * minimal by default — no built-in title bar or close button; a consumer supplies a
 * heading and any close affordance itself via the default/`footer` slots.
 * `heading`/`label`-slot/`closable` are an opt-in convenience for the common case where
 * hand-building that chrome isn't worth it (see below).
 *
 * Lifecycle: `show()` emits `lr-show` (cancelable) and then, once the enter animation has
 * finished, `lr-after-show`. `hide()`/`close()` emit `lr-hide` (cancelable), then
 * `lr-dialog-close` (cancelable, carrying the dismissal reason), then — once the exit animation
 * has finished — `lr-after-hide`. Assigning `open` runs the same lifecycle, so the property, the
 * reflected attribute, and the two method calls can never disagree. Markup that renders open
 * from the start emits nothing, matching `<lr-menu>`.
 *
 * Accessible name / visible header, in priority order:
 * 0. If the host element itself has an `aria-label` attribute set, its value
 *    becomes `aria-label` on the panel outright, overriding every source
 *    below (including a slotted heading) — the standard ARIA convention for
 *    a consumer that wants full control over the announced name regardless
 *    of whatever `heading`/`label` props are also set. This naming override
 *    does not suppress visible `heading` chrome; sighted users still receive
 *    the heading text the consumer supplied.
 * 1. Otherwise, if a heading element (`h1`–`h6` or `[role="heading"]`) is an *unslotted
 *    direct child*, its text content becomes `aria-label` on the panel —
 *    unchanged, and takes priority over `heading` below so an existing consumer that already
 *    slots its own heading keeps rendering it exactly as before.
 * 2. Otherwise, when the `label` slot is filled or `heading` is set, a visible header row
 *    (`part="header"`) renders containing that content (`part="heading"`), which becomes the
 *    `aria-labelledby` target. The slot wins over the plain-string `heading` when both are
 *    supplied, since it is the richer of the two.
 * 3. Otherwise, when the `label` *property* is set, an invisible (`.sr-only`, exposed as the
 *    `label` part) element carrying that text is rendered inside the panel
 *    and `aria-labelledby` points at it instead.
 * Only one of cases 2/3 ever names the panel at a time, so exactly one element ever
 * claims `aria-labelledby`. The `label` property itself never renders visible chrome on
 * its own — `::part(label)` can be restyled to make the sr-only text visible,
 * or `heading`/the `label` slot can be used instead, if a consumer wants visible chrome without
 * slotting a real heading element. (The `label` *slot* and the `label` *property* are separate
 * knobs: the slot is rich visible header content, the property is a screen-reader-only name.)
 *
 * The slotted-heading case deliberately uses `aria-label` (a copied string)
 * rather than `aria-labelledby` pointing at the heading's `id`: the heading is
 * *light-DOM* content while `[part="panel"]` lives in this element's
 * *shadow* tree, and an ID-reference attribute can't resolve across that
 * boundary (verified against axe's `aria-dialog-name` rule) — unlike the
 * `heading`/`label`-prop cases above, where the target element is rendered
 * inside the same shadow root it labels, so `aria-labelledby` there is safe.
 * The `label` *slot* is safe for the same reason: `aria-labelledby` targets the shadow-owned
 * `part="heading"` wrapper, and the accessible-name computation flattens the slot inside it.
 *
 * `closable` renders a close (X) button in the header row (creating one, with
 * no heading text, if neither `heading` nor the `label` slot is set) that closes the dialog via
 * the same `close()` path as Escape/backdrop-dismiss, with reason `'close-button'`.
 *
 * Stacking: opening one `<lr-dialog>` while another is already open (e.g. a
 * `confirm()` launched from within an already-open dialog) is supported --
 * Escape and the Tab focus trap only ever act on the topmost open dialog, so
 * dialogs beneath it stay open and untouched until the one on top closes.
 *
 * @customElement lr-dialog
 * @slot - The dialog body.
 * @slot label - Rich header content, rendered in the header row and used as the panel's
 *   accessible name. Wins over the plain-string `heading`.
 * @slot header-actions - Extra controls rendered in the header row, before the built-in close
 *   button.
 * @slot footer - Action buttons, rendered in a bottom row.
 * @event lr-show - The dialog is about to open. Cancelable — `preventDefault()` keeps it closed.
 * @event lr-after-show - The dialog is open and its enter animation has finished.
 * @event lr-hide - The dialog is about to close, for every dismissal path. Cancelable —
 *   `preventDefault()` keeps it open and stops `lr-dialog-close` from firing at all.
 * @event lr-after-hide - The dialog is closed and its exit animation has finished.
 * @event lr-dialog-close - `detail: DialogCloseReason`. Cancelable — a listener calling
 *   `preventDefault()` stops the dialog from closing, for every dismissal path (Escape, backdrop,
 *   the built-in close button, `hide()`, `open = false`, or a consumer's own `close()` call).
 *   Fires after `lr-hide` and carries the one thing `lr-hide` does not: which affordance asked
 *   for the close. Also fired (with reason `'unmount'`, non-cancelable there since the element is
 *   already being removed) when the dialog is removed from the DOM while still open.
 * @csspart backdrop - The full-viewport scrim behind the panel.
 * @csspart panel - The dialog panel itself (`role="dialog"` while open). Shrink-wraps to its
 *   content by default, capped at `--lr-dialog-max-width` (default `32rem`); set
 *   `--lr-dialog-width` for an assertive width instead of only a cap.
 * @csspart header - The header row, rendered when the `label` slot is filled, `heading` is set
 *   (and no heading is slotted into the default slot), `header-actions` is filled, and/or
 *   `closable` is `true` — and never when `withoutHeader` is set.
 * @csspart heading - The visible heading element inside `header`, wrapping the `label` slot and
 *   falling back to the `heading` text.
 * @csspart header-actions - The wrapper around the `header-actions` slot.
 * @csspart close-button - The built-in close button, rendered inside `header`
 *   only when `closable` is `true`.
 * @csspart label - The invisible `label`-property element used for
 *   `aria-labelledby` when no heading is slotted and neither `heading` nor the `label` slot is
 *   set.
 * @csspart body - The wrapper around the default slot.
 * @csspart footer - The wrapper around the `footer` slot.
 * @cssprop [--lr-dialog-overlay-color=var(--lr-color-overlay)] - Backdrop scrim color.
 * @cssprop [--lr-dialog-backdrop-filter=none] - `backdrop-filter` applied to the scrim, for a
 *   frosted-glass treatment over the page behind it.
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
 */
export class LyraDialog extends LyraElement<LyraDialogEventMap> {
  static override styles = [LyraElement.styles, srOnly, styles];

  private _open = false;

  /**
   * Whether the dialog is open. Assigning it runs the full `lr-show`/`lr-hide` lifecycle, so it
   * stays in sync with `show()`/`hide()`/`close()` and can be vetoed the same way. Markup that
   * renders open from the start emits nothing.
   */
  @property({ type: Boolean, reflect: true })
  get open(): boolean {
    return this._open;
  }
  set open(next: boolean) {
    const normalized = Boolean(next);
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

  /** Screen-reader-only accessible name used when no heading is slotted and neither `heading` nor
   *  the `label` slot is set — see the class doc for the full fallback order. */
  @property() label = '';

  /** Visible header text, rendered when no heading element is slotted into
   *  the default slot and the `label` slot is empty — see the class doc for the full fallback
   *  order. Has no effect (renders nothing) if a light-DOM heading is slotted; that case
   *  keeps working completely unchanged whether or not `heading` is set. */
  @property() heading?: string;

  /** Renders a built-in close (X) button in the header row (creating one,
   *  with no heading text, if `heading` is unset), wired to the same
   *  `close()` path Escape/backdrop-dismiss already use, with reason
   *  `'close-button'`. */
  @property({ type: Boolean, attribute: 'closable' }) closable = false;

  /** Suppresses the header row entirely, whatever `heading`, `closable`, the `label` slot or the
   *  `header-actions` slot would otherwise render. For a dialog that owns its own chrome. */
  @property({ type: Boolean, attribute: 'without-header', reflect: true }) withoutHeader = false;

  /** Host-level `aria-label` override for the panel's accessible name — wins over every other
   *  naming source (a slotted heading, the `label` slot, `heading`, the `label` property) without
   *  suppressing visible heading chrome, matching `<lr-date-input>`'s `accessibleLabel` pattern.
   *  See the class doc for the full precedence order. Set as a plain `aria-label` attribute on
   *  `<lr-dialog>` itself, not a public JS property. */
  @property({ attribute: 'aria-label' }) private accessibleLabel: string | null = null;

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
  private headingObserver?: MutationObserver;
  /** Invalidates any in-flight `lr-after-show`/`lr-after-hide` wait, so a lifecycle interrupted by
   *  the opposite transition (or by a disconnect) never announces a completion that never
   *  happened. */
  private transitionToken = 0;
  private readonly srLabelId = nextId('dialog-label');
  private readonly headingId = nextId('dialog-heading');

  protected override willUpdate(changed: PropertyValues): void {
    if (!this.hasUpdated) {
      this.hasFooterSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'footer');
      this.detectLightDomChrome();
    }
    if (changed.has('open')) {
      if (this.open) {
        if (this.isConnected) this.activateOverlay();
      } else {
        this.deactivateOverlay();
      }
    }
  }

  // Runs after render so the manager can resolve the panel and its composed
  // focus targets, including controls projected through either slot.
  protected override updated(changed: PropertyValues): void {
    if (changed.has('open') && this.open && this.isConnected) {
      this.enterTopLayer();
      this.overlay?.focusInitial();
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.headingObserver ??= new MutationObserver(() => this.detectLightDomChrome());
    this.headingObserver.observe(this, { childList: true, characterData: true, subtree: true });
    // A reconnect (e.g. a drag-and-drop reparent keeping this same element
    // instance) fires disconnectedCallback then connectedCallback
    // synchronously with no update in between, so willUpdate never reruns to
    // notice `open` is still true -- restore the scroll lock/trap it dropped.
    // Top-layer membership is dropped by the browser itself on removal, so it is re-established
    // here too.
    if (this.hasUpdated && this.open) {
      if (this.overlay?.isActive()) {
        this.overlay.resume();
      } else {
        this.activateOverlay();
      }
      this.enterTopLayer();
      queueMicrotask(() => this.overlay?.focusInitial());
    }
  }

  override disconnectedCallback(): void {
    this.headingObserver?.disconnect();
    super.disconnectedCallback();
    this.overlay?.suspend();
    // Transient exit-animation state never survives a detach: a reattached dialog re-runs its
    // own lifecycle from scratch, and a pending after-event must not fire for a transition the
    // element is no longer part of.
    this.transitionToken++;
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
      // `lr-dialog-close`, so e.g. confirm()'s returned promise hangs forever.
      queueMicrotask(() => {
        if (!this.isConnected && this.open) {
          this.applyOpenState(false);
          // Removal cannot be vetoed -- the element is already gone -- so none of these three is
          // cancelable here, and there is no exit animation left to wait on.
          this.emit('lr-hide');
          this.emit<DialogCloseReason>('lr-dialog-close', 'unmount');
          this.emit('lr-after-hide');
        }
      });
    }
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
  show(): void {
    if (this._open) return;
    if (this.emit('lr-show', undefined, { cancelable: true }).defaultPrevented) {
      this.syncOpenAttribute();
      return;
    }
    this.removeAttribute('data-closing');
    this.applyOpenState(true);
    void this.settleTransition('lr-after-show');
  }

  /**
   * Close the dialog with reason `'api'`. Identical to `close()`; it exists so every Lyra overlay
   * exposes the same `show()`/`hide()`/`open` surface.
   */
  hide(): void {
    this.close('api');
  }

  /**
   * Close the dialog and return focus to whatever had it before the dialog
   * opened. `reason` is forwarded as the `lr-dialog-close` detail --
   * built-in triggers pass `'escape'`/`'backdrop'`/`'close-button'`; a
   * consumer's own close affordance (e.g. a footer Cancel button) should
   * call this directly with its own reason string, so every dismissal path
   * funnels through the same event instead of the consumer having to also
   * toggle `open` itself. `lr-hide` is emitted first and vetoing it stops
   * `lr-dialog-close` from being emitted at all.
   */
  close(reason: DialogCloseReason = 'api'): void {
    if (!this._open) return;
    if (this.emit('lr-hide', undefined, { cancelable: true }).defaultPrevented) {
      this.syncOpenAttribute();
      return;
    }
    if (this.emit<DialogCloseReason>('lr-dialog-close', reason, { cancelable: true }).defaultPrevented) {
      this.syncOpenAttribute();
      return;
    }
    if (this.isConnected) this.setAttribute('data-closing', '');
    this.applyOpenState(false);
    void this.settleTransition('lr-after-hide');
  }

  private applyOpenState(next: boolean): void {
    const old = this._open;
    this._open = next;
    this.requestUpdate('open', old);
  }

  /** A vetoed transition must leave the reflected attribute agreeing with the property. Lit only
   *  reflects properties it saw change, and an attribute a consumer wrote by hand (or a Lit
   *  `?open=` binding wrote) is already on the element by the time the veto is known. */
  private syncOpenAttribute(): void {
    this.toggleAttribute('open', this._open);
  }

  /**
   * Resolves once the current enter/exit animation on the panel and the backdrop has finished,
   * then emits the matching `lr-after-*` event. Both surfaces resolve their duration through the
   * shared `--lr-duration-*` tokens, which the token layer flattens to 0.001ms under
   * `prefers-reduced-motion: reduce` — so this settles in that branch too rather than being
   * skipped, and the event contract holds either way.
   */
  private async settleTransition(event: 'lr-after-show' | 'lr-after-hide'): Promise<void> {
    const token = ++this.transitionToken;
    await this.updateComplete;
    if (this.transitionToken !== token) return;
    // Nothing animates while detached, so the wait below is skipped there rather than swallowing
    // the event -- a dialog opened before it was ever mounted still completes its lifecycle. A
    // dialog *removed* mid-transition is different: disconnectedCallback bumps the token, and the
    // unmount path emits its own complete close sequence.
    if (this.isConnected) {
      // A CSS animation is created during the style recalculation that follows the render, so read
      // the running animations only after the browser has had a frame to produce them.
      const view = this.ownerDocument.defaultView;
      if (view) await new Promise<void>((resolve) => view.requestAnimationFrame(() => resolve()));
      if (this.transitionToken !== token) return;
      const root = this.renderRoot as ShadowRoot;
      const surfaces = [root.querySelector('[part="panel"]'), root.querySelector('[part="backdrop"]')];
      const animations = surfaces.flatMap((surface) => surface?.getAnimations() ?? []);
      await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
      if (this.transitionToken !== token) return;
    }
    if (event === 'lr-after-hide') {
      this.removeAttribute('data-closing');
      this.leaveTopLayer();
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
  private enterTopLayer(): void {
    if (!this.isConnected || typeof this.showPopover !== 'function') return;
    if (this.getAttribute('popover') !== 'manual') this.setAttribute('popover', 'manual');
    try {
      if (!this.isTopLayer()) this.showPopover();
    } catch {
      // A user agent that rejects the call leaves the dialog on the z-index fallback path.
    }
  }

  private leaveTopLayer(): void {
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
    this.close('close-button');
  };

  private activateOverlay(): void {
    if (!this.isConnected || this.overlay?.isActive()) return;
    this.overlay = activateOverlay({
      host: this,
      panel: () => this.shadowRoot?.querySelector<HTMLElement>('[part="panel"]') ?? null,
      onEscape: () => this.close('escape'),
      onBackdrop: () => this.close('backdrop'),
      lockScroll: true,
      suspendWhenUnrendered: true,
    });
  }

  private deactivateOverlay(): void {
    this.overlay?.deactivate();
    this.overlay = undefined;
  }

  override render(): TemplateResult {
    // Priority order (see class doc): a host-level aria-label attribute always wins; only when
    // it's unset does a slotted heading get a turn; only when there isn't one of those either does
    // the header heading (the `label` slot, else `heading`) get a turn, then the `label`
    // property's sr-only fallback -- never more than one of the two below claims aria-labelledby
    // for the same panel, and never more than one source ever claims aria-label.
    const renderHeading = !this.withoutHeader && !this.headingText && (this.hasLabelSlot || !!this.heading);
    const useHeadingForName = !this.accessibleLabel && renderHeading;
    const useSrLabel =
      !this.accessibleLabel && !this.headingText && !useHeadingForName && this.label.length > 0;
    const showHeader =
      !this.withoutHeader && (renderHeading || this.hasHeaderActionsSlot || this.closable);
    return html`
      <div part="backdrop" @click=${this.onBackdropClick}></div>
      <div
        part="panel"
        role=${this.open ? 'dialog' : nothing}
        aria-modal=${this.open ? 'true' : nothing}
        aria-label=${this.accessibleLabel ?? this.headingText ?? nothing}
        aria-labelledby=${useHeadingForName ? this.headingId : useSrLabel ? this.srLabelId : nothing}
        tabindex="-1"
      >
        ${useSrLabel
          ? html`<span id=${this.srLabelId} part="label" class="sr-only">${this.label}</span>`
          : nothing}
        ${showHeader
          ? html`
              <div part="header">
                ${renderHeading
                  ? html`<span id=${this.headingId} part="heading"
                      ><slot name="label">${this.heading}</slot></span
                    >`
                  : nothing}
                ${this.hasHeaderActionsSlot
                  ? html`<span part="header-actions"><slot name="header-actions"></slot></span>`
                  : nothing}
                ${this.closable
                  ? html`
                      <button
                        part="close-button"
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
        <div part="body">
          <slot @slotchange=${this.onDefaultSlotChange}></slot>
        </div>
        <div part="footer" ?hidden=${!this.hasFooterSlot}>
          <slot name="footer" @slotchange=${this.onFooterSlotChange}></slot>
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
