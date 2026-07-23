import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { styles } from './rubric-form.styles.js';
import type { SegmentedItem } from '../../layout/segmented/segmented.class.js';
import type { LyraSelect } from '../select/select.class.js';
import '../../layout/segmented/segmented.class.js';
import '../slider/slider.class.js';
import '../select/select.class.js';
import '../combobox/option.class.js';
import '../checkbox/checkbox.class.js';
import '../checkbox-group/checkbox-group.class.js';
import '../textarea/textarea.class.js';

export interface RubricKeyOption {
  value: string;
  label?: string;
  description?: string;
}

export interface RubricKey {
  key: string;
  type: 'score' | 'category' | 'comment';
  label?: string;
  description?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: RubricKeyOption[];
  multiple?: boolean;
  placeholder?: string;
}

export type RubricValue = Record<string, number | string | string[] | undefined>;

const EMPTY_KEYS: RubricKey[] = [];
const EMPTY_VALUE: RubricValue = {};

export interface LyraRubricFormEventMap {
  'lr-input': CustomEvent<{ value: RubricValue }>;
  'lr-validity-change': CustomEvent<{ valid: boolean; errors: Record<string, string> }>;
  'lr-submit': CustomEvent<{ value: RubricValue; itemId: string }>;
  'lr-skip': CustomEvent<{ itemId: string }>;
}

/**
 * `<lr-rubric-form>` — a configurable annotation rubric (LangSmith
 * annotation-queue style): score, category, and freeform-comment keys with
 * a submit-and-next flow for working through an eval queue.
 *
 * Each `RubricKey.type` routes to an existing sibling control: `score`
 * renders `<lr-segmented>` when its `[min, max]`/`step` domain has 10 or
 * fewer integer steps, or `<lr-slider>` otherwise; `category` renders
 * `<lr-select>` (single) or `<lr-checkbox-group>` (`multiple`); `comment`
 * renders `<lr-textarea>`. A key whose `type` is none of the three renders
 * a visible "Unsupported field type" note instead of silently dropping it,
 * and marks the form invalid — the same defensive shape as
 * `<lr-tool-param-form>`'s own unsupported-property fallback.
 *
 * Optional native `<form>` participation is implemented via `ElementInternals`
 * attached directly (this component's value is a whole object, not a plain
 * string, so the `FormAssociated` string-value mixin doesn't fit) — the same
 * shape `<lr-tool-param-form>` uses. This is a nice-to-have layered on top
 * of the primary integration contract (`value` +
 * `lr-input`/`lr-validity-change`/`lr-submit`/`lr-skip`), not a
 * requirement: a consumer that never puts this inside a `<form>` loses
 * nothing.
 *
 * @customElement lr-rubric-form
 * @slot actions - Extra host controls rendered in the footer beside Submit/Skip.
 * @event lr-input - `detail: { value }` — any control changed; the full current value object.
 * @event lr-validity-change - `detail: { valid, errors }` — fired only on an actual change.
 * @event lr-submit - `detail: { value, itemId }` — Submit clicked or Ctrl/Cmd+Enter, after validity passes.
 * @event lr-skip - `detail: { itemId }` — Skip activated (`skippable` only); no validation.
 * @csspart base - The outer wrapper around all fields.
 * @csspart field - One key's wrapper (label + control + description + error).
 * @csspart label - A field's label.
 * @csspart description - A field's helper text.
 * @csspart scale - The rendered score/category/comment control's wrapper.
 * @csspart error - A field-level validation message.
 * @csspart footer - The row containing the actions slot and Submit/Skip buttons.
 * @csspart submit - The Submit button.
 * @csspart skip - The Skip button (only rendered when `skippable`).
 * @csspart empty - The message shown when `keys` has no entries.
 * @csspart unsupported - The fallback note for a key whose `type` is outside the three supported ones.
 */
export class LyraRubricForm extends LyraElement<LyraRubricFormEventMap> {
  static formAssociated = true;
  static override styles = [LyraElement.styles, styles];

