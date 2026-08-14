import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './suggestion-chips.styles.js';
import {
  applyComposedFocusRepair,
  captureComposedFocusRepair,
  type ComposedFocusRepairSnapshot,
} from '../../../internal/focus-navigation.js';
import { deepActiveElementIn } from '../../../internal/active-element.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_suggestionsLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface LyraChatSuggestion {
  suggestionId: string;
  label: string;
  /** Optional literal icon hint (for example, an emoji). Rendered decoratively before the text. */
  icon?: string;
  /** An optional secondary line (Perplexity-style related questions). */
  detail?: string;
}

export interface LyraSuggestionChipsEventMap {
  'lr-suggestion-select': CustomEvent<{ suggestionId: string; label: string }>;
}

interface PendingSuggestionFocus {
  suggestionId: string;
  index: number;
  repair: ComposedFocusRepairSnapshot;
  generation: number;
}

/**
 * `<lr-suggestion-chips>` — starter prompts (empty thread) and follow-up suggestions (after a
 * response) as a horizontally scrollable chip row; activation hands the prompt to the host, which
 * decides whether to compose it into an input or send it directly. Never writes into a composer or
 * sends anything itself.
 *
 * Streaming-friendly: chips render through a keyed `repeat()` on `suggestionId`, so replacing
 * follow-ups mid-conversation preserves focus on any chip whose identifier survives. Identifiers
 * must be nonempty and unique; invalid and later duplicate entries are omitted deterministically.
 *
 * @customElement lr-suggestion-chips
 * @event lr-suggestion-select - `detail: { suggestionId, label }`.
 * @csspart base - The labeled group.
 * @csspart row - The flex container holding the chips, in both the wrapping and the scrolling
 *   layout. Style this to change how chip lines pack (`justify-content`, `row-gap`).
 * @csspart chip - Each suggestion button.
 * @csspart chip-icon - Optional decorative literal icon.
 * @csspart chip-label - The primary text.
 * @csspart chip-detail - The secondary line (only rendered when `detail` is set).
 * @cssprop [--lr-suggestion-chips-justify=flex-start] - Main-axis packing of the chip row. `center`
 *   centers every line, the wrapped final one included — what `::part(base)` alone cannot do.
 * @cssprop [--lr-suggestion-chips-hover-bg=var(--lr-color-brand-quiet)] - Background of a hovered chip.
 * @cssprop [--lr-suggestion-chips-hover-border=var(--lr-color-brand)] - Border color of a hovered chip.
 * @status stable
 * @since 4.0.0
 */
