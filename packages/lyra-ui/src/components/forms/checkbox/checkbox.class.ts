import { html, svg, nothing, type TemplateResult, type SVGTemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { setCustomState, syncValidityStates } from '../../../internal/custom-states.js';
import { syncAriaDescribedByElements } from '../../../internal/aria-controls.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraSize } from '../../../internal/variants.js';
import { styles } from './checkbox.styles.js';
import { dispatchNativeEvent, relayNativeEvent } from '../../../internal/native-event-relay.js';
import { installInvalidEventAlias } from '../../../internal/invalid-event-alias.js';
import { omittedEmptyStringConverter } from '../../../internal/converters.js';
import { hasRealContent } from '../../../internal/a11y.js';
import {
  attachInternalsSafely,
  getFormOwner,
  installCustomErrorProperty,
  isBarredFromValidation,
  setFormOwner,
  type FormOwnerValue,
} from '../../../internal/form-associated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_checkboxRequired, LYRA_DEFAULT_fieldRequired } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


// Mirrors the shared icon set's viewBox/stroke conventions
// (internal/icons.ts's chevronIcon()/closeIcon()/etc.) without importing
// that module -- internal/icons.ts is kept a small, closed set of glyphs
// reused across many components, and this checkmark is specific to this
// control's own box -- so the glyph still reads as part of the same visual
// language as the rest of the library's inline icons.
const GLYPH_VIEW_BOX = '0 0 24 24';
const GLYPH_STROKE_WIDTH = '1.75';

function checkmarkGlyph(): SVGTemplateResult {
  return svg`
    <svg
      part="checkmark checked-icon"
      width="1em"
      height="1em"
      viewBox=${GLYPH_VIEW_BOX}
      fill="none"
      stroke="currentColor"
      stroke-width=${GLYPH_STROKE_WIDTH}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    ><polyline points="5 12.5 10 17.5 19 6.5"></polyline></svg>
  `;
}

/** The indeterminate/mixed-state dash — takes priority over the checkmark. */
function indeterminateGlyph(): SVGTemplateResult {
  return svg`
    <svg
      part="checkmark indeterminate-icon"
      width="1em"
      height="1em"
      viewBox=${GLYPH_VIEW_BOX}
      fill="none"
      stroke="currentColor"
      stroke-width=${GLYPH_STROKE_WIDTH}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    ><line x1="5" y1="12" x2="19" y2="12"></line></svg>
  `;
}

export interface LyraCheckboxEventMap {
  input: Event;
  change: Event;
  'lr-input': CustomEvent<{ checked: boolean }>;
  'lr-change': CustomEvent<{ checked: boolean }>;
  focus: FocusEvent;
  blur: FocusEvent;
  'lr-focus': CustomEvent<undefined>;
  'lr-blur': CustomEvent<undefined>;
  'lr-invalid': CustomEvent<undefined>;
}
/**
 * `<lr-checkbox>` — a boolean form control. Structurally the same idea as
 * `<lr-switch>` (form-associated via `ElementInternals`, click and
 * Space both toggle) but with checkbox semantics: `role="checkbox"` +
 * an `aria-checked` that can also be `"mixed"`, and a visual box/checkmark
 * instead of a track/thumb.
 *
 * `checked` is not a plain string, so this attaches `ElementInternals`
 * directly and implements its own `updateValidity()` rather than using the
 * `FormAssociated` mixin — see `<lr-combobox>` for the same
 * direct-`ElementInternals` shape with a non-string value.
 *
 * Supporting text is optional through either Web Awesome's `hint` spelling or Shoelace's
 * `help-text` spelling. `errorText` and the `error` slot provide the matching owned error surface;
 * all rendered messages share an additive described-by relationship with external host ids.
 * Deliberately no separate top-of-field label property/slot/part: the default slot already is the
 * visible, clickable checkbox label, matching `lr-switch`'s form-control shape.
 * Default-slot presence follows flattened rendered assignment and updates when forwarded content
 * changes. Visual elements, including decorative `aria-hidden` icons, keep the label wrapper;
 * accessible naming remains the browser's slot semantics unless a host `aria-label` is present.
 * The public label and supporting/error text wrap at arbitrary boundaries in constrained rows;
 * the fixed checkbox square and shared interactive target never shrink to make that fit.
 *
 * @customElement lr-checkbox
 * @slot - Label text, rendered next to the box. Clicking it toggles the
 * checkbox, the same as clicking a native checkbox's associated `<label>`.
 * If left empty, set `aria-label` on the host so the control still has an accessible name. Host
 * `aria-label` is forwarded by presence, including an explicitly empty value. Only non-focusable
 * content should be slotted here: this slot renders inside `[part="base checkbox"]`, which carries
 * `role="checkbox"` -- axe-core's `nested-interactive` rule forbids a focusable descendant of that
 * role (e.g. a Terms-of-Service `<a href>`), the same reason `lr-conversation-item` documents for
 * its own `excerpt`/`meta` slots.
 * @slot hint - Web Awesome-compatible supporting text.
 * @slot help-text - Shoelace-compatible supporting text; the same surface as `hint`.
 * @slot error - Custom error content on the owned error surface.
 * A host `aria-describedby` attribute is resolved onto the internal `role="checkbox"` through
 * `ariaDescribedByElements` so externally-owned descriptions remain valid across the shadow
 * boundary.
 * @event input - The user toggled the checkbox; bubbling and composed like a native form event.
 * @event lr-input - Prefixed compatibility alias for `input`; `detail: { checked }`.
 * @event change - Fired immediately after `input` for the same user toggle.
 * @event lr-change - Compatibility alias fired after `input` and `change` (click or Space).
 * `detail: { checked }`. Not fired for a programmatic `.checked` assignment.
 * @event focus - Re-dispatched from the internal control as a bubbling, composed event.
 * @event blur - Re-dispatched from the internal control as a bubbling, composed event.
 * @event lr-focus - Prefixed compatibility alias for `focus`.
 * @event lr-blur - Prefixed compatibility alias for `blur`.
 * @event lr-invalid - The checkbox failed a validity check. Cancelable: calling
 * `preventDefault()` also cancels the native `invalid` event behind it, suppressing the
 * browser's own validation bubble so an app can present the failure its own way.
 * @cssstate required - Matches while `required` is set. Style with `lr-checkbox:state(required)`.
 * @cssstate optional - Matches while `required` is not set — the complement of `required`.
 * @cssstate valid - Matches while the control satisfies its constraints, including any
 * `setCustomValidity()` error.
 * @cssstate invalid - Matches while it does not — from the very first render, before the user has
 * touched anything.
 * @cssstate user-valid - `valid`, but only after the user has interacted: a toggle, a blur, or a
 * `reportValidity()` call (which is what a submit attempt runs).
 * @cssstate user-invalid - `invalid` after that same interaction. Style validation errors with this
 * rather than `invalid`: a pristine required checkbox is genuinely invalid, but colouring it red
 * before the user has done anything is hostile.
 * @cssstate checked - Matches while the live checked state is true.
 * @cssstate disabled - Matches while disabled directly or by an ancestor fieldset.
 * @cssstate indeterminate - Matches while the visual mixed state is true.
 * @csspart form-control - The outer wrapper around the checkbox, error, and hint.
 * @csspart base - Compatibility name for the interactive control; use `checkbox`.
 * @csspart checkbox - The whole interactive control (`role="checkbox"`); wraps the box and label.
 *   It is the same node as `base` and retains the shared `--lr-icon-button-size` minimum target at
 *   every size tier, including when the label slot is empty.
 * @csspart box - The small square that shows the checkmark/indeterminate dash.
 * @csspart control - WA/Shoelace name for `box`.
 * @csspart control--checked - Shoelace state alias on the control while checked.
 * @csspart control--indeterminate - Shoelace state alias on the control while indeterminate.
 * @csspart checkmark - Lyra name for the visible glyph inside the box.
 * @csspart checked-icon - WA/Shoelace name for the checked glyph.
 * @csspart indeterminate-icon - WA/Shoelace name for the indeterminate glyph.
 * @csspart label - The wrapper around the default slot.
 * @csspart hint - Web Awesome name for the supporting-text wrapper.
 * @csspart form-control-help-text - Shoelace name for the same supporting-text wrapper.
 * @csspart error - The error message.
 * @cssprop [--lr-checkbox-label-indent=calc(var(--lr-checkbox-box-size) + var(--lr-space-s))] -
 * The inline distance from the control's start edge to the start of the label text, i.e. the box's
 * own floor plus the gap next to it — so it tracks `size` along with the box. Published so a
 * consumer composing per-option hint text under the label can align it without re-deriving that
 * formula from the shadow styles, and used as the source of the real gap so the two cannot drift.
 * Setting it on the element (or on `lr-checkbox` in your own stylesheet) moves the label; because
 * custom properties inherit down and not sideways, it is *not* readable from a sibling node in your
 * tree — align a sibling by computing the same formula from `--lr-theme-icon-button-size`,
 * `--lr-theme-form-control-height-*` and `--lr-theme-space-s`, which you control.
 * @cssprop [--lr-checkbox-checked-bg=var(--lr-color-brand)] - Background of `[part='box']` while
 * `checked` or `indeterminate`. Retint just this control's checked fill without touching the shared
 * `--lr-color-brand` token every other component also reads.
 * @cssprop [--lr-checkbox-checked-border=var(--lr-color-brand)] - Border color of `[part='box']`
 * while `checked` or `indeterminate`.
 * @cssprop [--lr-checkbox-hover-border=var(--lr-color-brand)] - Box border while the enabled
 * interactive control is hovered.
 * @cssprop [--lr-checkbox-active-border=var(--lr-color-brand)] - Box border while pressed.
 * @cssprop [--lr-checkbox-active-ring=var(--lr-color-brand-quiet)] - Outer box ring while pressed.
 * @cssprop [--lr-checkbox-invalid-border=var(--lr-color-danger)] - Box border while invalid chrome
 * is visible.
 * @cssprop [--checked-icon-color=currentColor] - WA-compatible color of the checked or
 * indeterminate glyph.
 * @cssprop [--checked-icon-scale=1] - WA-compatible scale of the checked or indeterminate glyph.
 * @cssprop [--lr-checkbox-box-size=min(var(--lr-icon-button-size), calc(var(--lr-form-control-height) * 0.7))] -
 * Edge length of `[part='box']`. Derived from the `size` tier's shared control height, so the box
 * lines up with an `<lr-input>`/`<lr-select>`/`<lr-button>` of the same `size`; set it to pin the box
 * independently of the tier.
 * @status stable
 * @since 4.0.0
 */
export class LyraCheckbox extends LyraElement<LyraCheckboxEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    checkboxRequired: LYRA_DEFAULT_checkboxRequired,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, sizes, styles];
  static formAssociated = true;

  static override properties = {
    customError: { attribute: 'custom-error', reflect: true, noAccessor: true },
    checked: { attribute: false, noAccessor: true },
    defaultChecked: {
      attribute: 'checked',
      type: Boolean,
      reflect: true,
      useDefault: true,
      noAccessor: true,
    },
    indeterminate: { type: Boolean, reflect: true, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    name: { reflect: true, noAccessor: true, converter: omittedEmptyStringConverter },
    required: { type: Boolean, reflect: true, noAccessor: true },
    size: { reflect: true },
    // Hand-reflected by the accessor so a null write can restore the absent default while an
    // explicit non-null `'on'` write remains observably present as `value="on"`.
    value: { reflect: true, noAccessor: true },
  };

  /**
   * Control size, on the library's shared ladder. Accepts both spellings of every tier —
   * `2xs`/`xs`/`s`/`m`/`l`/`xl` and Web Awesome's `small`/`medium`/`large` — so migrating either way
   * is a tag rename. Scales the box and its checkmark off the same `--lr-form-control-*` values
   * `<lr-input>`/`<lr-select>`/`<lr-button>` use, so controls of one `size` line up in a row. The
   * slotted label keeps the library's standard control-label type size at every tier; restyle it
   * through `::part(label)` if you want it to track the control.
   */
  size: LyraSize = 'm';

  /** Web Awesome supporting text. It wins when both mapped spellings are supplied. */
  @property() hint = '';
  /** Shoelace alias for {@link hint}. */
  @property({ attribute: 'help-text' }) helpText = '';
  /** Error text associated with the inner checkbox; custom markup can use the `error` slot. */
  @property({ attribute: 'error-text' }) errorText = '';
  /** Shoelace's separate reset-default attribute. The public IDL remains `defaultChecked`. */
  @property({ type: Boolean, attribute: 'default-checked' })
  private shoelaceDefaultChecked = false;

  // Visual-only mixed state, matching native `<input type="checkbox">`
  // semantics: it does not affect `checked`'s own value, and a user
  // interaction (click/keyboard) clears it back to `false`, exactly like the
  // native control does.
  // Tracks whether the default slot carries any real (non-whitespace)
  // content, so the label wrapper — and the gap next to the box — can
  // collapse to nothing for an icon-only/aria-label-only checkbox instead of
  // leaving a stray empty gap. See lr-switch's identical field for why
  // `assignedNodes` (not `assignedElements`) is checked — the common case is
  // a bare slotted text label, e.g. `<lr-checkbox>Accept terms</lr-checkbox>`.
  @state() private hasLabelSlot = false;
  @state() private hasHintSlot = false;
  @state() private hasHelpTextSlot = false;
  @state() private hasErrorSlot = false;
  // Set on the control's first `blur`; gates the `data-invalid`/`aria-invalid`
  // reflection below so validity styling never flashes on first render,
  // mirroring `<lr-combobox>`/`<lr-select>`'s identical `touched` field.
  @state() private touched = false;
  /** Whether the user has acted on this control yet, which is what gates the `user-valid`/
   *  `user-invalid` custom states. Deliberately separate from `touched` (which drives the visible
   *  `data-invalid`/`aria-invalid` pair and is set on blur alone): a toggle is an interaction the
   *  instant it happens, and `reportValidity()` — what a submit attempt runs — counts as one too,
   *  exactly as it does for native `:user-invalid`. Not `@state`: nothing in `render()` reads it. */
  private hasInteracted = false;

  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  /** Consumer-supplied validation message reflected through `custom-error`. */
  declare customError: string | null;
  // `slotchange` cannot report mutations inside an already-assigned node. The observer also binds
  // externally flattened nodes from forwarding slots because those nodes are not descendants of
  // this host and therefore are outside a host-only subtree observation.
  private labelObserver?: MutationObserver;
  private hasSyncedDescribedByElements = false;
  private _defaultChecked = false;
  private _checkedDirty = false;
  private settingDefaultChecked = false;
  private reflectingDefaultChecked = false;
  private hadShoelaceDefaultChecked = false;
  private _fieldsetDisabled = false;
  // Tracked separately from `_fieldsetDisabled` -- driven by an owning
  // `<lr-checkbox-group>` propagating its own effective (explicit-or-
  // inherited) disabled state, rather than by this checkbox's own direct
  // `formDisabledCallback()`. Kept as its own private channel (never the
  // public `disabled` property/attribute) for the same reason `_fieldsetDisabled`
  // is: so a checkbox's own explicitly-set `disabled` survives the group
  // re-enabling instead of being permanently overwritten.
  private _groupDisabled = false;
  private _name = '';
  private _checked = false;
  private _indeterminate = false;
  private _disabled = false;
  private _required = false;
  private _value = 'on';

  /** Whether the control is disabled explicitly, by an ancestor fieldset, or by an owning `<lr-checkbox-group>`. */
  get effectiveDisabled(): boolean {
    return this.disabled || this._fieldsetDisabled || this._groupDisabled;
  }

  get checked(): boolean {
    return this._checked;
  }
  set checked(next: boolean) {
    const old = this._checked;
    if (!this.settingDefaultChecked) this._checkedDirty = true;
    this._checked = Boolean(next);
    this.syncFormState();
    this.requestUpdate('checked', old);
  }

  /** Reflected current reset default; changing it never overwrites dirty live `checked` state. */
  get defaultChecked(): boolean { return this._defaultChecked; }
  set defaultChecked(next: boolean) {
    if (this.reflectingDefaultChecked) return;
    const old = this._defaultChecked;
    this._defaultChecked = Boolean(next);
    this.reflectingDefaultChecked = true;
    try { this.toggleAttribute('checked', this._defaultChecked); }
    finally { this.reflectingDefaultChecked = false; }
    if (!this._checkedDirty) this.restoreCheckedFromDefault();
    this.requestUpdate('defaultChecked', old);
  }

  get indeterminate(): boolean {
    return this._indeterminate;
  }
  set indeterminate(next: boolean) {
    const old = this._indeterminate;
    this._indeterminate = Boolean(next);
    this.syncFormState();
    this.requestUpdate('indeterminate', old);
  }

  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    this.toggleAttribute('disabled', this._disabled);
    // Disabling bars constraint validation, so the violation itself is recomputed here -- not just
    // the states republished.
    this.updateValidity();
    this.requestUpdate('disabled', old);
  }

  /** The form submission key, reflected synchronously for native form APIs. */
  get name(): string {
    return this._name;
  }
  set name(next: string | null) {
    const old = this._name;
    this._name = next ?? '';
    if (this._name) {
      this.setAttribute('name', this._name);
    } else {
      this.removeAttribute('name');
    }
    this.requestUpdate('name', old);
  }

  get required(): boolean {
    return this._required;
  }
  set required(next: boolean) {
    const old = this._required;
    this._required = Boolean(next);
    this.toggleAttribute('required', this._required);
    this.updateValidity();
    this.requestUpdate('required', old);
  }

  get value(): string {
    return this._value;
  }
  set value(next: string | null) {
    const old = this._value;
    this._value = next ?? 'on';
    if (next == null) {
      if (this.hasAttribute('value')) this.removeAttribute('value');
    } else if (this.getAttribute('value') !== this._value) {
      this.setAttribute('value', this._value);
    }
    this.syncFormState();
    // Reflection is synchronous and source-sensitive above. Keep Lit's public reflection metadata,
    // but never queue a second reflection that could turn a same-tick null reset back into `on`.
    this.requestUpdate('value', old, { reflect: false });
  }

  constructor() {
    super();
    installInvalidEventAlias(this, (init: { cancelable: true }) =>
      this.emit('lr-invalid', undefined, init));
    this.internals = attachInternalsSafely(this);
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
    installCustomErrorProperty(this, () => this.validityController.customValidityMessage);
    this.syncFormState();
  }

  get form(): HTMLFormElement | null {
    return getFormOwner(this.internals);
  }
  set form(owner: FormOwnerValue) { setFormOwner(this, owner); }
  getForm(): HTMLFormElement | null { return getFormOwner(this.internals); }
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

  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | null {
    return this.renderRoot?.querySelector('[part~="base"]') ?? null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.updateValidity();
    const MutationObserverCtor = this.ownerDocument.defaultView?.MutationObserver;
    this.labelObserver = MutationObserverCtor
      ? new MutationObserverCtor(() => {
          this.bindLabelObserverTargets();
          this.recomputeHasLabelSlot();
        })
      : undefined;
    this.addEventListener('slotchange', this.onLabelSlotChange);
    this.bindLabelObserverTargets();
    if (this.hasUpdated) {
      // A reconnect is no longer a hydration boundary, so refresh immediately from the new tree.
      this.recomputeHasLabelSlot();
      this.refreshNamedSlotState();
    } else {
      // Browser-only mounts still seed before their first paint. During hydration the base helper
      // defers this browser-only light-DOM sample until the server render has been reproduced.
      this.seedFirstRenderState(() => {
        this.recomputeHasLabelSlot();
        this.refreshNamedSlotState();
      });
    }
  }

  private refreshNamedSlotState(): void {
    const children = (this as unknown as { children?: HTMLCollection }).children;
    if (!children) return;
    const elements = Array.from(children);
    this.hasHintSlot = elements.some((element) => element.getAttribute('slot') === 'hint');
    this.hasHelpTextSlot = elements.some((element) => element.getAttribute('slot') === 'help-text');
    this.hasErrorSlot = elements.some((element) => element.getAttribute('slot') === 'error');
  }

  override disconnectedCallback(): void {
    this.removeEventListener('slotchange', this.onLabelSlotChange);
    this.labelObserver?.disconnect();
    this.labelObserver = undefined;
    super.disconnectedCallback();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // keeps a future LyraElement/mixin lifecycle hook wired in
    if (
      changed.has('shoelaceDefaultChecked') &&
      (this.hasAttribute('default-checked') || this.hadShoelaceDefaultChecked)
    ) {
      this.defaultChecked = this.shoelaceDefaultChecked;
      this.hadShoelaceDefaultChecked = this.hasAttribute('default-checked');
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const describedBy = this.getAttribute('aria-describedby');
    const hint = this.renderRoot.querySelector<HTMLElement>('#checkbox-hint');
    const error = this.renderRoot.querySelector<HTMLElement>('#checkbox-error');
    if (
      !describedBy &&
      !this.hasSyncedDescribedByElements &&
      (!hint || hint.hidden) &&
      (!error || error.hidden)
    ) return;
    const control = this.renderRoot.querySelector<HTMLElement>('[part~="base"]') ?? undefined;
    this.hasSyncedDescribedByElements = syncAriaDescribedByElements(
      this,
      control,
      describedBy,
    );
    if (control && 'ariaDescribedByElements' in control) {
      const reflected = control as HTMLElement & { ariaDescribedByElements: Element[] | null };
      const current = reflected.ariaDescribedByElements ?? [];
      const internal = [error, hint].filter(
        (element): element is HTMLElement => Boolean(element && !element.hidden),
      );
      reflected.ariaDescribedByElements = [
        ...current.filter((element) => element !== hint && element !== error),
        ...internal,
      ];
    }
  }

  /** Shared with every other form control: disabled (own, fieldset, or group) bars validation. */
  private get barredFromValidation(): boolean {
    return isBarredFromValidation(this, this.internals);
  }

  private updateValidity(): void {
    if (this.barredFromValidation) {
      // A barred control reports no violation at all, exactly like a native disabled checkbox --
      // leaving `valueMissing` raised is what leaked `:state(invalid)` onto disabled required boxes.
      this.validityController.setValidity({});
    } else if (this.required && !this.checked) {
      this.validityController.setValidity({ valueMissing: true }, this.localize('checkboxRequired'));
    } else {
      this.validityController.setValidity({});
    }
    this.reflectInvalid();
  }

  // Keeps `data-invalid` (styling hook) in lockstep with `aria-invalid`
  // (rendered from the same expression in `render()`) any time validity
  // could have changed, rather than waiting on Lit's async `updated()` --
  // consistent with this component's already-synchronous
  // `syncFormState()`/setter shape.
  private reflectInvalid(): void {
    const barred = this.barredFromValidation;
    this.toggleAttribute('data-invalid', !barred && this.touched && !this.internals.validity.valid);
    syncValidityStates(this.internals, {
      required: this.required,
      hasInteracted: this.hasInteracted,
      barred,
    });
    setCustomState(this.internals, 'checked', this.checked);
    setCustomState(this.internals, 'indeterminate', this.indeterminate);
    setCustomState(this.internals, 'disabled', this.effectiveDisabled);
  }

  private syncFormState(): void {
    // A native checkbox submits its `value` content attribute (default
    // "on") only while checked, and contributes nothing at all — not even
    // an empty string — while unchecked.
    const state = `${this.checked ? 'checked' : 'unchecked'}${this.indeterminate ? '/indeterminate' : ''}`;
    this.internals.setFormValue(this.checked ? this.value : null, state);
    this.updateValidity();
  }

  formResetCallback(): void {
    this.restoreCheckedFromDefault();
    this.touched = false;
    this.hasInteracted = false;
    this.reflectInvalid();
  }
  formStateRestoreCallback(
    state: string | File | FormData | null,
    reason: 'autocomplete' | 'restore',
  ): void {
    void reason;
    const oldChecked = this._checked;
    const oldIndeterminate = this._indeterminate;
    this._checked = state === 'checked' || state === 'checked/indeterminate';
    this._checkedDirty = true;
    this._indeterminate = state === 'checked/indeterminate' || state === 'unchecked/indeterminate';
    this.syncFormState();
    this.requestUpdate('checked', oldChecked);
    this.requestUpdate('indeterminate', oldIndeterminate);
  }
  /** @internal Lets `<lr-checkbox-group>` restore all child defaults before one aggregate sync. */
  resetFromGroup(): void { this.restoreCheckedFromDefault(); }
  private restoreCheckedFromDefault(): void {
    this.settingDefaultChecked = true;
    try { this.checked = this._defaultChecked; }
    finally { this.settingDefaultChecked = false; }
    this._checkedDirty = false;
  }
  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
    this.updateValidity();
    this.requestUpdate();
  }
  /** @internal Driven by an owning `<lr-checkbox-group>`; released when the checkbox leaves the group's control. */
  setGroupDisabled(value: boolean): void {
    if (this._groupDisabled === value) return;
    this._groupDisabled = value;
    this.updateValidity();
    this.requestUpdate();
  }
  checkValidity(): boolean {
    this.updateValidity();
    return this.internals.checkValidity();
  }
  reportValidity(): boolean {
    this.updateValidity();
    // A submit attempt runs this, and native `:user-invalid` starts matching at exactly that
    // point, so it counts as interaction for the `user-*` custom states. `checkValidity()`
    // deliberately does not: it is the silent query.
    this.hasInteracted = true;
    this.reflectInvalid();
    return this.internals.reportValidity();
  }

  /**
   * Sets or clears a consumer-supplied validation error — the standard channel for a server-side
   * rejection ("those terms have been superseded") that no client-side constraint can express. A
   * non-empty `message` raises `customError` and becomes `validationMessage`, so the control fails
   * `checkValidity()`, blocks form submission, and matches `:state(invalid)`; `''` clears it.
   *
   * Clearing restores the control's own computed validity rather than forcing it valid: a
   * required-and-unchecked checkbox whose custom error is cleared stays `valueMissing`. The custom
   * error also survives every intrinsic recomputation in between (each toggle re-runs
   * `updateValidity()`) and a form reset, exactly like a native control — only another
   * `setCustomValidity('')` clears it.
   *
   * The message is caller-supplied content, so it is used verbatim and never localized here.
   */
  setCustomValidity(message: string): void {
    this.validityController.setCustomValidity(message ?? '');
    this.reflectInvalid();
    // `aria-invalid` is rendered from `internals.validity`, which the call above just moved.
    this.requestUpdate();
  }

  /** Clears consumer-supplied validity and restores the current required/checked constraint. */
  resetValidity(): void {
    this.setCustomValidity('');
  }

  /** Activates the internal checkbox control (toggling it), mirroring `<lr-button>`'s host
   *  `click()` forwarding -- `HTMLElement.prototype.click()` is otherwise a no-op on a custom
   *  element with no native click semantics of its own. */
  override click(): void {
    if (!this.effectiveDisabled) this[VALIDITY_ANCHOR]()?.click();
  }

  /** Moves focus to the internal checkbox control. */
  override focus(options?: FocusOptions): void {
    if (!this.effectiveDisabled) this[VALIDITY_ANCHOR]()?.focus(options);
  }

  /** Removes focus from the internal checkbox control. */
  override blur(): void {
    this[VALIDITY_ANCHOR]()?.blur();
  }

  private toggle(): void {
    if (this.effectiveDisabled) return;
    this.hasInteracted = true;
    this.checked = !this.checked;
    this.indeterminate = false;
    dispatchNativeEvent(this, 'input');
    this.emit('lr-input', { checked: this.checked });
    dispatchNativeEvent(this, 'change');
    this.emit('lr-change', { checked: this.checked });
  }

  private onClick = (): void => {
    this.toggle();
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.effectiveDisabled) return;
    // Native checkboxes toggle with Space. Enter remains available to the
    // surrounding form's own keyboard behavior.
    if (e.key === ' ' || e.key === 'Spacebar') {
      // Space would otherwise scroll the page, same as a native checkbox.
      e.preventDefault();
      this.toggle();
    }
  };

  private onSlotChange = (event: Event): void => this.handleLabelSlotChange(event);

  private onHintSlotChange = (event: Event): void => {
    this.hasHintSlot = (event.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onHelpTextSlotChange = (event: Event): void => {
    this.hasHelpTextSlot = (event.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onErrorSlotChange = (event: Event): void => {
    this.hasErrorSlot = (event.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private isDefaultLabelNode(node: Node): boolean {
    if (node.nodeType !== 1) return true;
    const slotName = (node as Element).getAttribute('slot');
    return slotName === null || slotName === '';
  }

  private labelForwardingSlots(): HTMLSlotElement[] {
    return Array.from(this.querySelectorAll<HTMLSlotElement>('slot')).filter((slot) => {
      let top: Node = slot;
      while (top.parentNode && top.parentNode !== this) top = top.parentNode;
      return top.parentNode === this && this.isDefaultLabelNode(top);
    });
  }

  private observeLabelNode(node: Node): void {
    if (!this.labelObserver) return;
    if (node.nodeType === 3) {
      this.labelObserver.observe(node, { characterData: true });
      return;
    }
    if (node.nodeType !== 1) return;
    this.labelObserver.observe(node, {
      attributes: true,
      attributeFilter: ['aria-hidden', 'aria-label', 'class', 'hidden', 'inert', 'slot', 'style'],
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  private bindLabelObserverTargets(): void {
    if (!this.labelObserver) return;
    this.labelObserver.disconnect();
    this.observeLabelNode(this);
    for (const slot of this.labelForwardingSlots()) {
      if (slot.assignedNodes().length === 0) continue;
      for (const assigned of slot.assignedNodes({ flatten: true })) this.observeLabelNode(assigned);
    }
  }

  private handleLabelSlotChange(event: Event): void {
    const target = event.target as Element | null;
    if (target?.nodeType !== 1 || target.localName !== 'slot') return;
    if (
      target.getRootNode() !== this.renderRoot &&
      !this.labelForwardingSlots().includes(target as HTMLSlotElement)
    ) return;
    this.bindLabelObserverTargets();
    this.recomputeHasLabelSlot();
  }

  private onLabelSlotChange = (event: Event): void => this.handleLabelSlotChange(event);

  private recomputeHasLabelSlot(): void {
    const renderRoot = this.renderRoot as ParentNode | undefined;
    const childNodes = (this as unknown as { childNodes?: NodeListOf<ChildNode> }).childNodes;
    if (!renderRoot || !childNodes) return;
    const slot = renderRoot.querySelector<HTMLSlotElement>('slot:not([name])');
    const nodes: Node[] = slot
      ? slot.assignedNodes({ flatten: true })
      : Array.from(childNodes)
          .filter((node) => this.isDefaultLabelNode(node))
          .flatMap((node) => {
            if (node.nodeType !== 1 || (node as Element).localName !== 'slot') return [node];
            const forwardingSlot = node as HTMLSlotElement;
            return forwardingSlot.assignedNodes().length > 0
              ? forwardingSlot.assignedNodes({ flatten: true })
              : Array.from(forwardingSlot.childNodes);
          });
    this.hasLabelSlot = hasRealContent(nodes);
  }

  private onBlur = (event: FocusEvent): void => {
    // This control has no native disableable form control to force-blur (its focus target is a
    // plain `role="checkbox"` span whose own `tabindex` alone would not do it), but the HOST is a
    // form-associated custom element (`static formAssociated = true` + `attachInternals()`), and
    // the browser applies its own "actually disabled" concept to those automatically -- confirmed
    // empirically: setting the host's `disabled` content attribute, *and* an ancestor `<fieldset>`
    // disabling it (even through an intermediate, itself-enabled fieldset), both force-blur a
    // focused descendant inside the shadow tree, exactly like a native disableable control
    // force-blurs itself (originally found in `<lr-input>`'s onBlur).
    // That blur is a platform reaction, not a user interaction, and would otherwise leave the
    // control primed to show as touched/user-invalid the instant it is re-enabled, or -- depending
    // on exactly when in an in-flight update it lands -- risk reentering that update and tripping
    // Lit's dev-mode "scheduled an update after an update completed" warning, all for a state flip
    // nothing observable needed since a disabled control is barred from validation regardless.
    //
    // `effectiveDisabled` alone is not a reliable enough guard here: for the fieldset path the
    // browser force-blurs the focused descendant BEFORE calling `formDisabledCallback()`
    // (confirmed empirically), so `_fieldsetDisabled` -- and therefore `effectiveDisabled` --
    // still reads stale/false at this exact instant. `:disabled` CSS matching for a
    // form-associated custom element tracks the platform's own "actually disabled" concept
    // directly (the same concept that triggers the forced blur in the first place) and is already
    // correct by this point for both paths, so it is checked as well.
    if (!this.effectiveDisabled && !this.matches(':disabled')) {
      this.touched = true;
      this.hasInteracted = true;
      this.reflectInvalid();
    }
    relayNativeEvent(this, event);
    this.emit('lr-blur');
  };

  private onFocus = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
    this.emit('lr-focus');
  };

  override render(): TemplateResult {
    const mixed = this.indeterminate;
    const hasHint = this.hasHintSlot || this.hasHelpTextSlot || Boolean(this.hint || this.helpText);
    const hasError = this.hasErrorSlot || this.errorText.length > 0;
    const controlParts = [
      'box',
      'control',
      this.checked ? 'checked control--checked' : '',
      mixed ? 'indeterminate control--indeterminate' : '',
    ].filter(Boolean).join(' ');
    const describedBy = [
      this.getAttribute('aria-describedby') ?? '',
      hasError ? 'checkbox-error' : '',
      hasHint ? 'checkbox-hint' : '',
    ]
      .filter(Boolean)
      .join(' ');
    return html`
      <div part="form-control">
        <span
          part="base checkbox"
          role="checkbox"
          tabindex=${this.effectiveDisabled ? '-1' : '0'}
          aria-checked=${mixed ? 'mixed' : this.checked ? 'true' : 'false'}
          aria-required=${this.required ? 'true' : 'false'}
          aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'}
          aria-disabled=${this.effectiveDisabled ? 'true' : 'false'}
          aria-label=${this.getAttribute('aria-label') ?? nothing}
          aria-describedby=${describedBy || nothing}
          @click=${this.onClick}
          @keydown=${this.onKeyDown}
          @focus=${this.onFocus}
          @blur=${this.onBlur}
        >
          <span part=${controlParts}>
            ${mixed ? indeterminateGlyph() : this.checked ? checkmarkGlyph() : nothing}
          </span>
          <span part="label" ?hidden=${!this.hasLabelSlot}>
            <slot @slotchange=${this.onSlotChange}></slot>
          </span>
        </span>
        <div id="checkbox-error" part="error" ?hidden=${!hasError}>
          ${this.errorText}<slot name="error" @slotchange=${this.onErrorSlotChange}></slot>
        </div>
        <div id="checkbox-hint" part="hint form-control-help-text" ?hidden=${!hasHint}>
          ${this.hint || this.helpText}<slot name="hint" @slotchange=${this.onHintSlotChange}></slot
          ><slot name="help-text" @slotchange=${this.onHelpTextSlotChange}></slot>
        </div>
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-checkbox': LyraCheckbox;
  }
}
