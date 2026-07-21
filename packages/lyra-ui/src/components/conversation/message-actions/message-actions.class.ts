import { html, nothing, svg, type PropertyValues, type SVGTemplateResult, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import '../../utility/copy-button/copy-button.class.js';
import '../message-feedback/message-feedback.class.js';

import { styles } from './message-actions.styles.js';

export type MessageActionControl = 'copy' | 'regenerate' | 'edit' | 'feedback';

export interface LyraMessageActionsEventMap {
  'lr-regenerate': CustomEvent<undefined>;
  'lr-edit': CustomEvent<undefined>;
  'lr-copy': CustomEvent<{ text: string }>;
  'lr-change': CustomEvent<{ value: 'up' | 'down' | null }>;
  'lr-submit': CustomEvent<{ value: 'up' | 'down'; reasonIds: string[]; comment: string }>;
}

// Mirrors the shared icon set's viewBox/stroke conventions (internal/icons.ts's
// chevronIcon()/closeIcon()/etc.) without adding regenerate/edit glyphs to that module -- it's off
// limits here -- so these one-off icons still read as part of the same visual language as the rest of
// the library's inline icons. Same approach lr-chat-message's/lr-chat-composer's/
// lr-conversation-item's own local glyphs take for the identical reason.
function regenerateIcon(): SVGTemplateResult {
  return svg`
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <polyline points="23 4 23 10 17 10"></polyline>
      <polyline points="1 20 1 14 7 14"></polyline>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
    </svg>
  `;
}

function editIcon(): SVGTemplateResult {
  return svg`
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 20h9"></path>
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
    </svg>
  `;
}

/**
 * `<lr-message-actions>` — the per-message action toolbar for `<lr-chat-message>`'s `actions`
 * slot: opt-in built-ins (copy / regenerate / edit / feedback) that emit intent events, plus a
 * default slot for custom controls (e.g. a slotted `<lr-branch-picker>`). It performs nothing
 * itself except the copy.
 *
 * `[part="base"]` is `role="toolbar"` with the WAI-ARIA APG roving-tabindex pattern applied to the
 * plain `<button>` elements this component renders itself (`regenerate`/`edit`); ArrowLeft/ArrowRight
 * (swapped under `effectiveDirection === 'rtl'`) plus Home/End move focus across *every* stop --
 * built-ins and slotted controls alike -- via `.focus()`, including composite children
 * (`lr-copy-button`, the `feedback` built-in, any slotted custom element) that expose their own
 * `focus()` delegation. See the class-level "Known limitation" note for why only the plain-button
 * stops get their `tabindex` toggled by this component (composite children's internal focusable
 * elements live in their own shadow root, unreachable from here).
 *
 * **Known limitation.** A byte-perfect APG toolbar keeps exactly one Tab stop for the entire
 * toolbar. This component only achieves that for its own plain-button built-ins; a composite child
 * (the `feedback` built-in, `lr-copy-button`, any slotted custom element) remains independently
 * reachable via the page's native Tab order alongside the toolbar's single roving stop, since this
 * component cannot suppress an element living inside another component's shadow root from the
 * document's Tab order. Arrow-key navigation is unaffected by this and reaches every stop.
 *
 * @customElement lr-message-actions
 * @slot - Additional controls (e.g. `lr-copy-button`, `lr-icon-button`, `lr-branch-picker`)
 *   appended after the built-ins; they participate in the toolbar's arrow-key navigation.
 * @event lr-regenerate - The regenerate built-in was activated. No detail.
 * @event lr-edit - The edit built-in was activated: a *request* to edit; the host swaps the message
 *   body for its own editor.
 * @event lr-copy - `detail: { text }`, surfaced by the embedded `lr-copy-button` (bubbles +
 *   composed already; not re-emitted, so exactly one event reaches a host listener).
 * @event lr-change - Bubbles unchanged from the embedded, thumbs-only `lr-message-feedback`.
 *   `detail: { value }`.
 * @event lr-submit - Only arises from a slotted, fully-configured `lr-message-feedback` (the
 *   built-in is thumbs-only and never opens a panel) -- also bubbles unchanged.
 * @csspart base - The toolbar (`role="toolbar"`).
 * @csspart copy-button - The embedded `lr-copy-button`.
 * @csspart regenerate-button - The built-in regenerate icon button.
 * @csspart edit-button - The built-in edit icon button.
 * @csspart feedback - The embedded `lr-message-feedback`.
 */
export class LyraMessageActions extends LyraElement<LyraMessageActionsEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** Which built-ins render, in display order. */
  @property({ attribute: false }) controls: MessageActionControl[] = [];

  /** What the `copy` built-in copies. Required for it to render at all -- this component never
   *  interprets the slotted message body itself. */
  @property({ attribute: 'copy-text' }) copyText = '';

  /** Forwarded to the embedded `lr-message-feedback` when the `feedback` built-in is enabled. The
   *  built-in stays thumbs-only: `reasons`/`commentable`/`detailFor` are never forwarded, so its
   *  detail panel never opens. */
  @property({ attribute: 'feedback-value' }) feedbackValue: 'up' | 'down' | null = null;

  /** Visually hides the bar until the enclosing message is hovered or any control inside has focus. */
  @property({ type: Boolean, reflect: true, attribute: 'reveal-on-hover' }) revealOnHover = false;

  /** Accessible name for the toolbar. Defaults to the localized `messageActionsLabel`. */
  @property() label = '';

  /** Overrides the toolbar's computed accessible name. Wins over `label` and the localized
   *  default. Attribute-reflects from a host-level `aria-label` so a plain-markup consumer gets
   *  ARIA-name forwarding without setting a JS property. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  @state() private activeStopIndex = 0;
  /** Drives the `data-revealed` host attribute (toggled imperatively in `updated()`, not via a Lit
   *  template binding -- `lr-graph`'s `data-hovered` attribute is the precedent for this exact
   *  technique) while `revealOnHover` is active. CSS alone cannot key `:host`'s own opacity off the
   *  ancestor `lr-chat-message`'s hover state from inside this component's own shadow DOM, so the
   *  reveal state is tracked in JS instead (see `bindHoverTarget()`). */
  @state() private revealed = false;

  private hoverTarget: HTMLElement | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.revealOnHover) this.bindHoverTarget();
  }

  override disconnectedCallback(): void {
    this.unbindHoverTarget();
    super.disconnectedCallback();
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('revealOnHover')) {
      if (this.revealOnHover) this.bindHoverTarget();
      else this.unbindHoverTarget();
    }
  }

  protected override firstUpdated(): void {
    this.setActiveStop(this.focusableStops(), 0);
  }

  protected override updated(changed: PropertyValues): void {
    if (changed.has('controls')) {
      const stops = this.focusableStops();
      this.setActiveStop(stops, Math.min(this.activeStopIndex, Math.max(0, stops.length - 1)));
    }
    if (changed.has('revealed')) {
      // Toggled on the host itself (not a shadow-internal part) so the stylesheet's `:host(...)`
      // rules can key off it directly -- same imperative-attribute-toggle technique lr-graph's
      // `data-hovered` attribute already establishes for hover-driven presentation state.
      this.toggleAttribute('data-revealed', this.revealed);
    }
  }

  private bindHoverTarget(): void {
    this.unbindHoverTarget();
    const target = (this.closest('lr-chat-message') as HTMLElement | null) ?? this.parentElement;
    if (!target) return;
    this.hoverTarget = target;
    target.addEventListener('pointerenter', this.onHoverTargetEnter);
    target.addEventListener('pointerleave', this.onHoverTargetLeave);
    this.addEventListener('focusin', this.onFocusIn);
    this.addEventListener('focusout', this.onFocusOut);
  }

  private unbindHoverTarget(): void {
    this.hoverTarget?.removeEventListener('pointerenter', this.onHoverTargetEnter);
    this.hoverTarget?.removeEventListener('pointerleave', this.onHoverTargetLeave);
    this.hoverTarget = null;
    this.removeEventListener('focusin', this.onFocusIn);
    this.removeEventListener('focusout', this.onFocusOut);
    this.revealed = false;
  }

  private onHoverTargetEnter = (): void => {
    this.revealed = true;
  };

  private onHoverTargetLeave = (): void => {
    if (!this.matches(':focus-within')) this.revealed = false;
  };

  private onFocusIn = (): void => {
    this.revealed = true;
  };

  private onFocusOut = (): void => {
    if (!this.hoverTarget?.matches(':hover')) this.revealed = false;
  };

  private focusableStops(): HTMLElement[] {
    const base = this.renderRoot.querySelector('[part="base"]');
    if (!base) return [];
    const direct = [...base.children].filter(
      (el): el is HTMLElement => el instanceof HTMLElement && el.tagName !== 'SLOT',
    );
    const slotEl = base.querySelector('slot') as HTMLSlotElement | null;
    const slotted =
      slotEl?.assignedElements({ flatten: true }).filter((el): el is HTMLElement => el instanceof HTMLElement) ?? [];
    return [...direct, ...slotted];
  }

  private setActiveStop(stops: HTMLElement[], index: number): void {
    this.activeStopIndex = index;
    stops.forEach((el, i) => {
      if (el.tagName === 'BUTTON') el.tabIndex = i === index ? 0 : -1;
    });
  }

  private onToolbarKeyDown = (e: KeyboardEvent): void => {
    const stops = this.focusableStops();
    if (stops.length === 0) return;
    const forwardKey = this.effectiveDirection === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = this.effectiveDirection === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    let target: number;
    if (e.key === forwardKey) target = (this.activeStopIndex + 1) % stops.length;
    else if (e.key === backwardKey) target = (this.activeStopIndex - 1 + stops.length) % stops.length;
    else if (e.key === 'Home') target = 0;
    else if (e.key === 'End') target = stops.length - 1;
    else return;
    e.preventDefault();
    this.setActiveStop(stops, target);
    stops[target]?.focus();
  };

  private onRegenerateClick = (): void => {
    this.emit('lr-regenerate');
  };

  private onEditClick = (): void => {
    this.emit('lr-edit');
  };

  private renderControl(type: MessageActionControl) {
    switch (type) {
      case 'copy':
        return this.copyText
          ? html`<lr-copy-button part="copy-button" .value=${this.copyText}></lr-copy-button>`
          : nothing;
      case 'regenerate':
        return html`<button
          part="regenerate-button"
          type="button"
          aria-label=${this.localize('regenerateResponse')}
          @click=${this.onRegenerateClick}
        >
          ${regenerateIcon()}
        </button>`;
      case 'edit':
        return html`<button
          part="edit-button"
          type="button"
          aria-label=${this.localize('editMessage')}
          @click=${this.onEditClick}
        >
          ${editIcon()}
        </button>`;
      case 'feedback':
        return html`<lr-message-feedback part="feedback" .value=${this.feedbackValue}></lr-message-feedback>`;
      default:
        return nothing;
    }
  }

  override render(): TemplateResult {
    const label = this.accessibleLabel || this.label || this.localize('messageActionsLabel');
    return html`
      <div part="base" role="toolbar" aria-label=${label} @keydown=${this.onToolbarKeyDown}>
        ${this.controls.map((type) => this.renderControl(type))}
        <slot></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-message-actions': LyraMessageActions;
  }
}
