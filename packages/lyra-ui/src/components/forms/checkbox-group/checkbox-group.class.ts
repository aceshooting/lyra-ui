import { html, nothing, type ReactiveController, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { syncValidityStates } from '../../../internal/custom-states.js';
import { nextId } from '../../../internal/a11y.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraSize } from '../../../internal/variants.js';
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
 * @cssstate required - Matches while `required` is set. Style with
 * `lr-checkbox-group:state(required)`.
 * @cssstate optional - Matches while `required` is not set — the complement of `required`.
 * @cssstate valid - Matches while the group satisfies its constraints, including any
 * `setCustomValidity()` error.
 * @cssstate invalid - Matches while it does not — from the very first render, before the user has
 * touched anything.
 * @cssstate user-valid - `valid`, but only after the user has interacted: toggling one of the
 * group's checkboxes, a blur, or a `reportValidity()` call (which is what a submit attempt runs).
 * @cssstate user-invalid - `invalid` after that same interaction. Style validation errors with this
 * rather than `invalid`: a pristine required group is genuinely invalid, but colouring it red
 * before the user has done anything is hostile.
 * @csspart form-control - Group wrapper.
 * @csspart form-control-label - Label.
 * @csspart options - Checkbox collection.
 * @csspart hint - Supporting text.
 * @csspart error - Validation message.
 * @cssprop [--lr-checkbox-group-row-gap=calc(var(--lr-form-control-height) * 0.1)] - Vertical gap
 * between the group's label, options and messages, scaled by `size`.
 * @cssprop [--lr-checkbox-group-option-gap=calc(var(--lr-form-control-height) * 0.2)] - Gap between
 * adjacent options, scaled by `size`.
 */
export class LyraCheckboxGroup extends LyraElement<LyraCheckboxGroupEventMap> {
  static formAssociated = true;
  static override styles = [LyraElement.styles, sizes, styles];

  static override properties = {
    name: { reflect: true, noAccessor: true },
    required: { type: Boolean, reflect: true, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    size: { reflect: true },
    value: { attribute: false, noAccessor: true },
  };

  /**
   * Size of the group's own chrome, on the library's shared ladder. Accepts both spellings of every
   * tier — `2xs`/`xs`/`s`/`m`/`l`/`xl` and Web Awesome's `small`/`medium`/`large` — so migrating
   * either way is a tag rename. Scales the group's label type size and the gaps around and between
   * its options off the same `--lr-form-control-*` values the controls themselves use. It does not
   * resize the `<lr-checkbox>` children: each carries its own `size`, so a group can hold options at
   * mixed sizes and an explicitly-sized option is never silently overridden by its container. Set
   * the same `size` on the children to scale the whole group.
   */
  size: LyraSize = 'm';

  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  @state() private touched = false;
  /** Whether the user has acted on this group yet, which is what gates the `user-valid`/
   *  `user-invalid` custom states. Deliberately separate from `touched` (which drives the visible
   *  `data-invalid`/`aria-invalid` pair and is set on blur alone): toggling a child checkbox is an
   *  interaction the instant it happens, and `reportValidity()` — what a submit attempt runs —
   *  counts as one too, exactly as it does for native `:user-invalid`. Not `@state`: nothing in
   *  `render()` reads it. */
  private hasInteracted = false;
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
  private childObserver?: MutationObserver;
  private childControllers = new Map<LyraCheckbox, ReactiveController>();

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

  private checkboxGroupOwner(element: Element): Element | null {
    const group = element.closest('lr-checkbox-group');
    if (!group) return null;
    let topLevelChild = element;
    while (topLevelChild.parentElement && topLevelChild.parentElement !== group) {
      topLevelChild = topLevelChild.parentElement;
    }
    if (topLevelChild.parentElement !== group) return null;
    const slot = topLevelChild.getAttribute('slot');
    return slot === 'label' || slot === 'hint' || slot === 'error' ? null : group;
  }

  private ownsCheckbox(element: Element): element is LyraCheckbox {
    return element.localName === 'lr-checkbox' && this.checkboxGroupOwner(element) === this;
  }

  private get boxes(): LyraCheckbox[] {
    return Array.from(this.querySelectorAll<LyraCheckbox>('lr-checkbox')).filter((box) => this.ownsCheckbox(box));
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
    this.reflectValidityStates();
  }

  /** Republishes the six validity custom states (`required`/`optional`, `valid`/`invalid`,
   *  `user-valid`/`user-invalid`) from whatever `ElementInternals` currently holds. Called from
   *  every path that can move either validity or the interaction flag. */
  private reflectValidityStates(): void {
    syncValidityStates(this.internals, { required: this.required, hasInteracted: this.hasInteracted });
  }

  private isOwnedCheckbox(target: EventTarget | null): target is LyraCheckbox {
    return target instanceof Element && this.ownsCheckbox(target);
  }

  private onChildEvent = (event: Event): void => {
    // Only the public events emitted by a directly-owned checkbox are translated. In particular,
    // leave nested groups and interactive content slotted inside a checkbox untouched.
    if (!this.isOwnedCheckbox(event.target)) return;
    event.stopImmediatePropagation();
    if (event.type !== 'change' || this.effectiveDisabled) return;
    this.hasInteracted = true;
    this.sync();
    this.emit('input', { value: this.value });
    this.emit('change', { value: this.value });
    this.emit('lr-change', { value: this.value });
  };

  private reconcileChildControllers(): void {
    const current = new Set(this.boxes);
    for (const [box, controller] of this.childControllers) {
      if (current.has(box)) continue;
      box.removeController(controller);
      this.childControllers.delete(box);
      // A checkbox removed from every group must not retain this group's disabled state. If it
      // moved directly into another group, that new owner is responsible for its own state. A
      // checkbox moved into this group's label/hint/error subtree still has this as its closest
      // group, but is no longer an option, so release the inherited disabled state here.
      const nextOwner = this.checkboxGroupOwner(box);
      if (!nextOwner || nextOwner === this) box.setGroupDisabled?.(false);
    }
    for (const box of current) {
      if (this.childControllers.has(box) || typeof box.addController !== 'function') continue;
      const controller: ReactiveController = {
        hostUpdated: () => {
          if (this.isConnected && this.ownsCheckbox(box)) this.sync();
        },
      };
      box.addController(controller);
      this.childControllers.set(box, controller);
    }
  }

  private onChildMutations = (records: MutationRecord[]): void => {
    if (records.some((record) => record.type === 'childList' || record.attributeName === 'slot')) {
      this.onSlotChange();
      return;
    }
    if (records.some((record) => this.isOwnedCheckbox(record.target))) this.sync();
  };

  private hasDirectSupportSlot(name: 'label' | 'hint' | 'error'): boolean {
    return Array.from(this.children).some((child) => child.getAttribute('slot') === name);
  }

  private onSlotChange = (): void => {
    this.hasLabelSlot = this.hasDirectSupportSlot('label');
    this.hasHintSlot = this.hasDirectSupportSlot('hint');
    this.hasErrorSlot = this.hasDirectSupportSlot('error');
    this.reconcileChildControllers();
    this.sync();
    this.propagateDisabled();
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('input', this.onChildEvent);
    this.addEventListener('change', this.onChildEvent);
    this.addEventListener('lr-change', this.onChildEvent);
    // Initialize light-DOM-derived state before the first render. Doing this in firstUpdated()
    // schedules a redundant follow-up update and triggers Lit's change-in-update warning.
    this.onSlotChange();
    this.childObserver = new MutationObserver(this.onChildMutations);
    this.childObserver.observe(this, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['checked', 'value', 'disabled', 'slot'],
    });
  }

  override disconnectedCallback(): void {
    this.removeEventListener('input', this.onChildEvent);
    this.removeEventListener('change', this.onChildEvent);
    this.removeEventListener('lr-change', this.onChildEvent);
    this.childObserver?.disconnect();
    this.childObserver = undefined;
    for (const [box, controller] of this.childControllers) {
      box.removeController(controller);
      box.setGroupDisabled?.(false);
    }
    this.childControllers.clear();
    super.disconnectedCallback();
  }

  protected override firstUpdated(): void {
    this.addEventListener('blur', () => { this.touched = true; this.hasInteracted = true; this.sync(); }, true);
  }

  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | null { return this.renderRoot?.querySelector('[part="options"]') ?? null; }
  get form(): HTMLFormElement | null { return this.internals.form; }
  get validity(): ValidityState { return this.internals.validity; }
  get validationMessage(): string { return this.internals.validationMessage; }
  get willValidate(): boolean { return this.internals.willValidate; }
  checkValidity(): boolean { return this.internals.checkValidity(); }
  reportValidity(): boolean {
    // A submit attempt runs this, and native `:user-invalid` starts matching at exactly that
    // point, so it counts as interaction for the `user-*` custom states. `checkValidity()`
    // deliberately does not: it is the silent query.
    this.hasInteracted = true;
    this.reflectValidityStates();
    return this.internals.reportValidity();
  }
  formResetCallback(): void { this.boxes.forEach((box) => { box.checked = box.hasAttribute('checked'); }); this.touched = false; this.hasInteracted = false; this.sync(); }
  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
    this.propagateDisabled();
    this.requestUpdate();
  }

  override render(): TemplateResult {
    const described = [this.hasHintSlot || this.hint ? this.hintId : '', this.hasErrorSlot || this.errorText ? this.errorId : ''].filter(Boolean).join(' ') || nothing;
    return html`<fieldset
      part="form-control"
      ?disabled=${this.effectiveDisabled}
      aria-label=${this.accessibleLabel || nothing}
      aria-describedby=${described}
      aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'}
    >
      <legend part="form-control-label" id=${this.labelId} ?hidden=${!this.label && !this.hasLabelSlot}>${this.label}<slot name="label" @slotchange=${this.onSlotChange}></slot>${this.required ? html`<span aria-hidden="true">*</span>` : nothing}</legend>
      <div part="options">
        <slot @slotchange=${this.onSlotChange}></slot>
      </div>
      <div part="hint" id=${this.hintId} ?hidden=${!this.hint && !this.hasHintSlot}><slot name="hint" @slotchange=${this.onSlotChange}>${this.hint}</slot></div>
      <div part="error" id=${this.errorId} ?hidden=${!this.errorText && !this.hasErrorSlot}><slot name="error" @slotchange=${this.onSlotChange}>${this.errorText}</slot></div>
    </fieldset>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-checkbox-group': LyraCheckboxGroup; } }
