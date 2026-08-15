import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraSize } from '../../../internal/variants.js';
import { isRtl } from '../../../internal/rtl.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { observeScrollOverflow } from '../../../internal/scroll-overflow.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { styles } from './segmented.styles.js';
import { activeElementIn } from '../../../internal/active-element.js';

export interface LyraSegmentedItem {
  value: string;
  label: string;
  /** Optional decorative leading visual rendered before the label. This is intentionally general
   *  content, not a square-icon-only field: SVG icons, flag glyphs, badges, and other
   *  natural-aspect-ratio Lit content are supported. It is rendered in inert, aria-hidden chrome,
   *  so it cannot provide an independent action or accessible name. */
  icon?: unknown;
  disabled?: boolean;
}

export interface LyraSegmentedEventMap {
  'lr-change': CustomEvent<{ value: string }>;
}

const MAX_SEGMENTED_ITEMS = 256;

/** First-valid-value-wins schema boundary. A segment's value is its selection, event, focus, and
 * keyed-render identity, so later duplicates cannot describe a second observable choice. */
function snapshotSegmentedItems(
  value: unknown
): readonly Readonly<LyraSegmentedItem>[] {
  try {
    if (!Array.isArray(value)) return Object.freeze([]);
  } catch {
    return Object.freeze([]);
  }

  const seenValues = new Set<string>();
  const normalized: Readonly<LyraSegmentedItem>[] = [];
  let length = 0;
  try {
    length = Math.min(value.length, MAX_SEGMENTED_ITEMS);
  } catch {
    return Object.freeze(normalized);
  }
  for (let index = 0; index < length; index += 1) {
    try {
      const candidate: unknown = value[index];
      if (!candidate || typeof candidate !== 'object') continue;
      const record = candidate as Record<string, unknown>;
      const itemValue = record['value'];
      const label = record['label'];
      const disabled = record['disabled'];
      const icon = record['icon'];
      if (
        typeof itemValue !== 'string' ||
        itemValue.length === 0 ||
        itemValue !== itemValue.trim() ||
        seenValues.has(itemValue) ||
        typeof label !== 'string' ||
        (disabled !== undefined && typeof disabled !== 'boolean')
      ) {
        continue;
      }
      seenValues.add(itemValue);
      normalized.push(
        Object.freeze({
          value: itemValue,
          label,
          ...(icon !== undefined ? { icon } : {}),
          ...(disabled !== undefined ? { disabled } : {}),
        })
      );
    } catch {
      // Malformed accessors are isolated to their record; valid neighbors still render.
    }
  }
  return Object.freeze(normalized);
}

