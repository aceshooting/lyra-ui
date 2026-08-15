import {
  html,
  nothing,
  svg,
  type TemplateResult,
  type SVGTemplateResult,
  type PropertyValues,
} from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraFrame } from '../../../internal/variants.js';
import type {
  LyraSelectionDirection,
  LyraTextWrap,
} from '../../../internal/shared-unions.js';
import {
  FormAssociated,
  isBarredFromValidation,
} from '../../../internal/form-associated.js';
import { SET_ANCHORED_VALIDITY } from '../../../internal/anchored-validity.js';
import { lengthViolations } from '../../../internal/length-constraints.js';
import { finiteCount, finiteInteger } from '../../../internal/numbers.js';
import { styles } from './chat-composer.styles.js';
import {
  autocorrectConverter,
  normalizeAutocorrect,
  trueDefaultBooleanConverter,
} from '../../../internal/converters.js';
import { relayNativeEvent } from '../../../internal/native-event-relay.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_composerLabel, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_sendMessage, LYRA_DEFAULT_stopGenerating, LYRA_DEFAULT_valueInvalid } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** Whether the root draws itself as a bounded card — an alias of the shared {@linkcode LyraFrame},
 *  so there is one definition. Named `frame`, not `appearance`: `appearance` is the library's
 *  vocabulary for how a *control fills itself*, and using it for container chrome as well made one
 *  property name mean two unrelated things. */
export type ChatComposerFrame = LyraFrame;
export type ChatComposerStatus = 'idle' | 'sending' | 'streaming';
/** Retained name for the shared native `<textarea wrap>` vocabulary. */
export type ChatComposerWrap = LyraTextWrap;
/** Retained name for the shared native `selectionDirection` vocabulary. */
export type ChatComposerSelectionDirection = LyraSelectionDirection;

// Mirrors the shared icon set's viewBox/stroke conventions
// (internal/icons.ts's chevronIcon()/closeIcon()/etc.) without adding
// send/stop glyphs to that module -- it's off limits here -- so these
// one-off icons still read as part of the same visual language as the rest
// of the library's inline icons. Same approach lr-checkbox's and
// lr-chat-message's own local glyphs take for the identical reason.
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
  input: InputEvent;
  change: Event;
  'lr-invalid': CustomEvent<null>;
  'lr-input': CustomEvent<{ value: string }>;
  'lr-change': CustomEvent<{ value: string }>;
  'lr-stop': CustomEvent<null>;
  'lr-submit': CustomEvent<{ value: string }>;
  blur: FocusEvent;
  focus: FocusEvent;
}
class LyraChatComposerBase extends LyraElement<LyraChatComposerEventMap> {}