  static override properties = {
    name: { reflect: true, noAccessor: true },
    keys: { attribute: false, noAccessor: true },
    value: { attribute: false, noAccessor: true },
    itemId: { attribute: 'item-id', reflect: true, noAccessor: true },
    hasNext: { type: Boolean, attribute: 'has-next', noAccessor: true },
    skippable: { type: Boolean, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
  };

  @state() private _errors: Record<string, string> = {};
  @state() private touchedFields = new Set<string>();

  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  private baseId = nextId('rubric-form');
  private _fieldsetDisabled = false;
  private _name = '';
  private _keys: RubricKey[] = EMPTY_KEYS;
  private _value: RubricValue = EMPTY_VALUE;
  private _itemId = '';
  private _hasNext = false;
  private _skippable = false;
  private _disabled = false;
  // Guards lr-validity-change so it only fires on an actual change, not on
  // every render -- `undefined` guarantees the first computed state always
  // "changes" from it, so mounting with an unmet required field still
  // announces `valid:false` once up front.
  private lastValidityKey: string | undefined;
  private pendingFocusFirst = false;

  constructor() {
    super();
    this.internals = this.safeAttachInternals();
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
    this.addEventListener('keydown', this.onFormKeyDown as EventListener);
    this.syncFormState();
  }

  /** `attachInternals()` throws in any environment without a real `ElementInternals`
   *  implementation (e.g. a downstream consumer's happy-dom test suite) -- merely constructing
   *  (or importing) this component must not hard-crash there. Falls back to an inert stand-in:
   *  form participation and validity reporting are unavailable in that environment (there is no
   *  polyfillable substitute), but rendering and every non-form-associated feature keep working.
   *  Mirrors lr-graph-query-builder's identical guard. */
  private safeAttachInternals(): ElementInternals {
    if (typeof (globalThis as { ElementInternals?: unknown }).ElementInternals === 'undefined') {
      return this.inertInternals();
    }
    try {
      return this.attachInternals();
    } catch {
      return this.inertInternals();
    }
  }

  private inertInternals(): ElementInternals {
    return {
      form: null,
      labels: [] as unknown as NodeList,
      validity: {} as ValidityState,
      validationMessage: '',
      willValidate: false,
      setFormValue: () => {},
      setValidity: () => {},
      checkValidity: () => true,
      reportValidity: () => true,
      states: new Set<string>(),
    } as unknown as ElementInternals;
  }

  get form(): HTMLFormElement | null {
    return this.internals.form;
  }
  /** Delegates straight to `ElementInternals.labels` -- no logic of its own. */
  get labels(): NodeList {
    return this.internals.labels;
  }
  get validity(): ValidityState {
    return this.internals.validity;
  }
  get validationMessage(): string {
    return this.internals.validationMessage;
  }
  get willValidate(): boolean {
    return this.internals.willValidate;
  }

  get keys(): RubricKey[] {
    return this._keys;
  }
  set keys(next: RubricKey[]) {
    const old = this._keys;
    this._keys = next ?? EMPTY_KEYS;
    this.syncFormState();
    this.requestUpdate('keys', old);
  }

  get value(): RubricValue {
    return this._value;
  }
  set value(next: RubricValue) {
    const old = this._value;
    this._value = next ?? EMPTY_VALUE;
    this.syncFormState();
    this.requestUpdate('value', old);
  }

  get itemId(): string {
    return this._itemId;
  }
  set itemId(next: string) {
    const old = this._itemId;
    this._itemId = next ?? '';
    if (old !== this._itemId) {
      this.touchedFields = new Set();
      // Only steal focus on a genuine item-to-item transition -- `hasUpdated`
      // (inherited from ReactiveElement, and still reliably `false` here: it
      // only flips to `true` inside the first `performUpdate()`, which can't
      // have run yet for a property set during upgrade/initial-template
      // commit) distinguishes that from the component's very first
      // assignment, e.g. a consumer declaring `item-id="..."` directly in
      // markup to use this as a single static form rather than a queue.
      if (this.hasUpdated) this.pendingFocusFirst = true;
    }
    if (this._itemId) this.setAttribute('item-id', this._itemId);
    else this.removeAttribute('item-id');
    this.requestUpdate('itemId', old);
  }

  get hasNext(): boolean {
    return this._hasNext;
  }
  set hasNext(next: boolean) {
    const old = this._hasNext;
    this._hasNext = Boolean(next);
    this.toggleAttribute('has-next', this._hasNext);
    this.requestUpdate('hasNext', old);
  }

  get skippable(): boolean {
    return this._skippable;
  }
  set skippable(next: boolean) {
    const old = this._skippable;
    this._skippable = Boolean(next);
    this.requestUpdate('skippable', old);
  }

  get name(): string {
    return this._name;
  }
  set name(next: string) {
    const old = this._name;
    this._name = next ?? '';
    if (this._name) this.setAttribute('name', this._name);
    else this.removeAttribute('name');
    this.requestUpdate('name', old);
  }

  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    this.toggleAttribute('disabled', this._disabled);
    this.requestUpdate('disabled', old);
  }

