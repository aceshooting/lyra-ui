import { collectionSupport } from '../../../internal/collection-snapshot.js';
import { tag } from '../../../internal/prefix.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { HostDescriptionController } from '../../../internal/aria-controls.js';
import { styles } from './suggestion-chips.styles.js';
import {
  applyComposedFocusRepair,
  captureComposedFocusRepair,
  type ComposedFocusRepairSnapshot,
} from '../../../internal/focus-navigation.js';
import { deepActiveElementIn } from '../../../internal/active-element.js';
import { RovingToolbarController } from '../../../internal/roving-toolbar.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_suggestionsLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface LyraChatSuggestion {
  suggestionId: string;
  /** Nonblank text used as the chip button's visible and accessible name. */
  label: string;
  /** Optional literal icon hint (for example, an emoji). Rendered decoratively before the text. */
  icon?: string;
  /** An optional secondary line (Perplexity-style related questions). */
  detail?: string;
  /**
   * Marks this suggestion non-actionable: its chip renders a genuinely disabled `<button>` (no
   * roving tab stop, no hover/press affordance, no `lr-suggestion-select`), and arrow-key/Home/End
   * roving navigation steps past it instead of landing on it. Omitted or `false` renders the chip
   * exactly as before this field existed.
   */
  disabled?: boolean;
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
 * Suggestions are a clone-owned, bounded readonly snapshot; create and reassign a new array after
 * changing the sequence or a row.
 *
 * A suggestion may also set `disabled`, marking it non-actionable: its chip renders a genuinely
 * disabled `<button>` (no roving tab stop, no hover/press affordance) and activating it -- by click
 * or keyboard -- emits nothing and changes no state. Arrow-key/Home/End roving navigation steps
 * past it instead of landing on it. Omitted or `false` renders the chip exactly as before this
 * field existed.
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
 * @cssprop [--lr-suggestion-chips-disabled-opacity=var(--lr-opacity-disabled)] - Opacity of a chip whose suggestion sets `disabled`.
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
  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze(['suggestions']);

  static override styles = [LyraElement.styles, styles];
  private readonly hostDescription = new HostDescriptionController(
    this, () => this.renderRoot.querySelector<HTMLElement>('[part="base"][role="group"]'),
  );

  /** The clone-owned suggestions to render, in order. `suggestionId` must be unique and nonempty;
   *  the first valid occurrence wins. Empty renders nothing at all. Reassign a new array after
   *  changes. */
  @property({ attribute: false }) suggestions: readonly LyraChatSuggestion[] = [];

  /** Wraps into multiple rows instead of a single horizontally scrollable line. */
  @property({ type: Boolean, reflect: true }) wrap = false;

  /** Accessible name for the group. Optional. Omitting it localizes the default `suggestionsLabel`
   *  message; an explicit empty string renders no visible/accessible label. */
  @property() label?: string;

  @state() private activeIndex = 0;
  private readonly rovingToolbar = new RovingToolbarController();
  private pendingFocus?: PendingSuggestionFocus;
  private focusRepairGeneration = 0;

  private normalizeSuggestions(items: readonly LyraChatSuggestion[] | undefined): LyraChatSuggestion[] {
    const seen = new Set<string>();
    const normalized: LyraChatSuggestion[] = [];
    for (const suggestion of items ?? []) {
      let suggestionId: unknown;
      let label: unknown;
      try {
        suggestionId = suggestion?.suggestionId;
        label = suggestion?.label;
      } catch {
        continue;
      }
      if (
        typeof suggestionId !== 'string' ||
        suggestionId.trim() === '' ||
        typeof label !== 'string' ||
        label.trim() === '' ||
        seen.has(suggestionId)
      ) continue;
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
    this.hostDescription.adopted();
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
    const scroller = this.renderRoot.querySelector<Element & { updateComplete?: Promise<unknown> }>(tag('scroller'));
    await scroller?.updateComplete;
    await Promise.resolve();
    if (pending.generation !== this.focusRepairGeneration || !this.isConnected) return;
    const buttons = this.chipButtons();
    const surviving = buttons.find((button) => button.dataset['suggestionId'] === pending.suggestionId);
    const target = surviving ?? buttons[Math.min(pending.index, Math.max(0, buttons.length - 1))] ?? null;
    applyComposedFocusRepair(pending.repair, target);
  }

  /** A `disabled` suggestion cannot be activated -- by click or keyboard -- and emits nothing and
   *  changes no state, matching every other declared-non-actionable entry in this library. */
  private select(suggestion: LyraChatSuggestion): void {
    if (suggestion.disabled) return;
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

  private isSuggestionDisabled(suggestion: LyraChatSuggestion | undefined): boolean {
    return suggestion?.disabled === true;
  }

  /** Degrades `this.activeIndex` off a disabled suggestion to the nearest enabled one (forward
   *  first, then backward), so the `tabindex="0"` resting stop this drives is never one a keyboard
   *  user cannot reach. Returns `-1` only when every suggestion is disabled. Unset regression: with
   *  no disabled suggestion, this is the same `clamp(activeIndex, 0, count - 1)` the tabindex
   *  comparison always used. */
  private effectiveActiveIndex(suggestions: readonly LyraChatSuggestion[]): number {
    const count = suggestions.length;
    if (!count) return -1;
    const clamped = Math.min(Math.max(this.activeIndex, 0), count - 1);
    if (!this.isSuggestionDisabled(suggestions[clamped])) return clamped;
    for (let forward = clamped + 1; forward < count; forward += 1) {
      if (!this.isSuggestionDisabled(suggestions[forward])) return forward;
    }
    for (let backward = clamped - 1; backward >= 0; backward -= 1) {
      if (!this.isSuggestionDisabled(suggestions[backward])) return backward;
    }
    return -1;
  }

  private stopEvent = (e: Event): void => e.stopPropagation();

  private onKeyDown = (e: KeyboardEvent): void => {
    const suggestions = this.effectiveSuggestions;
    const target = this.rovingToolbar.move(
      e,
      suggestions.length,
      this.activeIndex,
      this.effectiveDirection,
      (index) => !this.isSuggestionDisabled(suggestions[index]),
    );
    if (target === null) {
      const navigationKey = e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End';
      if (navigationKey && suggestions.length > 0 && suggestions.every((item) => this.isSuggestionDisabled(item))) {
        e.preventDefault();
      }
      return;
    }
    e.preventDefault();
    this.activeIndex = target;
    this.focusChip(target);
  };

  private renderChip(suggestion: LyraChatSuggestion, index: number, activeIndex: number): TemplateResult {
    return html`
      <button
        type="button"
        part="chip"
        data-suggestion-id=${suggestion.suggestionId}
        tabindex=${index === activeIndex ? '0' : '-1'}
        ?disabled=${suggestion.disabled === true}
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
    const label = this.label == null ? this.localize('suggestionsLabel') : this.label;
    const ariaLabel = this.getAttribute('aria-label') ?? label;
    const activeIndex = this.effectiveActiveIndex(suggestions);
    const chips = repeat(
      suggestions,
      (s) => s.suggestionId,
      (s, i) => this.renderChip(s, i, activeIndex),
    );
    return html`
      <div part="base" role="group" aria-label=${ariaLabel} @keydown=${this.onKeyDown}>
        ${this.wrap
          ? html`<div part="row" class="row">${chips}</div>`
          : html`<lr-scroller orientation="horizontal" without-scrollbar @lr-scroll=${this.stopEvent}><div part="row" class="row">${chips}</div></lr-scroller>`}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-suggestion-chips': LyraSuggestionChips;
  }
}
