import { html, nothing, svg, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { specialistTokens } from '../../../internal/specialist-tokens.styles.js';
import { srOnly } from '../../../internal/a11y.js';
import { isRtl } from '../../../internal/rtl.js';
import { getScratchCtx } from '../../../internal/canvas.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { finiteNumber, finiteRange } from '../../../internal/numbers.js';
import { sanitizeCssColor } from '../../../internal/safe-css.js';
import { ThemeWatcher } from '../../../internal/theme-watcher.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import {
  layoutWordCloud,
  MAX_FONT_SIZE_PX,
  MAX_WORDS,
  MIN_SANE_FONT_SIZE,
  type PlacedWord,
  type WordCloudLayoutResult,
  type WordCloudRotation,
  type WordCloudScale,
  type WordCloudWord,
} from './word-cloud-layout.js';
import { styles } from './word-cloud.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_items, LYRA_DEFAULT_noData, LYRA_DEFAULT_paginationSummary, LYRA_DEFAULT_wordCloud, LYRA_DEFAULT_wordCloudLegend, LYRA_DEFAULT_wordCloudWord, LYRA_DEFAULT_wordCloudWordAnnouncement, LYRA_DEFAULT_wordCloudWords } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type { WordCloudRotation, WordCloudScale, WordCloudWord };

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
const MAX_INPUT_WORDS = 10_000;
const MAX_WORD_TEXT = 256;
const MAX_TOTAL_WORD_TEXT = 16_384;
const MAX_LEGEND_ITEMS = 100;
const MAX_LEGEND_TEXT = 256;
const MAX_TOTAL_LEGEND_TEXT = 8_192;
const MAX_PALETTE_ITEMS = 64;

function warnSkippedWords(count: number, warnedSkipCounts: Set<number>): void {
  if (warnedSkipCounts.has(count)) return;
  warnedSkipCounts.add(count);
  console.warn(
    `<lr-word-cloud> could not place ${count} word(s) (blank text, over the ${MAX_WORDS}-word cap, or ` +
      'the layout search was exhausted) -- they were dropped, not rendered.'
  );
}

export interface LyraWordCloudEventMap {
  'lr-word-activate': CustomEvent<Readonly<{ text: string; weight: number; group?: string }>>;
}

/** A named CSS-color override shown by the optional word-cloud legend. Invalid colors render a
 * transparent swatch. */
export interface WordCloudLegendItem {
  readonly label: string;
  readonly color: string;
}