  /** Whether the form is disabled explicitly or by an ancestor fieldset. */
  get effectiveDisabled(): boolean {
    return this.disabled || this._fieldsetDisabled;
  }

  /** The current per-key validation errors (`{ [key]: message }`), mirroring the last
   *  `lr-validity-change` event's `errors`. Independent of which fields have been visited. */
  get errors(): Record<string, string> {
    return { ...this._errors };
  }

  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | undefined {
    const firstInvalidKey = Object.keys(this._errors)[0];
    // `renderRoot` doesn't exist until `connectedCallback()` runs -- a `keys`/`value` assignment
    // committed while this element is still detached (e.g. as part of assembling a template
    // fragment before it's inserted into the document) must not crash here.
    if (!firstInvalidKey || !this.renderRoot) return undefined;
    const field = this.renderRoot.querySelector(`[part="field"][data-key="${CSS.escape(firstInvalidKey)}"]`);
    return (field?.querySelector('.control') as HTMLElement | null) ?? undefined;
  }

  private isSegmentedScore(k: RubricKey): boolean {
    const min = k.min ?? 0;
    const max = k.max ?? 5;
    const step = k.step ?? 1;
    if (step <= 0 || !Number.isInteger(min) || !Number.isInteger(max) || !Number.isInteger(step)) return false;
    const count = (max - min) / step;
    return Number.isInteger(count) && count >= 0 && count <= 10;
  }

  private computeValidation(): { errors: Record<string, string>; flags: ValidityStateFlags } {
    const errors: Record<string, string> = {};
    const flags: ValidityStateFlags = {};
    for (const k of this._keys) {
      if (k.type !== 'score' && k.type !== 'category' && k.type !== 'comment') {
        errors[k.key] = this.localize('unsupportedFieldType', undefined, { type: String((k as { type: string }).type) });
        flags.customError = true;
        continue;
      }
      if (!k.required) continue;
      const v = this._value[k.key];
      const present = k.type === 'category' && k.multiple ? Array.isArray(v) && v.length > 0 : v !== undefined && v !== '';
      if (!present) {
        errors[k.key] = this.localize('fieldRequired');
        flags.valueMissing = true;
      }
    }
    return { errors, flags };
  }

  private syncFormState(): void {
    const { errors, flags } = this.computeValidation();
    this._errors = errors;
    let formValue: string | null = null;
    try {
      formValue = JSON.stringify(this._value);
    } catch {
      formValue = null;
    }
    this.internals.setFormValue(formValue, formValue);
    if (Object.keys(flags).length === 0) {
      this.validityController.setValidity({});
    } else {
      const message = Object.values(errors)[0] ?? '';
      this.validityController.setValidity(flags, message);
    }
  }

  /** Resynchronizes validity without revealing inline errors. */
  checkValidity(): boolean {
    this.syncFormState();
    return this.internals.checkValidity();
  }

  /**
   * Reveals every current field error (as if each field had been visited)
   * and returns overall validity -- the hook Submit calls before acting,
   * mirroring a native `<form>`'s `reportValidity()`.
   */
  reportValidity(): boolean {
    this.syncFormState();
    if (Object.keys(this._errors).length > 0) {
      this.touchedFields = new Set([...this.touchedFields, ...Object.keys(this._errors)]);
    }
    return this.internals.reportValidity();
  }

