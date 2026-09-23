import { html, nothing, type PropertyValues, type ReactiveController, type TemplateResult } from 'lit';
import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { installFormControlLabelSupport } from '../../../internal/form-control-labels.js';
installFormControlLabelSupport();
import {
  AnchoredValidityController,
  resolveValidityAnchor,
  VALIDITY_ANCHOR,
} from '../../../internal/anchored-validity.js';
import { syncValidityStates } from '../../../internal/custom-states.js';
import { hostAriaLabel, nextId, srOnly } from '../../../internal/a11y.js';
import {
  acquireAriaDescription,
  acquireResolvedAriaRelationship,
  type AriaDescriptionLease,
  type ResolvedAriaRelationshipLease,
} from '../../../internal/aria-controls.js';
import { devWarnOnce } from '../../../internal/dev-mode-attribute-warning.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraSize } from '../../../internal/variants.js';
import type { LyraOrientation } from '../../../internal/shared-unions.js';
import { styles } from './checkbox-group.styles.js';
import type { LyraCheckbox } from '../checkbox/checkbox.class.js';
import {
  attachInternalsSafely,
  createStringArrayFormDataState,
  getFormOwner,
  installCustomErrorProperty,
  isBarredFromValidation,
  readStringArrayFormDataState,
  setFormOwner,
  type FormOwnerValue,
} from '../../../internal/form-associated.js';
import {
  installInteractionOnInvalid,
  installInvalidEventAlias,
  withStaticValidityCheck,
} from '../../../internal/invalid-event-alias.js';
import { requestThenCommit } from '../../../internal/request-commit.js';
import { markVetoGuardWrite, VetoWriteGuard } from '../../../internal/veto-write-guard.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_checkboxGroupRequired, LYRA_DEFAULT_fieldRequired } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


const DUPLICATE_VALUE_WARNING_KEY = 'lyra-checkbox-group-duplicate-child-values';
const DUPLICATE_VALUE_WARNING =
  '<lr-checkbox-group>: duplicate child values make submitted FormData ambiguous; give each child a distinct value.';

/** The group-level proposal one owned checkbox's pending toggle translates into. */
export interface LyraCheckboxGroupToggleRequestDetail {
  /** The group value that would result from the proposed toggle, in DOM order. */
  readonly value: readonly string[];
  /** The group value as it stands while the request is dispatched. */
  readonly previousValue: readonly string[];
  /** The checkbox the user acted on. */
  readonly option: LyraCheckbox;
}

export interface LyraCheckboxGroupEventMap {
  'lr-invalid': CustomEvent<null>;
  input: CustomEvent<Readonly<{ value: readonly string[] }>>;
  change: CustomEvent<Readonly<{ value: readonly string[] }>>;
  'lr-change': CustomEvent<Readonly<{ value: readonly string[] }>>;
  'lr-checkbox-group-toggle-request': CustomEvent<
    LyraEventDetailSnapshot<LyraCheckboxGroupToggleRequestDetail>
  >;
}

export type CheckboxGroupOrientation = LyraOrientation;