function boundedText(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, Math.max(0, limit - 1))}…`;
}

interface NormalizedCollection<T> {
  readonly items: readonly T[];
  readonly dropped: number;
  readonly truncated: number;
  readonly inputCount: number;
}

function normalizeWords(value: unknown): NormalizedCollection<WordCloudWord> {
  let input: readonly unknown[];
  try {
    input = Array.isArray(value) ? value : [];
  } catch {
    input = [];
  }
  let inputCount = 0;
  try { inputCount = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, input.length)); } catch { inputCount = 0; }
  const scanCount = Math.min(inputCount, MAX_INPUT_WORDS);
  const words: WordCloudWord[] = [];
  let dropped = Math.max(0, inputCount - scanCount);
  let truncated = 0;
  let characters = 0;
  for (let index = 0; index < scanCount; index++) {
    try {
      const candidate = input[index] as { text?: unknown; weight?: unknown; color?: unknown; group?: unknown } | null;
      if (typeof candidate !== 'object' || candidate === null) {
        dropped++;
        continue;
      }
      const rawText = candidate.text;
      const rawWeight = candidate.weight;
      const rawColor = candidate.color;
      const rawGroup = candidate.group;
      if (typeof rawText !== 'string') {
        dropped++;
        continue;
      }
      const remaining = MAX_TOTAL_WORD_TEXT - characters;
      if (remaining <= 0) {
        dropped += scanCount - index;
        break;
      }
      const textLimit = Math.min(MAX_WORD_TEXT, remaining);
      const text = boundedText(rawText, textLimit);
      if (!text.trim()) {
        dropped++;
        continue;
      }
      let itemTruncated = rawText.length > textLimit;
      characters += text.length;
      const boundedOptionalText = (raw: unknown): string | undefined => {
        if (typeof raw !== 'string') return undefined;
        const available = MAX_TOTAL_WORD_TEXT - characters;
        if (available <= 0) {
          if (raw.length > 0) itemTruncated = true;
          return undefined;
        }
        const limit = Math.min(MAX_WORD_TEXT, available);
        const result = boundedText(raw, limit);
        if (raw.length > limit) itemTruncated = true;
        characters += result.length;
        return result;
      };
      const color = boundedOptionalText(rawColor);
      const group = boundedOptionalText(rawGroup);
      const word: WordCloudWord = {
        text,
        weight: Math.max(0, finiteNumber(typeof rawWeight === 'number' ? rawWeight : 0, 0)),
        ...(color === undefined ? {} : { color }),
        ...(group === undefined ? {} : { group }),
      };
      if (itemTruncated) truncated++;
      words.push(Object.freeze(word));
    } catch {
      dropped++;
    }
  }
  return { items: Object.freeze(words), dropped, truncated, inputCount };
}

function normalizeLegend(value: unknown): NormalizedCollection<WordCloudLegendItem> {
  let input: readonly unknown[];
  try { input = Array.isArray(value) ? value : []; } catch { input = []; }
  let inputCount = 0;
  try { inputCount = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, input.length)); } catch { inputCount = 0; }
  const length = Math.min(inputCount, MAX_LEGEND_ITEMS);
  const legend: WordCloudLegendItem[] = [];
  let dropped = Math.max(0, inputCount - length);
  let truncated = 0;
  let characters = 0;
  for (let index = 0; index < length; index++) {
    try {
      const item = input[index] as { label?: unknown; color?: unknown } | null;
      if (typeof item !== 'object' || item === null) {
        dropped++;
        continue;
      }
      const rawLabel = item.label;
      const rawColor = item.color;
      if (typeof rawLabel !== 'string' || typeof rawColor !== 'string') {
        dropped++;
        continue;
      }
      const remaining = MAX_TOTAL_LEGEND_TEXT - characters;
      if (remaining <= 0) {
        dropped += length - index;
        break;
      }
      const labelLimit = Math.min(MAX_LEGEND_TEXT, remaining);
      const label = boundedText(rawLabel, labelLimit);
      if (!label.trim()) {
        dropped++;
        continue;
      }
      let itemTruncated = rawLabel.length > labelLimit;
      characters += label.length;
      const colorRemaining = MAX_TOTAL_LEGEND_TEXT - characters;
      const colorLimit = Math.min(MAX_WORD_TEXT, Math.max(0, colorRemaining));
      const color = colorLimit > 0 ? boundedText(rawColor, colorLimit) : '';
      if (rawColor.length > colorLimit) itemTruncated = true;
      characters += color.length;
      if (itemTruncated) truncated++;
      legend.push(Object.freeze({ label, color }));
    } catch {
      // Hostile records are skipped without aborting the remaining valid legend.
      dropped++;
    }
  }
  return { items: Object.freeze(legend), dropped, truncated, inputCount };
}

function normalizePalette(value: unknown): readonly string[] | undefined {
  let input: readonly unknown[];
  try { input = Array.isArray(value) ? value : []; } catch { return undefined; }
  let length = 0;
  try { length = Math.min(input.length, MAX_PALETTE_ITEMS); } catch { return undefined; }
  const palette: string[] = [];
  for (let index = 0; index < length; index++) {
    try {
      const entry = input[index];
      if (typeof entry === 'string') palette.push(boundedText(entry, MAX_WORD_TEXT));
    } catch {
      // Retain later valid entries when a hostile indexed getter fails.
    }
  }
  return Object.freeze(palette);
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
 * role and aggregate accessible name live on that same focusable SVG; authored
 * host semantics stay on the host and are never copied onto a second owner.
 * `[part="live-region"]` is an aria-hidden mirror of the most recent announcement. Mount is silent, and identical edge
 * movements append separate announcements.
 *
 * The eight default palette custom properties inherit from theme ancestors; setting one directly
 * on the word cloud still wins through the normal cascade.
 *
 * @customElement lr-word-cloud
 * @event lr-word-activate - Fired from pointer activation, or Enter/Space on the focused word.
 * `detail: { text, weight, group }`.
 * @csspart base - The word-cloud wrapper.
 * @csspart svg - The word-cloud SVG.
 * @csspart word - A rendered word.
 * @csspart legend - The optional color key below the cloud.
 * @csspart legend-item - One named color entry.
 * @csspart legend-swatch - The color swatch for a legend entry.
 * @csspart legend-label - The visible legend label.
 * @csspart legend-limit - Localized rendered/received legend-entry disclosure when the explicit legend is bounded.
 * @csspart focus-ring - The keyboard focus ring.
 * @csspart live-region - An aria-hidden shadow mirror of the current announcement; the actual
 *   announcement uses the shared light-DOM polite sink.
 * @csspart empty - The empty-state message.
 * @csspart limit - Numeric rendered/input disclosure when input normalization or layout omits data.
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
    items: LYRA_DEFAULT_items,
    noData: LYRA_DEFAULT_noData,
    paginationSummary: LYRA_DEFAULT_paginationSummary,
    wordCloud: LYRA_DEFAULT_wordCloud,
    wordCloudLegend: LYRA_DEFAULT_wordCloudLegend,
    wordCloudWord: LYRA_DEFAULT_wordCloudWord,
    wordCloudWordAnnouncement: LYRA_DEFAULT_wordCloudWordAnnouncement,
    wordCloudWords: LYRA_DEFAULT_wordCloudWords,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, specialistTokens, styles, srOnly];

  private _words: readonly WordCloudWord[] = [];
  private inputDroppedCount = 0;
  private inputTruncatedCount = 0;
  private inputWordCount = 0;

  /** Normalized readonly word snapshot. Invalid records are skipped, text/work is bounded, and
   * every accepted weight is the finite nonnegative value used by layout/events/announcements. */
  @property({ attribute: false })
  get words(): readonly WordCloudWord[] { return this._words; }
  set words(value: readonly WordCloudWord[]) {
    const previous = this._words;
    const normalized = normalizeWords(value);
    this._words = normalized.items;
    this.inputDroppedCount = normalized.dropped;
    this.inputTruncatedCount = normalized.truncated;
    this.inputWordCount = normalized.inputCount;
    this.requestUpdate('words', previous);
  }

  /** Font size, in px, for the lowest-weight word. */
  @property({ attribute: 'min-font-size', type: Number }) minFontSize = DEFAULT_MIN_FONT_SIZE;

  /** Font size, in px, for the highest-weight word. */
  @property({ attribute: 'max-font-size', type: Number }) maxFontSize = DEFAULT_MAX_FONT_SIZE;

  private _scale: WordCloudScale = 'linear';
  /** `sqrt` compresses the weight->font-size mapping so one heavy word doesn't dwarf the rest. */
  @property({ reflect: true })
  get scale(): WordCloudScale { return this._scale; }
  set scale(value: WordCloudScale) {
    const normalized: WordCloudScale = value === 'sqrt' ? 'sqrt' : 'linear';
    const previous = this._scale;
    if (previous === normalized) {
      if (value !== normalized) this.requestUpdate('scale', previous);
      return;
    }
    this._scale = normalized;
    this.requestUpdate('scale', previous);
  }

  /** `mixed` lets some words render rotated 90° for denser packing; `none` keeps text horizontal. */
  private _wordRotation: WordCloudRotation = 'none';
  @property({ attribute: 'word-rotation', reflect: true })
  get wordRotation(): WordCloudRotation { return this._wordRotation; }
  set wordRotation(value: WordCloudRotation) {
    const normalized: WordCloudRotation = value === 'mixed' ? 'mixed' : 'none';
    const previous = this._wordRotation;
    if (previous === normalized) {
      if (value !== normalized) this.requestUpdate('wordRotation', previous);
      return;
    }
    this._wordRotation = normalized;
    this.requestUpdate('wordRotation', previous);
  }

  /** Custom CSS-color palette, cycled by word index (or by `group`, see `words`). Invalid entries
   *  and `url()` paint servers are skipped; an all-invalid palette falls back to the
   *  `--lr-word-cloud-color-*` tokens. */
  private _palette?: readonly string[];
  @property({ attribute: false })
  get palette(): readonly string[] | undefined { return this._palette; }
  set palette(value: readonly string[] | undefined) {
    const previous = this._palette;
    this._palette = normalizePalette(value);
    this.requestUpdate('palette', previous);
  }

  /** Named color overrides shown in the optional legend. When omitted, `show-legend` derives
   *  entries from grouped words and explicitly colored words. This is useful when `words[].color`
   *  or grouped colors carry semantic meaning that should not be discoverable only by visual inspection. */
  private _legend: readonly WordCloudLegendItem[] = [];
  private legendDroppedCount = 0;
  private legendTruncatedCount = 0;
  private legendInputCount = 0;
  @property({ attribute: false })
  get legend(): readonly WordCloudLegendItem[] { return this._legend; }
  set legend(value: readonly WordCloudLegendItem[]) {
    const previous = this._legend;
    const normalized = normalizeLegend(value);
    this._legend = normalized.items;
    this.legendDroppedCount = normalized.dropped;
    this.legendTruncatedCount = normalized.truncated;
    this.legendInputCount = normalized.inputCount;
    this.requestUpdate('legend', previous);
  }

  /** Renders the supplied or derived legend entries below the cloud. It is non-interactive and
   *  does not alter word activation or palette selection. */
  @property({ type: Boolean, reflect: true, attribute: 'show-legend' }) showLegend = false;

  @query('[part="svg"]') private svgEl?: SVGSVGElement;

  private cachedLayout: WordCloudLayoutResult = { placed: [], skipped: [], skippedCount: 0, width: 0, height: 0 };

  /** Roving-focus cursor -- an index into `navOrder()`, not into `cachedLayout.placed`. */
  @state() private focusedIndex: number | null = null;
  /** Text mirrored in `[part="live-region"]`. */
  @state() private liveText = '';
  @state() private pressedOriginalIndex: number | null = null;
  @state() private hoveredOriginalIndex: number | null = null;

  private announcementSink?: AnnouncementSink;
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
    this.pressedOriginalIndex = null;
    this.hoveredOriginalIndex = null;
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
      const colors = this.palette.map(sanitizeCssColor).filter((color): color is string => color !== undefined);
      if (colors.length) return colors;
    }
    const cs = getComputedStyle(this);
    const colors: string[] = [];
    for (let i = 0; i < PALETTE_SIZE; i++) {
      colors.push(
        cs.getPropertyValue(`--lr-word-cloud-color-${i + 1}`).trim() ||
          cs.getPropertyValue(`--_lr-word-cloud-color-${i + 1}-default`).trim() ||
          FALLBACK_PALETTE[i]!
      );
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
      changed.has('wordRotation')
    ) {
      this.relayout();
    }
  }

  private relayout(preserveInteraction = false): void {
    const focusedOriginalIndex =
      preserveInteraction && this.focusedIndex !== null ? this.navOrder()[this.focusedIndex]?.originalIndex : undefined;
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
      wordRotation: this.wordRotation,
      measureText,
    });
    const skippedCount = this.inputDroppedCount + this.cachedLayout.skippedCount;
    if (skippedCount > 0) {
      warnSkippedWords(skippedCount, this.warnedSkipCounts);
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

  override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.captureThemeSignatures();
  }

  private activate(word: PlacedWord): void {
    this.emit('lr-word-activate', Object.freeze({ text: word.text, weight: word.weight, group: word.group }));
  }

  private announce(word: PlacedWord): void {
    const text = this.localize('wordCloudWordAnnouncement', undefined, {
      text: word.text,
      weight: getNumberFormat(this.effectiveLocale).format(word.weight),
    });
    this.liveText = text;
    this.announcementSink?.announce(text);
  }

  private wordIndex(word: PlacedWord): number {
    return this.navOrder().findIndex((candidate) => candidate.originalIndex === word.originalIndex);
  }

  /** Resolve the nearest word from the single adequately sized SVG pointer surface. Individual
   * glyphs are not tiny independent hit targets. */
  private nearestWord(event: MouseEvent | PointerEvent): PlacedWord | undefined {
    const svgElement = this.svgEl;
    if (!svgElement || this.cachedLayout.placed.length === 0) return undefined;
    let x: number;
    let y: number;
    try {
      const matrix = svgElement.getScreenCTM();
      const DOMPointCtor = this.ownerDocument.defaultView?.DOMPoint;
      if (!matrix || !DOMPointCtor) throw new Error('No SVG transform');
      const point = new DOMPointCtor(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      x = point.x;
      y = point.y;
    } catch {
      const rect = svgElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return undefined;
      x = ((event.clientX - rect.left) / rect.width) * this.cachedLayout.width;
      y = ((event.clientY - rect.top) / rect.height) * this.cachedLayout.height;
    }
    let nearest: PlacedWord | undefined;
    let distance = Number.POSITIVE_INFINITY;
    for (const word of this.cachedLayout.placed) {
      const dx = word.x - x;
      const dy = word.y - y;
      const candidateDistance = dx * dx + dy * dy;
      if (candidateDistance < distance) {
        distance = candidateDistance;
        nearest = word;
      }
    }
    return nearest;
  }

  private onSvgFocus = (): void => {
    if (this.focusedIndex === null && this.cachedLayout.placed.length > 0) this.focusedIndex = 0;
  };

  private onSvgPointerDown = (event: PointerEvent): void => {
    const word = this.nearestWord(event);
    if (!word) return;
    const index = this.wordIndex(word);
    if (index < 0) return;
    this.focusedIndex = index;
    this.pressedOriginalIndex = word.originalIndex;
    this.svgEl?.focus();
  };

  private onSvgPointerMove = (event: PointerEvent): void => {
    this.hoveredOriginalIndex = this.nearestWord(event)?.originalIndex ?? null;
  };

  private clearPointerPress = (): void => {
    this.pressedOriginalIndex = null;
  };

  private onSvgPointerLeave = (): void => {
    this.pressedOriginalIndex = null;
    this.hoveredOriginalIndex = null;
  };

  private onSvgClick = (event: MouseEvent): void => {
    const word = this.nearestWord(event);
    if (word) this.onWordClick(word);
  };

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

  private collectionSummary(shown: number, total: number, itemLabel: string): string {
    return this.localize('paginationSummary', undefined, {
      start: this.formatCount(shown === 0 ? 0 : 1),
      end: this.formatCount(shown),
      total: this.formatCount(total),
      itemLabel,
    });
  }

  private renderLegend(
    entries: readonly WordCloudLegendItem[],
    explicitInput: boolean,
  ): TemplateResult | typeof nothing {
    if (!this.showLegend) return nothing;
    const hasLimit = explicitInput && (this.legendDroppedCount > 0 || this.legendTruncatedCount > 0);
    if (entries.length === 0 && !hasLimit) return nothing;
    const limitText = hasLimit
      ? this.collectionSummary(entries.length, this.legendInputCount, this.localize('items'))
      : '';
    return html`
      ${entries.length
        ? html`<div
            part="legend"
            role="list"
            aria-label=${this.localize('wordCloudLegend')}
            aria-describedby=${hasLimit ? 'legend-limit' : nothing}
          >
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
              `
            )}
          </div>`
        : nothing}
      ${hasLimit ? html`<div id="legend-limit" part="legend-limit">${limitText}</div>` : nothing}
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
    const inputCount = Math.max(this.inputWordCount, this.words.length);
    const omittedCount = this.inputDroppedCount + layout.skippedCount;
    const hasWordLimit = omittedCount > 0 || this.inputTruncatedCount > 0;
    const wordLimitText = hasWordLimit
      ? this.collectionSummary(
          layout.placed.length,
          inputCount,
          this.localize(layout.placed.length === 1 && inputCount === 1 ? 'wordCloudWord' : 'wordCloudWords'),
        )
      : '';
    if (layout.placed.length === 0) {
      return html`<div part="base">
        <div part="empty">${this.localize('noData')}</div>
        ${hasWordLimit ? html`<div id="word-limit" part="limit">${wordLimitText}</div>` : nothing}
      </div>`;
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
    const explicitLegendInput = this.legendInputCount > 0;
    const legendItems = explicitLegendInput
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
    const generatedLabel = this.localize('wordCloud', undefined, {
      count: this.formatCount(layout.placed.length),
      word: this.localize(layout.placed.length === 1 ? 'wordCloudWord' : 'wordCloudWords'),
    });

    return html`
      <div part="base">
        <svg
          part="svg"
          role="application"
          aria-label=${generatedLabel}
          aria-describedby=${hasWordLimit ? 'word-limit' : nothing}
          tabindex="0"
          viewBox="0 0 ${layout.width} ${layout.height}"
          @focus=${this.onSvgFocus}
          @keydown=${this.onKeyDown}
          @pointerdown=${this.onSvgPointerDown}
          @pointermove=${this.onSvgPointerMove}
          @pointerup=${this.clearPointerPress}
          @pointercancel=${this.clearPointerPress}
          @pointerleave=${this.onSvgPointerLeave}
          @click=${this.onSvgClick}
        >
          ${layout.placed.map(
            (w) => svg`<text
              part="word"
              x=${w.x}
              y=${w.y}
              font-size=${w.fontSize}
              fill=${colorFor(w)}
              ?data-hovered=${w.originalIndex === this.hoveredOriginalIndex}
              transform=${w.rotated ? `rotate(-90, ${w.x}, ${w.y})` : nothing}
            >${w.text}</text>`
          )}
          ${ring
            ? svg`<rect
                part="focus-ring"
                ?data-pressed=${focused?.originalIndex === this.pressedOriginalIndex}
                x=${ring.x}
                y=${ring.y}
                width=${ring.width}
                height=${ring.height}
              ></rect>`
            : ''}
        </svg>
        <div id="live-region" part="live-region" class="sr-only" aria-hidden="true">${this.liveText}</div>
        ${hasWordLimit
          ? html`<div id="word-limit" part="limit">${wordLimitText}</div>`
          : nothing}
        ${this.renderLegend(legendItems, explicitLegendInput)}
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
