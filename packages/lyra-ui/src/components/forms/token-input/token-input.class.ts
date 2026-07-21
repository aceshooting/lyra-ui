import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { nextId } from '../../../internal/a11y.js';
import { closeIcon } from '../../../internal/icons.js';
import { styles } from './token-input.styles.js';

export type LyraTokenInputSize = '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl';

/** A no-op stand-in for `ElementInternals`, used only when the host environment has no real
 *  implementation of it (e.g. a downstream consumer's Vitest + happy-dom test suite) --
 *  `attachInternals()` is browser-only, and calling it unconditionally in the constructor would
 *  otherwise throw before any test assertion runs, merely from constructing or importing this
 *  component. Every member here is either an inert value or a no-op: native `<form>`
 *  participation is unavailable in that environment, but that's an acceptable degradation rather
 *  than a hard failure -- same fix as `<lr-checkbox>`'s/`<lr-combobox>`'s identical
 *  `createInternalsSafely`/`createNoopInternals` pair. */
function createInternalsSafely(host: HTMLElement): ElementInternals {
  if (typeof host.attachInternals !== 'function') return createNoopInternals();
  try {
    return host.attachInternals();
  } catch {
    return createNoopInternals();
  }
}

function createNoopInternals(): ElementInternals {
  return {
    form: null,
    labels: [] as unknown as NodeList,
    validity: {} as ValidityState,
    validationMessage: '',
    willValidate: false,
    setFormValue(): void {},
    setValidity(): void {},
    checkValidity(): boolean {
      return true;
    },
    reportValidity(): boolean {
      return true;
    },
  } as unknown as ElementInternals;
}

export interface LyraTokenInputEventMap {
  input: CustomEvent<{ value: string[] }>;
  change: CustomEvent<{ value: string[] }>;
  'lr-add': CustomEvent<{ value: string }>;
  'lr-remove': CustomEvent<{ value: string; index: number }>;
  'lr-token-edit': CustomEvent<{ value: string; previousValue: string; index: number }>;
}

/**
 * `delimiter` accepts `null` to mean "never split, and never treat a keystroke as a commit key",
 * which the default string converter can't express: a missing attribute leaves the property at its
 * declared default, and `delimiter=""` would otherwise reach `''.split('')` and explode a draft into
 * individual characters. Both `delimiter="none"` and `delimiter=""` therefore map to `null`;
 * removing the attribute restores the `,` default.
 */
const delimiterConverter = {
  fromAttribute: (value: string | null): string | null => {
    if (value === null) return ',';
    return value === '' || value === 'none' ? null : value;
  },
  toAttribute: (value: string | null): string => (value === null ? 'none' : value),
};

/** `<lr-token-input>` — an editable, form-associated list of removable tokens.
 * @customElement lr-token-input
 * @slot label - Visible label content.
 * @slot hint - Supporting text.
 * @slot error - Validation message.
 * @event lr-add - A token was added; detail is `{ value }`.
 * @event lr-remove - A token was removed; detail is `{ value, index }`.
 * @event lr-token-edit - An existing token was edited in place and committed; detail is `{ value, previousValue, index }`. Not emitted for a reverted, unchanged, emptied, or duplicate-colliding edit.
 * @csspart form-control - Outer control wrapper.
 * @csspart form-control-label - Label.
 * @csspart input-wrapper - Token and input row.
 * @csspart token - Individual token.
 * @csspart token-label - The token's text, as the roving-focus edit trigger. Rendered only while `editable` is set.
 * @csspart token-editor - The inline text field replacing a token's text while it is being edited. Rendered only while `editable` is set and that token is open for editing.
 * @csspart remove - Token remove button.
 * @csspart input - Native text input.
 * @csspart hint - Supporting text.
 * @csspart error - Validation message.
 * @cssprop [--lr-token-input-input-inline-size=var(--lr-size-8rem)] - `flex-basis` of the native text input within the token row.
 * @cssprop [--lr-token-input-min-input-inline-size=var(--lr-size-4rem)] - Inline-size floor of the native text input, so it stays usable once tokens wrap.
 * @cssprop [--lr-token-input-editor-inline-size=var(--lr-size-6rem)] - Inline size of the inline token editor opened by `editable`.
 * @cssprop --lr-token-input-padding - Input-wrapper padding, scaled by `size`.
 * @cssprop --lr-token-input-font-size - Input-wrapper/token font size, scaled by `size`.
 * @cssprop --lr-token-input-control-min-height - Input-wrapper block-size floor, scaled by `size`.
 * @cssprop --lr-token-input-control-height - Exact input-wrapper height. Unset by default, which
 *   leaves `--lr-token-input-control-min-height` as a floor only; set it to a length to both floor
 *   and cap the row (e.g. to pixel-match a sibling field in the same toolbar row). Because it is
 *   never declared by the component itself, it can be set from an ancestor or an outer-tree rule
 *   as well as inline on the element.
 */
