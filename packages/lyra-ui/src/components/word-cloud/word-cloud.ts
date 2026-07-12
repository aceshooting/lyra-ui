import { html, nothing, svg, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { srOnly } from '../../internal/a11y.js';
import { layoutWordCloud, MAX_WORDS, type PlacedWord, type WordCloudLayoutResult, type WordCloudWord } from './word-cloud-layout.js';
import { styles } from './word-cloud.styles.js';

export type { WordCloudWord };

const DEFAULT_MIN_FONT_SIZE = 12;
const DEFAULT_MAX_FONT_SIZE = 48;
const PALETTE_SIZE = 8;
const FALLBACK_PALETTE = ['#0969da', '#1a7f37', '#9a6700', '#cf222e', '#8250df', '#bf3989', '#0a7d91', '#57606a'];
/** Must match `[part='word']`'s `font-weight` in word-cloud.styles.ts -- canvas
 *  measures at `normal` weight by default, which is narrower than the actually
 *  rendered bold glyphs, so the spiral layout's collision boxes would end up
 *  too small versus what's actually painted if this ever drifts out of sync. */
const WORD_FONT_WEIGHT = 600;
const NAV_KEYS = new Set(['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End']);
/** Padding, in px, between a focused word's glyph box and its drawn focus ring. */
const FOCUS_RING_PAD = 2;

let scratchCtx: CanvasRenderingContext2D | null | undefined;

/** A detached canvas used solely to measure rendered text width for layout. */
function getScratchCtx(): CanvasRenderingContext2D | null {
  if (scratchCtx === undefined) {
    scratchCtx = document.createElement('canvas').getContext('2d');
  }
  return scratchCtx;
}

const warnedSkipCounts = new Set<number>();

function warnSkippedWords(count: number): void {
  if (warnedSkipCounts.has(count)) return;
  warnedSkipCounts.add(count);
  console.warn(
    `<lyra-word-cloud> could not place ${count} word(s) (blank text, over the ${MAX_WORDS}-word cap, or ` +
      'the layout search was exhausted) -- they were dropped, not rendered.',
  );
}

/**
 * `<lyra-word-cloud>` — a zero-dependency SVG word/tag cloud. First-party
 * invention (no Web Awesome equivalent). Each word's rendered size is scaled
 * from its `weight` and placed via an outward Archimedean-spiral search (the
 * standard word-cloud heuristic: heaviest words placed first, each one
 * spiraling out from the center until it clears every word already placed).
 *
 * Unlike sibling `lyra-sparkline`/`lyra-heatmap` (one `role="img"` glyph
 * standing in for an aggregate value), the individual words here are the
 * meaningful interactive content — but with up to `MAX_WORDS` of them, making
 * every single one its own tab stop would be a poor keyboard experience.
 * Instead, like `lyra-heatmap`'s cells, the whole `[part="svg"]` is one tab
 * stop with roving arrow-key focus (Home/End jump to the first/last word,
 * Enter/Space activates the focused one), a drawn `[part="focus-ring"]`, and
 * a visually-hidden `aria-live="polite"` status announcement.
 *
 * @customElement lyra-word-cloud
 * @event lyra-word-click - Fired on click, or Enter/Space on the focused word.
 * `detail: { text, weight, group }`.
 * @csspart base, svg, word, focus-ring, live-region, empty
 */
export class LyraWordCloud extends LyraElement {
  static styles = [LyraElement.styles, styles, srOnly];

  /** The words to lay out. Re-laid-out whenever this (or a sizing property) changes. */
  @property({ attribute: false }) words: WordCloudWord[] = [];

  /** Font size, in px, for the lowest-weight word. */
  @property({ attribute: 'min-font-size', type: Number }) minFontSize = DEFAULT_MIN_FONT_SIZE;

  /** Font size, in px, for the highest-weight word. */
  @property({ attribute: 'max-font-size', type: Number }) maxFontSize = DEFAULT_MAX_FONT_SIZE;

  /** `sqrt` compresses the weight->font-size mapping so one heavy word doesn't dwarf the rest. */
  @property() scale: 'linear' | 'sqrt' = 'linear';

  /** `mixed` lets some words render rotated 90° for denser packing. */
  @property() orientations: 'horizontal' | 'mixed' = 'horizontal';

  /** Custom categorical palette, cycled by word index (or by `group`, see `words`). Defaults to the `--lyra-word-cloud-color-*` tokens. */
  @property({ attribute: false }) palette?: string[];

  @query('[part="svg"]') private svgEl?: SVGSVGElement;

  private cachedLayout: WordCloudLayoutResult = { placed: [], skipped: [], width: 0, height: 0 };

  /** Roving-focus cursor -- an index into `navOrder()`, not into `cachedLayout.placed`. */
  @state() private focusedIndex: number | null = null;
  /** Text of the visually-hidden `aria-live="polite"` status announcement. */
  @state() private liveText = '';

  private measureText = (text: string, fontSize: number): number => {
    const ctx = getScratchCtx();
    if (!ctx) return text.length * fontSize * 0.6;
    ctx.font = `${WORD_FONT_WEIGHT} ${fontSize}px ${this.fontFamily()}`;
    return ctx.measureText(text).width;
  };

  private fontFamily(): string {
    return getComputedStyle(this).getPropertyValue('--lyra-font').trim() || 'sans-serif';
  }

  private paletteColors(): string[] {
    if (this.palette?.length) return this.palette;
    const cs = getComputedStyle(this);
    const colors: string[] = [];
    for (let i = 0; i < PALETTE_SIZE; i++) {
      colors.push(cs.getPropertyValue(`--lyra-word-cloud-color-${i + 1}`).trim() || FALLBACK_PALETTE[i]!);
    }
    return colors;
  }

  /** Stable keyboard tab order -- the order words were declared in `words`,
   *  independent of the weight-sorted placement order. */
  private navOrder(): PlacedWord[] {
    return [...this.cachedLayout.placed].sort((a, b) => a.originalIndex - b.originalIndex);
  }

  protected willUpdate(changed: PropertyValues): void {
    if (
      changed.has('words') ||
      changed.has('minFontSize') ||
      changed.has('maxFontSize') ||
      changed.has('scale') ||
      changed.has('orientations')
    ) {
      this.cachedLayout = layoutWordCloud(this.words, {
        minFontSize: this.minFontSize,
        maxFontSize: this.maxFontSize,
        scale: this.scale,
        orientations: this.orientations,
        measureText: this.measureText,
      });
      if (this.cachedLayout.skipped.length > 0) warnSkippedWords(this.cachedLayout.skipped.length);
      // The previous focus cursor may no longer address a real word once the
      // data changes out from under it.
      this.focusedIndex = null;
      this.liveText = '';
    }
    this.setAttribute('role', 'group');
    this.setAttribute('aria-label', `Word cloud of ${this.words.length} word${this.words.length === 1 ? '' : 's'}`);
  }

  private activate(word: PlacedWord): void {
    this.emit('lyra-word-click', { text: word.text, weight: word.weight, group: word.group });
  }

  private announce(word: PlacedWord): void {
    this.liveText = `${word.text}, ${word.weight}`;
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
    let next = this.focusedIndex;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(order.length - 1, this.focusedIndex + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = Math.max(0, this.focusedIndex - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = order.length - 1;
    this.focusedIndex = next;
    this.announce(order[next]!);
  };

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

  render(): TemplateResult {
    const layout = this.cachedLayout;
    if (layout.placed.length === 0) {
      return html`<div part="base"><div part="empty">No data</div></div>`;
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

    const order = this.navOrder();
    const focused = this.focusedIndex !== null ? order[this.focusedIndex] : undefined;
    const ring = focused ? this.focusRingRect(focused) : undefined;

    return html`
      <div part="base">
        <svg part="svg" tabindex="0" viewBox="0 0 ${layout.width} ${layout.height}" @keydown=${this.onKeyDown}>
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
        <div part="live-region" class="sr-only" role="status" aria-live="polite">${this.liveText}</div>
      </div>
    `;
  }
}

defineElement('word-cloud', LyraWordCloud);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-word-cloud': LyraWordCloud;
  }
}
