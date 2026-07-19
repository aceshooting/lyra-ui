import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import { chevronIcon } from '../../../internal/icons.js';
import { finiteCount, finiteInteger } from '../../../internal/numbers.js';
import '../../utility/live-region/live-region.class.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import { styles } from './branch-picker.styles.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';

export interface LyraBranchPickerEventMap {
  'lr-branch-change': CustomEvent<{ index: number }>;
}

/**
 * `<lr-branch-picker>` — the "‹ 2 / 5 ›" navigator across regenerated/edited variants of one
 * message. Pure controlled: it never mutates its own `index` — the same contract `<lr-pagination>`
 * already establishes for `page`. The host listens for `lr-branch-change`, swaps the displayed
 * branch content, and applies the new `index` back.
 *
 * Renders nothing at all while `count < 2`, so a host can bind it unconditionally on every message
 * regardless of whether that message actually has multiple branches yet.
 *
 * @customElement lr-branch-picker
 * @event lr-branch-change - A branch navigation was requested. `detail: { index }` — always a
 *   valid target (never past either bound); the consumer applies `index` after switching the
 *   displayed branch content.
 * @csspart base - The group wrapper (`role="group"`).
 * @csspart previous-button - The previous-branch chevron button.
 * @csspart next-button - The next-branch chevron button.
 * @csspart position - The visible "2 / 5" text.
 */
export class LyraBranchPicker extends LyraElement<LyraBranchPickerEventMap> {
  static styles = [LyraElement.styles, styles];

  /** 0-based current branch, rendered 1-based ("2 / 5"). Controlled -- this component never writes
   *  to it itself. */
  @property({ type: Number, reflect: true }) index = 0;

  /** Total number of branches. While `count < 2` the component renders nothing at all. */
  @property({ type: Number, reflect: true }) count = 1;

  /** Accessible name for the group. Defaults to the localized `branchPickerLabel`. */
  @property() label = '';

  @query('[part="previous-button"]') private previousButtonEl?: HTMLButtonElement;
  @query('[part="next-button"]') private nextButtonEl?: HTMLButtonElement;
  @query('lr-live-region') private liveRegion?: LyraLiveRegion;

  private readonly groupId = nextId('branch-picker');
  /** Gates the position announcement so a freshly-mounted picker never announces its own initial
   *  position -- mirrors `<lr-chat-message>`'s identical `isMounting` gate for status-change
   *  announcements. */
  private isMounting = true;

  /** Read-time-safe view of `count` -- non-negative, finite, truncated to a whole branch count.
   *  Both `index` and `count` are fully controlled (this component never writes to them), so an
   *  out-of-range/non-finite value assigned from outside would otherwise reach the `count - 1`/
   *  `index + 1` arithmetic below unsanitized; a non-finite value falls back to `1` (matching the
   *  property's own default), which keeps the render-nothing-while-`count < 2` contract intact
   *  instead of throwing or displaying `NaN`. */
  private get normalizedCount(): number {
    return finiteCount(this.count, 1);
  }

  /** Read-time-safe view of the controlled `index` property, clamped to `[0, normalizedCount - 1]`
   *  -- never mutates `index` itself, matching this component's fully controlled contract (mirrors
   *  `<lr-pagination>`'s identical `currentPage` pattern). */
  private get normalizedIndex(): number {
    const count = this.normalizedCount;
    if (count === 0) return 0;
    return finiteInteger(this.index, 0, 0, count - 1);
  }

  /** Focuses whichever chevron button isn't currently `disabled` -- mirrors `<lr-copy-button>`'s
   *  own `focus()`-delegation-to-the-internal-control pattern, so this component composes cleanly
   *  as one stop inside a parent toolbar. */
  override focus(options?: FocusOptions): void {
    const target = this.normalizedIndex > 0 ? this.previousButtonEl : this.nextButtonEl;
    (target ?? this.previousButtonEl ?? this.nextButtonEl)?.focus(options);
  }

  override blur(): void {
    this.previousButtonEl?.blur();
    this.nextButtonEl?.blur();
  }

  protected updated(changed: PropertyValues): void {
    const wasMounting = this.isMounting;
    this.isMounting = false;
    if (changed.has('index') && !wasMounting) {
      // `force: true` bypasses the live region's default 500ms coalescing window -- a discrete
      // navigation like this one is a single, deliberate event, not a burst of streaming updates
      // to throttle, and a delayed/dropped announcement here would read as the control silently
      // failing. Same reasoning as `<lr-chat-message>`'s own forced status-change announcements.
      this.liveRegion?.announce(
        this.localize('branchPosition', undefined, { index: this.normalizedIndex + 1, total: this.normalizedCount }),
        { force: true },
      );
    }
  }

  private requestIndex(next: number): void {
    if (next < 0 || next > this.normalizedCount - 1 || next === this.normalizedIndex) return;
    this.emit<{ index: number }>('lr-branch-change', { index: next });
  }

  // `previous-glyph`/`next-glyph` render as plain wrapping `<span>`s around the shared
  // `chevronIcon()` -- it bakes in no direction/rotation of its own (see its doc comment) --
  // and the stylesheet owns 100% of the rotation, both the LTR base state and the RTL override,
  // via `transform` on those two parts.
  render(): TemplateResult {
    const count = this.normalizedCount;
    if (count < 2) return html``;
    const index = this.normalizedIndex;
    const label = this.label || this.localize('branchPickerLabel');
    const ariaLabel = this.getAttribute('aria-label') || label;
    const formatter = getNumberFormat(this.effectiveLocale);
    return html`
      <div part="base" id=${this.groupId} role="group" aria-label=${ariaLabel}>
        <button
          part="previous-button"
          type="button"
          aria-label=${this.localize('branchPrevious')}
          ?disabled=${index <= 0}
          @click=${() => this.requestIndex(index - 1)}
        >
          <span part="previous-glyph">${chevronIcon()}</span>
        </button>
        <span part="position">${formatter.format(index + 1)} / ${formatter.format(count)}</span>
        <button
          part="next-button"
          type="button"
          aria-label=${this.localize('branchNext')}
          ?disabled=${index >= count - 1}
          @click=${() => this.requestIndex(index + 1)}
        >
          <span part="next-glyph">${chevronIcon()}</span>
        </button>
        <lr-live-region></lr-live-region>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-branch-picker': LyraBranchPicker;
  }
}