  formResetCallback(): void {
    this.value = {};
    this.touchedFields = new Set();
  }
  formStateRestoreCallback(state: string | File | FormData | null, _mode?: 'restore' | 'autocomplete'): void {
    let restored: RubricValue = {};
    if (typeof state === 'string') {
      try {
        const parsed: unknown = JSON.parse(state);
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) restored = parsed as RubricValue;
      } catch {
        // Invalid persisted state restores the safe empty object.
      }
    }
    this.value = restored;
  }
  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
    this.requestUpdate();
  }

  private onFormKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.submit();
    }
  };

  private setFieldValue(key: string, val: number | string | string[]): void {
    if (this.effectiveDisabled) return;
    this.value = { ...this._value, [key]: val };
    this.emit('lr-input', { value: { ...this._value } });
  }

  private markTouched(key: string): void {
    if (this.touchedFields.has(key)) return;
    this.touchedFields = new Set(this.touchedFields).add(key);
  }

  private submit(): void {
    if (this.effectiveDisabled) return;
    if (!this.reportValidity()) return;
    this.emit('lr-submit', { value: { ...this._value }, itemId: this.itemId });
  }

  private skip(): void {
    if (this.effectiveDisabled) return;
    this.emit('lr-skip', { itemId: this.itemId });
  }

  private focusFirstControl(): void {
    const firstKey = this._keys[0];
    if (!firstKey) return;
    const field = this.renderRoot.querySelector(`[part="field"][data-key="${CSS.escape(firstKey.key)}"]`);
    const control = field?.querySelector('.control') as (HTMLElement & { shadowRoot?: ShadowRoot | null }) | null;
    if (!control) return;
    if (firstKey.type === 'score' && this.isSegmentedScore(firstKey)) {
      (control.shadowRoot?.querySelector('[part="segment"][tabindex="0"]') as HTMLElement | null)?.focus();
    } else if (firstKey.type === 'score') {
      (control.shadowRoot?.querySelector('[part="thumb"]') as HTMLElement | null)?.focus();
    } else if (firstKey.type === 'category' && firstKey.multiple) {
      (control.querySelector('lr-checkbox') as HTMLElement | null)?.focus();
    } else {
      control.focus();
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('value') || changed.has('keys') || changed.has('_errors')) {
      const valid = Object.keys(this._errors).length === 0;
      const key = JSON.stringify({ valid, errors: this._errors });
      if (key !== this.lastValidityKey) {
        this.lastValidityKey = key;
        this.emit('lr-validity-change', { valid, errors: { ...this._errors } });
      }
    }
    if (this.pendingFocusFirst) {
      this.pendingFocusFirst = false;
      this.focusFirstControl();
    }
  }

  private renderScoreControl(k: RubricKey, fieldId: string, current: unknown): TemplateResult {
    const min = k.min ?? 0;
    const max = k.max ?? 5;
    const step = k.step ?? 1;
    const disabled = this.effectiveDisabled;
    if (this.isSegmentedScore(k)) {
      const items: SegmentedItem[] = [];
      for (let v = min; v <= max; v += step) items.push({ value: String(v), label: String(v), disabled });
      const value = typeof current === 'number' ? String(current) : '';
      return html`<lr-segmented
        id=${fieldId}
        class="control"
        part="scale"
        size="s"
        .items=${items}
        .value=${value}
        label=${k.label ?? k.key}
        @lr-change=${(e: CustomEvent<{ value: string }>) => this.setFieldValue(k.key, Number(e.detail.value))}
      ></lr-segmented>`;
    }
    const numeric = typeof current === 'number' ? current : min + (max - min) / 2;
    return html`<lr-slider
      id=${fieldId}
      class="control"
      part="scale"
      min=${min}
      max=${max}
      step=${step}
      show-value
      label=${k.label ?? k.key}
      .value=${String(numeric)}
      ?disabled=${disabled}
      @lr-change=${(e: CustomEvent<{ value: number }>) => this.setFieldValue(k.key, e.detail.value)}
    ></lr-slider>`;
  }

  private renderCategoryControl(k: RubricKey, fieldId: string, current: unknown): TemplateResult {
    const options = k.options ?? [];
    const disabled = this.effectiveDisabled;
    if (k.multiple) {
      const selected = Array.isArray(current) ? current : [];
      return html`<lr-checkbox-group
        id=${fieldId}
        class="control"
        part="scale"
        ?disabled=${disabled}
        ?required=${Boolean(k.required)}
        @lr-change=${(e: CustomEvent<{ value: string[] }>) => this.setFieldValue(k.key, e.detail.value)}
      >
        ${options.map(
          (opt) =>
            html`<lr-checkbox value=${opt.value} ?checked=${selected.includes(opt.value)} ?disabled=${disabled}
              >${opt.label ?? opt.value}</lr-checkbox
            >`,
        )}
      </lr-checkbox-group>`;
    }
    const value = typeof current === 'string' ? current : '';
    return html`<lr-select
      id=${fieldId}
      class="control"
      part="scale"
      .value=${value}
      ?disabled=${disabled}
      ?required=${Boolean(k.required)}
      @change=${(e: Event) => this.setFieldValue(k.key, (e.target as LyraSelect).value)}
    >
      ${options.map((opt) => html`<lr-option value=${opt.value}>${opt.label ?? opt.value}</lr-option>`)}
    </lr-select>`;
  }

  private renderCommentControl(k: RubricKey, fieldId: string, current: unknown): TemplateResult {
    const value = typeof current === 'string' ? current : '';
    return html`<lr-textarea
      id=${fieldId}
      class="control"
      part="scale"
      placeholder=${k.placeholder ?? ''}
      .value=${value}
      ?disabled=${this.effectiveDisabled}
      ?required=${Boolean(k.required)}
      @lr-input=${(e: CustomEvent<{ value: string }>) => {
        e.stopPropagation();
        this.setFieldValue(k.key, e.detail.value);
      }}
    ></lr-textarea>`;
  }

  private renderField(k: RubricKey, index: number): TemplateResult {
    const fieldId = `${this.baseId}-f${index}`;
    const required = Boolean(k.required);
    const hasError = this.touchedFields.has(k.key) && Boolean(this._errors[k.key]);
    const errId = hasError ? `${fieldId}-err` : '';
    const label = k.label ?? k.key;
    const current = this._value[k.key];

    let control: TemplateResult;
    if (k.type === 'score') control = this.renderScoreControl(k, fieldId, current);
    else if (k.type === 'category') control = this.renderCategoryControl(k, fieldId, current);
    else if (k.type === 'comment') control = this.renderCommentControl(k, fieldId, current);
    else {
      control = html`<p part="unsupported" id=${fieldId}>${this.localize('unsupportedFieldType', undefined, { type: String((k as { type: string }).type) })}</p>`;
    }

    return html`
      <div part="field" data-key=${k.key} @focusout=${() => this.markTouched(k.key)}>
        <label part="label" for=${fieldId}>${label}${required ? html`<span aria-hidden="true">*</span>` : nothing}</label>
        ${control}
        ${k.description ? html`<p part="description">${k.description}</p>` : nothing}
        ${hasError ? html`<p part="error" id=${errId} role="alert">${this._errors[k.key]}</p>` : nothing}
      </div>
    `;
  }

  override render(): TemplateResult {
    if (this._keys.length === 0) {
      return html`<div part="base"><p part="empty">${this.localize('noData')}</p></div>`;
    }
    return html`
      <div part="base">
        ${this._keys.map((k, i) => this.renderField(k, i))}
        <div part="footer">
          <slot name="actions"></slot>
          ${this._skippable
            ? html`<button part="skip" type="button" ?disabled=${this.effectiveDisabled} @click=${() => this.skip()}>
                ${this.localize('rubricSkip')}
              </button>`
            : nothing}
          <button part="submit" type="button" ?disabled=${this.effectiveDisabled} @click=${() => this.submit()}>
            ${this.localize(this._hasNext ? 'rubricSubmitAndNext' : 'rubricSubmit')}
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-rubric-form': LyraRubricForm;
  }
}
