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
import type { LyraToolbarAction } from '../message-actions/toolbar-actions.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_branchNext, LYRA_DEFAULT_branchPickerLabel, LYRA_DEFAULT_branchPosition, LYRA_DEFAULT_branchPrevious } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface LyraBranchPickerEventMap {
  'lr-branch-change': CustomEvent<{ index: number }>;
  'lr-toolbar-actions-change': Event;
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
 * @event lr-toolbar-actions-change - No-detail coordination event emitted when the logical
 *   toolbar actions exposed by this provider change availability or order.
 * @csspart base - The group wrapper (`role="group"`).
 * @csspart previous-button - The previous-branch chevron button.
 * @csspart previous-glyph - The chevron glyph wrapper inside `previous-button`.
 * @csspart next-button - The next-branch chevron button.
 * @csspart next-glyph - The chevron glyph wrapper inside `next-button`.
 * @csspart position - The visible "2 / 5" text.
 * @status stable
 * @since 4.0.0
 */
export class LyraBranchPicker extends LyraElement<LyraBranchPickerEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    branchNext: LYRA_DEFAULT_branchNext,
    branchPickerLabel: LYRA_DEFAULT_branchPickerLabel,
    branchPosition: LYRA_DEFAULT_branchPosition,
    branchPrevious: LYRA_DEFAULT_branchPrevious,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

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

  private readonly previousToolbarAction = this.createToolbarAction('previous');
  private readonly nextToolbarAction = this.createToolbarAction('next');

  private createToolbarAction(direction: 'previous' | 'next'): LyraToolbarAction {
    const host = this;
    const button = () => direction === 'previous' ? host.previousButtonEl : host.nextButtonEl;
    let leasedButton: HTMLButtonElement | undefined;
    let authoredTabIndex: string | null = null;
    let lastManagedTabIndex: string | null = null;
    let consumerOwnsTabIndex = false;
    const releaseTabIndex = (): void => {
      const target = leasedButton;
      if (target && target.getAttribute('tabindex') === lastManagedTabIndex) {
        if (authoredTabIndex === null) target.removeAttribute('tabindex');
        else target.setAttribute('tabindex', authoredTabIndex);
      }
      leasedButton = undefined;
      authoredTabIndex = null;
      lastManagedTabIndex = null;
      consumerOwnsTabIndex = false;
    };
    return {
      id: direction,
      get disabled() {
        return !button() || button()!.disabled;
      },
      focus(options) {
        button()?.focus(options);
      },
      setTabIndex(tabIndex) {
        const target = button();
        if (!target) {
          releaseTabIndex();
          return;
        }
        if (leasedButton !== target) {
          releaseTabIndex();
          leasedButton = target;
          authoredTabIndex = target.getAttribute('tabindex');
        }
        if (
          consumerOwnsTabIndex ||
          (lastManagedTabIndex !== null &&
            target.getAttribute('tabindex') !== lastManagedTabIndex)
        ) {
          consumerOwnsTabIndex = true;
          return;
        }
        target.tabIndex = tabIndex;
        lastManagedTabIndex = target.getAttribute('tabindex');
      },
      releaseTabIndex,
      matchesEventPath(path) {
        const target = button();
        return target !== undefined && path.includes(target);
      },
    };
  }

  /** Ordered logical actions exposed to an enclosing toolbar without exposing shadow nodes.
   *  A parent releases its optional lease when this provider leaves, restoring an untouched
   *  authored chevron tabindex without replacing a later consumer value. */
  getToolbarActions(): readonly LyraToolbarAction[] {
    return this.normalizedCount < 2
      ? []
      : [this.previousToolbarAction, this.nextToolbarAction];
  }

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

  /** Activates the currently enabled chevron, matching a click on the shadow control. */
  override click(): void {
    const target = this.normalizedIndex > 0 ? this.previousButtonEl : this.nextButtonEl;
    (target ?? this.previousButtonEl ?? this.nextButtonEl)?.click();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const wasMounting = this.isMounting;
    this.isMounting = false;
    if (changed.has('index') && !wasMounting) {
      // `force: true` bypasses the live region's default 500ms coalescing window -- a discrete
      // navigation like this one is a single, deliberate event, not a burst of streaming updates
      // to throttle, and a delayed/dropped announcement here would read as the control silently
      // failing. Same reasoning as `<lr-chat-message>`'s own forced status-change announcements.
      const formatter = getNumberFormat(this.effectiveLocale);
      this.liveRegion?.announce(this.formatPosition(formatter), { force: true });
    }
    if (changed.has('index') || changed.has('count')) {
      if (this.normalizedCount < 2) this.releaseToolbarActions();
      this.emit('lr-toolbar-actions-change');
    }
  }

  override disconnectedCallback(): void {
    this.isMounting = true;
    this.releaseToolbarActions();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.releaseToolbarActions();
  }

  private releaseToolbarActions(): void {
    this.previousToolbarAction.releaseTabIndex?.();
    this.nextToolbarAction.releaseTabIndex?.();
  }

  private formatPosition(formatter = getNumberFormat(this.effectiveLocale)): string {
    return this.localize('branchPosition', undefined, {
      index: formatter.format(this.normalizedIndex + 1),
      total: formatter.format(this.normalizedCount),
    });
  }

  private requestIndex(next: number): void {
    if (next < 0 || next > this.normalizedCount - 1 || next === this.normalizedIndex) return;
    this.emit('lr-branch-change', { index: next });
  }

  // `previous-glyph`/`next-glyph` render as plain wrapping `<span>`s around the shared
  // `chevronIcon()` -- it bakes in no direction/rotation of its own (see its doc comment) --
  // and the stylesheet owns 100% of the rotation, both the LTR base state and the RTL override,
  // via `transform` on those two parts.
  override render(): TemplateResult {
    const count = this.normalizedCount;
    if (count < 2) return html``;
    const index = this.normalizedIndex;
    const label = this.label || this.localize('branchPickerLabel');
    const ariaLabel = this.getAttribute('aria-label') ?? label;
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
        <span part="position">${this.formatPosition(formatter)}</span>
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
