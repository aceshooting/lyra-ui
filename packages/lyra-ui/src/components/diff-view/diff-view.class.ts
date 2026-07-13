import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { computeLineDiff } from './diff-line-diff.js';
import { styles } from './diff-view.styles.js';

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

  private get unifiedText(): string {
    return computeLineDiff(this.oldText.split('\n'), this.newText.split('\n'))
      .map((op) => `${op.type === 'add' ? '+' : op.type === 'remove' ? '-' : ' '} ${op.text}`)
      .join('\n');
  }

  private onCopyClick = (): void => {
    const text = this.unifiedText;
    navigator.clipboard?.writeText(text).catch(() => {
      // best-effort -- lyra-copy still fires with the intended text regardless
    });
    this.emit<{ text: string }>('lyra-copy', { text });
  };

  render(): TemplateResult {
    const ops = computeLineDiff(this.oldText.split('\n'), this.newText.split('\n'));
    return html`
      <div part="base">
        ${this.copyable
          ? html`<button part="copy-button" type="button" aria-label=${`${this.localize('copy')} diff`} @click=${this.onCopyClick}>
              ${this.localize('copy')}
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
