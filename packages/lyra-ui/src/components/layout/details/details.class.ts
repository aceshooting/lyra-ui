import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { hostAriaLabel, nextId } from '../../../internal/a11y.js';
import { attachInternalsSafely } from '../../../internal/form-associated.js';
import { chevronIcon } from '../../../internal/icons.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraAppearance, LyraSize } from '../../../internal/variants.js';
import { sizes } from '../../../internal/sizes.styles.js';
import { DisclosureMotionController } from './disclosure-motion.js';
import { styles } from './details.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_details } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** The library's one size ladder, in either spelling. */
export type LyraDetailsSize = LyraSize;
/** Web Awesome's disclosure appearances. */
export type LyraDetailsAppearance = Exclude<LyraAppearance, 'accent'>;
/** Logical position of the disclosure icon. */
export type LyraDetailsIconPlacement = 'start' | 'end';
/** How an accepted disclosure transition began. */
export type LyraDetailsToggleSource = 'user' | 'programmatic' | 'peer';
type ContentGateMode = 'open' | 'until-found' | 'ordinary-hidden';
/** Payload emitted with `lr-toggle` after an accepted disclosure transition renders. */
export interface LyraDetailsToggleDetail {
  open: boolean;
  source: LyraDetailsToggleSource;
}

export interface LyraDetailsEventMap {
  'lr-show': CustomEvent<null>;
  'lr-after-show': CustomEvent<null>;
  'lr-hide': CustomEvent<null>;
  'lr-after-hide': CustomEvent<null>;
  'lr-toggle': CustomEvent<LyraDetailsToggleDetail>;
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
 * @slot header-actions - Extra controls rendered as a sibling of the native summary in the
 *   complete header row (e.g. a trailing "add" button). They remain enabled and do not toggle
 *   the panel, including while the disclosure itself is disabled.
 * @slot expand-icon - Icon shown while the panel is closed.
 * @slot collapse-icon - Icon shown while the panel is open.
 * @slot - Panel content.
 * @event lr-show - The panel is about to open. Cancelable.
 * @event lr-after-show - The panel is open and its marker transition has finished.
 * @event lr-hide - The panel is about to close. Cancelable.
 * @event lr-after-hide - The panel is closed and its marker transition has finished.
 * @event lr-toggle - The disclosure state changed. `detail: { open, source }`, where `source` is
 *   `user` for summary activation, `programmatic` for `show()`/`hide()`/`open`, or `peer` when a
 *   named disclosure closes this panel. Kept alongside the four events above because it is the
 *   single event that reports which way the panel went, which `<lr-accordion>` uses to close the
 *   siblings of a newly-opened panel.
 * @csspart base - Compatibility name for the outer disclosure container; use `details`.
 * @csspart details - The outer disclosure container. It is the same node as `base`.
 * @csspart header - The complete row containing the native summary and any header actions.
 * @csspart summary - The summary control.
 * @csspart icon - The expand/collapse icon wrapper.
 * @csspart summary-icon - Shoelace-compatible alias for `icon`; both names are on the same node.
 * @csspart header-actions - The wrapper around the `header-actions` slot, following the private
 *   native details element in `header`.
 * @csspart content - The panel content inside a private findable closed-state gate.
 * @cssprop [--lr-details-font-size=var(--lr-form-control-font-size)] - Text size of the summary
 *   and the panel. Its private default follows the library's shared size ladder; an inherited or
 *   direct public value remains authoritative.
 * @cssprop [--lr-details-spacing=var(--lr-form-control-padding-inline)] - Block rhythm: the
 *   summary's block padding and the panel's trailing padding, kept equal so a stack of
 *   disclosures reads evenly. Its private default follows the shared ladder's inline-padding
 *   knob, whose values suit a stacked panel; the ladder's own block padding exists to fit text
 *   inside a fixed control height and would collapse the summary row. An inherited or direct
 *   public value remains authoritative.
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
    details: LYRA_DEFAULT_details,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, sizes, styles];

  private readonly detailsInternals = attachInternalsSafely(this);
  private readonly disclosureMotion = new DisclosureMotionController(
    this,
    this.detailsInternals,
    () => this.renderRoot,
    '[part~="base"]'
  );
  private _open = false;
  private readonly contentId = nextId('details-content');
  private contentGateMode: ContentGateMode = 'until-found';
  private contentGateGeneration = 0;
  private fragmentListenerWindow?: Window;
  private fragmentNavigationGeneration = 0;

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

  /** Disables activation and removes the native summary from sequential keyboard navigation,
   * matching the disabled trigger behavior of `lr-accordion-item`. Programmatic focus remains a
   * native `<summary>` capability. */
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

  /** Same `:empty`-can't-match reasoning as `hasSummarySlot` above -- the `header-actions` wrapper
   *  always contains a literal `<slot>` child, so its own emptiness has to be tracked in JS instead
   *  to keep an unused wrapper from claiming layout space. */
  @state() private hasHeaderActionsSlot = false;

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed); // no-op today, but keeps any future LyraElement/mixin willUpdate logic wired in
    if (!this.hasUpdated) {
      this.hasSummarySlot = Array.from(this.children).some(
        (el) => el.getAttribute('slot') === 'summary'
      );
      this.hasHeaderActionsSlot = Array.from(this.children).some(
        (el) => el.getAttribute('slot') === 'header-actions'
      );
    }
    if (
      this.hasUpdated &&
      changed.has('name') &&
      this._open &&
      !this.closeNamedPeers()
    ) {
      // A live rename has the same winner semantics as opening the renamed disclosure: this
      // disclosure wins only when every conflicting peer accepts its close. A veto rejects the
      // rename so the root never contains two open members of one named group.
      this.name = changed.get('name') ?? '';
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // A rejected beforematch briefly uses ordinary `hidden` until its microtask rearms
    // findability. Reconnection invalidates that microtask, so the live gate must normalize here.
    this.setContentGateMode(this._open ? 'open' : 'until-found');
    this.armFragmentNavigation();
    if (!this.hasUpdated || !this._open) return;
    queueMicrotask(() => {
      if (this.isConnected && this._open) this.closeNamedPeers();
    });
  }

  override disconnectedCallback(): void {
    // A pending after-event must not announce a transition the detached element is no longer
    // part of.
    this.disclosureMotion.cancel();
    this.disarmFragmentNavigation();
    this.contentGateGeneration += 1;
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.disarmFragmentNavigation();
    this.contentGateGeneration += 1;
    this.setContentGateMode(this._open ? 'open' : 'until-found');
    if (this.isConnected) this.armFragmentNavigation();
  }

  override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    // Reconcile initially-open markup after every sibling has had a chance to upgrade. The last
    // open disclosure in document order wins, matching native named details grouping.
    if (this._open) this.closeNamedPeers();
  }

  /** Expand the panel. The promise resolves after `lr-after-show`; vetoed or disabled requests
   *  resolve without changing state. */
  async show(): Promise<void> {
    await this.showWithSource('programmatic');
  }

  protected async showWithSource(
    source: LyraDetailsToggleSource
  ): Promise<void> {
    if (!this.beginShow()) return;
    await this.settleTransition('lr-after-show', source);
  }

  private beginShow(): boolean {
    if (this._open) return false;
    if (this.disabled) {
      // A caller may have toggled the private native element directly. Restore every owned
      // representation before returning so disabled never leaves it visually or semantically open.
      this.syncOpenAttribute();
      return false;
    }
    if (this.emit('lr-show', null, { cancelable: true }).defaultPrevented) {
      this.syncOpenAttribute();
      return false;
    }
    if (!this.closeNamedPeers()) {
      this.syncOpenAttribute();
      return false;
    }
    this.applyOpenState(true);
    return true;
  }

  /** Collapse the panel. The promise resolves after `lr-after-hide`; vetoed requests resolve
   *  without changing state. */
  async hide(): Promise<void> {
    await this.hideWithSource('programmatic');
  }

  protected async hideWithSource(
    source: LyraDetailsToggleSource
  ): Promise<void> {
    if (!this._open) return;
    if (this.emit('lr-hide', null, { cancelable: true }).defaultPrevented) {
      this.syncOpenAttribute();
      return;
    }
    this.applyOpenState(false);
    await this.settleTransition('lr-after-hide', source);
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
        void candidate.hideWithSource('peer');
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
    this.contentGateGeneration += 1;
    this.setContentGateMode(next ? 'open' : 'until-found');
    this.syncNativeDetailsState();
    this.syncSummaryState();
    this.requestUpdate('open', old);
  }

  /** A vetoed transition must leave the reflected attribute agreeing with the property; Lit only
   *  reflects properties it saw change. */
  private syncOpenAttribute(): void {
    this.toggleAttribute('open', this._open);
    this.contentGateGeneration += 1;
    this.setContentGateMode(this._open ? 'open' : 'until-found');
    this.syncNativeDetailsState();
    this.syncSummaryState();
  }

  private get nativeDetails(): HTMLDetailsElement | null {
    return this.renderRoot?.querySelector<HTMLDetailsElement>('details') ?? null;
  }

  private get summaryElement(): HTMLElement | null {
    return this.renderRoot?.querySelector<HTMLElement>('[part="summary"]') ?? null;
  }

  private get contentGate(): HTMLElement | null {
    return (
      this.renderRoot?.querySelector<HTMLElement>('[part="content"]')?.parentElement ?? null
    );
  }

  private setContentGateMode(
    mode: ContentGateMode,
    gate = this.contentGate
  ): void {
    this.contentGateMode = mode;
    if (!gate) return;
    if (mode === 'open') gate.removeAttribute('hidden');
    else gate.setAttribute('hidden', mode === 'until-found' ? 'until-found' : '');
  }

  private syncNativeDetailsState(): void {
    const nativeDetails = this.nativeDetails;
    if (nativeDetails && nativeDetails.open !== this._open) {
      nativeDetails.open = this._open;
    }
  }

  private syncSummaryState(): void {
    this.summaryElement?.setAttribute(
      'aria-expanded',
      this._open ? 'true' : 'false'
    );
  }

  private rearmContentGate(gate: HTMLElement): void {
    const generation = ++this.contentGateGeneration;
    this.setContentGateMode('ordinary-hidden', gate);
    queueMicrotask(() => {
      if (
        generation !== this.contentGateGeneration ||
        !this.isConnected ||
        this._open ||
        gate !== this.contentGate
      ) {
        return;
      }
      this.setContentGateMode('until-found', gate);
      this.requestUpdate();
    });
  }

  private onBeforeMatch = (event: Event): void => {
    const gate = event.currentTarget as HTMLElement;
    if (this._open) {
      this.setContentGateMode('open', gate);
      return;
    }
    if (this.beginShow()) {
      void this.settleTransition('lr-after-show', 'programmatic');
      return;
    }
    // beforematch itself cannot be vetoed. An ordinary hidden attribute is the synchronous
    // closed fallback that survives the UA's pending reveal until this generation can re-arm
    // findability in the next microtask.
    this.rearmContentGate(gate);
  };

  private armFragmentNavigation(): void {
    const view = this.ownerDocument.defaultView;
    if (!view) return;
    if (this.fragmentListenerWindow !== view) {
      this.disarmFragmentNavigation();
      this.fragmentListenerWindow = view;
      view.addEventListener('hashchange', this.onHashChange);
    }
    this.queueFragmentReveal();
  }

  private disarmFragmentNavigation(): void {
    this.fragmentNavigationGeneration += 1;
    this.fragmentListenerWindow?.removeEventListener('hashchange', this.onHashChange);
    this.fragmentListenerWindow = undefined;
  }

  private onHashChange = (): void => {
    this.revealFragmentTarget();
  };

  private queueFragmentReveal(): void {
    const generation = ++this.fragmentNavigationGeneration;
    queueMicrotask(() => {
      if (
        generation !== this.fragmentNavigationGeneration ||
        !this.isConnected ||
        this.ownerDocument.defaultView !== this.fragmentListenerWindow
      ) {
        return;
      }
      this.revealFragmentTarget();
    });
  }

  private revealFragmentTarget(): void {
    if (this._open) return;
    const hash = this.ownerDocument.defaultView?.location.hash;
    if (!hash || hash.length < 2) return;
    let targetId: string;
    try {
      targetId = decodeURIComponent(hash.slice(1));
    } catch {
      return;
    }
    const target = this.ownerDocument.getElementById(targetId);
    if (!target || !this.isDefaultContentTarget(target)) return;
    void this.showWithSource('programmatic');
  }

  private isDefaultContentTarget(target: Element): boolean {
    if (target === this || !this.contains(target)) return false;
    let topLevel = target;
    while (topLevel.parentElement && topLevel.parentElement !== this) {
      topLevel = topLevel.parentElement;
    }
    return (
      topLevel.parentElement === this &&
      (topLevel.getAttribute('slot') ?? '') === ''
    );
  }

  private async settleTransition(
    event: 'lr-after-show' | 'lr-after-hide',
    source: LyraDetailsToggleSource
  ): Promise<void> {
    const settled = await this.disclosureMotion.settle(() => {
      // `lr-toggle` is deliberately emitted here rather than synchronously from show()/hide(): a
      // consumer that binds `.open` from its own template writes this property from inside its own
      // render, and a synchronous listener that then mutates that consumer's state schedules an
      // update mid-update. Emitting once the disclosure has actually rendered keeps the historical
      // timing (it used to ride the native <details> toggle event) while preserving the documented
      // lr-show -> lr-toggle -> lr-after-show ordering.
      this.emit('lr-toggle', { open: this._open, source });
    });
    if (settled) this.emit(event, null);
  }

  // The native <details> toggle is a click default action, so cancelling the click is the only way
  // to keep a vetoed lr-show from visually expanding the panel before the veto is known. State is
  // driven entirely from show()/hide() instead, and the native element follows the property.
  private onClick = (event: Event): void => {
    // Links and controls inside the summary slot retain their own behavior. Native <summary>
    // already exempts such controls from disclosure activation, so leaving their click alone is
    // both the platform contract and the only way a slotted link can navigate.
    const path = event.composedPath();
    if (
      path.some(
        (node) =>
          (node as Partial<Node> | null)?.nodeType === 1 &&
          (node as Element).matches('[part~="header-actions"]')
      )
    ) {
      return;
    }
    const summaryIndex = path.findIndex(
      (node) =>
        (node as Partial<Node> | null)?.nodeType === 1 &&
        (node as Element).localName === 'summary'
    );
    if (
      path
        .slice(0, summaryIndex < 0 ? 0 : summaryIndex)
        .some(
          (node) =>
            (node as Partial<Node> | null)?.nodeType === 1 &&
            (node as Element).matches(
              'a[href], button, input, select, textarea, [contenteditable]:not([contenteditable="false"])'
            )
        )
    ) {
      return;
    }
    event.preventDefault();
    if (this.disabled) {
      event.stopPropagation();
      return;
    }
    if (this._open) void this.hideWithSource('user');
    else void this.showWithSource('user');
  };

  // Safety net only: the click default action is cancelled above, so the native element toggles
  // exclusively from the property binding below and this observes a state that already matches.
  // It still runs for anything that writes `details.open` directly.
  private onToggle = (event: Event): void => {
    const details = event.currentTarget as HTMLDetailsElement;
    if (details.open === this._open) return;
    if (details.open) void this.show();
    else void this.hide();
  };

  private onSummarySlotChange = (e: Event): void => {
    this.hasSummarySlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };

  private onHeaderActionsSlotChange = (e: Event): void => {
    this.hasHeaderActionsSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };
  override render(): TemplateResult {
    const gateHidden =
      this.contentGateMode === 'open'
        ? nothing
        : this.contentGateMode === 'until-found'
          ? 'until-found'
          : '';
    return html`
      <div part="base details">
        <div part="header">
          <details
            class="native-details"
            .open=${this.open}
            name=${this.name || nothing}
            @toggle=${this.onToggle}
          ><summary
              part="summary"
              aria-controls=${this.contentId}
              aria-label=${hostAriaLabel(this) ?? nothing}
              aria-expanded=${this.open ? 'true' : 'false'}
              aria-disabled=${this.disabled ? 'true' : 'false'}
              tabindex=${this.disabled ? '-1' : nothing}
              @click=${this.onClick}
            ><span class="summary-content"
                >${this.hasSummarySlot || this.summary
                  ? ''
                  : this.localize('details')}<slot
                  name="summary"
                  @slotchange=${this.onSummarySlotChange}
                  >${this.summary}</slot
                ></span
              ><span part="icon summary-icon" aria-hidden="true" inert
                ><slot name=${this.open ? 'collapse-icon' : 'expand-icon'}
                  ><span class="icon-fallback">${chevronIcon()}</span></slot
                ></span
              ></summary
            ></details
          ><span part="header-actions" ?hidden=${!this.hasHeaderActionsSlot}
            ><slot
              name="header-actions"
              @slotchange=${this.onHeaderActionsSlotChange}
            ></slot
          ></span>
        </div>
        <div
          class="content-gate"
          id=${this.contentId}
          hidden=${gateHidden}
          @beforematch=${this.onBeforeMatch}
        ><div part="content"><slot></slot></div></div>
      </div>
    `;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lr-details': LyraDetails;
  }
}
