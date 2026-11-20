import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { catalogControlName, renderCatalogInput, renderCatalogLabel } from '../../../internal/catalog-picker-template.js';
import { InputLimitAnnouncement } from '../../../internal/input-limit-announcement.js';
import { guard } from 'lit/directives/guard.js';
import { formControlSupportingState, renderFormControlHintError } from '../../../internal/form-control-template.js';
import { installFormControlLabelSupport } from '../../../internal/form-control-labels.js';
import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { LyraCatalogPickerElement } from '../catalog-picker-element.js';
import { emitPopupEvent } from '../../../internal/popup-controller.js';
import type { LyraSize } from '../../../internal/variants.js';
import type { LyraSelectionDirection } from '../../../internal/shared-unions.js';
import { sizes } from '../../../internal/sizes.styles.js';
import { nextId } from '../../../internal/a11y.js';
import { chevronIcon, playIcon, pauseIcon } from '../../../internal/icons.js';
import { VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { safeMediaSrc } from '../../../internal/safe-url.js';
import { styles } from './voice-picker.styles.js';
import {
  CatalogPickerController,
  type LyraCatalog,
  type LyraCatalogEntry,
  type DisplayCatalogEntry,
} from '../../../internal/catalog-picker.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import { publicCollectionTruncation, collectionSupport } from '../../../internal/collection-snapshot.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_voice, LYRA_DEFAULT_voicePickerNoVoices, LYRA_DEFAULT_voicePickerPreview, LYRA_DEFAULT_voicePickerPreviewFailed, LYRA_DEFAULT_voicePickerRequired, LYRA_DEFAULT_voicePickerStopPreview } from '../../../internal/default-strings/conversation.generated.js';
import { LYRA_DEFAULT_catalogPickerInputLimit, LYRA_DEFAULT_noMatches, LYRA_DEFAULT_notInCatalog } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

installFormControlLabelSupport();

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

