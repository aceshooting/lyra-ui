import { html, nothing, svg, type PropertyValues, type TemplateResult, type SVGTemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import { finiteDuration } from '../../../internal/numbers.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { attachInternalsSafely } from '../../../internal/form-associated.js';
import {
  writeClipboardText,
  type LyraClipboardWriteFailure,
  type LyraClipboardWriteSuccess,
} from '../../../internal/clipboard.js';
import type { LyraToolbarAction } from '../../conversation/message-actions/toolbar-actions.js';
import { styles } from './copy-button.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_copied, LYRA_DEFAULT_copy, LYRA_DEFAULT_copyFailed, LYRA_DEFAULT_fieldRequired } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

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

export type {
  LyraClipboardWriteFailure,
  LyraClipboardWriteOutcome,
  LyraClipboardWriteSuccess,
  LyraCopyErrorReason,
} from '../../../internal/clipboard.js';

/** When the copy button's tooltip is available. */
export type LyraCopyButtonTooltip = 'full' | 'copy' | 'none';

/** Side on which the copy button's tooltip appears. */
export type LyraCopyButtonTooltipPlacement = 'top' | 'right' | 'bottom' | 'left';

type CopyStatus = 'rest' | 'success' | 'error';

function isElementValue(value: unknown): value is Element {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Partial<Element>;
  return candidate.nodeType === 1 && typeof candidate.getAttribute === 'function';
}

function isHtmlElementValue(value: unknown): value is HTMLElement {
  if (!isElementValue(value)) return false;
  const candidate = value as Partial<HTMLElement>;
  return (
    candidate.namespaceURI === 'http://www.w3.org/1999/xhtml' &&
    typeof candidate.focus === 'function' &&
    typeof candidate.blur === 'function' &&
    typeof candidate.click === 'function'
  );
}

/** A missing/empty source is an activation failure, but not a platform clipboard failure. */
class CopySourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CopySourceError';
  }
}

