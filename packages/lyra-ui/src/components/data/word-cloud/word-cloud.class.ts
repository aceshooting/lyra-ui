import type { LyraPreparedWordCloud, LyraWeightedWord } from '../../../utilities/data-preparation.js';
import type { LyraSourceRevision } from '../../../data-sources.js';
import { sourceCount, sourceRevision } from '../../../internal/source-request-controller.js';
import { CollectionSourceTracker } from '../../../internal/collection-source-tracker.js';
import { html, nothing, svg, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { specialistTokens } from '../../../internal/specialist-host-tokens.styles.js';
import { hostAriaLabel, srOnly } from '../../../internal/a11y.js';
import { syncAriaDescribedByElements, updateDescriptionBaseline } from '../../../internal/aria-reflection.js';
import { isRtl } from '../../../internal/rtl.js';
import { getScratchCtx } from '../../../internal/canvas.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { finiteNumber, finiteRange } from '../../../internal/numbers.js';
import { sanitizeCssColor } from '../../../internal/safe-css.js';
import { ThemeWatcher } from '../../../internal/theme-watcher.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { devWarn } from '../../../internal/dev-mode-attribute-warning.js';
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
import { LYRA_DEFAULT_wordCloud, LYRA_DEFAULT_wordCloudLegend, LYRA_DEFAULT_wordCloudPreparedSummary, LYRA_DEFAULT_wordCloudPreparedUnavailable, LYRA_DEFAULT_wordCloudWord, LYRA_DEFAULT_wordCloudWordAnnouncement, LYRA_DEFAULT_wordCloudWords } from '../../../internal/default-strings/data.generated.js';
import { LYRA_DEFAULT_items, LYRA_DEFAULT_noData, LYRA_DEFAULT_paginationSummary } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type { WordCloudRotation, WordCloudScale, WordCloudWord };
export type { LyraPreparedWordCloud, LyraWeightedWord };

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

interface PreparedWordSnapshot {
  readonly revision: LyraSourceRevision;
  readonly counts: LyraPreparedWordCloud['counts'];
  readonly totalWeight: number;
  readonly retainedWeight: number;
  readonly words: readonly LyraWeightedWord[];
}

function preparedField(value: unknown, key: PropertyKey): unknown {
  if (typeof value !== 'object' || value === null) throw new TypeError('Invalid prepared word record');
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !('value' in descriptor)) throw new TypeError('Prepared word fields must be own data properties');
  return descriptor.value;
}

function preparedWeight(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new TypeError('Invalid prepared word weight');
  return value;
}

function preparedText(value: unknown): string {
  if (typeof value !== 'string' || value.length > MAX_WORD_TEXT || !value.trim()) throw new TypeError('Invalid prepared word text');
  return value;
}

