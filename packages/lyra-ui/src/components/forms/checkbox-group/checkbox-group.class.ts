import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { nextId } from '../../../internal/a11y.js';
import { styles } from './checkbox-group.styles.js';
import type { LyraCheckbox } from '../checkbox/checkbox.class.js';

/** A no-op stand-in for `ElementInternals`, used only when the host environment has no real
 *  implementation of it (e.g. a downstream consumer's Vitest + happy-dom test suite) --
 *  `attachInternals()` is browser-only, and calling it unconditionally in the constructor would
 *  otherwise throw before any test assertion runs, merely from constructing or importing this
 *  component. Every member here is either an inert value or a no-op: native `<form>`
 *  participation is unavailable in that environment, but that's an acceptable degradation rather
 *  than a hard failure -- same fix as `<lr-tool-param-form>`'s/`<lr-model-select>`'s identical
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

/** Fired once per group instance -- a repeat assignment is the same mistake, not new information.
 *  Plain `console.warn`, matching every other authoring-mistake warning in the library
 *  (`<lr-task-list>`'s over-nesting warning, `<lr-dashboard-grid>`'s unmatched-`cell-id` warning,
 *  `<lr-flow-canvas>`'s unrecognized-child warning): the package ships as plain `tsc` ESM with no
 *  build-time `define`, so there is no existing dev-only gate to reuse and inventing one here would
 *  diverge from the rest of the tree. */
function warnValueAssigned(group: LyraCheckboxGroup): void {
  console.warn(
    '<lr-checkbox-group> `value` is derived from its <lr-checkbox> children and is overwritten by ' +
      'the next sync (any child toggle, a slot change, a `name`/`required` change, blur, or ' +
      `form reset), so assigning it has no lasting effect${group.name ? ` (name="${group.name}")` : ''}. ` +
      'Set `checked` on the children instead.',
  );
}

/** Fired once per duplicated value per group instance, so a group re-syncing on every child toggle
 *  does not spam the console. */
function warnDuplicateValue(group: LyraCheckboxGroup, value: string): void {
  console.warn(
    `<lr-checkbox-group> has more than one <lr-checkbox> child with value="${value}"` +
      `${group.name ? ` (name="${group.name}")` : ''}; every checked one contributes an identical ` +
      'FormData entry, so the submitted data cannot say which was checked. Give each child a distinct `value`.',
  );
}

export interface LyraCheckboxGroupEventMap {
  input: CustomEvent<{ value: string[] }>;
  change: CustomEvent<{ value: string[] }>;
  'lr-change': CustomEvent<{ value: string[] }>;
}

/**
 * `<lr-checkbox-group>` — a form-associated group of `<lr-checkbox>` elements.
 *
 * @customElement lr-checkbox-group
 * @slot - `<lr-checkbox>` children.
 * @slot label - Visible group label.
 * @slot hint - Supporting text.
 * @slot error - Custom validation message.
 * @event input - User selection changed.
 * @event change - User selection changed.
 * @event lr-change - User selection changed; detail is `{ value: string[] }`.
 * @csspart form-control - Group wrapper.
 * @csspart form-control-label - Label.
 * @csspart options - Checkbox collection.
 * @csspart hint - Supporting text.
 * @csspart error - Validation message.
 */
export class LyraCheckboxGroup extends LyraElement<LyraCheckboxGroupEventMap> {
  static formAssociated = true;
  static styles = [LyraElement.styles, styles];

