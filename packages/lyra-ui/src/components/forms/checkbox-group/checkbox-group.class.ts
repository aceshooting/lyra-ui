import { html, nothing, type PropertyValues, type ReactiveController, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { syncValidityStates } from '../../../internal/custom-states.js';
import { nextId } from '../../../internal/a11y.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraSize } from '../../../internal/variants.js';
import { styles } from './checkbox-group.styles.js';
import type { LyraCheckbox } from '../checkbox/checkbox.class.js';
import { attachLegacyNoopInternalsSafely } from '../../../internal/legacy-noop-internals.js';
import {
  createStringArrayFormDataState,
  getFormOwner,
  installCustomErrorProperty,
  isBarredFromValidation,
  readStringArrayFormDataState,
  setFormOwner,
  type FormOwnerValue,
} from '../../../internal/form-associated.js';
import { installInvalidEventAlias } from '../../../internal/invalid-event-alias.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_checkboxGroupRequired, LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_open, LYRA_DEFAULT_restore } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


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
  'lr-invalid': CustomEvent<undefined>;
  input: CustomEvent<{ value: string[] }>;
  change: CustomEvent<{ value: string[] }>;
  'lr-change': CustomEvent<{ value: string[] }>;
}

export type CheckboxGroupOrientation = 'horizontal' | 'vertical';

/**
 * `<lr-checkbox-group>` — a form-associated group of `<lr-checkbox>` elements.
 * Long label/hint/error content and horizontal option labels remain contained in a 320px LTR or
 * RTL allocation; options wrap without shrinking their checkbox targets.
 *
 * @customElement lr-checkbox-group
 * @slot - `<lr-checkbox>` children.
 * @slot label - Visible group label.
 * @slot hint - Supporting text.
 * @slot error - Custom validation message.
 * @event input - User selection changed.
 * @event change - User selection changed.
 * @event lr-change - User selection changed; detail is `{ value: string[] }`.
 * @event lr-invalid - The aggregate checkbox group failed a validity check. Cancelable: calling
 * `preventDefault()` also cancels the native `invalid` event behind it, suppressing the
 * browser's own validation bubble so an app can present the failure its own way.
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
 * @csspart form-control-input - WA name for the same checkbox collection.
 * @csspart hint - Supporting text.
 * @csspart error - Validation message.
 * @cssprop [--lr-checkbox-group-row-gap=calc(var(--lr-form-control-height) * 0.1)] - Vertical gap
 * between the group's label, options and messages, scaled by `size`.
 * @cssprop [--lr-checkbox-group-option-gap=calc(var(--lr-form-control-height) * 0.2)] - Gap between
 * adjacent options, scaled by `size`.
 * @cssprop [--lr-checkbox-group-invalid-border=var(--lr-color-danger)] - Border around the option
 * collection while invalid chrome is visible.
 * @cssprop [--gap=var(--lr-checkbox-group-option-gap)] - WA-compatible option gap.
 * @cssprop [--lr-form-control-required-content=' *'] - The required marker appended to
 * `form-control-label` while `required` is set. Set it to `''` to suppress the marker, or to any
 * other quoted string (`' (required)'`, a localized word) to replace it.
 * @cssprop [--lr-form-control-required-color=var(--lr-color-danger)] - Required-marker color,
 * themeable independently of error text and invalid borders.
 * @cssprop [--lr-form-control-required-offset=0] - Inline space between the label text and the
 * required marker.
 * @status stable
 * @since 4.0.0
 */