/**
 * `<lr-segmented>` — a single-select button row with the WAI-ARIA APG `radiogroup` contract
 * built in: `role="radiogroup"`/`role="radio"`, roving tabindex, automatic activation (click or
 * arrow-key move both select immediately, like a native radio group), cyclic Arrow/Home/End
 * navigation among non-disabled items. First-party invention --
 * "choose exactly one of N labeled options, rendered as a button row" is ubiquitous
 * settings/filter-panel UI. Supports the library's shared `size` ladder, the same one
 * `<lr-select>`/`<lr-combobox>`/`<lr-input>` use, so it can sit flush beside those controls in a
 * toolbar at a matching height.
 *
 * @customElement lr-segmented
 * @event lr-change - Fired when the selected value changes via click or keyboard.
 *   `detail: { value }`.
 * @method scrollToValue - `scrollToValue(value: string): void` — scroll the segment with the given
 *   `value` into view within the (possibly overflowing) track. Called automatically when `value`
 *   changes programmatically; exposed for the "reveal without selecting" case. Honors
 *   `prefers-reduced-motion`.
 * @csspart base - The `role="radiogroup"` root.
 * @csspart segment - A single `role="radio"` button.
 * @csspart segment-icon - Optional decorative leading visual supplied by the item's `icon` field.
 *   Content may have a natural aspect ratio and is not restricted to a square icon; it is inert and
 *   hidden from assistive technology, so it cannot provide an independent action or accessible name.
 * @csspart segment-label - The segment's label text.
 * @cssprop [--lr-scroll-fade-size=2rem] - Width of the fade at each horizontal scroll edge. The
 *   fade is applied only while the track actually overflows, so a row that fits is never dimmed.
 * @cssprop [--lr-segmented-track-min-height=var(--lr-form-control-height)] - Minimum height of the
 *   `base` track, taken from the `size` tier's shared control height; the `2.5rem` (40px) default
 *   applies at the unset/`m` size, matching `<lr-input>`/`<lr-select>`/`<lr-combobox>`'s own shared
 *   default-tier floor. The private default follows `size`; a public value inherited from an
 *   ancestor or set directly on the element remains authoritative in every tier.
 * @cssprop [--lr-segmented-track-height] - Exact height of the `base` track, pinning it at every
 *   `size` tier (sets both `block-size` and `min-block-size`) so the row can sit flush beside a
 *   hard-sized toolbar control. **Genuinely unset by default** — while unset each tier keeps its
 *   own `--lr-segmented-track-min-height` floor and the track grows with its content.
 * @cssprop [--lr-segmented-selected-bg=var(--lr-color-surface)] - Background of the checked
 *   segment. Scoped to `[aria-checked='true']` only, so it never repaints a hovered unselected
 *   segment (which is what hijacking `--lr-color-surface` library-wide used to do).
 * @cssprop [--lr-segmented-selected-color=var(--lr-color-text)] - Text color of the checked segment.
 * @cssprop [--lr-segmented-selected-font-weight=var(--lr-font-weight-semibold)] - Font weight of the
 *   checked segment.
 * @cssprop [--lr-segmented-selected-shadow=var(--lr-shadow-xs)] - Box shadow lifting the checked
 *   segment off the track.
 * @cssprop [--lr-segmented-hover-color=var(--lr-color-text)] - Text color of a hovered segment that
 *   is neither checked nor disabled. Independent of the selected-state props above — recoloring the
 *   checked pill leaves this untouched.
 * @cssprop [--lr-segmented-active-bg=color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-active))] -
 *   Background of a pressed segment that is neither checked nor disabled.
 * @cssprop [--lr-segmented-active-color=var(--lr-segmented-hover-color, var(--lr-color-text))] -
 *   Text color of a pressed segment that is neither checked nor disabled. Its default follows
 *   `--lr-segmented-hover-color` to preserve the established hover/pressed relationship; set this
 *   property to theme the pressed text independently.
 * @cssprop [--lr-segmented-segment-padding=var(--lr-form-control-padding-block) var(--lr-form-control-padding-inline)] -
 *   Each segment's padding, taken from the `size` tier's shared control padding.
 * @cssprop [--lr-segmented-font-size=var(--lr-form-control-font-size)] - Each segment's font size,
 *   taken from the `size` tier's shared control font size.
 * @cssprop [--lr-segmented-track-gap=var(--lr-size-0-125rem)] - Gap between segments.
 * @cssprop [--lr-segmented-track-radius=var(--lr-radius)] - Track corner radius.
 * @cssprop [--lr-segmented-track-padding=var(--lr-size-0-125rem)] - Track inset padding.
 * @status stable
 * @since 4.0.0
 */
export class LyraSegmented extends LyraElement<LyraSegmentedEventMap> {
  static override styles = [LyraElement.styles, sizes, styles];

  private effectiveItems: readonly Readonly<LyraSegmentedItem>[] =
    Object.freeze([]);

  /** The button row's immutable, bounded items. Later duplicate values are ignored. */
  @property({ attribute: false })
  get items(): readonly LyraSegmentedItem[] {
    return this.effectiveItems;
  }
  set items(value: readonly LyraSegmentedItem[]) {
    const previous = this.effectiveItems;
    this.effectiveItems = snapshotSegmentedItems(value);
    this.requestUpdate('items', previous);
  }