/**
 * `<lr-chat-composer>` — the message input for a chat/agent conversation
 * surface: an auto-resizing textarea plus a send/stop button. Form-
 * associated via the `FormAssociated` mixin (see `<lr-date-input>` for the
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
 * Deliberately no label/hint/error chrome -- a composite chat-input control, not a labeled form
 * field; wrap it in your own layout for that context. A host `aria-label` is forwarded to the
 * internal textarea and takes precedence over the placeholder-derived name.
 *
 * `lr-submit`'s `detail.value` is always the exact, untrimmed current
 * value (`detail.value === value` at the moment it fires) -- trimming is
 * left to the consumer so it never silently diverges from what `value`
 * itself reports. Submitting does not clear `value`; the consumer clears it
 * once the submission has actually been accepted (so e.g. a failed send can
 * leave the text in place for retry).
 * `submitDisabled` lets the consumer apply its own validation policy without
 * disabling the textarea or the busy-state Stop action.
 *
 * @customElement lr-chat-composer
 * @slot start - Content rendered before the textarea (e.g. an attach-file trigger button).
 * @slot chips - An attachment tray rendered above the input row (e.g. files queued for this message).
 * @slot end - Overrides the built-in send/stop button entirely when it has assigned content.
 * @event input - One realm-correct native `InputEvent` relayed from the textarea for each user edit.
 * @event change - One native `Event` relayed from the textarea when its edit is committed.
 * @event lr-input - Fired on every user-driven edit of the textarea (not a programmatic `.value` assignment). `detail: { value }`.
 * @event lr-change - Fired with `detail: { value }` beside the native `change` event.
 * @event lr-submit - Fired by Enter (per `submit-on-enter`) or the built-in button while `status="idle"` and `submitDisabled` is false. `detail: { value }`.
 * @event lr-stop - Fired by the built-in button while `status` is `"sending"` or `"streaming"` and `stoppable` is `true` (the default). No detail.
 * @event blur - One realm-correct native `FocusEvent` relayed from the textarea, preserving `relatedTarget`.
 * @event focus - One realm-correct native `FocusEvent` relayed from the textarea, preserving `relatedTarget`.
 * @event lr-invalid - The composer failed a validity check. Cancelable — preventing this alias
 *   also prevents the native `invalid` event that produced it.
 * @csspart base - The bordered root container. Drops its card chrome (border, background, padding,
 * radius) under `frame="plain"`, where the focus affordance becomes an underline on this same
 * part instead of the border-color shift.
 * @csspart chips - The wrapper around the `chips` slot. Hidden entirely when the slot is empty.
 * @csspart row - The row holding the start slot, textarea, and end slot/button.
 * @csspart start - The wrapper around the `start` slot. Hidden entirely when empty.
 * @csspart textarea - The auto-resizing `<textarea>` itself.
 * @csspart end - The wrapper around the `end` slot and the built-in `action-button`.
 * @csspart send-glyph - Directional send glyph wrapper; mirrored automatically in RTL.
 * @csspart stop-glyph - Symmetric stop glyph wrapper.
 * @csspart action-button - The built-in send/stop button. Absent whenever `end` has assigned content. Style its busy treatment via `:host([status='sending'])`/`:host([status='streaming'])`, or the dedicated `--lr-chat-composer-busy-bg` cssprop below.
 * @cssprop [--lr-chat-composer-busy-bg=var(--lr-color-text-quiet)] - `action-button` background while `status` is `"sending"` or `"streaming"`. Scoped separately from the shared `--lr-color-text-quiet` token, which the `textarea` part's placeholder also reads -- overriding this recolors only the busy button, not the placeholder text too.
 * @status stable
 * @since 4.0.0
 */
