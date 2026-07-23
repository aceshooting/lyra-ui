import { html, nothing, svg, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import { isRtl } from '../../../internal/rtl.js';
import { getScratchCtx } from '../../../internal/canvas.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { finiteRange } from '../../../internal/numbers.js';
import {
  layoutWordCloud,
  MAX_FONT_SIZE_PX,
  MAX_WORDS,
  MIN_SANE_FONT_SIZE,
  type PlacedWord,
  type WordCloudLayoutResult,
  type WordCloudOrientations,
  type WordCloudScale,
  type WordCloudWord,
} from './word-cloud-layout.js';
import { styles } from './word-cloud.styles.js';

export type { WordCloudWord };

const DEFAULT_MIN_FONT_SIZE = 12;
const DEFAULT_MAX_FONT_SIZE = 48;
const PALETTE_SIZE = 8;
const FALLBACK_PALETTE = ['#0969da', '#1a7f37', '#9a6700', '#cf222e', '#8250df', '#bf3989', '#0a7d91', '#57606a'];
/** Fallback for `fontWeight()` below when `--lr-font-weight-semibold`
 *  can't be read (e.g. no computed style available). Must match `[part='word']`'s
 *  default `font-weight` in word-cloud.styles.ts. */
const DEFAULT_WORD_FONT_WEIGHT = '600';
const NAV_KEYS = new Set(['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End']);
/** Padding, in px, between a focused word's glyph box and its drawn focus ring. */
const FOCUS_RING_PAD = 2;


const warnedSkipCounts = new Set<number>();

function warnSkippedWords(count: number): void {
  if (warnedSkipCounts.has(count)) return;
  warnedSkipCounts.add(count);
  console.warn(
    `<lr-word-cloud> could not place ${count} word(s) (blank text, over the ${MAX_WORDS}-word cap, or ` +
      'the layout search was exhausted) -- they were dropped, not rendered.',
  );
}

export interface LyraWordCloudEventMap {
  'lr-word-click': CustomEvent<{ text: string; weight: number; group?: string }>;
}

/** A named color override shown by the optional word-cloud legend. */
export interface WordCloudLegendItem {
  label: string;
  color: string;
}
/**
 * `<lr-word-cloud>` — a zero-dependency SVG word/tag cloud. First-party
 * invention (no Web Awesome equivalent). Each word's rendered size is scaled
 * from its `weight` and placed via an outward Archimedean-spiral search (the
 * standard word-cloud heuristic: heaviest words placed first, each one
 * spiraling out from the center until it clears every word already placed).
 *
 * Unlike sibling `lr-sparkline`/`lr-heatmap` (one `role="img"` glyph
 * standing in for an aggregate value), the individual words here are the
 * meaningful interactive content — but with up to `MAX_WORDS` of them, making
 * every single one its own tab stop would be a poor keyboard experience.
 * Instead, like `lr-heatmap`'s cells, the whole `[part="svg"]` is one tab
 * stop with roving arrow-key focus (Home/End jump to the first/last word,
 * Enter/Space activates the focused one), a drawn `[part="focus-ring"]`, and
 * a visually-hidden `aria-live="polite"` status announcement. The SVG focus
 * target carries the group role and accessible name so the semantics follow
 * the element a keyboard user actually focuses.
 *
 * @customElement lr-word-cloud
 * @event lr-word-click - Fired on click, or Enter/Space on the focused word.
 * `detail: { text, weight, group }`.
 * @csspart base - The word-cloud wrapper.
 * @csspart svg - The word-cloud SVG.
 * @csspart word - A rendered word.
 * @csspart legend - The optional color key below the cloud.
 * @csspart legend-item - One named color entry.
 * @csspart legend-swatch - The color swatch for a legend entry.
 * @csspart legend-label - The visible legend label.
 * @csspart focus-ring - The keyboard focus ring.
 * @csspart live-region - The visually hidden announcement region.
 * @csspart empty - The empty-state message.
 * @cssprop [--lr-word-cloud-color-1=var(--lr-color-brand)] - First entry of the default categorical palette.
 * @cssprop [--lr-word-cloud-color-2=var(--lr-color-success)] - Second entry of the default categorical palette.
 * @cssprop [--lr-word-cloud-color-3=var(--lr-color-warning)] - Third entry of the default categorical palette.
 * @cssprop [--lr-word-cloud-color-4=var(--lr-color-danger)] - Fourth entry of the default categorical palette.
 * @cssprop [--lr-word-cloud-color-5=var(--lr-color-chart-1)] - Fifth entry of the default categorical palette.
 * @cssprop [--lr-word-cloud-color-6=var(--lr-color-chart-2)] - Sixth entry of the default categorical palette.
 * @cssprop [--lr-word-cloud-color-7=var(--lr-color-chart-3)] - Seventh entry of the default categorical palette.
 * @cssprop [--lr-word-cloud-color-8=var(--lr-color-chart-4)] - Eighth entry of the default categorical palette.
 */
export class LyraWordCloud extends LyraElement<LyraWordCloudEventMap> {
  static override styles = [LyraElement.styles, styles, srOnly];

  static override get observedAttributes(): string[] {
    return [...new Set([...super.observedAttributes, 'role'])];
  }

  /** The words to lay out. Re-laid-out whenever this (or a sizing property) changes. */
  @property({ attribute: false }) words: WordCloudWord[] = [];

  /** Font size, in px, for the lowest-weight word. */
  @property({ attribute: 'min-font-size', type: Number }) minFontSize = DEFAULT_MIN_FONT_SIZE;

  /** Font size, in px, for the highest-weight word. */
  @property({ attribute: 'max-font-size', type: Number }) maxFontSize = DEFAULT_MAX_FONT_SIZE;

  /** `sqrt` compresses the weight->font-size mapping so one heavy word doesn't dwarf the rest. */
  @property() scale: WordCloudScale = 'linear';

  /** `mixed` lets some words render rotated 90° for denser packing. */
  @property() orientations: WordCloudOrientations = 'horizontal';

  /** Custom categorical palette, cycled by word index (or by `group`, see `words`). Defaults to the `--lr-word-cloud-color-*` tokens. */
  @property({ attribute: false }) palette?: string[];

  /** Named color overrides shown in the optional legend. When omitted, `show-legend` derives
   *  entries from grouped words and explicitly colored words. This is useful when `words[].color`
   *  or grouped colors carry semantic meaning that should not be discoverable only by visual inspection. */
  @property({ attribute: false }) legend: WordCloudLegendItem[] = [];

  /** Renders the supplied or derived legend entries below the cloud. It is non-interactive and
   *  does not alter word activation or palette selection. */
  @property({ type: Boolean, reflect: true, attribute: 'show-legend' }) showLegend = false;

  @query('[part="svg"]') private svgEl?: SVGSVGElement;

  private cachedLayout: WordCloudLayoutResult = { placed: [], skipped: [], width: 0, height: 0 };

  /** Roving-focus cursor -- an index into `navOrder()`, not into `cachedLayout.placed`. */
  @state() private focusedIndex: number | null = null;
  /** Text of the visually-hidden `aria-live="polite"` status announcement. */
  @state() private liveText = '';

  private authorRole: string | null = null;
  private authorAriaLabel: string | null = null;
  private syncingGeneratedSemantics = false;

  override attributeChangedCallback(name: string, oldValue: string | null, value: string | null): void {
    super.attributeChangedCallback(name, oldValue, value);
    if (oldValue === value || this.syncingGeneratedSemantics) return;
    if (name === 'role') this.authorRole = value;
    if (name === 'aria-label') this.authorAriaLabel = value;
  }

  private fontFamily(): string {
    return getComputedStyle(this).getPropertyValue('--lr-font').trim() || 'sans-serif';
  }

  /** Reads the actual `--lr-font-weight-semibold` value the same way
   *  `fontFamily()` reads `--lr-font` -- must match `[part='word']`'s
   *  `font-weight` in word-cloud.styles.ts, so a theme/consumer override of
   *  that token can't silently desync canvas text measurement (used for the
   *  spiral layout's collision boxes) from the actually rendered glyph width. */
  private fontWeight(): string {
    return getComputedStyle(this).getPropertyValue('--lr-font-weight-semibold').trim() || DEFAULT_WORD_FONT_WEIGHT;
  }

  private paletteColors(): string[] {
    if (this.palette?.length) return this.palette;
    const cs = getComputedStyle(this);
    const colors: string[] = [];
    for (let i = 0; i < PALETTE_SIZE; i++) {
      colors.push(cs.getPropertyValue(`--lr-word-cloud-color-${i + 1}`).trim() || FALLBACK_PALETTE[i]!);
    }
    return colors;
  }

  /** Stable keyboard tab order -- the order words were declared in `words`,
   *  independent of the weight-sorted placement order. */
  private navOrder(): PlacedWord[] {
    return [...this.cachedLayout.placed].sort((a, b) => a.originalIndex - b.originalIndex);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (
      changed.has('words') ||
      changed.has('minFontSize') ||
      changed.has('maxFontSize') ||
      changed.has('scale') ||
      changed.has('orientations')
    ) {
      this.relayout();
    }
    const generatedAriaLabel = this.localize('wordCloud', undefined, {
      count: this.cachedLayout.placed.length,
      word: this.localize(this.cachedLayout.placed.length === 1 ? 'wordCloudWord' : 'wordCloudWords'),
    });
    this.syncingGeneratedSemantics = true;
    try {
      if (this.authorRole === null) this.setAttribute('role', 'group');
      if (this.authorAriaLabel === null) this.setAttribute('aria-label', generatedAriaLabel);
    } finally {
      this.syncingGeneratedSemantics = false;
    }
  }

  private relayout(): void {
    // The font family/weight tokens are invariant for the whole layout pass --
    // read them once here rather than inside the per-word `measureText`
    // callback below, which `layoutWordCloud()` calls once per eligible word
    // (up to `MAX_WORDS`). Each `getComputedStyle()` call can force a style
    // recalculation, so resolving both tokens up front turns what would be
    // two reads per word into two reads per relayout.
    const fontWeight = this.fontWeight();
    const fontFamily = this.fontFamily();
    const measureText = (text: string, fontSize: number): number => {
      const ctx = getScratchCtx();
      if (!ctx) return text.length * fontSize * 0.6;
      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      return ctx.measureText(text).width;
    };
    // Both are clamped finite/positive (bounded at the same MAX_FONT_SIZE_PX ceiling
    // layoutWordCloud()'s own resolveFontSizeBounds() enforces) as a guard at this property
    // boundary, matching this codebase's numeric-guard convention -- a reversed pair
    // (minFontSize > maxFontSize) is left to resolveFontSizeBounds() itself, which already swaps
    // it, rather than duplicating that swap as a second source of truth here.
    const minFontSize = finiteRange(this.minFontSize, DEFAULT_MIN_FONT_SIZE, MIN_SANE_FONT_SIZE, MAX_FONT_SIZE_PX);
    const maxFontSize = finiteRange(this.maxFontSize, DEFAULT_MAX_FONT_SIZE, MIN_SANE_FONT_SIZE, MAX_FONT_SIZE_PX);
    this.cachedLayout = layoutWordCloud(this.words, {
      minFontSize,
      maxFontSize,
      scale: this.scale,
      orientations: this.orientations,
      measureText,
    });
    if (this.cachedLayout.skipped.length > 0) warnSkippedWords(this.cachedLayout.skipped.length);
    // The previous focus cursor may no longer address a real word once the
    // data changes out from under it.
    this.focusedIndex = null;
    this.liveText = '';
  }

  /** Forces a relayout so the font-family theme token (`--lr-font`) is
   *  re-read from computed style — mirrors `lr-chart`'s `refreshTheme()`.
   *  No global theme-broadcast event exists in lyra-ui to subscribe to
   *  automatically; call this from a consumer's own theme-toggle handler. */
  refreshTheme(): void {
    this.relayout();
    this.requestUpdate();
  }

  private activate(word: PlacedWord): void {
    this.emit('lr-word-click', { text: word.text, weight: word.weight, group: word.group });
  }

  private announce(word: PlacedWord): void {
    this.liveText = this.localize('wordCloudWordAnnouncement', undefined, {
      text: word.text,
      weight: getNumberFormat(this.effectiveLocale).format(word.weight),
    });
  }

  private onWordClick = (word: PlacedWord): void => {
    const order = this.navOrder();
    const idx = order.findIndex((w) => w.originalIndex === word.originalIndex);
    this.focusedIndex = idx === -1 ? null : idx;
    if (idx !== -1) this.announce(order[idx]!);
    this.svgEl?.focus();
    this.activate(word);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const order = this.navOrder();
    if (order.length === 0) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (this.focusedIndex !== null) this.activate(order[this.focusedIndex]!);
      return;
    }
    if (!NAV_KEYS.has(e.key)) return;
    e.preventDefault();

    if (this.focusedIndex === null) {
      this.focusedIndex = 0;
      this.announce(order[0]!);
      return;
    }
    // Left/Right swap under RTL, matching lr-tabs's/lr-tree's identical
    // physical-direction handling; Up/Down are direction-agnostic and always
    // mean next/previous through the same stable nav order.
    const rtl = isRtl(this);
    const forwardKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = rtl ? 'ArrowRight' : 'ArrowLeft';

    let next = this.focusedIndex;
    if (e.key === forwardKey || e.key === 'ArrowDown') next = Math.min(order.length - 1, this.focusedIndex + 1);
    else if (e.key === backwardKey || e.key === 'ArrowUp') next = Math.max(0, this.focusedIndex - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = order.length - 1;
    this.focusedIndex = next;
    this.announce(order[next]!);
  };

  private renderLegend(entries: WordCloudLegendItem[]): TemplateResult | typeof nothing {
    if (!this.showLegend || entries.length === 0) return nothing;
    return html`
      <div part="legend" role="list" aria-label=${this.localize('wordCloudLegend')}>
        ${entries.map(
          (item) => html`
            <span part="legend-item" role="listitem">
              <span part="legend-swatch" aria-hidden="true" style=${`background-color:${item.color}`}></span>
              <span part="legend-label">${item.label}</span>
            </span>
          `,
        )}
      </div>
    `;
  }

  /** Axis-aligned focus-ring rect for `w`, already accounting for its rotation. */
  private focusRingRect(w: PlacedWord): { x: number; y: number; width: number; height: number } {
    const boxW = w.rotated ? w.height : w.width;
    const boxH = w.rotated ? w.width : w.height;
    return {
      x: w.x - boxW / 2 - FOCUS_RING_PAD,
      y: w.y - boxH / 2 - FOCUS_RING_PAD,
      width: boxW + 2 * FOCUS_RING_PAD,
      height: boxH + 2 * FOCUS_RING_PAD,
    };
  }

  override render(): TemplateResult {
    const layout = this.cachedLayout;
    if (layout.placed.length === 0) {
      return html`<div part="base"><div part="empty">${this.localize('noData')}</div></div>`;
    }

    const colors = this.paletteColors();
    const groupColor = new Map<string, string>();
    const colorFor = (word: PlacedWord): string => {
      if (word.color) return word.color;
      if (word.group) {
        if (!groupColor.has(word.group)) groupColor.set(word.group, colors[groupColor.size % colors.length]!);
        return groupColor.get(word.group)!;
      }
      return colors[word.originalIndex % colors.length]!;
    };
    const legendItems = this.legend.length
      ? this.legend
      : layout.placed.reduce<WordCloudLegendItem[]>((items, word) => {
          if (!word.group && !word.color) return items;
          const label = word.group || word.text;
          const color = colorFor(word);
          if (!items.some((item) => item.label === label && item.color === color)) items.push({ label, color });
          return items;
        }, []);

    const order = this.navOrder();
    const focused = this.focusedIndex !== null ? order[this.focusedIndex] : undefined;
    const ring = focused ? this.focusRingRect(focused) : undefined;

    return html`
      <div part="base">
        <svg
          part="svg"
          role="group"
          aria-label=${this.getAttribute('aria-label') ?? nothing}
          aria-describedby="live-region"
          tabindex="0"
          viewBox="0 0 ${layout.width} ${layout.height}"
          @keydown=${this.onKeyDown}
        >
          ${layout.placed.map(
            (w) => svg`<text
              part="word"
              x=${w.x}
              y=${w.y}
              font-size=${w.fontSize}
              fill=${colorFor(w)}
              transform=${w.rotated ? `rotate(-90, ${w.x}, ${w.y})` : nothing}
              @click=${() => this.onWordClick(w)}
            >${w.text}</text>`,
          )}
          ${ring
            ? svg`<rect part="focus-ring" x=${ring.x} y=${ring.y} width=${ring.width} height=${ring.height}></rect>`
            : ''}
        </svg>
        <div id="live-region" part="live-region" class="sr-only" role="status" aria-live="polite">${this.liveText}</div>
        ${this.renderLegend(legendItems)}
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-word-cloud': LyraWordCloud;
  }
}