  static properties = {
    name: { reflect: true, noAccessor: true },
    required: { type: Boolean, reflect: true, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    value: { attribute: false, noAccessor: true },
  };

  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  @state() private touched = false;
  @state() private hasLabelSlot = false;
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;

  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  private labelId = nextId('checkbox-group-label');
  private hintId = nextId('checkbox-group-hint');
  private errorId = nextId('checkbox-group-error');
  // Inherited from an ancestor `<fieldset disabled>` via `formDisabledCallback()`.
  // Tracked separately from the consumer's own `disabled` (see `effectiveDisabled`)
  // so a consumer's explicit `disabled` survives the fieldset re-enabling instead
  // of being permanently overwritten -- mirrors `<lr-checkbox>`'s identical
  // `_fieldsetDisabled`/`effectiveDisabled` pattern.
  private _fieldsetDisabled = false;
  private _name = '';
  private _required = false;
  private _disabled = false;
  private _value: string[] = [];
  // Distinguishes `sync()`'s own write-back from a host assignment, so the read-out-only warning
  // below fires for the latter only. `sync()` writes `value` on *every* child toggle, slot change,
  // blur and form reset, so without this the warning would fire constantly during normal use.
  private _writingValue = false;
  private _warnedValueAssigned = false;
  private _warnedDuplicateValues = new Set<string>();

  /** The form submission key each checked child checkbox's value is grouped under in the group's
   *  own `FormData` entry (see `sync()`). Reflected synchronously for native form APIs; renaming
   *  rebuilds that `FormData` in the same tick -- mirrors `<lr-token-input>`'s identical `name` setter. */
  get name(): string { return this._name; }
  set name(next: string) {
    const old = this._name;
    this._name = next ?? '';
    if (this._name) this.setAttribute('name', this._name);
    else this.removeAttribute('name');
    this.sync();
    this.requestUpdate('name', old);
  }

  /**
   * The `value` of every currently-checked `<lr-checkbox>` child, in DOM order — a **read-out of
   * child state, not an input**. The children are the single source of truth: `sync()` recomputes
   * this from them and assigns it on every child toggle, `slotchange`, `name`/`required` change,
   * blur, and `form.reset()`, so a host assignment is silently overwritten by the next one of those.
   * `connectedCallback()` calls `onSlotChange()` → `sync()` **before the first render**, so even a
   * constructor-time or template-time `.value=` binding is discarded before it is ever observed.
   * Assigning it logs a console warning naming the property.
   *
   * To preselect options, set `checked` on the children (`<lr-checkbox value="a" checked>`); to read
   * the selection, use this property or the `lr-change` event detail. Making `value` authoritative is
   * deliberately not implemented: `<lr-checkbox>`'s `value` defaults to `'on'`, so a host assigning
   * `['on']` would check every undifferentiated child. A future change can add a distinct
   * `defaultValue` API without reversing anything documented here.
   */
  get value(): string[] { return this._value; }
  set value(next: string[]) {
    if (!this._writingValue && !this._warnedValueAssigned) {
      this._warnedValueAssigned = true;
      warnValueAssigned(this);
    }
    const old = this._value;
    this._value = Array.isArray(next) ? next : [];
    this.requestUpdate('value', old);
  }

  get required(): boolean { return this._required; }
  set required(next: boolean) {
    const old = this._required;
    this._required = Boolean(next);
    this.toggleAttribute('required', this._required);
    this.sync();
    this.requestUpdate('required', old);
  }

  get disabled(): boolean { return this._disabled; }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    this.toggleAttribute('disabled', this._disabled);
    this.propagateDisabled();
    this.requestUpdate('disabled', old);
  }

  constructor() {
    super();
    this.internals = createInternalsSafely(this);
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
  }

  private get boxes(): LyraCheckbox[] {
    return Array.from(this.querySelectorAll('lr-checkbox')) as unknown as LyraCheckbox[];
  }

  /** Whether the group is disabled explicitly or by an ancestor fieldset. */
  get effectiveDisabled(): boolean {
    return this.disabled || this._fieldsetDisabled;
  }

  // Propagates this group's effective (explicit-or-inherited) disabled state
  // to every child `<lr-checkbox>` through its internal `setGroupDisabled()`
  // channel -- never the child's own public `disabled` property/attribute,
  // which would permanently corrupt an explicitly-disabled child once the
  // group (or an ancestor fieldset) re-enables. Mirrors `<lr-radio-group>`'s
  // identical `setGroupDisabled()` propagation to `<lr-radio>`.
  private propagateDisabled(): void {
    const effective = this.effectiveDisabled;
    this.boxes.forEach((box) => box.setGroupDisabled?.(effective));
  }

  private readValue(): string[] {
    return this.boxes.filter((box) => box.checked).map((box) => box.value ?? 'on');
  }

