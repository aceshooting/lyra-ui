import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { installFormControlLabelSupport } from '../../../internal/form-control-labels.js';
installFormControlLabelSupport();
import { place } from '../../../internal/positioner.js';
import { hostAriaLabel, nextId } from '../../../internal/a11y.js';
import { chevronIcon } from '../../../internal/icons.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { syncValidityStates } from '../../../internal/custom-states.js';
import {
  getLyraLocaleDirection,
  getRegisteredLyraLocales,
  subscribeLyraLocaleRegistry,
  setLyraLocale,
} from '../../../internal/localization-runtime.js';
import type { LyraLocaleDirection } from '../../../internal/localization.js';
import { localeNativeName } from '../../media/flag/language-map.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraSize } from '../../../internal/variants.js';
import { styles } from './locale-picker.styles.js';
import {
  declaredDefaultConverter,
  trueDefaultBooleanFromAttributeConverter as trueDefaultBooleanConverter } from '../../../internal/converters.js';
import {
  attachInternalsSafely,
  getFormOwner,
  installCustomErrorProperty,
  isBarredFromValidation,
  setFormOwner,
  type FormOwnerValue,
} from '../../../internal/form-associated.js';
import { installInvalidEventAlias } from '../../../internal/invalid-event-alias.js';
import { relayNativeEvent } from '../../../internal/native-event-relay.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_localePickerLabel, LYRA_DEFAULT_localePickerRequired } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** `true`-defaulting boolean attribute converter -- Lit's default presence-based `type: Boolean`
 *  can never be set back to `false` from a plain-HTML attribute once a property's own default is
 *  `true` (removing an attribute that was never present fires no `attributeChangedCallback`), so
 *  `fromAttribute` checks the literal string instead. Duplicated locally rather than imported,
 *  matching this exact converter's repeated per-component convention elsewhere in this library.
 *  `showFlags` (the only property using this converter) doesn't set `reflect: true`, so there's
 *  no `toAttribute` half -- Lit only calls it when reflecting. */

/** One offered locale row. `label` overrides the derived `localeNativeName(tag)` endonym when
 *  given -- e.g. offering a locale before its strings are registered ("Français (bientôt)").
 *  `country` overrides the row's derived flag country when given -- e.g. showing Lebanon's flag
 *  for an `'ar'` row instead of the library's default Saudi Arabia mapping. */
export interface LyraLocaleEntry {
  /** BCP-47 locale tag, e.g. `'pt-BR'`. */
  readonly tag: string;
  /** Overrides `localeNativeName(tag)` when given. */
  readonly label?: string;
  /** ISO 3166-1 alpha-2 country code (e.g. `'lb'`) overriding this row's `<lr-flag>` derivation
   *  -- when given, the row renders `<lr-flag country={country}>` instead of the default
   *  `<lr-flag language={tag}>`. Unset (the default) keeps today's tag-derived flag. Ignored
   *  while `showFlags` is `false`. */
  readonly country?: string;
}

/** `locales` accepts either a plain array of BCP-47 tags (endonym label derived automatically,
 *  no per-row flag override available) or `{ tag, label, country }` rows for custom
 *  labels/ordering/subsets/flag overrides. */
export type LyraLocaleCatalog = readonly string[] | readonly LyraLocaleEntry[];

const MAX_LOCALE_ENTRIES = 512;

function snapshotLocaleCatalog(source: unknown): LyraLocaleCatalog {
  if (!Array.isArray(source)) return Object.freeze([]);
  const rows: Array<string | LyraLocaleEntry> = [];
  for (let index = 0; index < Math.min(source.length, MAX_LOCALE_ENTRIES); index += 1) {
    try {
      const raw = source[index];
      if (typeof raw === 'string') {
        if (raw.length > 0) rows.push(raw);
        continue;
      }
      if (raw === null || typeof raw !== 'object') continue;
      const candidate = raw as Record<string, unknown>;
      const tag = candidate['tag'];
      const label = candidate['label'];
      const country = candidate['country'];
      if (
        typeof tag !== 'string' || tag.length === 0 ||
        (label !== undefined && typeof label !== 'string') ||
        (country !== undefined && typeof country !== 'string')
      ) continue;
      rows.push(Object.freeze({
        tag,
        ...(label === undefined ? {} : { label }),
        ...(country === undefined ? {} : { country }),
      }));
    } catch {
      // A hostile getter invalidates only that row; later valid locales remain reachable.
    }
  }
  return Object.freeze(rows) as LyraLocaleCatalog;
}

interface NormalizedLocaleEntry {
  tag: string;
  label: string;
  country?: string;
}

/** `lr-change`'s detail. `direction` is the picked locale's writing direction, resolved through
 *  `getLyraLocaleDirection()` — the component never applies it (see the class doc), it just hands
 *  the host the one fact it would otherwise need its own locale table to know. */
export interface LyraLocaleChangeDetail {
  value: string;
  previousValue: string;
  direction: LyraLocaleDirection;
}