/** Copies only the admitted exact labels and scalar metadata; never scans source words. */
function snapshotPreparedWords(value: unknown): PreparedWordSnapshot {
  const revision = sourceRevision(preparedField(value, 'revision'));
  const rawCounts = preparedField(value, 'counts');
  const source = sourceCount(preparedField(rawCounts, 'sourceCount'));
  const valid = sourceCount(preparedField(rawCounts, 'validCount'));
  const invalid = sourceCount(preparedField(rawCounts, 'invalidCount'));
  if (!Number.isSafeInteger(valid + invalid) || valid + invalid !== source) throw new RangeError('Prepared word counts do not conserve observations');
  const totalWeight = preparedWeight(preparedField(value, 'totalWeight'));
  const retainedWeight = preparedWeight(preparedField(value, 'retainedWeight'));
  const raw = preparedField(value, 'words');
  if (!Array.isArray(raw)) throw new TypeError('Invalid prepared words');
  const length = sourceCount(preparedField(raw, 'length'));
  if (length > MAX_WORDS || length > valid || (valid > 0 && length === 0)) throw new RangeError('Prepared word capacity exceeded');
  const words: LyraWeightedWord[] = [];
  const ids = new Set<string>();
  let weightSum = 0, textUnits = 0, largestWeight = 0;
  for (let index = 0; index < length; index++) {
    const word = preparedField(raw, String(index));
    const id = preparedText(preparedField(word, 'id'));
    const text = preparedText(preparedField(word, 'text'));
    const weight = preparedWeight(preparedField(word, 'weight'));
    if (ids.has(id)) throw new TypeError('Duplicate prepared word ID');
    ids.add(id);
    textUnits += text.length;
    weightSum += weight;
    largestWeight = Math.max(largestWeight, weight);
    if (textUnits > MAX_TOTAL_WORD_TEXT || !Number.isFinite(weightSum)) throw new RangeError('Prepared word budget exceeded');
    words.push(Object.freeze({ id, text, weight }));
  }
  if (weightSum !== retainedWeight || totalWeight < largestWeight || (valid === 0 && (totalWeight !== 0 || retainedWeight !== 0))) throw new RangeError('Inconsistent prepared word weights');
  if (retainedWeight > totalWeight || (valid === length && totalWeight > retainedWeight)) {
    const summedCount = valid === length ? valid : source;
    const rounding = (summedCount + length) * (Number.EPSILON / 2);
    const gamma = rounding < 1 ? rounding / (1 - rounding) : 1;
    const relativeDifference = Math.abs(retainedWeight - totalWeight) / Math.max(retainedWeight, totalWeight);
    if (totalWeight === 0 || relativeDifference > gamma) throw new RangeError('Inconsistent prepared total weight');
  }
  return Object.freeze({ revision, counts: Object.freeze({ sourceCount: source, validCount: valid, invalidCount: invalid }), totalWeight, retainedWeight, words: Object.freeze(words) });
}

function warnSkippedWords(count: number, warnedSkipCounts: Set<number>): void {
  if (warnedSkipCounts.has(count)) return;
  warnedSkipCounts.add(count);
  devWarn(
    `<lr-word-cloud> could not place ${count} word(s) (blank text, over the ${MAX_WORDS}-word cap, or ` +
      'the layout search was exhausted) -- they were dropped, not rendered.'
  );
}