export interface LyraVoicePickerEventMap {
  'lr-invalid': CustomEvent<null>;
  'lr-input': CustomEvent<{ value: string; inCatalog: boolean; query?: string }>;
  'lr-change': CustomEvent<{ value: string; inCatalog: boolean }>;
  'lr-change-request': CustomEvent<Readonly<{ value: string; inCatalog: boolean }>>;
  'lr-show': CustomEvent<null>;
  'lr-hide': CustomEvent<null>;
  'lr-after-show': CustomEvent<null>;
  'lr-after-hide': CustomEvent<null>;
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
 * old resource (and publishes its terminal change) before the new request is dispatched. Removal
 * during the request invalidates its playback, including when the picker immediately reconnects.
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
 * Catalog assignments become clone-owned, frozen snapshots through the shared collection
 * boundary, and at most the first 1,024 rows are admitted. Create and reassign a new catalog array after changing its rows; mutating an assigned
 * source does not update the picker.
 *
 * A catalog row may also set `disabled`, marking it non-actionable exactly like `lr-model-select`'s
 * own catalog rows: `aria-disabled="true"` replaces its selected/active affordances, activating it
 * (click or keyboard) commits nothing and changes no state, and arrow-key/Home/End
 * active-descendant navigation steps past it instead of landing on it. It does not affect that
 * row's own `[part="option-preview"]`, a separate affordance -- a disabled voice remains
 * previewable so a listener can hear why it is excluded. Omitted or `false` leaves the row fully actionable.
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
 * @event lr-input - Reports the committed `value` and `inCatalog`. Free-text edits also include the exact draft `query`, including an empty string.
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
 * @event lr-change-request - Cancelable before a user pick or free-text commit changes `value`.
 *   Frozen `detail: { value, inCatalog }` names the proposed value. Calling `preventDefault()` keeps
 *   the current value and the open popup; a listener that disables, detaches, makes read-only or
 *   re-values the picker also stops the commit. Programmatic `value` writes never request.
 * @event lr-show - The listbox is about to open, however `open` became true after the first render.
 *   Cancelable: `preventDefault()` keeps it closed.
 * @event lr-hide - The listbox is about to close, however `open` became false. Cancelable, except
 *   when disabling the picker forces the close.
 * @event lr-after-show - The opened listbox finished its transition.
 * @event lr-after-hide - The closed listbox finished its transition and left layout.
 * @event lr-invalid - The picker failed a validity check. Cancelable: calling `preventDefault()`
 *   also cancels the native `invalid` event behind it, suppressing the browser's own validation
 *   bubble so an app can present the failure its own way.
 * @attr size - Visual size on the shared six-tier control ladder (`2xs`–`xl`, default `m`). The
 *   `small`/`medium`/`large` aliases render as `s`/`m`/`l`. Preview actions retain the shared 40px
 *   minimum hit area even when the field chrome uses a smaller tier.
 * @csspart limit - Localized notice when input admission omits catalog data.
 * @csspart form-control - The complete label, control, hint, error, and listbox frame.
 * @cssprop [--lr-voice-picker-trigger-hover-bg=var(--lr-color-brand-quiet)] - Hovered trigger background.
 * @cssprop --lr-voice-picker-trigger-active-bg - Pressed trigger background. Defaults to a mix from the hover fill.
 * @cssprop [--lr-form-control-font-size] - Size-tier font size for trigger and combobox text.
 * @cssprop [--lr-form-control-label-font-size=var(--lr-font-size-md-sm)] - Font size of the field label.
 * @cssprop [--lr-form-control-label-font-weight=var(--lr-font-weight-semibold)] - Font weight of the field label.
 * @cssprop [--lr-form-control-label-color=inherit] - Text color of the field label.
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
 * @cssprop --lr-positioning-strategy - Cascading `absolute`/`fixed` override for the listbox;
 *   the default is `fixed` when no recognized ancestor value is set.
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
 * @cssprop [--lr-voice-picker-trigger-hover-border-color=var(--lr-voice-picker-trigger-border-color)] - Trigger border
 * color while the pointer is over it, or while it is pressed. Independent of the resting border
 * color above.
 * @cssprop [--lr-voice-picker-open-border-color=var(--lr-color-brand)] - Open trigger border color.
 * @cssprop [--lr-form-control-focus-shadow=none] - The shared field focus halo, painted as a
 * `box-shadow` while this control's trigger or combobox is focused. One name for every
 * field-shaped control in the library, so a halo is configured once rather than per component.
 * Additive: the focus outline and border cue are the accessibility answer to focus and are never
 * replaced by it.
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
 * @cssprop [--lr-voice-picker-option-disabled-opacity=var(--lr-opacity-disabled)] - Opacity of an option row whose catalog
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
 * @cssprop [--lr-overlay-surface=var(--lr-color-surface-container-high)] - Shared floating-surface fill,
 * on the listbox.
 * @cssprop [--lr-overlay-border=var(--lr-color-border)] - Shared floating-surface edge colour, on
 * the listbox. Unlike a floating panel's decorative edge, it defaults to
 * the control tier: this popup belongs to the control it opens from.
 * @cssprop [--lr-overlay-radius=var(--lr-radius)] - Shared floating-surface corner radius, read by
 * the listbox only as the middle arm of `--lr-voice-picker-radius`, which still wins when set.
 * @cssprop [--lr-overlay-shadow-anchored=var(--lr-shadow-m)] - Elevation of the anchored surface.
 * @cssprop --lr-voice-picker-expand-size - Maximum minimum hit-area size of the expand control; capped by the shared icon target size.
 * @cssprop --lr-voice-picker-font-size - Trigger text size, defaulting to the selected component size.
 * @cssprop --lr-voice-picker-trigger-padding - Trigger padding, defaulting to the selected component size.
 * @cssprop --lr-form-control-height - Default minimum trigger height and minimum preview-button width.
 * @cssprop --lr-form-control-padding-block - Default block padding of the trigger.
 * @cssprop --lr-form-control-padding-inline - Default inline padding of the trigger.
 * @cssprop --lr-form-control-radius - Default corner radius of the trigger and option rows.
 * @cssprop --lr-positioner-available-block-size - Available block size published by the positioner to cap the popup height.
 * @cssprop --lr-positioner-available-inline-size - Available inline size published by the positioner to constrain the popup width.
 * @status stable
 * @since 4.0.0
 */
export class LyraVoicePicker extends LyraCatalogPickerElement<LyraVoicePickerEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    catalogPickerInputLimit: LYRA_DEFAULT_catalogPickerInputLimit,
    noMatches: LYRA_DEFAULT_noMatches,
    notInCatalog: LYRA_DEFAULT_notInCatalog,
    voice: LYRA_DEFAULT_voice,
    voicePickerNoVoices: LYRA_DEFAULT_voicePickerNoVoices,
    voicePickerPreview: LYRA_DEFAULT_voicePickerPreview,
    voicePickerPreviewFailed: LYRA_DEFAULT_voicePickerPreviewFailed,
    voicePickerRequired: LYRA_DEFAULT_voicePickerRequired,
    voicePickerStopPreview: LYRA_DEFAULT_voicePickerStopPreview,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static formAssociated = true;
  static override styles = [LyraElement.styles, sizes, styles];

  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze(['catalog']);
  protected static readonly ownedCollectionLimits = { catalog: { entries: 1024 } };

