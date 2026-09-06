import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  FormAssociated,
  isBarredFromValidation,
} from '../../../internal/form-associated.js';
import { SET_ANCHORED_VALIDITY } from '../../../internal/anchored-validity.js';
import {
  acquireResolvedAriaRelationship,
  type ResolvedAriaRelationshipLease,
} from '../../../internal/aria-controls.js';
import { finiteInteger, finiteNumber } from '../../../internal/numbers.js';
import { styles } from './code-editor.styles.js';
import { presenceTrueDefaultBooleanConverter as trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { sanitizeCssResize } from '../../../internal/safe-css.js';
import type { LyraSize } from '../../../internal/variants.js';
import type { LyraTextWrap } from '../../../internal/shared-unions.js';
import {
  autocorrectConverter,
  normalizeAutocorrect,
} from '../../../internal/converters.js';
import { lengthViolations } from '../../../internal/length-constraints.js';
import {
  dispatchNativeInputEvent,
  relayNativeEvent,
} from '../../../internal/native-event-relay.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_codeEditorLabel, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_valueInvalid } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export interface LyraCodeEditorEventMap {
  input: InputEvent;
  change: Event;
  blur: FocusEvent;
  focus: FocusEvent;
  'lr-input': CustomEvent<{ value: string }>;
  'lr-change': CustomEvent<{ value: string }>;
  'lr-invalid': CustomEvent<null>;
}
export type LyraCodeEditorResize =
  | 'none'
  | 'both'
  | 'horizontal'
  | 'vertical'
  | 'auto';
export type LyraCodeEditorWrap = LyraTextWrap;
class LyraCodeEditorBase extends LyraElement<LyraCodeEditorEventMap> {}

/** `true`-defaulting boolean attribute converter -- Lit's default presence-based `type: Boolean`
 *  can never be set back to `false` from a plain-HTML attribute once the property's own default is
 *  `true` (removing an attribute that was never present fires no `attributeChangedCallback`), so
 *  `fromAttribute` checks the literal string instead (mirrors `lr-task-list`'s `expanded`
 *  converter). `toAttribute` reflects the `true` state as a present attribute rather than omitting
 *  it, matching this property's own `reflect: true`. */

/** `<lr-code-editor>` — dependency-free multiline code editing surface with optional line numbers.
 *
 * Keyboard contract (no keyboard trap, WCAG 2.1.2): Tab inserts one indent unit of spaces at the
 * caret. Shift+Tab is never captured, so it always performs native reverse focus traversal.
 * Pressing Escape releases the next Tab for native forward traversal instead of indenting; typing
 * any other key, or focus leaving the editor, re-arms Tab indentation.
 * In narrow allocations label/hint/error chrome wraps at the host boundary, while unbroken source
 * remains reachable through the editor's one internal scroll surface instead of widening the page.
 * When a containing block gives the host a definite block size, the host, form-control, editor,
 * and textarea chain fills that allocation; without one, the editor remains content-sized above
 * its active `--lr-code-editor-min-block-size` floor.
 * The native textarea receives `required` and explicit stateful `aria-invalid`: visible error
 * chrome wins immediately, while intrinsic/custom invalidity is exposed only after interaction.
 * Form reset restores the default and pristine interaction feedback while required and custom
 * validity constraints remain. Removed label/hint/error attributes render as absent chrome.
 * Host `aria-describedby` references resolve onto the native textarea before local error/hint
 * guidance and remain current across target replacement, reconnect, and adoption.
 *
 * Tab-width precedence, highest first: an explicitly assigned `tabSize` (property or `tab-size`
 * attribute) wins over everything; otherwise a host-level `--lr-code-editor-tab-size` override
 * wins; otherwise the stylesheet's `:host` default of `2` applies. The property therefore stays the
 * primary knob, but it no longer silently shadows the token while it sits at its default -- see
 * `indentWidth` for how the same order drives the Tab key, not just the rendered tab stops.
 * Native text and its private measurement use the same tab width. Soft/hard wrapping fits the
 * editor allocation; unwrapped text and wrapped lines share the editor frame's scroll surface.
 * @customElement lr-code-editor
 * @slot label - Visible label content.
 * @slot hint - Supporting text.
 * @slot error - Validation message.
 * @event input - Realm-correct native `InputEvent` relayed once when the user edits the code.
 * @event change - Realm-correct native commit `Event`, relayed once.
 * @event lr-input - Lyra value alias; detail is `{ value }`.
 * @event lr-change - Lyra commit alias; detail is `{ value }`.
 * @event focus - Realm-correct native `FocusEvent` relayed from the textarea with `relatedTarget`.
 * @event blur - Realm-correct native `FocusEvent` relayed from the textarea with `relatedTarget`.
 * @event lr-invalid - The editor failed a validity check. Cancelable: `preventDefault()` forwards to
 * the native `invalid` event, suppressing the browser's own validation bubble and the focus/scroll
 * `reportValidity()` would otherwise perform.
 * @csspart form-control - Outer wrapper.
 * @csspart form-control-label - Label. Also carries the `label` part token for compatibility.
 * @csspart label - Alias of `form-control-label`.
 * @csspart editor - Editor frame and the component's only scrollport.
 * @csspart gutter - Line-number gutter.
 * @csspart textarea - Native textarea.
 * @csspart hint - Supporting text.
 * @csspart error - Validation message.
 * @cssprop [--lr-code-editor-min-block-size=var(--lr-size-8rem)] - Minimum block size of the editor frame and its textarea. Comes from the active `size` tier by default; assign it directly to override that tier's value.
 * @cssprop [--lr-code-editor-padding=var(--lr-space-s)] - Padding of the gutter (block side only) and the textarea (all sides), from the active `size` tier.
 * @cssprop [--lr-code-editor-font-size=var(--lr-font-size-m)] - Font size of the gutter's line numbers and the textarea, from the active `size` tier.
 * @cssprop [--lr-code-editor-line-height=1.5] - Line height shared by the gutter and the textarea, so line numbers stay aligned with their lines.
 * @cssprop [--lr-code-editor-tab-size=2] - The textarea's `tab-size`. The single channel for tab width — the class writes this token rather than setting `tab-size` directly.
 * @cssprop [--lr-code-editor-hover-border=var(--lr-color-brand)] - Editor-frame border while the
 * enabled surface is hovered.
 * @cssprop [--lr-code-editor-invalid-border=var(--lr-color-danger)] - Editor-frame border while
 * invalid chrome is visible.
 * @cssprop [--lr-form-control-required-content=' *'] - The required-field marker rendered after the
 * label. Set it to `''` to suppress the marker, or to any other quoted string (`' (required)'`, a
 * localized word) to replace it. Caller-supplied content, so it is never localized here.
 * @cssprop [--lr-form-control-required-color=var(--lr-color-danger)] - Color of that marker,
 * retunable without touching any other danger-coloured surface.
 * @cssprop [--lr-form-control-required-offset=0] - Inline space between the label text and the
 * marker.
 * @status stable
 * @since 4.0.0
 */