  // A group whose children share a `value` produces indistinguishable FormData entries -- the
  // default `value = 'on'` on every `<lr-checkbox>` makes that the *easy* mistake, not an exotic
  // one. Reads the content attribute as well as the property so this is still accurate while a
  // child is queried before its own upgrade (`connectedCallback()` syncs in document order, so the
  // group runs first); a child with neither has the same effective `'on'` the form value would use.
  private warnOnDuplicateValues(): void {
    const seen = new Set<string>();
    for (const box of this.boxes) {
      const value = box.value ?? (box as unknown as Element).getAttribute('value') ?? 'on';
      if (!seen.has(value)) {
        seen.add(value);
        continue;
      }
      if (this._warnedDuplicateValues.has(value)) continue;
      this._warnedDuplicateValues.add(value);
      warnDuplicateValue(this, value);
    }
  }

  private sync(): void {
    const next = this.readValue();
    this.warnOnDuplicateValues();
    this._writingValue = true;
    try {
      this.value = next;
    } finally {
      this._writingValue = false;
    }
    const data = new FormData();
    if (this.name) next.forEach((value) => data.append(this.name, value));
    this.internals.setFormValue(this.name ? data : null);
    if (this.required && next.length === 0) this.validityController.setValidity({ valueMissing: true }, this.localize('checkboxGroupRequired'));
    else this.validityController.setValidity({});
    this.toggleAttribute('data-invalid', this.touched && !this.internals.validity.valid);
  }

  private emitChange = (event?: Event): void => {
    if (this.effectiveDisabled || event?.target === this) return;
    this.sync();
    this.emit('input', { value: this.value });
    this.emit('change', { value: this.value });
    this.emit('lr-change', { value: this.value });
  };

  private onSlotChange = (): void => {
    this.hasLabelSlot = !!this.querySelector('[slot="label"]');
    this.hasHintSlot = !!this.querySelector('[slot="hint"]');
    this.hasErrorSlot = !!this.querySelector('[slot="error"]');
    this.sync();
    this.propagateDisabled();
  };

  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('change', this.emitChange as EventListener);
    // Initialize light-DOM-derived state before the first render. Doing this in firstUpdated()
    // schedules a redundant follow-up update and triggers Lit's change-in-update warning.
    this.onSlotChange();
  }

  disconnectedCallback(): void {
    this.removeEventListener('change', this.emitChange as EventListener);
    super.disconnectedCallback();
  }

  protected firstUpdated(): void {
    this.addEventListener('blur', () => { this.touched = true; this.sync(); }, true);
  }

  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | null { return this.renderRoot?.querySelector('[part="options"]') ?? null; }
  get form(): HTMLFormElement | null { return this.internals.form; }
  get validity(): ValidityState { return this.internals.validity; }
  get validationMessage(): string { return this.internals.validationMessage; }
  get willValidate(): boolean { return this.internals.willValidate; }
  checkValidity(): boolean { return this.internals.checkValidity(); }
  reportValidity(): boolean { return this.internals.reportValidity(); }
  formResetCallback(): void { this.boxes.forEach((box) => { box.checked = box.hasAttribute('checked'); }); this.touched = false; this.sync(); }
  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
    this.propagateDisabled();
    this.requestUpdate();
  }

  render(): TemplateResult {
    const described = [this.hasHintSlot || this.hint ? this.hintId : '', this.hasErrorSlot || this.errorText ? this.errorId : ''].filter(Boolean).join(' ') || nothing;
    return html`<fieldset part="form-control" ?disabled=${this.effectiveDisabled} aria-describedby=${described}>
      <legend part="form-control-label" id=${this.labelId} ?hidden=${!this.label && !this.hasLabelSlot}>${this.label}<slot name="label" @slotchange=${this.onSlotChange}></slot>${this.required ? html`<span aria-hidden="true">*</span>` : nothing}</legend>
      <div part="options" role="group" aria-label=${this.accessibleLabel || nothing} aria-labelledby=${this.accessibleLabel ? nothing : this.labelId} aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'}>
        <slot @slotchange=${this.onSlotChange}></slot>
      </div>
      <div part="hint" id=${this.hintId} ?hidden=${!this.hint && !this.hasHintSlot}><slot name="hint" @slotchange=${this.onSlotChange}>${this.hint}</slot></div>
      <div part="error" id=${this.errorId} ?hidden=${!this.errorText && !this.hasErrorSlot}><slot name="error" @slotchange=${this.onSlotChange}>${this.errorText}</slot></div>
    </fieldset>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-checkbox-group': LyraCheckboxGroup; } }