export class LyraSuggestionChips extends LyraElement<LyraSuggestionChipsEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    suggestionsLabel: LYRA_DEFAULT_suggestionsLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** The suggestions to render, in order. `suggestionId` must be unique and nonempty; the first
   *  valid occurrence wins. Empty renders nothing at all. */
  @property({ attribute: false }) suggestions: readonly LyraChatSuggestion[] = [];

  /** Wraps into multiple rows instead of a single horizontally scrollable line. */
  @property({ type: Boolean, reflect: true }) wrap = false;

  /** Accessible name for the group. Defaults to the localized `suggestionsLabel`. */
  @property() label = '';

  @state() private activeIndex = 0;
  private pendingFocus?: PendingSuggestionFocus;
  private focusRepairGeneration = 0;

  private normalizeSuggestions(items: readonly LyraChatSuggestion[] | undefined): LyraChatSuggestion[] {
    const seen = new Set<string>();
    const normalized: LyraChatSuggestion[] = [];
    for (const suggestion of items ?? []) {
      const suggestionId = suggestion?.suggestionId;
      if (typeof suggestionId !== 'string' || suggestionId.trim() === '' || seen.has(suggestionId)) continue;
      seen.add(suggestionId);
      normalized.push(suggestion);
    }
    return normalized;
  }

  private get effectiveSuggestions(): LyraChatSuggestion[] {
    return this.normalizeSuggestions(this.suggestions);
  }

  override disconnectedCallback(): void {
    this.focusRepairGeneration++;
    this.pendingFocus = undefined;
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.focusRepairGeneration++;
    this.pendingFocus = undefined;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('suggestions') || changed.has('wrap')) {
      const active = deepActiveElementIn(this.ownerDocument);
      const activeElement = active?.nodeType === 1 && 'dataset' in active ? active as HTMLElement : null;
      const suggestionId = activeElement?.dataset['suggestionId'];
      const repair = activeElement ? captureComposedFocusRepair(this, activeElement) : null;
      const generation = ++this.focusRepairGeneration;
      this.pendingFocus = suggestionId && repair
        ? { suggestionId, index: this.activeIndex, repair, generation }
        : undefined;
    }
    if (changed.has('suggestions')) {
      const previous = this.normalizeSuggestions(
        changed.get('suggestions') as readonly LyraChatSuggestion[] | undefined,
      );
      const current = this.effectiveSuggestions;
      const activeId = this.pendingFocus?.suggestionId ?? previous[this.activeIndex]?.suggestionId;
      const remapped = activeId
        ? current.findIndex((suggestion) => suggestion.suggestionId === activeId)
        : -1;
      this.activeIndex =
        remapped >= 0 ? remapped : Math.min(this.activeIndex, Math.max(0, current.length - 1));
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const pending = this.pendingFocus;
    this.pendingFocus = undefined;
    if (!pending) return;
    void this.restorePendingFocus(pending);
  }

  private async restorePendingFocus(pending: PendingSuggestionFocus): Promise<void> {
    const scroller = this.renderRoot.querySelector<Element & { updateComplete?: Promise<unknown> }>('lr-scroller');
    await scroller?.updateComplete;
    await Promise.resolve();
    if (pending.generation !== this.focusRepairGeneration || !this.isConnected) return;
    const buttons = this.chipButtons();
    const surviving = buttons.find((button) => button.dataset['suggestionId'] === pending.suggestionId);
    const target = surviving ?? buttons[Math.min(pending.index, Math.max(0, buttons.length - 1))] ?? null;
    applyComposedFocusRepair(pending.repair, target);
  }

  private select(suggestion: LyraChatSuggestion): void {
    this.emit('lr-suggestion-select', {
      suggestionId: suggestion.suggestionId,
      label: suggestion.label,
    });
  }

  private chipButtons(): HTMLButtonElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLButtonElement>('[part~="chip"]')];
  }

  private focusChip(index: number): void {
    this.chipButtons()[index]?.focus();
  }

  private onChipFocus(index: number): void {
    this.activeIndex = index;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const n = this.effectiveSuggestions.length;
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

  private renderChip(suggestion: LyraChatSuggestion, index: number): TemplateResult {
    return html`
      <button
        type="button"
        part="chip"
        data-suggestion-id=${suggestion.suggestionId}
        tabindex=${index === this.activeIndex ? '0' : '-1'}
        @click=${() => this.select(suggestion)}
        @focus=${() => this.onChipFocus(index)}
      >
        ${suggestion.icon
          ? html`<span part="chip-icon" aria-hidden="true">${suggestion.icon}</span>`
          : nothing}
        <span class="content">
          <span part="chip-label">${suggestion.label}</span>
          ${suggestion.detail ? html`<span part="chip-detail">${suggestion.detail}</span>` : nothing}
        </span>
      </button>
    `;
  }

  override render(): TemplateResult {
    const suggestions = this.effectiveSuggestions;
    if (suggestions.length === 0) return html``;
    const label = this.label || this.localize('suggestionsLabel');
    const ariaLabel = this.getAttribute('aria-label') ?? label;
    const chips = repeat(
      suggestions,
      (s) => s.suggestionId,
      (s, i) => this.renderChip(s, i),
    );
    return html`
      <div part="base" role="group" aria-label=${ariaLabel} @keydown=${this.onKeyDown}>
        ${this.wrap
          ? html`<div part="row" class="row">${chips}</div>`
          : html`<lr-scroller orientation="horizontal" hide-scrollbar><div part="row" class="row">${chips}</div></lr-scroller>`}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-suggestion-chips': LyraSuggestionChips;
  }
}