/**
 * `<lr-checkbox-group>` — a form-associated group of `<lr-checkbox>` elements.
 * Long label/hint/error content and horizontal option labels remain contained in a 320px LTR or
 * RTL allocation; options wrap without shrinking their checkbox targets.
 * Its fieldset owns aggregate `aria-invalid` state and, while required, a localized hidden
 * requiredness description that composes with existing hint/error relationships without marking
 * every child checkbox required. A host `aria-describedby` is resolved onto that fieldset before
 * its own hint/error/required descriptions, preserving external guidance across the shadow
 * boundary. Host `aria-labelledby` is deliberately not projected: the native legend supplies the
 * group's visible label relationship.
 *
 * @customElement lr-checkbox-group
 * @slot - `<lr-checkbox>` children.
 * @slot label - Visible group label.
 * @slot hint - Supporting text.
 * @slot error - Custom validation message.
 * @event input - User selection changed.
 * @event change - User selection changed.
 * @event lr-change - User selection changed; detail is `{ value: string[] }`. Not fired for a
 * toggle a listener refused through `lr-checkbox-group-toggle-request`.
 * @event lr-checkbox-group-toggle-request - One owned checkbox is about to toggle;
 * `detail: { value, previousValue, option }` carries the group value that *would* result, the
 * value as it stands right now, and the checkbox the user acted on. Cancelable: calling
 * `preventDefault()` keeps the current state, so the option never flips at all rather than
 * flipping and snapping back -- which is what lets a host refuse "uncheck the last remaining
 * option" (`detail.value.length === 0`) with no flicker -- and no `input`/`change`/`lr-change`
 * follows. A listener may instead resolve the request by assigning the group's `value` itself
 * during the dispatch, which suppresses the option's own write the same way. The owned checkbox's
 * `lr-checkbox-toggle-request` is consumed and republished as this event, exactly as the group
 * already translates a child's `input`/`change`/`lr-change` into its own.
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
 * group's checkboxes, a blur, `reportValidity()`, or a submission attempt. Not after a silent
 * `checkValidity()` alone.
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
    fieldRequired: LYRA_DEFAULT_fieldRequired,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  // The proposal detail carries two value arrays; they are detached and frozen before dispatch so
  // a listener cannot mutate the group's own bookkeeping through them. `option` is the exception
  // the snapshot boundary keeps by identity -- naming which checkbox is toggling is the whole
  // point of that field, and a detached copy of it would name nothing.
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-checkbox-group-toggle-request',
  ]);
  protected static override readonly identityEventDetailProperties = Object.freeze({
    'lr-checkbox-group-toggle-request': Object.freeze(['option']),
  });

  static formAssociated = true;
  static override styles = [LyraElement.styles, sizes, srOnly, styles];

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
   *
   * When omitted, each checkbox keeps its authored size, matching the mirrored upstream default.
   * An explicit group size temporarily overrides every owned checkbox; removal/reparenting restores
   * the latest author value rather than leaving owner state behind.
   */
  size?: LyraSize;

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
   *  interaction the instant it happens, and so is interactive validation — `reportValidity()` and
   *  a submission attempt alike, via `installInteractionOnInvalid()` — exactly as it does for
   *  native `:user-invalid`. A silent `checkValidity()` alone never counts. Not `@state`: nothing
   *  in `render()` reads it. */
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
  private requiredDescriptionId = nextId('checkbox-group-required');
  private externalDescriptionLease?: ResolvedAriaRelationshipLease;
  private requiredDescriptionLease?: AriaDescriptionLease;
  private requiredDescriptionTarget?: HTMLElement;
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
  private pendingRestoreValues?: string[];
  /** A `value` assignment made before any checkbox child existed; applied on the next slotchange. */
  private pendingValues?: string[];
  private childObserver?: MutationObserver;
  private childObserverDocument?: Document;
  private childObserverGeneration = 0;
  private childControllers = new Map<LyraCheckbox, ReactiveController>();
  // Shared with every other veto point in this library: `emit()` is synchronous, so a host that
  // answers `lr-checkbox-group-toggle-request` by assigning `value` itself finishes before the
  // child's pending commit runs, and a before/after value compare reads "unchanged" whenever it
  // assigned the value the group already held. The guard records that a write happened.
  private toggleGuard = new VetoWriteGuard();
  private authoredChildSizes = new Map<LyraCheckbox, LyraSize>();

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

  /** Checked child values, in DOM order. Reading returns a frozen defensive snapshot, so mutating
   *  the returned array never changes the group -- assign a new array instead.
   *
   *  Assigning mirrors the array onto the owned checkboxes: a child whose `value` (defaulting to
   *  `'on'`) appears in the array becomes checked, every other child becomes unchecked, and
   *  duplicate entries check that many same-valued children. Assignment is controlled input, so it
   *  emits no `lr-change`; only user interaction does. Values naming no child are ignored.
   *
   *  This used to be a getter with no setter. Reading it was fine, but `.value=${...}` -- the
   *  binding every other form control in this library accepts -- compiles to a plain property
   *  assignment that `readonly` cannot catch at the binding site, so it threw
   *  "Cannot set property value ... which has only a getter" from inside lit-html during a *later*
   *  render, pointing at framework internals rather than the offending line. */
  get value(): readonly string[] { return Object.freeze([...this._value]); }

  set value(next: readonly string[] | null | undefined) {
    // Unconditional, including an assignment of the value already held, and before the deferral
    // below: the guard tracks that a write happened, not that a value differs. See
    // {@link toggleGuard}.
    markVetoGuardWrite(this.toggleGuard);
    const requested = Array.isArray(next)
      ? next.filter((entry): entry is string => typeof entry === 'string')
      : [];
    // Children may not have upgraded yet -- a template binding runs before slotted content is
    // assigned. Defer exactly like a form restore does, and let the slotchange pass apply it.
    if (this.boxes.length === 0) {
      this.pendingValues = requested;
      return;
    }
    this.pendingValues = undefined;
    this.applyValues(requested);
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
    this.internals = attachInternalsSafely(this);
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
    installCustomErrorProperty(this, () => this.validityController.customValidityMessage);
    installInvalidEventAlias(this, (init: { cancelable: true }) =>
      this.emit('lr-invalid', null, init));
    // Interactive validation (a submission attempt, `reportValidity()`) is interaction, exactly
    // like editing or blurring; `checkValidity()`'s own call below runs inside
    // `withStaticValidityCheck()` so this listener can tell the silent query apart from every
    // other path that raises the same `invalid` event.
    installInteractionOnInvalid(this, this.markInteracted);
  }

  private markInteracted = (): void => {
    if (this.hasInteracted) return;
    this.hasInteracted = true;
    this.reflectValidityStates();
  };

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
    return (
      element.localName === 'lr-checkbox' && this.checkboxGroupOwner(element) === this
    );
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
    for (const box of this.boxes) {
      if (!this.authoredChildSizes.has(box)) this.authoredChildSizes.set(box, box.size);
      if (this.size === undefined || this.size === null) {
        const authored = this.authoredChildSizes.get(box);
        if (authored !== undefined && box.size !== authored) box.size = authored;
        this.authoredChildSizes.delete(box);
      } else if (box.size !== this.size) {
        box.size = this.size;
      }
    }
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
      devWarnOnce(DUPLICATE_VALUE_WARNING_KEY, DUPLICATE_VALUE_WARNING);
      return;
    }
  }

  private sync(): void {
    const next = this.readValue();
    this.warnOnDuplicateValues();
    const old = this._value;
    this._value = next;
    this.requestUpdate('value', old);
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

  // Set around a loop that writes `checked`/`indeterminate` on multiple owned checkboxes in the
  // same task (applyValues(), formResetCallback()) so each child's own resulting
  // notifyCheckboxStateChange() call is a no-op instead of an independent, uncached O(N)
  // sync() -- the loop's own trailing sync() call already reconciles the aggregate once. An
  // isolated single-checkbox write outside such a loop still syncs immediately.
  private suppressCheckboxSync = false;

  /** @internal Same-task child-to-owner state transaction; emits no user event. */
  notifyCheckboxStateChange(checkbox: LyraCheckbox): void {
    if (this.suppressCheckboxSync) return;
    if (this.isConnected && this.ownsCheckbox(checkbox)) this.sync();
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
    const detail = (): Readonly<{ value: readonly string[] }> =>
      Object.freeze({ value: this.value });
    this.emit('input', detail());
    this.emit('change', detail());
    this.emit('lr-change', detail());
  };

  /** The group value that would result if `option` took `proposed`, in DOM order. */
  private projectedValue(option: LyraCheckbox, proposed: boolean): readonly string[] {
    return Object.freeze(
      this.boxes
        .filter((box) => (box === option ? proposed : box.checked))
        .map((box) => box.value ?? 'on'),
    );
  }

  private onChildToggleRequest = (event: Event): void => {
    // Same ownership boundary as `onChildEvent`: nested groups, and interactive content slotted
    // inside a checkbox, stay untouched.
    if (!this.isOwnedCheckbox(event.target)) return;
    // The group is this aggregate's public event surface, so the child's own request is consumed
    // here and republished below under the group's name -- exactly what already happens to the
    // child's `input`/`change`/`lr-change` (see `connectedCallback()` for why capture phase is
    // what makes that interception reliable). Stopping propagation does not clear the canceled
    // flag, so the veto this handler may apply still reaches the child that dispatched it.
    event.stopImmediatePropagation();
    // A disabled group propagates its state to every child, so a request should not reach here at
    // all; if one does, it is left to commit exactly as today's `change` translation leaves it,
    // rather than silently vetoed.
    if (this.effectiveDisabled) return;
    const option = event.target;
    const proposed = (event as CustomEvent<{ checked: boolean }>).detail.checked;
    let allowed = false;
    requestThenCommit({
      requestDetail: {
        value: this.projectedValue(option, proposed),
        previousValue: this.value,
        option,
      },
      emitRequest: (detail, init: { cancelable: true }) =>
        this.emit('lr-checkbox-group-toggle-request', detail, init),
      guard: this.toggleGuard,
      // The group writes nothing of its own here: committing means letting the child's pending
      // write run. A flag set inside `commit` is the only reading that stays correct alongside a
      // guard -- a listener that resolved the request by assigning `value` leaves
      // `defaultPrevented` false while still suppressing the commit.
      commit: () => {
        allowed = true;
      },
    });
    if (!allowed) event.preventDefault();
  };

  private reconcileChildControllers(): void {
    const current = new Set(this.boxes);
    for (const [box, controller] of this.childControllers) {
      if (current.has(box)) continue;
      box.removeController(controller);
      this.childControllers.delete(box);
      const authoredSize = this.authoredChildSizes.get(box);
      if (authoredSize !== undefined && box.size !== authoredSize) box.size = authoredSize;
      this.authoredChildSizes.delete(box);
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
    for (const record of records) {
      if (record.attributeName !== 'size' || !this.isOwnedCheckbox(record.target)) continue;
      const box = record.target;
      if (this.size !== undefined && box.size !== this.size) {
        this.authoredChildSizes.set(box, box.size);
      }
    }
    if (records.some((record) => record.attributeName === 'size' && this.isOwnedCheckbox(record.target))) {
      this.propagateSize();
    }
    if (records.some((record) => this.isOwnedCheckbox(record.target))) this.sync();
  };

  private hasDirectSupportSlot(name: 'label' | 'hint' | 'error'): boolean {
    return Array.from(this.children ?? []).some((child) => child.getAttribute('slot') === name);
  }

  private syncSupportSlotFlags(): void {
    this.hasLabelSlot = this.hasDirectSupportSlot('label');
    this.hasHintSlot = this.hasDirectSupportSlot('hint');
    this.hasErrorSlot = this.hasDirectSupportSlot('error');
  }

  private onSlotChange = (): void => {
    this.syncSupportSlotFlags();
    this.reconcileChildControllers();
    if (!this.applyPendingRestore() && !this.applyPendingValues()) this.sync();
    this.propagateDisabled();
    this.propagateSize();
  };

  /** Checks exactly the children named by `values`, matching duplicates one-for-one, then re-syncs
   *  the owned value/validity. Shared by the `value` setter and by form restore. */
  private applyValues(values: readonly string[]): void {
    const remaining = [...values];
    this.suppressCheckboxSync = true;
    try {
      for (const box of this.boxes) {
        const value = box.value ?? 'on';
        const index = remaining.indexOf(value);
        box.checked = index >= 0;
        if (index >= 0) remaining.splice(index, 1);
      }
    } finally {
      this.suppressCheckboxSync = false;
    }
    this.sync();
  }

  /** Applies a restore only once real option children exist; FACE callbacks may run before them. */
  private applyPendingRestore(): boolean {
    if (this.pendingRestoreValues === undefined || this.boxes.length === 0) return false;
    const values = this.pendingRestoreValues;
    this.pendingRestoreValues = undefined;
    // A restore is not user interaction, so it clears the interacted flags; a plain `value`
    // assignment deliberately does not.
    this.touched = false;
    this.hasInteracted = false;
    this.applyValues(values);
    return true;
  }

  /** Applies a `value` assignment that arrived before any checkbox child existed. */
  private applyPendingValues(): boolean {
    if (this.pendingValues === undefined || this.boxes.length === 0) return false;
    const values = this.pendingValues;
    this.pendingValues = undefined;
    this.applyValues(values);
    return true;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Capture phase, not the default bubble phase: a bubble-phase listener here would only
    // out-race a *bubble-phase* listener a consumer registers on this same node, and same-
    // node/same-phase listeners fire in registration order -- a Lit `@lr-change=${...}`
    // template binding attaches its listener while the element is still a disconnected
    // fragment, i.e. before this connectedCallback ever runs, so it would see the checkbox's
    // own raw (unstopped) event first. Capture always runs before any bubble-phase listener
    // on the same node regardless of registration order, so onChildEvent's
    // stopImmediatePropagation() reliably intercepts the child's event before it can ever
    // reach an ancestor listener -- this group's own, or one further up the tree.
    this.addEventListener('input', this.onChildEvent, { capture: true });
    this.addEventListener('change', this.onChildEvent, { capture: true });
    this.addEventListener('lr-change', this.onChildEvent, { capture: true });
    this.addEventListener('lr-checkbox-toggle-request', this.onChildToggleRequest, {
      capture: true,
    });
    // Initialize light-DOM-derived state before the first render. Doing this in firstUpdated()
    // schedules a redundant follow-up update and triggers Lit's change-in-update warning.
    if (this.hasUpdated) {
      // A reconnect is no longer a hydration boundary, so refresh immediately from the new tree.
      this.onSlotChange();
    } else {
      // Browser-only mounts still seed before their first paint. During hydration the base
      // helper defers only the light-DOM slot-presence flags until the server render (which is
      // handed no children at all) has been reproduced, so the hydrating client's first render
      // matches the server's markup instead of tearing it down. The rest of onSlotChange()'s
      // work is not render-gating state, so it still runs synchronously either way.
      this.seedFirstRenderState(() => this.syncSupportSlotFlags());
      this.reconcileChildControllers();
      if (!this.applyPendingRestore() && !this.applyPendingValues()) this.sync();
      this.propagateDisabled();
      this.propagateSize();
    }
    this.armChildObserver();
    if (this.hasUpdated) {
      this.syncRequiredDescription();
      this.syncExternalDescription();
    }
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
    this.releaseExternalDescription();
    this.releaseRequiredDescription();
    this.removeEventListener('input', this.onChildEvent, { capture: true });
    this.removeEventListener('change', this.onChildEvent, { capture: true });
    this.removeEventListener('lr-change', this.onChildEvent, { capture: true });
    this.removeEventListener('lr-checkbox-toggle-request', this.onChildToggleRequest, {
      capture: true,
    });
    this.resetChildObserver();
    for (const [box, controller] of this.childControllers) {
      box.removeController(controller);
      box.setGroupDisabled?.(false);
      const authoredSize = this.authoredChildSizes.get(box);
      if (authoredSize !== undefined && box.size !== authoredSize) box.size = authoredSize;
    }
    this.childControllers.clear();
    this.authoredChildSizes.clear();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.releaseExternalDescription();
    this.releaseRequiredDescription();
    this.resetChildObserver();
    if (this.isConnected && this.hasUpdated) {
      this.syncRequiredDescription();
      this.syncExternalDescription();
    }
  }

  private resetChildObserver(): void {
    this.childObserverGeneration += 1;
    this.childObserver?.disconnect();
    this.childObserver = undefined;
    this.childObserverDocument = undefined;
  }

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
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
    this.syncRequiredDescription();
    this.syncExternalDescription();
  }

  /** Resolves host-owned descriptions ahead of the fieldset's own form-control descriptions. */
  private syncExternalDescription(): void {
    const target = this.renderRoot.querySelector<HTMLElement>('fieldset');
    if (!target) {
      this.releaseExternalDescription();
      return;
    }
    if (!this.externalDescriptionLease) {
      this.externalDescriptionLease = acquireResolvedAriaRelationship(
        this,
        target,
        'aria-describedby',
      );
      return;
    }
    this.externalDescriptionLease.update(target);
  }

  private releaseExternalDescription(): void {
    this.externalDescriptionLease?.release();
    this.externalDescriptionLease = undefined;
  }

  /** Owns only the aggregate requiredness text; hint and error remain Lit's baseline relationship. */
  private syncRequiredDescription(): void {
    const target = this.renderRoot.querySelector<HTMLElement>('fieldset');
    const description = this.renderRoot.querySelector<HTMLElement>(`#${this.requiredDescriptionId}`);
    if (!this.required || !target || !description) {
      this.releaseRequiredDescription();
      return;
    }
    if (this.requiredDescriptionTarget !== target) {
      this.releaseRequiredDescription();
      this.requiredDescriptionTarget = target;
      this.requiredDescriptionLease = acquireAriaDescription(target, [description]);
      return;
    }
    this.requiredDescriptionLease?.update([description]);
  }

  private releaseRequiredDescription(): void {
    this.requiredDescriptionLease?.release();
    this.requiredDescriptionLease = undefined;
    this.requiredDescriptionTarget = undefined;
  }

  /** @internal Aggregate validation targets the first enabled checkbox's focusable semantic owner. */
  [VALIDITY_ANCHOR](): HTMLElement | null {
    const first = this.firstEnabledBox();
    return resolveValidityAnchor(first) ?? first ?? null;
  }
  get form(): HTMLFormElement | null { return getFormOwner(this.internals); }
  set form(owner: FormOwnerValue) { setFormOwner(this, owner); }
  getForm(): HTMLFormElement | null { return getFormOwner(this.internals); }
  get labels(): NodeList { return this.internals.labels; }
  get validity(): ValidityState { return this.internals.validity; }
  get validationMessage(): string { return this.internals.validationMessage; }
  get willValidate(): boolean { return this.internals.willValidate; }
  checkValidity(): boolean { return withStaticValidityCheck(this, () => this.internals.checkValidity()); }
  reportValidity(): boolean {
    // Marked explicitly rather than left to the `installInteractionOnInvalid()` listener: that
    // listener only fires when the check actually fails, but a `reportValidity()` call on an
    // already-valid control still counts as interaction (native `:user-valid` matches on it too).
    // A submission attempt reaches the same listener without ever calling this method at all --
    // it drives `ElementInternals` directly. `checkValidity()` deliberately marks neither path:
    // it is the silent query, and wraps its own call in `withStaticValidityCheck()` accordingly.
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

  /** Synchronous disabled truth, including a fieldset cascade not yet reflected by callbacks. */
  private get liveDisabled(): boolean {
    return this.effectiveDisabled || this.matches(':disabled');
  }

  private firstEnabledBox(): LyraCheckbox | undefined {
    return this.boxes.find((box) => !box.effectiveDisabled && !box.matches(':disabled'));
  }

  /** Moves focus to the first enabled checkbox. */
  override focus(options?: FocusOptions): void {
    if (this.liveDisabled) return;
    this.firstEnabledBox()?.focus(options);
  }

  /** Removes focus from whichever owned checkbox currently contains the deep active element. */
  override blur(): void {
    this.boxes.find((box) => box.matches(':focus-within'))?.blur();
  }

  /** Activates the first enabled checkbox, matching native `click()` rather than acting as focus. */
  override click(): void {
    if (this.liveDisabled) return;
    this.firstEnabledBox()?.click();
  }

  formResetCallback(): void {
    this.suppressCheckboxSync = true;
    try {
      this.boxes.forEach((box) => box.resetFromGroup());
    } finally {
      this.suppressCheckboxSync = false;
    }
    this.touched = false;
    this.hasInteracted = false;
    this.sync();
  }
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
    const hasError = this.hasErrorSlot || Boolean(this.errorText);
    const described = [hasHint ? this.hintId : '', hasError ? this.errorId : ''].filter(Boolean).join(' ') || nothing;
    const invalid = hasError || (this.touched && !this.internals.validity.valid);
    return html`<fieldset
      part="form-control"
      ?disabled=${this.effectiveDisabled}
      aria-label=${hostAriaLabel(this) ?? nothing}
      aria-describedby=${described}
      aria-invalid=${invalid ? 'true' : 'false'}
    >
      <legend part="form-control-label" id=${this.labelId} ?hidden=${!hasLabel}>${this.label}<slot name="label" @slotchange=${this.onSlotChange}></slot></legend>
      <div part="options form-control-input">
        <slot @slotchange=${this.onSlotChange}></slot>
      </div>
      <div part="hint" id=${this.hintId} ?hidden=${!hasHint}><slot name="hint" @slotchange=${this.onSlotChange}>${this.hint}</slot></div>
      <div part="error" id=${this.errorId} ?hidden=${!this.errorText && !this.hasErrorSlot}><slot name="error" @slotchange=${this.onSlotChange}>${this.errorText}</slot></div>
      <span
        id=${this.requiredDescriptionId}
        class="sr-only"
        data-required-description
        ?hidden=${!this.required}
      >${this.localize('checkboxGroupRequired')}</span>
    </fieldset>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-checkbox-group': LyraCheckboxGroup; } }
