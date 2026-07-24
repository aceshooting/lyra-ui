import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { finiteCount } from '../../../internal/numbers.js';
import { computeLineDiff, pairOpsForSplit, type DiffOp, type DiffSplitRow } from './diff-line-diff.js';
import {
  loadShikiHighlighterCore,
  SHIKI_THEMES,
  type ShikiHighlighterCore,
  type ShikiLanguageInput,
} from '../../conversation/code-block/code-loader.js';
import { styles } from './diff-view.styles.js';

/** How long the "Copied!" confirmation state lasts before reverting -- matches
 *  `lr-copy-button`'s own `COPY_CONFIRM_MS`. */
const COPY_CONFIRM_MS = 1500;

/** Split into logical lines while normalizing all three line-ending conventions (CRLF, lone CR,
 *  LF). A raw `text.split('\n')` leaves a trailing `\r` on every CRLF line -- which makes two files
 *  that differ only in line endings diff as entirely changed, corrupts the emitted `lr-copy`
 *  payload, and (with `white-space: pre-wrap`) renders a spurious blank line after each row -- and
 *  collapses a lone-CR (classic-Mac) document into a single giant line. Used at BOTH the diff and
 *  the shiki-tokenize call sites so their line counts stay in lockstep. */
const splitLines = (text: string): string[] => text.split(/\r\n|\r|\n/);

export interface LyraDiffViewEventMap {
  'lr-copy': CustomEvent<{ text: string }>;
}

/** The internal diff rendering layout -- `'unified'` (the default) is one interleaved column,
 *  `'split'` is two side-by-side columns derived from the same `DiffOp[]`. */
export type LyraDiffViewLayout = 'unified' | 'split';

/**
 * `<lr-diff-view>` — a real two-string line diff (Myers/LCS-style alignment), rendered as
 * interleaved unified-diff output -- not diff-flavored syntax highlighting over an
 * already-formatted string (`lr-code-block`'s `language="diff"` only lexically colors a string
 * the consumer already unified-diffed; it has no two-string-compare entry point). First-party
 * invention (no Web Awesome equivalent).
 *
 * @customElement lr-diff-view
 * @event lr-copy - Fired on copy-button activation. `detail: { text: string }` (the full
 *   unified-diff text, regardless of whether the clipboard write actually succeeded).
 * @csspart base - The root wrapper.
 * @csspart line - A single line. Carries `data-type="equal"|"add"|"remove"|"empty"|"fold"`
 *   (`"empty"` is an unbalanced-replace placeholder cell in `layout="split"` and never carries a
 *   `+`/`-` prefix; `"fold"` is the collapsed-unchanged-lines marker `contextLines` produces).
 * @csspart copy-button - The copy affordance, only rendered while `copyable`.
 * @csspart limit - The localized fallback rendered when either input exceeds `maxLines`.
 * @csspart side - One column in `layout="split"` (`data-side="old"|"new"`).
 * @cssprop [--lr-diff-view-font=var(--lr-font-mono)] - Font family used for the diff lines.
 * @cssprop [--lr-diff-view-add-background=var(--lr-color-success-quiet)] - Added-line background.
 * @cssprop [--lr-diff-view-add-color=var(--lr-color-success)] - Added-line text color.
 * @cssprop [--lr-diff-view-remove-background=var(--lr-color-danger-quiet)] - Removed-line background.
 * @cssprop [--lr-diff-view-remove-color=var(--lr-color-danger)] - Removed-line text color.
 * @cssprop [--lr-diff-view-fold-background=var(--lr-color-surface-raised)] - Fold-marker background.
 * @cssprop [--lr-diff-view-fold-color=var(--lr-color-text-quiet)] - Fold-marker text color.
 */