  /** The currently selected item's `value`. */
  @property() value = '';

  /** Accessible-name fallback for the radiogroup when the host has no `aria-label`, used when no
   *  visible label context exists around it (e.g. no wrapping `<label>` or adjacent heading). A
   *  host `aria-label` wins by attribute presence, including an explicitly empty value. The resolved
   *  name is set on the `role="radiogroup"` element. */
  @property() label = '';

  /** Visual size, on the library's shared ladder — the same `--lr-form-control-*` scale
   *  `<lr-input>`/`<lr-select>`/`<lr-combobox>`/`<lr-button>` use, so a row of mixed controls at one
   *  `size` lines up. Accepts both spellings of every tier: `2xs`/`xs`/`s`/`m`/`l`/`xl` and Web
   *  Awesome's `small`/`medium`/`large`, so migrating either way is a tag rename. Reflects as the
   *  `size` attribute. */
  @property({ reflect: true }) size: LyraSize = 'm';

  @state() private selectedItem?: Readonly<LyraSegmentedItem>;

  private rehomeSegmentFocus = false;

  constructor() {
    super();
    // Gates the [part="base"] edge fade on the track genuinely overflowing -- see
    // --lr-scroll-fade-size and segmented.styles.ts.
    observeScrollOverflow(this, () =>
      this.renderRoot.querySelector('[part="base"]')
    );
  }

  private select(item: Readonly<LyraSegmentedItem>): void {
    if (item.disabled || item === this.selectedItem) return;
    const valueChanged = item.value !== this.value;
    this.selectedItem = item;
    if (valueChanged) {
      this.value = item.value;
      this.emit('lr-change', { value: item.value });
    }
  }

  private segmentButtonAt(index: number): HTMLElement | null {
    return this.renderRoot.querySelector(
      `[part="segment"][data-index="${index}"]`
    ) as HTMLElement | null;
  }

  private focusItem(index: number): void {
    // Keyboard nav already reveals the focused segment implicitly (native focus() scrolls it into
    // view). scrollToValue below closes the equivalent gap for programmatic `value` changes.
    this.segmentButtonAt(index)?.focus();
  }