export class LyraCodeEditor extends FormAssociated(LyraCodeEditorBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    codeEditorLabel: LYRA_DEFAULT_codeEditorLabel,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    valueInvalid: LYRA_DEFAULT_valueInvalid,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];
  /** Language identifier exposed as a reflected host styling hook. */
  @property({ reflect: true, useDefault: true }) language = '';
  @property({
    converter: trueDefaultBooleanConverter,
    reflect: true,
    attribute: 'line-numbers',
  })
  lineNumbers = true;

  private _tabSize = 2;
  private tabSizeAssigned = false;
  /** Spaces inserted per Tab keypress, and the rendered `tab-size`. Assigning it (or setting the
   *  `tab-size` attribute) pins both, overriding any `--lr-code-editor-tab-size` the host set;
   *  leaving it alone lets that token drive them instead. Confirmed-crash history: this used to
   *  feed `' '.repeat(Math.max(1, this.tabSize))` directly in `onKeyDown` below --
   *  `String.prototype.repeat()` throws a `RangeError` for a count of `+Infinity` specifically
   *  (e.g. a literal `tab-size="Infinity"` attribute, which `Number("Infinity")` happily converts
   *  to), and `Math.max(1, NaN)` is itself `NaN`, silently producing an empty, non-indenting insert
   *  for a NaN `tabSize`. Sanitized to a finite integer in `[1, 16]` at assignment time instead, so
   *  both the `repeat()` call and the emitted tab-width style always see a safe value. */
  @property({ type: Number, attribute: 'tab-size' })
  get tabSize(): number {
    return this._tabSize;
  }
  set tabSize(value: number) {
    const old = this._tabSize;
    // Removing the `tab-size` attribute hands Lit's Number converter a `null`: treat that as "back
    // to unset" so the token regains control rather than staying pinned to the sanitized fallback.
    this.tabSizeAssigned = (value as number | null) != null;
    this._tabSize = finiteInteger(value, 2, 1, 16);
    this.requestUpdate('tabSize', old);
  }
  /** Spaces a Tab press inserts, resolved with the documented precedence: an explicitly assigned
   *  `tabSize`, else the rendered `--lr-code-editor-tab-size` when it is a plain number, else the
   *  default. A length-valued token (`40px`, `2ch`, ...) is a purely visual tab-stop metric for
   *  literal tab characters, so it is deliberately not reinterpreted as a count of spaces. */
  private get indentWidth(): number {
    if (this.tabSizeAssigned || !this.textarea) return this._tabSize;
    const resolved = getComputedStyle(this.textarea).tabSize.trim();
    if (!/^\d+(?:\.\d+)?$/.test(resolved)) return this._tabSize;
    return finiteInteger(Number(resolved), this._tabSize, 1, 16);
  }

  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  @property() placeholder = '';
  @property({ type: Boolean, reflect: true }) readonly = false;
  /** Visible native row count. */
  private _rows = 4;
  @property({ type: Number, useDefault: true })
  get rows(): number {
    return this._rows;
  }
  set rows(next: number) {
    const previous = this._rows;
    this._rows = finiteInteger(next, 4, 1);
    this.requestUpdate('rows', previous);
  }
  /** Visible native column count. It also supplies the platform's hard-wrap submission width. */
  @property({ type: Number, useDefault: true }) cols = 20;
  /** Native minimum and maximum code-unit length constraints. */
  private _minlength?: number;
  @property({ type: Number })
  get minlength(): number | undefined {
    return this._minlength;
  }
  set minlength(next: number | undefined) {
    const previous = this._minlength;
    this._minlength =
      next !== undefined && Number.isFinite(next) && next >= 0
        ? finiteInteger(next, 0, 0)
        : undefined;
    this.requestUpdate('minlength', previous);
  }
  private _maxlength?: number;
  @property({ type: Number })
  get maxlength(): number | undefined {
    return this._maxlength;
  }
  set maxlength(next: number | undefined) {
    const previous = this._maxlength;
    this._maxlength =
      next !== undefined && Number.isFinite(next) && next >= 0
        ? finiteInteger(next, 0, 0)
        : undefined;
    this.requestUpdate('maxlength', previous);
  }
  /** Native CSS `resize` behavior. `auto` grows to content and scrolls at a consumer-supplied
   *  `max-block-size`; leaving `auto` clears that mode's inline size/overflow state. An invalid
   *  runtime value falls back to `'both'`. */
  @property({ reflect: true, useDefault: true }) resize: LyraCodeEditorResize =
    'both';
  /** Visual size on the library's one control ladder, shared with `<lr-textarea>`/`<lr-input>`/
   *  `<lr-select>`. Accepts both the canonical `'2xs'`–`'xl'` steps and Web Awesome's/Shoelace's
   *  `'small'`/`'medium'`/`'large'` spellings of `s`/`m`/`l`; the two render identically. Governs
   *  the gutter's and textarea's padding and font size, plus the editor frame's minimum block
   *  size. */
  @property({ reflect: true }) size: LyraSize = 'm';
  private wrapValue: LyraCodeEditorWrap = 'off';
  @property({ attribute: 'wrap', useDefault: true })
  get wrap(): LyraCodeEditorWrap {
    return this.wrapValue;
  }
  set wrap(next: LyraCodeEditorWrap | string | null) {
    const old = this.wrapValue;
    this.wrapValue = next === 'soft' || next === 'hard' ? next : 'off';
    this.syncSubmissionValue();
    this.requestUpdate('wrap', old);
  }
  @property({
    converter: {
      fromAttribute: (value: string | null) => value === '' || value === 'true',
    },
    useDefault: true,
  })
  override spellcheck = false;
  @property({ type: Boolean }) override autofocus = false;
  @property() override title = '';
  @property() override autocapitalize = 'off';
  @property() autocomplete = '';
  @property({ attribute: 'inputmode' }) override inputMode = '';
  @property({ attribute: 'enterkeyhint' }) override enterKeyHint = '';
  private autocorrectValue = false;
  @property({ converter: autocorrectConverter, useDefault: true })
  override get autocorrect(): boolean {
    return this.autocorrectValue;
  }
  override set autocorrect(next: boolean | string) {
    this.autocorrectValue = normalizeAutocorrect(next);
    this.requestUpdate();
  }
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
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  @state() private touched = false;
  @state() private hasLabelSlot = false;
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;
  @query('textarea') private textarea?: HTMLTextAreaElement;
  @query('[part="editor"]') private editor?: HTMLElement;
  @query('[part="gutter"]') private gutter?: HTMLElement;
  @query('.editor-caret-measure') private caretMeasure?: HTMLElement;
  @state() private gutterWindowStart = 0;
  @state() private caretOffset = 0;
  private externalDescriptionLease?: ResolvedAriaRelationshipLease;
  private textGeometryObserver?: ResizeObserver;
  private wrappedLineStarts?: { value: string; offsets: number[] };

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) {
      this.syncExternalDescription();
      this.observeTextGeometry();
    }
  }

  override disconnectedCallback(): void {
    this.textGeometryObserver?.disconnect();
    this.textGeometryObserver = undefined;
    this.releaseExternalDescription();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.releaseExternalDescription();
    this.textGeometryObserver?.disconnect();
    this.textGeometryObserver = undefined;
    if (this.isConnected && this.hasUpdated) {
      this.syncExternalDescription();
      this.observeTextGeometry();
    }
  }

  private syncExternalDescription(): void {
    if (!this.isConnected) return;
    const owner = this.textarea;
    if (!owner) return;
    if (this.externalDescriptionLease) this.externalDescriptionLease.update(owner);
    else this.externalDescriptionLease = acquireResolvedAriaRelationship(this, owner, 'aria-describedby');
  }

  private releaseExternalDescription(): void {
    this.externalDescriptionLease?.release();
    this.externalDescriptionLease = undefined;
  }

  override formResetCallback(): void {
    super.formResetCallback();
    this.touched = false;
  }
  /** The normalized live value. Native textarea line endings are always LF; the host, form state,
   * gutter and selection APIs use that same representation. */
  override get value(): string {
    return super.value;
  }
  override set value(next: string | null) {
    super.value = this.normalizeLineEndings(next);
    this.syncSubmissionValue();
  }
  override get defaultValue(): string {
    return super.defaultValue;
  }
  override set defaultValue(next: string | null) {
    super.defaultValue = this.normalizeLineEndings(next);
    this.syncSubmissionValue();
  }
  private normalizeLineEndings(value: string | null | undefined): string {
    return String(value ?? '').replace(/\r\n?/g, '\n');
  }
  /** Uses the owner realm's native textarea serializer for `wrap="hard"`; the live value and
   * restoration state remain unwrapped, exactly like a native textarea's IDL value. */
  private submissionValue(): string {
    if (this.wrap !== 'hard') return this.value;
    const view = this.ownerDocument?.defaultView;
    if (!view?.FormData) return this.value;
    const form = this.ownerDocument.createElement('form');
    const textarea = this.ownerDocument.createElement('textarea');
    textarea.name = 'value';
    textarea.wrap = 'hard';
    textarea.cols = finiteInteger(this.cols, 20, 1, 1_000_000);
    textarea.value = this.value;
    form.append(textarea);
    const mount = this.isConnected ? this.ownerDocument.body : null;
    mount?.append(form);
    try {
      const serialized = new view.FormData(form).get('value');
      return typeof serialized === 'string' ? serialized : this.value;
    } catch {
      return this.value;
    } finally {
      form.remove();
    }
  }
  private syncSubmissionValue(): void {
    if (!this.internals) return;
    this.internals.setFormValue(this.submissionValue(), this.value);
  }
  /** Direct access to the owned native textarea. */
  get input(): HTMLTextAreaElement | null {
    return this.textarea ?? null;
  }
  /** Reads both component state and the UA's synchronous fieldset cascade before public actions. */
  private get liveDisabled(): boolean {
    return this.effectiveDisabled || this.matches(':disabled');
  }
  override click(): void {
    if (!this.liveDisabled) this.textarea?.click();
  }
  override focus(options?: FocusOptions): void {
    if (!this.liveDisabled) this.textarea?.focus(options);
  }
  override blur(): void {
    this.textarea?.blur();
  }
  select(): void {
    this.textarea?.select();
    this.syncCaretOffset();
  }
  get selectionStart(): number | null {
    return this.textarea?.selectionStart ?? null;
  }
  set selectionStart(value: number | null) {
    if (this.textarea) {
      this.textarea.selectionStart = value ?? 0;
      this.syncCaretOffset();
    }
  }
  get selectionEnd(): number | null {
    return this.textarea?.selectionEnd ?? null;
  }
  set selectionEnd(value: number | null) {
    if (this.textarea) {
      this.textarea.selectionEnd = value ?? 0;
      this.syncCaretOffset();
    }
  }
  get selectionDirection(): 'forward' | 'backward' | 'none' | null {
    return this.textarea?.selectionDirection ?? null;
  }
  set selectionDirection(value: 'forward' | 'backward' | 'none' | null) {
    if (this.textarea) {
      this.textarea.selectionDirection = value ?? 'none';
      this.syncCaretOffset();
    }
  }
  setSelectionRange(
    start: number,
    end: number,
    direction?: 'forward' | 'backward' | 'none',
  ): void {
    this.textarea?.setSelectionRange(start, end, direction);
    this.syncCaretOffset();
  }
  setRangeText(
    replacement: string,
    start?: number,
    end?: number,
    selectionMode?: SelectionMode,
  ): void {
    const textarea = this.textarea;
    if (!textarea) return;
    textarea.setRangeText(
      replacement,
      start ?? textarea.selectionStart,
      end ?? textarea.selectionEnd,
      selectionMode,
    );
    this.value = textarea.value;
    this.syncCaretOffset();
    this.fitToContent();
  }
  /** Reads or sets the editor frame's physical scroll offsets. The private native textarea is
   * deliberately sized to its matching text measurement layer, so it never owns a competing scroll
   * range that could desynchronize the line-number gutter or a programmatic scroll. */
  scrollPosition(position?: {
    top?: number;
    left?: number;
  }): { top: number; left: number } | undefined {
    const editor = this.editor;
    if (!editor) return undefined;
    if (position === undefined)
      return { top: editor.scrollTop, left: editor.scrollLeft };
    if (position.top !== undefined) {
      editor.scrollTop = finiteNumber(position.top, editor.scrollTop);
    }
    if (position.left !== undefined) {
      editor.scrollLeft = finiteNumber(position.left, editor.scrollLeft);
    }
    this.syncGutterInlinePosition();
    return undefined;
  }
  private onInput = (event: InputEvent): void => {
    if (this.liveDisabled) {
      event.stopPropagation();
      return;
    }
    this.value = (event.target as HTMLTextAreaElement).value;
    this.syncCaretOffset();
    this.fitToContent();
    relayNativeEvent(this, event);
    this.emit('lr-input', { value: this.value });
  };
  private onChange = (event: Event): void => {
    if (this.liveDisabled) {
      event.stopPropagation();
      return;
    }
    this.value = (event.target as HTMLTextAreaElement).value;
    relayNativeEvent(this, event);
    this.emit('lr-change', { value: this.value });
  };
  private onFocus = (event: FocusEvent): void => {
    if (this.liveDisabled) {
      event.stopPropagation();
      return;
    }
    const textarea = event.target;
    // Native focus dispatch may restore the selection only after its listeners return.
    queueMicrotask(() => {
      if (this.isConnected && this.textarea === textarea && this.shadowRoot?.activeElement === textarea)
        this.syncCaretOffset();
    });
    relayNativeEvent(this, event);
  };
  // Disabling a focused native control forces the browser to blur it --
  // plain native HTML behavior, not a real user interaction -- so that forced blur must not mark
  // the field touched. `tabBypassArmed`/`emit('blur')` still run unconditionally: they're tab-key
  // bookkeeping and the public blur event contract, not validation state.
  private onBlur = (event: FocusEvent): void => {
    if (!this.liveDisabled) this.touched = true;
    this.tabBypassArmed = false;
    relayNativeEvent(this, event);
  };
  private tabBypassArmed = false;
  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.liveDisabled) return;
    if (event.key === 'Escape') {
      this.tabBypassArmed = true;
      return;
    }
    if (event.key === 'Tab') {
      if (event.shiftKey) return;
      if (this.tabBypassArmed) {
        this.tabBypassArmed = false;
        return;
      }
      if (this.readonly) return;
      event.preventDefault();
      const target = event.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      target.setRangeText(
        ' '.repeat(this.indentWidth),
        start,
        target.selectionEnd,
        'end',
      );
      this.value = target.value;
      dispatchNativeInputEvent(this, {
        data: ' '.repeat(this.indentWidth),
        inputType: 'insertText',
      });
      this.emit('lr-input', { value: this.value });
      return;
    }
    this.tabBypassArmed = false;
  };
  private onCaretChange = (): void => {
    this.syncCaretOffset();
  };
  private syncCaretOffset(): void {
    const textarea = this.textarea;
    if (!textarea) return;
    const next = finiteInteger(textarea.selectionEnd, 0, 0, this.value.length);
    if (next === this.caretOffset) {
      this.scrollCaretIntoView();
      return;
    }
    this.caretOffset = next;
  }
  private scrollCaretIntoView(): void {
    const editor = this.editor;
    const marker = this.caretMeasure;
    if (!editor || !marker) return;
    const frame = editor.getBoundingClientRect();
    let caret = marker.getBoundingClientRect();
    let text = marker.nextSibling;
    while (text && (text.nodeType !== 3 || !text.textContent)) text = text.nextSibling;
    if (text) {
      // Text ranges follow bidi caret placement and font metrics, unlike a neutral inline anchor.
      const range = this.ownerDocument.createRange();
      range.setStart(text, 0);
      // A selected line break has caret geometry even where its collapsed range has no box.
      if (text.textContent?.startsWith('\n')) range.setEnd(text, 1);
      else range.collapse(true);
      const measured = range.getBoundingClientRect();
      if (measured.height > 0) caret = measured;
    }
    const gutterWidth = this.gutter?.getBoundingClientRect().width ?? 0;
    const viewportLeft = frame.left + editor.clientLeft;
    const viewportTop = frame.top + editor.clientTop;
    const textLeft = viewportLeft + (this.effectiveDirection === 'rtl' ? 0 : gutterWidth);
    const textRight = viewportLeft + editor.clientWidth - (this.effectiveDirection === 'rtl' ? gutterWidth : 0);
    const viewportBottom = viewportTop + editor.clientHeight;
    const left =
      caret.left < textLeft
        ? caret.left - textLeft
        : caret.right > textRight
        ? caret.right - textRight
        : 0;
    const top =
      caret.top < viewportTop
        ? caret.top - viewportTop
        : caret.bottom > viewportBottom
        ? caret.bottom - viewportBottom
        : 0;
    if (left === 0 && top === 0) return;
    editor.scrollBy({
      left: finiteNumber(left, 0),
      top: finiteNumber(top, 0),
    });
    this.syncGutterInlinePosition();
  }
  private onLabelSlotChange = (e: Event): void => {
    this.hasLabelSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };
  private onHintSlotChange = (e: Event): void => {
    this.hasHintSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };
  private onErrorSlotChange = (e: Event): void => {
    this.hasErrorSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };
  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.hasUpdated) {
      this.hasLabelSlot = Array.from(this.children ?? []).some(
        (el) => el.getAttribute('slot') === 'label',
      );
      this.hasHintSlot = Array.from(this.children ?? []).some(
        (el) => el.getAttribute('slot') === 'hint',
      );
      this.hasErrorSlot = Array.from(this.children ?? []).some(
        (el) => el.getAttribute('slot') === 'error',
      );
    }
  }
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.syncExternalDescription();
    if (this.textarea && this.textarea.value !== this.value)
      this.textarea.value = this.value;
    if (
      changed.has('touched') ||
      changed.has('required') ||
      changed.has('value') ||
      changed.has('minlength') ||
      changed.has('maxlength') ||
      changed.has('readonly')
    ) {
      this.updateValidity();
      this.toggleAttribute(
        'data-invalid',
        this.touched && !this.internals.validity.valid,
      );
    }
    if (changed.has('wrap') || changed.has('cols')) this.syncSubmissionValue();
    if (
      changed.has('resize') ||
      changed.has('value') ||
      changed.has('rows') ||
      changed.has('cols')
    ) {
      this.fitToContent();
    }
    this.syncGutterInlinePosition();
    this.observeTextGeometry();
    this.syncGutterGeometry();
    if (changed.has('caretOffset') || changed.has('value'))
      this.scrollCaretIntoView();
  }
  protected updateValidity(): void {
    if (isBarredFromValidation(this, this.internals)) {
      this[SET_ANCHORED_VALIDITY]({});
      return;
    }
    if (this.required && this.value === '') {
      this[SET_ANCHORED_VALIDITY](
        { valueMissing: true },
        this.localize('fieldRequired'),
      );
      return;
    }
    const native = this.textarea;
    if (native && native.value !== this.value) native.value = this.value;
    const own = lengthViolations(this.value, this.minlength, this.maxlength);
    const tooShort = Boolean(native?.validity.tooShort) || own.tooShort;
    const tooLong = Boolean(native?.validity.tooLong) || own.tooLong;
    this[SET_ANCHORED_VALIDITY](
      tooShort || tooLong ? { tooShort, tooLong } : {},
      tooShort || tooLong
        ? native?.validationMessage || this.localize('valueInvalid')
        : '',
    );
  }
  private countLines(): number {
    if (!this.lineNumbers) return 0;
    let count = 1;
    for (let index = 0; index < this.value.length; index++) {
      if (this.value.charCodeAt(index) === 10) count++;
    }
    return count;
  }
  private syncGutterInlinePosition(): void {
    const editor = this.editor;
    const gutter = this.gutter;
    if (!editor || !gutter) return;
    gutter.style.setProperty(
      '--_lr-code-editor-gutter-scroll-translation',
      `${finiteNumber(editor.scrollLeft, 0)}px`,
    );
  }
  private get wrapsText(): boolean {
    return this.wrap === 'soft' || this.wrap === 'hard';
  }

  private lineStarts(): number[] {
    if (this.wrappedLineStarts?.value === this.value) return this.wrappedLineStarts.offsets;
    const offsets = [0];
    for (let index = 0; index < this.value.length; index++) {
      if (this.value.charCodeAt(index) === 10) offsets.push(index + 1);
    }
    this.wrappedLineStarts = { value: this.value, offsets };
    return offsets;
  }

  /** Measures logical line starts without creating one DOM node per source line. */
  private wrappedLineOffset(offset: number): number {
    const measure = this.renderRoot.querySelector<HTMLElement>('.editor-measure');
    if (!measure) return 0;
    const nodes = Array.from(measure.childNodes).filter((node) => node.nodeType === 3);
    const range = this.ownerDocument.createRange();
    const first = nodes.find((node) => (node.textContent?.length ?? 0) > 0);
    if (!first) return 0;
    range.setStart(first, 0);
    range.setEnd(first, 1);
    const firstTop = range.getBoundingClientRect().top;
    let remaining = offset;
    for (const node of nodes) {
      const length = node.textContent?.length ?? 0;
      if (remaining < length) {
        range.setStart(node, remaining);
        range.setEnd(node, remaining + 1);
        return range.getBoundingClientRect().top - firstTop;
      }
      remaining -= length;
    }
    return 0;
  }

  private syncGutterGeometry(): void {
    if (!this.lineNumbers) return;
    const lines = this.renderRoot.querySelectorAll<HTMLElement>('.gutter-line');
    const start = Math.min(this.gutterWindowStart, Math.max(0, this.countLines() - 1));
    const offsets = this.wrapsText ? this.lineStarts() : undefined;
    // Finish geometry reads before writing any row styles, keeping layout work in one phase.
    const positions = offsets
      ? Array.from(lines, (_line, index) => this.wrappedLineOffset(offsets[start + index] ?? 0))
      : undefined;
    const height = this.renderRoot.querySelector<HTMLElement>('.editor-measure')?.getBoundingClientRect().height;
    if (height !== undefined) this.gutter?.style.setProperty('block-size', `${height}px`);
    lines.forEach((line, index) => {
      line.style.insetBlockStart = positions
        ? `${positions[index]}px`
        : `calc(var(--lr-code-editor-line-height, var(--_lr-code-editor-line-height)) * ${start + index}em)`;
    });
  }

  private observeTextGeometry(): void {
    if (!this.lineNumbers || !this.isConnected) {
      this.textGeometryObserver?.disconnect();
      this.textGeometryObserver = undefined;
      return;
    }
    if (this.textGeometryObserver) return;
    const measure = this.renderRoot.querySelector<HTMLElement>('.editor-measure');
    const ownerDocument = this.ownerDocument;
    const Observer = ownerDocument.defaultView?.ResizeObserver;
    if (!measure || !Observer) return;
    const observer = new Observer(() => {
      if (!this.isConnected || this.ownerDocument !== ownerDocument || this.textGeometryObserver !== observer) return;
      this.onEditorScroll();
      this.syncGutterGeometry();
    });
    this.textGeometryObserver = observer;
    observer.observe(measure);
  }

  private onEditorScroll = (): void => {
    this.syncGutterInlinePosition();
    if (!this.lineNumbers || !this.editor || !this.textarea) return;
    const computed = this.ownerDocument.defaultView?.getComputedStyle(
      this.textarea,
    );
    const lineHeight = computed
      ? Number.parseFloat(computed.lineHeight)
      : Number.NaN;
    if (!Number.isFinite(lineHeight) || lineHeight <= 0) return;
    let firstVisible = Math.floor(this.editor.scrollTop / lineHeight);
    if (this.wrapsText) {
      const offsets = this.lineStarts();
      let low = 0;
      let high = offsets.length - 1;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (this.wrappedLineOffset(offsets[middle]!) <= this.editor.scrollTop) low = middle;
        else high = middle - 1;
      }
      firstVisible = low;
    }
    const next = Math.max(0, firstVisible - 20);
    if (next !== this.gutterWindowStart) this.gutterWindowStart = next;
  };
  private gutterRows(lineCount: number): TemplateResult {
    const start = Math.min(this.gutterWindowStart, Math.max(0, lineCount - 1));
    const end = Math.min(lineCount, start + 200);
    const rows = Array.from({ length: end - start }, (_value, offset) => {
      const index = start + offset;
      return html`<span
        class="gutter-line"
        style=${styleMap({
          insetBlockStart: `calc(var(--lr-code-editor-line-height, var(--_lr-code-editor-line-height)) * ${index}em)`,
        })}
        >${index + 1}</span
      >`;
    });
    return html`<span class="gutter-measure">${lineCount}</span
      ><span
        class="gutter-window"
        style=${styleMap({
          blockSize: `calc(var(--lr-code-editor-line-height, var(--_lr-code-editor-line-height)) * ${lineCount}em)`,
        })}
        >${rows}</span
      >`;
  }
  private fitToContent(): void {
    const textarea = this.textarea;
    if (!textarea) return;
    if (this.resize !== 'auto') {
      textarea.style.blockSize = '';
      textarea.style.overflowY = '';
      return;
    }
    textarea.style.blockSize = 'auto';
    textarea.style.overflowY = 'hidden';
    const computed = this.ownerDocument.defaultView?.getComputedStyle(textarea);
    if (!computed) return;
    const border =
      Number.parseFloat(computed.borderBlockStartWidth) +
      Number.parseFloat(computed.borderBlockEndWidth);
    const contentBlockSize =
      textarea.scrollHeight + (Number.isFinite(border) ? border : 0);
    // Keep max-block-size in CSS's hands: getComputedStyle() deliberately preserves percentages
    // (and may preserve calc expressions), so parsing its text would turn 50% into 50px. Writing
    // the desired size lets layout resolve every supported unit against the right containing block.
    textarea.style.blockSize = `${contentBlockSize}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > textarea.clientHeight ? 'auto' : 'hidden';
  }
  override render(): TemplateResult {
    const lineCount = this.countLines();
    // Write the token, not `tab-size` itself: the stylesheet resolves the public token before its
    // private default, so an untouched `tabSize` leaves an inherited or host-level override in
    // charge instead of being overwritten by an inline declaration on every update.
    const textareaStyle = {
      resize:
        this.resize === 'auto'
          ? 'none'
          : sanitizeCssResize(this.resize, 'both'),
    };
    const contentStyle = this.tabSizeAssigned
      ? { '--lr-code-editor-tab-size': String(this._tabSize) }
      : {};
    const hasLabel = this.hasLabelSlot || (this.label ?? '').length > 0;
    const hasHint = this.hasHintSlot || (this.hint ?? '').length > 0;
    const hasError = this.hasErrorSlot || (this.errorText ?? '').length > 0;
    const describedBy = [
      hasError ? 'textarea-error' : '',
      hasHint ? 'textarea-hint' : '',
    ]
      .filter(Boolean)
      .join(' ');
    const label = this.hasAttribute('aria-label')
      ? this.getAttribute('aria-label')!
      : this.accessibleLabel ||
        (hasLabel ? nothing : this.localize('codeEditorLabel'));
    const invalid =
      hasError || (this.touched && !this.internals.validity.valid);
    return html`<div part="form-control">
      <label part="label form-control-label" for="textarea" ?hidden=${!hasLabel}
        >${this.label}<slot
          name="label"
          @slotchange=${this.onLabelSlotChange}
        ></slot
      ></label>
      <div
        part="editor"
        data-language=${this.language}
        @scroll=${this.onEditorScroll}
      >
        ${this.lineNumbers
          ? html`<div part="gutter" aria-hidden="true">${this.gutterRows(lineCount)}</div>`
          : nothing}
        <div class="editor-content" data-wrap=${this.wrap} style=${styleMap(contentStyle)}>
          <span class="editor-measure" data-wrap=${this.wrap} aria-hidden="true"
            >${this.value.slice(0, this.caretOffset)}<span
              class="editor-caret-measure"
            ></span
            >${this.value.slice(this.caretOffset)}​</span
          >
          <textarea
          id="textarea"
          part="textarea"
          .value=${this.value}
          aria-label=${label}
          aria-describedby=${describedBy || nothing}
          aria-invalid=${invalid ? 'true' : 'false'}
          placeholder=${this.placeholder}
          ?required=${this.required}
          ?readonly=${this.readonly}
          ?disabled=${this.effectiveDisabled}
          ?autofocus=${this.autofocus}
          title=${this.title || nothing}
          rows=${this.rows}
          cols=${this.cols}
          minlength=${this.minlength ?? nothing}
          maxlength=${this.maxlength ?? nothing}
          spellcheck=${this.spellcheck}
          autocapitalize=${this.autocapitalize}
          autocorrect=${this.autocorrect ? 'on' : 'off'}
          autocomplete=${this.autocomplete || nothing}
          inputmode=${this.inputMode || nothing}
          enterkeyhint=${this.enterKeyHint || nothing}
          wrap=${this.wrap}
          style=${styleMap(textareaStyle)}
          @input=${this.onInput}
          @change=${this.onChange}
          @keydown=${this.onKeyDown}
          @keyup=${this.onCaretChange}
          @mouseup=${this.onCaretChange}
          @select=${this.onCaretChange}
          @focus=${this.onFocus}
          @blur=${this.onBlur}
          ></textarea>
        </div>
      </div>
      <div id="textarea-hint" part="hint" ?hidden=${!hasHint}>
        ${this.hint}<slot
          name="hint"
          @slotchange=${this.onHintSlotChange}
        ></slot>
      </div>
      <div id="textarea-error" part="error" ?hidden=${!hasError}>
        ${this.errorText}<slot
          name="error"
          @slotchange=${this.onErrorSlotChange}
        ></slot>
      </div>
    </div>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lr-code-editor': LyraCodeEditor;
  }
}
