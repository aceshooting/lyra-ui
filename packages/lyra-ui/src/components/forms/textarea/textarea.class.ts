import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import {
  acquireAnnouncementSink,
  type AnnouncementSink,
} from '../../../internal/announcer.js';
import { isAccessibilityVisible } from '../../../internal/accessibility-visibility.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  FormAssociated,
  isBarredFromValidation,
} from '../../../internal/form-associated.js';
import { SET_ANCHORED_VALIDITY } from '../../../internal/anchored-validity.js';
import { lengthViolations } from '../../../internal/length-constraints.js';
import { styles } from './textarea.styles.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraAppearance, LyraSize } from '../../../internal/variants.js';
import type {
  LyraSelectionDirection,
  LyraTextWrap,
} from '../../../internal/shared-unions.js';
import {
  autocorrectConverter,
  normalizeAutocorrect,
  spellcheckConverter,
} from '../../../internal/converters.js';
import { sanitizeCssResize } from '../../../internal/safe-css.js';
import { finiteCount, finiteNumber } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { relayNativeEvent } from '../../../internal/native-event-relay.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import {
  currentValidityValidator,
  type LyraFormValidator,
} from '../form-validator.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_textareaCharacterCount, LYRA_DEFAULT_textareaCharactersRemaining, LYRA_DEFAULT_textareaLabel, LYRA_DEFAULT_valueInvalid } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type TextareaResize =
  | 'none'
  | 'vertical'
  | 'horizontal'
  | 'both'
  | 'auto';
export type TextareaWrap = LyraTextWrap;
export type TextareaSelectionDirection = LyraSelectionDirection;
/** Scroll offsets read from, or written to, the internal native `<textarea>`. */
export interface TextareaScrollPosition {
  top: number;
  left: number;
}

/**
 * How long the character count waits after the last keystroke before republishing itself to the
 * polite live region. Announcing on every keystroke would talk over the character the user just
 * typed; a pause long enough to read as "the user stopped" is the standard compromise.
 */
const COUNT_ANNOUNCE_DELAY_MS = 1000;

/** Enumerated (not boolean-presence) attribute parsing for `spellcheck`, matching the native HTML
 *  `spellcheck` attribute's own true/false/empty/inherit semantics -- Lit's built-in `type:
 *  Boolean` converts based on attribute *presence*, which would treat a literal
 *  `spellcheck="false"` as truthy (the attribute is present) instead of `false`. */

export interface LyraTextareaEventMap {
  input: InputEvent;
  change: Event;
  'lr-input': CustomEvent<{ value: string }>;
  'lr-change': CustomEvent<{ value: string }>;
  blur: FocusEvent;
  focus: FocusEvent;
  'lr-invalid': CustomEvent<null>;
}
class LyraTextareaBase extends LyraElement<LyraTextareaEventMap> {}