export class LyraTokenInput extends LyraElement<LyraTokenInputEventMap> {
  static formAssociated = true;
  static styles = [LyraElement.styles, styles];

  static properties = {
    name: { reflect: true, noAccessor: true },
    required: { type: Boolean, reflect: true, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
  };

  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  @property() placeholder = '';
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  /** Visual size — same `2xs`–`xl` scale as `lr-input`'s own `size`. */
  @property({ reflect: true }) size: LyraTokenInputSize = 'm';
  @property({ attribute: 'allow-duplicates', type: Boolean }) allowDuplicates = false;
  /** Allow editing an existing token in place: each token becomes a roving tab stop that opens an
   *  inline editor on click, Enter, or F2. Defaults to `false`, in which case the token row renders
   *  exactly as it does without this feature and stays non-focusable. */
  @property({ attribute: 'editable', type: Boolean, reflect: true }) editable = false;
  /** Character(s) that split a typed draft into several tokens, and (when a single character) the
   *  keystroke that commits the draft. `null` — from the property, or from `delimiter="none"` /
   *  `delimiter=""` — disables both, so a token may contain the delimiter verbatim. Defaults to `,`. */
  @property({ attribute: 'delimiter', converter: delimiterConverter }) delimiter: string | null = ',';
  @state() private draft = '';
  @state() private touched = false;
  /** Index of the token whose inline editor is open, or `-1` when none is. */
  @state() private editingIndex = -1;
  @state() private editDraft = '';
  /** Roving tab stop of the token row. Read through `activeTokenIndex`, which clamps it against the
   *  current token count so a shrinking list can never leave the row with no tab stop. */
  @state() private rovingIndex = 0;
  private focusEditorPending = false;
  private focusTokenPending = -1;
  // `[part]:empty` never matches -- the part always contains a literal
  // `<slot>` child element regardless of assigned content -- so real
  // emptiness is tracked in JS instead (mirrors lr-select's identical
  // hasLabelSlot/hasHintSlot/hasErrorSlot) and reflected via `hidden`.
  @state() private hasLabelSlot = false;
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;
  // Selected by id rather than by tag: an open token editor is also an `input`, and it precedes
  // this one in DOM order, so a bare `input` selector would silently retarget `focus()`, `blur()`,
  // and the validity anchor at the editor while a token is being edited.
  @query('#input') private inputEl?: HTMLInputElement;
  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  private labelId = nextId('token-input-label');
  private hintId = nextId('token-input-hint');
  private errorId = nextId('token-input-error');
  private _value: string[] = [];
  // Tracked separately from the consumer's own `disabled` -- a fieldset
  // cascade must never mutate that IDL property/attribute itself (mirrors
  // lr-select's/lr-combobox's identical `_fieldsetDisabled`/
  // `effectiveDisabled` pattern), only the combined getter below.
  private _fieldsetDisabled = false;
  private _name = '';
  private _required = false;
  private _disabled = false;

  @property({ attribute: false })
  get value(): string[] { return this._value; }
  set value(next: string[]) { const old = this._value; this._value = Array.isArray(next) ? [...next] : []; this.requestUpdate('value', old); if (this.internals) this.syncValidity(); }

  /** The form submission key, reflected synchronously for native form APIs.
   *  This control keys its `FormData` entries directly off `name` (see
   *  `syncValidity()`), so a rename must rebuild that `FormData` in the same
   *  tick -- mirrors `<lr-combobox>`'s identical `name` setter. */
  get name(): string { return this._name; }
  set name(next: string) {
    const old = this._name;
    this._name = next ?? '';
    if (this._name) {
      this.setAttribute('name', this._name);
    } else {
      this.removeAttribute('name');
    }
    this.syncValidity();
    this.requestUpdate('name', old);
  }

  get required(): boolean { return this._required; }
  set required(next: boolean) {
    const old = this._required;
    this._required = Boolean(next);
    this.toggleAttribute('required', this._required);
    this.syncValidity();
    this.requestUpdate('required', old);
  }

  get disabled(): boolean { return this._disabled; }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    this.toggleAttribute('disabled', this._disabled);
    this.requestUpdate('disabled', old);
  }

