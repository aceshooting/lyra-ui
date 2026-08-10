import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { attachInternalsSafely } from '../../../internal/form-associated.js';
import { chevronIcon } from '../../../internal/icons.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraAppearance, LyraSize } from '../../../internal/variants.js';
import { sizes } from '../../../internal/sizes.styles.js';
import { styles } from './details.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_open, LYRA_DEFAULT_restore } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** The library's one size ladder, in either spelling. */
export type LyraDetailsSize = LyraSize;
/** Web Awesome's disclosure appearances. */
export type LyraDetailsAppearance = Exclude<LyraAppearance, 'accent'>;
/** Logical position of the disclosure icon. */
export type LyraDetailsIconPlacement = 'start' | 'end';

export interface LyraDetailsEventMap {
  'lr-show': CustomEvent<undefined>;
  'lr-after-show': CustomEvent<undefined>;
  'lr-hide': CustomEvent<undefined>;
  'lr-after-hide': CustomEvent<undefined>;
  'lr-toggle': CustomEvent<{ open: boolean }>;
}

/**
 * `<lr-details>` — an accessible disclosure panel.
 *
 * Lifecycle: opening emits `lr-show` (cancelable), then `lr-toggle`, then `lr-after-show`;
 * closing emits `lr-hide` (cancelable), then `lr-toggle`, then `lr-after-hide`. `show()`,
 * `hide()` and assigning `open` all run the same sequence, as does clicking (or activating with
 * the keyboard) the summary — the native `<details>` toggle is intercepted so a vetoed `lr-show`
 * cannot leave the panel visually expanded. Markup that renders open from the start emits
 * nothing.
 *
 * A present host `aria-label`, including an explicitly empty value, names the native summary
 * trigger. When absent, the summary retains its native name-from-content behavior.
 *
 * @customElement lr-details
 * @slot summary - Summary content. Takes priority over `summary` when any light-DOM child
 *   carries `slot="summary"` — the fallback localized "Details" text only appears when neither
 *   is set.
 * @slot expand-icon - Icon shown while the panel is closed.
 * @slot collapse-icon - Icon shown while the panel is open.
 * @slot - Panel content.
 * @event lr-show - The panel is about to open. Cancelable.
 * @event lr-after-show - The panel is open and its marker transition has finished.
 * @event lr-hide - The panel is about to close. Cancelable.
 * @event lr-after-hide - The panel is closed and its marker transition has finished.
 * @event lr-toggle - The disclosure state changed. `detail: { open }`. Kept alongside the four
 *   events above because it is the single event that reports which way the panel went, which
 *   `<lr-accordion>` uses to close the siblings of a newly-opened panel.
 * @csspart base - Compatibility name for the native details wrapper; use `details`.
 * @csspart details - The native details wrapper. It is the same node as `base`.
 * @csspart header - The summary-row layout wrapper.
 * @csspart summary - The summary control.
 * @csspart icon - The expand/collapse icon wrapper.
 * @csspart summary-icon - Shoelace-compatible alias for `icon`; both names are on the same node.
 * @csspart content - The panel content.
 * @cssprop [--lr-details-font-size=var(--lr-form-control-font-size)] - Text size of the summary
 *   and the panel. Each `size` tier sets it from the library's shared size ladder.
 * @cssprop [--lr-details-spacing=var(--lr-form-control-padding-inline)] - Block rhythm: the
 *   summary's block padding and the panel's trailing padding, kept equal so a stack of
 *   disclosures reads evenly. Each `size` tier sets it from the shared ladder's inline-padding
 *   knob, whose values suit a stacked panel; the ladder's own block padding exists to fit text
 *   inside a fixed control height and would collapse the summary row.
 * @cssprop [--lr-details-gap=var(--lr-space-s)] - Gap between summary content and its icon.
 * @cssprop [--lr-details-radius=var(--lr-radius)] - Disclosure surface corner radius.
 * @cssprop [--lr-details-outlined-bg=var(--lr-color-surface)] - Outlined surface background.
 * @cssprop [--lr-details-outlined-border-color=var(--lr-color-border)] - Outlined border color.
 * @cssprop [--lr-details-filled-bg=var(--lr-color-brand-quiet)] - Filled surface background.
 * @cssprop [--lr-details-filled-border-color=transparent] - Filled border color.
 * @cssprop [--lr-details-filled-outlined-bg=var(--lr-color-brand-quiet)] - Filled-outlined
 *   surface background.
 * @cssprop [--lr-details-filled-outlined-border-color=var(--lr-color-border)] - Filled-outlined
 *   border color.
 * @cssprop [--lr-details-summary-hover-bg=var(--lr-color-brand-quiet)] - Summary hover background.
 * @cssprop [--lr-details-summary-active-bg=color-mix(...)] - Summary pressed background.
 * @cssprop --spacing - Upstream-compatible spacing override for the summary and content.
 * @cssprop [--show-duration=var(--lr-duration-base)] - Expand-icon transition duration.
 * @cssprop [--hide-duration=var(--lr-duration-base)] - Collapse-icon transition duration.
 * @cssstate animating - Present while an expand/collapse transition is settling.
 * @status stable
 * @since 4.0.0
 */