/**
 * `<lr-textarea>` — a multiline plain-text input primitive, form-associated via the
 * `FormAssociated` mixin (see `<lr-chat-composer>`/`<lr-date-input>` for the same shape), so it
 * participates in native `<form>` submission/validation/reset like any other text control --
 * `name`/`value`/`disabled`/`required`/`checkValidity()`/`reportValidity()` all come from that mixin.
 *
 * Ships an opt-in `label`/`hint`/`errorText` form-control chrome (props + matching named slots +
 * `form-control-label`/`hint`/`error` parts), mirroring `<lr-select>`'s exact pattern -- left
 * unset, the chrome remains hidden. A consumer preferring their own form-field layout can still
 * ignore these and wrap the element. A host `aria-label` is forwarded to the internal textbox;
 * external `aria-labelledby`/`aria-describedby` idrefs are not copied across the shadow boundary.
 *
 * `minlength`/`maxlength` are forwarded to the internal native `<textarea>` and bridged into this
 * element's own `ElementInternals` as `tooShort`/`tooLong` by `updateValidity()`.
 * `readonly` keeps the value focusable, selectable, copyable, and form-submittable while barring
 * user edits and constraint validation, matching the native textarea contract.
 *
 * Removing `label`, `hint`, `help-text` or `error-text` safely omits that content while preserving
 * native null property readback. Explicit empty strings stay empty; later text renders normally.
 *
 * @customElement lr-textarea
 * @event input - Native-style composed event fired on every user-driven edit.
 * @event change - Native-style composed event fired at the native `change` timing.
 * @event lr-input - Compatibility alias for `input`; `detail: { value }`.
 * @event lr-change - Compatibility alias for `change`; `detail: { value }`.
 * @event lr-invalid - The textarea failed a validity check. Cancelable: `preventDefault()` forwards
 *   to the native `invalid` event, suppressing the browser's own validation bubble and the
 *   focus/scroll `reportValidity()` would otherwise perform.
 * @event blur - Re-dispatched from the internal native `<textarea>`'s own `blur` -- bubbling and
 *   composed (unlike the native event, which is neither), so a listener above the shadow boundary
 *   can observe it.
 * @event focus - Re-dispatched from the internal native `<textarea>`'s own `focus`, for the same
 *   reason as `blur`.
 * @slot label - Custom label content.
 * @slot hint - Custom hint content.
 * @slot help-text - Shoelace alias for `hint`.
 * @slot error - Custom error content.
 * @csspart form-control - The outer wrapper around label, textarea, error and hint.
 * @csspart form-control-label - The `<label>` element.
 * @csspart label - Wrapper around the visible label content.
 * @csspart base - Compatibility name for the control wrapper; use `textarea-wrapper`.
 * @csspart form-control-input - Compatibility name for the control wrapper.
 * @csspart textarea-adjuster - Compatibility name for the native-resize wrapper.
 * @csspart textarea-wrapper - The wrapper around the native `<textarea>`. It is the same node as
 *   `base`.
 * @csspart textarea - The native `<textarea>` element.
 * @csspart footer - The row below the field carrying the character count. Hidden without `with-count`.
 * @csspart count - The character count, rendered only with `with-count`.
 * @csspart hint - The hint message.
 * @csspart form-control-help-text - Shoelace compatibility name for the hint message.
 * @csspart error - The error message.
 * @cssprop [--lr-textarea-max-block-size=none] - Maximum auto-grown block size before the textarea scrolls.
 * @cssprop [--lr-textarea-padding=var(--lr-form-control-padding-inline)] - Padding of the native
 * textarea on all four sides, from the active `size` tier of the shared form-control ladder
 * (`internal/sizes.styles.ts`). The ladder's *inline* gutter is used on every side deliberately:
 * its block padding is `0` at the two tightest tiers because a control row's height floor supplies
 * the space there, and a textarea has no such floor -- the first line of text would sit on the
 * border.
 * @cssprop [--lr-textarea-font-size=var(--lr-form-control-font-size)] - Font size of the native
 * textarea, from the active `size` tier of the shared ladder.
 * @cssprop [--lr-textarea-radius=var(--lr-form-control-radius)] - Corner radius of the field, from
 * the active `size` tier of the shared ladder (the two tightest tiers take a smaller radius).
 * `pill` changes the private default to `--lr-radius-pill`; a public value still wins.
 * @cssprop [--lr-textarea-fill=transparent] - Background of the field. Its private default follows
 * `appearance`; the documented default is `appearance="outlined"`'s value.
 * @cssprop [--lr-textarea-border-color=var(--lr-color-border)] - Border color of the field. Its
 * private default follows `appearance` in the same way as `--lr-textarea-fill`.
 * @cssprop [--lr-textarea-hover-border-color=var(--lr-color-brand)] - Field border color while the
 * native textarea is hovered.
 * @cssprop [--lr-form-control-required-content=' *'] - The required-field marker rendered after the
 * label. Set it to `''` to suppress the marker, or to any other quoted string (`' (required)'`, a
 * localized word) to replace it. Caller-supplied content, so it is never localized here.
 * @cssprop [--lr-form-control-required-color=var(--lr-color-danger)] - Color of that marker,
 * retunable without touching any other danger-coloured surface.
 * @cssprop [--lr-form-control-required-offset=0] - Inline space between the label text and the
 * marker.
 * @cssstate blank - The live value is empty.
 * @status stable
 * @since 4.0.0
 */
