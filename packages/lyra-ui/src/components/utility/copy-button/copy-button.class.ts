import { html, svg, type PropertyValues, type TemplateResult, type SVGTemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteDuration } from '../../../internal/numbers.js';
import { styles } from './copy-button.styles.js';

/** How long the confirmation/failure state lasts before reverting -- matches
 *  `lr-code-block`'s own `COPY_CONFIRM_MS`. */
const DEFAULT_FEEDBACK_DURATION = 1500;

const ICON_VIEW_BOX = '0 0 24 24';
const ICON_STROKE_WIDTH = '1.75';

/** A generic two-rectangle "copy" glyph. */
function copyIcon(): SVGTemplateResult {
  return svg`
    <svg
      part="copy-icon"
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

/** Matches `<lr-checkbox>`'s own checkmark glyph exactly, for visual consistency across the
 *  library's "confirmation" affordances. */
function checkIcon(): SVGTemplateResult {
  return svg`
    <svg
      part="success-icon"
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

/** An exclamation mark in a circle: a shape nothing else in this component uses, so the failure
 *  state is legible without relying on its color. */
function errorIcon(): SVGTemplateResult {
  return svg`
    <svg
      part="error-icon"
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
    ><circle cx="12" cy="12" r="9"></circle><path d="M12 7.25v5.5"></path><path d="M12 16.4v.01"></path></svg>
  `;
}

/** Why a clipboard write failed. `unsupported` — no Clipboard API in this context (an insecure
 *  origin, or an older browser); `denied` — the browser refused the write (permission denied, or
 *  the document did not have focus); `failed` — anything else the platform reported. */
export type LyraCopyErrorReason = 'unsupported' | 'denied' | 'failed';

type CopyStatus = 'rest' | 'success' | 'error';

/** Distinguishes "there is no Clipboard API here at all" from a real rejection, so `lr-copy-error`
 *  can report `unsupported` instead of guessing from a `DOMException` name. */
class ClipboardUnsupportedError extends Error {
  constructor() {
    super('The Clipboard API is unavailable in this context.');
    this.name = 'ClipboardUnsupportedError';
  }
}

export interface LyraCopyButtonEventMap {
  'lr-copy': CustomEvent<{ text: string }>;
  'lr-copy-error': CustomEvent<{ text: string; reason: LyraCopyErrorReason; error: unknown }>;
}
/**
 * `<lr-copy-button>` — a standalone icon-only copy-to-clipboard affordance for a plain
 * single/multi-line text value in a layout the consumer controls (e.g. absolutely positioned in
 * the corner of a `wa-textarea` or a read-only output field). Unlike `lr-code-block`'s or
 * `lr-json-viewer`'s own built-in copy buttons, this takes no positioning opinion of its own and
 * has no code/JSON content model to adopt just to reuse the copy affordance.
 *
 * The confirmation state is only entered once the clipboard write actually resolves; a rejected
 * write (denied permission, insecure context, unfocused document) renders a distinct failure
 * glyph, announces itself through the live region, and emits `lr-copy-error`.
 *
 * @customElement lr-copy-button
 * @event lr-copy - Fired on activation. `detail: { text }` is always `value`, and fires for every
 *   activation — including one whose clipboard write then fails — matching
 *   `lr-code-block`'s/`lr-json-viewer`'s own copy buttons. Pair it with `lr-copy-error` to tell
 *   the two outcomes apart.
 * @event lr-copy-error - Clipboard writing failed. `detail: { text, reason, error }`, where
 *   `reason` is `'unsupported' | 'denied' | 'failed'` and `error` is the platform error (a
 *   `DOMException` for a real rejection).
 * @csspart base - The button itself.
 * @csspart base-success - The button while the copied confirmation is showing.
 * @csspart base-error - The button while the failure state is showing.
 * @csspart copy-icon - The resting copy glyph.
 * @csspart success-icon - The confirmation glyph.
 * @csspart error-icon - The failure glyph.
 * @csspart feedback - The visually hidden `role="status"` region announcing the outcome.
 */
export class LyraCopyButton extends LyraElement<LyraCopyButtonEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** The plain text to copy. */
  @property() value = '';

  /** Accessible name forwarded from the host to the internal button. When unset, the localized
   *  Copy/Copied/failure state provides the name. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  /** Prevent activation and remove the internal button from the tab order. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** How long, in milliseconds, the copied confirmation or failure state remains visible. */
  @property({ type: Number, attribute: 'feedback-duration' }) feedbackDuration = DEFAULT_FEEDBACK_DURATION;

  @state() private status: CopyStatus = 'rest';

  @query('[part~="base"]') private buttonEl?: HTMLButtonElement;

  private copyTimeoutId?: ReturnType<typeof setTimeout>;

  /** Bumped by every activation, every `value` change, and every disconnect, so an in-flight
   *  clipboard promise that settles late can tell whether its outcome still describes the text
   *  the button is currently showing. */
  private copyGeneration = 0;

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (this.hasUpdated && changed.has('value')) this.resetFeedback();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resetFeedback();
  }

  private resetFeedback(): void {
    this.copyGeneration += 1;
    clearTimeout(this.copyTimeoutId);
    this.copyTimeoutId = undefined;
    this.status = 'rest';
  }

  override focus(options?: FocusOptions): void {
    this.buttonEl?.focus(options);
  }

  override blur(): void {
    this.buttonEl?.blur();
  }

  /** Activates the native button, matching the host focus/blur forwarding contract. */
  override click(): void {
    this.buttonEl?.click();
  }

  private async writeClipboard(text: string): Promise<void> {
    const clipboard = navigator.clipboard;
    // Absent in insecure contexts and older browsers. Some engines also throw synchronously from
    // writeText() rather than rejecting -- inside this async function both arrive at the same
    // catch below.
    if (typeof clipboard?.writeText !== 'function') throw new ClipboardUnsupportedError();
    await clipboard.writeText(text);
  }

  private failureReason(error: unknown): LyraCopyErrorReason {
    if (error instanceof ClipboardUnsupportedError) return 'unsupported';
    if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
      return 'denied';
    }
    return 'failed';
  }

  private showStatus(status: CopyStatus): void {
    this.status = status;
    clearTimeout(this.copyTimeoutId);
    // A NaN/negative feedbackDuration (a bad attribute, or a stray programmatic assignment) must
    // not reach setTimeout() unsanitized -- self-heals to the constructed default instead.
    const duration = finiteDuration(this.feedbackDuration, DEFAULT_FEEDBACK_DURATION, 0);
    this.copyTimeoutId = setTimeout(() => {
      this.status = 'rest';
    }, duration);
  }

  private async copy(): Promise<void> {
    if (this.disabled) return;
    const text = this.value;
    const generation = ++this.copyGeneration;
    this.emit('lr-copy', { text });
    try {
      await this.writeClipboard(text);
    } catch (error) {
      if (!this.isCurrentCopy(generation)) return;
      this.showStatus('error');
      this.emit('lr-copy-error', { text, reason: this.failureReason(error), error });
      return;
    }
    if (!this.isCurrentCopy(generation)) return;
    this.showStatus('success');
  }

  private isCurrentCopy(generation: number): boolean {
    return this.isConnected && generation === this.copyGeneration;
  }

  private onClick = (): void => {
    void this.copy();
  };

  override render(): TemplateResult {
    // Empty at rest so the live region announces only real outcomes -- including the first one
    // after mount, which no announcement should precede.
    const feedback =
      this.status === 'success'
        ? this.localize('copied')
        : this.status === 'error'
          ? this.localize('copyFailed')
          : '';
    // State encoded in the part name, since `::part(base)[data-state]` is invalid CSS and
    // silently never matches. Consumers style the failure with `::part(base-error)`.
    const part =
      this.status === 'success' ? 'base base-success' : this.status === 'error' ? 'base base-error' : 'base';
    return html`
      <button
        part=${part}
        type="button"
        ?disabled=${this.disabled}
        aria-label=${this.accessibleLabel || feedback || this.localize('copy')}
        @click=${this.onClick}
      >
        ${this.status === 'error' ? errorIcon() : this.status === 'success' ? checkIcon() : copyIcon()}
      </button>
      <span part="feedback" role="status">${feedback}</span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-copy-button': LyraCopyButton;
  }
}
