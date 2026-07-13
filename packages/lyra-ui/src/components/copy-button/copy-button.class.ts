import { html, svg, type TemplateResult, type SVGTemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './copy-button.styles.js';

/** How long the checkmark confirmation state lasts before reverting -- matches
 *  `lyra-code-block`'s own `COPY_CONFIRM_MS`. */
const COPY_CONFIRM_MS = 1500;

const ICON_VIEW_BOX = '0 0 24 24';
const ICON_STROKE_WIDTH = '1.75';

/** A generic two-rectangle "copy" glyph. */
function copyIcon(): SVGTemplateResult {
  return svg`
    <svg
      width="1em"
      height="1em"
      viewBox=${ICON_VIEW_BOX}
      fill="none"
      stroke="currentColor"
      stroke-width=${ICON_STROKE_WIDTH}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    ><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
  `;
}

/** Matches `<lyra-checkbox>`'s own checkmark glyph exactly, for visual consistency across the
 *  library's "confirmation" affordances. */
function checkIcon(): SVGTemplateResult {
  return svg`
    <svg
      width="1em"
      height="1em"
      viewBox=${ICON_VIEW_BOX}
      fill="none"
      stroke="currentColor"
      stroke-width=${ICON_STROKE_WIDTH}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    ><polyline points="5 12.5 10 17.5 19 6.5"></polyline></svg>
  `;
}

export interface LyraCopyButtonEventMap {
  'lyra-copy': CustomEvent<{ text: string }>;
}
/**
 * `<lyra-copy-button>` — a standalone icon-only copy-to-clipboard affordance for a plain
 * single/multi-line text value in a layout the consumer controls (e.g. absolutely positioned in
 * the corner of a `wa-textarea` or a read-only output field). Unlike `lyra-code-block`'s or
 * `lyra-json-viewer`'s own built-in copy buttons, this takes no positioning opinion of its own and
 * has no code/JSON content model to adopt just to reuse the copy affordance.
 *
 * @customElement lyra-copy-button
 * @event lyra-copy - Fired on activation. `detail: { text }` is always `value`, and always fires
 *   regardless of whether the actual OS clipboard write succeeded — same convention as
 *   `lyra-code-block`'s/`lyra-json-viewer`'s own copy buttons.
 * @csspart base - The button itself.
 */
export class LyraCopyButton extends LyraElement<LyraCopyButtonEventMap> {
  static styles = [LyraElement.styles, styles];

  /** The plain text to copy. */
  @property() value = '';

  @state() private justCopied = false;

  private copyTimeoutId?: ReturnType<typeof setTimeout>;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.copyTimeoutId);
  }

  private writeClipboard(text: string): void {
    try {
      // navigator.clipboard is absent in insecure contexts / older browsers, and some engines
      // throw synchronously rather than rejecting -- either way this is best-effort; the click
      // handler below always emits lyra-copy regardless of whether the OS clipboard was actually
      // reached. Same precedent as <lyra-code-block>'s/<lyra-json-viewer>'s own copy buttons.
      void navigator.clipboard?.writeText(text)?.catch(() => {});
    } catch {
      // see above
    }
  }

  private onClick = (): void => {
    this.writeClipboard(this.value);
    this.emit('lyra-copy', { text: this.value });
    this.justCopied = true;
    clearTimeout(this.copyTimeoutId);
    this.copyTimeoutId = setTimeout(() => {
      this.justCopied = false;
    }, COPY_CONFIRM_MS);
  };

  render(): TemplateResult {
    return html`
      <button
        part="base"
        type="button"
        aria-label=${this.justCopied ? this.localize('copied') : this.localize('copy')}
        @click=${this.onClick}
      >
        ${this.justCopied ? checkIcon() : copyIcon()}
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-copy-button': LyraCopyButton;
  }
}
