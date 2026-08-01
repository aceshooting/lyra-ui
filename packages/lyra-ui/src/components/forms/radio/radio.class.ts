import { html, nothing, type ComplexAttributeConverter, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { syncValidityStates } from '../../../internal/custom-states.js';
import { tag } from '../../../internal/prefix.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraSize } from '../../../internal/variants.js';
import { styles } from './radio.styles.js';
import { dispatchNativeEvent, relayNativeEvent } from '../../../internal/native-event-relay.js';

const omittedEmptyStringConverter: ComplexAttributeConverter<string> = {
  fromAttribute: (value) => value ?? '',
  toAttribute: (value) => value || null,
};

export interface LyraRadioEventMap {
  input: Event;
  change: Event;
  'lr-input': CustomEvent<{ checked: boolean; value: string }>;
  'lr-change': CustomEvent<{ checked: boolean; value: string }>;
  focus: FocusEvent;
  blur: FocusEvent;
  'lr-focus': CustomEvent<undefined>;
  'lr-blur': CustomEvent<undefined>;
}

interface RadioGroupController {
  disabled: boolean;
  ownsRadio?: (radio: LyraRadio) => boolean;
  radioCheckedChanged?: (radio: LyraRadio) => void;
  reconcileRadio?: (radio: LyraRadio) => boolean;
  releaseRadio?: (radio: LyraRadio) => void;
  selectRadio?: (radio: LyraRadio) => boolean;
}

/**
 * `<lr-radio>` — a form-associated single-choice control. Radios can be used
 * alone or inside `<lr-radio-group>`.
 *
 * Deliberately no hint/error chrome of its own -- the default slot already carries real, visible
 * label text (see `@slot` below), so a labeled-field frame built around `label`/`hint`/`errorText`
 * props has nothing to add here. A consumer needing shared hint/error messaging for a set of
 * options composes it once on the owning `<lr-radio-group>` (which does carry `hint`/`errorText`),
 * the same way a native radio `<fieldset>`/`<legend>` pairs with one externally-owned error node
 * shared across all its `<input type="radio">` children rather than one per option.
 *
 * @customElement lr-radio
 * @slot - Label text.
 * @event input - A standalone radio was selected; native-style and composed.
 * @event lr-input - Standalone prefixed compatibility alias for `input`.
 *   `detail: { checked, value }`.
 * @event change - A standalone radio was selected; native-style and composed.
 * @event lr-change - Standalone prefixed compatibility alias for `change`.
 *   `detail: { checked, value }`. An owning radio group emits its aggregate value-event sequence
 *   instead of any child value events.
 * @event focus - The internal radio received focus.
 * @event blur - The internal radio lost focus.
 * @event lr-focus - Prefixed compatibility alias for `focus`.
 * @event lr-blur - Prefixed compatibility alias for `blur`.
 * @cssstate required - Matches while the radio is required, either by its own `required` attribute
 * or by an owning `<lr-radio-group required>`. Style with `lr-radio:state(required)`.
 * @cssstate optional - Matches while it is neither — the complement of `required`.
 * @cssstate valid - Matches while the control satisfies its constraints, including any
 * `setCustomValidity()` error.
 * @cssstate invalid - Matches while it does not — from the very first render, before the user has
 * touched anything.
 * @cssstate user-valid - `valid`, but only after the user has interacted with this radio: selecting
 * it, blurring it, or a `reportValidity()` call (which is what a submit attempt runs).
 * @cssstate user-invalid - `invalid` after that same interaction. Style validation errors with this
 * rather than `invalid`: a pristine required radio is genuinely invalid, but colouring it red
 * before the user has done anything is hostile.
 * @csspart base - The interactive radio control.
 * @csspart circle - The circular radio indicator.
 * @csspart dot - The selected indicator.
 * @csspart label - The default slot wrapper.
 * @cssprop [--lr-radio-label-indent=calc(var(--lr-radio-circle-size) + var(--lr-space-s))] -
 * The inline distance from the control's start edge to the start of the label text, i.e. the
 * circle's own floor plus the gap next to it — so it tracks `size` along with the circle. Published
 * so a consumer composing per-option hint text under the label can align it without re-deriving that
 * formula from the shadow styles, and used as the source of the real gap so the two cannot drift.
 * Setting it on the element (or on `lr-radio` in your own stylesheet) moves the label; because
 * custom properties inherit down and not sideways, it is *not* readable from a sibling node in your
 * tree — align a sibling by computing the same formula from `--lr-theme-icon-button-size`,
 * `--lr-theme-form-control-height-*` and `--lr-theme-space-s`, which you control.
 * @cssprop [--lr-radio-checked-border-color=var(--lr-color-brand)] - Border color of `[part='circle']`
 * while `checked`. Retint just this control's checked ring without touching the shared
 * `--lr-color-brand` token every other component also reads.
 * @cssprop [--lr-radio-checked-dot-color=var(--lr-color-brand)] - Background of `[part='dot']`
 * while `checked`.
 * @cssprop [--lr-radio-circle-size=min(var(--lr-icon-button-size), calc(var(--lr-form-control-height) * 0.7))] -
 * Edge length of `[part='circle']`. Derived from the `size` tier's shared control height so a radio
 * lines up with an `<lr-input>`/`<lr-select>`/`<lr-button>` of the same `size`.
 * @cssprop [--lr-radio-dot-size=min(calc(var(--lr-radio-circle-size) * 0.5), calc(var(--lr-form-control-height) * 0.3))] -
 * Edge length of `[part='dot']`, capped at half the circle so it can never outgrow its ring.
 * @cssprop [--lr-radio-radius=var(--lr-radius-pill)] - Corner radius of the control's own chrome.
 * A circular indicator is fully round at every setting; `<lr-radio-button>` re-points this knob at
 * the shared control radius and swaps it for a pill when `pill` is set.
 */
export class LyraRadio extends LyraElement<LyraRadioEventMap> {
  static override styles = [LyraElement.styles, sizes, styles];
  static formAssociated = true;

  static override properties = {
    checked: { type: Boolean, reflect: true, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    name: { reflect: true, noAccessor: true, converter: omittedEmptyStringConverter },
    pill: { type: Boolean, reflect: true },
    required: { type: Boolean, reflect: true, noAccessor: true },
    size: { reflect: true },
    value: { reflect: true, noAccessor: true },
  };

  /**
   * Control size, on the library's shared ladder. Accepts both spellings of every tier —
   * `2xs`/`xs`/`s`/`m`/`l`/`xl` and Web Awesome's `small`/`medium`/`large` — so migrating either way
   * is a tag rename. Scales the indicator off the same `--lr-form-control-*` values
   * `<lr-input>`/`<lr-select>`/`<lr-button>` use, so controls of one `size` line up in a row. The
   * slotted label keeps the library's standard control-label type size at every tier; restyle it
   * through `::part(label)` if you want it to track the control.
   */
  size: LyraSize = 'm';

  /**
   * Rounds the control's own chrome into a pill instead of the shared control radius. A plain
   * `<lr-radio>`'s indicator is a circle at every setting, so this is visible on
   * `<lr-radio-button>`, which inherits this class and renders rectangular chrome; it is declared
   * here so both tags carry one property with one meaning.
   */
  pill = false;

  @state() private hasLabel = false;
  /** Whether the user has acted on this radio yet, which is what gates the `user-valid`/
   *  `user-invalid` custom states: a selection or a blur. A pristine required radio is genuinely
   *  invalid, but styling it as an error before the user has done anything is hostile, which is the
   *  entire reason the `user-*` pair exists. Not `@state`: nothing in `render()` reads it. */
  private hasInteracted = false;
  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  private _checked = false;
  private _disabled = false;
  private _required = false;
  private _name = '';
  private _value = 'on';
  private _fieldsetDisabled = false;
  private _groupDisabled = false;
  private _groupRequired = false;
  private _tabbable = true;
  private groupOwner: RadioGroupController | null = null;
  // What `form.reset()` restores to — captured once from the declarative
  // `checked` content attribute at first connect, mirroring
  // `<lr-checkbox>`'s identical `_defaultChecked`/`_defaultCaptured` pair.
  private _defaultChecked = false;
  private _defaultCaptured = false;

  get checked(): boolean { return this._checked; }
  set checked(value: boolean) {
    const old = this._checked;
    const next = Boolean(value);
    if (old === next) return;
    this._checked = next;
    this.syncFormState();
    this.requestUpdate('checked', old);
    if (this.isConnected) this.group()?.radioCheckedChanged?.(this);
  }
  get disabled(): boolean { return this._disabled; }
  set disabled(value: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(value);
    this.toggleAttribute('disabled', this._disabled);
    this.requestUpdate('disabled', old);
  }
  get required(): boolean { return this._required; }
  set required(value: boolean) {
    const old = this._required;
    this._required = Boolean(value);
    this.toggleAttribute('required', this._required);
    this.updateValidity();
    this.requestUpdate('required', old);
  }
  get name(): string { return this._name; }
  set name(value: string) {
    const old = this._name;
    const next = value ?? '';
    if (old === next) {
      if (!next && this.hasAttribute('name')) this.removeAttribute('name');
      return;
    }
    this._name = next;
    if (next) {
      if (this.getAttribute('name') !== next) this.setAttribute('name', next);
    } else if (this.hasAttribute('name')) {
      this.removeAttribute('name');
    }
    this.requestUpdate('name', old);
  }
  get value(): string { return this._value; }
  set value(value: string) {
    const old = this._value;
    const next = value ?? 'on';
    if (old === next) return;
    this._value = next;
    if (value == null) {
      if (this.hasAttribute('value')) this.removeAttribute('value');
    } else if (this.getAttribute('value') !== next) {
      this.setAttribute('value', next);
    }
    this.syncFormState();
    this.requestUpdate('value', old);
  }
  get effectiveDisabled(): boolean {
    return this.disabled || this._fieldsetDisabled || Boolean(this.currentGroup()?.disabled);
  }
  get effectiveRequired(): boolean {
    return this.required || (this.currentGroup() ? this._groupRequired : false);
  }
  get form(): HTMLFormElement | null { return this.internals.form; }
  get validity(): ValidityState { return this.internals.validity; }
  get validationMessage(): string { return this.internals.validationMessage; }
  get willValidate(): boolean { return this.internals.willValidate; }

  constructor() {
    super();
    this.internals = this.safeAttachInternals();
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
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

  /** @internal Matches on a part *token*, not the whole attribute: `<lr-radio-button>` encodes
   *  `checked`/`disabled` into the same part name (state after `::part()` never matches, so it has
   *  to live there), and an exact `[part="base"]` would silently stop finding the anchor the moment
   *  a second token appeared -- taking `click()`, `focus()` and validity anchoring with it. */
  [VALIDITY_ANCHOR](): HTMLElement | null {
    return this.renderRoot?.querySelector('[part~="base"]') ?? null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.hasLabel = Array.from(this.childNodes).some((node) => (node.textContent ?? '').trim().length > 0);
    if (!this._defaultCaptured) {
      this._defaultCaptured = true;
      this._defaultChecked = this.hasAttribute('checked');
    }
    this.updateValidity();
    this.group();
  }

  formResetCallback(): void {
    this.hasInteracted = false;
    this.checked = this._defaultChecked;
    this.reflectValidityStates();
  }
  formStateRestoreCallback(
    state: string | File | FormData | null,
    _mode?: 'restore' | 'autocomplete',
  ): void {
    const old = this._checked;
    this._checked = state === 'checked';
    this.syncFormState();
    this.requestUpdate('checked', old);
    if (this.isConnected) this.group()?.radioCheckedChanged?.(this);
  }
  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
    this.requestUpdate();
  }

  private updateValidity(): void {
    this.validityController.setValidity(
      this.effectiveRequired && !this.checked ? { valueMissing: true } : {},
      this.localize('radioRequired'),
    );
    this.reflectValidityStates();
  }

  /** Republishes the six validity custom states (`required`/`optional`, `valid`/`invalid`,
   *  `user-valid`/`user-invalid`) from whatever `ElementInternals` currently holds. `required`
   *  here is the EFFECTIVE one -- a radio inside a `required` `<lr-radio-group>` is required even
   *  with no attribute of its own, and that is what its validity is already computed from. */
  private reflectValidityStates(): void {
    syncValidityStates(this.internals, {
      required: this.effectiveRequired,
      hasInteracted: this.hasInteracted,
    });
  }
  /** @internal Driven by an owning `<lr-radio-group>`; released when the radio leaves the group's control. */
  setGroupDisabled(value: boolean): void {
    if (this._groupDisabled === value) return;
    this._groupDisabled = value;
    this.requestUpdate();
  }
  /** @internal Driven by an owning `<lr-radio-group>`; released when the radio leaves the group's control. */
  setGroupRequired(value: boolean): void {
    if (this._groupRequired === value) return;
    this._groupRequired = value;
    this.updateValidity();
    this.requestUpdate();
  }
  /** @internal Roving-tabindex state driven by an owning `<lr-radio-group>`. */
  setGroupTabbable(value: boolean): void {
    if (this._tabbable === value) return;
    this._tabbable = value;
    this.requestUpdate();
  }
  /** @internal Claims this radio for one owning `<lr-radio-group>`. */
  setGroupOwner(owner: RadioGroupController): void {
    if (this.groupOwner === owner) return;
    this.groupOwner?.releaseRadio?.(this);
    this.groupOwner = owner;
  }
  /** @internal Releases state imposed by the specified owning `<lr-radio-group>`. */
  releaseGroupOwner(owner: RadioGroupController, authorName: string): void {
    if (this.groupOwner !== owner) return;
    this.groupOwner = null;
    this.name = authorName;
    this.setGroupRequired(false);
    this.setGroupDisabled(false);
    this.setGroupTabbable(true);
  }

  /** Whether the radio currently satisfies its constraints — the silent query, so it deliberately
   *  does not count as interaction for the `user-*` custom states. */
  checkValidity(): boolean {
    return this.internals.checkValidity();
  }

  /** `checkValidity()`, plus the browser's own validation UI on failure. */
  reportValidity(): boolean {
    // A submit attempt runs this, and native `:user-invalid` starts matching at exactly that
    // point, so it counts as interaction for the `user-*` custom states.
    this.hasInteracted = true;
    this.reflectValidityStates();
    return this.internals.reportValidity();
  }

  /**
   * Sets or clears a consumer-supplied validation error — the standard channel for a server-side
   * rejection ("that plan is no longer available") that no client-side constraint can express. A
   * non-empty `message` raises `customError` and becomes `validationMessage`, so the control fails
   * `checkValidity()`, blocks form submission, and matches `:state(invalid)`; `''` clears it.
   *
   * Clearing restores the control's own computed validity rather than forcing it valid: a
   * required-and-unselected radio whose custom error is cleared stays `valueMissing`. The custom
   * error also survives every intrinsic recomputation in between (each selection, and every
   * group-driven `required` change, re-runs `updateValidity()`) and a form reset, exactly like a
   * native control — only another `setCustomValidity('')` clears it.
   *
   * This lives on the radio rather than on `<lr-radio-group>` because the group is not itself
   * form-associated: it designates one member as the group's validity owner and that radio is what
   * participates in the owning form.
   *
   * The message is caller-supplied content, so it is used verbatim and never localized here.
   */
  setCustomValidity(message: string): void {
    this.validityController.setCustomValidity(message ?? '');
    this.reflectValidityStates();
    this.requestUpdate();
  }

  override click(): void {
    if (!this.effectiveDisabled) this[VALIDITY_ANCHOR]()?.click();
  }
  override focus(options?: FocusOptions): void {
    if (!this.effectiveDisabled) this[VALIDITY_ANCHOR]()?.focus(options);
  }
  override blur(): void {
    this[VALIDITY_ANCHOR]()?.blur();
  }
  private syncFormState(): void {
    this.internals.setFormValue(this.checked ? this.value : null, this.checked ? 'checked' : 'unchecked');
    this.updateValidity();
  }
  private currentGroup(): RadioGroupController | null {
    const group = this.closest(tag('radio-group')) as (HTMLElement & RadioGroupController) | null;
    return group?.isConnected && group.ownsRadio?.(this) ? group : null;
  }
  private group(): RadioGroupController | null {
    const group = this.currentGroup();
    if (!group) {
      this.groupOwner?.releaseRadio?.(this);
      return null;
    }
    this.setGroupOwner(group);
    group.reconcileRadio?.(this);
    return group;
  }
  /** @internal Group-driven activation (arrow keys). Shares the click/Space path so every
   *  modality emits the same native/prefixed value-event sequence from the owning group. */
  activateFromGroup(): void {
    this.select();
  }

  private select(): void {
    const group = this.group();
    if (this.effectiveDisabled || this.checked) return;
    this.hasInteracted = true;
    if (group) {
      if (!group.selectRadio?.(this)) return;
      return;
    }
    this.checked = true;
    dispatchNativeEvent(this, 'input');
    this.emit('lr-input', { checked: true, value: this.value });
    dispatchNativeEvent(this, 'change');
    this.emit('lr-change', { checked: true, value: this.value });
  }
  /** Roving-tabindex state an owning group imposes; `<lr-radio-button>` reads it for its own
   *  `tabindex`, which is the only reason it is not private. */
  protected get groupTabbable(): boolean { return this._tabbable; }

  // Protected rather than private so `<lr-radio-button>` can render different chrome around the
  // identical activation contract instead of reimplementing (and drifting from) it.
  protected onClick = (): void => this.select();
  protected onKeyDown = (event: KeyboardEvent): void => {
    if (this.effectiveDisabled) return;
    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      this.select();
    }
  };
  protected onFocus = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
    this.emit('lr-focus');
  };
  protected onBlur = (event: FocusEvent): void => {
    this.hasInteracted = true;
    this.reflectValidityStates();
    relayNativeEvent(this, event);
    this.emit('lr-blur');
  };
  private onSlotChange = (event: Event): void => {
    this.hasLabel = (event.target as HTMLSlotElement).assignedNodes({ flatten: true })
      .some((node) => (node.textContent ?? '').trim().length > 0);
  };

  override render(): TemplateResult {
    return html`
      <span part="base" role="radio" tabindex=${this.effectiveDisabled || !this._tabbable ? '-1' : '0'}
        aria-checked=${this.checked ? 'true' : 'false'}
        aria-disabled=${this.effectiveDisabled ? 'true' : 'false'}
        aria-required=${this.effectiveRequired ? 'true' : 'false'}
        aria-label=${this.getAttribute('aria-label') || nothing}
        @click=${this.onClick} @keydown=${this.onKeyDown} @focus=${this.onFocus} @blur=${this.onBlur}>
        <span part="circle">${this.checked ? html`<span part="dot"></span>` : nothing}</span>
        <span part="label" ?hidden=${!this.hasLabel}><slot @slotchange=${this.onSlotChange}></slot></span>
      </span>
    `;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-radio': LyraRadio; } }
