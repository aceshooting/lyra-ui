import { html, nothing, svg, type PropertyValues, type TemplateResult, type SVGTemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteDuration } from '../../../internal/numbers.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { attachInternalsSafely } from '../../../internal/form-associated.js';
import { styles } from './copy-button.styles.js';

/** How long the confirmation/failure state lasts before reverting -- matches
 *  `lr-code-block`'s own `COPY_CONFIRM_MS`. */
const DEFAULT_FEEDBACK_DURATION = 1000;

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

/** Matches `<lr-checkbox>`'s own checkmark glyph exactly, for visual consistency across the
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

/** An exclamation mark in a circle: a shape nothing else in this component uses, so the failure
 *  state is legible without relying on its color. */
function errorIcon(): SVGTemplateResult {
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
    ><circle cx="12" cy="12" r="9"></circle><path d="M12 7.25v5.5"></path><path d="M12 16.4v.01"></path></svg>
  `;
}

/** Why a clipboard write failed. `unsupported` — no Clipboard API in this context (an insecure
 *  origin, or an older browser); `denied` — the browser refused the write (permission denied, or
 *  the document did not have focus); `failed` — anything else the platform reported. */
export type LyraCopyErrorReason = 'unsupported' | 'denied' | 'failed';

/** When the copy button's tooltip is available. */
export type LyraCopyButtonTooltip = 'full' | 'copy' | 'none';

/** Side on which the copy button's tooltip appears. */
export type LyraCopyButtonTooltipPlacement = 'top' | 'right' | 'bottom' | 'left';

type CopyStatus = 'rest' | 'success' | 'error';

/** Distinguishes "there is no Clipboard API here at all" from a real rejection, so `lr-copy-error`
 *  can report `unsupported` instead of guessing from a `DOMException` name. */
class ClipboardUnsupportedError extends Error {
  constructor() {
    super('The Clipboard API is unavailable in this context.');
    this.name = 'ClipboardUnsupportedError';
  }
}

/** A missing/empty source is an activation failure, but not a platform clipboard failure. */
class CopySourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CopySourceError';
  }
}

export interface LyraCopyButtonEventMap {
  'lr-copy': CustomEvent<{ text: string }>;
  'lr-error': CustomEvent<undefined>;
  'lr-copy-error': CustomEvent<{ text: string; reason: LyraCopyErrorReason; error: unknown }>;
}
/**
 * `<lr-copy-button>` — a standalone icon-only copy-to-clipboard affordance for a plain
 * single/multi-line text value in a layout the consumer controls (e.g. absolutely positioned in
 * the corner of an `lr-textarea` or a read-only output field). Unlike `lr-code-block`'s or
 * `lr-json-viewer`'s own built-in copy buttons, this takes no positioning opinion of its own and
 * has no code/JSON content model to adopt just to reuse the copy affordance.
 *
 * When `from` is set it takes precedence over `value`: an element id copies `textContent`,
 * `id[attribute]` copies an attribute, and `id.property` copies a property. An empty value, a
 * missing source, or a rejected Clipboard API call enters the error state. Native `dir` and
 * `lang` remain inherited global attributes. Renderer bookkeeping and manifest-inferred form
 * metadata are deliberately not component properties; this control is not form-associated.
 *
 * The confirmation state is only entered once the clipboard write actually resolves; a rejected
 * write (denied permission, insecure context, unfocused document) renders a distinct failure
 * glyph, announces itself through the live region, and emits both `lr-error` and the retained,
 * detailed `lr-copy-error` alias.
 *
 * @customElement lr-copy-button
 * @slot - A custom trigger. When present, it replaces the built-in icon button.
 * @slot copy-icon - Resting copy icon for the built-in button.
 * @slot success-icon - Confirmation icon for the built-in button.
 * @slot error-icon - Failure icon for the built-in button.
 * @event lr-copy - Fired on activation. `detail: { text }` is the resolved copy text, and fires
 *   for every activation — including one whose resolution or clipboard write then fails — matching
 *   `lr-code-block`'s/`lr-json-viewer`'s own copy buttons. Pair it with `lr-copy-error` to tell
 *   the two outcomes apart.
 * @event lr-error - The source could not be resolved or clipboard writing failed. A bubbling,
 *   composed, non-cancelable `CustomEvent` with no detail, matching the mapped notification.
 * @event lr-copy-error - Clipboard writing failed. `detail: { text, reason, error }`, where
 *   `reason` is `'unsupported' | 'denied' | 'failed'` and `error` is the platform error (a
 *   `DOMException` for a real rejection) or a component-created source error. Retained as a
 *   richer Lyra compatibility alias for `lr-error`.
 * @csspart base - The button itself.
 * @csspart button - Mapped alias for `base` on the same built-in button.
 * @csspart base-success - The button while the copied confirmation is showing.
 * @csspart base-error - The button while the failure state is showing.
 * @csspart copy-icon - The resting copy glyph.
 * @csspart success-icon - The confirmation glyph.
 * @csspart error-icon - The failure glyph.
 * @csspart feedback - The visually hidden `role="status"` region announcing the outcome.
 * @csspart tooltip__base - The nested tooltip's base wrapper.
 * @csspart tooltip__base__popup - The nested tooltip's popup wrapper.
 * @csspart tooltip__base__arrow - The nested tooltip's arrow.
 * @csspart tooltip__body - The nested tooltip's content wrapper.
 * @cssprop [--error-color=var(--lr-color-danger)] - Error-state icon color.
 * @cssprop [--success-color=var(--lr-color-success)] - Success-state icon color.
 * @cssstate success - The clipboard write completed.
 * @cssstate error - Source resolution or clipboard writing failed.
 * @status stable
 * @since 4.0.0
 */
export class LyraCopyButton extends LyraElement<LyraCopyButtonEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** The plain text to copy. */
  @property() value = '';

  /** Id-based source expression. Takes precedence over `value`; supports `id`, `id[attr]`, and
   * `id.property`. */
  @property() from = '';

  /** Accessible name and resting tooltip text. Empty uses the localized Copy string. */
  @property({ attribute: 'copy-label' }) copyLabel = '';

  /** Confirmation accessible name and tooltip text. Empty uses the localized Copied string. */
  @property({ attribute: 'success-label' }) successLabel = '';

  /** Failure accessible name and tooltip text. Empty uses the localized failure string. */
  @property({ attribute: 'error-label' }) errorLabel = '';

  /** Tooltip behavior: normal hover/focus plus feedback, feedback only, or disabled. */
  @property({ reflect: true }) tooltip: LyraCopyButtonTooltip = 'full';

  /** Side on which the tooltip appears. */
  @property({ attribute: 'tooltip-placement', reflect: true })
  tooltipPlacement: LyraCopyButtonTooltipPlacement = 'top';

  /** Use fixed positioning for the tooltip so it can escape clipped containers. */
  @property({ type: Boolean, reflect: true }) hoist = false;

  /** Accessible name forwarded from the host to the internal button. When unset, the localized
   *  Copy/Copied/failure state provides the name. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  /** Prevent activation and remove the internal button from the tab order. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** How long, in milliseconds, the copied confirmation or failure state remains visible. */
  @property({ type: Number, attribute: 'feedback-duration' }) feedbackDuration = DEFAULT_FEEDBACK_DURATION;

  @state() private status: CopyStatus = 'rest';

  @state() private hasCustomTrigger = false;

  @query('[part~="base"]') private buttonEl?: HTMLButtonElement;

  @query('slot:not([name])') private defaultSlot?: HTMLSlotElement;

  private readonly internals = attachInternalsSafely(this);

  constructor() {
    super();
    // `aria-label` is the retained public spelling for naming the internal button. A default
    // group role also makes that host-level attribute valid ARIA when the copy button is nested
    // inside another component's axe-tested subtree; the actual activation role remains on the
    // native button (or on the consumer's custom trigger).
    this.internals.role = 'group';
  }

  private copyTimeoutId?: ReturnType<typeof setTimeout>;

  /** Bumped by every activation, every source change, and every disconnect, so an in-flight
   *  clipboard promise that settles late can tell whether its outcome still describes the text
   *  the button is currently showing. */
  private copyGeneration = 0;

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (this.hasUpdated && (changed.has('value') || changed.has('from'))) this.resetFeedback();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Axe cannot yet see ElementInternals' default ARIA role in every engine, so expose the same
    // default through markup while still preserving any role the author supplied before connect.
    if (!this.hasAttribute('role')) this.setAttribute('role', 'group');
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resetFeedback();
  }

  private resetFeedback(): void {
    this.copyGeneration += 1;
    clearTimeout(this.copyTimeoutId);
    this.copyTimeoutId = undefined;
    this.setStatus('rest');
  }

  private setStatus(status: CopyStatus): void {
    this.status = status;
    setCustomState(this.internals, 'success', status === 'success');
    setCustomState(this.internals, 'error', status === 'error');
  }

  private customTrigger(): HTMLElement | undefined {
    return this.defaultSlot?.assignedElements({ flatten: true }).find(
      (element): element is HTMLElement => element instanceof HTMLElement,
    );
  }

  private activeTrigger(): HTMLElement | undefined {
    return this.hasCustomTrigger ? this.customTrigger() : this.buttonEl;
  }

  override focus(options?: FocusOptions): void {
    this.activeTrigger()?.focus(options);
  }

  override blur(): void {
    this.activeTrigger()?.blur();
  }

  /** Activates the native button, matching the host focus/blur forwarding contract. */
  override click(): void {
    this.activeTrigger()?.click();
  }

  private async writeClipboard(text: string): Promise<void> {
    const clipboard = navigator.clipboard;
    // Absent in insecure contexts and older browsers. Some engines also throw synchronously from
    // writeText() rather than rejecting -- inside this async function both arrive at the same
    // catch below.
    if (typeof clipboard?.writeText !== 'function') throw new ClipboardUnsupportedError();
    await clipboard.writeText(text);
  }

  private sourceById(id: string): HTMLElement | null {
    const root = this.getRootNode();
    if (root instanceof Document || root instanceof ShadowRoot) return root.getElementById(id);
    return null;
  }

  private resolveCopyText(): string {
    if (!this.from) {
      if (!this.value) throw new CopySourceError('The copy value is empty.');
      return this.value;
    }

    const expression = this.from.trim();
    const attributeMatch = /^(.*?)\[([^\]]+)\]$/.exec(expression);
    const propertyMatch = attributeMatch ? null : /^(.*?)\.([^.]*)$/.exec(expression);
    const id = (attributeMatch?.[1] ?? propertyMatch?.[1] ?? expression).trim();
    const source = id ? this.sourceById(id) : null;
    if (!source) throw new CopySourceError(`The copy source "${id}" was not found.`);

    let resolved: unknown;
    if (attributeMatch) {
      const attribute = attributeMatch[2]!.trim();
      resolved = attribute ? source.getAttribute(attribute) : null;
    } else if (propertyMatch) {
      const propertyName = propertyMatch[2]!.trim();
      resolved = propertyName ? (source as unknown as Record<string, unknown>)[propertyName] : undefined;
    } else {
      resolved = source.textContent;
    }

    const text = resolved == null ? '' : String(resolved);
    if (!text) throw new CopySourceError(`The copy source "${expression}" resolved to an empty value.`);
    return text;
  }

  private failureReason(error: unknown): LyraCopyErrorReason {
    if (error instanceof ClipboardUnsupportedError) return 'unsupported';
    if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
      return 'denied';
    }
    return 'failed';
  }

  private showStatus(status: CopyStatus): void {
    this.setStatus(status);
    clearTimeout(this.copyTimeoutId);
    // A NaN/negative feedbackDuration (a bad attribute, or a stray programmatic assignment) must
    // not reach setTimeout() unsanitized -- self-heals to the constructed default instead.
    const duration = finiteDuration(this.feedbackDuration, DEFAULT_FEEDBACK_DURATION, 0);
    this.copyTimeoutId = setTimeout(() => {
      this.setStatus('rest');
    }, duration);
  }

  private reportFailure(text: string, error: unknown): void {
    this.showStatus('error');
    this.emit('lr-error');
    this.emit('lr-copy-error', { text, reason: this.failureReason(error), error });
  }

  private async copy(): Promise<void> {
    if (this.disabled) return;
    const generation = ++this.copyGeneration;
    let text = '';
    try {
      text = this.resolveCopyText();
    } catch (error) {
      this.emit('lr-copy', { text });
      if (this.isCurrentCopy(generation)) this.reportFailure(text, error);
      return;
    }
    this.emit('lr-copy', { text });
    try {
      await this.writeClipboard(text);
    } catch (error) {
      if (!this.isCurrentCopy(generation)) return;
      this.reportFailure(text, error);
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

  private onDefaultSlotChange = (event: Event): void => {
    const slot = event.currentTarget as HTMLSlotElement;
    const hasCustomTrigger = slot
      .assignedElements({ flatten: true })
      .some((element) => element instanceof HTMLElement);
    if (hasCustomTrigger !== this.hasCustomTrigger) this.hasCustomTrigger = hasCustomTrigger;
  };

  private onCustomTriggerClick = (): void => {
    if (this.hasCustomTrigger) void this.copy();
  };

  private statusLabel(status: CopyStatus): string {
    if (status === 'success') return this.successLabel || this.localize('copied');
    if (status === 'error') return this.errorLabel || this.localize('copyFailed');
    return this.copyLabel || this.localize('copy');
  }

  private renderIcon(): TemplateResult {
    if (this.status === 'error') {
      return html`<span part="error-icon" aria-hidden="true"
        ><slot name="error-icon">${errorIcon()}</slot></span
      >`;
    }
    if (this.status === 'success') {
      return html`<span part="success-icon" aria-hidden="true"
        ><slot name="success-icon">${checkIcon()}</slot></span
      >`;
    }
    return html`<span part="copy-icon" aria-hidden="true"
      ><slot name="copy-icon">${copyIcon()}</slot></span
    >`;
  }

  override render(): TemplateResult {
    // Empty at rest so the live region announces only real outcomes -- including the first one
    // after mount, which no announcement should precede.
    const statusLabel = this.statusLabel(this.status);
    const feedback = this.status === 'rest' ? '' : statusLabel;
    // State encoded in the part name, since `::part(base)[data-state]` is invalid CSS and
    // silently never matches. Consumers style the failure with `::part(base-error)`.
    const part =
      this.status === 'success'
        ? 'base button base-success'
        : this.status === 'error'
          ? 'base button base-error'
          : 'base button';
    const tooltipDisabled = this.tooltip === 'none';
    const tooltipOpen = !tooltipDisabled && this.status !== 'rest';
    return html`
      <lr-tooltip
        .content=${statusLabel}
        .trigger=${this.tooltip === 'full' ? 'hover focus' : 'manual'}
        .placement=${this.tooltipPlacement}
        .hoist=${this.hoist}
        .disabled=${tooltipDisabled}
        .open=${tooltipOpen}
        exportparts="base:tooltip__base, base__popup:tooltip__base__popup, base__arrow:tooltip__base__arrow, body:tooltip__body"
      >
        ${this.hasCustomTrigger
          ? nothing
          : html`
              <button
                part=${part}
                type="button"
                ?disabled=${this.disabled}
                aria-label=${this.accessibleLabel || statusLabel}
                @click=${this.onClick}
              >
                ${this.renderIcon()}
              </button>
            `}
        <slot @slotchange=${this.onDefaultSlotChange} @click=${this.onCustomTriggerClick}></slot>
      </lr-tooltip>
      <span part="feedback" role="status">${feedback}</span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-copy-button': LyraCopyButton;
  }
}