  /** Scroll the segment with the given `value` into view within the (possibly overflowing) track.
   *  Public so a consumer can reveal a segment without selecting it. */
  scrollToValue(value: string): void {
    const index = this.items.findIndex((item) => item.value === value);
    this.segmentButtonAt(index)?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: prefersReducedMotion(this.ownerDocument.defaultView)
        ? 'auto'
        : 'smooth',
    });
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.rehomeSegmentFocus) {
      this.rehomeSegmentFocus = false;
      this.renderRoot
        .querySelector<HTMLElement>('[part="segment"][tabindex="0"]')
        ?.focus();
    }
    // Reveal a programmatically-changed selection. Guard the first render so an initial mount
    // never scrolls an ancestor page to the selected segment. Keyboard-driven changes already
    // reveal via focusItem()'s focus(), and re-scrolling there is harmless/idempotent.
    if (
      changed.has('value') &&
      changed.get('value') !== undefined &&
      this.value
    ) {
      this.scrollToValue(this.value);
    }
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (
      changed.has('items') &&
      activeElementIn(this.renderRoot as ShadowRoot)?.getAttribute('part') ===
        'segment'
    ) {
      this.rehomeSegmentFocus = true;
    }
    if (
      changed.has('value') ||
      (changed.has('items') &&
        (!this.selectedItem ||
          !this.items.includes(this.selectedItem) ||
          this.selectedItem.value !== this.value ||
          this.selectedItem.disabled))
    ) {
      this.selectedItem = this.items.find(
        (item) => item.value === this.value && !item.disabled
      );
    }
  }

  /** Resolves the physical occurrence that originated keyboard input before consulting controlled
   * selection. Duplicate values and an unselected group both make value-derived origin ambiguous,
   * while the event path and real shadow focus retain the exact rendered index. */
  private keyboardOriginIndex(event: KeyboardEvent): number {
    const fromEvent = event
      .composedPath()
      .find(
        (candidate): candidate is HTMLElement =>
          (candidate as Partial<Node>).nodeType === 1 &&
          (candidate as Partial<Element>).getAttribute?.('part') ===
            'segment' &&
          (candidate as Element).getRootNode() === this.renderRoot
      );
    const focused = activeElementIn(this.renderRoot as ShadowRoot);
    const candidate =
      fromEvent ??
      (focused?.getAttribute('part') === 'segment'
        ? (focused as HTMLElement)
        : undefined);
    const index = Number(candidate?.dataset['index']);
    return Number.isInteger(index) && index >= 0 && index < this.items.length
      ? index
      : -1;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const navigable = this.items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !item.disabled);
    if (navigable.length === 0) return;
    const focusedIndex = this.keyboardOriginIndex(e);
    const selectedIndex = this.items.indexOf(this.selectedItem!);
    const originIndex = focusedIndex >= 0 ? focusedIndex : selectedIndex;
    // A fresh group deliberately makes its first available item the sequential entry point. Its
    // first arrow press selects that entry (the long-standing APG behavior); a consumer that has
    // explicitly moved focus to a different `tabindex=-1` occurrence has supplied a real origin
    // and must advance from there instead.
    const currentIndex =
      selectedIndex < 0 && this.segmentButtonAt(originIndex)?.tabIndex === 0
        ? -1
        : navigable.findIndex(({ index }) => index === originIndex);
    const rtl = isRtl(this);
    const forwardKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = rtl ? 'ArrowRight' : 'ArrowLeft';

    let targetIndex: number;
    switch (e.key) {
      case forwardKey:
        targetIndex =
          currentIndex < 0 ? 0 : (currentIndex + 1) % navigable.length;
        break;
      case backwardKey:
        targetIndex =
          currentIndex < 0
            ? navigable.length - 1
            : (currentIndex - 1 + navigable.length) % navigable.length;
        break;
      case 'Home':
        targetIndex = 0;
        break;
      case 'End':
        targetIndex = navigable.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    const target = navigable[targetIndex]!;
    this.select(target.item);
    this.focusItem(target.index);
  };

  override render(): TemplateResult {
    const ariaLabel = hostAriaLabel(this) ?? (this.label || nothing);
    // WAI-ARIA APG radiogroup: exactly one non-disabled radio is ever tabbable.
    // That's normally the checked item, but a fresh/cleared radiogroup has no
    // checked item at all -- falling back to `item.value === this.value` alone
    // would then match nothing and drop every button out of the tab order, so
    // fall back to the first non-disabled item when nothing is selected (or the
    // selected value doesn't match a current, non-disabled item).
    const selectedIndex = this.items.indexOf(this.selectedItem!);
    const fallbackSelectedIndex =
      selectedIndex >= 0
        ? selectedIndex
        : this.items.findIndex(
            (item) => item.value === this.value && !item.disabled
          );
    const tabbableIndex =
      fallbackSelectedIndex !== -1
        ? fallbackSelectedIndex
        : this.items.findIndex((item) => !item.disabled);
    return html`
      <div
        part="base"
        role="radiogroup"
        aria-label=${ariaLabel}
        @keydown=${this.onKeyDown}
      >
        ${repeat(
          this.items,
          (item) => item.value,
          (item, index) => html`<button
            type="button"
            part="segment"
            data-value=${item.value}
            data-index=${index}
            role="radio"
            aria-checked=${index === fallbackSelectedIndex ? 'true' : 'false'}
            aria-disabled=${item.disabled ? 'true' : 'false'}
            tabindex=${index === tabbableIndex ? '0' : '-1'}
            @click=${() => this.select(item)}
          >
            ${item.icon !== undefined
              ? html`<span part="segment-icon" aria-hidden="true" inert
                  >${item.icon}</span
                >`
              : nothing}<span part="segment-label">${item.label}</span>
          </button>`
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-segmented': LyraSegmented;
  }
}