export class LyraCheckboxGroup extends LyraElement<LyraCheckboxGroupEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    checkboxGroupRequired: LYRA_DEFAULT_checkboxGroupRequired,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    open: LYRA_DEFAULT_open,
    restore: LYRA_DEFAULT_restore,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static formAssociated = true;
  static override styles = [LyraElement.styles, sizes, styles];

  static override properties = {
    customError: { attribute: 'custom-error', reflect: true, noAccessor: true },
    name: { reflect: true, noAccessor: true },
    required: { type: Boolean, reflect: true, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    size: { reflect: true },
    orientation: { reflect: true },
    value: { attribute: false, noAccessor: true },
  };

  /**
   * Size of the group's own chrome, on the library's shared ladder. Accepts both spellings of every
   * tier — `2xs`/`xs`/`s`/`m`/`l`/`xl` and Web Awesome's `small`/`medium`/`large` — so migrating
   * either way is a tag rename. Scales the group's label type size and the gaps around and between
   * its options off the same `--lr-form-control-*` values the controls themselves use, and
   * propagates the selected tier to every owned checkbox so the aggregate control stays coherent.
   */
  size: LyraSize = 'm';

  /** Option flow and the matching WA public attribute. */
  orientation: CheckboxGroupOrientation = 'vertical';

  @property() label = '';
  @property() hint = '';
  /** SSR slot-presence hint for label content unavailable before hydration. */
  @property({ type: Boolean, attribute: 'with-label' }) withLabel = false;
  /** SSR slot-presence hint for hint content unavailable before hydration. */
  @property({ type: Boolean, attribute: 'with-hint' }) withHint = false;
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
  /** Consumer-supplied validation message reflected through `custom-error`. */
  declare customError: string | null;
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
  private pendingRestoreValues?: string[];
  private childObserver?: MutationObserver;
  private childObserverDocument?: Document;
  private childObserverGeneration = 0;
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
    // Disabling bars constraint validation, so the violation itself is recomputed here -- not just
    // the child boxes told about it.
    this.sync();
    this.requestUpdate('disabled', old);
  }

  constructor() {
    super();
    this.internals = attachLegacyNoopInternalsSafely(this);
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
    installCustomErrorProperty(this, () => this.validityController.customValidityMessage);
    installInvalidEventAlias(this, (init: { cancelable: true }) =>
      this.emit('lr-invalid', undefined, init));
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
    // Lit's server element shim intentionally omits light-DOM traversal. Attribute hydration still
    // invokes the synchronous `required`/`disabled` setters, so treat that pre-hydration shape as
    // an empty option collection; the browser-side connect/slot paths reconcile real children.
    const querySelectorAll = (this as unknown as {
      querySelectorAll?: (selectors: string) => NodeListOf<LyraCheckbox>;
    }).querySelectorAll;
    if (typeof querySelectorAll !== 'function') return [];
    return Array.from(querySelectorAll.call(this, 'lr-checkbox')).filter((box) => this.ownsCheckbox(box));
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

  private propagateSize(): void {
    this.boxes.forEach((box) => { box.size = this.size; });
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
    this.internals.setFormValue(
      this.name ? data : null,
      createStringArrayFormDataState(this.name, next),
    );
    // A barred group reports no violation at all, exactly like a native disabled control --
    // leaving `valueMissing` raised is what leaked `:state(invalid)` onto disabled required groups,
    // and with it the documented `:state(user-invalid)` error styling.
    if (!this.barredFromValidation && this.required && next.length === 0) this.validityController.setValidity({ valueMissing: true }, this.localize('checkboxGroupRequired'));
    else this.validityController.setValidity({});
    this.reflectValidityStates();
  }

  /** Shared with every other form control: disabled (own or fieldset-cascaded) bars validation. */
  private get barredFromValidation(): boolean {
    return isBarredFromValidation(this, this.internals);
  }

  /** Republishes the six validity custom states (`required`/`optional`, `valid`/`invalid`,
   *  `user-valid`/`user-invalid`) from whatever `ElementInternals` currently holds, and the
   *  `data-invalid` styling hook alongside them. Called from every path that can move either
   *  validity or the interaction flag. */
  private reflectValidityStates(): void {
    const barred = this.barredFromValidation;
    this.toggleAttribute('data-invalid', !barred && this.touched && !this.internals.validity.valid);
    syncValidityStates(this.internals, {
      required: this.required,
      hasInteracted: this.hasInteracted,
      barred,
    });
  }

  private isOwnedCheckbox(target: EventTarget | null): target is LyraCheckbox {
    return (
      (target as Partial<Node> | null)?.nodeType === 1 &&
      this.ownsCheckbox(target as Element)
    );
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
    if (records.some(
      (record) => record.attributeName === 'size' && this.isOwnedCheckbox(record.target),
    )) {
      this.propagateSize();
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
    if (!this.applyPendingRestore()) this.sync();
    this.propagateDisabled();
    this.propagateSize();
  };

  /** Applies a restore only once real option children exist; FACE callbacks may run before them. */
  private applyPendingRestore(): boolean {
    if (this.pendingRestoreValues === undefined || this.boxes.length === 0) return false;
    const remaining = [...this.pendingRestoreValues];
    this.pendingRestoreValues = undefined;
    for (const box of this.boxes) {
      const value = box.value ?? 'on';
      const index = remaining.indexOf(value);
      box.checked = index >= 0;
      if (index >= 0) remaining.splice(index, 1);
    }
    this.touched = false;
    this.hasInteracted = false;
    this.sync();
    return true;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('input', this.onChildEvent);
    this.addEventListener('change', this.onChildEvent);
    this.addEventListener('lr-change', this.onChildEvent);
    // Initialize light-DOM-derived state before the first render. Doing this in firstUpdated()
    // schedules a redundant follow-up update and triggers Lit's change-in-update warning.
    this.onSlotChange();
    this.armChildObserver();
  }

  private armChildObserver(): void {
    const ownerDocument = this.ownerDocument;
    if (!this.isConnected) return;
    if (this.childObserver && this.childObserverDocument === ownerDocument) return;
    this.resetChildObserver();
    const MutationObserverCtor = ownerDocument.defaultView?.MutationObserver;
    if (!MutationObserverCtor) return;
    const generation = this.childObserverGeneration;
    const observer = new MutationObserverCtor((records) => {
      if (
        this.childObserver !== observer ||
        this.childObserverDocument !== ownerDocument ||
        this.childObserverGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      this.onChildMutations(records);
    });
    this.childObserver = observer;
    this.childObserverDocument = ownerDocument;
    observer.observe(this, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['checked', 'value', 'disabled', 'size', 'slot'],
    });
  }

  override disconnectedCallback(): void {
    this.removeEventListener('input', this.onChildEvent);
    this.removeEventListener('change', this.onChildEvent);
    this.removeEventListener('lr-change', this.onChildEvent);
    this.resetChildObserver();
    for (const [box, controller] of this.childControllers) {
      box.removeController(controller);
      box.setGroupDisabled?.(false);
    }
    this.childControllers.clear();
    super.disconnectedCallback();
  }

  adoptedCallback(): void {
    this.resetChildObserver();
  }

  private resetChildObserver(): void {
    this.childObserverGeneration += 1;
    this.childObserver?.disconnect();
    this.childObserver = undefined;
    this.childObserverDocument = undefined;
  }

  protected override firstUpdated(): void {
    // Capture phase: a native `blur` does not bubble, but it is composed, so a capture listener
    // on the group still observes one fired deep inside an owned `<lr-checkbox>`'s shadow tree, as
    // well as the `blur` that checkbox's own `onBlur` relays from its host (bubbles + composed).
    this.addEventListener('blur', (event) => {
      // Disabling a focused checkbox -- its own `disabled`, or an ancestor `<fieldset disabled>`
      // cascading down -- makes the platform force-blur it, exactly like a focused native
      // input/select/textarea/button becoming disabled. That is not a real user interaction, and
      // marking the group touched for it could reenter an in-flight Lit update.
      //
      // `event.target` is the blurred `<lr-checkbox>` (shadow-retargeted from outside its tree, or
      // the direct target of its own relayed dispatch). Its live `:disabled` match is checked
      // rather than this library's own `effectiveDisabled` bookkeeping -- on either the box or the
      // group -- because the browser applies an ancestor fieldset's disabling, and the forced blur
      // that comes with it, natively and synchronously, *before* `formDisabledCallback()` (what
      // updates `effectiveDisabled`) runs; at exactly this moment `effectiveDisabled` would still
      // read `false`. `:disabled` has no such lag, and also covers a single child disabled directly
      // (independently of the group). Falls back to the group's own `effectiveDisabled` if the
      // target isn't an `Element` (defensive). Mirrors `<lr-input>`'s identical `onBlur` guard.
      const blurredControl = event.target as Element | null;
      const disabled = typeof blurredControl?.matches === 'function'
        ? blurredControl.matches(':disabled')
        : this.effectiveDisabled;
      if (!disabled) {
        this.touched = true;
        this.hasInteracted = true;
      }
      this.sync();
    }, true);
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('size')) this.propagateSize();
  }

  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | null { return this.renderRoot?.querySelector('[part~="options"]') ?? null; }
  get form(): HTMLFormElement | null { return getFormOwner(this.internals); }
  set form(owner: FormOwnerValue) { setFormOwner(this, owner); }
  getForm(): HTMLFormElement | null { return getFormOwner(this.internals); }
  get labels(): NodeList { return this.internals.labels; }
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

  /**
   * Sets or clears a consumer-supplied validation error — the standard channel for a server-side
   * rejection ("that combination of topics is not available") that no client-side constraint can
   * express. A non-empty `message` raises `customError` and becomes `validationMessage`, so the
   * group fails `checkValidity()`, blocks form submission, and matches `:state(invalid)`; `''`
   * clears it.
   *
   * Clearing restores the group's own computed validity rather than forcing it valid: a required
   * group with nothing checked stays `valueMissing`. The custom error also survives every
   * intrinsic recomputation in between (`sync()` re-runs on each child toggle, slot change and
   * `name`/`required` change) and a form reset, exactly like a native control — only another
   * `setCustomValidity('')` clears it.
   *
   * The message is caller-supplied content, so it is used verbatim and never localized here.
   */
  setCustomValidity(message: string): void {
    this.validityController.setCustomValidity(message ?? '');
    this.reflectValidityStates();
    // `aria-invalid` is rendered from `internals.validity`, which the call above just moved.
    this.requestUpdate();
  }

  private focusFirstControl(): void {
    const first = this.boxes.find((box) => !box.effectiveDisabled);
    first?.focus();
  }

  /** Forwards host clicks to the first enabled checkbox in the group. */
  override click(): void {
    this.focusFirstControl();
  }

  formResetCallback(): void { this.boxes.forEach((box) => box.resetFromGroup()); this.touched = false; this.hasInteracted = false; this.sync(); }
  formStateRestoreCallback(
    state: string | File | FormData | null,
    _mode?: 'restore' | 'autocomplete',
  ): void {
    this.pendingRestoreValues = readStringArrayFormDataState(state);
    this.applyPendingRestore();
  }
  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
    this.propagateDisabled();
    // Cascaded disablement bars constraint validation exactly like the group's own `disabled`.
    this.sync();
    this.requestUpdate();
  }

  override render(): TemplateResult {
    const hasLabel = this.hasLabelSlot || Boolean(this.label) || this.withLabel;
    const hasHint = this.hasHintSlot || Boolean(this.hint) || this.withHint;
    const described = [hasHint ? this.hintId : '', this.hasErrorSlot || this.errorText ? this.errorId : ''].filter(Boolean).join(' ') || nothing;
    return html`<fieldset
      part="form-control"
      ?disabled=${this.effectiveDisabled}
      aria-label=${this.accessibleLabel || nothing}
      aria-describedby=${described}
      aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'}
    >
      <legend part="form-control-label" id=${this.labelId} ?hidden=${!hasLabel}>${this.label}<slot name="label" @slotchange=${this.onSlotChange}></slot></legend>
      <div part="options form-control-input">
        <slot @slotchange=${this.onSlotChange}></slot>
      </div>
      <div part="hint" id=${this.hintId} ?hidden=${!hasHint}><slot name="hint" @slotchange=${this.onSlotChange}>${this.hint}</slot></div>
      <div part="error" id=${this.errorId} ?hidden=${!this.errorText && !this.hasErrorSlot}><slot name="error" @slotchange=${this.onSlotChange}>${this.errorText}</slot></div>
    </fieldset>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-checkbox-group': LyraCheckboxGroup; } }
