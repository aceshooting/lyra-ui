import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraSize } from '../../../internal/variants.js';
import type { LyraSelectionDirection } from '../../../internal/shared-unions.js';
import { sizes } from '../../../internal/sizes.styles.js';
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
  CatalogPickerController,
  type LyraCatalog,
  type LyraCatalogEntry,
  type DisplayCatalogEntry,
} from '../../../internal/catalog-picker.js';
import { activeElementIn } from '../../../internal/active-element.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_noMatches, LYRA_DEFAULT_notInCatalog, LYRA_DEFAULT_voice, LYRA_DEFAULT_voicePickerNoVoices, LYRA_DEFAULT_voicePickerPreview, LYRA_DEFAULT_voicePickerRequired, LYRA_DEFAULT_voicePickerStopPreview } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/**
 * `true`-defaulting boolean attribute converter for `preview`. Lit's built-in `type: Boolean`
 * converter is presence-based -- the attribute's mere presence (regardless of its string value)
 * maps to `true`, so a plain-markup consumer writing the literal `preview="false"` would actually
 * get `true` (this property's default) -- the same bug class `spellcheckConverter` above and
 * `<lr-checkpoint>`'s `restorable`/`confirmRestore` converters document and fix.
 */

/** A catalog row: a selectable TTS voice. */
export interface LyraVoiceCatalogEntry extends LyraCatalogEntry {
  /** Rendered (with `description`) as a quiet `[part="option-meta"]` second line. */
  language?: string;
  description?: string;
  /** A sample-audio URL; validated via `safeMediaSrc()` before ever reaching an `<audio src>`. */
  previewUrl?: string;
}

export type { LyraCatalog, LyraCatalogEntry } from '../../../internal/catalog-picker.js';

/** Direction reported by the free-text input's native selection APIs. */
export type LyraVoicePickerSelectionDirection = LyraSelectionDirection;

/** A catalog row plus whether it's the synthetic "stale value" row — see `effectiveEntries`. */
type DisplayEntry = DisplayCatalogEntry<LyraVoiceCatalogEntry>;

const MAX_VOICE_CATALOG_ENTRIES = 10_000;

function ownString(value: object, key: keyof LyraVoiceCatalogEntry): string | undefined {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && 'value' in descriptor && typeof descriptor.value === 'string'
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

function snapshotVoiceCatalog(
  value: LyraCatalog<LyraVoiceCatalogEntry> | undefined,
): LyraCatalog<LyraVoiceCatalogEntry> | undefined {
  if (!Array.isArray(value)) return undefined;
  const stringSnapshot: string[] = [];
  const entrySnapshot: LyraVoiceCatalogEntry[] = [];
  let objectCatalog = false;
  let length = 0;
  try {
    length = Math.min(value.length, MAX_VOICE_CATALOG_ENTRIES);
  } catch {
    return Object.freeze(stringSnapshot);
  }
  for (let index = 0; index < length; index += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    } catch {
      continue;
    }
    if (!descriptor || !('value' in descriptor)) continue;
    const candidate: unknown = descriptor.value;
    if (typeof candidate === 'string') {
      if (objectCatalog) entrySnapshot.push(Object.freeze({ id: candidate, label: candidate }));
      else stringSnapshot.push(candidate);
      continue;
    }
    if (candidate === null || typeof candidate !== 'object') continue;
    const id = ownString(candidate, 'id');
    const label = ownString(candidate, 'label');
    if (id === undefined || label === undefined) continue;
    if (!objectCatalog) {
      entrySnapshot.push(
        ...stringSnapshot.map((entry) => Object.freeze({ id: entry, label: entry })),
      );
      objectCatalog = true;
    }
    const language = ownString(candidate, 'language');
    const description = ownString(candidate, 'description');
    const previewUrl = ownString(candidate, 'previewUrl');
    entrySnapshot.push(Object.freeze({
      id,
      label,
      ...(language === undefined ? {} : { language }),
      ...(description === undefined ? {} : { description }),
      ...(previewUrl === undefined ? {} : { previewUrl }),
    }));
  }
  return objectCatalog ? Object.freeze(entrySnapshot) : Object.freeze(stringSnapshot);
}

export interface LyraVoicePickerEventMap {
  'lr-invalid': CustomEvent<null>;
  'lr-change': CustomEvent<{ value: string; inCatalog: boolean }>;
  'lr-preview-request': CustomEvent<{ voiceId: string; previewUrl?: string }>;
  'lr-preview-change': CustomEvent<{ voiceId: string | null }>;
  input: Event;
  change: Event;
  blur: FocusEvent;
  focus: FocusEvent;
  'lr-blur': CustomEvent<null>;
  'lr-focus': CustomEvent<null>;
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
 * Preview requests are event-first relative to their new target: `lr-preview-request` is cancelable
 * and fires before that target can start. Left un-prevented, a `previewUrl` plays through one
 * internal native `<audio>` (the URL passes `safeMediaSrc()` first); `preventDefault()` or no URL
 * leaves playback entirely to the host's own TTS. Requesting the same voice while it is already
 * playing internally stops it instead of re-requesting; requesting a different voice retires the
 * old resource (and publishes its terminal change) before the new request is dispatched.
 * `lr-preview-change` reports internal playback start only after the current
 * `audio.play()` promise fulfills, and reports `voiceId: null` on stop/end/error. A rejected pending
 * play publishes neither a false start nor a false stop. Committed-value, active-option, and catalog
 * changes likewise retire an internal preview before the visible preview control changes target;
 * closing or filtering also retires a row-owned preview once no rendered control represents it.
 *
 * In free-text mode, `input` and the native selection/range-editing APIs expose the editable
 * combobox text. `setRangeText()` synchronizes `value`, form data, and validity without emitting
 * user-input events. These APIs are no-ops in closed-dropdown mode and before render.
 * Catalog assignments become bounded, clone-owned, frozen snapshots. Create and reassign a new
 * catalog array after changing its rows; mutating an assigned source does not update the picker.
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
 * @event {Event} change - Owner-realm native event fired alongside `lr-change`, mirroring
 *   `lr-model-select`'s native-style pair.
 * @event {Event} input - A payload-preserving owner-realm `InputEvent` on each free-text edit, and
 *   a plain native `Event` alongside `change` when either rendering mode commits a value.
 * @event {FocusEvent} blur - Owner-realm native blur relayed when focus leaves the complete picker
 *   boundary, retaining `relatedTarget`.
 *   Moving between the trigger or input and the sibling preview control does not close/touch the
 *   picker or emit this event.
 * @event {FocusEvent} focus - Owner-realm native focus relayed when focus enters that complete
 *   picker boundary, retaining `relatedTarget`.
 * @event lr-blur - Prefixed compatibility alias for `blur`.
 * @event lr-focus - Prefixed compatibility alias for `focus`.
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
 * @cssprop [--lr-voice-picker-gap=var(--lr-space-xs)] - Gap between the field and preview action,
 *   and between trigger, combobox, and option children.
 * @cssprop [--lr-voice-picker-radius=var(--lr-form-control-radius)] - Trigger, combobox, listbox,
 *   option, and preview-action corner radius.
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
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    noMatches: LYRA_DEFAULT_noMatches,
    notInCatalog: LYRA_DEFAULT_notInCatalog,
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
      // The accessor owns reflection so an explicit empty default can remove the attribute
      // synchronously, inside the property setter, before any update is scheduled. Reflecting it
      // again from `updated()` (post-commit) mutates the attribute after Lit has already
      // committed that same update, which schedules a further update and trips Lit's
      // "scheduled an update after an update completed" warning under strict-console CI.
      reflect: false,
      useDefault: true,
      noAccessor: true,
    },
    name: { reflect: true, noAccessor: true },
  };

  /** Informational only (e.g. `'elevenlabs'`); rendered as a small leading badge. */
  @property() provider = '';
  /** The bounded, clone-owned, frozen full voice list. Omit (or leave empty) to fall back to plain
   *  free-text entry. Catalog ids must be nonempty and unique; malformed rows and later duplicates
   *  are omitted, first wins. Replacing the catalog retires any internal preview before the
   *  rendered candidate can change; reassign a new array after row changes. */
  @property({ attribute: false })
  get catalog(): LyraCatalog<LyraVoiceCatalogEntry> | undefined {
    return this._catalog;
  }
  set catalog(next: LyraCatalog<LyraVoiceCatalogEntry> | undefined) {
    const old = this._catalog;
    if (next === old) return;
    if (this.internalPreviewTargetId !== null) this.stopInternalPreview();
    this._catalog = snapshotVoiceCatalog(next);
    this.requestUpdate('catalog', old);
  }
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
  /** Whether the catalog popup is open. Effectively disabled controls reject direct reopen
   * attempts, including a synchronous fieldset cascade. */
  @property({ type: Boolean, reflect: true })
  get open(): boolean { return this.catalogPicker.open; }
  set open(next: boolean) {
    this.catalogPicker.setOpen(next);
  }
  /** Visual size on the shared six-tier control ladder. `small`/`medium`/`large` alias
   *  `s`/`m`/`l`; the preview action keeps the library-wide 40px minimum hit area. */
  @property({ reflect: true }) size: LyraSize = 'm';

  private get activeIndex(): number { return this.catalogPicker.activeIndex; }
  private get query(): string { return this.catalogPicker.query; }
  @state() private touched = false;
  // Label/hint/error wrappers share one hydration-aware slot-presence authority. On the server,
  // unknowable authored slots remain progressively visible until the browser reconciles them.
  private readonly slotPresence = new SlotPresenceController(this);
  /** The voiceId currently playing via the internal `<audio>` (`null` when nothing is). */
  @state() private previewingId: string | null = null;

  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  /** Consumer-supplied validation message reflected through `custom-error`. */
  declare customError: string | null;
  private listId = nextId('voice-picker-list');
  private controlId = nextId('voice-picker-control');
  private audioEl?: HTMLAudioElement;
  /** The target whose `play()` promise has not fulfilled yet. It never drives public playing
   *  state; it exists solely to cancel/supersede stale async completions. */
  private pendingPreviewId: string | null = null;
  private previewGeneration = 0;
  private _catalog?: LyraCatalog<LyraVoiceCatalogEntry>;
  private _fieldsetDisabled = false;
  private _name = '';
  private _disabled = false;
  private _required = false;
  private transferControlFocus = false;
  private readonly catalogPicker = new CatalogPickerController<LyraVoiceCatalogEntry>(this, {
    catalog: () => this.catalog,
    allowCustom: () => this.allowCustom,
    locale: () => this.effectiveLocale,
    searchableFields: (entry) => [
      entry.id,
      entry.label,
      entry.language ?? '',
      entry.description ?? '',
    ],
    emitChange: (detail) => this.emit('lr-change', detail),
    emitFocusAlias: (type) => this.emit(type),
    beforeValueChange: (value) => {
      const previewTarget = this.internalPreviewTargetId;
      if (previewTarget !== null && previewTarget !== value) this.stopInternalPreview();
    },
    beforeActiveIndexChange: (next) => this.reconcilePreviewForActiveIndex(next),
    afterQueryChange: () => this.reconcilePreviewVisibility(this.open, this.catalogPicker.filteredEntries),
    onValueChange: (value, oldValue) => {
      this.internals.setFormValue(value);
      this.updateValidity();
      this.requestUpdate('value', oldValue);
    },
    onDefaultValueChange: (_value, oldValue) => this.requestUpdate('defaultValue', oldValue),
    onStateChange: (state, oldValue) => {
      if (state === 'open') {
        if (!this.catalogPicker.open) this.reconcilePreviewVisibility(false, []);
        this.requestUpdate('open', oldValue);
      } else {
        this.requestUpdate();
      }
    },
    onControlBlur: () => {
      if (!this.effectiveDisabled) this.touched = true;
    },
  });

  constructor() {
    super();
    // `<lr-voice-picker>` manages ElementInternals directly (its value is a catalog id, not the
    // plain string the `FormAssociated` mixin's contract assumes), but shares the mixin's
    // attach-or-degrade helper so both paths handle a missing *and* a throwing `attachInternals()`.
    this.internals = attachInternalsSafely(this);
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
    installCustomErrorProperty(this, () => this.validityController.customValidityMessage);
    installInvalidEventAlias(this, (init: { cancelable: true }) =>
      this.emit('lr-invalid', null, init));
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
    this.catalogPicker.click();
  }

  override focus(options?: FocusOptions): void {
    this.catalogPicker.focus(options);
  }

  override blur(): void {
    this.catalogPicker.blur();
  }

  /** The native editable input in free-text mode, or `null` in closed-dropdown mode and before render. */
  get input(): HTMLInputElement | null {
    return this.catalogPicker.input;
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
    this.catalogPicker.select();
  }

  /** Forwards the native selection range in free-text mode; otherwise a no-op. */
  setSelectionRange(
    start: number | null,
    end: number | null,
    direction?: LyraVoicePickerSelectionDirection,
  ): void {
    this.catalogPicker.setSelectionRange(start, end, direction);
  }

  setRangeText(replacement: string): void;
  setRangeText(replacement: string, start: number, end: number, selectMode?: SelectionMode): void;
  /**
   * Applies a silent native range edit in free-text mode and synchronizes the committed value,
   * form entry, and validity. Closed-dropdown mode and pre-render calls are no-ops.
   */
  setRangeText(replacement: string, start?: number, end?: number, selectMode?: SelectionMode): void {
    this.catalogPicker.setRangeText(replacement, start, end, selectMode);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.updateValidity();
    this.catalogPicker.connected(this.hasUpdated);
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (this.hasUpdated) {
      const renderedClosedMode = this.renderRoot.querySelector('[part="trigger"]') !== null;
      const switchingMode = renderedClosedMode !== this.closedMode;
      const focused = activeElementIn(this.shadowRoot ?? this.ownerDocument);
      this.catalogPicker.suppressControlEvents = switchingMode;
      this.transferControlFocus =
        switchingMode &&
        focused?.nodeType === 1 &&
        (focused as Element).matches('[part="trigger"], [part="combobox-input"]');
    }
    if (
      this.hasUpdated &&
      (changed.has('catalog') || changed.has('allowCustom') || changed.has('value'))
    ) {
      const activeValue = (
        this.renderRoot.querySelector('[part="option"][data-active]') as HTMLElement | null
      )?.dataset['value'];
      const rows = this.closedMode ? this.effectiveEntries : this.filteredEntries;
      this.catalogPicker.reconcileRows(activeValue, false);
      this.reconcilePreviewVisibility(this.open, rows);
    }
    if (changed.has('preview') && !this.preview) this.stopInternalPreview();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopInternalPreview();
    this.catalogPicker.disconnected();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.stopInternalPreview();
    this.catalogPicker.adopted();
  }

  /** The current voice id (empty string when nothing is selected). */
  get value(): string {
    return this.catalogPicker.value;
  }
  set value(next: string) {
    this.catalogPicker.value = next;
  }
  /** Reflected current reset default; changing it never overwrites a dirty live `value`. */
  get defaultValue(): string { return this.catalogPicker.defaultValue; }
  set defaultValue(next: string) {
    this.catalogPicker.defaultValue = next;
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
    } else if (this.required && !this.value) {
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
    this.catalogPicker.resetValue();
  }
  formStateRestoreCallback(state: string | File | FormData | null, _mode?: 'restore' | 'autocomplete'): void {
    this.catalogPicker.restoreState(state);
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

  /** Closed-dropdown-with-listbox mode vs. free-text filterable mode — see class doc. */
  private get closedMode(): boolean {
    return this.catalogPicker.closedMode;
  }

  /**
   * `normalizedCatalog` plus, when `value` isn't one of its ids, a synthetic trailing row for it —
   * recomputed from scratch on every access so it always reflects the *current* `catalog`/`value`,
   * never a snapshot from whenever `value` happened to be assigned.
   */
  private get effectiveEntries(): DisplayEntry[] {
    return this.catalogPicker.effectiveEntries;
  }

  /** `effectiveEntries` filtered by the typed `query` (free-text mode only; id, label, language, or
   *  description substring, case-insensitive). */
  private get filteredEntries(): DisplayEntry[] {
    return this.catalogPicker.filteredEntries;
  }

  private labelFor(id: string): string {
    return this.catalogPicker.labelFor(id);
  }

  private show(): void {
    this.catalogPicker.show();
  }
  private hide(): void {
    this.catalogPicker.hide();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const reposition = changed.has('open') || (this.open && (changed.has('catalog') || changed.has('allowCustom')));
    this.catalogPicker.updated(reposition);
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
    this.catalogPicker.suppressControlEvents = false;
  }

  // -- Preview -------------------------------------------------------------

  /** Pending playback counts as the current target for cancellation/coherence, but not as public
   *  playing state. */
  private get internalPreviewTargetId(): string | null {
    return this.pendingPreviewId ?? this.previewingId;
  }

  /** Retires a row-owned preview once neither the standalone action nor a still-rendered row can
   *  represent it. `open` is explicit so closing can reconcile before the reactive DOM changes. */
  private reconcilePreviewVisibility(open: boolean, rows: readonly DisplayEntry[]): void {
    const target = this.internalPreviewTargetId;
    if (target === null) return;
    const standaloneCandidate =
      open && this.activeIndex >= 0 ? rows[this.activeIndex]?.id ?? this.value : this.value;
    const hasVisibleRow =
      open && rows.some((entry) => entry.id === target && Boolean(entry.previewUrl));
    if (target !== standaloneCandidate && !hasVisibleRow) this.stopInternalPreview();
  }

  /** Moves the active descendant and atomically retires playback if that move would otherwise make
   *  the only visible preview control point at a different voice. */
  private reconcilePreviewForActiveIndex(next: number): void {
    const target = this.internalPreviewTargetId;
    if (target !== null) {
      const rows = this.closedMode ? this.effectiveEntries : this.filteredEntries;
      const nextCandidate = this.open && next >= 0 ? rows[next]?.id ?? this.value : this.value;
      if (target !== nextCandidate) this.stopInternalPreview();
    }
  }

  /** The candidate the standalone preview button acts on: the active option while open, else the
   *  committed value. */
  private get previewCandidateId(): string {
    if (this.open && this.activeIndex >= 0) {
      const rows = this.closedMode ? this.effectiveEntries : this.filteredEntries;
      return rows[this.activeIndex]?.id ?? this.value;
    }
    return this.value;
  }

  private requestPreview(voiceId: string): void {
    if (!voiceId) return;
    const currentTarget = this.internalPreviewTargetId;
    if (currentTarget !== null && currentTarget !== voiceId) this.stopInternalPreview();
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
    const generation = ++this.previewGeneration;
    this.audioEl = audio;
    this.pendingPreviewId = voiceId;
    let playResult: Promise<void> | undefined;
    try {
      playResult = audio.play();
    } catch {
      this.onAudioLoadFailure(audio);
      return;
    }
    void Promise.resolve(playResult).then(
      () => {
        if (
          generation !== this.previewGeneration ||
          audio !== this.audioEl ||
          this.pendingPreviewId !== voiceId
        ) {
          return;
        }
        this.pendingPreviewId = null;
        this.previewingId = voiceId;
        this.emit('lr-preview-change', { voiceId });
      },
      () => this.onAudioLoadFailure(audio),
    );
  }

  private onAudioEnded = (event: Event): void => {
    if (event.currentTarget !== this.audioEl) return;
    this.stopInternalPreview();
  };

  /** Releases exactly the resource that failed. A rejection while pending is silent because no
   *  public start was published; an error after fulfillment publishes the matching terminal stop.
   *  A superseded resource cannot mutate the newer generation. */
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
    this.previewGeneration++;
    this.audioEl = undefined;
    this.pendingPreviewId = null;
    if (this.previewingId !== null) {
      this.previewingId = null;
      this.emit('lr-preview-change', { voiceId: null });
    }
  };

  private stopInternalPreview(): void {
    const hadTarget = this.internalPreviewTargetId !== null || this.audioEl !== undefined;
    if (this.audioEl) {
      this.audioEl.removeEventListener('ended', this.onAudioEnded);
      this.audioEl.removeEventListener('error', this.onAudioLoadFailure);
      this.audioEl.pause();
      this.audioEl = undefined;
    }
    if (hadTarget) this.previewGeneration++;
    this.pendingPreviewId = null;
    if (this.previewingId !== null) {
      this.previewingId = null;
      this.emit('lr-preview-change', { voiceId: null });
    }
  }

  private onPreviewButtonClick = (): void => {
    const candidate = this.previewCandidateId;
    if (!candidate) return;
    if (this.internalPreviewTargetId === candidate) this.stopInternalPreview();
    else this.requestPreview(candidate);
  };

  private onOptionPreviewClick = (e: MouseEvent, entry: DisplayEntry): void => {
    e.stopPropagation(); // don't also select the row -- see onListboxClick
    if (this.internalPreviewTargetId === entry.id) this.stopInternalPreview();
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
  private onControlBlur = (event: FocusEvent): void => {
    this.catalogPicker.handleControlBlur(event);
  };
  private onControlFocus = (event: FocusEvent): void => {
    this.catalogPicker.handleControlFocus(event);
  };
  private onTriggerKeyDown = (e: KeyboardEvent): void => {
    this.catalogPicker.handleTriggerKeyDown(e);
  };

  // -- Free-text mode (text input) -------------------------------------------

  private onComboMouseDown = (e: MouseEvent): void => {
    this.catalogPicker.handleComboMouseDown(e);
  };
  private onInputFocus = (event: FocusEvent): void => {
    this.catalogPicker.handleInputFocus(event);
  };
  private onInput = (e: Event): void => {
    this.catalogPicker.handleInput(e);
  };
  private onInputKeyDown = (e: KeyboardEvent): void => {
    this.catalogPicker.handleInputKeyDown(e);
  };

  // -- Shared listbox ---------------------------------------------------

  private onListboxMouseDown = (e: MouseEvent): void => {
    this.catalogPicker.handleListboxMouseDown(e);
  };
  private onListboxClick = (e: MouseEvent): void => {
    this.catalogPicker.handleListboxClick(e);
  };

  private renderRows(rows: DisplayEntry[], activeId: string): TemplateResult[] {
    return rows.map((entry, i) => {
      const id = `${this.listId}-opt-${i}`;
      const selected = entry.id === this.value;
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
        ${this.errorText}<slot name="error"></slot>
      </div>
      <div id="voice-picker-hint" part="hint" ?hidden=${!hasHint}>
        ${this.hint}<slot name="hint"></slot>
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
        @focus=${this.onControlFocus}
        @blur=${this.onControlBlur}
      >
        ${playing ? pauseIcon() : playIcon()}
      </button>
    `;
  }

  private renderClosed(): TemplateResult {
    const rows = this.effectiveEntries;
    const activeId = this.activeIndex >= 0 && rows[this.activeIndex] ? `${this.listId}-opt-${this.activeIndex}` : '';
    const hasValue = this.value.length > 0;
    const hasLabel = this.hasVisibleLabel;
    const hasHint = this.slotPresence.has('hint') || this.hint.length > 0;
    const hasError = this.slotPresence.has('error') || this.errorText.length > 0;
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
          @focus=${this.onControlFocus}
          @blur=${this.onControlBlur}
        >
          ${this.provider ? html`<span part="provider-badge">${this.provider}</span>` : ''}
          <span class="trigger-label" ?data-placeholder=${!hasValue}
            >${hasValue ? this.labelFor(this.value) : this.placeholder}</span
          >
          <span part="expand-icon" aria-hidden="true" inert>${chevronIcon()}</span>
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
    const hasHint = this.slotPresence.has('hint') || this.hint.length > 0;
    const hasError = this.slotPresence.has('error') || this.errorText.length > 0;
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
            .value=${this.open ? this.query : this.labelFor(this.value)}
            placeholder=${this.placeholder}
            ?disabled=${this.effectiveDisabled}
            @input=${this.onInput}
            @keydown=${this.onInputKeyDown}
            @focus=${this.onInputFocus}
            @blur=${this.onControlBlur}
          />
          <span part="expand-icon" aria-hidden="true" inert>${chevronIcon()}</span>
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
