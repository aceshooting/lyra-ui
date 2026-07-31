import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './details.styles.js';

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
 * @customElement lr-details
 * @slot summary - Summary content. Takes priority over `summary` when any light-DOM child
 *   carries `slot="summary"` — the fallback localized "Details" text only appears when neither
 *   is set.
 * @slot - Panel content.
 * @event lr-show - The panel is about to open. Cancelable.
 * @event lr-after-show - The panel is open and its marker transition has finished.
 * @event lr-hide - The panel is about to close. Cancelable.
 * @event lr-after-hide - The panel is closed and its marker transition has finished.
 * @event lr-toggle - The disclosure state changed. `detail: { open }`. Kept alongside the four
 *   events above because it is the single event that reports which way the panel went, which
 *   `<lr-accordion>` uses to close the siblings of a newly-opened panel.
 * @csspart base - The native details element.
 * @csspart summary - The summary control.
 * @csspart content - The panel content.
 */
export class LyraDetails extends LyraElement<LyraDetailsEventMap> {
  static override styles = [LyraElement.styles, styles];

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
    if (normalized) this.show();
    else this.hide();
  }

  @property({ type: Boolean, reflect: true }) disabled = false;
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
    super.disconnectedCallback();
  }

  /** Expand the panel. Emits `lr-show` first — vetoing it leaves the panel closed. A disabled
   *  panel never opens. */
  show(): void {
    if (this._open || this.disabled) return;
    if (this.emit('lr-show', undefined, { cancelable: true }).defaultPrevented) {
      this.syncOpenAttribute();
      return;
    }
    this.applyOpenState(true);
    void this.settleTransition('lr-after-show');
  }

  /** Collapse the panel. Emits `lr-hide` first — vetoing it leaves the panel open. */
  hide(): void {
    if (!this._open) return;
    if (this.emit('lr-hide', undefined, { cancelable: true }).defaultPrevented) {
      this.syncOpenAttribute();
      return;
    }
    this.applyOpenState(false);
    void this.settleTransition('lr-after-hide');
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
      const base = (this.renderRoot as ShadowRoot).querySelector('[part="base"]');
      // subtree: true so the disclosure marker's own transition (declared on a pseudo-element of a
      // descendant) is waited on too. It resolves through --lr-transition-fast, which the token
      // layer flattens under prefers-reduced-motion, so this settles in that branch as well.
      const animations = base?.getAnimations({ subtree: true }) ?? [];
      await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
      if (this.transitionToken !== token) return;
    }
    this.emit(event);
  }

  // The native <details> toggle is a click default action, so cancelling the click is the only way
  // to keep a vetoed lr-show from visually expanding the panel before the veto is known. State is
  // driven entirely from show()/hide() instead, and the native element follows the property.
  private onClick = (event: Event): void => {
    event.preventDefault();
    if (this.disabled) {
      event.stopPropagation();
      return;
    }
    if (this._open) this.hide();
    else this.show();
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
    if (details.open) this.show();
    else this.hide();
  };

  private onSummarySlotChange = (e: Event): void => {
    this.hasSummarySlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };
  override render(): TemplateResult {
    return html`<details part="base" .open=${this.open} @toggle=${this.onToggle}>
      <summary
        part="summary"
        aria-expanded=${this.open ? 'true' : 'false'}
        aria-disabled=${this.disabled ? 'true' : 'false'}
        @click=${this.onClick}
      >
        ${this.hasSummarySlot || this.summary ? '' : this.localize('details')}<slot name="summary" @slotchange=${this.onSummarySlotChange}>${this.summary}</slot>
      </summary>
      <div part="content"><slot></slot></div>
    </details>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-details': LyraDetails; } }
