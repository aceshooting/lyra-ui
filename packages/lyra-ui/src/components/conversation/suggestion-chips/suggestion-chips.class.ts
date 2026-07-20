import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import '../../layout/scroller/scroller.class.js';
import { styles } from './suggestion-chips.styles.js';

export interface ChatSuggestion {
  id: string;
  label: string;
  /** An optional secondary line (Perplexity-style related questions). */
  detail?: string;
}

export interface LyraSuggestionChipsEventMap {
  'lr-suggestion-select': CustomEvent<{ id: string; label: string }>;
}

/**
 * `<lr-suggestion-chips>` — starter prompts (empty thread) and follow-up suggestions (after a
 * response) as a horizontally scrollable chip row; activation hands the prompt to the host, which
 * decides whether to compose it into an input or send it directly. Never writes into a composer or
 * sends anything itself.
 *
 * Streaming-friendly: chips render through a keyed `repeat()` on `id`, so replacing follow-ups
 * mid-conversation preserves focus on any chip whose `id` survives.
 *
 * @customElement lr-suggestion-chips
 * @event lr-suggestion-select - `detail: { id, label }`.
 * @csspart base - The labeled group.
 * @csspart chip - Each suggestion button.
 * @csspart chip-label - The primary text.
 * @csspart chip-detail - The secondary line (only rendered when `detail` is set).
 * @cssprop [--lr-suggestion-chips-hover-bg=var(--lr-color-brand-quiet)] - Background of a hovered chip.
 * @cssprop [--lr-suggestion-chips-hover-border=var(--lr-color-brand)] - Border color of a hovered chip.
 */
export class LyraSuggestionChips extends LyraElement<LyraSuggestionChipsEventMap> {
  static styles = [LyraElement.styles, styles];

  /** The suggestions to render, in order. Empty renders nothing at all. */
  @property({ attribute: false }) suggestions: ChatSuggestion[] = [];

  /** Wraps into multiple rows instead of a single horizontally scrollable line. */
  @property({ type: Boolean, reflect: true }) wrap = false;

  /** Accessible name for the group. Defaults to the localized `suggestionsLabel`. */
  @property() label = '';

  @state() private activeIndex = 0;

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('suggestions')) {
      this.activeIndex = Math.min(this.activeIndex, Math.max(0, this.suggestions.length - 1));
    }
  }

  private select(suggestion: ChatSuggestion): void {
    this.emit<{ id: string; label: string }>('lr-suggestion-select', {
      id: suggestion.id,
      label: suggestion.label,
    });
  }

  private focusChip(index: number): void {
    const buttons = [...this.renderRoot.querySelectorAll<HTMLButtonElement>('[part~="chip"]')];
    buttons[index]?.focus();
  }

  private onChipFocus(index: number): void {
    this.activeIndex = index;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const n = this.suggestions.length;
    if (n === 0) return;
    const forwardKey = this.effectiveDirection === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = this.effectiveDirection === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    let target: number;
    if (e.key === forwardKey) target = (this.activeIndex + 1) % n;
    else if (e.key === backwardKey) target = (this.activeIndex - 1 + n) % n;
    else if (e.key === 'Home') target = 0;
    else if (e.key === 'End') target = n - 1;
    else return;
    e.preventDefault();
    this.activeIndex = target;
    this.focusChip(target);
  };

  private renderChip(suggestion: ChatSuggestion, index: number): TemplateResult {
    return html`
      <button
        type="button"
        part="chip"
        tabindex=${index === this.activeIndex ? '0' : '-1'}
        @click=${() => this.select(suggestion)}
        @focus=${() => this.onChipFocus(index)}
      >
        <span part="chip-label">${suggestion.label}</span>
        ${suggestion.detail ? html`<span part="chip-detail">${suggestion.detail}</span>` : nothing}
      </button>
    `;
  }

  render(): TemplateResult {
    if (this.suggestions.length === 0) return html``;
    const label = this.label || this.localize('suggestionsLabel');
    const ariaLabel = this.getAttribute('aria-label') || label;
    const chips = repeat(
      this.suggestions,
      (s) => s.id,
      (s, i) => this.renderChip(s, i),
    );
    return html`
      <div part="base" role="group" aria-label=${ariaLabel} @keydown=${this.onKeyDown}>
        ${this.wrap
          ? html`<div class="row">${chips}</div>`
          : html`<lr-scroller orientation="horizontal" hide-scrollbar><div class="row">${chips}</div></lr-scroller>`}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-suggestion-chips': LyraSuggestionChips;
  }
}