export interface LyraWordCloudEventMap {
  'lr-word-activate': CustomEvent<Readonly<{ text: string; weight: number; group?: string; id?: string; revision?: LyraSourceRevision }>>;
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
      const candidate = input[index] as { text?: unknown; weight?: unknown; color?: unknown; group?: unknown;
      } | null;
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
 * Unlike sibling `lr-sparkline` (one `role="img"` glyph
 * standing in for an aggregate value), the individual words here are the
 * meaningful interactive content — but with up to `MAX_WORDS` of them, making
 * every single one its own tab stop would be a poor keyboard experience.
 * Instead, like `lr-heatmap`'s cells, the whole `[part="svg"]` is one tab
 * stop with roving arrow-key focus (Home/End jump to the first/last word,
 * Enter/Space activates the focused one), a drawn `[part="focus-ring"]`, and
 * a shared light-DOM polite status announcement. The application role and
 * aggregate accessible name live on that same focusable SVG. An authored host
 * `aria-label` is forwarded to that semantic owner and takes precedence over
 * the localized generated name; any authored host role remains on the host.
 * `[part="live-region"]` is an aria-hidden mirror of the most recent announcement. Mount is silent, and identical edge
 * movements append separate announcements.
 *
 * The eight default palette custom properties inherit from theme ancestors; setting one directly
 * on the word cloud still wins through the normal cascade.
 *
 * Property-only preparedWords accepts an immutable whole-catalog weighted summary, takes
 * precedence over words, and retains exact selected IDs for activation. Reassign the descriptor
 * or call unnamed requestUpdate() after changing it; null restores legacy words.
 *
 * @customElement lr-word-cloud
 * @event lr-word-activate - Fired from pointer activation, or Enter/Space on the focused word.
 * `detail: { text, weight, group }`; prepared words additionally carry original id and revision.
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
 * @csspart summary - Full-source valid/invalid counts and retained/full weight for prepared words.
 * @csspart error - Localized invalid prepared-input message.
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
    wordCloudPreparedSummary: LYRA_DEFAULT_wordCloudPreparedSummary,
    wordCloudPreparedUnavailable: LYRA_DEFAULT_wordCloudPreparedUnavailable,
    wordCloudWord: LYRA_DEFAULT_wordCloudWord,
    wordCloudWordAnnouncement: LYRA_DEFAULT_wordCloudWordAnnouncement,
    wordCloudWords: LYRA_DEFAULT_wordCloudWords,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, specialistTokens, styles, srOnly];

  private _preparedWords: LyraPreparedWordCloud | null = null;
  private preparedDirty = true;
  private preparedGeneration = 0;
  private preparedContinuationQueued = false;
  private preparedActive = false;
  private preparedInvalid = false;
  private preparedSnapshot?: PreparedWordSnapshot;
  private committedPrepared?: PreparedWordSnapshot;
  private preparedAnnouncementMounted = false;
  private previousPreparedMessage = '';

  /** Whole-source weighted summary with at most 150 unique-ID words and exact bounded labels.
   * Takes precedence over words. Reassign (including the same identity) or explicitly requestUpdate
   * after host descriptor/revision changes. Null restores the current legacy word snapshot. */
  @property({ attribute: false })
  get preparedWords(): LyraPreparedWordCloud | null { return this._preparedWords; }
  set preparedWords(value: LyraPreparedWordCloud | null) {
    const previous = this._preparedWords;
    this._preparedWords = value;
    this.requestUpdate('preparedWords', previous);
    if (previous === value) this.requestUpdate();
  }

  override requestUpdate(...args: Parameters<LyraElement['requestUpdate']>): void {
    if (args[0] === 'preparedWords' || (args[0] === undefined && this._preparedWords !== null)) {
      this.preparedDirty = true;
      this.preparedGeneration = (this.preparedGeneration ?? 0) + 1;
    }
    super.requestUpdate(...args);
  }

  private refreshPreparedWords(): boolean {
    if (!this.preparedDirty) return false;
    this.preparedDirty = false;
    const input = this._preparedWords;
    const generation = this.preparedGeneration;
    let snapshot: PreparedWordSnapshot | undefined;
    let invalid = false;
    if (input !== null) {
      try { snapshot = snapshotPreparedWords(input); }
      catch { invalid = true; }
    }
    if (generation !== this.preparedGeneration || input !== this._preparedWords) return false;
    this.preparedActive = input !== null;
    this.preparedInvalid = invalid;
    this.preparedSnapshot = snapshot;
    return true;
  }

  private preparedMessage(): string {
    if (this.preparedInvalid) return this.localize('wordCloudPreparedUnavailable');
    const model = this.preparedSnapshot;
    if (!model) return '';
    return this.localize('wordCloudPreparedSummary', undefined, {
      retainedCount: this.formatCount(model.words.length), validCount: this.formatCount(model.counts.validCount),
      invalidCount: this.formatCount(model.counts.invalidCount), retainedWeight: this.formatCount(model.retainedWeight),
      totalWeight: this.formatCount(model.totalWeight),
    });
  }

  private _words: readonly WordCloudWord[] = [];
  private readonly assignedSources = new CollectionSourceTracker();
  private inputDroppedCount = 0;
  private inputTruncatedCount = 0;
  private inputWordCount = 0;

  /** Normalized frozen word snapshot. At most 10,000 source records and a bounded aggregate text
   * budget are scanned; invalid records are skipped, and every accepted weight is the finite
   * nonnegative value used by layout/events/announcements. Assign a new array to update. */
  @property({ attribute: false })
  get words(): readonly WordCloudWord[] { return this._words; }
  set words(value: readonly WordCloudWord[]) {
    if (this.assignedSources.isRebind('words', value, this._words)) return;
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

  /** Pins the weight-to-font-size input domain to `[min, max]`, so separate clouds can share one
   * scale instead of each deriving it from its own lightest/heaviest word. Reversed endpoints are
   * normalized; a degenerate or non-finite pair falls back to the data-derived range. Scaling
   * stays finite when opposite-sign finite endpoints would overflow on subtraction. */
  @property({
    attribute: false,
    hasChanged: (value?: [number, number], previous?: [number, number]) =>
      value?.[0] !== previous?.[0] || value?.[1] !== previous?.[1],
  })
  domain?: [number, number];

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

  private _wordRotation: WordCloudRotation = 'none';
  /** `mixed` lets some words render rotated 90° for denser packing; `none` keeps text horizontal. */
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

  private _palette?: readonly string[];
  /** Custom CSS-color palette, cycled by word index (or by `group`, see `words`). Invalid entries
   *  and `url()` paint servers are skipped; an all-invalid palette falls back to the
   *  `--lr-word-cloud-color-*` tokens. Assignment freezes at most 64 colors; assign a new array to
   *  update. */
  @property({ attribute: false })
  get palette(): readonly string[] | undefined { return this._palette; }
  set palette(value: readonly string[] | undefined) {
    if (this.assignedSources.isRebind('palette', value, this._palette)) return;
    const previous = this._palette;
    this._palette = normalizePalette(value);
    this.paint = undefined;
    this.requestUpdate('palette', previous);
  }

  private _legend: readonly WordCloudLegendItem[] = [];
  private legendDroppedCount = 0;
  private legendTruncatedCount = 0;
  private legendInputCount = 0;
  /** Named color overrides shown in the optional legend. When omitted, `with-legend` derives
   *  entries from grouped words and explicitly colored words. This is useful when `words[].color`
   *  or grouped colors carry semantic meaning that should not be discoverable only by visual
   *  inspection. Assignment freezes at most 100 entries; assign a new array to update. */
  @property({ attribute: false })
  get legend(): readonly WordCloudLegendItem[] { return this._legend; }
  set legend(value: readonly WordCloudLegendItem[]) {
    if (this.assignedSources.isRebind('legend', value, this._legend)) return;
    const previous = this._legend;
    const normalized = normalizeLegend(value);
    this._legend = normalized.items;
    this.legendDroppedCount = normalized.dropped;
    this.legendTruncatedCount = normalized.truncated;
    this.legendInputCount = normalized.inputCount;
    this.paint = undefined;
    this.requestUpdate('legend', previous);
  }

  /** Renders the supplied or derived legend entries below the cloud. It is non-interactive and
   *  does not alter word activation or palette selection. */
  @property({ type: Boolean, reflect: true, attribute: 'with-legend' }) withLegend = false;

  @query('[part="svg"]') private svgEl?: SVGSVGElement;

  private cachedLayout: WordCloudLayoutResult = { placed: [], skipped: [], skippedCount: 0, width: 0, height: 0 };
  /** Keyboard tab order: declaration order, independent of the weight-sorted placement order. */
  private order: PlacedWord[] = [];
  /** Word fills (parallel to `placed`) and legend entries with resolved swatches; dropped when the layout, palette or legend changes. */
  private paint?: { fills: string[]; legend: WordCloudLegendItem[] };

  /** Roving-focus cursor -- an index into `order`, not into `cachedLayout.placed`. */
  @state() private focusedIndex: number | null = null;
  /** Text mirrored in `[part="live-region"]`. */
  @state() private liveText = '';
  @state() private pressedOriginalIndex: number | null = null;
  @state() private hoveredOriginalIndex: number | null = null;

  private readonly announcements = new AnnouncementSinkController(this, { eager: ['polite'] });
  private readonly warnedSkipCounts = new Set<number>();
  private typographyThemeSignature = '';
  private paletteThemeSignature = '';
  /** Whether a host `aria-describedby` was last reflected onto `[part="svg"]` -- see
   *  `checkbox.class.ts`'s identically-named field for why the sync call must stay guarded. */
  private hasSyncedDescribedByElements = false;

  constructor() {
    super();
    new ThemeWatcher(this, this.onThemeInvalidated);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.preparedAnnouncementMounted = false;
    if (this._preparedWords !== null) {
      this.preparedDirty = true;
      this.requestUpdate('preparedReconnect', null);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.focusedIndex = null;
    this.liveText = '';
    this.pressedOriginalIndex = null;
    this.hoveredOriginalIndex = null;
    this.preparedAnnouncementMounted = false;
    this.previousPreparedMessage = '';
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.announcements.adopted();
    this.preparedAnnouncementMounted = false;
    if (this._preparedWords !== null) {
      this.preparedDirty = true;
      this.requestUpdate('preparedAdoption', null);
    }
  }

  // ARIA idrefs do not cross a shadow boundary -- a host-authored `aria-describedby` never reaches
  // `[part="svg"]`'s own `role="application"` (which owns the accessible description) unless it is
  // explicitly reflected there. Mirrors `flow-minimap.class.ts`'s identical
  // `syncAriaDescribedByElements` use.
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    // Writes during capture join the current update; defer one coalesced capture until it ends.
    if (this.preparedDirty && this.isConnected && !this.preparedContinuationQueued) {
      this.preparedContinuationQueued = true;
      queueMicrotask(() => {
        this.preparedContinuationQueued = false;
        if (this.preparedDirty && this.isConnected) this.requestUpdate('preparedContinuation', null);
      });
    }
    const message = this.preparedMessage();
    if (this.preparedAnnouncementMounted && message && message !== this.previousPreparedMessage) {
      if (this.preparedInvalid) this.announcements.announceAssertive(message);
      else this.announcements.announcePolite(message);
    }
    this.previousPreparedMessage = message;
    this.preparedAnnouncementMounted = true;
    const describedBy = this.getAttribute('aria-describedby');
    if (!describedBy && !this.hasSyncedDescribedByElements && !this.preparedSnapshot) return;
    // `ariaDescribedByElements` is part of `ARIAMixin`, which every `Element` (SVG included)
    // implements at runtime -- the cast only works around `syncAriaDescribedByElements()`'s
    // `HTMLElement`-shaped parameter, which every other caller happens to satisfy natively.
    this.hasSyncedDescribedByElements = syncAriaDescribedByElements(
      this,
      this.svgEl as unknown as HTMLElement | undefined,
      describedBy,
    );
    const control = this.svgEl;
    if (control && 'ariaDescribedByElements' in control) {
      const references = [...(control.ariaDescribedByElements ?? [])];
      for (const id of ['prepared-summary', 'word-limit']) {
        const own = this.shadowRoot?.getElementById(id);
        if (own) references.push(own);
      }
      updateDescriptionBaseline(control as unknown as HTMLElement, () => { control.ariaDescribedByElements = references; });
      this.hasSyncedDescribedByElements ||= references.length > 0;
    }
  }

  private fontFamily(): string {
    return (
      this.ownerDocument.defaultView?.getComputedStyle(this).getPropertyValue('--lr-font').trim() || 'sans-serif'
    );
  }

  /** Reads the actual `--lr-font-weight-semibold` value the same way
   *  `fontFamily()` reads `--lr-font` -- must match `[part='word']`'s
   *  `font-weight` in word-cloud.styles.ts, so a theme/consumer override of
   *  that token can't silently desync canvas text measurement (used for the
   *  spiral layout's collision boxes) from the actually rendered glyph width. */
  private fontWeight(): string {
    return (
      this.ownerDocument.defaultView?.getComputedStyle(this).getPropertyValue('--lr-font-weight-semibold').trim() ||
      DEFAULT_WORD_FONT_WEIGHT
    );
  }

  private paletteColors(): string[] {
    if (this.palette?.length) {
      const colors = this.palette.map(sanitizeCssColor).filter((color): color is string => color !== undefined);
      if (colors.length) return colors;
    }
    const cs = this.ownerDocument.defaultView?.getComputedStyle(this);
    const colors: string[] = [];
    for (let i = 0; i < PALETTE_SIZE; i++) {
      colors.push(
        cs?.getPropertyValue(`--lr-word-cloud-color-${i + 1}`).trim() ||
          cs?.getPropertyValue(`--_lr-word-cloud-color-${i + 1}-default`).trim() ||
          FALLBACK_PALETTE[i]!
      );
    }
    return colors;
  }

  private resolvePaint(): { fills: string[]; legend: WordCloudLegendItem[] } {
    const placed = this.cachedLayout.placed;
    const colors = this.paletteColors();
    const groupColor = new Map<string, string>();
    const fills = placed.map((word) => {
      const ownColor = sanitizeCssColor(word.color);
      if (ownColor) return ownColor;
      if (word.group) {
        if (!groupColor.has(word.group)) groupColor.set(word.group, colors[groupColor.size % colors.length]!);
        return groupColor.get(word.group)!;
      }
      return colors[word.originalIndex % colors.length]!;
    });
    const entries =
      this.legendInputCount > 0
        ? this.legend
        : placed.reduce<WordCloudLegendItem[]>((items, word, index) => {
            if (!word.group && !word.color) return items;
            const label = word.group || word.text;
            const color = fills[index]!;
            if (!items.some((item) => item.label === label && item.color === color)) items.push({ label, color });
            return items;
          }, []);
    return { fills, legend: entries.map(({ label, color }) => ({ label, color: sanitizeCssColor(color) ?? 'transparent' })) };
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    const preparedChanged = this.refreshPreparedWords();
    if (
      preparedChanged ||
      (!this.preparedActive && changed.has('words')) ||
      changed.has('minFontSize') ||
      changed.has('maxFontSize') ||
      changed.has('domain') ||
      changed.has('scale') ||
      changed.has('wordRotation')
    ) {
      this.relayout();
    }
  }

  private relayout(preserveInteraction = false): void {
    const focusedOriginalIndex =
      preserveInteraction && this.focusedIndex !== null ? this.order[this.focusedIndex]?.originalIndex : undefined;
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
      const ctx = getScratchCtx(this.ownerDocument);
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
    this.committedPrepared = this.preparedSnapshot;
    this.cachedLayout = layoutWordCloud(this.preparedActive ? this.preparedSnapshot?.words ?? [] : this.words, {
      minFontSize,
      maxFontSize,
      domain: this.domain,
      scale: this.scale,
      wordRotation: this.wordRotation,
      measureText,
    });
    this.hitRects = new WeakMap(this.cachedLayout.placed.map(word => [word, this.focusRingRect(word)]));
    this.order = [...this.cachedLayout.placed].sort((a, b) => a.originalIndex - b.originalIndex);
    this.paint = undefined;
    const skippedCount = (this.preparedActive ? 0 : this.inputDroppedCount) + this.cachedLayout.skippedCount;
    if (skippedCount > 0) {
      warnSkippedWords(skippedCount, this.warnedSkipCounts);
    }
    // The previous focus cursor may no longer address a real word once the
    // data changes out from under it.
    if (focusedOriginalIndex !== undefined) {
      const nextIndex = this.order.findIndex((word) => word.originalIndex === focusedOriginalIndex);
      this.focusedIndex = nextIndex < 0 ? null : nextIndex;
      this.liveText = nextIndex < 0 ? '' : priorLiveText;
    } else {
      this.focusedIndex = null;
      this.liveText = '';
    }
    // A relayout moves or replaces the word under a stationary pointer without necessarily
    // delivering pointerleave. Never let the new word at the same original index inherit the old
    // word's visual hover state; the next real pointermove will establish a fresh hit.
    this.hoveredOriginalIndex = null;
  }

  /** Forces a relayout so the font-family theme token (`--lr-font`) is
   *  re-read from computed style — mirrors `lr-chart`'s `refreshTheme()`. ThemeWatcher calls this
   *  automatically only when the effective typography metrics changed; the public method remains
   *  available for host theme systems that need an explicit synchronous refresh. */
  refreshTheme(): void {
    if (this.preparedDirty && this._preparedWords !== null) {
      this.requestUpdate('typographyTheme', null);
      return;
    }
    this.relayout(true);
    this.captureThemeSignatures();
    this.requestUpdate('typographyTheme', null);
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
      this.paint = undefined;
      this.requestUpdate('paletteTheme', null);
    }
  };

  override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.captureThemeSignatures();
  }

  private activate(word: PlacedWord): void {
    if (!this.isConnected || !this.cachedLayout.placed.includes(word)) return;
    const model = this.committedPrepared;
    const original = model?.words[word.originalIndex];
    this.emit('lr-word-activate', Object.freeze({ text: word.text, weight: word.weight, group: word.group,
      ...(original ? { id: original.id, revision: model!.revision } : {}),
    }));
  }

  private announce(word: PlacedWord): void {
    const text = this.localize('wordCloudWordAnnouncement', undefined, {
      text: word.text,
      weight: getNumberFormat(this.effectiveLocale).format(word.weight),
    });
    this.liveText = text;
    this.announcements.announcePolite(text);
  }

  private wordIndex(word: PlacedWord): number {
    return this.order.findIndex((candidate) => candidate.originalIndex === word.originalIndex);
  }

  /** Resolve the word whose box holds the pointer, else the one with the nearest box edge, from the
   * single adequately sized SVG pointer surface. Individual glyphs are not tiny independent hit
   * targets. */
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
      const box = this.hitRects.get(word)!;
      const dx = Math.max(box.x - x, 0, x - box.x - box.width);
      const dy = Math.max(box.y - y, 0, y - box.y - box.height);
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
    if (!this.isConnected || !this.cachedLayout.placed.includes(word)) return;
    const order = this.order;
    const idx = order.findIndex((w) => w.originalIndex === word.originalIndex);
    this.focusedIndex = idx === -1 ? null : idx;
    if (idx !== -1) this.announce(order[idx]!);
    this.svgEl?.focus();
    this.activate(word);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const order = this.order;
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
    if (!this.withLegend) return nothing;
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
                    style=${styleMap({ backgroundColor: item.color })}
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
  private hitRects = new WeakMap<PlacedWord, { x: number; y: number; width: number; height: number }>();

  private focusRingRect(w: PlacedWord): { x: number; y: number; width: number; height: number;
  } {
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
    if (this.preparedInvalid) return html`<div part="base"><div part="error">${this.preparedMessage()}</div></div>`;
    const preparedSummary = this.preparedSnapshot
      ? html`<div id="prepared-summary" part="summary">${this.preparedMessage()}</div>` : nothing;
    const inputCount = this.preparedActive ? this.preparedSnapshot?.words.length ?? 0 : Math.max(this.inputWordCount, this.words.length);
    const omittedCount = (this.preparedActive ? 0 : this.inputDroppedCount) + layout.skippedCount;
    const hasWordLimit = omittedCount > 0 || (!this.preparedActive && this.inputTruncatedCount > 0);
    const wordLimitText = hasWordLimit
      ? this.collectionSummary(
          layout.placed.length,
          inputCount,
          this.localize(layout.placed.length === 1 && inputCount === 1 ? 'wordCloudWord' : 'wordCloudWords'),
        )
      : '';
    if (layout.placed.length === 0) {
      return html`<div part="base">
        ${preparedSummary}
        <div part="empty">${this.localize('noData')}</div>
        ${hasWordLimit ? html`<div id="word-limit" part="limit">${wordLimitText}</div>` : nothing}
      </div>`;
    }

    const { fills, legend } = (this.paint ??= this.resolvePaint());
    const order = this.order;
    const focused = this.focusedIndex !== null ? order[this.focusedIndex] : undefined;
    const ring = focused ? this.focusRingRect(focused) : undefined;
    const generatedLabel = this.localize('wordCloud', undefined, {
      count: this.formatCount(layout.placed.length),
      word: this.localize(layout.placed.length === 1 ? 'wordCloudWord' : 'wordCloudWords'),
    });
    const accessibleLabel = hostAriaLabel(this) ?? generatedLabel;

    return html`
      <div part="base">
        ${preparedSummary}
        <svg
          part="svg"
          role="application"
          aria-label=${accessibleLabel}
          aria-describedby=${[this.getAttribute('aria-describedby') ?? '', this.preparedSnapshot ? 'prepared-summary' : '', hasWordLimit ? 'word-limit' : '']
            .filter(Boolean)
            .join(' ') || nothing}
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
            (w, index) => svg`<text
              part="word"
              x=${w.x}
              y=${w.y}
              font-size=${w.fontSize}
              fill=${fills[index]}
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
        ${this.renderLegend(legend, this.legendInputCount > 0)}
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