export interface LyraLocalePickerEventMap {
  'lr-invalid': CustomEvent<null>;
  'lr-change': CustomEvent<LyraLocaleChangeDetail>;
  blur: FocusEvent;
  focus: FocusEvent;
}

/**
 * `<lr-locale-picker>` — a closed-list locale switcher over the library's own locale registry.
 *
 * With `locales` left unset (the default), the offered rows are exactly
 * `getRegisteredLyraLocales()` — every locale with strings registered via `registerLyraLocale()`,
 * plus `'en'` (always available through the library's built-in English fallback) — kept live via
 * `subscribeLyraLocaleRegistry()` so a locale registered after mount (e.g. a lazily-loaded
 * translation pack) appears without a manual refresh. Passing an explicit `locales` array
 * overrides the auto-discovered list entirely: a curated subset, a custom order, custom labels,
 * or a locale the host wants to offer before its strings are registered.
 *
 * `value` is the *committed* selection (form-submitted, drives `lr-change`) and starts `''`.
 * While unset, the trigger displays `effectiveLocale` (the same ancestor-`lang`/registry
 * resolution every other component already uses) as a live preview — but that preview is never a
 * commitment: `checkValidity()`/`required` are governed by the real `value`, which stays `''`
 * until the host sets it or the user actually picks a row. This mirrors a native `<select>`
 * rendering its first option's text without that being a committed selection.
 *
 * Built directly on the shared trigger-button/`aria-activedescendant` listbox technique
 * `<lr-select>` uses (not composed from it) — a plain closed list, no filter/free-text mode; a
 * locale catalog is realistically dozens of rows, not thousands, so `<lr-combobox>`'s filterable
 * model would be more surface than the job needs.
 *
 * Selecting a row sets `value` and emits a cancelable `lr-change` — if a listener doesn't call
 * `event.preventDefault()`, the component applies the pick itself via `setLyraLocale()`. A host
 * that wants to intercept the pick (e.g. persist it to a profile first) calls
 * `event.preventDefault()`; `value` still updates so the trigger reflects the pick, but the
 * page-level locale is untouched until the host calls `setLyraLocale()` itself.
 *
 * Does not touch `document.documentElement.lang`/`dir` — applying a picked locale's writing
 * direction to the page is left to the host, which already has everything it needs from
 * `lr-change` to do that itself: the detail carries the resolved `direction` alongside `value`,
 * so `document.documentElement.dir = event.detail.direction` is the whole of it.
 *
 * Component-scoped theme inputs remain undeclared on the host, so values inherited from an
 * ancestor theme wrapper override the active size tier. A value set directly on the locale picker
 * still wins through normal custom-property inheritance.
 *
 * @customElement lr-locale-picker
 * @event lr-change - The selection changed. `detail: { value, previousValue, direction }`, where
 *   `direction` is the picked locale's `'ltr'`/`'rtl'` writing direction. Cancelable —
 *   `event.preventDefault()` stops the automatic `setLyraLocale()` call without reverting `value`.
 * @event blur - Native `FocusEvent` relayed from the internal trigger button.
 * @event focus - Native `FocusEvent` relayed from the internal trigger button.
 * @event lr-invalid - The locale picker failed a validity check; cancelable. Calling
 *   `preventDefault()` also cancels the native `invalid` event it aliases, suppressing the
 *   browser's own validation bubble and `reportValidity()`'s focus/scroll.
 * @slot label - Custom label content.
 * @slot hint - Custom hint content.
 * @slot error - Custom error content.
 * @csspart form-control - The outer wrapper around label, trigger, listbox, error and hint.
 * @csspart form-control-label - The `<label>` element (only rendered — and only contributes to
 *   the accessible name — once `label` is non-empty).
 * @csspart trigger - The trigger button (positioning anchor).
 * @csspart trigger-flag - The trigger's leading `<lr-flag>` for the current value (present only
 *   while `showFlags` is on).
 * @csspart listbox - The options popover.
 * @csspart option - An option row.
 * @csspart option-flag - The row's leading `<lr-flag>` (present only while `showFlags` is on).
 * @csspart option-label - An option row's label wrapper (native name + tag).
 * @csspart option-tag - An option row's secondary line — the raw BCP-47 tag.
 * @csspart expand-icon - The dropdown indicator.
 * @csspart hint - The hint message.
 * @csspart error - The error message.
 * @cssprop --lr-locale-picker-trigger-padding - Trigger padding shorthand, scaled by `size`.
 * @cssprop [--lr-locale-picker-trigger-min-height=var(--lr-form-control-height)] - Trigger
 *   block-size floor. Reads the shared form-control height ladder, so retuning
 *   `--lr-theme-form-control-height-*` moves this control and every sibling field together.
 * @cssprop --lr-locale-picker-trigger-height - Exact trigger height. Unset by default (a floor
 *   only via `-trigger-min-height`); set a length to both floor and cap the trigger, e.g. to
 *   pixel-match a sibling field in the same toolbar row.
 * @cssprop [--lr-locale-picker-font-size=var(--lr-form-control-font-size)] - Trigger font size,
 *   from the shared form-control size ladder.
 * @cssprop --lr-locale-picker-expand-size - Decorative expand-icon box size, scaled by `size`.
 * @cssprop [--lr-locale-picker-gap=var(--lr-space-xs)] - Trigger and option child gap.
 * @cssprop [--lr-locale-picker-radius=var(--lr-radius)] - Trigger/listbox/option corner radius.
 * @cssprop [--lr-locale-picker-trigger-hover-bg=var(--lr-color-brand-quiet)] - Trigger hover background.
 * @cssprop [--lr-locale-picker-open-border-color=var(--lr-color-brand)] - Open trigger border color.
 * @cssprop [--lr-locale-picker-option-selected-border-color=var(--lr-color-brand)] - Selected option border.
 * @cssprop [--lr-locale-picker-option-selected-color=var(--lr-color-brand)] - Selected option text.
 * @cssprop [--lr-locale-picker-option-selected-font-weight=var(--lr-font-weight-semibold)] -
 *   Selected option font weight.
 * @cssprop [--lr-locale-picker-option-active-bg=var(--lr-color-brand-quiet)] - Background of a
 *   hovered or keyboard-active option row.
 * @cssprop [--lr-form-control-required-content=' *'] - The required-field marker rendered after the
 * label. Set it to `''` to suppress the marker, or to any other quoted string (`' (required)'`, a
 * localized word) to replace it. Caller-supplied content, so it is never localized here.
 * @cssprop [--lr-form-control-required-color=var(--lr-color-danger)] - Color of that marker,
 * retunable without touching any other danger-coloured surface.
 * @cssprop [--lr-form-control-required-offset=0] - Inline space between the label text and the
 * marker.
 * @cssstate required - Matches while `required` is set.
 * @cssstate optional - Matches while `required` is not set (the complement of `required`).
 * @cssstate valid - Matches while the control satisfies its constraints.
 * @cssstate invalid - Matches while it does not — including a pristine required picker with
 *   nothing committed, exactly like native `:invalid`.
 * @cssstate user-valid - `valid`, but only after the user has interacted (blurred the trigger, or
 *   been through a `reportValidity()`/submit attempt).
 * @cssstate user-invalid - `invalid`, but only after that same interaction — a required picker
 *   nobody has touched yet is invalid without being styled as an error.
 * @status stable
 * @since 6.0.0
 */