  static override properties = {
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
  };

  /** The bounded, clone-owned, frozen full voice list. Omit (or leave empty) to fall back to plain
   *  free-text entry. Catalog ids must be nonempty and unique; later duplicates are omitted
   *  entirely, first wins; rows with a blank/whitespace-only id are omitted. Replacing the catalog
   *  retires any internal preview before the rendered candidate can change; reassign a new array
   *  after row changes. */
  @property({ attribute: false }) catalog?: LyraCatalog<LyraVoiceCatalogEntry>;
  /** Renders no preview affordances at all: neither the standalone preview toggle nor the per-row
   *  preview icons. */
  @property({ type: Boolean, attribute: 'without-preview', reflect: true }) withoutPreview = false;

  /** Whether the catalog popup is open. Effectively disabled controls reject direct reopen
   * attempts, including a synchronous fieldset cascade.
   * @default false
   */
  @property({ type: Boolean, reflect: true })
  get open(): boolean { return this.catalogPicker.open; }
  set open(next: boolean) {
    this.catalogPicker.setOpen(next);
  }
  /** Visual size on the shared six-tier control ladder. `small`/`medium`/`large` alias
   *  `s`/`m`/`l`; the preview action keeps the shared --lr-icon-button-size minimum hit area. */
  @property({ reflect: true }) size: LyraSize = 'm';

  private get activeIndex(): number { return this.catalogPicker.activeIndex; }
  private get query(): string { return this.catalogPicker.query; }
  // Label/hint/error wrappers share one hydration-aware slot-presence authority. On the server,
  // unknowable authored slots remain progressively visible until the browser reconciles them.
  private readonly slotPresence = new SlotPresenceController(this);
  /** The voiceId currently playing via the internal `<audio>` (`null` when nothing is). */
  @state() private previewingId: string | null = null;

