import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { computeLineDiff, pairOpsForSplit, type DiffOp, type DiffSplitRow } from './diff-line-diff.js';
import {
  loadShikiHighlighterCore,
  SHIKI_THEMES,
  type ShikiHighlighterCore,
  type ShikiLanguageInput,
} from '../code-block/code-loader.js';
import { styles } from './diff-view.styles.js';

/** How long the "Copied!" confirmation state lasts before reverting -- matches
 *  `lr-copy-button`'s own `COPY_CONFIRM_MS`. */
const COPY_CONFIRM_MS = 1500;

export interface LyraDiffViewEventMap {
  'lr-copy': CustomEvent<{ text: string }>;
}

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
 * @csspart line - A single line. Carries `data-type="equal"|"add"|"remove"|"empty"` (`"empty"` is
 *   an unbalanced-replace placeholder cell in `layout="split"` and never carries a `+`/`-` prefix).
 * @csspart copy-button - The copy affordance, only rendered while `copyable`.
 * @csspart side - One column in `layout="split"` (`data-side="old"|"new"`).
 */
export class LyraDiffView extends LyraElement<LyraDiffViewEventMap> {
  static styles = [LyraElement.styles, styles];

  /** The "before" text. Default `''` renders an all-additions diff of `newText`. */
  @property({ attribute: false }) oldText = '';

  /** The "after" text. Default `''` renders an all-removals diff of `oldText`. */
  @property({ attribute: false }) newText = '';

  /** Shows a copy-to-clipboard button for the full unified-diff text. `false` (the default)
   *  renders no button. */
  @property({ type: Boolean }) copyable = false;

  /** `'unified'` (the default) renders today's single interleaved `<pre>`; `'split'` renders two
   *  side-by-side columns derived from the same `DiffOp[]` (see `pairOpsForSplit()`). */
  @property({ reflect: true }) layout: 'unified' | 'split' = 'unified';

  /** A shiki-recognized language id. Highlighting activates only when this has a matching entry in
   *  `languages` -- there is deliberately no default full-table `lr-code-block`-style fallback, so
   *  this component never reaches shiki's ~200-language dynamic-import table. */
  @property() language = '';

  /** Grammar definitions this instance can highlight, same shape as `lr-code-block-core`'s own
   *  `languages`. */
  @property({ attribute: false }) languages?: Record<string, ShikiLanguageInput>;

  @state() private justCopied = false;

  @state() private highlightedOldLines: string[] | null = null;
  @state() private highlightedNewLines: string[] | null = null;
  private highlightToken = 0;
  private loadHighlighterCore: (
    languages: Record<string, ShikiLanguageInput>,
  ) => Promise<ShikiHighlighterCore | null> = loadShikiHighlighterCore;

  private copyTimeoutId?: ReturnType<typeof setTimeout>;

  // The O(n*m) LCS table only actually needs recomputing when the two compared texts change --
  // caching it here means a render triggered purely by `justCopied` toggling (the copy-button
  // label swap) reuses the same result instead of re-running the diff from scratch.
  private diffOps: DiffOp[] = [];

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('oldText') || changed.has('newText')) {
      this.diffOps = computeLineDiff(this.oldText.split('\n'), this.newText.split('\n'));
    }
    if (changed.has('oldText') || changed.has('newText') || changed.has('language') || changed.has('languages')) {
      this.syncHighlight();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.copyTimeoutId);
  }

  private syncHighlight(): void {
    const token = ++this.highlightToken;
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
   *  `text.split('\n').length` entries -- shiki's own trailing-newline handling can otherwise be
   *  off by one relative to a plain `split('\n')`. */
  private tokenizeLines(hl: ShikiHighlighterCore, text: string, lang: string): string[] | null {
    try {
      const html = hl.codeToHtml(text, { lang, themes: SHIKI_THEMES });
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const lines = Array.from(doc.querySelectorAll('code > .line')).map((line) => line.innerHTML);
      const expected = text.split('\n').length;
      while (lines.length > expected) lines.pop();
      while (lines.length < expected) lines.push('');
      return lines;
    } catch {
      // Malformed input for this grammar, or any other shiki-internal failure -- fall back to
      // plain text rather than a blank diff.
      return null;
    }
  }

  private get unifiedText(): string {
    return this.diffOps
      .map((op) => `${op.type === 'add' ? '+' : op.type === 'remove' ? '-' : ' '} ${op.text}`)
      .join('\n');
  }

  private onCopyClick = (): void => {
    const text = this.unifiedText;
    navigator.clipboard?.writeText(text).catch(() => {
      // best-effort -- lr-copy still fires with the intended text regardless
    });
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
    let oldCounter = 0;
    let newCounter = 0;
    return html`<pre>${this.diffOps.map((op) => {
      const marker = op.type === 'add' ? '+' : op.type === 'remove' ? '-' : ' ';
      const lines = op.type === 'add' ? this.highlightedNewLines : this.highlightedOldLines;
      const index = op.type === 'add' ? newCounter : oldCounter;
      const highlighted = lines?.[index];
      if (op.type !== 'add') oldCounter++;
      if (op.type !== 'remove') newCounter++;
      return html`<div part="line" data-type=${op.type}>${marker} ${highlighted !== undefined ? unsafeHTML(highlighted) : op.text}</div>`;
    })}</pre>`;
  }

  private renderSplit(): TemplateResult {
    const rows = pairOpsForSplit(this.diffOps);
    let oldCounter = 0;
    let newCounter = 0;
    const leftCells: TemplateResult[] = [];
    const rightCells: TemplateResult[] = [];
    for (const row of rows) {
      leftCells.push(this.renderSplitCell(row.left, row.left ? oldCounter : -1, this.highlightedOldLines));
      if (row.left) oldCounter++;
      rightCells.push(this.renderSplitCell(row.right, row.right ? newCounter : -1, this.highlightedNewLines));
      if (row.right) newCounter++;
    }
    return html`
      <div class="split-grid">
        <div part="side" data-side="old" aria-label=${this.localize('diffViewOldLabel')}>${leftCells}</div>
        <div part="side" data-side="new" aria-label=${this.localize('diffViewNewLabel')}>${rightCells}</div>
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

  render(): TemplateResult {
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