export class LyraLocalePicker extends LyraElement<LyraLocalePickerEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    localePickerLabel: LYRA_DEFAULT_localePickerLabel,
    localePickerRequired: LYRA_DEFAULT_localePickerRequired,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static formAssociated = true;
  static override styles = [LyraElement.styles, sizes, styles];

  static override properties = {
    customError: { attribute: 'custom-error', reflect: true, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    required: { type: Boolean, reflect: true, noAccessor: true },
    value: { attribute: false, noAccessor: true },
    defaultValue: {
      attribute: 'value',
      reflect: true,
      useDefault: true,
      noAccessor: true,
    },
    name: { reflect: true, noAccessor: true },
  };

  /** The offered locale list. `undefined` (the default) auto-discovers every locale registered via
   *  `registerLyraLocale()` (plus `'en'`) through `getRegisteredLyraLocales()`, kept live via
   *  `subscribeLyraLocaleRegistry()`. Any explicit array overrides the auto-discovered list
   *  entirely, including `[]` as an authoritative empty catalog. If the catalog changes while
   *  the listbox is open, an active row beyond the new end is rehomed to the last remaining row. */
  private _locales?: LyraLocaleCatalog;
  @property({ attribute: false })
  get locales(): LyraLocaleCatalog | undefined { return this._locales; }
  set locales(next: LyraLocaleCatalog | undefined) {
    const previous = this._locales;
    this._locales = next === undefined ? undefined : snapshotLocaleCatalog(next);
    this.requestUpdate('locales', previous);
  }

  /** Each row's leading `<lr-flag>`. The composition recipe this component supersedes
   *  (`lr-popover` + `lr-flag`) already pairs a locale switcher with flags by convention --
   *  defaulting to `true` keeps that continuity; set `false` for text-only rows. */
  @property({ attribute: 'show-flags', type: Boolean, converter: trueDefaultBooleanConverter }) showFlags = true;

  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  /** Whether the option popup is open. Disabled controls reject direct reopen attempts, including
   * the synchronous fieldset cascade before `formDisabledCallback()` runs. */
  @property({ type: Boolean, reflect: true })
  get open(): boolean { return this._open; }
  set open(next: boolean) {
    const old = this._open;
    const liveDisabled = this.effectiveDisabled ||
      (typeof this.matches === 'function' && this.matches(':disabled'));
    this._open = Boolean(next) && !liveDisabled;
    if (this._open === old) {
      if (next && !this._open && this.hasAttribute('open')) this.removeAttribute('open');
      return;
    }
    if (!this._open) this.activeIndex = -1;
    this.requestUpdate('open', old);
  }
  /** Visual size — the library-wide `2xs`–`xl` ladder shared with `lr-select`. The Web Awesome /
   *  Shoelace spellings `small`/`medium`/`large` are accepted for `s`/`m`/`l`, so a migration is a
   *  tag rename with no attribute rewrite. */
  @property({ reflect: true,
    converter: declaredDefaultConverter<LyraSize>('m'),
  }) size: LyraSize = 'm';

  @state() private activeIndex = -1;
  @state() private touched = false;
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;
  @state() private hasLabelSlot = false;
  // Bumped by subscribeLyraLocaleRegistry() -- its own state-property change is what triggers a
  // re-render; normalizedEntries always recomputes fresh from getRegisteredLyraLocales(), so
  // nothing in its body needs to read this field.
  @state() private registryTick = 0;
  @query('[part="trigger"]') private triggerElement?: HTMLButtonElement;

  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  /** Consumer-supplied validation message reflected through `custom-error`. */
  declare customError: string | null;
  private listId = nextId('locale-picker-list');
  private controlId = nextId('locale-picker-control');
  private cleanup?: () => void;
  private pointerListenerDocument?: Document;
  private pointerListener?: (event: PointerEvent) => void;
  private stopRegistrySubscription?: () => void;
  private _value = '';
  private _open = false;
  private _fieldsetDisabled = false;
  private _name = '';
  private _disabled = false;
  private _required = false;
  private _defaultValue = '';
  private _valueDirty = false;
  private settingDefaultValue = false;
  private reflectingDefaultValue = false;
  // Standard listbox type-ahead: printable keystrokes accumulate into this buffer and reset
  // ~500ms after the last one, matching lr-select's identical buffer/timer pair.
  private typeAheadBuffer = '';
  private typeAheadTimer?: number;
  private typeAheadTimerWindow?: Window;
  private typeAheadTimerGeneration = 0;
  private activeScrollGeneration = 0;

  constructor() {
    super();
    this.internals = attachInternalsSafely(this);
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
    installCustomErrorProperty(this, () => this.validityController.customValidityMessage);
    installInvalidEventAlias(this, (init: { cancelable: true }) =>
      this.emit('lr-invalid', null, init));
    this.internals.setFormValue('');
  }

  /** Reads both component state and the UA's synchronous fieldset cascade before public actions. */
  private get liveDisabled(): boolean {
    return this.effectiveDisabled || this.matches(':disabled');
  }

  /** Focus the internal trigger unless the form control is effectively disabled. */
  override focus(options?: FocusOptions): void {
    if (!this.liveDisabled) this.triggerElement?.focus(options);
  }
  /** Blur the internal trigger. */
  override blur(): void {
    this.triggerElement?.blur();
  }
  /** Activates the internal trigger -- `HTMLElement.prototype.click()` on a custom element with
   *  no native click semantics is otherwise a silent no-op. Mirrors `<lr-select>`'s identical
   *  `click()`. */
  override click(): void {
    if (!this.liveDisabled) this.triggerElement?.click();
  }

  get form(): HTMLFormElement | null {
    return getFormOwner(this.internals);
  }
  set form(owner: FormOwnerValue) {
    setFormOwner(this, owner);
  }
  getForm(): HTMLFormElement | null {
    return getFormOwner(this.internals);
  }
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
    return this.renderRoot?.querySelector('[part="trigger"]') ?? null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.updateValidity();
    this.stopRegistrySubscription = subscribeLyraLocaleRegistry(() => {
      this.registryTick += 1;
    });
    if (this.hasUpdated && this.open) queueMicrotask(() => this.syncPopup());
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanup?.();
    this.cleanup = undefined;
    this.unbindDocumentPointer();
    this.stopRegistrySubscription?.();
    this.stopRegistrySubscription = undefined;
    this.clearTypeAheadTimer();
    this.activeScrollGeneration += 1;
    this.typeAheadBuffer = '';
    // Reset so a reconnect (e.g. a drag-drop reparent) re-triggers updated()'s open-driven
    // branch -- without this, `open` stays `true` across the disconnect/reconnect and
    // `changed.has('open')` never fires again, leaving the listbox rendered open with no
    // positioning and no outside-click listener.
    this.open = false;
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.cleanup?.();
    this.cleanup = undefined;
    this.unbindDocumentPointer();
    this.clearTypeAheadTimer();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (this.open && (changed.has('locales') || changed.has('registryTick')) && this.activeIndex >= 0) {
      this.activeIndex = Math.min(this.activeIndex, this.normalizedEntries.length - 1);
      this.queueActiveScroll();
    }
    if (!this.hasUpdated) {
      this.hasHintSlot = Array.from(this.children ?? []).some((el) => el.getAttribute('slot') === 'hint');
      this.hasErrorSlot = Array.from(this.children ?? []).some((el) => el.getAttribute('slot') === 'error');
      this.hasLabelSlot = Array.from(this.children ?? []).some((el) => el.getAttribute('slot') === 'label');
    }
  }

  /** The current locale tag (empty string when nothing is committed). */
  get value(): string {
    return this._value;
  }
  set value(next: string) {
    const old = this._value;
    if (!this.settingDefaultValue) this._valueDirty = true;
    this._value = next ?? '';
    this.internals.setFormValue(this._value);
    this.updateValidity();
    this.requestUpdate('value', old);
  }
  /** Reflected current reset default; changing it never overwrites a dirty live `value`. */
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
    if (!this._valueDirty) this.restoreLiveValueFromDefault();
    this.requestUpdate('defaultValue', old);
  }

  get name(): string {
    return this._name;
  }
  set name(next: string) {
    const old = this._name;
    this._name = next ?? '';
    if (this._name) {
      this.setAttribute('name', this._name);
    } else {
      this.removeAttribute('name');
    }
    this.requestUpdate('name', old);
  }

  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    // Reflected before the recomputation below, because `internals.willValidate` answers from the
    // live host attribute rather than from this field.
    this.toggleAttribute('disabled', this._disabled);
    if (this._disabled) this.hide();
    // Disabling bars constraint validation, so the intrinsic violation and the `invalid`/
    // `user-invalid` states go with it — synchronously, so a same-tick `checkValidity()` answers
    // from the new state rather than from the previous render's.
    this.updateValidity();
    this.requestUpdate('disabled', old);
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

  /** Whether the control is disabled explicitly or by an ancestor fieldset. */
  get effectiveDisabled(): boolean {
    return this.disabled || this._fieldsetDisabled;
  }

  /**
   * Recomputes the intrinsic `valueMissing` constraint.
   *
   * A control barred from constraint validation (own `disabled`, an ancestor `<fieldset disabled>`,
   * or any platform condition `internals.willValidate` folds in) reports no violation at all,
   * exactly like a native control — a real `<input required disabled>` matches neither `:valid` nor
   * `:invalid`. Without this guard a `<lr-locale-picker required disabled>` kept publishing
   * `valueMissing` and `:state(invalid)`, which is what painted every disabled picker with the
   * documented `lr-locale-picker:state(user-invalid)` error styling.
   */
  private updateValidity(): void {
    if (this.isBarred()) {
      this.validityController.setValidity({});
    } else if (this.required && !this._value) {
      this.validityController.setValidity({ valueMissing: true }, this.localize('localePickerRequired'));
    } else {
      this.validityController.setValidity({});
    }
    this.syncCustomStates();
  }

  /** Whether constraint validation is currently barred. Shares the library-wide predicate rather
   *  than re-listing the conditions, so this control cannot implement three of them and miss the
   *  fourth. This picker has no `readonly` of its own; the shared predicate simply never sees one. */
  private isBarred(): boolean {
    return isBarredFromValidation(this, this.internals);
  }

  /**
   * Publishes the six validity custom states (`:state(required)`/`optional`, `valid`/`invalid`,
   * `user-valid`/`user-invalid`). Shared implementation in `internal/custom-states.ts`: this
   * component drives `ElementInternals` directly rather than through the `FormAssociated` mixin,
   * so it calls the helper itself instead of inheriting the call. `touched` is its own interaction
   * flag (set when the trigger blurs), which is what keeps the `user-*` pair off a pristine
   * control the way native `:user-invalid` does.
   */
  private syncCustomStates(): void {
    syncValidityStates(this.internals, {
      required: this.required,
      hasInteracted: this.touched,
      barred: this.isBarred(),
    });
  }

  formResetCallback(): void {
    // Pristine again, so the `user-*` states stop matching even though a required picker is
    // immediately invalid once more. The `value` write below re-runs updateValidity() (and
    // therefore syncCustomStates()) with this flag already cleared.
    this.touched = false;
    this.restoreLiveValueFromDefault();
  }
  private restoreLiveValueFromDefault(): void {
    this.settingDefaultValue = true;
    try { this.value = this._defaultValue; }
    finally { this.settingDefaultValue = false; }
    this._valueDirty = false;
  }
  formStateRestoreCallback(
    state: string | File | FormData | null,
    _mode?: 'restore' | 'autocomplete',
  ): void {
    this.value = typeof state === 'string' ? state : '';
  }
  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
    if (disabled) this.hide();
    // Cascaded disablement bars constraint validation exactly like the control's own `disabled`, so
    // validity is recomputed here rather than merely re-rendered — recording the flag alone left
    // `valueMissing` (and `:state(invalid)`) raised on every required picker inside a
    // `<fieldset disabled>`.
    this.updateValidity();
    this.requestUpdate();
  }
  checkValidity(): boolean {
    return this.internals.checkValidity();
  }
  reportValidity(): boolean {
    // Reporting is what a submit attempt does, and a failed submit is precisely when native
    // `:user-invalid` starts matching — so it counts as interaction, exactly as it does in the
    // `FormAssociated` mixin.
    this.touched = true;
    this.syncCustomStates();
    return this.internals.reportValidity();
  }

  /**
   * Sets or clears a consumer-supplied validation error — the standard channel for a server-side
   * rejection ("that locale is not enabled for your account") that no client-side constraint can
   * express. A non-empty `message` raises `customError` and becomes `validationMessage`, so the
   * control fails `checkValidity()`, blocks form submission, and matches `:state(invalid)`; `''`
   * clears it.
   *
   * Clearing restores the control's own computed validity rather than forcing it valid: a required
   * picker with nothing committed stays `valueMissing`. The custom error also survives every
   * intrinsic recomputation in between (each `value`/`required` change re-runs `updateValidity()`)
   * and a form reset, exactly like a native control — only another `setCustomValidity('')` clears
   * it.
   *
   * The message is caller-supplied content, so it is used verbatim and never localized here.
   */
  setCustomValidity(message: string): void {
    this.validityController.setCustomValidity(message ?? '');
    this.syncCustomStates();
    // `updated()`'s own `data-invalid` branch only runs for a `touched`/`required`/`value` change,
    // none of which this is, so the styling hook is written here directly; the `requestUpdate()`
    // re-renders `aria-invalid`, which reads the same freshly-moved `internals.validity`.
    this.toggleAttribute('data-invalid', this.touched && !this.internals.validity.valid);
    this.requestUpdate();
  }

  /** `locales` normalized to `{ tag, label }[]`: every explicit catalog wins outright, including
   *  an empty array; only `undefined` selects every locale
   *  `getRegisteredLyraLocales()` currently reports. */
  private get normalizedEntries(): NormalizedLocaleEntry[] {
    const raw = this.locales;
    if (raw !== undefined) {
      return raw.map((entry): NormalizedLocaleEntry =>
        typeof entry === 'string'
          ? { tag: entry, label: localeNativeName(entry) }
          : { tag: entry.tag, label: entry.label ?? localeNativeName(entry.tag), country: entry.country },
      );
    }
    return getRegisteredLyraLocales().map((tag) => ({ tag, label: localeNativeName(tag) }));
  }

  /** The tag actually shown in the trigger: the committed `value` once set, else a live preview
   *  of `effectiveLocale` -- never a committed selection, see the class doc's value/preview
   *  split. */
  private get previewTag(): string {
    return this._value || this.effectiveLocale;
  }

  private entryFor(tag: string): NormalizedLocaleEntry | undefined {
    return this.normalizedEntries.find((e) => e.tag === tag);
  }

  private labelFor(tag: string): string {
    return this.entryFor(tag)?.label ?? localeNativeName(tag);
  }

  private show(): void {
    if (this.open || this.liveDisabled) return;
    this.open = true;
  }
  private hide(): void {
    if (!this.open) return;
    this.open = false;
    this.setActiveIndex(-1);
  }
  private onDocPointer = (e: PointerEvent): void => {
    if (!e.composedPath().includes(this)) this.hide();
  };

  private bindDocumentPointer(): void {
    if (!this.isConnected) return;
    const ownerDocument = this.ownerDocument;
    if (this.pointerListenerDocument === ownerDocument && this.pointerListener) return;
    this.unbindDocumentPointer();
    const listener = (event: PointerEvent): void => {
      if (
        this.pointerListener !== listener ||
        this.pointerListenerDocument !== ownerDocument ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      this.onDocPointer(event);
    };
    this.pointerListenerDocument = ownerDocument;
    this.pointerListener = listener;
    ownerDocument.addEventListener('pointerdown', listener);
  }

  private unbindDocumentPointer(): void {
    if (this.pointerListenerDocument && this.pointerListener) {
      this.pointerListenerDocument.removeEventListener('pointerdown', this.pointerListener);
    }
    this.pointerListenerDocument = undefined;
    this.pointerListener = undefined;
  }

  private syncPopup(): void {
    this.cleanup?.();
    this.cleanup = undefined;
    if (!this.open || !this.isConnected) {
      this.unbindDocumentPointer();
      return;
    }
    this.bindDocumentPointer();
    const anchor = this.renderRoot.querySelector('[part="trigger"]') as HTMLElement | null;
    const listbox = this.renderRoot.querySelector('[part="listbox"]') as HTMLElement | null;
    if (anchor && listbox) this.cleanup = place(anchor, listbox);
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const reposition =
      changed.has('open') || (this.open && (changed.has('locales') || changed.has('registryTick')));
    if (reposition) {
      this.syncPopup();
    }
    if (changed.has('touched') || changed.has('required') || changed.has('value')) {
      this.toggleAttribute('data-invalid', this.touched && !this.internals.validity.valid);
    }
  }

  /** Commits `tag`: sets `value`, closes the popup, then emits a cancelable `lr-change` --
   *  applying `setLyraLocale(tag)` itself only when the listener doesn't veto it. Unconditional
   *  on every explicit pick (no reselect-guard), mirroring `<lr-model-select>`'s identical
   *  `commitValue()` -- the closest sibling precedent for this event shape. */
  private commit(tag: string): void {
    const previousValue = this._value;
    this.value = tag;
    this.hide();
    const event = this.emit(
      'lr-change',
      { value: tag, previousValue, direction: getLyraLocaleDirection(tag) },
      { cancelable: true },
    );
    if (!event.defaultPrevented) setLyraLocale(tag);
  }

  private onTriggerClick = (): void => {
    if (this.liveDisabled) return;
    this.open ? this.hide() : this.show();
  };
  private onTriggerBlur = (event: FocusEvent): void => {
    // The trigger's own `disabled` state becoming true force-blurs it when it currently holds
    // focus -- a platform reaction, not a user interaction. That blur can land synchronously
    // nested inside the very property write that disabled this control (before this update's
    // render has even reached the internal `<button>`'s `disabled` attribute), so
    // `effectiveDisabled` already reads true here whenever this is that case; marking `touched`
    // for it was, depending on timing, capable of reentering that same in-flight update for a
    // state flip nothing observable needed -- a disabled control is barred from validation
    // regardless.
    if (!this.liveDisabled) this.touched = true;
    // Synchronously, not from `updated()`: `:state(user-invalid)` has to be true the moment focus
    // leaves, the same instant native `:user-invalid` starts matching.
    this.syncCustomStates();
    this.hide();
    relayNativeEvent(this, event);
  };
  private onTriggerFocus = (event: FocusEvent): void => {
    if (this.liveDisabled) {
      event.stopPropagation();
      return;
    }
    relayNativeEvent(this, event);
  };

  private onLabelSlotChange = (e: Event): void => {
    this.hasLabelSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };
  private onHintSlotChange = (e: Event): void => {
    this.hasHintSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };
  private onErrorSlotChange = (e: Event): void => {
    this.hasErrorSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  /** Standard listbox type-ahead: moves to the next row whose native name starts with the
   *  accumulated buffer, cycling from just after the "current" row (the active row while open,
   *  the preview tag while closed). While open this only moves `activeIndex` (a highlight,
   *  matching Arrow-key nav); while closed it commits immediately, matching `<lr-select>`'s
   *  identical closed-state type-ahead. */
  private typeAhead(char: string): void {
    this.clearTypeAheadTimer();
    this.typeAheadBuffer += char.toLocaleLowerCase(this.effectiveLocale);
    const ownerWindow = this.ownerDocument.defaultView;
    if (this.isConnected && ownerWindow) {
      const generation = this.typeAheadTimerGeneration;
      this.typeAheadTimerWindow = ownerWindow;
      this.typeAheadTimer = ownerWindow.setTimeout(() => {
        if (
          this.typeAheadTimerGeneration !== generation ||
          !this.isConnected ||
          this.ownerDocument.defaultView !== ownerWindow
        ) {
          return;
        }
        this.typeAheadTimer = undefined;
        this.typeAheadTimerWindow = undefined;
        this.typeAheadBuffer = '';
      }, 500);
    }

    const rows = this.normalizedEntries;
    if (!rows.length) return;
    const currentTag = this.open ? rows[this.activeIndex]?.tag : this.previewTag;
    const currentIndex = rows.findIndex((r) => r.tag === currentTag);
    const n = rows.length;
    for (let step = 1; step <= n; step++) {
      const idx = (currentIndex + step + n) % n;
      const row = rows[idx]; // modulo n keeps idx in-bounds; guard satisfies the checker
      if (row && row.label.toLocaleLowerCase(this.effectiveLocale).startsWith(this.typeAheadBuffer)) {
        if (this.open) {
          this.setActiveIndex(idx);
        } else {
          this.commit(row.tag);
        }
        return;
      }
    }
  }

  private clearTypeAheadTimer(): void {
    this.typeAheadTimerGeneration += 1;
    if (this.typeAheadTimer !== undefined) {
      this.typeAheadTimerWindow?.clearTimeout(this.typeAheadTimer);
    }
    this.typeAheadTimer = undefined;
    this.typeAheadTimerWindow = undefined;
  }

  /** Updates active-descendant ownership and keeps the resulting row visible after render. */
  private setActiveIndex(index: number): void {
    const last = this.normalizedEntries.length - 1;
    const next = last < 0 || index < 0 ? -1 : Math.min(last, index);
    this.activeIndex = next;
    this.queueActiveScroll();
  }

  private queueActiveScroll(): void {
    const generation = ++this.activeScrollGeneration;
    const index = this.activeIndex;
    if (index < 0 || !this.open) return;
    void this.updateComplete.then(() => {
      if (
        generation !== this.activeScrollGeneration ||
        !this.isConnected ||
        !this.open ||
        this.activeIndex !== index
      ) return;
      this.shadowRoot?.getElementById(`${this.listId}-opt-${index}`)?.scrollIntoView({ block: 'nearest' });
    });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.liveDisabled) return;
    const rows = this.normalizedEntries;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!this.open) return this.show();
        this.setActiveIndex(Math.min(rows.length - 1, this.activeIndex + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!this.open) return this.show();
        this.setActiveIndex(Math.max(0, this.activeIndex - 1));
        break;
      case 'Enter':
      case ' ':
        // When closed, let the button's native Enter/Space activation fire its own click handler
        // (onTriggerClick) to open -- only intercept here to commit/dismiss while already open.
        if (this.open) {
          e.preventDefault();
          const activeRow = rows[this.activeIndex];
          if (this.activeIndex >= 0 && activeRow) {
            this.commit(activeRow.tag);
          } else {
            this.hide();
          }
        }
        break;
      case 'Escape':
        if (this.open) {
          e.preventDefault();
          this.hide();
        }
        break;
      case 'Home':
        if (this.open) {
          e.preventDefault();
          this.setActiveIndex(0);
        }
        break;
      case 'End':
        if (this.open) {
          e.preventDefault();
          this.setActiveIndex(rows.length - 1);
        }
        break;
      default:
        if (e.key.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey) {
          this.typeAhead(e.key);
        }
        break;
    }
  };

  // Delegated onto [part="listbox"] rather than one closure pair allocated per row per render --
  // resolves the target row via closest('[part="option"]') + a data-value lookup, mirroring
  // lr-select/lr-model-select.
  private onListboxMouseDown = (e: MouseEvent): void => {
    if ((e.target as HTMLElement).closest('[part="option"]')) e.preventDefault();
  };
  private onListboxClick = (e: MouseEvent): void => {
    if (this.liveDisabled) return;
    const optionEl = (e.target as HTMLElement).closest('[part="option"]') as HTMLElement | null;
    const tag = optionEl?.dataset['value'];
    if (tag === undefined) return;
    this.commit(tag);
  };

  private renderRows(rows: NormalizedLocaleEntry[], activeId: string): TemplateResult[] {
    return rows.map((entry, i) => {
      const id = `${this.listId}-opt-${i}`;
      const selected = entry.tag === this._value;
      return html`<div
        part="option"
        id=${id}
        role="option"
        data-value=${entry.tag}
        aria-selected=${selected ? 'true' : 'false'}
        ?data-active=${id === activeId}
      >
        ${this.showFlags
          ? entry.country
            ? html`<lr-flag part="option-flag" country=${entry.country} fidelity="compact" aria-hidden="true" inert></lr-flag>`
            : html`<lr-flag part="option-flag" language=${entry.tag} fidelity="compact" aria-hidden="true" inert></lr-flag>`
          : ''}
        <span part="option-label">
          <span>${entry.label}</span>
          <span part="option-tag">${entry.tag}</span>
        </span>
      </div>`;
    });
  }

  override render(): TemplateResult {
    const rows = this.normalizedEntries;
    const activeId = this.activeIndex >= 0 && rows[this.activeIndex] ? `${this.listId}-opt-${this.activeIndex}` : '';
    const previewTag = this.previewTag;
    const previewEntry = this.entryFor(previewTag);
    const hasLabel = this.hasLabelSlot || this.label.length > 0;
    const hasHint = this.hasHintSlot || this.hint.length > 0;
    const hasError = this.hasErrorSlot || this.errorText.length > 0;
    const describedBy = [hasError ? 'locale-picker-error' : '', hasHint ? 'locale-picker-hint' : '']
      .filter(Boolean)
      .join(' ');
    return html`
      <div part="form-control">
        <label part="form-control-label" for=${this.controlId} ?hidden=${!hasLabel}>
          ${this.label}<slot name="label" @slotchange=${this.onLabelSlotChange}></slot>
        </label>
        <button
          id=${this.controlId}
          part="trigger"
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded=${this.open ? 'true' : 'false'}
          aria-controls=${this.listId}
          aria-activedescendant=${activeId}
          aria-label=${hostAriaLabel(this) ?? (hasLabel ? nothing : this.localize('localePickerLabel'))}
          aria-describedby=${describedBy || nothing}
          aria-required=${this.required ? 'true' : 'false'}
          aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'}
          ?disabled=${this.effectiveDisabled}
          @click=${this.onTriggerClick}
          @keydown=${this.onKeyDown}
          @focus=${this.onTriggerFocus}
          @blur=${this.onTriggerBlur}
        >
          ${this.showFlags
            ? previewEntry?.country
              ? html`<lr-flag part="trigger-flag" country=${previewEntry.country} fidelity="compact" aria-hidden="true" inert></lr-flag>`
              : html`<lr-flag part="trigger-flag" language=${previewTag} fidelity="compact" aria-hidden="true" inert></lr-flag>`
            : ''}
          <span class="trigger-label">${this.labelFor(previewTag)}</span>
          <span part="expand-icon" aria-hidden="true" inert>${chevronIcon()}</span>
        </button>
        <div
          part="listbox"
          id=${this.listId}
          role="listbox"
          @mousedown=${this.onListboxMouseDown}
          @click=${this.onListboxClick}
        >
          ${this.renderRows(rows, activeId)}
        </div>
        <div id="locale-picker-error" part="error" ?hidden=${!hasError}>
          ${this.errorText}<slot name="error" @slotchange=${this.onErrorSlotChange}></slot>
        </div>
        <div id="locale-picker-hint" part="hint" ?hidden=${!hasHint}>
          ${this.hint}<slot name="hint" @slotchange=${this.onHintSlotChange}></slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-locale-picker': LyraLocalePicker;
  }
}
