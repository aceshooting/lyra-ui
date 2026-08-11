import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraSize, LyraSizeStep } from '../../../internal/variants.js';
import { sizes } from '../../../internal/sizes.styles.js';
import { AnchoredPopoverController } from '../../../internal/anchored-popover-controller.js';
import { nextId } from '../../../internal/a11y.js';
import { chevronIcon, playIcon, pauseIcon } from '../../../internal/icons.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import {
  attachInternalsSafely,
  getFormOwner,
  installCustomErrorProperty,
  isBarredFromValidation,
  setFormOwner,
  type FormOwnerValue,
} from '../../../internal/form-associated.js';
import { installInvalidEventAlias } from '../../../internal/invalid-event-alias.js';
import { syncValidityStates } from '../../../internal/custom-states.js';
import { safeMediaSrc } from '../../../internal/safe-url.js';
import { styles } from './voice-picker.styles.js';
import { trueDefaultBooleanConverter, trueDefaultSpellcheckConverter as spellcheckConverter } from '../../../internal/converters.js';
import {
  filterCatalogEntries,
  normalizeCatalog,
  withSyntheticCatalogValue,
  type DisplayCatalogEntry,
} from '../../../internal/catalog-picker.js';
import { activeElementIn } from '../../../internal/active-element.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_noMatches, LYRA_DEFAULT_notInCatalog, LYRA_DEFAULT_open, LYRA_DEFAULT_restore, LYRA_DEFAULT_voice, LYRA_DEFAULT_voicePickerNoVoices, LYRA_DEFAULT_voicePickerPreview, LYRA_DEFAULT_voicePickerRequired, LYRA_DEFAULT_voicePickerStopPreview } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/**
 * `true`-defaulting boolean attribute converter for `preview`. Lit's built-in `type: Boolean`
 * converter is presence-based -- the attribute's mere presence (regardless of its string value)
 * maps to `true`, so a plain-markup consumer writing the literal `preview="false"` would actually
 * get `true` (this property's default) -- the same bug class `spellcheckConverter` above and
 * `<lr-checkpoint>`'s `restorable`/`confirmRestore` converters document and fix.
 */

/** A catalog row: a selectable TTS voice. */
export interface LyraVoiceCatalogEntry {
  id: string;
  label: string;
  /** Rendered (with `description`) as a quiet `[part="option-meta"]` second line. */
  language?: string;
  description?: string;
  /** A sample-audio URL; validated via `safeMediaSrc()` before ever reaching an `<audio src>`. */
  previewUrl?: string;
}

/**
 * Either every entry is a plain string (used as both id and label) or every entry is a full
 * `{ id, label, ... }` row -- not a mix of both, mirroring `LyraModelCatalog`'s identical contract.
 */
export type LyraVoiceCatalog = string[] | LyraVoiceCatalogEntry[];

/** The canonical step a `size` resolves to — an alias of the shared {@linkcode LyraSizeStep}.
 * The public `size` property also accepts the `small`/`medium`/`large` aliases in
 * {@linkcode LyraSize}. */
export type LyraVoicePickerSize = LyraSizeStep;

/** Direction reported by the free-text input's native selection APIs. */
export type LyraVoicePickerSelectionDirection = 'forward' | 'backward' | 'none';

/** A catalog row plus whether it's the synthetic "stale value" row — see `effectiveEntries`. */
type DisplayEntry = DisplayCatalogEntry<LyraVoiceCatalogEntry>;

export interface LyraVoicePickerEventMap {
  'lr-invalid': CustomEvent<undefined>;
  'lr-change': CustomEvent<{ value: string; inCatalog: boolean }>;
  'lr-preview-request': CustomEvent<{ voiceId: string; previewUrl?: string }>;
  'lr-preview-change': CustomEvent<{ voiceId: string | null }>;
  input: Event;
  change: Event;
  blur: CustomEvent<undefined>;
  focus: CustomEvent<undefined>;
}

/**
 * `<lr-voice-picker>` — a TTS voice selector over a host-supplied `catalog`, mirroring
 * `lr-model-select`'s closed-dropdown/free-text-combobox dual mode, stale-value handling, and
 * form-association verbatim (see that class's own doc for the full mode-switching contract this one
 * shares), extended with a TTS-agnostic preview affordance: a standalone, always-tab-reachable
 * `[part="preview-button"]` beside the trigger previews the active option while open, else the
 * committed value; per-row `[part="option-preview"]` icons are pointer-only duplicates
 * (`tabindex="-1"`, `aria-hidden="true"`) since a listbox option must not contain a focusable
 * descendant.
 *
 * Preview is event-first: `lr-preview-request` always fires first and is cancelable. Left
 * un-prevented, a `previewUrl` plays through one internal native `<audio>` (the URL passes
 * `safeMediaSrc()` first); `preventDefault()` or no URL leaves playback entirely to the host's own
 * TTS. Requesting the same voice while it is already playing internally stops it instead of
 * re-requesting; requesting a different voice switches. `lr-preview-change` reports internal
 * playback start/stop (`voiceId: null` on stop/end/error).
 *
 * In free-text mode, `input` and the native selection/range-editing APIs expose the editable
 * combobox text. `setRangeText()` synchronizes `value`, form data, and validity without emitting
 * user-input events. These APIs are no-ops in closed-dropdown mode and before render.
 *
 * @customElement lr-voice-picker
 * @slot label - Custom visible label content.
 * @slot hint - Custom hint content.
 * @slot error - Custom error content.
 * @cssstate required - Matches while `required` is set. Style with `lr-voice-picker:state(required)`.
 * @cssstate optional - Matches while `required` is not set — the complement of `required`.
 * @cssstate valid - Matches while the control satisfies its constraints, including any
 * `setCustomValidity()` error.
 * @cssstate invalid - Matches while it does not — from the very first render, before the user has
 * touched anything.
 * @cssstate user-valid - `valid`, but only after the user has interacted: a blur of the
 * trigger/combobox, or a `reportValidity()` call (which is what a submit attempt runs).
 * @cssstate user-invalid - `invalid` after that same interaction. Style validation errors with this
 * rather than `invalid`: a pristine required picker is genuinely invalid, but colouring it red
 * before the user has done anything is hostile.
 * @event lr-change - `detail: { value: string; inCatalog: boolean }`.
 * @event {Event} change - Fired alongside `lr-change`, mirroring `lr-model-select`'s native-style pair.
 * @event {Event} input - Fired alongside `change`/`lr-change`.
 * @event blur - Re-dispatched from the free-text mode's internal `<input>`'s own `blur` (bubbling,
 *   composed, unlike the native event).
 * @event focus - Re-dispatched from the free-text mode's internal `<input>`'s own `focus`.
 * @event lr-preview-request - `detail: { voiceId: string; previewUrl?: string }`. Cancelable.
 * @event lr-preview-change - `detail: { voiceId: string | null }` — internal playback started
 *   (`voiceId`) or stopped (`null`).
 * @event lr-invalid - The picker failed a validity check. Cancelable: calling `preventDefault()`
 *   also cancels the native `invalid` event behind it, suppressing the browser's own validation
 *   bubble so an app can present the failure its own way.
 * @attr size - Visual size on the shared six-tier control ladder (`2xs`–`xl`, default `m`). The
 *   `small`/`medium`/`large` aliases render as `s`/`m`/`l`. Preview actions retain the shared 40px
 *   minimum hit area even when the field chrome uses a smaller tier.
 * @csspart form-control - The complete label, control, hint, error, and listbox frame.
 * @csspart form-control-label - The `<label>` element containing the `label` property and slot.
 * @csspart trigger - The trigger button (closed-dropdown mode).
 * @csspart combobox - The text-input container (free-text mode).
 * @csspart combobox-input - The free-text `<input>`.
 * @csspart provider-badge - The optional leading `provider` label.
 * @csspart listbox - The options popover.
 * @csspart option - An option row.
 * @csspart option-label - An option row's label/meta wrapper.
 * @csspart option-meta - An option row's quiet `language · description` second line.
 * @csspart option-badge - The "not in catalog" badge on a synthetic stale-value row.
 * @csspart option-preview - A pointer-only per-row preview icon (`tabindex="-1"`, `aria-hidden`).
 * @csspart preview-button - The standalone, keyboard-reachable preview toggle beside the trigger.
 * @csspart expand-icon - The dropdown indicator.
 * @csspart empty - The empty-listbox message.
 * @csspart hint - The hint message.
 * @csspart error - The error message.
 * @cssprop [--lr-voice-picker-preview-active-border=var(--lr-color-brand)] - Active preview border.
 * @cssprop [--lr-voice-picker-preview-active-color=var(--lr-color-brand)] - Active preview icon.
 * @cssprop [--lr-voice-picker-open-border-color=var(--lr-color-brand)] - Open trigger border color.
 * @cssprop [--lr-voice-picker-option-active-bg=var(--lr-color-brand-quiet)] - Active option fill.
 * @cssprop [--lr-voice-picker-option-selected-border=var(--lr-color-brand)] - Selected option border.
 * @cssprop [--lr-voice-picker-option-selected-color=var(--lr-color-brand)] - Selected option text.
 * @cssprop [--lr-voice-picker-option-selected-bg=transparent] - Selected option fill.
 * @cssprop [--lr-voice-picker-option-selected-font-weight=var(--lr-font-weight-semibold)] -
 *   Selected option label weight.
 * @cssprop [--lr-voice-picker-option-synthetic-border-style=dashed] - Border style of a synthetic
 *   stale-value option row.
 * @cssprop [--lr-voice-picker-option-synthetic-border-color=var(--lr-color-border)] - Border color
 *   of a synthetic stale-value option row.
 * @cssprop [--lr-voice-picker-option-synthetic-font-style=italic] - Font style of a synthetic
 *   stale-value option label.
 * @cssprop [--lr-voice-picker-preview-hover-bg=var(--lr-color-brand-quiet)] - Preview hover fill.
 * @cssprop [--lr-voice-picker-preview-hover-color=var(--lr-color-brand)] - Preview hover icon.
 * @cssprop [--lr-form-control-required-content=' *'] - The required marker appended to
 *   `form-control-label` while `required` is set. Set it to `''` to suppress the marker, or to any
 *   other quoted string (`' (required)'`, a localized word) to replace it.
 * @cssprop [--lr-form-control-required-color=var(--lr-color-danger)] - Required-marker color,
 *   themeable independently of error text and invalid borders.
 * @cssprop [--lr-form-control-required-offset=0] - Inline space between the label text and the
 *   required marker.
 * @status stable
 * @since 4.0.0
 */
export class LyraVoicePicker extends LyraElement<LyraVoicePickerEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    noMatches: LYRA_DEFAULT_noMatches,
    notInCatalog: LYRA_DEFAULT_notInCatalog,
    open: LYRA_DEFAULT_open,
    restore: LYRA_DEFAULT_restore,
    voice: LYRA_DEFAULT_voice,
    voicePickerNoVoices: LYRA_DEFAULT_voicePickerNoVoices,
    voicePickerPreview: LYRA_DEFAULT_voicePickerPreview,
    voicePickerRequired: LYRA_DEFAULT_voicePickerRequired,
    voicePickerStopPreview: LYRA_DEFAULT_voicePickerStopPreview,
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

  /** Informational only (e.g. `'elevenlabs'`); rendered as a small leading badge. */
  @property() provider = '';
  /** The full voice list. Omit (or leave empty) to fall back to plain free-text entry. */
  @property({ attribute: false }) catalog?: LyraVoiceCatalog;
  /** Let the user type/commit a value that isn't in `catalog`, even when `catalog` is non-empty. */
  @property({ type: Boolean, reflect: true, attribute: 'allow-custom' }) allowCustom = false;
  /** Whether to render preview affordances at all. */
  @property({ reflect: true, converter: trueDefaultBooleanConverter }) preview = true;
  /** Visible label text. The `label` slot appends custom label content to the same native label. */
  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  @property() placeholder = '';
  @property({ converter: spellcheckConverter }) override spellcheck = true;
  @property() override autocapitalize = '';
  @property({ attribute: 'autocorrect' }) autoCorrect = '';
  @property() autocomplete = 'off';
  @property({ attribute: 'inputmode' }) override inputMode = '';
  @property({ attribute: 'enterkeyhint' }) override enterKeyHint = '';
  @property({ type: Boolean, reflect: true }) open = false;
  /** Visual size on the shared six-tier control ladder. `small`/`medium`/`large` alias
   *  `s`/`m`/`l`; the preview action keeps the library-wide 40px minimum hit area. */
  @property({ reflect: true }) size: LyraSize = 'm';

  @state() private activeIndex = -1;
  @state() private query = '';
  @state() private touched = false;
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;
  private readonly slotPresence = new SlotPresenceController(this);
  /** The voiceId currently playing via the internal `<audio>` (`null` when nothing is). */
  @state() private previewingId: string | null = null;

  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  /** Consumer-supplied validation message reflected through `custom-error`. */
  declare customError: string | null;
  private listId = nextId('voice-picker-list');
  private controlId = nextId('voice-picker-control');
  private popupPosition = new AnchoredPopoverController();
  private pointerListenerDocument?: Document;
  private pointerListener?: (event: PointerEvent) => void;
  private audioEl?: HTMLAudioElement;
  private _value = '';
  private _fieldsetDisabled = false;
  private _name = '';
  private _disabled = false;
  private _required = false;
  private _defaultValue = '';
  private _valueDirty = false;
  private settingDefaultValue = false;
  private reflectingDefaultValue = false;
  private suppressControlEvents = false;
  private transferControlFocus = false;

  constructor() {
    super();
    // `<lr-voice-picker>` manages ElementInternals directly (its value is a catalog id, not the
    // plain string the `FormAssociated` mixin's contract assumes), but shares the mixin's
    // attach-or-degrade helper so both paths handle a missing *and* a throwing `attachInternals()`.
    this.internals = attachInternalsSafely(this);
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
    installCustomErrorProperty(this, () => this.validityController.customValidityMessage);
    installInvalidEventAlias(this, (init: { cancelable: true }) =>
      this.emit('lr-invalid', undefined, init));
    this.internals.setFormValue('');
  }

  get form(): HTMLFormElement | null {
    return getFormOwner(this.internals);
  }
  set form(owner: FormOwnerValue) {
    setFormOwner(this, owner);
  }
  /** Returns the browser-resolved owning form, including an external owner selected by `form`. */
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
    return this.renderRoot?.querySelector('[part="trigger"], [part="combobox-input"]') ?? null;
  }

  /**
   * Forwards to whichever internal control the current mode renders, since
   * `HTMLElement.prototype.click()` is otherwise a no-op on a custom element with no native click
   * semantics of its own (mirrors `<lr-button>`'s identical forwarding override). Closed-dropdown
   * mode forwards a real `.click()` to the trigger `<button>`, whose own `@click` handler opens
   * it. Free-text mode instead calls `.focus()` on the combobox `<input>`: opening there is wired
   * to the native `focus` event (`onInputFocus`), and unlike a `<button>`, a synthetic
   * `.click()` on a text `<input>` does not itself dispatch `focus` -- browsers only focus a text
   * control from a real click's `mousedown` default action, which `.click()` skips -- so
   * `.focus()` is what actually reproduces a real click's end-user-visible effect here.
   */
  override click(): void {
    const trigger = this.renderRoot?.querySelector('[part="trigger"]') as HTMLButtonElement | null;
    if (trigger) {
      trigger.click();
      return;
    }
    (this.renderRoot?.querySelector('[part="combobox-input"]') as HTMLInputElement | null)?.focus();
  }

  override focus(options?: FocusOptions): void {
    (
      this.renderRoot.querySelector('[part="trigger"], [part="combobox-input"]') as HTMLElement | null
    )?.focus(options);
  }

  override blur(): void {
    (
      this.renderRoot.querySelector('[part="trigger"], [part="combobox-input"]') as HTMLElement | null
    )?.blur();
  }

  /** The native editable input in free-text mode, or `null` in closed-dropdown mode and before render. */
  get input(): HTMLInputElement | null {
    return this.renderRoot?.querySelector<HTMLInputElement>('[part="combobox-input"]') ?? null;
  }

  get selectionStart(): number | null {
    return this.input?.selectionStart ?? null;
  }

  set selectionStart(value: number | null) {
    if (this.input) this.input.selectionStart = value;
  }

  get selectionEnd(): number | null {
    return this.input?.selectionEnd ?? null;
  }

  set selectionEnd(value: number | null) {
    if (this.input) this.input.selectionEnd = value;
  }

  get selectionDirection(): LyraVoicePickerSelectionDirection | null {
    return (this.input?.selectionDirection as LyraVoicePickerSelectionDirection | undefined) ?? null;
  }

  set selectionDirection(value: LyraVoicePickerSelectionDirection | null) {
    if (this.input) this.input.selectionDirection = value;
  }

  /** Selects all editable text in free-text mode; otherwise a no-op. */
  select(): void {
    this.input?.select();
  }

  /** Forwards the native selection range in free-text mode; otherwise a no-op. */
  setSelectionRange(
    start: number | null,
    end: number | null,
    direction?: LyraVoicePickerSelectionDirection,
  ): void {
    this.input?.setSelectionRange(start, end, direction);
  }

  setRangeText(replacement: string): void;
  setRangeText(replacement: string, start: number, end: number, selectMode?: SelectionMode): void;
  /**
   * Applies a silent native range edit in free-text mode and synchronizes the committed value,
   * form entry, and validity. Closed-dropdown mode and pre-render calls are no-ops.
   */
  setRangeText(replacement: string, start?: number, end?: number, selectMode?: SelectionMode): void {
    const input = this.input;
    if (!input) return;
    if (start === undefined || end === undefined) {
      input.setRangeText(replacement);
    } else {
      input.setRangeText(replacement, start, end, selectMode);
    }
    this.query = input.value;
    this.activeIndex = -1;
    this.value = input.value;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.updateValidity();
    if (this.hasUpdated && this.open) queueMicrotask(() => this.syncPopup());
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (this.hasUpdated) {
      const renderedClosedMode = this.renderRoot.querySelector('[part="trigger"]') !== null;
      const switchingMode = renderedClosedMode !== this.closedMode;
      const focused = activeElementIn(this.shadowRoot ?? this.ownerDocument);
      this.suppressControlEvents = switchingMode;
      this.transferControlFocus =
        switchingMode &&
        focused?.nodeType === 1 &&
        (focused as Element).matches('[part="trigger"], [part="combobox-input"]');
    }
    if (!this.hasUpdated) {
      this.hasHintSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'hint');
      this.hasErrorSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'error');
    }
    if (
      this.hasUpdated &&
      (changed.has('catalog') || changed.has('allowCustom') || changed.has('value'))
    ) {
      const activeValue = (
        this.renderRoot.querySelector('[part="option"][data-active]') as HTMLElement | null
      )?.dataset['value'];
      const rows = this.closedMode ? this.effectiveEntries : this.filteredEntries;
      const remapped = activeValue ? rows.findIndex((entry) => entry.id === activeValue) : -1;
      this.activeIndex =
        remapped >= 0 ? remapped : Math.min(this.activeIndex, Math.max(-1, rows.length - 1));
    }
    if (changed.has('preview') && !this.preview) this.stopInternalPreview();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.popupPosition.disconnect();
    this.unbindDocumentPointer();
    this.stopInternalPreview();
    this.open = false;
  }

  adoptedCallback(): void {
    this.popupPosition.disconnect();
    this.unbindDocumentPointer();
    this.stopInternalPreview();
  }

  /** The current voice id (empty string when nothing is selected). */
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
    if (this._disabled) {
      this.hide();
      this.stopInternalPreview();
    }
    // Disabling bars constraint validation, so the intrinsic violation has to be dropped with it --
    // synchronously, for the same reason the attribute is reflected synchronously.
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
   * Shared with every other form control: own `disabled` and a `<fieldset disabled>` ancestor bar
   * constraint validation (this picker has no `readonly` of its own). A barred control matches
   * neither `:valid` nor `:invalid` natively, so leaving `valueMissing` raised on a disabled
   * required picker is what painted it red under the documented `:state(user-invalid)` rule.
   */
  private get barredFromValidation(): boolean {
    return isBarredFromValidation(this, this.internals);
  }

  private updateValidity(): void {
    if (this.barredFromValidation) {
      this.validityController.setValidity({});
    } else if (this.required && !this._value) {
      this.validityController.setValidity({ valueMissing: true }, this.localize('voicePickerRequired'));
    } else {
      this.validityController.setValidity({});
    }
    this.publishValidityStates();
  }

  /** Republishes the six validity custom states. Driven from every place validity or interaction
   *  can move -- {@linkcode updateValidity}, `reportValidity()`, and `updated()` -- because this
   *  control drives `ElementInternals` directly rather than through the `FormAssociated` mixin,
   *  which does this for the controls that do use it. `touched` is the interaction flag: it flips
   *  on the trigger's/input's first blur, and on a `reportValidity()` call, which is what a submit
   *  attempt runs. */
  private publishValidityStates(): void {
    syncValidityStates(this.internals, {
      required: this.required,
      hasInteracted: this.touched,
      barred: this.barredFromValidation,
    });
  }

  formResetCallback(): void {
    this.touched = false;
    this.restoreLiveValueFromDefault();
  }
  private restoreLiveValueFromDefault(): void {
    this.settingDefaultValue = true;
    try { this.value = this._defaultValue; }
    finally { this.settingDefaultValue = false; }
    this._valueDirty = false;
  }
  formStateRestoreCallback(state: string | File | FormData | null, _mode?: 'restore' | 'autocomplete'): void {
    this.value = typeof state === 'string' ? state : '';
  }
  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
    if (disabled) {
      this.hide();
      this.stopInternalPreview();
    }
    // Cascaded disablement bars constraint validation exactly like the control's own `disabled`.
    this.updateValidity();
    this.requestUpdate();
  }
  checkValidity(): boolean {
    return this.internals.checkValidity();
  }
  reportValidity(): boolean {
    // A reportValidity() call is what a submit attempt runs, and it is the moment native controls
    // start matching :user-invalid -- so it counts as interaction here too. `touched` also gates
    // the data-invalid/aria-invalid reflection, which is the point: after a rejected submit the
    // control should read as invalid, not stay pristine.
    this.touched = true;
    this.publishValidityStates();
    return this.internals.reportValidity();
  }

  /**
   * Sets or clears a consumer-supplied validation error — the standard channel for a server-side
   * rejection ("that voice is not enabled for your account") that no client-side constraint can
   * express. A non-empty `message` raises `customError` and becomes `validationMessage`, so the
   * control fails `checkValidity()`, blocks submission, and matches `:state(invalid)`; `''` clears
   * it.
   *
   * Clearing restores the control's own computed validity rather than forcing it valid: a
   * `required` picker with no value stays `valueMissing`. The custom error also survives every
   * intrinsic recomputation in between (each `value`/`required` change re-runs `updateValidity()`)
   * and a `form.reset()` — matching a native control, where only another `setCustomValidity('')`
   * clears it.
   *
   * The message is caller-supplied content, so it is used verbatim and never localized here.
   */
  setCustomValidity(message: string): void {
    this.validityController.setCustomValidity(message ?? '');
    this.publishValidityStates();
  }

  /** `catalog`, normalized to `{ id, label, ... }[]` regardless of the plain-string-array shorthand. */
  private get normalizedCatalog(): LyraVoiceCatalogEntry[] {
    return normalizeCatalog<LyraVoiceCatalogEntry>(this.catalog);
  }

  /** Closed-dropdown-with-listbox mode vs. free-text filterable mode — see class doc. */
  private get closedMode(): boolean {
    return this.normalizedCatalog.length > 0 && !this.allowCustom;
  }

  /**
   * `normalizedCatalog` plus, when `value` isn't one of its ids, a synthetic trailing row for it —
   * recomputed from scratch on every access so it always reflects the *current* `catalog`/`value`,
   * never a snapshot from whenever `value` happened to be assigned.
   */
  private get effectiveEntries(): DisplayEntry[] {
    return withSyntheticCatalogValue(this.normalizedCatalog, this._value);
  }

  /** `effectiveEntries` filtered by the typed `query` (free-text mode only; id, label, language, or
   *  description substring, case-insensitive). */
  private get filteredEntries(): DisplayEntry[] {
    return filterCatalogEntries(this.effectiveEntries, this.query, this.effectiveLocale, (entry) => [
      entry.id,
      entry.label,
      entry.language ?? '',
      entry.description ?? '',
    ]);
  }

  private labelFor(id: string): string {
    if (!id) return '';
    return this.effectiveEntries.find((e) => e.id === id)?.label ?? id;
  }

  private show(): void {
    if (this.open || this.effectiveDisabled) return;
    this.open = true;
  }
  private hide(): void {
    if (!this.open) return;
    this.open = false;
    this.activeIndex = -1;
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
    this.popupPosition.disconnect();
    if (!this.open || !this.isConnected) {
      this.unbindDocumentPointer();
      return;
    }
    this.bindDocumentPointer();
    const anchor = this.renderRoot.querySelector(
      this.closedMode ? '[part="trigger"]' : '[part="combobox"]',
    ) as HTMLElement | null;
    const listbox = this.renderRoot.querySelector('[part="listbox"]') as HTMLElement | null;
    if (anchor && listbox) this.popupPosition.reposition(anchor, listbox);
  }

  protected override updated(changed: PropertyValues): void {
    const reposition = changed.has('open') || (this.open && (changed.has('catalog') || changed.has('allowCustom')));
    if (reposition) {
      this.syncPopup();
    }
    if (changed.has('required') || changed.has('touched') || changed.has('value')) {
      this.toggleAttribute('data-invalid', this.touched && !this.internals.validity.valid);
    }
    // Unconditional, unlike the data-invalid reflection above: it also has to run on the FIRST
    // update, so a control that is never touched still publishes `optional`/`valid` (or
    // `required`/`invalid`) for a consumer's :state() rule to match from the moment it mounts.
    this.publishValidityStates();
    if (this.transferControlFocus) {
      this.transferControlFocus = false;
      (
        this.renderRoot.querySelector('[part="trigger"], [part="combobox-input"]') as HTMLElement | null
      )?.focus();
    }
    this.suppressControlEvents = false;
  }

  private commitValue(next: string): void {
    const inCatalog = this.normalizedCatalog.some((e) => e.id === next);
    this.value = next;
    this.hide();
    this.emit('lr-change', { value: next, inCatalog });
    this.emitValueEvents();
  }

  /** Dispatches the platform-style value-event pair alongside `lr-change`, mirroring
   *  `lr-model-select` so native form bindings and framework `v-model` handlers behave
   *  consistently across the picker family. */
  private emitValueEvents(): void {
    const EventConstructor = this.ownerDocument.defaultView?.Event ?? Event;
    const init: EventInit = { bubbles: true, composed: true };
    this.dispatchEvent(new EventConstructor('input', init));
    this.dispatchEvent(new EventConstructor('change', init));
  }

  private selectEntry(entry: DisplayEntry): void {
    this.commitValue(entry.id);
  }

  /** Enter in free-text mode: commit the highlighted suggestion, else the raw typed text. */
  private commitFreeText(): void {
    const rows = this.filteredEntries;
    const activeRow = rows[this.activeIndex];
    if (this.activeIndex >= 0 && activeRow) {
      this.commitValue(activeRow.id);
      return;
    }
    this.commitValue(this.query.trim());
  }

  // -- Preview -------------------------------------------------------------

  /** The candidate the standalone preview button acts on: the active option while open, else the
   *  committed value. */
  private get previewCandidateId(): string {
    if (this.open && this.activeIndex >= 0) {
      const rows = this.closedMode ? this.effectiveEntries : this.filteredEntries;
      return rows[this.activeIndex]?.id ?? this._value;
    }
    return this._value;
  }

  private requestPreview(voiceId: string): void {
    if (!voiceId) return;
    const entry = this.effectiveEntries.find((e) => e.id === voiceId);
    const previewUrl = entry?.previewUrl;
    const event = this.emit(
      'lr-preview-request',
      { voiceId, previewUrl },
      { cancelable: true },
    );
    if (!event.defaultPrevented && previewUrl) this.playInternal(voiceId, previewUrl);
  }

  private playInternal(voiceId: string, url: string): void {
    const safe = safeMediaSrc(url);
    if (!safe) return;
    this.stopInternalPreview();
    const audio = this.ownerDocument.createElement('audio');
    audio.src = safe;
    audio.addEventListener('ended', this.onAudioEnded);
    audio.addEventListener('error', this.onAudioLoadFailure);
    this.audioEl = audio;
    this.previewingId = voiceId;
    void audio.play().catch(() => this.onAudioLoadFailure(audio));
    this.emit('lr-preview-change', { voiceId });
  }

  private onAudioEnded = (event: Event): void => {
    if (event.currentTarget !== this.audioEl) return;
    this.stopInternalPreview();
  };

  /**
   * A rejected `play()` or a media `error` event means only that *this specific* audio resource
   * failed to load/play. It must not flip the public "playing" toggle out from under a caller who
   * may have already toggled it off or requested a different voice by the time this settles --
   * network timing is inherently unpredictable and racing it against user interaction would make
   * the toggle state nondeterministic. Release the dead resource quietly instead of routing through
   * `stopInternalPreview()`; the affordance stays pressed until the user's own next toggle or
   * request clears it. `audioEl` already pointing elsewhere (or being unset) means a newer preview
   * or an explicit stop has since superseded this resource, so this is a no-op.
   */
  private onAudioLoadFailure = (eventOrAudio: Event | HTMLAudioElement): void => {
    const direct = eventOrAudio as unknown as { localName?: string };
    const candidate =
      direct.localName === 'audio' ? eventOrAudio : (eventOrAudio as Event).currentTarget;
    const audioLike = candidate as
      | (EventTarget & {
          localName?: string;
          pause?: () => void;
          removeEventListener?: typeof EventTarget.prototype.removeEventListener;
        })
      | null;
    const failedAudio =
      audioLike?.localName === 'audio' &&
      typeof audioLike.pause === 'function' &&
      typeof audioLike.removeEventListener === 'function'
        ? (audioLike as HTMLAudioElement)
        : undefined;
    if (!failedAudio) return;
    failedAudio.removeEventListener('ended', this.onAudioEnded);
    failedAudio.removeEventListener('error', this.onAudioLoadFailure);
    failedAudio.pause();
    if (failedAudio !== this.audioEl) return;
    this.audioEl = undefined;
    if (this.previewingId !== null) {
      this.previewingId = null;
      this.emit('lr-preview-change', { voiceId: null });
    }
  };

  private stopInternalPreview(): void {
    if (this.audioEl) {
      this.audioEl.removeEventListener('ended', this.onAudioEnded);
      this.audioEl.removeEventListener('error', this.onAudioLoadFailure);
      this.audioEl.pause();
      this.audioEl = undefined;
    }
    if (this.previewingId !== null) {
      this.previewingId = null;
      this.emit('lr-preview-change', { voiceId: null });
    }
  }

  private onPreviewButtonClick = (): void => {
    const candidate = this.previewCandidateId;
    if (!candidate) return;
    if (this.previewingId === candidate) this.stopInternalPreview();
    else this.requestPreview(candidate);
  };

  private onOptionPreviewClick = (e: MouseEvent, entry: DisplayEntry): void => {
    e.stopPropagation(); // don't also select the row -- see onListboxClick
    if (this.previewingId === entry.id) this.stopInternalPreview();
    else this.requestPreview(entry.id);
  };

  private get previewButtonLabel(): string {
    const candidate = this.previewCandidateId;
    const playing = this.previewingId !== null && this.previewingId === candidate;
    const name = this.labelFor(candidate) || candidate;
    return playing ? this.localize('voicePickerStopPreview') : this.localize('voicePickerPreview', undefined, { name });
  }

  // -- Closed-dropdown mode (trigger button) --------------------------------

  private onTriggerClick = (): void => {
    if (this.effectiveDisabled) return;
    this.open ? this.hide() : this.show();
  };
  private onTriggerBlur = (): void => {
    if (this.suppressControlEvents) return;
    // The browser force-blurs a focused native control (this trigger `<button>`) the moment it
    // becomes disabled -- a platform reaction, not a user interaction, and `effectiveDisabled`
    // already reads true here whenever this is that case. Marking `touched` for it anyway could
    // reenter an in-flight update and trip Lit's dev-mode "scheduled an update after an update
    // completed" warning for a state flip nothing observable needed -- a disabled control is
    // barred from validation regardless (fr_asxOgk4UhNB07xevCWwFVQ).
    if (!this.effectiveDisabled) this.touched = true;
    this.hide();
    this.emit('blur');
  };
  private onTriggerFocus = (): void => {
    if (!this.suppressControlEvents) this.emit('focus');
  };
  private onTriggerKeyDown = (e: KeyboardEvent): void => {
    const rows = this.effectiveEntries;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!this.open) return this.show();
        this.activeIndex = Math.min(rows.length - 1, this.activeIndex + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!this.open) return this.show();
        this.activeIndex = Math.max(0, this.activeIndex - 1);
        break;
      case 'Enter':
      case ' ':
        if (this.open) {
          e.preventDefault();
          const activeRow = rows[this.activeIndex];
          if (this.activeIndex >= 0 && activeRow) this.selectEntry(activeRow);
          else this.hide();
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
          this.activeIndex = 0;
        }
        break;
      case 'End':
        if (this.open) {
          e.preventDefault();
          this.activeIndex = rows.length - 1;
        }
        break;
    }
  };

  // -- Free-text mode (text input) -------------------------------------------

  private onComboMouseDown = (e: MouseEvent): void => {
    if (this.effectiveDisabled) return;
    e.preventDefault();
    (this.renderRoot.querySelector('[part="combobox-input"]') as HTMLInputElement | null)?.focus();
  };
  private onInputFocus = (): void => {
    if (!this.open) this.query = this.labelFor(this.value);
    this.show();
    if (!this.suppressControlEvents) this.emit('focus');
  };
  private onInput = (e: Event): void => {
    this.query = (e.target as HTMLInputElement).value;
    this.activeIndex = -1;
    this.show();
  };
  private onInputBlur = (): void => {
    if (this.suppressControlEvents) return;
    // Same platform reaction as onTriggerBlur() above, for the free-text mode's internal
    // `<input>` (fr_asxOgk4UhNB07xevCWwFVQ): the browser force-blurs it the moment it becomes
    // disabled, and that is not a user interaction worth marking `touched` for.
    if (!this.effectiveDisabled) this.touched = true;
    this.hide();
    this.emit('blur');
  };
  private onInputKeyDown = (e: KeyboardEvent): void => {
    const rows = this.filteredEntries;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!this.open) return this.show();
        this.activeIndex = Math.min(rows.length - 1, this.activeIndex + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!this.open) return this.show();
        this.activeIndex = Math.max(0, this.activeIndex - 1);
        break;
      case 'Enter':
        if (this.open) {
          e.preventDefault();
          this.commitFreeText();
        }
        break;
      case 'Escape':
        if (this.open) {
          e.preventDefault();
          this.query = this.labelFor(this.value);
          this.hide();
        }
        break;
      case 'Home':
        if (this.open) {
          e.preventDefault();
          this.activeIndex = 0;
        }
        break;
      case 'End':
        if (this.open) {
          e.preventDefault();
          this.activeIndex = rows.length - 1;
        }
        break;
    }
  };

  // -- Shared listbox ---------------------------------------------------

  private onListboxMouseDown = (e: MouseEvent): void => {
    if ((e.target as HTMLElement).closest('[part="option"]')) e.preventDefault();
  };
  private onListboxClick = (e: MouseEvent): void => {
    if (this.effectiveDisabled) return;
    const optionEl = (e.target as HTMLElement).closest('[part="option"]') as HTMLElement | null;
    const value = optionEl?.dataset['value'];
    if (value === undefined) return;
    const entry = (this.closedMode ? this.effectiveEntries : this.filteredEntries).find((e2) => e2.id === value);
    if (entry) this.selectEntry(entry);
  };

  private renderRows(rows: DisplayEntry[], activeId: string): TemplateResult[] {
    return rows.map((entry, i) => {
      const id = `${this.listId}-opt-${i}`;
      const selected = entry.id === this._value;
      const meta = [entry.language, entry.description].filter(Boolean).join(' · ');
      return html`<div
        part="option"
        id=${id}
        role="option"
        data-value=${entry.id}
        ?data-synthetic=${entry.synthetic}
        aria-selected=${selected ? 'true' : 'false'}
        ?data-active=${id === activeId}
      >
        <span part="option-label">
          <span>${entry.label}</span>
          ${meta ? html`<span part="option-meta">${meta}</span>` : nothing}
        </span>
        ${entry.synthetic ? html`<span part="option-badge">${this.localize('notInCatalog')}</span>` : nothing}
        ${this.preview && entry.previewUrl
          ? html`<span
              part="option-preview"
              tabindex="-1"
              aria-hidden="true"
              @click=${(e: MouseEvent) => this.onOptionPreviewClick(e, entry)}
              >${this.previewingId === entry.id ? pauseIcon() : playIcon()}</span
            >`
          : nothing}
      </div>`;
    });
  }

  private renderListbox(rows: DisplayEntry[], activeId: string, emptyText: string): TemplateResult {
    return html`
      <div
        part="listbox"
        id=${this.listId}
        role="listbox"
        @mousedown=${this.onListboxMouseDown}
        @click=${this.onListboxClick}
      >
        ${rows.length === 0
          ? html`<div part="empty" role="option" aria-selected="false" aria-disabled="true">${emptyText}</div>`
          : this.renderRows(rows, activeId)}
      </div>
    `;
  }

  private onHintSlotChange = (e: Event): void => {
    this.hasHintSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };
  private onErrorSlotChange = (e: Event): void => {
    this.hasErrorSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private get hasVisibleLabel(): boolean {
    return this.label.length > 0 || this.slotPresence.has('label');
  }

  private renderLabel(): TemplateResult {
    return html`<label part="form-control-label" for=${this.controlId} ?hidden=${!this.hasVisibleLabel}
      >${this.label}<slot name="label"></slot></label
    >`;
  }

  private renderHintError(hasError: boolean, hasHint: boolean): TemplateResult {
    return html`
      <div id="voice-picker-error" part="error" ?hidden=${!hasError}>
        ${this.errorText}<slot name="error" @slotchange=${this.onErrorSlotChange}></slot>
      </div>
      <div id="voice-picker-hint" part="hint" ?hidden=${!hasHint}>
        ${this.hint}<slot name="hint" @slotchange=${this.onHintSlotChange}></slot>
      </div>
    `;
  }

  private renderPreviewButton(): TemplateResult {
    if (!this.preview) return html``;
    const candidate = this.previewCandidateId;
    const playing = this.previewingId !== null && this.previewingId === candidate;
    return html`
      <button
        part="preview-button"
        type="button"
        aria-pressed=${playing ? 'true' : 'false'}
        aria-label=${this.previewButtonLabel}
        ?disabled=${this.effectiveDisabled || !candidate}
        @click=${this.onPreviewButtonClick}
      >
        ${playing ? pauseIcon() : playIcon()}
      </button>
    `;
  }

  private renderClosed(): TemplateResult {
    const rows = this.effectiveEntries;
    const activeId = this.activeIndex >= 0 && rows[this.activeIndex] ? `${this.listId}-opt-${this.activeIndex}` : '';
    const hasValue = this._value.length > 0;
    const hasLabel = this.hasVisibleLabel;
    const hasHint = this.hasHintSlot || this.hint.length > 0;
    const hasError = this.hasErrorSlot || this.errorText.length > 0;
    const describedBy = [hasError ? 'voice-picker-error' : '', hasHint ? 'voice-picker-hint' : '']
      .filter(Boolean)
      .join(' ');
    return html`
      ${this.renderLabel()}
      <div class="control-row">
        <button
          id=${this.controlId}
          part="trigger"
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded=${this.open ? 'true' : 'false'}
          aria-controls=${this.listId}
          aria-activedescendant=${activeId}
          aria-label=${this.getAttribute('aria-label') || (hasLabel ? nothing : this.placeholder || this.localize('voice'))}
          aria-describedby=${describedBy || nothing}
          aria-required=${this.required ? 'true' : 'false'}
          aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'}
          ?disabled=${this.effectiveDisabled}
          @click=${this.onTriggerClick}
          @keydown=${this.onTriggerKeyDown}
          @focus=${this.onTriggerFocus}
          @blur=${this.onTriggerBlur}
        >
          ${this.provider ? html`<span part="provider-badge">${this.provider}</span>` : ''}
          <span class="trigger-label" ?data-placeholder=${!hasValue}
            >${hasValue ? this.labelFor(this._value) : this.placeholder}</span
          >
          <span part="expand-icon" aria-hidden="true">${chevronIcon()}</span>
        </button>
        ${this.renderPreviewButton()}
      </div>
      ${this.renderListbox(rows, activeId, this.localize('voicePickerNoVoices'))}
      ${this.renderHintError(hasError, hasHint)}
    `;
  }

  private renderFreeText(): TemplateResult {
    const rows = this.filteredEntries;
    const activeId = this.activeIndex >= 0 && rows[this.activeIndex] ? `${this.listId}-opt-${this.activeIndex}` : '';
    const hasLabel = this.hasVisibleLabel;
    const hasHint = this.hasHintSlot || this.hint.length > 0;
    const hasError = this.hasErrorSlot || this.errorText.length > 0;
    const describedBy = [hasError ? 'voice-picker-error' : '', hasHint ? 'voice-picker-hint' : '']
      .filter(Boolean)
      .join(' ');
    return html`
      ${this.renderLabel()}
      <div class="control-row">
        <div part="combobox" @mousedown=${this.onComboMouseDown}>
          ${this.provider ? html`<span part="provider-badge">${this.provider}</span>` : ''}
          <input
            id=${this.controlId}
            part="combobox-input"
            role="combobox"
            aria-label=${this.getAttribute('aria-label') || (hasLabel ? nothing : this.placeholder || this.localize('voice'))}
            aria-expanded=${this.open ? 'true' : 'false'}
            aria-controls=${this.listId}
            aria-activedescendant=${activeId}
            aria-autocomplete="list"
            aria-describedby=${describedBy || nothing}
            aria-required=${this.required ? 'true' : 'false'}
            aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'}
            autocomplete=${this.autocomplete || nothing}
            spellcheck=${this.spellcheck}
            autocapitalize=${this.autocapitalize || nothing}
            autocorrect=${this.autoCorrect || nothing}
            inputmode=${this.inputMode || nothing}
            enterkeyhint=${this.enterKeyHint || nothing}
            .value=${this.open ? this.query : this.labelFor(this._value)}
            placeholder=${this.placeholder}
            ?disabled=${this.effectiveDisabled}
            @input=${this.onInput}
            @keydown=${this.onInputKeyDown}
            @focus=${this.onInputFocus}
            @blur=${this.onInputBlur}
          />
          <span part="expand-icon" aria-hidden="true">${chevronIcon()}</span>
        </div>
        ${this.renderPreviewButton()}
      </div>
      ${this.renderListbox(rows, activeId, this.localize('noMatches'))}
      ${this.renderHintError(hasError, hasHint)}
    `;
  }

  override render(): TemplateResult {
    return html`<div part="form-control">
      ${this.closedMode ? this.renderClosed() : this.renderFreeText()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-voice-picker': LyraVoicePicker;
  }
}
