import {
  html,
  nothing,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import { tag } from '../../../internal/prefix.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraSize } from '../../../internal/variants.js';
import { groupStyles } from './radio-group.styles.js';
import type { LyraRadio } from './radio.class.js';
import { dispatchNativeEvent, dispatchNativeInputEvent } from '../../../internal/native-event-relay.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { syncValidityStates } from '../../../internal/custom-states.js';
import {
  attachInternalsSafely,
  getFormOwner,
  isBarredFromValidation,
  setFormOwner,
  type FormOwnerValue,
} from '../../../internal/form-associated.js';
import { omittedEmptyStringConverter } from '../../../internal/converters.js';
import {
  isAccessibilitySubtreeExcluded,
  isAriaTrue,
} from '../../../internal/accessibility-visibility.js';
import { composedParentElement } from '../../../internal/active-element.js';
import { currentValidityValidator, type LyraFormValidator } from '../form-validator.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_radioRequired } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface LyraRadioGroupEventMap {
  input: InputEvent;
  change: Event;
  'lr-input': CustomEvent<{ value: string; radio: LyraRadio }>;
  'lr-change': CustomEvent<{ value: string; radio: LyraRadio }>;
  'lr-invalid': CustomEvent<undefined>;
}

export type RadioGroupOrientation = 'horizontal' | 'vertical';

// The two tags a group manages. `<lr-radio-button>` is a `LyraRadio` subclass, so every group
// behaviour applies to it unchanged -- but discovery is by local name (an `instanceof` check would
// force this module to import the subclass, and with it the button chrome, into every app that only
// uses plain radios), so both names have to be listed. Computed rather than frozen at module scope
// so the prefix stays the single source of truth.
const RADIO_TAGS = (): string[] => [tag('radio'), tag('radio-button')];