export class LyraChatComposer extends FormAssociated(LyraChatComposerBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    composerLabel: LYRA_DEFAULT_composerLabel,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    sendMessage: LYRA_DEFAULT_sendMessage,
    stopGenerating: LYRA_DEFAULT_stopGenerating,
    valueInvalid: LYRA_DEFAULT_valueInvalid,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  @property() placeholder = '';
  @property({ type: Number, attribute: 'min-rows' }) minRows = 1;
  @property({ type: Number, attribute: 'max-rows' }) maxRows = 8;
  @property({ reflect: true }) status: ChatComposerStatus = 'idle';
  /** Visual chrome, on the library-wide `frame` vocabulary. `'card'` (the default) keeps the
   *  bordered, filled, padded box. `'plain'` removes the border, background, padding and corner
   *  radius, so a composer docked inside a chat panel, dialog footer or toolbar that already draws
   *  its own border doesn't double the frame. Focus stays visible either way: `plain` swaps the
   *  border-color shift for an underline across the input row, since there is no border left to
   *  recolor. */
  @property({ reflect: true }) frame: ChatComposerFrame = 'card';

  @property({
    type: Boolean,
    reflect: true,
    attribute: 'submit-on-enter',
    converter: trueDefaultBooleanConverter,
  })
  submitOnEnter = true;
  /** Consumer-controlled validation gate for submission. While idle, disables the built-in Send
   * button and suppresses Enter/click submission without disabling the textarea. Busy Stop behavior
   * remains governed by `status` and `stoppable`. */
  @property({ type: Boolean, reflect: true, attribute: 'submit-disabled' })
  submitDisabled = false;

  @property({
    type: Boolean,
    reflect: true,
    converter: trueDefaultBooleanConverter,
  })
  stoppable = true;
  /** Native read-only state. The textarea remains focusable/submittable but cannot be user-edited,
   * and intrinsic constraints are barred just like a native read-only textarea. */
  @property({ type: Boolean, reflect: true, attribute: 'readonly' }) readOnly =
    false;
  /** Native minimum text length. Unset or invalid values impose no lower bound. */
  // numeric-guard-exempt: every consumer routes through effectiveLengthLimit(), which rejects
  // non-finite/negative values and finiteCount-normalizes the integer before validation or DOM use.
  @property({ type: Number, attribute: 'minlength' }) minLength?: number;
  /** Native maximum text length. Unset or invalid values impose no upper bound. */
  // numeric-guard-exempt: same effectiveLengthLimit() finite normalization as minLength above.
  @property({ type: Number, attribute: 'maxlength' }) maxLength?: number;
  /** Accessible name for the internal textarea. Takes precedence over the placeholder-derived name. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  @property({ converter: trueDefaultBooleanConverter }) override spellcheck =
    true;
  /** Forwarded to the internal `<textarea>`'s own `autocapitalize`. Empty string omits the
   *  attribute (browser default). */
  @property() override autocapitalize = '';
  private autocorrectValue = true;
  /** Native autocorrect state. Reads are boolean; writes accept boolean or the legacy
   * `'off'`/`'false'` string vocabulary and reflect canonical `on`/`off`. */
  @property({ converter: autocorrectConverter })
  override get autocorrect(): boolean {
    return this.autocorrectValue;
  }
  override set autocorrect(next: boolean | string) {
    this.autocorrectValue = normalizeAutocorrect(next);
    this.requestUpdate();
  }
  /** Native editing-assistance attributes forwarded to the internal textarea. */
  @property() wrap: ChatComposerWrap = 'soft';
  @property() autocomplete = '';
  @property({ attribute: 'inputmode' }) override inputMode = '';
  @property({ attribute: 'enterkeyhint' }) override enterKeyHint = '';

  @state() private hasStartSlot = false;
  @state() private hasChipsSlot = false;
  @state() private hasEndSlot = false;
  @state() private touched = false;

  @query('textarea') private textareaEl?: HTMLTextAreaElement;
  private textareaResizeObserver?: ResizeObserver;
  private textareaResizeObserverDocument?: Document;
  private textareaResizeObserverTarget?: HTMLTextAreaElement;
  private textareaResizeRaf?: number;
  private textareaResizeRafOwner?: Window;
  private textareaResizeRafDocument?: Document;
  private textareaResizeGeneration = 0;

  // Purely presentational sizing (never form-submitted, unlike `value`/`disabled`/`required`
  // above), so a read-time getter -- mirroring `<lr-audio-visualizer>`'s `effectiveBarCount` --
  // is enough; no write-time accessor is needed to keep some other reactive state in sync.
  private get effectiveMinRows(): number {
    return finiteInteger(this.minRows, 1, 1);
  }

  /** Never less than {@link effectiveMinRows} -- an inverted min/max-rows pair (authored
   *  backwards, or a live update that shrinks `max-rows` below the current `min-rows`) still
   *  produces a usable, non-collapsed range instead of clipping the textarea to less than its own
   *  minimum. */
  private get effectiveMaxRows(): number {
    return Math.max(
      this.effectiveMinRows,
      finiteInteger(this.maxRows, this.effectiveMinRows, 1)
    );
  }

  private effectiveLengthLimit(
    declared: number | undefined
  ): number | undefined {
    if (declared === undefined || !Number.isFinite(declared) || declared < 0)
      return undefined;
    return finiteCount(Math.trunc(declared), 0);
  }

  constructor() {
    super();
    this.addEventListener('invalid', () => {
      this.touched = true;
    });
  }

  /** The internal native textarea for integrations that require direct DOM access. */
  get input(): HTMLTextAreaElement | null {
    return this.textareaEl ?? null;
  }

  get selectionStart(): number | null {
    return this.textareaEl?.selectionStart ?? null;
  }

  set selectionStart(value: number | null) {
    if (this.textareaEl) this.textareaEl.selectionStart = value ?? 0;
  }

  get selectionEnd(): number | null {
    return this.textareaEl?.selectionEnd ?? null;
  }

  set selectionEnd(value: number | null) {
    if (this.textareaEl) this.textareaEl.selectionEnd = value ?? 0;
  }

  get selectionDirection(): ChatComposerSelectionDirection | null {
    return this.textareaEl
      ?.selectionDirection as ChatComposerSelectionDirection | null;
  }

  set selectionDirection(value: ChatComposerSelectionDirection | null) {
    if (this.textareaEl) this.textareaEl.selectionDirection = value ?? 'none';
  }

  override focus(options?: FocusOptions): void {
    this.textareaEl?.focus(options);
  }

  override blur(): void {
    this.textareaEl?.blur();
  }

  /** Focuses the primary textarea, matching activation of the wrapped native control. */
  override click(): void {
    if (!this.effectiveDisabled) this.textareaEl?.focus();
  }

  select(): void {
    this.textareaEl?.select();
  }

  setSelectionRange(
    start: number | null,
    end: number | null,
    direction?: ChatComposerSelectionDirection
  ): void {
    this.textareaEl?.setSelectionRange(start, end, direction);
  }

  setRangeText(replacement: string): void;
  setRangeText(
    replacement: string,
    start: number,
    end: number,
    selectMode?: SelectionMode
  ): void;
  setRangeText(
    replacement: string,
    start?: number,
    end?: number,
    selectMode?: SelectionMode
  ): void {
    const textarea = this.textareaEl;
    if (!textarea) return;
    if (start === undefined || end === undefined) {
      textarea.setRangeText(replacement);
    } else {
      textarea.setRangeText(replacement, start, end, selectMode);
    }
    this.value = textarea.value;
    this.resizeTextarea();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    // A server render sees no light-DOM children, so a hydrating composer reproduces the server's
    // slot-less rendering first and adopts the real adornment slots on the next update.
    this.seedFirstRenderState(() => {
      this.syncStartSlot();
      this.hasChipsSlot = this.hasSlotted('chips');
      this.syncEndSlot();
    });
  }

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.resizeTextarea();
    this.armTextareaResizeObserver();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // A reconnect (e.g. a drag-drop reparent, a repeat() re-key, or a tab
    // panel detaching and reattaching its content) leaves
    // textareaResizeObserver undefined from disconnectedCallback()'s own
    // teardown below -- Lit's connectedCallback doesn't schedule a re-render
    // on its own, so without this, the width-triggered auto-resize would stay
    // permanently dead until some unrelated reactive property happened to
    // change. `hasUpdated` guards the very first connect, where
    // firstUpdated() above already arms it once the textarea actually
    // exists. Mirrors `<lr-textarea>`'s identical connectedCallback() guard.
    if (this.hasUpdated) {
      this.armTextareaResizeObserver();
      this.resizeTextarea();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resetTextareaResizeWork();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.resetTextareaResizeWork();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (
      changed.has('value') ||
      changed.has('minRows') ||
      changed.has('maxRows')
    ) {
      this.resizeTextarea();
    }
    if (
      changed.has('minLength') ||
      changed.has('maxLength') ||
      changed.has('readOnly')
    ) {
      this.updateValidity();
    }
  }

  protected updateValidity(): void {
    if (
      isBarredFromValidation(
        { effectiveDisabled: this.effectiveDisabled, readonly: this.readOnly },
        this.internals
      )
    ) {
      this[SET_ANCHORED_VALIDITY]({});
      return;
    }
    if (this.required && this.value === '') {
      this[SET_ANCHORED_VALIDITY](
        { valueMissing: true },
        this.localize('fieldRequired')
      );
      return;
    }
    const textarea = this.textareaEl;
    if (textarea && textarea.value !== this.value) textarea.value = this.value;
    const own = lengthViolations(
      this.value,
      this.effectiveLengthLimit(this.minLength),
      this.effectiveLengthLimit(this.maxLength)
    );
    const tooShort = Boolean(textarea?.validity.tooShort) || own.tooShort;
    const tooLong = Boolean(textarea?.validity.tooLong) || own.tooLong;
    if (!tooShort && !tooLong) {
      this[SET_ANCHORED_VALIDITY]({});
      return;
    }
    this[SET_ANCHORED_VALIDITY](
      { tooShort, tooLong },
      textarea?.validationMessage || this.localize('valueInvalid')
    );
  }

  override formResetCallback(): void {
    super.formResetCallback();
    this.touched = false;
  }

  private hasSlotted(name: string): boolean {
    return Array.from(this.children).some(
      (el) => el.getAttribute('slot') === name
    );
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
    const cs = this.ownerDocument.defaultView?.getComputedStyle(ta) ?? ta.style;
    const lineHeight =
      parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
    const paddingBlock =
      parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const borderBlock =
      parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    const minRows = this.effectiveMinRows;
    const maxRows = this.effectiveMaxRows;
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
    const ownerDocument = this.ownerDocument;
    const ownerWindow = ownerDocument.defaultView;
    if (!ta || !this.isConnected || !ownerWindow?.ResizeObserver) return;
    if (
      this.textareaResizeObserver &&
      this.textareaResizeObserverDocument === ownerDocument &&
      this.textareaResizeObserverTarget === ta
    ) {
      return;
    }
    this.resetTextareaResizeWork();
    const generation = this.textareaResizeGeneration;
    let lastWidth = ta.getBoundingClientRect().width;
    const observer = new ownerWindow.ResizeObserver((entries) => {
      if (
        this.textareaResizeObserver !== observer ||
        this.textareaResizeObserverDocument !== ownerDocument ||
        this.textareaResizeObserverTarget !== ta ||
        this.textareaResizeGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      const box = entries[0]?.contentBoxSize?.[0];
      const width = box
        ? box.inlineSize
        : entries[0]?.contentRect.width ?? lastWidth;
      // A sub-pixel-only difference (common with fractional layout/zoom)
      // isn't worth a recompute.
      if (Math.abs(width - lastWidth) < 0.5) return;
      lastWidth = width;
      if (this.textareaResizeRaf !== undefined) {
        this.textareaResizeRafOwner?.cancelAnimationFrame(
          this.textareaResizeRaf
        );
      }
      const handle = ownerWindow.requestAnimationFrame(() => {
        if (
          this.textareaResizeRaf !== handle ||
          this.textareaResizeRafOwner !== ownerWindow ||
          this.textareaResizeRafDocument !== ownerDocument ||
          this.textareaResizeGeneration !== generation ||
          !this.isConnected ||
          this.ownerDocument !== ownerDocument ||
          this.textareaResizeObserverTarget !== ta
        ) {
          return;
        }
        this.textareaResizeRaf = undefined;
        this.textareaResizeRafOwner = undefined;
        this.textareaResizeRafDocument = undefined;
        this.resizeTextarea();
      });
      this.textareaResizeRaf = handle;
      this.textareaResizeRafOwner = ownerWindow;
      this.textareaResizeRafDocument = ownerDocument;
    });
    this.textareaResizeObserver = observer;
    this.textareaResizeObserverDocument = ownerDocument;
    this.textareaResizeObserverTarget = ta;
    observer.observe(ta);
  }

  private resetTextareaResizeWork(): void {
    this.textareaResizeGeneration += 1;
    this.textareaResizeObserver?.disconnect();
    this.textareaResizeObserver = undefined;
    this.textareaResizeObserverDocument = undefined;
    this.textareaResizeObserverTarget = undefined;
    if (this.textareaResizeRaf !== undefined) {
      this.textareaResizeRafOwner?.cancelAnimationFrame(this.textareaResizeRaf);
    }
    this.textareaResizeRaf = undefined;
    this.textareaResizeRafOwner = undefined;
    this.textareaResizeRafDocument = undefined;
  }

  private onTextareaInput = (event: InputEvent): void => {
    if (this.effectiveDisabled || this.readOnly) {
      event.stopPropagation();
      return;
    }
    this.value = (event.target as HTMLTextAreaElement).value;
    this.resizeTextarea();
    relayNativeEvent(this, event);
    this.emit('lr-input', { value: this.value });
  };

  private onTextareaChange = (event: Event): void => {
    if (this.effectiveDisabled || this.readOnly) {
      event.stopPropagation();
      return;
    }
    this.value = (event.target as HTMLTextAreaElement).value;
    relayNativeEvent(this, event);
    this.emit('lr-change', { value: this.value });
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
    } else if (this.stoppable) {
      this.emit('lr-stop', null);
    }
    // Busy and non-stoppable: the button already renders `disabled` above, so
    // this is unreachable via a real click; guarded here too in case a
    // consumer dispatches a synthetic click directly at the handler.
  };

  private submit(): void {
    if (this.submitDisabled || this.effectiveDisabled || this.status !== 'idle')
      return;
    this.emit('lr-submit', { value: this.value });
  }

  private syncStartSlot = (): void => {
    this.hasStartSlot = this.hasSlotted('start');
  };

  private onChipsSlotChange = (e: Event): void => {
    this.hasChipsSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };

  private syncEndSlot = (): void => {
    this.hasEndSlot = this.hasSlotted('end');
  };

  private onTextareaBlur = (event: FocusEvent): void => {
    // Disabling this control while its internal textarea holds focus force-blurs that textarea as
    // plain platform behavior, not a real user interaction -- that blur can land synchronously
    // nested inside the very property write that disabled the control (before this render has even
    // reached the textarea's own `disabled` attribute), so `effectiveDisabled` already reads true
    // here whenever this is that case. Marking `touched` for it was, depending on timing, capable
    // of reentering that same in-flight update and tripping Lit's dev-mode "scheduled an update
    // after an update completed" warning for a state flip nothing observable needed -- a disabled
    // control is barred from validation regardless.
    if (!this.effectiveDisabled) this.touched = true;
    relayNativeEvent(this, event);
  };

  private onTextareaFocus = (event: FocusEvent): void => {
    if (this.effectiveDisabled) {
      event.stopPropagation();
      return;
    }
    relayNativeEvent(this, event);
  };

  private renderActionButton(): TemplateResult {
    const busy = this.status !== 'idle';
    const showStop = busy && this.stoppable;
    return html`
      <button
        part="action-button"
        type="button"
        aria-label=${showStop
          ? this.localize('stopGenerating')
          : this.localize('sendMessage')}
        ?disabled=${this.effectiveDisabled ||
        (busy ? !this.stoppable : this.submitDisabled)}
        @click=${this.onActionClick}
      >
        <span part=${showStop ? 'stop-glyph' : 'send-glyph'}>
          ${showStop ? stopIcon() : sendIcon()}
        </span>
      </button>
    `;
  }

  override render(): TemplateResult {
    return html`
      <div part="base">
        <div part="chips" ?hidden=${!this.hasChipsSlot}>
          <slot name="chips" @slotchange=${this.onChipsSlotChange}></slot>
        </div>
        <div part="row">
          <span part="start" ?hidden=${!this.hasStartSlot}>
            <slot name="start" @slotchange=${this.syncStartSlot}></slot>
          </span>
          <textarea
            part="textarea"
            aria-label=${this.accessibleLabel ??
            (this.placeholder || this.localize('composerLabel'))}
            aria-required=${this.required ? 'true' : 'false'}
            aria-invalid=${this.touched && !this.internals.validity.valid
              ? 'true'
              : 'false'}
            spellcheck=${this.spellcheck}
            autocapitalize=${this.autocapitalize || nothing}
            autocorrect=${this.hasAttribute('autocorrect') || !this.autocorrect
              ? this.autocorrect
                ? 'on'
                : 'off'
              : nothing}
            wrap=${this.wrap}
            autocomplete=${this.autocomplete || nothing}
            inputmode=${this.inputMode || nothing}
            enterkeyhint=${this.enterKeyHint || nothing}
            minlength=${this.effectiveLengthLimit(this.minLength) ?? nothing}
            maxlength=${this.effectiveLengthLimit(this.maxLength) ?? nothing}
            .value=${this.value}
            placeholder=${this.placeholder}
            rows=${this.effectiveMinRows}
            ?required=${this.required}
            ?disabled=${this.effectiveDisabled}
            ?readonly=${this.readOnly}
            @input=${this.onTextareaInput}
            @change=${this.onTextareaChange}
            @keydown=${this.onTextareaKeyDown}
            @focus=${this.onTextareaFocus}
            @blur=${this.onTextareaBlur}
          ></textarea>
          <span part="end">
            <slot name="end" @slotchange=${this.syncEndSlot}></slot>
            ${this.hasEndSlot ? nothing : this.renderActionButton()}
          </span>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-chat-composer': LyraChatComposer;
  }
}
