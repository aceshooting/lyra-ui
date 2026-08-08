import { html, nothing, svg, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { specialistTokens } from '../../../internal/specialist-tokens.styles.js';
import { srOnly } from '../../../internal/a11y.js';
import { isRtl } from '../../../internal/rtl.js';
import { getScratchCtx } from '../../../internal/canvas.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { finiteRange } from '../../../internal/numbers.js';
import { sanitizeCssColor } from '../../../internal/safe-css.js';
import { ThemeWatcher } from '../../../internal/theme-watcher.js';
import {
  acquireAnnouncementSink,
  type AnnouncementSink,
} from '../../../internal/announcer.js';
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
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_noData, LYRA_DEFAULT_open, LYRA_DEFAULT_wordCloud, LYRA_DEFAULT_wordCloudLegend, LYRA_DEFAULT_wordCloudWord, LYRA_DEFAULT_wordCloudWordAnnouncement, LYRA_DEFAULT_wordCloudWords } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type { WordCloudOrientations, WordCloudScale, WordCloudWord };

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


function warnSkippedWords(count: number, warnedSkipCounts: Set<number>): void {
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

/** A named CSS-color override shown by the optional word-cloud legend. Invalid colors render a
 * transparent swatch. */
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
 * a shared light-DOM polite status announcement. The host carries the group
 * role and aggregate accessible name; `[part="live-region"]` is an aria-hidden
 * mirror of the most recent announcement. Mount is silent, and identical edge
 * movements append separate announcements.
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
 * @csspart live-region - An aria-hidden shadow mirror of the current announcement; the actual
 *   announcement uses the shared light-DOM polite sink.
 * @csspart empty - The empty-state message.
 * @cssprop [--lr-word-cloud-color-1=var(--lr-color-brand)] - First entry of the default categorical palette.
 * @cssprop [--lr-word-cloud-color-2=var(--lr-color-success)] - Second entry of the default categorical palette.
 * @cssprop [--lr-word-cloud-color-3=var(--lr-color-warning)] - Third entry of the default categorical palette.
 * @cssprop [--lr-word-cloud-color-4=var(--lr-color-danger)] - Fourth entry of the default categorical palette.
 * @cssprop [--lr-word-cloud-color-5=var(--lr-color-chart-1)] - Fifth entry of the default categorical palette.
 * @cssprop [--lr-word-cloud-color-6=var(--lr-color-chart-2)] - Sixth entry of the default categorical palette.
 * @cssprop [--lr-word-cloud-color-7=var(--lr-color-chart-3)] - Seventh entry of the default categorical palette.
 * @cssprop [--lr-word-cloud-color-8=var(--lr-color-chart-4)] - Eighth entry of the default categorical palette.
 * @status stable
 * @since 4.0.0
 */
export class LyraWordCloud extends LyraElement<LyraWordCloudEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    noData: LYRA_DEFAULT_noData,
    open: LYRA_DEFAULT_open,
    wordCloud: LYRA_DEFAULT_wordCloud,
    wordCloudLegend: LYRA_DEFAULT_wordCloudLegend,
    wordCloudWord: LYRA_DEFAULT_wordCloudWord,
    wordCloudWordAnnouncement: LYRA_DEFAULT_wordCloudWordAnnouncement,
    wordCloudWords: LYRA_DEFAULT_wordCloudWords,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, specialistTokens, styles, srOnly];

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

  /** Custom CSS-color palette, cycled by word index (or by `group`, see `words`). Invalid entries
   *  and `url()` paint servers are skipped; an all-invalid palette falls back to the
   *  `--lr-word-cloud-color-*` tokens. */
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
  /** Text mirrored in `[part="live-region"]`. */
  @state() private liveText = '';

  private announcementSink?: AnnouncementSink;
  private authorRole: string | null = null;
  private authorAriaLabel: string | null = null;
  private syncingGeneratedSemantics = false;
  private readonly warnedSkipCounts = new Set<number>();
  private typographyThemeSignature = '';
  private paletteThemeSignature = '';

  constructor() {
    super();
    new ThemeWatcher(this, this.onThemeInvalidated);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncAnnouncementSink();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.releaseAnnouncementSink();
    this.focusedIndex = null;
    this.liveText = '';
  }

  private releaseAnnouncementSink(): void {
    this.announcementSink?.release();
    this.announcementSink = undefined;
  }

  private syncAnnouncementSink(): void {
    if (!this.isConnected) {
      this.releaseAnnouncementSink();
      return;
    }
    if (this.announcementSink?.element.ownerDocument === this.ownerDocument) return;
    this.releaseAnnouncementSink();
    this.announcementSink = acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
  }

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
    if (this.palette?.length) {
      const colors = this.palette
        .map(sanitizeCssColor)
        .filter((color): color is string => color !== undefined);
      if (colors.length) return colors;
    }
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
      count: this.formatCount(this.cachedLayout.placed.length),
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

  private relayout(preserveInteraction = false): void {
    const focusedOriginalIndex = preserveInteraction && this.focusedIndex !== null
      ? this.navOrder()[this.focusedIndex]?.originalIndex
      : undefined;
    const priorLiveText = this.liveText;
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
    if (this.cachedLayout.skipped.length > 0) {
      warnSkippedWords(this.cachedLayout.skipped.length, this.warnedSkipCounts);
    }
    // The previous focus cursor may no longer address a real word once the
    // data changes out from under it.
    if (focusedOriginalIndex !== undefined) {
      const nextIndex = this.navOrder().findIndex((word) => word.originalIndex === focusedOriginalIndex);
      this.focusedIndex = nextIndex < 0 ? null : nextIndex;
      this.liveText = nextIndex < 0 ? '' : priorLiveText;
    } else {
      this.focusedIndex = null;
      this.liveText = '';
    }
  }

  /** Forces a relayout so the font-family theme token (`--lr-font`) is
   *  re-read from computed style — mirrors `lr-chart`'s `refreshTheme()`. ThemeWatcher calls this
   *  automatically only when the effective typography metrics changed; the public method remains
   *  available for host theme systems that need an explicit synchronous refresh. */
  refreshTheme(): void {
    this.relayout(true);
    this.captureThemeSignatures();
    this.requestUpdate();
  }

  private captureThemeSignatures(): void {
    this.typographyThemeSignature = `${this.fontWeight()}\u0000${this.fontFamily()}`;
    this.paletteThemeSignature = this.paletteColors().join('\u0000');
  }

  private onThemeInvalidated = (): void => {
    const typography = `${this.fontWeight()}\u0000${this.fontFamily()}`;
    const palette = this.paletteColors().join('\u0000');
    if (!this.typographyThemeSignature || typography !== this.typographyThemeSignature) {
      this.refreshTheme();
      return;
    }
    if (palette !== this.paletteThemeSignature) {
      this.paletteThemeSignature = palette;
      this.requestUpdate();
    }
  };

  override firstUpdated(): void {
    this.captureThemeSignatures();
  }

  private activate(word: PlacedWord): void {
    this.emit('lr-word-click', { text: word.text, weight: word.weight, group: word.group });
  }

  private announce(word: PlacedWord): void {
    const text = this.localize('wordCloudWordAnnouncement', undefined, {
      text: word.text,
      weight: getNumberFormat(this.effectiveLocale).format(word.weight),
    });
    this.liveText = text;
    this.announcementSink?.announce(text);
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
      const next = e.key === 'End' ? order.length - 1 : 0;
      this.focusedIndex = next;
      this.announce(order[next]!);
      return;
    }
    // Left/Right swap under RTL, matching lr-tab-group's/lr-tree's identical
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
              <span
                part="legend-swatch"
                aria-hidden="true"
                style=${styleMap({ backgroundColor: sanitizeCssColor(item.color) ?? 'transparent' })}
              ></span>
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
      const ownColor = sanitizeCssColor(word.color);
      if (ownColor) return ownColor;
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
          role=${nothing}
          aria-label=${nothing}
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
        <div id="live-region" part="live-region" class="sr-only" aria-hidden="true">${this.liveText}</div>
        ${this.renderLegend(legendItems)}
      </div>
    `;
  }
  /** `localize()` interpolates with a bare `String(value)`, so a number handed to it renders in
   *  ASCII digits no matter the locale -- mixing two numbering systems inside one translated
   *  sentence. Route every user-facing number through the effective locale instead. */
  private formatCount(value: number): string {
    return getNumberFormat(this.effectiveLocale).format(value);
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-word-cloud': LyraWordCloud;
  }

}