export interface LyraCopyButtonEventMap {
  'lr-copy': CustomEvent<LyraClipboardWriteSuccess>;
  'lr-error': CustomEvent<undefined>;
  'lr-toolbar-actions-change': Event;
  'lr-copy-error': CustomEvent<LyraClipboardWriteFailure>;
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
 * @event lr-copy - Clipboard writing fulfilled. The frozen shared outcome detail is
 *   `{ ok: true, text }`. Failed writes emit `lr-copy-error` instead.
 * @event lr-error - The source could not be resolved or clipboard writing failed. A bubbling,
 *   composed, non-cancelable `CustomEvent` with no detail, matching the mapped notification.
 * @event lr-copy-error - Source resolution or clipboard writing failed. The frozen detail is
 *   `{ ok: false, text, reason, error }`, where
 *   `reason` is `'unsupported' | 'denied' | 'failed'` and `error` is the platform error (a
 *   `DOMException` for a real rejection) or a component-created source error. Retained as a
 *   richer Lyra compatibility alias for `lr-error`.
 * @event lr-toolbar-actions-change - The logical action exposed to a parent toolbar changed its
 *   disabled state or backing trigger. Bubbling, composed, and non-cancelable.
 * @csspart base - The button itself.
 * @csspart button - Mapped alias for `base` on the same built-in button.
 * @csspart base-success - The button while the copied confirmation is showing.
 * @csspart base-error - The button while the failure state is showing.
 * @csspart copy-icon - The resting copy glyph.
 * @csspart success-icon - The confirmation glyph.
 * @csspart error-icon - The failure glyph.
 * @csspart feedback - The visually hidden, `aria-hidden` mirror of the outcome text. The
 * announcement itself lands in the shared light-DOM polite region (`acquireAnnouncementSink()` in
 * `internal/announcer.ts`), because a live region inside a shadow root is not reliably announced;
 * this part is a styling/inspection surface only. This is unrelated pre-existing Lyra state, not a
 * tooltip alias: `wa-copy-button`'s own `feedback` part names its whole internal `<wa-tooltip>`,
 * which has no single-name equivalent here by design, since that name was already taken by this
 * SR-only span before the parity mapping was made — style the tooltip itself through the four
 * `tooltip__*` parts below instead.
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
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    copied: LYRA_DEFAULT_copied,
    copy: LYRA_DEFAULT_copy,
    copyFailed: LYRA_DEFAULT_copyFailed,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
  };
  // GENERATED DEFAULT-STRING SLICE: END

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
  /** Handle on the shared light-DOM live region outcomes actually announce through -- a region
   *  rendered inside this shadow root is not reliably announced (JAWS with Firefox ignores one
   *  outright), so `[part="feedback"]` is only an `aria-hidden` mirror. */
  private sink?: AnnouncementSink;

  @state() private hasCustomTrigger = false;

  @query('[part~="base"]') private buttonEl?: HTMLButtonElement;

  @query('slot:not([name])') private defaultSlot?: HTMLSlotElement;

  private readonly internals = attachInternalsSafely(this);

  private readonly toolbarAction = this.createToolbarAction();

  constructor() {
    super();
    // `aria-label` is the retained public spelling for naming the internal button. A default
    // group role also makes that host-level attribute valid ARIA when the copy button is nested
    // inside another component's axe-tested subtree; the actual activation role remains on the
    // native button (or on the consumer's custom trigger).
    this.internals.role = 'group';
  }

  private copyTimer?: { owner: Window; handle: number; generation: number };

  /** Bumped by every activation, every source change, and every disconnect, so an in-flight
   *  clipboard promise that settles late can tell whether its outcome still describes the text
   *  the button is currently showing. */
  private copyGeneration = 0;

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (this.hasUpdated && (changed.has('value') || changed.has('from'))) this.resetFeedback();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('disabled') || changed.has('hasCustomTrigger')) {
      this.emit('lr-toolbar-actions-change');
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Axe cannot yet see ElementInternals' default ARIA role in every engine, so expose the same
    // default through markup while still preserving any role the author supplied before connect.
    if (!this.hasAttribute('role')) this.setAttribute('role', 'group');
    // Acquired on connect, not on the first outcome: assistive tech has to have been observing a
    // live region *before* text arrives for the change to be announced at all, and the first copy
    // can land in the same task this element is appended in.
    this.sink ??= acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resetFeedback();
    this.sink?.release();
    this.sink = undefined;
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    // Adoption may occur while already disconnected, so defensively retire old-realm resources
    // even when no additional disconnected callback will run.
    this.resetFeedback();
    this.sink?.release();
    this.sink = undefined;
  }

  private cancelFeedbackTimer(): void {
    const timer = this.copyTimer;
    this.copyTimer = undefined;
    if (timer) timer.owner.clearTimeout(timer.handle);
  }

  private resetFeedback(): void {
    this.copyGeneration += 1;
    this.cancelFeedbackTimer();
    this.setStatus('rest');
  }

  private setStatus(status: CopyStatus): void {
    this.status = status;
    setCustomState(this.internals, 'success', status === 'success');
    setCustomState(this.internals, 'error', status === 'error');
  }

  private customTrigger(): HTMLElement | undefined {
    return this.defaultSlot?.assignedElements({ flatten: true }).find(isHtmlElementValue);
  }

  private activeTrigger(): HTMLElement | undefined {
    return this.hasCustomTrigger ? this.customTrigger() : this.buttonEl;
  }

  private createToolbarAction(): LyraToolbarAction {
    const host = this;
    return {
      id: 'copy',
      get disabled() {
        const trigger = host.activeTrigger();
        return !trigger || host.disabled || (trigger as Partial<HTMLButtonElement>).disabled === true;
      },
      focus(options) {
        host.activeTrigger()?.focus(options);
      },
      setTabIndex(tabIndex) {
        const trigger = host.activeTrigger();
        if (trigger) trigger.tabIndex = tabIndex;
      },
      matchesEventPath(path) {
        const trigger = host.activeTrigger();
        return trigger !== undefined && path.includes(trigger);
      },
    };
  }

  /** The stable logical copy action exposed to an enclosing composite toolbar. */
  getToolbarActions(): readonly LyraToolbarAction[] {
    return [this.toolbarAction];
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

  private sourceById(id: string): Element | null {
    const root = this.getRootNode();
    if (
      (root.nodeType === 9 || root.nodeType === 11) &&
      typeof (root as Partial<Document | ShadowRoot>).getElementById === 'function'
    ) {
      const source = (root as Document | ShadowRoot).getElementById(id);
      if (isElementValue(source)) return source;
    }
    // A shadow-root-local id wins so duplicate ids cannot unexpectedly cross a component
    // boundary. The mapped `from` contract is nevertheless document-scoped when no local
    // candidate exists, matching ordinary author markup and remaining correct after adoption.
    const documentSource = this.ownerDocument.getElementById(id);
    return isElementValue(documentSource) ? documentSource : null;
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

  private showStatus(status: CopyStatus): void {
    const owner = this.ownerDocument.defaultView;
    if (!this.isConnected || !owner) return;
    this.setStatus(status);
    // Announced from the transition, not from a rendered text change: the shared region appends
    // each announcement as its own node, so copying twice in a row is read twice instead of the
    // second one being a silent no-op.
    this.sink?.announce(this.statusLabel(status));
    this.cancelFeedbackTimer();
    // A NaN/negative feedbackDuration (a bad attribute, or a stray programmatic assignment) must
    // not reach setTimeout() unsanitized -- self-heals to the constructed default instead.
    const duration = finiteDuration(this.feedbackDuration, DEFAULT_FEEDBACK_DURATION, 0);
    const generation = this.copyGeneration;
    let handle = 0;
    handle = owner.setTimeout(() => {
      const timer = this.copyTimer;
      if (
        timer?.owner !== owner ||
        timer.handle !== handle ||
        timer.generation !== generation ||
        generation !== this.copyGeneration ||
        !this.isConnected ||
        this.ownerDocument.defaultView !== owner
      )
        return;
      this.copyTimer = undefined;
      this.setStatus('rest');
    }, duration);
    this.copyTimer = { owner, handle, generation };
  }

  private reportFailure(outcome: LyraClipboardWriteFailure): void {
    this.showStatus('error');
    this.emit('lr-error');
    this.emit('lr-copy-error', outcome);
  }

  private async copy(): Promise<void> {
    if (this.disabled) return;
    const generation = ++this.copyGeneration;
    const owner = this.isConnected ? this.ownerDocument.defaultView : null;
    let text = '';
    try {
      text = this.resolveCopyText();
    } catch (error) {
      if (this.isCurrentCopy(generation)) {
        this.reportFailure(Object.freeze({ ok: false, text, reason: 'failed', error }));
      }
      return;
    }
    if (!owner) return;
    const outcome = await writeClipboardText(owner, text);
    if (!this.isCurrentCopy(generation, owner)) return;
    if (!outcome.ok) {
      this.reportFailure(outcome);
      return;
    }
    this.showStatus('success');
    this.emit('lr-copy', outcome);
  }

  private isCurrentCopy(generation: number, owner?: Window): boolean {
    return (
      this.isConnected &&
      generation === this.copyGeneration &&
      (owner === undefined || this.ownerDocument.defaultView === owner)
    );
  }

  private onClick = (): void => {
    void this.copy();
  };

  private onDefaultSlotChange = (event: Event): void => {
    const slot = event.currentTarget as HTMLSlotElement;
    const hasCustomTrigger = slot.assignedElements({ flatten: true }).some(isHtmlElementValue);
    if (hasCustomTrigger !== this.hasCustomTrigger) {
      this.hasCustomTrigger = hasCustomTrigger;
      return;
    }
    // Replacing one custom trigger with another leaves the boolean state unchanged but still
    // requires the parent toolbar to transfer its roving tab stop to the new backing node.
    this.emit('lr-toolbar-actions-change');
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
      return html`<span part="error-icon" aria-hidden="true"><slot name="error-icon">${errorIcon()}</slot></span>`;
    }
    if (this.status === 'success') {
      return html`<span part="success-icon" aria-hidden="true"><slot name="success-icon">${checkIcon()}</slot></span>`;
    }
    return html`<span part="copy-icon" aria-hidden="true"><slot name="copy-icon">${copyIcon()}</slot></span>`;
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
      <span part="feedback" aria-hidden="true">${feedback}</span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-copy-button': LyraCopyButton;
  }
}
