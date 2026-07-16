import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { computeLineDiff, type DiffOp } from './diff-line-diff.js';
import { styles } from './diff-view.styles.js';

/** How long the "Copied!" confirmation state lasts before reverting -- matches
 *  `lyra-copy-button`'s own `COPY_CONFIRM_MS`. */
const COPY_CONFIRM_MS = 1500;

export interface LyraDiffViewEventMap {
  'lyra-copy': CustomEvent<{ text: string }>;
}

/**
 * `<lyra-diff-view>` — a real two-string line diff (Myers/LCS-style alignment), rendered as
 * interleaved unified-diff output -- not diff-flavored syntax highlighting over an
 * already-formatted string (`lyra-code-block`'s `language="diff"` only lexically colors a string
 * the consumer already unified-diffed; it has no two-string-compare entry point). First-party
 * invention (no Web Awesome equivalent).
 *
 * @customElement lyra-diff-view
 * @event lyra-copy - Fired on copy-button activation. `detail: { text: string }` (the full
 *   unified-diff text, regardless of whether the clipboard write actually succeeded).
 * @csspart base - The root wrapper.
 * @csspart line - A single line. Carries `data-type="equal"|"add"|"remove"`.
 * @csspart copy-button - The copy affordance, only rendered while `copyable`.
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

  @state() private justCopied = false;

  private copyTimeoutId?: ReturnType<typeof setTimeout>;

  // The O(n*m) LCS table only actually needs recomputing when the two compared texts change --
  // caching it here means a render triggered purely by `justCopied` toggling (the copy-button
  // label swap) reuses the same result instead of re-running the diff from scratch.
  private diffOps: DiffOp[] = [];

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('oldText') || changed.has('newText')) {
      this.diffOps = computeLineDiff(this.oldText.split('\n'), this.newText.split('\n'));
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.copyTimeoutId);
  }

  private get unifiedText(): string {
    return this.diffOps
      .map((op) => `${op.type === 'add' ? '+' : op.type === 'remove' ? '-' : ' '} ${op.text}`)
      .join('\n');
  }

  private onCopyClick = (): void => {
    const text = this.unifiedText;
    navigator.clipboard?.writeText(text).catch(() => {
      // best-effort -- lyra-copy still fires with the intended text regardless
    });
    this.emit<{ text: string }>('lyra-copy', { text });
    this.justCopied = true;
    clearTimeout(this.copyTimeoutId);
    this.copyTimeoutId = setTimeout(() => {
      this.justCopied = false;
    }, COPY_CONFIRM_MS);
  };

  render(): TemplateResult {
    const ops = this.diffOps;
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
        <pre>${ops.map(
          (op) => html`<div part="line" data-type=${op.type}>${op.type === 'add' ? '+' : op.type === 'remove' ? '-' : ' '} ${op.text}</div>`,
        )}</pre>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-diff-view': LyraDiffView;
  }
}