export class LyraDiffView extends LyraElement<LyraDiffViewEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** The "before" text. Default `''` renders an all-additions diff of `newText`. */
  @property({ attribute: false }) oldText = '';

  /** The "after" text. Default `''` renders an all-removals diff of `oldText`. */
  @property({ attribute: false }) newText = '';

  /** Shows a copy-to-clipboard button for the full unified-diff text. `false` (the default)
   *  renders no button. */
  @property({ type: Boolean }) copyable = false;

  /** `'unified'` (the default) renders today's single interleaved `<pre>`; `'split'` renders two
   *  side-by-side columns derived from the same `DiffOp[]` (see `pairOpsForSplit()`). */
  @property({ reflect: true }) layout: LyraDiffViewLayout = 'unified';

  /** A shiki-recognized language id. Highlighting activates only when this has a matching entry in
   *  `languages` -- there is deliberately no default full-table `lr-code-block`-style fallback, so
   *  this component never reaches shiki's ~200-language dynamic-import table. */
  @property() language = '';

  /** Grammar definitions this instance can highlight, same shape as `lr-code-block-core`'s own
   *  `languages`. */
  @property({ attribute: false }) languages?: Record<string, ShikiLanguageInput>;

  /** How many unchanged lines to keep visible immediately before/after each change. Default
   *  `undefined` renders every line unconditionally, exactly like before this property existed. Set
   *  to a finite number `>= 0` to collapse a longer run of unchanged lines behind a single fold
   *  marker reporting how many lines it hides -- the same context-window convention unified diffs
   *  and `git diff`'s `-U<n>` use. A negative or non-finite value is treated as unset (no folding). */
  @property({ type: Number, attribute: 'context-lines' }) contextLines?: number;

  /** Maximum lines accepted on either input side before rendering a bounded fallback. Defaults
   *  to `5000`. Set to `Infinity` explicitly to opt back into unbounded diffing. */
  @property({ type: Number, attribute: 'max-lines' }) maxLines = 5000;

  @state() private justCopied = false;
  @state() private diffTooLarge = false;

  @state() private highlightedOldLines: string[] | null = null;
  @state() private highlightedNewLines: string[] | null = null;
  private highlightToken = 0;
  private loadHighlighterCore: (
    languages: Record<string, ShikiLanguageInput>,
  ) => Promise<ShikiHighlighterCore | null> = loadShikiHighlighterCore;

  private copyTimeoutId?: ReturnType<typeof setTimeout>;

  // The O(n*m) LCS computation only needs rerunning when the compared texts or their ceiling
  // changes. A render triggered purely by `justCopied` toggling reuses the same result.
  private diffOps: DiffOp[] = [];

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('oldText') || changed.has('newText') || changed.has('maxLines')) {
      const oldLines = splitLines(this.oldText);
      const newLines = splitLines(this.newText);
      const maxLines =
        this.maxLines === Number.POSITIVE_INFINITY
          ? Number.POSITIVE_INFINITY
          : finiteCount(this.maxLines, 5000);
      this.diffTooLarge = oldLines.length > maxLines || newLines.length > maxLines;
      this.diffOps = this.diffTooLarge ? [] : computeLineDiff(oldLines, newLines);
    }
    if (
      changed.has('oldText') ||
      changed.has('newText') ||
      changed.has('language') ||
      changed.has('languages') ||
      changed.has('maxLines')
    ) {
      this.syncHighlight();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.copyTimeoutId);
    this.copyTimeoutId = undefined;
    this.justCopied = false;
  }

  private syncHighlight(): void {
    const token = ++this.highlightToken;
    if (this.diffTooLarge) {
      this.highlightedOldLines = null;
      this.highlightedNewLines = null;
      return;
    }
    const lang = this.language;
    const languages = this.languages;
    if (!lang || !languages?.[lang]) {
      this.highlightedOldLines = null;
      this.highlightedNewLines = null;
      return;
    }
    void this.loadHighlighterCore(languages).then((hl) => {
      if (token !== this.highlightToken) return; // superseded by a newer oldText/newText/language/languages change
      if (!hl) {
        this.highlightedOldLines = null;
        this.highlightedNewLines = null;
        return;
      }
      this.highlightedOldLines = this.tokenizeLines(hl, this.oldText, lang);
      this.highlightedNewLines = this.tokenizeLines(hl, this.newText, lang);
    });
  }

  /** Tokenizes `text` as one document (so multi-line tokens survive) and splits shiki's own
   *  rendered `.line` spans back into a per-source-line HTML array, normalized to exactly
   *  `splitLines(text).length` entries -- shiki's own trailing-newline handling can otherwise be
   *  off by one relative to a plain split. MUST use the same `splitLines` as the diff at
   *  `willUpdate` above: if this counted lines differently (e.g. plain `split('\n')` while the diff
   *  normalizes CRLF), every CRLF document would misindex `highlightedOldLines`/`-NewLines`. */
  private tokenizeLines(hl: ShikiHighlighterCore, text: string, lang: string): string[] | null {
    try {
      const html = hl.codeToHtml(text, { lang, themes: SHIKI_THEMES });
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const lines = Array.from(doc.querySelectorAll('code > .line')).map((line) => line.innerHTML);
      const expected = splitLines(text).length;
      while (lines.length > expected) lines.pop();
      while (lines.length < expected) lines.push('');
      return lines;
    } catch {
      // Malformed input for this grammar, or any other shiki-internal failure -- fall back to
      // plain text rather than a blank diff.
      return null;
    }
  }

  /** Computes which `equal` ops a fold marker should hide, keyed by object identity (not array
   *  index) so the same result works for both `renderUnified()`'s flat op sequence and
   *  `renderSplit()`'s `pairOpsForSplit()` rows -- an equal op's `DiffOp` object is the exact same
   *  reference in both places. `foldBefore` maps the first visible op *after* a hidden run to how
   *  many lines that run hid (the marker renders immediately before that op); a run hidden all the
   *  way to the end of the diff has no "next op" to key off, so its count surfaces separately as
   *  `trailingFold`. Only maximal `equal` runs are ever folded -- `add`/`remove` ops are always
   *  visible. A run that is both the very first and very last thing in the diff (i.e. `oldText` and
   *  `newText` are identical) is never folded: there is no adjacent change to give context around. */
  private computeFolds(): { visible: Set<DiffOp>; foldBefore: Map<DiffOp, number>; trailingFold: number } {
    const ops = this.diffOps;
    const visible = new Set<DiffOp>(ops);
    const foldBefore = new Map<DiffOp, number>();
    let trailingFold = 0;
    const ctx =
      this.contextLines == null || !Number.isFinite(this.contextLines) || this.contextLines < 0
        ? undefined
        : finiteCount(this.contextLines);
    if (ctx === undefined) return { visible, foldBefore, trailingFold };
    let i = 0;
    while (i < ops.length) {
      if (ops[i]!.type !== 'equal') {
        i++;
        continue;
      }
      let j = i;
      while (j < ops.length && ops[j]!.type === 'equal') j++;
      const runLength = j - i;
      const isLeading = i === 0;
      const isTrailing = j === ops.length;
      if (isLeading && isTrailing) {
        // Nothing changed anywhere in the diff -- show it all, there's no change to fold around.
      } else if (isLeading) {
        const hidden = Math.max(0, runLength - ctx);
        if (hidden > 0) {
          for (let k = i; k < i + hidden; k++) visible.delete(ops[k]!);
          foldBefore.set(ops[i + hidden]!, hidden);
        }
      } else if (isTrailing) {
        const shown = Math.min(ctx, runLength);
        const hidden = runLength - shown;
        if (hidden > 0) {
          for (let k = i + shown; k < j; k++) visible.delete(ops[k]!);
          trailingFold = hidden;
        }
      } else if (runLength > ctx * 2) {
        const hiddenStart = i + ctx;
        const hiddenEnd = j - ctx;
        for (let k = hiddenStart; k < hiddenEnd; k++) visible.delete(ops[k]!);
        foldBefore.set(ops[hiddenStart]!, hiddenEnd - hiddenStart);
      }
      i = j;
    }
    return { visible, foldBefore, trailingFold };
  }

  private foldMarker(count: number): TemplateResult {
    const text = this.localize(count === 1 ? 'diffViewHiddenLines' : 'diffViewHiddenLinesPlural', undefined, {
      count: getNumberFormat(this.effectiveLocale).format(count),
    });
    return html`<div part="line" data-type="fold">${text}</div>`;
  }

  private get unifiedText(): string {
    return this.diffOps
      .map((op) => `${op.type === 'add' ? '+' : op.type === 'remove' ? '-' : ' '} ${op.text}`)
      .join('\n');
  }

  private onCopyClick = (): void => {
    const text = this.unifiedText;
    try {
      navigator.clipboard?.writeText(text).catch(() => {
        // best-effort -- lr-copy still fires with the intended text regardless
      });
    } catch {
      // Some clipboard shims and restricted browser contexts throw before returning a promise.
      // The event contract remains best-effort and still reports the intended snapshot below.
    }
    this.emit<{ text: string }>('lr-copy', { text });
    this.justCopied = true;
    clearTimeout(this.copyTimeoutId);
    this.copyTimeoutId = setTimeout(() => {
      this.justCopied = false;
    }, COPY_CONFIRM_MS);
  };

  // Tracks each op's index within the *original* per-source-line `oldText`/`newText` arrays --
  // `computeLineDiff` consumes one old line for every `remove`/`equal` op and one new line for
  // every `add`/`equal` op (an `equal` op advances both sides in lockstep), so both counters must
  // independently advance on `equal`. (A same-shaped but subtly wrong version of this that only
  // advances `newCounter` on `add` -- treating `equal` as belonging solely to the old side -- was
  // caught and fixed here: it silently misindexes `highlightedNewLines` for every `add` op that
  // follows an `equal` one, e.g. old=['a','b'] new=['a','x','b'] would highlight `x` using new
  // line 0's ('a') tokens instead of new line 1's.)
  private renderUnified(): TemplateResult {
    const { visible, foldBefore, trailingFold } = this.computeFolds();
    let oldCounter = 0;
    let newCounter = 0;
    const rows: TemplateResult[] = [];
    for (const op of this.diffOps) {
      const fold = foldBefore.get(op);
      if (fold !== undefined) rows.push(this.foldMarker(fold));
      if (visible.has(op)) {
        const marker = op.type === 'add' ? '+' : op.type === 'remove' ? '-' : ' ';
        const lines = op.type === 'add' ? this.highlightedNewLines : this.highlightedOldLines;
        const index = op.type === 'add' ? newCounter : oldCounter;
        const highlighted = lines?.[index];
        rows.push(html`<div part="line" data-type=${op.type}>${marker} ${highlighted !== undefined ? unsafeHTML(highlighted) : op.text}</div>`);
      }
      if (op.type !== 'add') oldCounter++;
      if (op.type !== 'remove') newCounter++;
    }
    if (trailingFold > 0) rows.push(this.foldMarker(trailingFold));
    return html`<pre>${rows}</pre>`;
  }

  private renderSplit(): TemplateResult {
    const { visible, foldBefore, trailingFold } = this.computeFolds();
    const splitRows = pairOpsForSplit(this.diffOps);
    let oldCounter = 0;
    let newCounter = 0;
    const leftCells: TemplateResult[] = [];
    const rightCells: TemplateResult[] = [];
    for (const row of splitRows) {
      // An `equal` row's `left`/`right` are the exact same `DiffOp` reference (see
      // `pairOpsForSplit()`), so folding either side is equivalent -- checked once via `row.left`.
      const foldOp = row.left && row.left.type === 'equal' ? row.left : row.right && row.right.type === 'equal' ? row.right : null;
      const fold = foldOp ? foldBefore.get(foldOp) : undefined;
      if (fold !== undefined) {
        leftCells.push(this.foldMarker(fold));
        rightCells.push(this.foldMarker(fold));
      }
      const rowHidden = foldOp !== null && !visible.has(foldOp);
      if (!rowHidden) {
        leftCells.push(this.renderSplitCell(row.left, row.left ? oldCounter : -1, this.highlightedOldLines));
        rightCells.push(this.renderSplitCell(row.right, row.right ? newCounter : -1, this.highlightedNewLines));
      }
      if (row.left) oldCounter++;
      if (row.right) newCounter++;
    }
    if (trailingFold > 0) {
      leftCells.push(this.foldMarker(trailingFold));
      rightCells.push(this.foldMarker(trailingFold));
    }
    return html`
      <div class="split-grid">
        <div part="side" data-side="old" role="region" aria-label=${this.localize('diffViewOldLabel')}>
          ${leftCells}
        </div>
        <div part="side" data-side="new" role="region" aria-label=${this.localize('diffViewNewLabel')}>
          ${rightCells}
        </div>
      </div>
    `;
  }

  private renderSplitCell(
    op: DiffSplitRow['left'],
    lineIndex: number,
    highlightedLines: string[] | null,
  ): TemplateResult {
    if (!op) return html`<div part="line" data-type="empty"></div>`;
    const marker = op.type === 'add' ? '+' : op.type === 'remove' ? '-' : ' ';
    const highlighted = lineIndex >= 0 ? highlightedLines?.[lineIndex] : undefined;
    return html`<div part="line" data-type=${op.type}>${marker} ${highlighted !== undefined ? unsafeHTML(highlighted) : op.text}</div>`;
  }

  override render(): TemplateResult {
    if (this.diffTooLarge) {
      return html`<div part="base"><div part="limit">${this.localize('diffViewTooLarge')}</div></div>`;
    }
    return html`
      <div part="base">
        ${this.copyable
          ? html`<button
              part="copy-button"
              type="button"
              aria-label=${this.justCopied ? this.localize('copied') : this.localize('copyDiff')}
              @click=${this.onCopyClick}
            >
              ${this.justCopied ? this.localize('copied') : this.localize('copy')}
            </button>`
          : nothing}
        ${this.layout === 'split' ? this.renderSplit() : this.renderUnified()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-diff-view': LyraDiffView;
  }
}
