import { html, nothing, svg, type TemplateResult, type SVGTemplateResult, type PropertyValues } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { FormAssociated } from '../../internal/form-associated.js';
import { styles } from './chat-composer.styles.js';

export type ChatComposerStatus = 'idle' | 'sending' | 'streaming';

// Mirrors the shared icon set's viewBox/stroke conventions
// (internal/icons.ts's chevronIcon()/closeIcon()/etc.) without adding
// send/stop glyphs to that module -- it's off limits here -- so these
// one-off icons still read as part of the same visual language as the rest
// of the library's inline icons. Same approach lyra-checkbox's and
// lyra-chat-message's own local glyphs take for the identical reason.
const ICON_VIEW_BOX = '0 0 24 24';
const ICON_STROKE_WIDTH = '1.75';

function sendIcon(): SVGTemplateResult {
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
    ><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
  `;
}

/** A filled square -- the conventional "stop generating" glyph. */
function stopIcon(): SVGTemplateResult {
  return svg`
    <svg
      width="1em"
      height="1em"
      viewBox=${ICON_VIEW_BOX}
      fill="currentColor"
      stroke="none"
      aria-hidden="true"
      focusable="false"
    ><rect x="6" y="6" width="12" height="12" rx="1.5"></rect></svg>
  `;
}

export interface LyraChatComposerEventMap {
  'lyra-input': CustomEvent<{ value: string }>;
  'lyra-stop': CustomEvent<undefined>;
  'lyra-submit': CustomEvent<{ value: string }>;
}
class LyraChatComposerBase extends LyraElement<LyraChatComposerEventMap> {}

/**
 * `<lyra-chat-composer>` — the message input for a chat/agent conversation
 * surface: an auto-resizing textarea plus a send/stop button. Form-
 * associated via the `FormAssociated` mixin (see `<lyra-date-input>` for the
 * same shape), so it participates in native `<form>` submission/validation/
 * reset like any other text control — `name`/`value`/`disabled`/`required`/
 * `checkValidity()`/`reportValidity()` all come from that mixin.
 *
 * Auto-resize reads the textarea's own *computed* line-height/padding/
 * border at runtime (`resizeTextarea()`) rather than assuming a fixed
 * px-per-row constant, so it stays correct under a consumer's own font-size/
 * line-height overrides. It grows between `min-rows` and `max-rows`, then
 * switches to internal scrolling. A `ResizeObserver` on the textarea itself
 * re-runs the same fit whenever its *width* changes (a responsive
 * breakpoint, a sidebar toggling, a window resize, an orientation change)
 * even though `value`/`min-rows`/`max-rows` never did -- a narrower box
 * wraps the same text across more lines, so the previously-fitted height
 * would otherwise go stale and clip content with no scrollbar to reveal it.
 *
 * Enter-to-send (only active while `submit-on-enter` is true, the default):
 * plain Enter submits and is prevented from inserting a newline; Shift+Enter
 * always inserts a newline no matter what; an IME composition step (checked
 * via `isComposing`, with `keyCode === 229` as a defense-in-depth fallback
 * for browsers that report `isComposing` inconsistently on the
 * compositionend-adjacent keydown) is never treated as a submit trigger;
 * and while `status` isn't `"idle"` Enter is left alone to insert a newline
 * too, rather than trying to submit again -- there is nothing meaningful to
 * submit while a previous message is still sending/streaming, and the
 * textarea deliberately stays interactive (see `disabled` below) so a user
 * can keep composing their next message in the meantime.
 *
 * `lyra-submit`'s `detail.value` is always the exact, untrimmed current
 * value (`detail.value === value` at the moment it fires) -- trimming is
 * left to the consumer so it never silently diverges from what `value`
 * itself reports. Submitting does not clear `value`; the consumer clears it
 * once the submission has actually been accepted (so e.g. a failed send can
 * leave the text in place for retry).
 *
 * @customElement lyra-chat-composer
 * @slot leading - Content rendered before the textarea (e.g. an attach-file trigger button).
 * @slot chips - An attachment tray rendered above the input row (e.g. files queued for this message).
 * @slot trailing - Overrides the built-in send/stop button entirely when it has assigned content.
 * @event lyra-input - Fired on every user-driven edit of the textarea (not a programmatic `.value` assignment). `detail: { value }`.
 * @event lyra-submit - Fired by Enter (per `submit-on-enter`) or the built-in button while `status="idle"`. `detail: { value }`.
 * @event lyra-stop - Fired by the built-in button while `status` is `"sending"` or `"streaming"`. No detail.
 * @csspart base - The bordered root container.
 * @csspart chips - The wrapper around the `chips` slot. Hidden entirely when the slot is empty.
 * @csspart row - The row holding the leading slot, textarea, and trailing slot/button.
 * @csspart leading - The wrapper around the `leading` slot. Hidden entirely when the slot is empty.
 * @csspart textarea - The auto-resizing `<textarea>` itself.
 * @csspart trailing - The wrapper around the `trailing` slot and the built-in `action-button`.
 * @csspart action-button - The built-in send/stop button. Absent from the accessibility tree's meaningful content whenever `trailing` has assigned content. Style its busy treatment via `:host([status='sending'])`/`:host([status='streaming'])`.
 */
export class LyraChatComposer extends FormAssociated(LyraChatComposerBase) {
  static styles = [LyraElement.styles, styles];

  @property() placeholder = '';
  @property({ type: Number, attribute: 'min-rows' }) minRows = 1;
  @property({ type: Number, attribute: 'max-rows' }) maxRows = 8;
  @property({ reflect: true }) status: ChatComposerStatus = 'idle';
  @property({ type: Boolean, reflect: true, attribute: 'submit-on-enter' }) submitOnEnter = true;

  @state() private hasLeadingSlot = false;
  @state() private hasChipsSlot = false;
  @state() private hasTrailingSlot = false;
  @state() private touched = false;

  @query('textarea') private textareaEl?: HTMLTextAreaElement;
  private textareaResizeObserver?: ResizeObserver;
  private textareaResizeRaf?: number;

  constructor() {
    super();
    this.addEventListener('invalid', () => {
      this.touched = true;
    });
  }

  protected willUpdate(): void {
    if (!this.hasUpdated) {
      this.hasLeadingSlot = this.hasSlotted('leading');
      this.hasChipsSlot = this.hasSlotted('chips');
      this.hasTrailingSlot = this.hasSlotted('trailing');
    }
  }

  protected firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.resizeTextarea();
    this.armTextareaResizeObserver();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.textareaResizeObserver?.disconnect();
    if (this.textareaResizeRaf !== undefined) cancelAnimationFrame(this.textareaResizeRaf);
    this.textareaResizeRaf = undefined;
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('value') || changed.has('minRows') || changed.has('maxRows')) {
      this.resizeTextarea();
    }
  }

  formResetCallback(): void {
    super.formResetCallback();
    this.touched = false;
  }

  private hasSlotted(name: string): boolean {
    return Array.from(this.children).some((el) => el.getAttribute('slot') === name);
  }

  /**
   * Grows/shrinks the textarea between `min-rows` and `max-rows`, reading
   * the *computed* line-height/padding/border back out of the element at
   * call time instead of assuming a fixed px-per-row figure -- correct
   * whatever font-size/line-height a consumer's own CSS ends up applying.
   * Past `max-rows` the box stops growing and switches to internal
   * scrolling (`overflow-y: auto`).
   */
  private resizeTextarea(): void {
    const ta = this.textareaEl;
    if (!ta) return;
    const cs = getComputedStyle(ta);
    const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
    const paddingBlock = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const borderBlock = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    const minRows = Math.max(1, this.minRows || 1);
    const maxRows = Math.max(minRows, this.maxRows || minRows);
    const minHeight = lineHeight * minRows + paddingBlock + borderBlock;
    const maxHeight = lineHeight * maxRows + paddingBlock + borderBlock;

    // Collapse first so a shrinking edit (e.g. deleting a wrapped line)
    // reports its true scrollHeight rather than the previous, taller,
    // explicitly-set height.
    ta.style.height = 'auto';
    // scrollHeight never includes border, so it's added back in to compare
    // apples-to-apples against min/maxHeight, both of which are border-box
    // figures (this component inherits box-sizing: border-box from
    // LyraElement's tokens.styles.ts).
    const contentHeight = ta.scrollHeight + borderBlock;
    const next = Math.min(Math.max(contentHeight, minHeight), maxHeight);
    ta.style.height = `${next}px`;
    ta.style.overflowY = contentHeight > maxHeight ? 'auto' : 'hidden';
  }

  /**
   * Re-fits the textarea whenever its own box *width* changes, independent
   * of any `value`/`min-rows`/`max-rows` update -- `updated()` above only
   * reacts to those, so a pure layout change (a responsive breakpoint, a
   * sidebar collapsing/expanding, a window resize, an orientation change)
   * would otherwise leave the height pinned at whatever it last was, even
   * though the same text now wraps across a different number of lines.
   * Mirrors split.ts's `collapseResizeObserver`/virtual-list.ts's
   * `containerResizeObserver`/lite-chart.ts's `resizeObserver`.
   *
   * Only reacts to an actual inline-size change rather than calling
   * `resizeTextarea()` unconditionally on every callback: `resizeTextarea()`
   * itself sets `ta.style.height`, a *block*-size change on the very element
   * being observed, which would otherwise re-trigger this same observer
   * every tick. Diffing against the last-seen width (same technique as
   * split.ts keying its collapse state off `contentBoxSize[0].inlineSize`)
   * keeps a same-width, height-only callback from doing anything.
   *
   * The actual recompute is deferred one animation frame rather than run
   * synchronously inside the callback: `ResizeObserver`'s spec re-delivers,
   * within the same notification pass, to any observed element resized by
   * its own callback -- mutating `ta.style.height` synchronously here would
   * do exactly that to the very box just observed, and the browser reports
   * it as "ResizeObserver loop completed with undelivered notifications"
   * (a real, user-visible console error, not just noise). Deferring the
   * mutation to the next frame -- outside that notification pass -- avoids
   * ever resizing the observed element from inside its own callback.
   */
  private armTextareaResizeObserver(): void {
    const ta = this.textareaEl;
    if (!ta || this.textareaResizeObserver) return;
    let lastWidth = ta.getBoundingClientRect().width;
    this.textareaResizeObserver = new ResizeObserver((entries) => {
      const box = entries[0]?.contentBoxSize?.[0];
      const width = box ? box.inlineSize : (entries[0]?.contentRect.width ?? lastWidth);
      // A sub-pixel-only difference (common with fractional layout/zoom)
      // isn't worth a recompute.
      if (Math.abs(width - lastWidth) < 0.5) return;
      lastWidth = width;
      if (this.textareaResizeRaf !== undefined) cancelAnimationFrame(this.textareaResizeRaf);
      this.textareaResizeRaf = requestAnimationFrame(() => {
        this.textareaResizeRaf = undefined;
        this.resizeTextarea();
      });
    });
    this.textareaResizeObserver.observe(ta);
  }

  private onTextareaInput = (e: Event): void => {
    this.value = (e.target as HTMLTextAreaElement).value;
    this.emit('lyra-input', { value: this.value });
  };

  private onTextareaKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'Enter') return;
    // Shift+Enter always inserts a newline, regardless of submit-on-enter --
    // leave the browser's own default action alone.
    if (e.shiftKey) return;
    // submit-on-enter="false": Enter always inserts a newline too.
    if (!this.submitOnEnter) return;
    // An IME composition step (e.g. confirming a Japanese/Chinese/Korean
    // candidate) must never be treated as "the user pressed Enter to send" --
    // keyCode 229 is a defense-in-depth fallback for browsers that report
    // isComposing inconsistently on the compositionend-adjacent keydown.
    if (e.isComposing || e.keyCode === 229) return;
    // Nothing meaningful to (re-)submit while already sending/streaming --
    // fall through to the default newline insertion instead, so the
    // textarea stays a normal place to keep composing the next message.
    if (this.status !== 'idle') return;
    e.preventDefault();
    this.submit();
  };

  private onActionClick = (): void => {
    if (this.effectiveDisabled) return;
    if (this.status === 'idle') {
      this.submit();
    } else {
      this.emit('lyra-stop');
    }
  };

  private submit(): void {
    this.emit('lyra-submit', { value: this.value });
  }

  private onLeadingSlotChange = (e: Event): void => {
    this.hasLeadingSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onChipsSlotChange = (e: Event): void => {
    this.hasChipsSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onTrailingSlotChange = (e: Event): void => {
    this.hasTrailingSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onTextareaBlur = (): void => {
    this.touched = true;
  };

  private renderActionButton(): TemplateResult {
    const busy = this.status !== 'idle';
    return html`
      <button
        part="action-button"
        type="button"
        aria-label=${busy ? 'Stop generating' : 'Send message'}
        ?disabled=${this.effectiveDisabled}
        @click=${this.onActionClick}
      >
        ${busy ? stopIcon() : sendIcon()}
      </button>
    `;
  }

  render(): TemplateResult {
    return html`
      <div part="base">
        <div part="chips" ?hidden=${!this.hasChipsSlot}>
          <slot name="chips" @slotchange=${this.onChipsSlotChange}></slot>
        </div>
        <div part="row">
          <span part="leading" ?hidden=${!this.hasLeadingSlot}>
            <slot name="leading" @slotchange=${this.onLeadingSlotChange}></slot>
          </span>
          <textarea
            part="textarea"
            aria-label=${this.placeholder || 'Message'}
            aria-required=${this.required ? 'true' : 'false'}
            aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'}
            .value=${this.value}
            placeholder=${this.placeholder}
            rows=${Math.max(1, this.minRows || 1)}
            ?required=${this.required}
            ?disabled=${this.effectiveDisabled}
            @input=${this.onTextareaInput}
            @keydown=${this.onTextareaKeyDown}
            @blur=${this.onTextareaBlur}
          ></textarea>
          <span part="trailing">
            <slot name="trailing" @slotchange=${this.onTrailingSlotChange}></slot>
            ${this.hasTrailingSlot ? nothing : this.renderActionButton()}
          </span>
        </div>
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lyra-chat-composer': LyraChatComposer;
  }
}
