import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { installFormControlLabelSupport } from '../../../internal/form-control-labels.js';
installFormControlLabelSupport();
import type { LyraSize } from '../../../internal/variants.js';
import type { LyraSelectionDirection } from '../../../internal/shared-unions.js';
import { sizes } from '../../../internal/sizes.styles.js';
import { hostAriaLabel, nextId } from '../../../internal/a11y.js';
import { syncAriaDescribedByElements } from '../../../internal/aria-reflection.js';
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
import {
  installInteractionOnInvalid,
  installInvalidEventAlias,
  withStaticValidityCheck,
} from '../../../internal/invalid-event-alias.js';
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
  /** Optional literal icon hint (for example, an emoji), rendered decoratively before `label`. */
  icon?: string;
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

/** Reads a boolean own DATA property without ever invoking an accessor -- an accessor-backed
 *  `disabled` (`{ get() {...} }`) has no `value` in its own descriptor, so it is silently dropped
 *  here rather than read, matching every other hardened public-collection projection in this
 *  library. */
function ownBoolean(value: object, key: keyof LyraVoiceCatalogEntry): boolean | undefined {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && 'value' in descriptor && typeof descriptor.value === 'boolean'
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
    const icon = ownString(candidate, 'icon');
    const disabled = ownBoolean(candidate, 'disabled');
    entrySnapshot.push(Object.freeze({
      id,
      label,
      ...(language === undefined ? {} : { language }),
      ...(description === undefined ? {} : { description }),
      ...(previewUrl === undefined ? {} : { previewUrl }),
      ...(icon === undefined ? {} : { icon }),
      ...(disabled === undefined ? {} : { disabled }),
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
 * `readonly` keeps both combobox owners focusable and browseable while blocking user typing and
 * catalog commits; selection/copy, voice previews, form submission/reset, and programmatic writes
 * remain available.
 * Catalog assignments become bounded, clone-owned, frozen snapshots. Create and reassign a new
 * catalog array after changing its rows; mutating an assigned source does not update the picker.
 *
 * A catalog row may also set `disabled`, marking it non-actionable exactly like `lr-model-select`'s
 * own catalog rows: `aria-disabled="true"` replaces its selected/active affordances, activating it
 * (click or keyboard) commits nothing and changes no state, and arrow-key/Home/End
 * active-descendant navigation steps past it instead of landing on it. It does not affect that
 * row's own `[part="option-preview"]`, a separate affordance -- a disabled voice remains
 * previewable so a listener can hear why it is excluded. Omitted or `false` renders the row exactly
 * as before this field existed.
 *
 * A catalog row can also include a literal `icon` (for example, an emoji), rendered decoratively
 * as the leading `[part="option-icon"]`, matching `lr-model-select`'s identical
 * `LyraModelCatalogEntry.icon` field. It is presentation only: the row's accessible name remains
 * its `label`.
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
 * trigger/combobox, `reportValidity()`, or a submission attempt. Not after a silent
 * `checkValidity()` alone.
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
 * @csspart option-icon - An option row's optional decorative leading icon.
 * @csspart option-label - An option row's label/meta wrapper.
 * @csspart option-meta - An option row's quiet `language · description` second line.
 * @csspart option-badge - The "not in catalog" badge on a synthetic stale-value row.
 * @csspart option-preview - A pointer-only per-row preview icon (`tabindex="-1"`, `aria-hidden`).
 * @csspart preview-button - The standalone, keyboard-reachable preview toggle beside the trigger.
 * @csspart expand-icon - The dropdown indicator.
 * @csspart empty - The empty-listbox message.
 * @csspart hint - The hint message.
 * @csspart error - The error message.
 * @cssprop [--lr-voice-picker-max-inline-size=var(--lr-size-24rem)] - The host's own width
 *   ceiling. Set a length to retune it, or `none` to let the control fill its container the way
 *   `<lr-select>` does.
 * @cssprop [--lr-voice-picker-trigger-min-height=var(--lr-form-control-height)] - Trigger/combobox
 *   block-size floor. Reads the shared form-control height ladder, so retuning
 *   `--lr-theme-form-control-height-*` moves this control and every sibling field together. The
 *   preview action follows it, so raising the floor keeps the pair the same height; the action's
 *   own WCAG hit-area floor still wins below `--lr-icon-button-size`.
 * @cssprop --lr-voice-picker-trigger-height - Exact trigger/combobox height. Unset by default (a
 *   floor only, via `-trigger-min-height`); set a length to both floor and cap the control, e.g. to
 *   pixel-match a sibling field in the same toolbar row. Takes precedence over
 *   `-trigger-min-height`, and the preview action follows whichever of the two is in play.
 * @cssprop [--lr-voice-picker-gap=var(--lr-space-xs)] - Gap between the field and preview action,
 *   and between trigger, combobox, and option children.
 * @cssprop [--lr-voice-picker-radius=var(--lr-form-control-radius)] - Trigger, combobox, listbox,
 *   option, and preview-action corner radius.
 * @cssprop [--lr-voice-picker-preview-active-border=var(--lr-color-brand)] - Active preview border.
 * @cssprop [--lr-voice-picker-preview-active-color=var(--lr-color-brand)] - Active preview icon.
 * @cssprop [--lr-voice-picker-trigger-border-color=var(--lr-color-border)] - Resting trigger/combobox border color, independent of the open-state color below.
 * @cssprop [--lr-voice-picker-trigger-fill=var(--lr-color-surface)] - Resting trigger/combobox background.
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
 * @cssprop [--lr-voice-picker-option-disabled-opacity=0.5] - Opacity of an option row whose catalog
 *   entry sets `disabled`.
 * @cssprop [--lr-voice-picker-preview-hover-bg=var(--lr-color-brand-quiet)] - Shared hover/press
 *   fill for the standalone and row preview actions.
 * @cssprop [--lr-voice-picker-preview-hover-color=var(--lr-color-brand)] - Shared hover/press
 *   icon color for the standalone and row preview actions.
 * @cssprop [--lr-form-control-required-content=' *'] - The required marker appended to
 *   `form-control-label` while `required` is set. Set it to `''` to suppress the marker, or to any
 *   other quoted string (`' (required)'`, a localized word) to replace it.
 * @cssprop [--lr-form-control-required-color=var(--lr-color-danger)] - Required-marker color,
 *   themeable independently of error text and invalid borders.
 * @cssprop [--lr-form-control-required-offset=0] - Inline space between the label text and the
 *   required marker.
 * @cssprop [--lr-overlay-surface=var(--lr-color-surface-overlay)] - Shared floating-surface fill,
 * on the listbox.
 * @cssprop [--lr-overlay-border=var(--lr-color-border)] - Shared floating-surface edge colour, on
 * the listbox. Unlike a floating panel's decorative edge, it defaults to
 * the control tier: this popup belongs to the control it opens from.
 * @cssprop [--lr-overlay-radius=var(--lr-radius)] - Shared floating-surface corner radius, read by
 * the listbox only as the middle arm of `--lr-voice-picker-radius`, which still wins when set.
 * @cssprop [--lr-overlay-shadow-anchored=var(--lr-shadow-m)] - Elevation of the anchored surface.
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
   *  free-text entry. Catalog ids must be nonempty and unique; later duplicates are omitted
   *  entirely, first wins. A blank/whitespace-only id is never selectable, keyboard-reachable, or
   *  previewable, but still renders as an inert trailing row rather than silently vanishing (see
   *  `malformedCatalogEntries`). Replacing the catalog retires any internal preview before the
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
  /** Keeps user edits and catalog commits from changing `value` while retaining focus, popup
   *  navigation, selection/copy, previews, form submission, reset, and programmatic writes. */
  @property({ type: Boolean, reflect: true }) readonly: boolean = false;
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
  /** Whether a host `aria-describedby` was last reflected onto the active control -- see
   *  `checkbox.class.ts`'s identically-named field for why the sync call must stay guarded. */
  private hasSyncedDescribedByElements = false;
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
    isReadonly: () => this.readonly,
    locale: () => this.effectiveLocale,
    searchableFields: (entry) => [
      entry.id,
      entry.label,
      entry.language ?? '',
      entry.description ?? '',
    ],
    emitChange: (detail) => this.emit('lr-change', detail),
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
    // Interactive validation (a submission attempt, `reportValidity()`) is interaction, exactly
    // like a blur; `checkValidity()`'s own call below runs inside `withStaticValidityCheck()` so
    // this listener can tell the silent query apart from every other path that raises the same
    // `invalid` event.
    installInteractionOnInvalid(this, this.markInteracted);
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
   * Shared with every other form control: own `disabled`/`readonly` and a `<fieldset disabled>`
   * ancestor bar constraint validation. A barred control matches
   * neither `:valid` nor `:invalid` natively, so leaving `valueMissing` raised on a disabled
   * required picker is what painted it red under the documented `:state(user-invalid)` rule.
   */
  private get barredFromValidation(): boolean {
    return isBarredFromValidation(this, this.internals);
  }

  /** The `!this.value` check here is deliberately NOT the `''`-as-missing-value truthiness defect
   *  `<lr-select>`/`<lr-combobox>` were corrected for. There, `''` was a legitimate option value
   *  being misread as "no value". `value` here is `catalogPicker.value`, and `normalizeCatalog()`
   *  rejects a blank `id` outright, so `''` can never name a row -- it is this control's one
   *  "nothing committed" sentinel, exactly as documented on `withSyntheticCatalogValue()`. */
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
   *  on the trigger's/input's first blur, and on interactive validation -- `reportValidity()` and
   *  a submission attempt alike, via `installInteractionOnInvalid()`. A silent `checkValidity()`
   *  alone never counts. */
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
  private markInteracted = (): void => {
    if (this.touched) return;
    this.touched = true;
    this.publishValidityStates();
  };
  checkValidity(): boolean {
    // Silent query: must never mark a pristine control as interacted, however invalid it already
    // is. `withStaticValidityCheck()` tells the `installInteractionOnInvalid()` listener above
    // that whatever `invalid` event fires synchronously inside this call is this call, not a
    // submission attempt.
    return withStaticValidityCheck(this, () => this.internals.checkValidity());
  }
  reportValidity(): boolean {
    // A reportValidity() call is what a submit attempt runs, and it is the moment native controls
    // start matching :user-invalid -- so it counts as interaction here too. `touched` also gates
    // the data-invalid/aria-invalid reflection, which is the point: after a rejected submit the
    // control should read as invalid, not stay pristine. (A submission attempt itself never calls
    // this method -- it drives `ElementInternals` directly -- which is what
    // `installInteractionOnInvalid()` above covers.)
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

  /**
   * Raw `catalog` rows the shared controller drops as malformed (blank/whitespace `id`) --
   * rendered as inert trailing options rather than silently vanishing, so a malformed row a host
   * accidentally supplies is still visible for debugging. Never in `effectiveEntries`/
   * `filteredEntries`, so never selectable, never keyboard-reachable, and never active: `entry.id`
   * is always `''`, which `requestPreview()`'s `if (!voiceId) return;` guard and
   * `handleListboxClick()`'s `visibleEntries` lookup both already treat as a no-op.
   */
  private get malformedCatalogEntries(): DisplayEntry[] {
    const raw = this.catalog;
    if (!raw || raw.length === 0) return [];
    const out: DisplayEntry[] = [];
    for (const item of raw) {
      const record: LyraVoiceCatalogEntry = typeof item === 'string' ? { id: item, label: item } : item;
      if (typeof record?.id === 'string' && record.id.trim() !== '') continue;
      out.push({ ...record, id: '', synthetic: false });
    }
    return out;
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
    // Reflects the host's own `aria-describedby` (e.g. a form-wide instructions block living
    // outside this component) onto the active semantic control, alongside the trigger/input's own
    // hint/error ids already rendered into its literal `aria-describedby` string above -- idrefs
    // authored on the host never resolve across the shadow boundary on their own, mirroring
    // `checkbox.class.ts`'s `syncAriaDescribedByElements` usage. Guarded exactly like that
    // reference: assigning `ariaDescribedByElements = null` unconditionally on every update -- even
    // when there was never anything to sync -- makes the browser drop the literal hint/error
    // `aria-describedby` string this same render already set.
    const hostDescribedBy = this.getAttribute('aria-describedby');
    if (hostDescribedBy || this.hasSyncedDescribedByElements) {
      // `querySelector`, not `getElementById`: `renderRoot` is typed `HTMLElement | ShadowRoot`,
      // and `getElementById` exists only on the `DocumentFragment` half. Matches how
      // `checkbox.class.ts` resolves its own control for the same helper.
      const control = this.renderRoot.querySelector<HTMLElement>(`#${CSS.escape(this.controlId)}`);
      this.hasSyncedDescribedByElements = syncAriaDescribedByElements(
        this,
        control ?? undefined,
        hostDescribedBy,
      );
    }
    const reposition = changed.has('open') || (this.open && (changed.has('catalog') || changed.has('allowCustom')));
    this.catalogPicker.updated(reposition);
    if (
      changed.has('required') ||
      changed.has('readonly') ||
      changed.has('touched') ||
      changed.has('value')
    ) {
      if (changed.has('readonly')) this.updateValidity();
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

  /**
   * Releases exactly the resource that failed. A superseded resource cannot mutate the newer
   * generation.
   *
   * Two distinct callers reach this, and they publish differently:
   *  - A rejected `play()` (or a synchronous throw from calling it) means the browser never
   *    genuinely attempted playback -- silent, because no public start was ever published for the
   *    still-pending candidate.
   *  - A genuine `error` event on `<audio>` means the browser *did* attempt to fetch/decode the
   *    resource and that attempt failed -- distinct from `play()` merely rejecting (autoplay
   *    policy, an interrupted request). If that arrives before the `play()` promise itself has
   *    settled (a real race: `play()` resolving is not ordered against the element's own `error`
   *    event), the still-pending candidate is published as started and immediately as stopped, so a
   *    consumer never observes a bare stop with no matching start. Once already `previewingId`, the
   *    existing publish stands and only the terminal stop is new.
   */
  private onAudioLoadFailure = (eventOrAudio: Event | HTMLAudioElement): void => {
    const direct = eventOrAudio as unknown as { localName?: string };
    const isDomErrorEvent = direct.localName !== 'audio';
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
    const pendingVoiceId = this.pendingPreviewId;
    this.previewGeneration++;
    this.audioEl = undefined;
    this.pendingPreviewId = null;
    if (isDomErrorEvent && this.previewingId === null && pendingVoiceId !== null) {
      this.previewingId = pendingVoiceId;
      this.emit('lr-preview-change', { voiceId: pendingVoiceId });
    }
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
      // A blank id is never a real selection (it's a malformed row rendered inertly -- see
      // `malformedCatalogEntries`), even when `this.value` also happens to be `''`.
      const selected = entry.id !== '' && entry.id === this.value;
      const meta = [entry.language, entry.description].filter(Boolean).join(' · ');
      return html`<div
        part="option"
        id=${id}
        role="option"
        data-value=${entry.id}
        ?data-synthetic=${entry.synthetic}
        aria-selected=${selected ? 'true' : 'false'}
        aria-disabled=${entry.disabled === true ? 'true' : nothing}
        ?data-active=${id === activeId}
      >
        ${entry.icon ? html`<span part="option-icon" aria-hidden="true" inert>${entry.icon}</span>` : nothing}
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
        ?hidden=${this.catalogPicker.listboxHidden}
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
    return (this.label ?? '').length > 0 || this.slotPresence.has('label');
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
    const hasHint = this.slotPresence.has('hint') || (this.hint ?? '').length > 0;
    const hasError = this.slotPresence.has('error') || (this.errorText ?? '').length > 0;
    const describedBy = [this.getAttribute('aria-describedby') ?? '', hasError ? 'voice-picker-error' : '', hasHint ? 'voice-picker-hint' : '']
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
          aria-label=${hostAriaLabel(this) ?? (hasLabel ? nothing : this.placeholder || this.localize('voice'))}
          aria-describedby=${describedBy || nothing}
          aria-required=${this.required ? 'true' : 'false'}
          aria-readonly=${this.readonly ? 'true' : 'false'}
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
      ${this.renderListbox([...rows, ...this.malformedCatalogEntries], activeId, this.localize('voicePickerNoVoices'))}
      ${this.renderHintError(hasError, hasHint)}
    `;
  }

  private renderFreeText(): TemplateResult {
    const rows = this.filteredEntries;
    const activeId = this.activeIndex >= 0 && rows[this.activeIndex] ? `${this.listId}-opt-${this.activeIndex}` : '';
    const hasLabel = this.hasVisibleLabel;
    const hasHint = this.slotPresence.has('hint') || (this.hint ?? '').length > 0;
    const hasError = this.slotPresence.has('error') || (this.errorText ?? '').length > 0;
    const describedBy = [this.getAttribute('aria-describedby') ?? '', hasError ? 'voice-picker-error' : '', hasHint ? 'voice-picker-hint' : '']
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
            aria-label=${hostAriaLabel(this) ?? (hasLabel ? nothing : this.placeholder || this.localize('voice'))}
            aria-expanded=${this.open ? 'true' : 'false'}
            aria-controls=${this.listId}
            aria-activedescendant=${activeId}
            aria-autocomplete="list"
            aria-describedby=${describedBy || nothing}
            aria-required=${this.required ? 'true' : 'false'}
            aria-readonly=${this.readonly ? 'true' : 'false'}
            aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'}
            autocomplete=${this.autocomplete || nothing}
            spellcheck=${this.spellcheck}
            autocapitalize=${this.autocapitalize || nothing}
            autocorrect=${this.autoCorrect || nothing}
            inputmode=${this.inputMode || nothing}
            enterkeyhint=${this.enterKeyHint || nothing}
            .value=${this.open ? this.query : this.labelFor(this.value)}
            .readOnly=${this.readonly}
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
      ${this.renderListbox([...rows, ...this.malformedCatalogEntries], activeId, this.localize('noMatches'))}
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