/**
 * `<lr-radio-group>` — a labeled, keyboard-navigable group of radios.
 *
 * @customElement lr-radio-group
 * @slot - Radio controls.
 * @slot label - Visible group label.
 * @slot hint - Supporting text.
 * @slot help-text - Shoelace alias for `hint`.
 * @slot error - Validation text.
 * @event {InputEvent} input - Native event fired from the group when its selected value changes.
 * @event {Event} change - Native event fired after `input` for the same group selection.
 * @event lr-input - Prefixed alias for `input`; `detail: { value, radio }`.
 * @event lr-change - A radio was selected. `detail: { value, radio }`.
 * @event lr-invalid - The group's owned validity control failed a validity check. Cancelable:
 * calling `preventDefault()` also cancels the native `invalid` event behind it, suppressing the
 * browser's own validation bubble so an app can present the failure its own way.
 * @cssstate required - Matches while `required` is set.
 * @cssstate optional - Matches while `required` is not set.
 * @cssstate valid - Matches while the aggregate value satisfies every constraint.
 * @cssstate invalid - Matches while the aggregate value fails a constraint.
 * @cssstate user-valid - Matches `valid` after user interaction or `reportValidity()`.
 * @cssstate user-invalid - Matches `invalid` after user interaction or `reportValidity()`.
 * @csspart base - The radiogroup wrapper.
 * @csspart form-control - Mapped form-control wrapper.
 * @csspart label - The group label.
 * @csspart form-control-label - Mapped name on the same group label.
 * @csspart radios - WA option collection.
 * @csspart form-control-input - Mapped name on the same option collection.
 * @csspart button-group - Shoelace segmented-option collection alias.
 * @csspart button-group__base - Shoelace alias on the same collection.
 * @csspart hint - Supporting text.
 * @csspart form-control-help-text - Shoelace name on the same supporting text.
 * @csspart error - Validation text.
 * @cssprop [--lr-radio-group-row-gap=calc(var(--lr-form-control-height) * 0.2)] - Vertical gap
 * between the group's label, options and messages, scaled by `size`.
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
export class LyraRadioGroup extends LyraElement<LyraRadioGroupEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    radioRequired: LYRA_DEFAULT_radioRequired,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  /** Public WA-compatible intrinsic validator catalog. */
  static get validators(): LyraFormValidator<LyraRadioGroup>[] {
    return [currentValidityValidator('required', 'disabled', 'value')];
  }
  static formAssociated = true;
  static override styles = [LyraElement.styles, sizes, groupStyles];
  static override properties = {
    name: { reflect: true, noAccessor: true, converter: omittedEmptyStringConverter },
    value: { attribute: false, noAccessor: true },
    defaultValue: {
      attribute: 'value',
      reflect: true,
      useDefault: true,
      noAccessor: true,
    },
    customError: { attribute: 'custom-error', reflect: true, noAccessor: true },
    required: { type: Boolean, reflect: true, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    orientation: { reflect: true },
    form: { noAccessor: true },
  };
  /**
   * Size of the group's own chrome, on the library's shared ladder. Accepts both spellings of every
   * tier — `2xs`/`xs`/`s`/`m`/`l`/`xl` and Web Awesome's `small`/`medium`/`large` — so migrating
   * either way is a tag rename. Scales the group's label type size and the gaps around and between
   * its options off the same `--lr-form-control-*` values the controls themselves use, and
   * projects the effective tier to owned options without rewriting their authored `size` state.
   */
  @property({ reflect: true }) size: LyraSize = 'm';
  /** Arrow-key axis and option layout. Left/right are mirrored under RTL in horizontal mode. */
  orientation: RadioGroupOrientation = 'vertical';
  @property() label = '';
  @property() hint = '';
  /** Shoelace alias for {@link hint}. `hint` wins when both are supplied. */
  @property({ attribute: 'help-text' }) helpText = '';
  /** Shoelace's separate spelling for the reset default. */
  @property({ attribute: 'default-value' }) private shoelaceDefaultValue = '';
  /** SSR slot-presence hints used before light-DOM assignment can be inspected. */
  @property({ type: Boolean, attribute: 'with-label' }) withLabel = false;
  @property({ type: Boolean, attribute: 'with-hint' }) withHint = false;
  @property({ attribute: 'error-text' }) errorText = '';
  /** Accessible-name override forwarded to the internal radiogroup. Attribute presence wins,
   * including an explicitly empty `aria-label`, which also suppresses visible-label linkage. */
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  @state() private hasLabelSlot = false;
  @state() private hasHintSlot = false;
  @state() private hasHelpTextSlot = false;
  @state() private hasErrorSlot = false;
  private readonly labelId = nextId('radio-group-label');
  private readonly hintId = nextId('radio-group-hint');
  private readonly errorId = nextId('radio-group-error');
  private managedRadios = new Set<LyraRadio>();
  private syncingRadios = false;
  private membershipObserver?: MutationObserver;
  private membershipObserverDocument?: Document;
  private membershipObserverGeneration = 0;
  private runResizeObserver?: ResizeObserver;
  private runProjectionFrame?: number;
  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  private _name = '';
  private _value = '';
  private _defaultValue = '';
  private _valueDirty = false;
  private reflectingDefaultValue = false;
  private reflectingCustomError = false;
  private _required = false;
  private _disabled = false;
  private _fieldsetDisabled = false;
  private hasInteracted = false;
  private pendingSelection?: string;
  private hadShoelaceDefaultValue = false;

  get name(): string { return this._name; }
  set name(next: string | null) {
    const old = this._name;
    this._name = next ?? '';
    if (this._name) this.setAttribute('name', this._name);
    else this.removeAttribute('name');
    this.syncFormState();
    this.requestUpdate('name', old);
  }

  get value(): string { return this._value; }
  set value(next: string | null) {
    this._valueDirty = true;
    this.selectValue(next ?? '');
  }

  /** Reflected current reset default; changing it never overwrites a dirty live selection. */
  get defaultValue(): string { return this._defaultValue; }
  set defaultValue(next: string) {
    if (this.reflectingDefaultValue) return;
    const old = this._defaultValue;
    this._defaultValue = next ?? '';
    this.reflectingDefaultValue = true;
    try {
      if (this._defaultValue) this.setAttribute('value', this._defaultValue);
      else this.removeAttribute('value');
    } finally {
      this.reflectingDefaultValue = false;
    }
    if (!this._valueDirty) {
      this.selectValue(this._defaultValue);
      this._valueDirty = false;
    }
    this.requestUpdate('defaultValue', old);
  }

  /** Consumer-supplied validation message reflected through `custom-error`. */
  get customError(): string | null {
    return this.validityController?.customValidityMessage || null;
  }
  set customError(next: string | null) {
    if (this.reflectingCustomError) return;
    const old = this.customError;
    const message = next ?? '';
    this.reflectingCustomError = true;
    try {
      if (next == null) this.removeAttribute('custom-error');
      else this.setAttribute('custom-error', message);
    } finally {
      this.reflectingCustomError = false;
    }
    this.setCustomValidity(message);
    this.requestUpdate('customError', old);
  }

  get required(): boolean { return this._required; }
  set required(next: boolean) {
    const old = this._required;
    this._required = Boolean(next);
    this.toggleAttribute('required', this._required);
    this.syncRadios();
    this.updateValidity();
    this.requestUpdate('required', old);
  }

  get disabled(): boolean { return this._disabled; }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    this.toggleAttribute('disabled', this._disabled);
    // `syncRadios()` recomputes validity itself, but only once radios exist -- an empty or
    // not-yet-upgraded group still has to drop its own barred violation synchronously.
    this.syncRadios();
    this.updateValidity();
    this.requestUpdate('disabled', old);
  }

  get effectiveDisabled(): boolean { return this.disabled || this._fieldsetDisabled; }
  get form(): HTMLFormElement | null { return getFormOwner(this.internals); }
  set form(owner: FormOwnerValue) { setFormOwner(this, owner); }
  getForm(): HTMLFormElement | null { return getFormOwner(this.internals); }
  get labels(): NodeList { return this.internals.labels; }
  get validity(): ValidityState { return this.internals.validity; }
  get validationMessage(): string { return this.internals.validationMessage; }
  get willValidate(): boolean { return this.internals.willValidate; }

  constructor() {
    super();
    this.internals = attachInternalsSafely(this);
    this.validityController = new AnchoredValidityController(
      this,
      this.internals,
      () => this[VALIDITY_ANCHOR](),
    );
    // `invalid` does not bubble, but its capture phase reaches the light-DOM group. Listening here
    // lets the group own the public alias while one of its radios temporarily owns native validity;
    // it also covers a host-targeted event when the group itself becomes the aggregate FACE owner.
    this.addEventListener('invalid', this.onInvalid, true);
    this.syncFormState();
    this.updateValidity();
  }

  private onInvalid = (event: Event): void => {
    const target = event.target;
    if (
      target !== this &&
      !((target as Partial<Node> | null)?.nodeType === 1 && this.ownsRadio(target as Element))
    ) {
      return;
    }
    // A real veto point, exactly as in `installInvalidEventAlias()`: cancelling the alias cancels
    // the native `invalid` behind it, so an app presenting the failure its own way can suppress
    // the browser's validation bubble.
    const alias = this.emit('lr-invalid', undefined, { cancelable: true });
    if (alias.defaultPrevented) event.preventDefault();
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncSupportSlots();
    this.syncRadios();
    this.armMembershipObserver();
    this.armRunResizeObserver();
    this.scheduleRunProjection();
  }

  private armRunResizeObserver(): void {
    this.runResizeObserver?.disconnect();
    const ResizeObserverCtor = this.ownerDocument.defaultView?.ResizeObserver;
    if (!ResizeObserverCtor || !this.isConnected) return;
    this.runResizeObserver = new ResizeObserverCtor(() => this.scheduleRunProjection());
    this.runResizeObserver.observe(this);
    for (const radio of this.radios()) this.runResizeObserver.observe(radio);
  }

  private scheduleRunProjection(): void {
    const ownerWindow = this.ownerDocument.defaultView;
    if (!ownerWindow || !this.isConnected || this.runProjectionFrame !== undefined) return;
    this.runProjectionFrame = ownerWindow.requestAnimationFrame(() => {
      this.runProjectionFrame = undefined;
      if (this.isConnected) this.projectButtonRuns();
    });
  }

  private isButtonRadio(radio: LyraRadio): boolean {
    return radio.localName === tag('radio-button') || radio.appearance === 'button';
  }

  private areActuallyAdjacent(first: LyraRadio, second: LyraRadio): boolean {
    const firstRect = first.getBoundingClientRect();
    const secondRect = second.getBoundingClientRect();
    if (firstRect.width <= 0 || firstRect.height <= 0 || secondRect.width <= 0 || secondRect.height <= 0) {
      return false;
    }
    // A new flex line is not a continuation even if its inline edges happen to align. Allow a
    // sub-pixel tolerance for zoom and engine rounding, and the one collapsed border already
    // projected on a subsequent ResizeObserver pass.
    const sameRow = Math.abs(firstRect.top - secondRect.top) <= 1 &&
      Math.abs(firstRect.bottom - secondRect.bottom) <= 1;
    if (!sameRow) return false;
    const direction = getComputedStyle(this).direction;
    const gap = direction === 'rtl'
      ? firstRect.left - secondRect.right
      : secondRect.left - firstRect.right;
    return gap >= -2 && gap <= 1;
  }

  private projectButtonRuns(): void {
    const radios = this.radios();
    const joinsPrevious = radios.map(() => false);
    if (this.orientation === 'horizontal') {
      for (let index = 1; index < radios.length; index += 1) {
        const previous = radios[index - 1]!;
        const current = radios[index]!;
        joinsPrevious[index] = this.isButtonRadio(previous) && this.isButtonRadio(current) &&
          this.areActuallyAdjacent(previous, current);
      }
    }
    for (let index = 0; index < radios.length; index += 1) {
      const joinsBefore = joinsPrevious[index] ?? false;
      const joinsAfter = joinsPrevious[index + 1] ?? false;
      const position = joinsBefore
        ? joinsAfter ? 'middle' : 'end'
        : joinsAfter ? 'start' : 'standalone';
      radios[index]!.setButtonRunPosition(position);
    }
  }

  private armMembershipObserver(): void {
    const ownerDocument = this.ownerDocument;
    if (!this.isConnected) return;
    if (this.membershipObserver && this.membershipObserverDocument === ownerDocument) return;
    this.resetMembershipObserver();
    const ownerWindow = ownerDocument.defaultView;
    const MutationObserverCtor = ownerWindow?.MutationObserver;
    if (!ownerWindow || !MutationObserverCtor) return;
    const generation = this.membershipObserverGeneration;
    const observer = new MutationObserverCtor(() => {
      if (
        this.membershipObserver !== observer ||
        this.membershipObserverDocument !== ownerDocument ||
        this.membershipObserverGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      ownerWindow.queueMicrotask(() => {
        if (
          this.membershipObserver !== observer ||
          this.membershipObserverDocument !== ownerDocument ||
          this.membershipObserverGeneration !== generation ||
          !this.isConnected ||
          this.ownerDocument !== ownerDocument
        ) {
          return;
        }
        this.syncRadios();
      });
    });
    this.membershipObserver = observer;
    this.membershipObserverDocument = ownerDocument;
    observer.observe(this, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: [
        'slot',
        'checked',
        'disabled',
        'value',
        'size',
        'appearance',
        'hidden',
        'inert',
        'aria-hidden',
        'aria-disabled',
        'class',
        'style',
      ],
    });
  }
  override disconnectedCallback(): void {
    this.resetMembershipObserver();
    this.runResizeObserver?.disconnect();
    this.runResizeObserver = undefined;
    const ownerWindow = this.ownerDocument.defaultView;
    if (ownerWindow && this.runProjectionFrame !== undefined) {
      ownerWindow.cancelAnimationFrame(this.runProjectionFrame);
    }
    this.runProjectionFrame = undefined;
    this.releaseRadios(this.managedRadios);
    this.managedRadios.clear();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.resetMembershipObserver();
  }

  private resetMembershipObserver(): void {
    this.membershipObserverGeneration += 1;
    this.membershipObserver?.disconnect();
    this.membershipObserver = undefined;
    this.membershipObserverDocument = undefined;
  }
  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (
      changed.has('shoelaceDefaultValue') &&
      (this.hasAttribute('default-value') || this.hadShoelaceDefaultValue)
    ) {
      this.defaultValue = this.shoelaceDefaultValue;
      this.hadShoelaceDefaultValue = this.hasAttribute('default-value');
    }
  }
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.syncRadios();
  }

  private syncSupportSlots(): void {
    this.hasLabelSlot = Array.from(this.children ?? []).some((element) => element.getAttribute('slot') === 'label');
    this.hasHintSlot = Array.from(this.children ?? []).some((element) => element.getAttribute('slot') === 'hint');
    this.hasHelpTextSlot = Array.from(this.children ?? []).some(
      (element) => element.getAttribute('slot') === 'help-text',
    );
    this.hasErrorSlot = Array.from(this.children ?? []).some((element) => element.getAttribute('slot') === 'error');
  }

  private radioGroupOwner(element: Element): Element | null {
    const group = element.closest(tag('radio-group'));
    if (!group) return null;
    let topLevelChild = element;
    while (topLevelChild.parentElement && topLevelChild.parentElement !== group) {
      topLevelChild = topLevelChild.parentElement;
    }
    if (topLevelChild.parentElement !== group) return null;
    const slot = topLevelChild.getAttribute('slot');
    return slot === 'label' || slot === 'hint' || slot === 'help-text' || slot === 'error' ? null : group;
  }

  /** @internal Whether this group owns the radio through its default option slot. */
  ownsRadio(element: Element): element is LyraRadio {
    return RADIO_TAGS().includes(element.localName) && this.radioGroupOwner(element) === this;
  }

  private radios(): LyraRadio[] {
    // The document-less Lit server host has no light-DOM query API. Non-default attributes still
    // run these synchronous setter paths during SSR, where an empty option collection is the only
    // state available; connection and slot reconciliation restore normal browser propagation.
    const querySelectorAll = (this as unknown as {
      querySelectorAll?: (selectors: string) => NodeListOf<Element>;
    }).querySelectorAll;
    if (typeof querySelectorAll !== 'function') return [];
    return [...querySelectorAll.call(this, RADIO_TAGS().join(','))].filter(
      (radio) => this.ownsRadio(radio) && typeof (radio as Partial<LyraRadio>).setGroupOwner === 'function',
    ) as LyraRadio[];
  }

  private isRadioAvailable(radio: LyraRadio): boolean {
    if (radio.effectiveDisabled || radio.matches(':disabled')) return false;
    for (let current: Element | null = radio; current; current = composedParentElement(current)) {
      if (
        isAccessibilitySubtreeExcluded(current) ||
        isAriaTrue(current.getAttribute('aria-disabled'))
      ) {
        return false;
      }
      if (current === this) break;
    }
    return true;
  }

  private selectValue(next: string): void {
    const desired = next ?? '';
    const radios = this.radios();
    if (radios.length === 0) {
      const old = this._value;
      this._value = desired;
      this.pendingSelection = desired;
      this.syncFormState();
      this.updateValidity();
      this.requestUpdate('value', old);
      return;
    }
    const match = radios.find((radio) => radio.value === desired);
    this.syncingRadios = true;
    try {
      for (const radio of radios) radio.checked = radio === match;
    } finally {
      this.syncingRadios = false;
    }
    this.pendingSelection = undefined;
    this.syncRadios(match);
  }

  private syncRadios(preferred?: LyraRadio): void {
    if (this.syncingRadios) return;
    this.syncingRadios = true;
    try {
      const radios = this.radios();
      const current = new Set(radios);
      this.releaseRadios([...this.managedRadios].filter((radio) => !current.has(radio)));
      for (const radio of radios) {
        radio.setGroupOwner(this);
      }
      this.managedRadios = current;
      this.armRunResizeObserver();
      for (const radio of radios) radio.setGroupDisabled(this.effectiveDisabled);
      const enabled = radios.filter((radio) => this.isRadioAvailable(radio));
      let checked = radios.filter((radio) => radio.checked);
      let checkedRadio: LyraRadio | undefined;
      if (this.pendingSelection !== undefined && radios.length > 0) {
        checkedRadio = radios.find((radio) => radio.value === this.pendingSelection);
        for (const radio of radios) radio.checked = radio === checkedRadio;
        checked = checkedRadio ? [checkedRadio] : [];
        this.pendingSelection = undefined;
      } else {
        checkedRadio = preferred?.checked && current.has(preferred)
          ? preferred
          : checked[checked.length - 1];
      }
      for (const radio of checked) {
        if (radio !== checkedRadio) radio.checked = false;
      }
      const tabbableRadio = checkedRadio && this.isRadioAvailable(checkedRadio)
        ? checkedRadio
        : enabled[0];
      for (const radio of radios) {
        radio.setGroupSize(this.size);
        radio.setGroupRequired(this.required && !this.effectiveDisabled);
        radio.setGroupTabbable(radio === tabbableRadio);
      }
      const oldValue = this._value;
      this._value = checkedRadio?.value ?? '';
      this.syncFormState();
      this.updateValidity();
      if (oldValue !== this._value) this.requestUpdate('value', oldValue);
      this.scheduleRunProjection();
    } finally {
      this.syncingRadios = false;
    }
  }
  private releaseRadios(radios: Iterable<LyraRadio>): void {
    for (const radio of radios) {
      radio.releaseGroupOwner(this);
      radio.setButtonRunPosition('standalone');
    }
  }
  /** @internal Reconciles one radio's synchronous DOM reparenting before observer delivery. */
  reconcileRadio(radio: LyraRadio): boolean {
    if (!this.ownsRadio(radio)) return false;
    this.syncRadios(radio.checked ? radio : undefined);
    return true;
  }
  /** @internal Releases one radio before a previous group's observer sees its removal. */
  releaseRadio(radio: LyraRadio): void {
    if (!this.managedRadios.has(radio)) return;
    this.releaseRadios([radio]);
    this.managedRadios.delete(radio);
    this.syncRadios();
  }
  /** @internal Reconciles silent programmatic, reset, and restored checked-state changes. */
  radioCheckedChanged(radio: LyraRadio): void {
    if (this.syncingRadios || !this.ownsRadio(radio)) return;
    this._valueDirty = true;
    this.syncRadios(radio.checked ? radio : undefined);
  }
  /** @internal */
  selectRadio(radio: LyraRadio): boolean {
    if (this.effectiveDisabled || !this.ownsRadio(radio) || !this.isRadioAvailable(radio)) return false;
    this._valueDirty = true;
    this.hasInteracted = true;
    this.syncingRadios = true;
    try {
      for (const candidate of this.radios()) candidate.checked = candidate === radio;
    } finally {
      this.syncingRadios = false;
    }
    this.syncRadios();
    dispatchNativeInputEvent(this);
    this.emit('lr-input', { value: radio.value, radio });
    dispatchNativeEvent(this, 'change');
    this.emit('lr-change', { value: radio.value, radio });
    return true;
  }
  private onKeyDown = (event: KeyboardEvent): void => {
    const arrows = this.orientation === 'horizontal'
      ? ['ArrowRight', 'ArrowLeft']
      : ['ArrowDown', 'ArrowUp'];
    if (![...arrows, 'Home', 'End'].includes(event.key)) return;
    if (this.effectiveDisabled) return;
    const radios = this.radios().filter((radio) => this.isRadioAvailable(radio));
    const current = event.target as LyraRadio;
    if (!this.isRadioAvailable(current)) return;
    const index = radios.indexOf(current);
    if (index < 0 || radios.length === 0) return;
    event.preventDefault();
    const rtl = this.effectiveDirection === 'rtl';
    const forward = this.orientation === 'vertical'
      ? event.key === 'ArrowDown'
      : (rtl ? event.key === 'ArrowLeft' : event.key === 'ArrowRight');
    const backward = this.orientation === 'vertical'
      ? event.key === 'ArrowUp'
      : (rtl ? event.key === 'ArrowRight' : event.key === 'ArrowLeft');
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? radios.length - 1
      : forward ? (index + 1) % radios.length : backward ? (index - 1 + radios.length) % radios.length : index;
    // safe: radios is non-empty (guarded above) and nextIndex is a modulo/clamp into range.
    const next = radios[nextIndex]!;
    next.focus();
    // Route through the radio's own activation path, not selectRadio() directly: that path is
    // what emits `input`/`change`. Committing here instead would fire only the group's
    // `lr-change`, so a consumer bound to the native-mirroring events would miss every keyboard
    // selection while still receiving them for click and Space. Native <input type=radio> fires
    // both on arrow navigation.
    next.activateFromGroup();
  };
  private onSlotChange = (event: Event): void => {
    const slot = event.target as HTMLSlotElement;
    const elements = slot.assignedElements({ flatten: true });
    if (slot.name === 'label') this.hasLabelSlot = elements.length > 0;
    if (slot.name === 'hint') this.hasHintSlot = elements.length > 0;
    if (slot.name === 'help-text') this.hasHelpTextSlot = elements.length > 0;
    if (slot.name === 'error') this.hasErrorSlot = elements.length > 0;
  };
  private onRadioSlotChange = (): void => {
    this.syncRadios();
    const ownerDocument = this.ownerDocument;
    const generation = this.membershipObserverGeneration;
    const ownerWindow = ownerDocument.defaultView;
    if (!ownerWindow) return;
    ownerWindow.queueMicrotask(() => {
      if (
        this.membershipObserverGeneration === generation &&
        this.isConnected &&
        this.ownerDocument === ownerDocument
      ) {
        this.syncRadios();
      }
    });
  };

  /** Moves focus to the selected enabled option, or the first enabled option when empty. */
  override focus(options?: FocusOptions): void {
    if (this.effectiveDisabled || this.matches(':disabled')) return;
    const enabled = this.radios().filter((radio) => this.isRadioAvailable(radio));
    (enabled.find((radio) => radio.checked) ?? enabled[0])?.focus(options);
  }

  /** Removes focus from whichever owned option currently contains the deep active element. */
  override blur(): void {
    this.radios().find((radio) => radio.matches(':focus-within'))?.blur();
  }

  /** Activates the selected/first enabled option, matching host click semantics on the internal
   *  radio collection rather than leaving `<lr-radio-group>` a no-op. */
  override click(): void {
    if (this.effectiveDisabled || this.matches(':disabled')) return;
    const enabled = this.radios().filter((radio) => this.isRadioAvailable(radio));
    (enabled.find((radio) => radio.checked) ?? enabled[0])?.click();
  }

  /** @internal Native validation is anchored to the owned radiogroup, not an individual option. */
  [VALIDITY_ANCHOR](): HTMLElement | null {
    return this.renderRoot?.querySelector('[part~="base"]') ?? null;
  }

  private syncFormState(): void {
    if (!this.internals) return;
    this.internals.setFormValue(this.name && this.value ? this.value : null, this.value);
  }

  /** Shared with every other form control: disabled (own or fieldset-cascaded) bars validation. */
  private get barredFromValidation(): boolean {
    return isBarredFromValidation(this, this.internals);
  }

  private updateValidity(): void {
    if (!this.validityController) return;
    // A barred group reports no violation at all, exactly like a native disabled control --
    // leaving `valueMissing` raised is what leaked `:state(invalid)` onto disabled required groups.
    const missing = !this.barredFromValidation && this.required && !this.value;
    this.validityController.setValidity(
      missing ? { valueMissing: true } : {},
      missing ? this.localize('radioRequired') : '',
    );
    this.reflectValidityStates();
  }

  /** Republishes the six validity custom states from whatever `ElementInternals` currently holds. */
  private reflectValidityStates(): void {
    syncValidityStates(this.internals, {
      required: this.required,
      hasInteracted: this.hasInteracted,
      barred: this.barredFromValidation,
    });
  }

  checkValidity(): boolean { return this.internals.checkValidity(); }
  reportValidity(): boolean {
    this.hasInteracted = true;
    this.updateValidity();
    return this.internals.reportValidity();
  }
  setCustomValidity(message: string = ''): void {
    this.validityController.setCustomValidity(message ?? '');
    this.reflectValidityStates();
    this.requestUpdate();
  }
  /** Clears consumer-supplied validity and restores the current required/value constraint. */
  resetValidity(): void {
    this.validityController.setCustomValidity('');
    this.updateValidity();
    this.requestUpdate();
  }
  formResetCallback(): void {
    this._valueDirty = false;
    this.pendingSelection = undefined;
    this.syncingRadios = true;
    try {
      for (const radio of this.radios()) radio.resetFromGroup();
    } finally {
      this.syncingRadios = false;
    }
    if (this.defaultValue) this.pendingSelection = this.defaultValue;
    this.hasInteracted = false;
    this.syncRadios();
  }
  formStateRestoreCallback(
    state: string | File | FormData | null,
    reason: 'autocomplete' | 'restore',
  ): void {
    void reason;
    this._valueDirty = true;
    this.hasInteracted = false;
    this.pendingSelection = typeof state === 'string' ? state : '';
    this.selectValue(this.pendingSelection);
  }
  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
    // Cascaded disablement bars constraint validation exactly like the group's own `disabled`.
    this.syncRadios();
    this.updateValidity();
    this.requestUpdate();
  }

  override render(): TemplateResult {
    const hasLabel = this.hasLabelSlot || Boolean(this.label) || this.withLabel;
    const hasAccessibleLabel = this.hasAttribute('aria-label') || Boolean(this.accessibleLabel);
    const hasHint = this.hasHintSlot || this.hasHelpTextSlot || Boolean(this.hint || this.helpText) || this.withHint;
    const hasError = this.hasErrorSlot || Boolean(this.errorText);
    const described = [hasHint ? this.hintId : '', hasError ? this.errorId : ''].filter(Boolean).join(' ') || nothing;
    return html`
      <div part="base" role="radiogroup"
        aria-label=${hasAccessibleLabel ? this.accessibleLabel : nothing}
        aria-labelledby=${!hasAccessibleLabel && hasLabel ? this.labelId : nothing}
        aria-describedby=${described}
        aria-required=${this.required ? 'true' : 'false'}
        aria-disabled=${this.effectiveDisabled ? 'true' : 'false'}
        aria-orientation=${this.orientation}
        aria-invalid=${!this.internals.validity.valid ? 'true' : 'false'}
        @keydown=${this.onKeyDown}>
        <div part="form-control">
          <div part="label form-control-label" id=${this.labelId} ?hidden=${!hasLabel}>${this.label}<slot name="label" @slotchange=${this.onSlotChange}></slot></div>
          <div part="radios form-control-input button-group button-group__base">
            <slot @slotchange=${this.onRadioSlotChange}></slot>
          </div>
          <div part="hint form-control-help-text" id=${this.hintId} ?hidden=${!hasHint}>
            ${this.hint || this.helpText}<slot name="hint" @slotchange=${this.onSlotChange}></slot
            ><slot name="help-text" @slotchange=${this.onSlotChange}></slot>
          </div>
          <div part="error" id=${this.errorId} ?hidden=${!hasError}>${this.errorText}<slot name="error" @slotchange=${this.onSlotChange}></slot></div>
        </div>
      </div>
    `;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-radio-group': LyraRadioGroup; } }