  private listId = nextId('voice-picker-list');
  private controlId = nextId('voice-picker-control');
  private audioEl?: HTMLAudioElement;
  /** The target whose `play()` promise has not fulfilled yet. It never drives public playing
   *  state; it exists solely to cancel/supersede stale async completions. */
  private pendingPreviewId: string | null = null;
  private previewGeneration = 0;
  private previewRequestGeneration = 0;
  protected get catalogEditing(): CatalogPickerController<LyraVoiceCatalogEntry> {
    return this.catalogPicker;
  }
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
    emitInput: (detail) => this.emit('lr-input', detail),
    emitChange: (detail) => this.emit('lr-change', detail),
    emitChangeRequest: (detail, init: { cancelable: true }) => this.emit('lr-change-request', detail, init),
    emitPopup: (name, cancelable) => emitPopupEvent(this, name, cancelable),
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
    onControlFocus: (event) => this.captureModeFocus(event),
    onControlBlur: (event) => {
      if (!this.effectiveDisabled) this.touched = true;
      this.retireModeFocusAfterBlur(event);
    },
  });

  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | null {
    return this.renderRoot?.querySelector('[part="trigger"], [part="combobox-input"]') ?? null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.updateValidity();
    this.catalogPicker.connected(this.hasUpdated);
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    const switchingMode = this.prepareModeFocus(this.closedMode);
    this.catalogPicker.suppressControlEvents = switchingMode;
    if (
      this.hasUpdated &&
      (changed.has('catalog') || changed.has('allowCustom') || changed.has('value'))
    ) {
      const activeValue = (
        this.renderRoot.querySelector('[part="option"][data-active]') as HTMLElement | null
      )?.dataset['value'];
      const rows = this.closedMode ? this.effectiveEntries : this.filteredEntries;
      this.catalogPicker.reconcileRows(
        activeValue,
        this.open && (changed.has('value') || changed.has('allowCustom') || switchingMode),
        false,
      );
      this.reconcilePreviewVisibility(this.open, rows);
    }
    if (changed.has('catalog') && this.internalPreviewTargetId !== null) this.stopInternalPreview();
    if (changed.has('withoutPreview') && this.withoutPreview) this.stopInternalPreview();
  }

  override disconnectedCallback(): void {
    this.previewRequestGeneration++;
    super.disconnectedCallback();
    this.stopInternalPreview();
    this.clearModeFocus();
    this.catalogPicker.disconnected();
  }

  override adoptedCallback(): void {
    this.previewRequestGeneration++;
    super.adoptedCallback();
    this.stopInternalPreview();
    this.clearModeFocus();
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

  protected requiredMessage(): string {
    return this.localize('voicePickerRequired');
  }

  protected override releaseOnDisable(): void {
    super.releaseOnDisable();
    this.stopInternalPreview();
  }

  formResetCallback(): void {
    this.touched = false;
    this.catalogPicker.resetValue();
  }
  formStateRestoreCallback(state: string | File | FormData | null, _mode?: 'restore' | 'autocomplete'): void {
    this.catalogPicker.restoreState(state);
  }
  formDisabledCallback(disabled: boolean): void {
    this.formDisabledChanged(disabled);
  }

  /** Closed-dropdown-with-listbox mode vs. free-text filterable mode — see class doc. */
  private get closedMode(): boolean {
    return this.catalogPicker.closedMode;
  }

  /**
   * `normalizedCatalog` plus, when `value` isn't one of its ids, a synthetic trailing row for it —
   * cached by the controller until `catalog`/`value` changes, so it always
   * reflects the current selection.
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


  private readonly announcements = new AnnouncementSinkController(this);

  constructor() {
    super();
    new InputLimitAnnouncement(this, {
      limited: () => this.inputLimited,
      announce: () => this.announcements.announcePolite(this.localize('catalogPickerInputLimit')),
    });
  }

  private get inputLimited(): boolean {
    return publicCollectionTruncation(this, 'catalog') !== undefined;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.syncCatalogDescription(this.controlId);
    const reposition = changed.has('open') || (this.open && (changed.has('catalog') || changed.has('allowCustom') || changed.has('topLayer')));
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
    this.finishModeFocus('voice-picker-mode-focus');
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
    if (!voiceId || !this.isConnected) return;
    // Both the previous preview stop and the new request can call back into the picker.
    const generation = ++this.previewRequestGeneration;
    const currentTarget = this.internalPreviewTargetId;
    if (currentTarget !== null && currentTarget !== voiceId) this.stopInternalPreview();
    if (generation !== this.previewRequestGeneration) return;
    const entry = this.catalogPicker.entryFor(voiceId);
    const previewUrl = entry?.previewUrl;
    const event = this.emit(
      'lr-preview-request',
      { voiceId, previewUrl },
      { cancelable: true },
    );
    if (!event.defaultPrevented && previewUrl && generation === this.previewRequestGeneration) {
      this.playInternal(voiceId, previewUrl);
    }
  }

  private playInternal(voiceId: string, url: string): void {
    const safe = safeMediaSrc(url);
    if (!safe) {
      this.announcements.announcePolite(this.localize('voicePickerPreviewFailed'));
      return;
    }
    this.stopInternalPreview();
    const audio = this.ownerDocument.createElement('audio');
    audio.preload = 'none';
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

  // A native error can arrive before play() resolves. Keep the start/stop events paired.
  private onAudioLoadFailure = (eventOrAudio: Event | HTMLAudioElement): void => {
    const audio = this.audioEl;
    if (!audio) return;
    const isDomErrorEvent = 'currentTarget' in eventOrAudio;
    const failed = isDomErrorEvent ? eventOrAudio.currentTarget : eventOrAudio;
    if (failed !== audio) return;
    this.releasePreviewAudio(audio);
    this.announcements.announcePolite(this.localize('voicePickerPreviewFailed'));
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

  private releasePreviewAudio(audio: HTMLAudioElement): void {
    audio.removeEventListener('ended', this.onAudioEnded);
    audio.removeEventListener('error', this.onAudioLoadFailure);
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }

  private stopInternalPreview(): void {
    const hadTarget = this.internalPreviewTargetId !== null || this.audioEl !== undefined;
    if (this.audioEl) {
      this.releasePreviewAudio(this.audioEl);
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
        aria-disabled=${entry.disabled === true ? 'true' : nothing}
        ?data-active=${id === activeId}
      >
        ${entry.icon ? html`<span part="option-icon" aria-hidden="true" inert>${entry.icon}</span>` : nothing}
        <span part="option-label">
          <span>${entry.label}</span>
          ${meta ? html`<span part="option-meta">${meta}</span>` : nothing}
        </span>
        ${entry.synthetic ? html`<span part="option-badge">${this.localize('notInCatalog')}</span>` : nothing}
        ${!this.withoutPreview && entry.previewUrl
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
        <span class="glass-scroll-layer" aria-hidden="true"></span>
        ${this.catalogPicker.listboxHidden ? nothing : rows.length === 0
          ? html`<div part="empty" role="option" aria-selected="false" aria-disabled="true">${emptyText}</div>`
          : guard([rows, this.value, this.effectiveLocale, this.strings, this.localize('notInCatalog'), this.withoutPreview, this.previewingId], () => this.renderRows(rows, activeId))}
      </div>
    `;
  }

  private get supportingState() {
    return formControlSupportingState({
      presence: this.slotPresence,
      idPrefix: 'voice-picker',
      hint: this.hint,
      errorText: this.errorText,
      helpTextSlot: false,
      extraDescribedBy: [this.getAttribute('aria-describedby')],
    });
  }

  private get hasVisibleLabel(): boolean {
    return (this.label ?? '').length > 0 || this.slotPresence.has('label');
  }

  private renderHintError(hasError: boolean, hasHint: boolean): TemplateResult {
    return renderFormControlHintError({
      idPrefix: 'voice-picker',
      hint: this.hint,
      errorText: this.errorText,
      hasHint,
      hasError,
    });
  }

  private renderPreviewButton(): TemplateResult {
    if (this.withoutPreview) return html``;
    const candidate = this.previewCandidateId;
    const playing = this.previewingId !== null && this.previewingId === candidate;
    return html`
      <button
        part="preview-button"
        type="button"
        ?data-playing=${playing}
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
    const { hasHint, hasError, describedBy } = this.supportingState;
    return html`
      ${renderCatalogLabel(this.controlId, this.label, hasLabel)}
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
          aria-label=${catalogControlName(this, hasLabel, this.placeholder, this.localize('voice'))}
          aria-describedby=${describedBy || nothing}
          aria-required=${this.required ? 'true' : 'false'}
          aria-readonly=${this.readonly ? 'true' : 'false'}
          aria-invalid=${hasError || (this.touched && !this.internals.validity.valid) ? 'true' : 'false'}
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
    const { hasHint, hasError, describedBy } = this.supportingState;
    return html`
      ${renderCatalogLabel(this.controlId, this.label, hasLabel)}
      <div class="control-row">
        <div part="combobox" @mousedown=${this.onComboMouseDown}>
          ${this.provider ? html`<span part="provider-badge">${this.provider}</span>` : ''}
          ${renderCatalogInput({
            host: this,
            id: this.controlId,
            listId: this.listId,
            activeId,
            open: this.open,
            value: this.open ? this.query : this.labelFor(this.value),
            name: catalogControlName(this, hasLabel, this.placeholder, this.localize('voice')),
            describedBy,
            invalid: hasError || (this.touched && !this.internals.validity.valid),
            onInput: this.onInput,
            onKeyDown: this.onInputKeyDown,
            onFocus: this.onInputFocus,
            onBlur: this.onControlBlur,
          })}
          <span part="expand-icon" aria-hidden="true" inert>${chevronIcon()}</span>
        </div>
        ${this.renderPreviewButton()}
      </div>
      ${this.renderListbox(rows, activeId, this.localize('noMatches'))}
      ${this.renderHintError(hasError, hasHint)}
    `;
  }

  override render(): TemplateResult {
    return html`<div part="form-control" tabindex="-1">
      ${this.inputLimited ? html`<p part="limit">${this.localize('catalogPickerInputLimit')}</p>` : nothing}
      ${this.closedMode ? this.renderClosed() : this.renderFreeText()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-voice-picker': LyraVoicePicker;
  }
}