export class LyraDetails extends LyraElement<LyraDetailsEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    open: LYRA_DEFAULT_open,
    restore: LYRA_DEFAULT_restore,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, sizes, styles];

  /** Shared with subclasses so one host never calls `attachInternals()` twice. */
  protected readonly detailsInternals = attachInternalsSafely(this);
  private _open = false;

  /** Whether the panel is expanded. Assigning it runs the full `lr-show`/`lr-hide` lifecycle and
   *  can be vetoed the same way, so the property, the reflected attribute and `show()`/`hide()`
   *  can never disagree. */
  @property({ type: Boolean, reflect: true })
  get open(): boolean {
    return this._open;
  }
  set open(next: boolean) {
    const normalized = Boolean(next);
    if (normalized === this._open) return;
    // Before the first render this is initial markup state, not a transition.
    if (!this.hasUpdated) {
      this.applyOpenState(normalized);
      return;
    }
    if (normalized) void this.show();
    else void this.hide();
  }

  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Groups disclosures in the same document or shadow root. Opening one closes its open peers. */
  @property({ reflect: true }) name = '';

  /** Visual surface treatment. */
  @property({ reflect: true }) appearance: LyraDetailsAppearance = 'outlined';

  /** Logical side of the expand/collapse icon. */
  @property({ attribute: 'icon-placement', reflect: true })
  iconPlacement: LyraDetailsIconPlacement = 'end';

  /** Visual density, on the library's shared ladder. Both spellings of every tier are accepted
   *  (`s`/`small`, `m`/`medium`, `l`/`large`), so markup migrated from Web Awesome or Shoelace
   *  needs no attribute rewrite. `m` reproduces the disclosure this component had before `size`
   *  existed. */
  @property({ reflect: true }) size: LyraDetailsSize = 'm';

  @property() summary = '';

  // `[part='summary']:empty` never matches because the part always contains a literal `<slot>`
  // child -- same fix `lr-avatar`/`lr-empty`/`lr-stat` already established. Track real
  // slot assignment in JS so the `summary` fallback text doesn't render alongside rich slotted
  // content (it previously always rendered whenever the plain-string `summary` prop was unset,
  // even with a `slot="summary"` child present).
  @state() private hasSummarySlot = false;

  /** Invalidates an in-flight `lr-after-*` wait when the opposite transition interrupts it. */
  private transitionToken = 0;

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed); // no-op today, but keeps any future LyraElement/mixin willUpdate logic wired in
    if (!this.hasUpdated) {
      this.hasSummarySlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'summary');
    }
  }

  override disconnectedCallback(): void {
    // A pending after-event must not announce a transition the detached element is no longer
    // part of.
    this.transitionToken++;
    setCustomState(this.detailsInternals, 'animating', false);
    super.disconnectedCallback();
  }

  override firstUpdated(): void {
    // Reconcile initially-open markup after every sibling has had a chance to upgrade. The last
    // open disclosure in document order wins, matching native named details grouping.
    if (this._open) this.closeNamedPeers();
  }

  /** Expand the panel. The promise resolves after `lr-after-show`; vetoed or disabled requests
   *  resolve without changing state. */
  async show(): Promise<void> {
    if (this._open || this.disabled) return;
    if (this.emit('lr-show', undefined, { cancelable: true }).defaultPrevented) {
      this.syncOpenAttribute();
      return;
    }
    if (!this.closeNamedPeers()) {
      this.syncOpenAttribute();
      return;
    }
    this.applyOpenState(true);
    await this.settleTransition('lr-after-show');
  }

  /** Collapse the panel. The promise resolves after `lr-after-hide`; vetoed requests resolve
   *  without changing state. */
  async hide(): Promise<void> {
    if (!this._open) return;
    if (this.emit('lr-hide', undefined, { cancelable: true }).defaultPrevented) {
      this.syncOpenAttribute();
      return;
    }
    this.applyOpenState(false);
    await this.settleTransition('lr-after-hide');
  }

  /** Close open peers that share this non-empty name. A custom element's internal native
   * `<details>` lives in its own shadow root, so the platform's native `name` grouping cannot
   * coordinate separate hosts; the hosts do that work here. */
  private closeNamedPeers(): boolean {
    if (!this.name) return true;
    const root = this.getRootNode() as ParentNode;
    if (typeof root.querySelectorAll !== 'function') return true;
    let allClosed = true;
    for (const candidate of root.querySelectorAll(this.localName)) {
      if (
        candidate !== this &&
        candidate instanceof LyraDetails &&
        candidate.name === this.name &&
        candidate.open
      ) {
        void candidate.hide();
        // hide() applies accepted state synchronously before its Promise waits for motion. If a
        // peer vetoes lr-hide it is still open here, so this disclosure must not create a
        // two-open group behind the consumer's back.
        if (candidate.open) allClosed = false;
      }
    }
    return allClosed;
  }

  private applyOpenState(next: boolean): void {
    const old = this._open;
    this._open = next;
    this.requestUpdate('open', old);
  }

  /** A vetoed transition must leave the reflected attribute agreeing with the property; Lit only
   *  reflects properties it saw change. */
  private syncOpenAttribute(): void {
    this.toggleAttribute('open', this._open);
  }

  private async settleTransition(event: 'lr-after-show' | 'lr-after-hide'): Promise<void> {
    const token = ++this.transitionToken;
    setCustomState(this.detailsInternals, 'animating', true);
    try {
      await this.updateComplete;
      if (this.transitionToken !== token) return;
      // `lr-toggle` is deliberately emitted here rather than synchronously from show()/hide(): a
      // consumer that binds `.open` from its own template writes this property from inside its own
      // render, and a synchronous listener that then mutates that consumer's state schedules an
      // update mid-update. Emitting once the disclosure has actually rendered keeps the historical
      // timing (it used to ride the native <details> toggle event) while preserving the documented
      // lr-show -> lr-toggle -> lr-after-show ordering.
      this.emit('lr-toggle', { open: this._open });
      if (this.isConnected) {
        const view = this.ownerDocument.defaultView;
        if (view) await new Promise<void>((resolve) => view.requestAnimationFrame(() => resolve()));
        if (this.transitionToken !== token) return;
        const base = (this.renderRoot as ShadowRoot).querySelector('[part~="base"]');
        // subtree: true so the disclosure marker's own transition (declared on a pseudo-element of a
        // descendant) is waited on too. It resolves through --lr-transition-fast, which the token
        // layer flattens under prefers-reduced-motion, so this settles in that branch as well.
        const animations = base?.getAnimations({ subtree: true }) ?? [];
        await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
        if (this.transitionToken !== token) return;
      }
      this.emit(event);
    } finally {
      if (this.transitionToken === token) setCustomState(this.detailsInternals, 'animating', false);
    }
  }

  // The native <details> toggle is a click default action, so cancelling the click is the only way
  // to keep a vetoed lr-show from visually expanding the panel before the veto is known. State is
  // driven entirely from show()/hide() instead, and the native element follows the property.
  private onClick = (event: Event): void => {
    // Links and controls inside the summary slot retain their own behavior. Native <summary>
    // already exempts such controls from disclosure activation, so leaving their click alone is
    // both the platform contract and the only way a slotted link can navigate.
    const path = event.composedPath();
    const summaryIndex = path.findIndex(
      (node) => (node as Partial<Node> | null)?.nodeType === 1 &&
        (node as Element).localName === 'summary',
    );
    if (
      path.slice(0, summaryIndex < 0 ? 0 : summaryIndex).some(
        (node) =>
          (node as Partial<Node> | null)?.nodeType === 1 &&
          (node as Element).matches('a[href], button, input, select, textarea, [contenteditable]:not([contenteditable="false"])'),
      )
    ) {
      return;
    }
    event.preventDefault();
    if (this.disabled) {
      event.stopPropagation();
      return;
    }
    if (this._open) void this.hide();
    else void this.show();
  };

  // Safety net only: the click default action is cancelled above, so the native element toggles
  // exclusively from the property binding below and this observes a state that already matches.
  // It still runs for anything that writes `details.open` directly.
  private onToggle = (event: Event): void => {
    const details = event.currentTarget as HTMLDetailsElement;
    if (details.open === this._open) return;
    if (this.disabled && details.open) {
      details.open = false;
      return;
    }
    if (details.open) void this.show();
    else void this.hide();
  };

  private onSummarySlotChange = (e: Event): void => {
    this.hasSummarySlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };
  override render(): TemplateResult {
    return html`<details
      part="base details"
      .open=${this.open}
      name=${this.name || nothing}
      @toggle=${this.onToggle}
    >
      <summary
        part="summary"
        aria-label=${hostAriaLabel(this) ?? nothing}
        aria-expanded=${this.open ? 'true' : 'false'}
        aria-disabled=${this.disabled ? 'true' : 'false'}
        @click=${this.onClick}
      >
        <span part="header">
          <span class="summary-content"
            >${this.hasSummarySlot || this.summary ? '' : this.localize('details')}<slot
              name="summary"
              @slotchange=${this.onSummarySlotChange}
              >${this.summary}</slot
            ></span
          >
          <span part="icon summary-icon" aria-hidden="true">
            <slot name=${this.open ? 'collapse-icon' : 'expand-icon'}
              ><span class="icon-fallback">${chevronIcon()}</span></slot
            >
          </span>
        </span>
      </summary>
      <div part="content"><slot></slot></div>
    </details>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-details': LyraDetails; } }