export class LyraTextarea extends FormAssociated(LyraTextareaBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    textareaCharacterCount: LYRA_DEFAULT_textareaCharacterCount,
    textareaCharactersRemaining: LYRA_DEFAULT_textareaCharactersRemaining,
    textareaLabel: LYRA_DEFAULT_textareaLabel,
    valueInvalid: LYRA_DEFAULT_valueInvalid,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  /** Public WA-compatible intrinsic validator catalog. */
  static get validators(): LyraFormValidator<LyraTextarea>[] {
    return [
      currentValidityValidator(
        'required',
        'disabled',
        'readonly',
        'value',
        'minlength',
        'maxlength'
      ),
    ];
  }
  // `sizes` is the library's one form-control ladder, pulled in ahead of this component's own sheet
  // so the padding/font-size/radius knobs point at the active tier's value -- and so both spellings
  // of every tier (`s` and `small`, ...) work with no per-component rule.
  static override styles = [LyraElement.styles, sizes, styles];

  /** Visible text rows. */
  // numeric-guard-exempt: forwarded only to the native <textarea rows> attribute (see the
  // template below) -- the browser's own "rules for parsing non-negative integers" fall back to
  // its default for an invalid value instead of throwing, and this file performs no arithmetic on
  // `rows` itself (fitToContent() measures the live DOM scrollHeight, not this property).
  @property({ type: Number }) rows = 4;
  /** Native CSS `resize` behavior for the textarea (`'none'`, `'vertical'`, `'horizontal'`,
   *  `'both'`), plus `'auto'`: a `ResizeObserver`-driven grow-to-content mode with no manual drag
   *  handle (mirrors `wa-textarea`'s `resize="auto"`). An invalid runtime value falls back to
   *  `'vertical'`. */
  @property({ reflect: true }) resize: TextareaResize = 'vertical';
  /** Visual size on the library's one control ladder, shared with `<lr-input>`/`<lr-select>`.
   *  Accepts both the canonical `'2xs'`–`'xl'` steps and Web Awesome's/Shoelace's
   *  `'small'`/`'medium'`/`'large'` spellings of `s`/`m`/`l`; the two render identically. Governs
   *  the field's padding and font size — a textarea's own height comes from `rows`/`resize`, not
   *  from the ladder's control-height floor. */
  @property({ reflect: true }) size: LyraSize = 'm';
  /** Visual treatment of the field, from the library's shared vocabulary and with the same
   *  meanings as `<lr-input>`'s `appearance`. Each value only swaps
   *  `--lr-textarea-fill`/`--lr-textarea-border-color`. */
  @property({ reflect: true }) appearance: LyraAppearance = 'outlined';
  /** Shoelace boolean alias for the filled treatment. */
  @property({ type: Boolean, reflect: true }) filled = false;
  /** Fully rounded field corners, matching `<lr-input>`'s/`<lr-select>`'s own `pill` — Shoelace and
   *  Web Awesome both ship it on their textarea, so a mechanical tag rename must not drop it.
   *  Changes the private radius default to `--lr-radius-pill` rather than declaring a radius on
   *  `[part="textarea"]`, so an inherited or direct `--lr-textarea-radius` remains authoritative.
   *  Most useful on a one-or-two-row field; a tall multi-line surface with fully rounded ends wastes
   *  its first and last line's inline space, so this is opt-in rather than tied to `size`. */
  @property({ type: Boolean, reflect: true }) pill = false;
  /** Renders a character count below the field. With `maxlength` set it counts down the remaining
   *  characters instead of up from zero. The visible count and internal shadow mirror are
   *  `aria-hidden`; after user input pauses, the localized count is appended once to Lyra's shared
   *  light-DOM polite announcement sink so it is not spoken over every keystroke. The sink stays
   *  silent while this host or a composed ancestor is excluded from the accessibility tree. */
  @property({ attribute: 'with-count', type: Boolean, reflect: true })
  withCount = false;
  @property() placeholder = '';
  /** Forwards native read-only behavior to the internal textarea. The value remains focusable,
   *  selectable, copyable, and form-submittable; constraint validation is suspended until the
   *  property is unset. */
  @property({ type: Boolean, reflect: true }) readonly = false;
  @property() label = '';
  @property() hint = '';
  /** Shoelace alias for {@link hint}. `hint` wins when both are set. */
  @property({ attribute: 'help-text' }) helpText = '';
  /** SSR slot-presence hints for declarative shadow DOM and hydration. */
  @property({ type: Boolean, attribute: 'with-label' }) withLabel = false;
  @property({ type: Boolean, attribute: 'with-hint' }) withHint = false;
  @property({ attribute: 'error-text' }) errorText = '';
  /** Accessible name overriding the label/placeholder-derived default. Any non-`null` value takes
   *  precedence by presence—including `''`—matching `<lr-date-input>`'s `accessibleLabel`. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
  /** Forwarded to the native `<textarea>`'s own `spellcheck`. Defaults to `true`, matching the
   *  native element's own default. */
  @property({ converter: spellcheckConverter }) override spellcheck = true;
  /** Forwarded to the internal native textarea. */
  @property({ type: Boolean }) override autofocus = false;
  /** Forwarded to the internal native textarea. */
  @property() override title = '';
  /** Forwarded to the native `<textarea>`'s own `autocapitalize`. Empty string omits the
   *  attribute (browser default). */
  @property() override autocapitalize = '';
  private autocorrectValue = true;
  /** Forwarded to the native `<textarea>`'s own `wrap`. */
  @property() wrap: TextareaWrap = 'soft';
  /** Native editing-assistance attributes forwarded to the wrapped textarea. Empty strings omit
   *  the corresponding attribute and retain the browser default. */
  @property() autocomplete = '';
  @property({ attribute: 'inputmode' }) override inputMode = '';
  @property({ attribute: 'enterkeyhint' }) override enterKeyHint = '';
  /** Native editing-assistance state forwarded as canonical `autocorrect="on"|"off"`. Reads are
   * boolean. Writes accept Web Awesome's boolean IDL and Shoelace's string vocabulary:
   * `'off'`/`'false'` normalize to false and every other string normalizes to true. */
  @property({ converter: autocorrectConverter })
  override get autocorrect(): boolean {
    return this.autocorrectValue;
  }
  override set autocorrect(next: boolean | string) {
    this.autocorrectValue = normalizeAutocorrect(next);
    // Attribute presence controls whether the native hint is omitted, so removing an `on`
    // attribute must render even though the normalized boolean remains `true`.
    this.requestUpdate();
  }
  /** Lowercase mapped IDLs that delegate to the existing reactive native spellings. */
  get inputmode(): string {
    return this.inputMode;
  }
  set inputmode(next: string) {
    this.inputMode = next ?? '';
  }
  get enterkeyhint(): string {
    return this.enterKeyHint;
  }
  set enterkeyhint(next: string) {
    this.enterKeyHint = next ?? '';
  }
  /** Internal reactive adapter for Shoelace's public `default-value` attribute alias. The
   * supported JS property remains `defaultValue`; this accessor is not public API.
   * @internal
   * @default '' */
  @property({ attribute: 'default-value' })
  get defaultValueAlias(): string {
    return this.defaultValue;
  }
  set defaultValueAlias(next: string) {
    this.defaultValue = next ?? '';
  }
  /** Minimum text length, forwarded to the native `<textarea>`'s own `minlength` and reported as
   *  `tooShort` by `updateValidity()`. Defaults to `undefined` (no lower bound). Like native
   *  `minlength`, an empty value never violates it — pair it with `required` to also reject
   *  empty. */
  // numeric-guard-exempt: forwarded to the native <textarea minlength> attribute, which applies
  // the platform's "rules for parsing non-negative integers" (an unparseable value is ignored,
  // not thrown on); the same rule gates lengthViolations() before it is used in any comparison.
  @property({ type: Number }) minlength?: number;
  /** Upper counterpart of `minlength` (native `maxlength`/`tooLong`), with the same parsing and
   *  the same default of `undefined`. Note that native `maxlength` also *prevents* typing beyond
   *  the limit; it reports `tooLong` for values that arrive some other way (paste of a longer
   *  value, a programmatic assignment). */
  // numeric-guard-exempt: same rationale as `minlength` above, for the native <textarea maxlength>
  // attribute and ValidityState.tooLong. The one place this file *does* compute with it -- the
  // remaining-characters readout behind `with-count` -- routes through countMaxlength(), which
  // drops a non-finite value entirely rather than arithmetic-ing on it.
  @property({ type: Number }) maxlength?: number;

  @state() private touched = false;
  /** Empty until the user pauses typing, so the live region says nothing on first render. */
  @state() private announcedCountText = '';
  private readonly slotPresence = new SlotPresenceController(this);

  @query('textarea') private textareaEl?: HTMLTextAreaElement;
  private resizeObserver?: ResizeObserver;
  private lastObservedWidth?: number;
  private resizeRaf?: number;
  private resizeRafOwner?: Window;
  private countAnnounceTimer?: number;
  private countAnnounceTimerOwner?: Window;
  private countAnnouncementSink?: AnnouncementSink;

  constructor() {
    super();
    this.addEventListener('invalid', () => {
      this.touched = true;
    });
  }

  /** The internal native `<textarea>` element, for direct DOM access (caret position, selection,
   *  `setRangeText()`) that has no first-class `lr-*` equivalent -- mirrors `wa-textarea`'s own
   *  `input` getter. */
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

  get selectionDirection(): TextareaSelectionDirection | null {
    return this.textareaEl
      ?.selectionDirection as TextareaSelectionDirection | null;
  }

  set selectionDirection(value: TextareaSelectionDirection | null) {
    if (this.textareaEl) this.textareaEl.selectionDirection = value ?? 'none';
  }

  /** Reads both component state and the UA's synchronous fieldset cascade before public actions. */
  private get liveDisabled(): boolean {
    return this.effectiveDisabled || this.matches(':disabled');
  }

  override click(): void {
    if (!this.liveDisabled) this.textareaEl?.click();
  }

  override focus(options?: FocusOptions): void {
    if (!this.liveDisabled) this.textareaEl?.focus(options);
  }

  override blur(): void {
    this.textareaEl?.blur();
  }

  select(): void {
    this.textareaEl?.select();
  }

  setSelectionRange(
    selectionStart: number,
    selectionEnd: number,
    selectionDirection: 'forward' | 'backward' | 'none' = 'none',
  ): void {
    this.textareaEl?.setSelectionRange(
      selectionStart,
      selectionEnd,
      selectionDirection,
    );
  }

  /**
   * Reads or writes the internal textarea's scroll offsets — the one piece of scroll state a
   * consumer restoring a draft, or pinning a long value to its end, cannot reach through any other
   * public member.
   *
   * Called with no argument it returns the current `{ top, left }`; called with a partial position
   * it writes only the axes present and returns `undefined`. Returns `undefined` either way before
   * the internal textarea has rendered.
   */
  scrollPosition(position?: { top?: number; left?: number }): { top: number; left: number } | undefined {
    const ta = this.textareaEl;
    if (!ta) return undefined;
    if (position) {
      if (position.top !== undefined)
        ta.scrollTop = finiteNumber(position.top, ta.scrollTop);
      if (position.left !== undefined)
        ta.scrollLeft = finiteNumber(position.left, ta.scrollLeft);
      return undefined;
    }
    return { top: ta.scrollTop, left: ta.scrollLeft };
  }

  /** Passthrough to the native `<textarea>`'s `setRangeText()`. Mirrors `wa-textarea`'s own method
   *  of the same name/signature. No-op if the element hasn't rendered yet. */
  setRangeText(
    replacement: string,
    start?: number,
    end?: number,
    selectMode: 'select' | 'start' | 'end' | 'preserve' = 'preserve',
  ): void {
    const ta = this.textareaEl;
    if (!ta) return;
    if (start === undefined || end === undefined) {
      ta.setRangeText(replacement);
    } else {
      ta.setRangeText(replacement, start, end, selectMode);
    }
    this.value = ta.value;
    this.fitToContent();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // The debounce ensures text arrives later, but the live region itself still has to be mounted
    // before that first message and in the textarea's current owner document.
    this.countAnnouncementSink ??= acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
    // A reconnect (e.g. a drag-drop reparent, a repeat() re-key, or a tab panel detaching and
    // reattaching its content) leaves resizeObserver undefined from disconnectedCallback's own
    // teardown below -- Lit's connectedCallback doesn't schedule a re-render on its own, so
    // without this, auto-grow would only come back once some unrelated reactive property
    // happened to change, and a pure container-width resize landing before that would be missed.
    if (this.resize === 'auto' && this.hasUpdated) {
      this.armResizeObserver();
      this.fitToContent();
    }
  }

  override disconnectedCallback(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    if (this.resizeRaf !== undefined)
      this.resizeRafOwner?.cancelAnimationFrame(this.resizeRaf);
    this.resizeRaf = undefined;
    this.resizeRafOwner = undefined;
    if (this.countAnnounceTimer !== undefined) {
      this.countAnnounceTimerOwner?.clearTimeout(this.countAnnounceTimer);
    }
    this.countAnnounceTimer = undefined;
    this.countAnnounceTimerOwner = undefined;
    this.countAnnouncementSink?.release();
    this.countAnnouncementSink = undefined;
    super.disconnectedCallback();
  }

  /**
   * `maxlength` as a usable non-negative integer, or `undefined` when it was never set or arrived
   * unparseable — an attribute goes through `Number()`, so `maxlength="oops"` reaches this
   * property as `NaN`, and subtracting from that would render a literal `NaN` in the count.
   */
  private effectiveLengthLimit(
    declared: number | undefined
  ): number | undefined {
    if (declared === undefined || !Number.isFinite(declared) || declared < 0)
      return undefined;
    return finiteCount(Math.trunc(declared), 0);
  }

  private countMaxlength(): number | undefined {
    return this.effectiveLengthLimit(this.maxlength);
  }

  /**
   * The character count's text. Lengths count UTF-16 code units (`String.length`) rather than
   * grapheme clusters, deliberately: that is exactly what the native `maxlength` the count is
   * reporting against enforces, and a count that disagreed with the limit it describes would be
   * worse than one that disagrees with an emoji.
   *
   * The remaining count floors at zero. Only a script-assigned value can exceed `maxlength` (the
   * native control blocks typing past it), and "-3 characters remaining" is a worse signal for
   * that state than the `tooLong` validity flag already raised for it.
   */
  private countText(): string {
    const format = getNumberFormat(this.effectiveLocale);
    const max = this.countMaxlength();
    if (max !== undefined) {
      const remaining = Math.max(0, max - this.value.length);
      return this.localize('textareaCharactersRemaining', undefined, {
        count: format.format(remaining),
        pluralCount: remaining,
      });
    }
    const length = this.value.length;
    return this.localize('textareaCharacterCount', undefined, {
      count: format.format(length),
      pluralCount: length,
    });
  }

  private scheduleCountAnnouncement(): void {
    if (this.countAnnounceTimer !== undefined) {
      this.countAnnounceTimerOwner?.clearTimeout(this.countAnnounceTimer);
    }
    this.countAnnounceTimer = undefined;
    this.countAnnounceTimerOwner = undefined;
    if (!this.withCount) return;
    const view = this.ownerDocument.defaultView;
    if (!view) return;
    this.countAnnounceTimerOwner = view;
    this.countAnnounceTimer = view.setTimeout(() => {
      this.countAnnounceTimer = undefined;
      this.countAnnounceTimerOwner = undefined;
      if (
        !this.isConnected ||
        this.ownerDocument.defaultView !== view ||
        !this.withCount
      )
        return;
      if (!isAccessibilityVisible(this)) return;
      const text = this.countText();
      this.announcedCountText = text;
      this.countAnnouncementSink?.announce(text);
    }, COUNT_ANNOUNCE_DELAY_MS);
  }

  /**
   * Bridges the internal native `<textarea>`'s own browser-computed constraint validation into
   * this element's `ElementInternals`, mirroring `<lr-input>`'s override of the same name. Without
   * it this control falls through to the base mixin's plain required-and-empty check, which leaves
   * `minlength`/`maxlength` enforced while typing but absent from `validity`.
   *
   * `required` is evaluated here rather than read back off the native element's own `valueMissing`,
   * for two reasons: the `required` attribute reaches that element only on Lit's next render (so a
   * same-tick `el.required = true` would be answered from a stale attribute), and this path owns
   * the localized `fieldRequired` message the base mixin already produced.
   *
   * The native `tooShort`/`tooLong` flags are raised only for a value the *user* edited, so an
   * over-length value assigned from script would report valid. `lengthViolations()` recomputes
   * both from `value` and they are OR-ed into the native flags (see
   * `internal/length-constraints.ts`).
   *
   * Barred controls short-circuit first, through the same `isBarredFromValidation()` predicate the
   * base mixin uses — this override used to check `readonly` alone, so a `<lr-textarea required
   * disabled>` (or one inside a `<fieldset disabled>`) still reported `valueMissing` and published
   * `:state(invalid)`/`:state(user-invalid)`, which no native `<textarea required disabled>` does.
   */
  protected updateValidity(): void {
    if (isBarredFromValidation(this, this.internals)) {
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
    const native = this.textareaEl;
    if (native && native.value !== this.value) native.value = this.value;
    const effectiveMinlength = this.effectiveLengthLimit(this.minlength);
    const effectiveMaxlength = this.effectiveLengthLimit(this.maxlength);
    const own = lengthViolations(
      this.value,
      effectiveMinlength,
      effectiveMaxlength
    );
    const tooShort = Boolean(native?.validity.tooShort) || own.tooShort;
    const tooLong = Boolean(native?.validity.tooLong) || own.tooLong;
    if (!tooShort && !tooLong) {
      this[SET_ANCHORED_VALIDITY]({});
      return;
    }
    this[SET_ANCHORED_VALIDITY](
      { tooShort, tooLong },
      // Empty exactly when the native textarea itself sees nothing wrong, i.e. when only the
      // dirty-value supplement above fired — the browser has no message for a value it considers
      // valid, so fall back to the localized generic one.
      native?.validationMessage || this.localize('valueInvalid')
    );
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('value')) {
      if (this.value === '') this.internals.states.add('blank');
      else this.internals.states.delete('blank');
    }
    // A constraint that tightens without a value write (`el.maxlength = 3` over an existing value)
    // reaches the native textarea only on this render, so validity has to be recomputed after it.
    if (
      changed.has('minlength') ||
      changed.has('maxlength') ||
      changed.has('readonly')
    ) {
      this.updateValidity();
    }
    if (changed.has('resize')) {
      if (this.resize === 'auto') {
        this.armResizeObserver();
      } else if (changed.get('resize') === 'auto') {
        this.resizeObserver?.disconnect();
        this.resizeObserver = undefined;
        if (this.resizeRaf !== undefined)
          this.resizeRafOwner?.cancelAnimationFrame(this.resizeRaf);
        this.resizeRaf = undefined;
        this.resizeRafOwner = undefined;
        if (this.textareaEl) {
          this.textareaEl.style.blockSize = '';
          this.textareaEl.style.overflowY = '';
        }
      }
    }
    if (this.resize === 'auto') {
      this.armResizeObserver();
      if (changed.has('value') || changed.has('rows') || changed.has('resize'))
        this.fitToContent();
    }
  }

  override formResetCallback(): void {
    super.formResetCallback();
    this.touched = false;
  }

  private armResizeObserver(): void {
    const textarea = this.textareaEl;
    if (this.resizeObserver || !textarea) return;
    const view = this.ownerDocument.defaultView;
    const ResizeObserverCtor = view?.ResizeObserver;
    if (!view || !ResizeObserverCtor) return;
    this.lastObservedWidth = textarea.getBoundingClientRect().width;
    this.resizeObserver = new ResizeObserverCtor((entries) => {
      if (!this.isConnected || this.ownerDocument.defaultView !== view) return;
      const width = entries[0]?.contentRect.width;
      // fitToContent() itself writes a *block*-size (height) change to the observed element,
      // which would otherwise re-trigger this same observer every tick -- only re-fit when the
      // *inline* size (width) actually changed, mirroring lr-chat-composer's identical
      // armTextareaResizeObserver() guard.
      if (
        width === undefined ||
        (this.lastObservedWidth !== undefined &&
          Math.abs(width - this.lastObservedWidth) < 0.5)
      ) {
        return;
      }
      this.lastObservedWidth = width;
      if (this.resizeRaf !== undefined)
        this.resizeRafOwner?.cancelAnimationFrame(this.resizeRaf);
      this.resizeRafOwner = view;
      this.resizeRaf = view.requestAnimationFrame(() => {
        this.resizeRaf = undefined;
        this.resizeRafOwner = undefined;
        if (!this.isConnected || this.ownerDocument.defaultView !== view)
          return;
        this.fitToContent();
      });
    });
    this.resizeObserver.observe(textarea);
  }

  private fitToContent(): void {
    const ta = this.textareaEl;
    if (!ta || this.resize !== 'auto') return;
    // Collapse first so a shrinking edit (e.g. deleting a wrapped line) can shrink the box back
    // down too, not just grow it -- scrollHeight never reports smaller than the box's current
    // height otherwise.
    ta.style.blockSize = 'auto';
    const computed = ta.ownerDocument.defaultView?.getComputedStyle(ta);
    if (!computed) return;
    const borderBlock =
      parseFloat(computed.borderBlockStartWidth) +
      parseFloat(computed.borderBlockEndWidth);
    const parsedMax = parseFloat(computed.maxBlockSize);
    const maxBlockSize = Number.isFinite(parsedMax)
      ? parsedMax
      : Number.POSITIVE_INFINITY;
    const contentBlockSize = ta.scrollHeight + borderBlock;
    ta.style.blockSize = `${Math.min(contentBlockSize, maxBlockSize)}px`;
    ta.style.overflowY = contentBlockSize > maxBlockSize ? 'auto' : 'hidden';
  }

  private onInput = (event: InputEvent): void => {
    if (this.liveDisabled) {
      event.stopPropagation();
      return;
    }
    if (!this.textareaEl) return;
    this.value = this.textareaEl.value;
    if (this.resize === 'auto') this.fitToContent();
    this.scheduleCountAnnouncement();
    relayNativeEvent(this, event);
    this.emit('lr-input', { value: this.value });
  };

  private onChange = (event: Event): void => {
    if (this.liveDisabled) {
      event.stopPropagation();
      return;
    }
    if (!this.textareaEl) return;
    this.value = this.textareaEl.value;
    relayNativeEvent(this, event);
    this.emit('lr-change', { value: this.value });
  };

  private onFocus = (event: FocusEvent): void => {
    if (this.liveDisabled) {
      event.stopPropagation();
      return;
    }
    relayNativeEvent(this, event);
  };

  private onBlur = (event: FocusEvent): void => {
    // A form-associated custom element's own `disabled` state becoming true force-blurs whatever
    // inside its shadow tree currently holds focus -- a platform reaction, not a user interaction.
    // That blur can land synchronously nested inside the very property write that disabled this
    // control (before Lit's own render has even reached the internal native <textarea>'s
    // `disabled` attribute), so `effectiveDisabled` already reads true here whenever this is that
    // case. Marking `touched` for it was, depending on timing, capable of reentering that same
    // in-flight update and tripping Lit's dev-mode "scheduled an update after an update completed"
    // warning for a state flip nothing observable needed -- a disabled control is barred from
    // validation regardless.
    if (!this.liveDisabled) this.touched = true;
    relayNativeEvent(this, event);
  };

  override render(): TemplateResult {
    const hasHint =
      this.slotPresence.has('hint') ||
      this.slotPresence.has('help-text') ||
      (this.hint ?? '').length > 0 ||
      (this.helpText ?? '').length > 0 ||
      this.withHint;
    const hasError =
      this.slotPresence.has('error') || (this.errorText ?? '').length > 0;
    const hasLabel =
      this.slotPresence.has('label') || (this.label ?? '').length > 0 || this.withLabel;
    const describedBy = [
      hasError ? 'textarea-error' : '',
      hasHint ? 'textarea-hint' : '',
    ]
      .filter(Boolean)
      .join(' ');
    // resize="auto" grows via JS (fitToContent()); the native CSS resize property stays 'none' so
    // there's no manual drag handle fighting the automatic sizing, matching wa-textarea.
    const cssResize =
      this.resize === 'auto'
        ? 'none'
        : sanitizeCssResize(this.resize, 'vertical');
    return html`
      <div part="form-control">
        <label part="form-control-label" for="textarea" ?hidden=${!hasLabel}>
          <span part="label">${this.label}<slot name="label"></slot></span>
        </label>
        <div part="base form-control-input textarea-adjuster textarea-wrapper">
          <textarea
            id="textarea"
            part="textarea"
            rows=${this.rows}
            placeholder=${this.placeholder}
            title=${this.title || nothing}
            style=${styleMap({ resize: cssResize })}
            ?data-auto-resize=${this.resize === 'auto'}
            aria-label=${this.accessibleLabel !== null
              ? this.accessibleLabel
              : hasLabel
              ? nothing
              : this.placeholder || this.localize('textareaLabel')}
            aria-describedby=${describedBy || nothing}
            aria-required=${this.required ? 'true' : 'false'}
            aria-invalid=${hasError ||
            (this.touched && !this.internals.validity.valid)
              ? 'true'
              : 'false'}
            spellcheck=${this.spellcheck}
            autocapitalize=${this.autocapitalize || nothing}
            autocorrect=${this.hasAttribute('autocorrect') || !this.autocorrect
              ? this.autocorrect
                ? 'on'
                : 'off'
              : nothing}
            autocomplete=${this.autocomplete || nothing}
            inputmode=${this.inputMode || nothing}
            enterkeyhint=${this.enterKeyHint || nothing}
            minlength=${this.effectiveLengthLimit(this.minlength) ?? nothing}
            maxlength=${this.effectiveLengthLimit(this.maxlength) ?? nothing}
            wrap=${this.wrap}
            .value=${this.value}
            ?required=${this.required}
            ?disabled=${this.effectiveDisabled}
            ?readonly=${this.readonly}
            ?autofocus=${this.autofocus}
            @input=${this.onInput}
            @change=${this.onChange}
            @focus=${this.onFocus}
            @blur=${this.onBlur}
          ></textarea>
        </div>
        <div id="textarea-error" part="error" ?hidden=${!hasError}>
          ${this.errorText}<slot name="error"></slot>
        </div>
        <div
          id="textarea-hint"
          part="hint form-control-help-text"
          ?hidden=${!hasHint}
        >
          ${this.hint || this.helpText}<slot name="hint"></slot
          ><slot name="help-text"></slot>
        </div>
        <div part="footer" ?hidden=${!this.withCount}>
          ${this.withCount
            ? html`<div part="count" aria-hidden="true">
                  ${this.countText()}
                </div>
                <div class="count-announcement" aria-hidden="true">
                  ${this.announcedCountText}
                </div>`
            : nothing}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-textarea': LyraTextarea;
  }
}