  constructor() { super(); this.internals = createInternalsSafely(this); this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]()); }
  connectedCallback(): void { super.connectedCallback(); this.syncValidity(); }
  get form(): HTMLFormElement | null { return this.internals.form; }
  get validity(): ValidityState { return this.internals.validity; }
  get validationMessage(): string { return this.internals.validationMessage; }
  get willValidate(): boolean { return this.internals.willValidate; }
  /** Effective disabled state: this element's own `disabled` OR an ancestor
   *  `<fieldset disabled>`'s inherited state -- mirrors native `<input>`, whose
   *  own `disabled` IDL property/attribute is never mutated by a fieldset. */
  get effectiveDisabled(): boolean { return this.disabled || this._fieldsetDisabled; }
  /**
   * Called by the browser when an ancestor `<fieldset disabled>` toggles.
   * Tracked separately from the consumer's own `disabled` (see
   * `effectiveDisabled`) so a consumer's explicit `disabled` survives the
   * fieldset re-enabling instead of being permanently overwritten.
   */
  formDisabledCallback(disabled: boolean): void { this._fieldsetDisabled = disabled; this.requestUpdate(); }
  /**
   * The anchor stays the main text input even while an inline token editor is open: the only
   * constraint this control can fail is `valueMissing`, which requires an empty token list — and an
   * empty list has no token to edit, so the two states are mutually exclusive.
   * @internal
   */
  [VALIDITY_ANCHOR](): HTMLElement | null { return this.inputEl ?? this.renderRoot?.querySelector('[part="input-wrapper"]') ?? null; }
  checkValidity(): boolean { return this.internals.checkValidity(); }
  reportValidity(): boolean { return this.internals.reportValidity(); }
  override focus(options?: FocusOptions): void { this.inputEl?.focus(options); }
  override blur(): void { this.inputEl?.blur(); }
  /** Focuses the draft text input, mirroring what a real click on the token row would land on --
   *  `HTMLElement.prototype.click()` is otherwise a no-op on a custom element with no native click
   *  semantics of its own (matches `<lr-combobox>`'s identical override). */
  override click(): void {
    if (this.effectiveDisabled) return;
    this.inputEl?.focus();
  }
  protected willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // no-op today, but keeps a future mixin's willUpdate reachable
    if (!this.hasUpdated) {
      this.hasLabelSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'label');
      this.hasHintSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'hint');
      this.hasErrorSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'error');
    }
  }

  private syncValidity(): void {
    const missing = this.required && this.value.length === 0;
    this.validityController.setValidity(missing ? { valueMissing: true } : {}, missing ? this.localize('tokenInputRequired') : '');
    this.toggleAttribute('data-invalid', this.touched && !this.internals.validity.valid);
    const data = new FormData();
    if (this.name) this.value.forEach((token) => data.append(this.name, token));
    this.internals.setFormValue(this.name ? data : null);
  }
  private updateValue(next: string[], event?: 'add' | 'remove'): void {
    this.value = next;
    this.syncValidity();
    this.emit('input', { value: this.value });
    this.emit('change', { value: this.value });
    if (event === 'add') this.emit('lr-add', { value: next[next.length - 1] });
  }
  private addDraft(): void {
    if (this.effectiveDisabled) return;
    // A null/empty delimiter means the whole draft is one token -- `''.split('')` would otherwise
    // explode the draft into one token per character.
    const parts = this.delimiter ? this.draft.split(this.delimiter) : [this.draft];
    const candidates = parts.map((token) => token.trim()).filter(Boolean);
    for (const token of candidates) {
      if (!this.allowDuplicates && this.value.includes(token)) continue;
      this.updateValue([...this.value, token], 'add');
    }
    this.draft = '';
  }
  private removeToken(index: number): void {
    // Removing a token reindexes every later one, so an editor left open over the old indices would
    // commit against the wrong token.
    if (this.editingIndex >= 0) { this.editingIndex = -1; this.editDraft = ''; }
    const removed = this.value[index];
    this.updateValue(this.value.filter((_token, i) => i !== index));
    this.emit('lr-remove', { value: removed, index });
  }
  /**
   * The token row's roving tab stop, clamped to the current token count. Derived rather than
   * stored so a token list that shrinks below the focused index still leaves exactly one tab stop.
   */
  private get activeTokenIndex(): number {
    if (!this.value.length) return -1;
    return Math.min(Math.max(this.rovingIndex, 0), this.value.length - 1);
  }

  /** Open the inline editor for a token, seeded with that token's full current text. */
  private startEdit(index: number): void {
    if (this.effectiveDisabled || !this.editable) return;
    if (index < 0 || index >= this.value.length) return;
    this.editingIndex = index;
    this.editDraft = this.value[index];
    this.rovingIndex = index;
    this.focusEditorPending = true;
  }

  /** Close the editor discarding its contents, returning focus to the token it was opened from. */
  private cancelEdit(): void {
    if (this.editingIndex < 0) return;
    this.focusTokenPending = this.editingIndex;
    this.editingIndex = -1;
    this.editDraft = '';
  }

  /**
   * Close the editor, applying its contents when they are a usable change. The editor is closed
   * first so the teardown blur it triggers re-enters this method as a no-op rather than committing
   * (and emitting `change`) a second time. An emptied editor cancels rather than removing the
   * token -- removal stays the explicit job of the remove button -- and an edit colliding with an
   * existing token under `allowDuplicates = false` is discarded, mirroring how `addDraft()` skips a
   * duplicate candidate instead of rejecting the whole entry.
   */
  private commitEdit(restoreFocus: boolean): void {
    const index = this.editingIndex;
    if (index < 0) return;
    const previousValue = this.value[index];
    const next = this.editDraft.trim();
    // Only a keyboard commit pulls focus back to the token: a blur commit means the user already
    // aimed focus somewhere else (the text input, the next token, another control entirely), and
    // stealing it back would fight them.
    if (restoreFocus) this.focusTokenPending = index;
    this.editingIndex = -1;
    this.editDraft = '';
    if (!next || next === previousValue) return;
    if (!this.allowDuplicates && this.value.some((token, i) => i !== index && token === next)) return;
    this.updateValue(this.value.map((token, i) => (i === index ? next : token)));
    this.emit('lr-token-edit', { value: next, previousValue, index });
  }

  private moveRovingFocus(index: number): void {
    if (!this.value.length) return;
    const clamped = Math.min(Math.max(index, 0), this.value.length - 1);
    this.rovingIndex = clamped;
    this.focusTokenPending = clamped;
  }

  private onTokenKeyDown(event: KeyboardEvent, index: number): void {
    if (this.effectiveDisabled) return;
    // ArrowLeft/ArrowRight mean previous/next *visually*, so they swap under RTL.
    const rtl = this.effectiveDirection === 'rtl';
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backward = rtl ? 'ArrowRight' : 'ArrowLeft';
    // Space activates alongside Enter because the token carries `role="button"`; F2 matches the
    // grid/tree convention for "edit this cell in place".
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'F2') { event.preventDefault(); this.startEdit(index); }
    else if (event.key === forward) { event.preventDefault(); this.moveRovingFocus(index + 1); }
    else if (event.key === backward) { event.preventDefault(); this.moveRovingFocus(index - 1); }
    else if (event.key === 'Home') { event.preventDefault(); this.moveRovingFocus(0); }
    else if (event.key === 'End') { event.preventDefault(); this.moveRovingFocus(this.value.length - 1); }
  }

  private onEditInput = (event: Event): void => { this.editDraft = (event.target as HTMLInputElement).value; };
  private onEditKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter') { event.preventDefault(); this.commitEdit(true); }
    // Escape is consumed rather than left to bubble: an enclosing dialog/popover would otherwise
    // close on the same keystroke that only meant "abandon this token edit".
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.cancelEdit(); }
  };
  private onEditBlur = (): void => { this.commitEdit(false); };

  private onInput = (event: Event): void => { this.draft = (event.target as HTMLInputElement).value; };
  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.effectiveDisabled) return;
    if (event.key === 'Enter' || (this.delimiter !== null && event.key === this.delimiter)) { if (this.draft.trim()) { event.preventDefault(); this.addDraft(); } }
    else if (event.key === 'Tab') { if (this.draft.trim()) this.addDraft(); }
    // An open token editor owns Backspace: the destructive "remove the last token" shortcut must
    // not fire for a keystroke that was aimed at the text being edited.
    else if (event.key === 'Backspace' && !this.draft && this.value.length && this.editingIndex < 0) { this.removeToken(this.value.length - 1); }
  };
  private onBlur = (): void => { if (this.draft.trim()) this.addDraft(); this.touched = true; this.syncValidity(); this.emit('blur'); };
  private onFocus = (): void => { this.emit('focus'); };
  private onLabelSlotChange = (e: Event): void => { this.hasLabelSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0; };
  private onHintSlotChange = (e: Event): void => { this.hasHintSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0; };
  private onErrorSlotChange = (e: Event): void => { this.hasErrorSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0; };
  formResetCallback(): void { this.value = []; this.draft = ''; this.editingIndex = -1; this.editDraft = ''; this.rovingIndex = 0; this.touched = false; this.syncValidity(); }
  /**
   * Focus moves are deferred to here rather than run from the handlers themselves: the editor and
   * the token it replaces only exist after the render that this update produced.
   */
  protected updated(changed: PropertyValues): void {
    super.updated(changed); // no-op today, but keeps a future mixin's updated reachable
    if (this.focusEditorPending) {
      this.focusEditorPending = false;
      const editor = this.renderRoot?.querySelector('[part="token-editor"]') as HTMLInputElement | null;
      editor?.focus();
      editor?.select();
    }
    if (this.focusTokenPending >= 0) {
      const index = this.focusTokenPending;
      this.focusTokenPending = -1;
      const labels = this.renderRoot?.querySelectorAll('[part="token-label"]');
      (labels?.[index] as HTMLElement | undefined)?.focus();
    }
  }
  private renderRemoveButton(token: string, index: number): TemplateResult {
    return html`<button part="remove" type="button" aria-label=${this.localize('removeWithContext', undefined, { label: token })} ?disabled=${this.effectiveDisabled} @click=${() => this.removeToken(index)}>${closeIcon()}</button>`;
  }
  private renderEditableToken(token: string, index: number): TemplateResult {
    if (this.editingIndex === index) {
      return html`<span part="token"><input part="token-editor" .value=${this.editDraft} aria-label=${this.localize('tokenInputEditWithContext', undefined, { label: token })} ?disabled=${this.effectiveDisabled} @input=${this.onEditInput} @keydown=${this.onEditKeyDown} @blur=${this.onEditBlur} />${this.renderRemoveButton(token, index)}</span>`;
    }
    return html`<span part="token"><span part="token-label" role="button" tabindex=${index === this.activeTokenIndex ? 0 : -1} aria-label=${this.localize('tokenInputEditWithContext', undefined, { label: token })} @click=${() => this.startEdit(index)} @focus=${() => { if (this.rovingIndex !== index) this.rovingIndex = index; }} @keydown=${(event: KeyboardEvent) => this.onTokenKeyDown(event, index)}>${token}</span>${this.renderRemoveButton(token, index)}</span>`;
  }
  render(): TemplateResult {
    const hasLabel = this.hasLabelSlot || this.label.length > 0;
    const hasHint = this.hasHintSlot || this.hint.length > 0;
    const hasError = this.hasErrorSlot || this.errorText.length > 0;
    const described = [hasHint ? this.hintId : '', hasError ? this.errorId : ''].filter(Boolean).join(' ') || nothing;
    return html`<div part="form-control">
      <label part="form-control-label" ?hidden=${!hasLabel} for="input" id=${this.labelId}>${this.label}<slot name="label" @slotchange=${this.onLabelSlotChange}></slot>${this.required ? html`<span aria-hidden="true">*</span>` : nothing}</label>
      <div part="input-wrapper" role="group" aria-labelledby=${this.accessibleLabel ? nothing : hasLabel ? this.labelId : nothing} aria-label=${this.accessibleLabel || nothing} aria-describedby=${described}>
        ${this.value.map((token, index) => this.editable ? this.renderEditableToken(token, index) : html`<span part="token"><span>${token}</span><button part="remove" type="button" aria-label=${this.localize('removeWithContext', undefined, { label: token })} ?disabled=${this.effectiveDisabled} @click=${() => this.removeToken(index)}>${closeIcon()}</button></span>`)}
        <input id="input" part="input" .value=${this.draft} placeholder=${this.placeholder} ?disabled=${this.effectiveDisabled} aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'} @input=${this.onInput} @keydown=${this.onKeyDown} @blur=${this.onBlur} @focus=${this.onFocus} />
      </div>
      <div part="hint" id=${this.hintId} ?hidden=${!hasHint}>${this.hint}<slot name="hint" @slotchange=${this.onHintSlotChange}></slot></div>
      <div part="error" id=${this.errorId} ?hidden=${!hasError}>${this.errorText}<slot name="error" @slotchange=${this.onErrorSlotChange}></slot></div>
    </div>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-token-input': LyraTokenInput; } }
