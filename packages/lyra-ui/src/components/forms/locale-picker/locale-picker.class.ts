import { emitValueEvents } from '../../../internal/value-events.js';
import { renderFormControlHintError } from '../../../internal/form-control-template.js';
import { installFormControlLabelSupport } from '../../../internal/form-control-labels.js';
import { FormControlController, reflectFormName } from '../../../internal/form-control-controller.js';
import { GlassScrollLayer } from '../../../internal/glass-scroll-layer.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import type { LyraLocaleLoader } from '../../../internal/locale-loader.js';
import { acquireNativeControlDescription, type NativeControlDescriptionLease } from '../../../internal/native-control-description.js';
import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  deferredPlace as place,
  awaitPopupAnimations,
  syncTopLayerRelease,
  topLayerPlacement,
} from '../../../internal/anchored-overlay-runtime.js';
import { resolveEffectivePositioningStrategy } from '../../../internal/positioning-strategy.js';
import { hostAriaLabel, nextId, srOnly } from '../../../internal/a11y.js';
import { chevronIcon } from '../../../internal/icons.js';
import { VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { syncValidityStates } from '../../../internal/custom-states.js';
import { TypeAheadBuffer } from '../../../internal/type-ahead-buffer.js';
import { resolveListMove } from '../../../internal/list-navigation.js';
import { getDisplayNames, resolveIntlLocale } from '../../../internal/intl-cache.js';
import { activeElementIn } from '../../../internal/active-element.js';
import {
  activateNonmodalOverlay,
  type OverlayHandle,
} from '../../../internal/nonmodal-overlay-manager.js';
import {
  getLyraLocale,
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
import { autocorrectConverter, declaredDefaultConverter, spellcheckConverter } from '../../../internal/converters.js';
import {
  getFormOwner,
  isBarredFromValidation,
  setFormOwner,
  type FormOwnerValue,
} from '../../../internal/form-associated.js';
import { relayNativeEvent } from '../../../internal/native-event-relay.js';
import { DocumentPointerListener } from '../../../internal/document-pointer.js';
import { revealRow } from '../../../internal/reveal-row.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
installFormControlLabelSupport();

// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_loading, LYRA_DEFAULT_localePickerEmpty, LYRA_DEFAULT_localePickerLabel, LYRA_DEFAULT_localePickerRequired, LYRA_DEFAULT_localePickerSearchLabel, LYRA_DEFAULT_retry, LYRA_DEFAULT_statusError } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** One offered locale row. `label` overrides the derived `localeNativeName(tag)` endonym when
 *  given -- e.g. offering a locale before its strings are registered ("Français (bientôt)").
 *  `country` overrides the row's derived flag country when given -- e.g. showing Lebanon's flag
 *  for an `'ar'` row instead of the library's default Saudi Arabia mapping. */
export interface LyraLocaleEntry {
  /** BCP-47 locale tag, e.g. `'pt-BR'`. */
  readonly tag: string;
  /** Overrides `localeNativeName(tag)` when given. */
  readonly label?: string;
  /** ISO 3166-1 alpha-2 or alpha-3 country code (e.g. `'lb'` or `'lbn'`) overriding this row's `<lr-flag>` derivation
   *  -- when given, the row renders `<lr-flag country={country}>` instead of the default
   *  `<lr-flag language={tag}>`. Unset (the default) keeps today's tag-derived flag. Ignored
   *  while `withoutFlags` is `true`. */
  readonly country?: string;
}

/** `locales` accepts either a plain array of BCP-47 tags (endonym label derived automatically,
 *  no per-row flag override available) or `{ tag, label, country }` rows for custom
 *  labels/ordering/subsets/flag overrides. */
export type LyraLocaleCatalog = readonly string[] | readonly LyraLocaleEntry[];

/** Visible content of the locale picker's trigger; option labels are always retained. */
export type LyraLocaleTriggerDisplay = 'flag' | 'label' | 'flag-label';

/** Visible content of each option row's label column; the trigger is unaffected. */
export type LyraLocaleOptionDisplay = 'label' | 'label-tag';

const MAX_LOCALE_ENTRIES = 512;
const localeSpellcheckConverter = {
  ...spellcheckConverter,
  fromAttribute: (value: string | null, type?: unknown): boolean | undefined =>
    value === null ? undefined : spellcheckConverter.fromAttribute?.(value, type),
};

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
  'lr-change-request': CustomEvent<LyraLocaleChangeDetail>;
  'lr-input': CustomEvent<LyraLocaleChangeDetail>;
  'lr-change': CustomEvent<LyraLocaleChangeDetail>;
  input: Event;
  change: Event;
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
 * When a required picker is still empty, its library-owned validation message follows its current
 * `.strings` and effective locale. A caller-provided `setCustomValidity()` message remains the
 * higher-precedence validation layer until the caller clears it.
 *
 * Built directly on the shared trigger-button/`aria-activedescendant` listbox technique
 * `<lr-select>` uses (not composed from it). Optional `searchable` adds a text filter over the
 * offered rows, matching tags, native names, caller labels, English names and localized language
 * names. The filter never becomes a submitted value and never selects a locale by itself.
 * Escape clears a nonempty filter first; a subsequent Escape closes and restores trigger focus.
 *
 * Selecting a row emits a cancelable `lr-change-request` before setting `value` — if a listener doesn't call
 * `event.preventDefault()`, the component applies the pick itself via `setLyraLocale()`. A host
 * that wants to intercept the pick (e.g. persist it to a profile first) calls
 * `event.preventDefault()`; the value, popup, and page-level locale then remain unchanged.
 * Accepted selections emit non-cancelable `input`, `lr-input`, `change` and `lr-change` after applying the locale; re-picking the committed locale changes nothing.
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
 * Host aria-describedby targets supplement local error/hint guidance on the trigger. The
 * relationships track target replacement, missing IDs, removal/reinsertion, reconnect, and adoption.
 * Removed label/hint/error-text content is safely omitted without changing null property readback.
 *
 * @customElement lr-locale-picker
 * @event lr-change-request - Cancelable before selection, popup, and global locale changes. Same detail as `lr-change`.
 * @event {Event} input - Native event after an accepted selection commits, before `lr-input`.
 * @event lr-input - Non-cancelable notification after an accepted selection commits. Same detail as `lr-change`.
 * @event {Event} change - Native event after an accepted selection commits, before `lr-change`.
 * @event lr-change - Non-cancelable notification after locale selection commits. The selection changed. `detail: { value, previousValue, direction }`, where
 *   `direction` is the picked locale's `'ltr'`/`'rtl'` writing direction. Veto through
 *   `lr-change-request`; preventing this notification does not reverse the commit.
 * @event blur - Native `FocusEvent` relayed when focus leaves the control. Internal moves between
 *   the trigger, optional search input and Retry do not emit another blur.
 * @event focus - Native `FocusEvent` relayed when focus enters the control.
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
 *   while `withoutFlags` is off and `triggerDisplay` is not `label`).
 * @csspart trigger-label - The current locale's label. Visually hidden in flag-only mode but
 *   retained as the trigger's accessible current-value description.
 * @csspart listbox - The options popover.
 * @csspart search-input - The optional text filter inside the popover.
 * @csspart empty - The optional filter's no-match guidance.
 * @csspart option - An option row.
 * @csspart option-flag - The row's leading `<lr-flag>` (present only while `withoutFlags` is off).
 * @csspart option-label - An option row's label wrapper (native name + tag).
 * @csspart option-tag - An option row's secondary line — the raw BCP-47 tag. Rendered only while
 *   `optionDisplay` is `label-tag` (the default); `optionDisplay="label"` omits the element
 *   outright, so this part matches nothing at all rather than matching a hidden node.
 * @csspart expand-icon - The dropdown indicator.
 * @csspart hint - The hint message.
 * @csspart error - The error message.
 * @csspart load-status - Optional locale loading or failure status.
 * @csspart load-retry - Retry a failed optional locale load.
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
 * @cssprop [--lr-locale-picker-trigger-fill=var(--lr-color-surface)] - Resting trigger background.
 * @cssprop [--lr-locale-picker-trigger-border-color=var(--lr-color-border)] - Resting trigger
 * border color.
 * @cssprop [--lr-locale-picker-trigger-hover-border-color=var(--lr-locale-picker-trigger-border-color)] -
 * Trigger border color while the pointer is over it. Unset, the border stays exactly where the
 * resting state left it.
 * @cssprop [--lr-form-control-focus-shadow=none] - The shared field focus halo, painted as a
 * `box-shadow` while this control is focused. One name for every field-shaped control in the
 * library, so a halo is configured once rather than per component. Additive: the focus outline and
 * border cue are the accessibility answer to focus and are never replaced by it.
 * @cssprop [--lr-form-control-required-content=' *'] - The required-field marker rendered after the
 * label. Set it to `''` to suppress the marker, or to any other quoted string (`' (required)'`, a
 * localized word) to replace it. Caller-supplied content, so it is never localized here.
 * @cssprop [--lr-form-control-required-color=var(--lr-color-danger)] - Color of that marker,
 * retunable without touching any other danger-coloured surface.
 * @cssprop [--lr-form-control-required-offset=0] - Inline space between the label text and the
 * marker.
 * @cssprop [--lr-overlay-surface=var(--lr-color-surface-container-high)] - Shared floating-surface fill,
 * on the listbox.
 * @cssprop [--lr-overlay-border=var(--lr-color-border)] - Shared floating-surface edge colour, on
 * the listbox. Unlike a floating panel's decorative edge, it defaults to
 * the control tier: this popup belongs to the control it opens from.
 * @cssprop [--lr-overlay-radius=var(--lr-radius)] - Shared floating-surface corner radius, read by
 * the listbox only as the middle arm of `--lr-locale-picker-radius`, which still wins when set.
 * @cssprop [--lr-overlay-shadow-anchored=var(--lr-shadow-m)] - Elevation of the anchored listbox.
 * @cssstate required - Matches while `required` is set.
 * @cssstate optional - Matches while `required` is not set (the complement of `required`).
 * @cssstate valid - Matches while the control satisfies its constraints.
 * @cssstate invalid - Matches while it does not — including a pristine required picker with
 *   nothing committed, exactly like native `:invalid`.
 * @cssstate user-valid - `valid`, but only after the user has interacted: blurred the trigger,
 *   `reportValidity()`, or a submission attempt. Not after a silent `checkValidity()` alone.
 * @cssstate user-invalid - `invalid`, but only after that same interaction — a required picker
 *   nobody has touched yet is invalid without being styled as an error.
 * @cssprop --lr-positioning-strategy - Cascading `absolute`/`fixed` override for the listbox's
 *   `fixed` default, read from computed style when it is (re)positioned. Set it once on `:root`,
 *   a theme, or one clipping ancestor to change every unset locale picker beneath it; an
 *   unrecognized value falls back to `fixed`.
 * @status stable
 * @since 6.0.0
 */
export class LyraLocalePicker extends LyraElement<LyraLocalePickerEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    loading: LYRA_DEFAULT_loading,
    localePickerEmpty: LYRA_DEFAULT_localePickerEmpty,
    localePickerLabel: LYRA_DEFAULT_localePickerLabel,
    localePickerRequired: LYRA_DEFAULT_localePickerRequired,
    localePickerSearchLabel: LYRA_DEFAULT_localePickerSearchLabel,
    retry: LYRA_DEFAULT_retry,
    statusError: LYRA_DEFAULT_statusError,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static formAssociated = true;
  static override styles = [LyraElement.styles, sizes, srOnly, styles];

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

  private _localeLoader?: LyraLocaleLoader;
  /** Optional catalog loader. Selection waits for it before changing the value or page locale.
   * Import loadLyraLocale from the optional locale-loader.js entry to load built-in catalogs.
   * Unset preserves synchronous selection. Failures keep the previous value and offer retry;
   * an open popup places outside the failure guidance so Retry remains reachable. */
  @property({ attribute: false })
  get localeLoader(): LyraLocaleLoader | undefined { return this._localeLoader; }
  set localeLoader(next: LyraLocaleLoader | undefined) {
    const previous = this._localeLoader;
    if (previous === next) return;
    this.cancelLocaleLoad();
    this._localeLoader = next;
    this.requestUpdate('localeLoader', previous);
  }

  /** The offered locale list. `undefined` (the default) auto-discovers every locale registered via
   *  `registerLyraLocale()` (plus `'en'`) through `getRegisteredLyraLocales()`, kept live via
   *  `subscribeLyraLocaleRegistry()`. Any explicit array overrides the auto-discovered list
   *  entirely, including `[]` as an authoritative empty catalog. If the catalog changes while
   *  the listbox is open, an active row beyond the new end is rehomed to the last remaining row. */
  private _locales?: LyraLocaleCatalog;
  @property({ attribute: false })
  get locales(): LyraLocaleCatalog | undefined { return this._locales; }
  set locales(next: LyraLocaleCatalog | undefined) {
    this.cancelLocaleLoad();
    const previous = this._locales;
    this._locales = next === undefined ? undefined : snapshotLocaleCatalog(next);
    this.requestUpdate('locales', previous);
  }

  /** Omits every `<lr-flag>` -- each row's leading flag and the trigger flag -- for text-only
   *  rows. The composition recipe this component supersedes (`lr-popover` + `lr-flag`) already
   *  pairs a locale switcher with flags by convention, so flags render unless this is set. */
  @property({ type: Boolean, attribute: 'without-flags' }) withoutFlags = false;
  /**
   * Shows the open listbox in the browser top layer wherever the native Popover API exists, so it
   * paints above every page layer whatever the stacking contexts around it. Use it inside a fixed
   * or sticky header, toolbar or rail with its own `z-index` that a sibling surface stacked higher
   * would otherwise cover: such an ancestor is only a stacking context, not a containing block, so
   * the automatic top-layer escape never applies, and no `z-index` on the listbox can lift it out
   * of that ancestor's context. While set, the listbox is placed with the `fixed` strategy
   * whatever `--lr-positioning-strategy` resolves to; no DOM node moves, so anchoring, RTL
   * placement, focus, Escape and the show/hide transition are unchanged. It stays promoted through
   * its hide transition and leaves the top layer once it settles closed. Stacking contexts are
   * deliberately not detected automatically. Without native Popover API support the listbox keeps
   * its ordinary `z-index` stacking. Same contract as `<lr-popover>`'s `top-layer`. Changes apply
   * live while open.
   * @default false
   */
  @property({ type: Boolean, attribute: 'top-layer', reflect: true }) topLayer = false;

  /** Trigger content. The default flag-label preserves the label, optional flag and chevron.
   * Flag mode centers the flag in a square based on the trigger height, with a 24px minimum,
   * and keeps the current language accessible while hiding the visible label and chevron.
   * Label mode omits only the trigger flag. withoutFlags always keeps the visible label.
   * Option labels/endonyms and selection behavior are unchanged. */
  @property({ attribute: 'trigger-display', converter: declaredDefaultConverter('flag-label') })
  triggerDisplay: LyraLocaleTriggerDisplay = 'flag-label';

  /** Option-row content. The default `label-tag` keeps today's two-line row: the locale's label
   * above its raw BCP-47 tag. `label` renders the label alone and OMITS the `option-tag` part
   * rather than hiding it -- a visually hidden tag still joins the row's accessible name and still
   * matches a consumer's own `::part(option-tag)` rule, so hiding is not omitting. The trigger,
   * the row flags and selection behaviour are identical either way. */
  @property({ attribute: 'option-display', converter: declaredDefaultConverter('label-tag') })
  optionDisplay: LyraLocaleOptionDisplay = 'label-tag';

  /** Adds an optional text filter over tags, native names, caller labels, English names and
   * localized language names. Filtering is case/accent insensitive, never commits a free-text value and emits no
   * selection event. Opening focuses the filter; arrows move the active match and Enter chooses
   * it. Escape first clears nonempty text without moving focus; with an empty filter it closes
   * and returns to the trigger. The private query also clears on close, reset, disablement,
   * disconnect or turning this option off. Unset preserves the original closed-list behavior. */
  @property({ type: Boolean }) searchable = false;

  /** Native autocomplete hint for the optional filter input. */
  @property() autocomplete = 'off';
  /** Native keyboard hint for the optional filter input. */
  @property({ attribute: 'inputmode' }) override inputMode = '';
  /** Native enter-key hint for the optional filter input. */
  @property({ attribute: 'enterkeyhint' }) override enterKeyHint = '';
  /** Native spellchecking for the filter; removing the attribute restores false. */
  @property({ converter: localeSpellcheckConverter, useDefault: true }) override spellcheck = false;
  /** Native capitalization hint for the optional filter input. */
  @property() override autocapitalize = '';
  private autocorrectValue = true;
  /** Native filter autocorrection. HTML accepts on/off; omission defaults to true.
   * @default true */
  @property({ converter: autocorrectConverter })
  override get autocorrect(): boolean { return this.autocorrectValue; }
  override set autocorrect(next: boolean) { this.autocorrectValue = Boolean(next); this.requestUpdate(); }

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
    if (!this._open) {
      this.activeIndex = -1;
      this.clearSearch();
    }
    this.requestUpdate('open', old);
  }
  /** Visual size — the library-wide `2xs`–`xl` ladder shared with `lr-select`. The Web Awesome /
   *  Shoelace spellings `small`/`medium`/`large` are accepted for `s`/`m`/`l`, so a migration is a
   *  tag rename with no attribute rewrite. */
  @property({ reflect: true,
    converter: declaredDefaultConverter<LyraSize>('m'),
  }) size: LyraSize = 'm';

  @state() private activeIndex = -1;
  @state() private searchQuery = '';
  @state() private touched = false;
  private readonly slotPresence = new SlotPresenceController(this);
  // Bumped by subscribeLyraLocaleRegistry(): re-renders and invalidates the cached rows.
  @state() private registryTick = 0;
  @query('[part="trigger"]') private triggerElement?: HTMLButtonElement;
  @query('[part="search-input"]') private searchElement?: HTMLInputElement;
  private searchAnnouncements?: AnnouncementSink;
  private searchFocusGeneration = 0;

  private internals: ElementInternals;
  private validityController: FormControlController;
  /** Consumer-supplied validation message reflected through `custom-error`. */
  declare customError: string | null;
  private listId = nextId('locale-picker-list');
  private controlId = nextId('locale-picker-control');
  private cleanup?: () => void;
  /** Whether the last placement forced the top layer, so turning `topLayer` off demotes. */
  private placedTopLayer?: boolean;
  /** Removes the settled-closed option listbox from layout (`[hidden]{display:none}`) so its
   *  stale last-placed box stops contributing to an ancestor's scrollable overflow. Cleared
   *  synchronously in `willUpdate()` before `syncPopup()`/`place()` measures the listbox, so the
   *  first measurement still sees a real box; re-set only once the closing transition settles
   *  (see {@link settleClosedLayout}). */
  @state() private listboxHidden = true;
  private closeSettleToken = 0;
  private overlayHandle?: OverlayHandle;
  private readonly pointer = new DocumentPointerListener(this, (event) => this.onDocPointer(event));
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
  private readonly typeBuffer = new TypeAheadBuffer(this);
  private activeScrollGeneration = 0;
  private localizedValidityLocale = '';
  private localizedIntrinsicMessage = '';

  constructor() {
    super();
    this.validityController = new FormControlController(this, {
      invalid: (init) => this.emit('lr-invalid', null, init),
      interacted: this.markInteracted,
      customError: () => this.validityController.customValidityMessage,
    });
    this.internals = this.validityController.formInternals;
    new GlassScrollLayer(this, '[part="listbox"]', () => this.open);

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
  /** Blur the internal trigger or the optional focused search input. */
  override blur(): void {
    if (this.searchElement && activeElementIn(this.shadowRoot) === this.searchElement) this.searchElement.blur();
    else this.triggerElement?.blur();
  }
  /** Activates the internal trigger -- `HTMLElement.prototype.click()` on a custom element with
   *  no native click semantics is otherwise a silent no-op. Mirrors `<lr-select>`'s identical
   *  `click()`. */
  override click(): void {
    if (!this.liveDisabled) this.triggerElement?.click();
  }

  /** Native filter input when searchable, otherwise null. After editing its value directly,
   * dispatch a native input event to update filtering; this never changes the committed locale.
   * The field remains disabled while the popup is closed. */
  get input(): HTMLInputElement | null {
    return this.searchable ? this.searchElement ?? null : null;
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

  private localDescriptionIds = '';
  private externalDescriptionLease?: NativeControlDescriptionLease;

  private syncExternalDescription(): void {
    if (!this.isConnected) return;
    const target = this.triggerElement ?? null;
    if (!target) return;
    if (this.externalDescriptionLease) this.externalDescriptionLease.update(target);
    else this.externalDescriptionLease = acquireNativeControlDescription(this, target, () => this.localDescriptionIds);
  }

  private releaseExternalDescription(): void {
    this.externalDescriptionLease?.release();
    this.externalDescriptionLease = undefined;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.syncExternalDescription();
    this.syncLocaleAttributeForLocalization();
    this.updateValidity();
    this.stopRegistrySubscription = subscribeLyraLocaleRegistry(() => {
      this.registryTick += 1;
    });
    if (this.hasUpdated && this.open) queueMicrotask(() => this.syncPopup());
  }

  override disconnectedCallback(): void {
    this.clearSearch();
    this.cancelLocaleLoad();
    this.loadAnnouncements?.release();
    this.loadAnnouncements = undefined;
    this.closeSettleToken++;
    this.listboxHidden = true;
    this.releaseExternalDescription();
    super.disconnectedCallback();
    this.cleanup?.();
    this.cleanup = undefined;
    this.deactivatePopupOverlay(false);
    this.stopRegistrySubscription?.();
    this.stopRegistrySubscription = undefined;
    this.typeBuffer.clear();
    this.activeScrollGeneration += 1;
    // Reset so a reconnect (e.g. a drag-drop reparent) re-triggers updated()'s open-driven
    // branch -- without this, `open` stays `true` across the disconnect/reconnect and
    // `changed.has('open')` never fires again, leaving the listbox rendered open with no
    // positioning and no outside-click listener.
    this.open = false;
  }

  override adoptedCallback(): void {
    this.closeSettleToken++;
    this.clearSearch();
    this.cancelLocaleLoad();
    this.loadAnnouncements?.release();
    this.loadAnnouncements = undefined;
    super.adoptedCallback();
    this.releaseExternalDescription();
    if (this.hasUpdated) this.syncExternalDescription();
    this.cleanup?.();
    this.cleanup = undefined;
    this.unbindDocumentPointer();
    this.overlayHandle?.suspend();
    this.typeBuffer.clear();
    if (this.open) queueMicrotask(() => this.syncPopup());
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    // Lit renders before its normal property-reflection step. Keep the attribute-derived locale
    // in sync before any `localize()` call in this update, otherwise that call can memoize the
    // former locale for the render and for the required-message calculation.
    if (changed.has('locale')) this.syncLocaleAttributeForLocalization();
    if (this.hasUpdated) this.refreshLocalizedIntrinsicValidity(changed);
    if (changed.has('searchable') && !this.searchable) {
      this.clearSearch();
      if (this.searchElement && activeElementIn(this.shadowRoot) === this.searchElement) this.focus();
    }
    if (changed.has('open') && this.open) this.setActiveIndex(this.visibleEntries.findIndex((row) => row.tag === this._value));
    if (this.open && (this.searchable || changed.has('locales') || changed.has('registryTick')) && this.activeIndex >= 0) {
      this.activeIndex = Math.min(this.activeIndex, this.visibleEntries.length - 1);
      this.queueActiveScroll();
    }
    if (this.open) this.listboxHidden = false;
  }

  /** The current locale tag (empty string when nothing is committed). */
  get value(): string {
    return this._value;
  }
  set value(next: string) {
    this.cancelLocaleLoad();
    this.valueWriteVersion++;
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
    reflectFormName(this, this._name);
    this.requestUpdate('name', old);
  }

  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    if (next) this.cancelLocaleLoad();
    const old = this._disabled;
    this._disabled = Boolean(next);
    // Reflected before the recomputation below, because `internals.willValidate` answers from the
    // live host attribute rather than from this field.
    this.toggleAttribute('disabled', this._disabled);
    this._fieldsetDisabled =
      this.validityController?.fieldsetDisabled(this._fieldsetDisabled) ?? this._fieldsetDisabled;
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
   * documented `lr-locale-picker:state(user-invalid)` error styling. This only writes the
   * library-owned intrinsic layer; `AnchoredValidityController` preserves a caller's custom error
   * while the localized required message changes.
   */
  private updateValidity(): void {
    this.localizedValidityLocale = this.effectiveMessageLocale;
    const valueMissing = this.hasMissingRequiredValue();
    const message = valueMissing ? this.localize('localePickerRequired') : '';
    this.localizedIntrinsicMessage = message;
    if (valueMissing) this.validityController.setValidity({ valueMissing: true }, message);
    else this.validityController.setValidity({});
    this.syncCustomStates();
  }

  /** A localized catalog can change without a named Lit property change, so compare both the
   * resolved locale and the current intrinsic message during each update. The comparison makes
   * the controller write only when a library-owned validation input actually changed. */
  private refreshLocalizedIntrinsicValidity(changed: PropertyValues): void {
    const locale = this.effectiveMessageLocale;
    const message = this.hasMissingRequiredValue() ? this.localize('localePickerRequired') : '';
    if (
      changed.has('strings') ||
      locale !== this.localizedValidityLocale ||
      message !== this.localizedIntrinsicMessage
    ) {
      this.updateValidity();
    }
  }

  private hasMissingRequiredValue(): boolean {
    return !this.isBarred() && this.required && !this._value;
  }

  /** Lit reflects a changed property after rendering. This component's localizer resolves the
   * host attribute, so synchronize an explicit locale before either render-time or intrinsic
   * validation text asks it for the effective message locale. */
  private syncLocaleAttributeForLocalization(): void {
    if (this.locale) {
      if (this.getAttribute('locale') !== this.locale) this.setAttribute('locale', this.locale);
    } else if (this.hasAttribute('locale')) {
      this.removeAttribute('locale');
    }
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
   * flag (set when the trigger blurs, or by interactive validation -- `reportValidity()` and a
   * submission attempt alike, via `installInteractionOnInvalid()`), which is what keeps the
   * `user-*` pair off a pristine control the way native `:user-invalid` does. A silent
   * `checkValidity()` alone never counts.
   */
  private syncCustomStates(): void {
    syncValidityStates(this.internals, {
      required: this.required,
      hasInteracted: this.touched,
      barred: this.isBarred(),
    });
  }

  private markInteracted = (): void => {
    if (this.touched) return;
    this.touched = true;
    this.syncCustomStates();
  };

  formResetCallback(): void {
    // Pristine again, so the `user-*` states stop matching even though a required picker is
    // immediately invalid once more. The `value` write below re-runs updateValidity() (and
    // therefore syncCustomStates()) with this flag already cleared.
    this.touched = false;
    this.clearSearch();
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
    if (this.validityController?.reflectingDisabled) return;
    if (disabled) this.cancelLocaleLoad();
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
    return this.validityController.checkValidity();
  }
  reportValidity(): boolean {
    this.validityController.syncConstraints();
    // Reporting is what a submit attempt does, and a failed submit is precisely when native
    // `:user-invalid` starts matching — so it counts as interaction, exactly as it does in the
    // `FormAssociated` mixin. (A submission attempt itself never calls this method -- it drives
    // `ElementInternals` directly -- which is what `installInteractionOnInvalid()` above covers.)
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
   *  `getRegisteredLyraLocales()` currently reports. An explicitly blank (or whitespace-only)
   *  per-entry `label` carries no useful information -- it falls back to the derived
   *  `localeNativeName(tag)` exactly like an omitted label, rather than rendering/announcing an
   *  empty option row. */
  private get normalizedEntries(): NormalizedLocaleEntry[] {
    const raw = this.locales;
    const cached = this.entriesCache;
    if (cached && cached.raw === raw && cached.tick === this.registryTick) return cached.rows;
    const rows = raw !== undefined
      ? raw.map((entry): NormalizedLocaleEntry =>
          typeof entry === 'string'
            ? { tag: entry, label: localeNativeName(entry) }
            : {
                tag: entry.tag,
                label: entry.label !== undefined && entry.label.trim().length > 0 ? entry.label : localeNativeName(entry.tag),
                country: entry.country,
              },
        )
      : getRegisteredLyraLocales().map((tag) => ({ tag, label: localeNativeName(tag) }));
    this.entriesCache = { raw, tick: this.registryTick, rows };
    return rows;
  }
  private entriesCache?: { raw: unknown; tick: number; rows: NormalizedLocaleEntry[] };
  private visibleCache?: { rows: NormalizedLocaleEntry[]; query: string; locale: string; result: NormalizedLocaleEntry[] };

  private normalizeSearch(text: string, locale = this.effectiveLocale): string {
    return text.toLocaleLowerCase(resolveIntlLocale(locale))
      .normalize('NFKD').replace(/\p{M}/gu, '').trim();
  }

  private get visibleEntries(): NormalizedLocaleEntry[] {
    const rows = this.normalizedEntries;
    const query = this.searchable ? this.normalizeSearch(this.searchQuery) : '';
    if (!query) return rows;
    const cached = this.visibleCache;
    if (cached && cached.rows === rows && cached.query === this.searchQuery && cached.locale === this.effectiveLocale) return cached.result;
    let names: Intl.DisplayNames | undefined;
    try { names = getDisplayNames(this.effectiveLocale, { type: 'language' }); }
    catch { /* Tags, native names and caller labels remain available without Intl language names. */ }
    // English names are additional search data; visible language names retain the UI locale.
    let englishNames: Intl.DisplayNames | undefined;
    try { englishNames = getDisplayNames('en', { type: 'language' }); }
    catch { /* Native, custom and localized labels remain available without English aliases. */ }
    const invariantQuery = this.normalizeSearch(this.searchQuery, 'en');
    const result = rows.filter(row => {
      let localizedName = '';
      try { localizedName = names?.of(row.tag) ?? ''; }
      catch { /* A custom malformed tag remains searchable by its literal tag and label. */ }
      let englishName = '';
      try { englishName = englishNames?.of(row.tag) ?? ''; }
      catch { /* Malformed tags still match their literal tag and caller label. */ }
      return [row.label, localeNativeName(row.tag), localizedName]
        .some(text => this.normalizeSearch(text).includes(query)) ||
        [row.tag, englishName].some(text => this.normalizeSearch(text, 'en').includes(invariantQuery));
    });
    this.visibleCache = { rows, query: this.searchQuery, locale: this.effectiveLocale, result };
    return result;
  }

  private clearSearch(): void {
    this.searchQuery = '';
    this.searchFocusGeneration++;
    this.searchAnnouncements?.release();
    this.searchAnnouncements = undefined;
  }

  private queueSearchFocus(): void {
    if (!this.searchable || !this.open || this.liveDisabled) return;
    const generation = ++this.searchFocusGeneration;
    const ownerDocument = this.ownerDocument;
    const outerFocus = activeElementIn(ownerDocument);
    const innerFocus = activeElementIn(this.shadowRoot);
    void this.updateComplete.then(() => {
      if (generation !== this.searchFocusGeneration || !this.isConnected || !this.open ||
          !this.searchable || this.liveDisabled || this.ownerDocument !== ownerDocument ||
          activeElementIn(ownerDocument) !== outerFocus || activeElementIn(this.shadowRoot) !== innerFocus) return;
      this.searchElement?.focus();
    });
  }

  /** The tag actually shown in the trigger: the committed `value` once set, else a live preview
   *  of `effectiveLocale` -- never a committed selection, see the class doc's value/preview
   *  split.
   *
   *  The `||` here (and `hasMissingRequiredValue()`'s `!this._value`) is deliberately NOT the
   *  truthiness bug `<lr-select>`/`<lr-combobox>` were corrected for. There, `''` was a legitimate
   *  option value being misread as "no value". Here `''` cannot be a row: `snapshotLocaleCatalog()`
   *  drops a zero-length `tag`, and a BCP-47 tag has at least a primary language subtag, so the
   *  empty string is this control's one documented "nothing committed" sentinel -- the very state
   *  the preview and the `valueMissing` constraint exist to express. Treating `''` as a candidate
   *  value would break both. */
  private get previewTag(): string {
    return this._value || this.effectiveLocale;
  }

  private entryFor(tag: string): NormalizedLocaleEntry | undefined {
    return this.normalizedEntries.find((e) => e.tag === tag);
  }

  /** A tag with no row falls back to its derived endonym rather than to a "not in catalog" badge,
   *  unlike `<lr-model-select>`/`<lr-voice-picker>`. The catalog here is live: with `locales` unset
   *  it tracks `getRegisteredLyraLocales()`, so a value restored from a profile is routinely
   *  legitimate-but-not-yet-listed for as long as its translation pack takes to register. Badging
   *  it would flag a correct value as stale, which is the same false alarm `<lr-combobox>`
   *  suppresses while an async `source` fetch is still in flight. */
  private labelFor(tag: string): string {
    return this.entryFor(tag)?.label ?? localeNativeName(tag);
  }

  private show(): void {
    if (this.open || this.liveDisabled) return;
    this.open = true;
    this.queueSearchFocus();
  }
  private hide(): void {
    if (!this.open) return;
    this.open = false;
    this.setActiveIndex(-1);
  }

  private dismissFromEscape(): void {
    if (!this.open) return;
    if (this.searchable && this.searchQuery.length) {
      this.clearSearch();
      this.setActiveIndex(this.visibleEntries.length ? 0 : -1);
      return;
    }
    this.deactivatePopupOverlay(true);
    this.hide();
  }

  private onDocPointer = (e: PointerEvent): void => {
    if (e.composedPath().includes(this)) return;
    if (this.overlayHandle?.isActive()) {
      this.overlayHandle.dismissBackdrop();
      return;
    }
    this.hide();
  };

  private bindDocumentPointer(): void {
    if (this.isConnected) this.pointer.bind();
  }

  private unbindDocumentPointer(): void {
    this.pointer.unbind();
  }

  private activatePopupOverlay(): void {
    if (this.overlayHandle?.isActive()) {
      this.overlayHandle.resume();
      return;
    }
    this.overlayHandle = activateNonmodalOverlay({
      host: this,
      panel: () => this.renderRoot.querySelector<HTMLElement>('[part="listbox"]'),
      onEscape: () => this.dismissFromEscape(),
      onBackdrop: () => this.hide(),
      restoreFocusTo: () => this.renderRoot.querySelector<HTMLElement>('[part="trigger"]'),
    });
  }

  private deactivatePopupOverlay(restoreFocus: boolean): void {
    const overlay = this.overlayHandle;
    this.overlayHandle = undefined;
    overlay?.deactivate({ restoreFocus });
    this.unbindDocumentPointer();
  }

  private syncPopup(): void {
    this.cleanup?.();
    this.cleanup = undefined;
    if (!this.open || !this.isConnected) {
      this.deactivatePopupOverlay(false);
      return;
    }
    this.activatePopupOverlay();
    this.bindDocumentPointer();
    // Keep inline failure guidance outside the options' floating surface in either placement.
    const anchor = this.renderRoot.querySelector(
      this.loadFailureTag !== undefined ? '[part="form-control"]' : '[part="trigger"]',
    ) as HTMLElement | null;
    const listbox = this.renderRoot.querySelector('[part="listbox"]') as HTMLElement | null;
    if (anchor && listbox) {
      this.placedTopLayer = syncTopLayerRelease(listbox, this.placedTopLayer, this.topLayer);
      this.cleanup = place(
        anchor,
        listbox,
        topLayerPlacement(
          this.topLayer,
          resolveEffectivePositioningStrategy(this, undefined, 'fixed'),
        ),
      );
    }
  }

  /** Waits for the listbox's closing opacity/transform/visibility transition (see
   *  `[part='listbox']`'s `--lr-transition-fast`) to actually finish, then sets `listboxHidden`
   *  so the settled-closed listbox leaves layout. A token guards against a reopen superseding an
   *  in-flight wait -- see `updated()`'s `open`-driven caller. */
  private async settleClosedLayout(): Promise<void> {
    const token = ++this.closeSettleToken;
    if (!await awaitPopupAnimations(
      this,
      () => this.renderRoot.querySelector('[part="listbox"]'),
      () => this.closeSettleToken === token,
    )) return;
    this.listboxHidden = true;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.syncExternalDescription();
    const reposition =
      changed.has('open') ||
      (this.open &&
        (changed.has('locales') ||
          changed.has('registryTick') ||
          changed.has('locale') ||
          changed.has('searchQuery') ||
          changed.has('searchable') ||
          changed.has('loadFailureTag') ||
          changed.has('topLayer')));
    if (reposition) {
      this.syncPopup();
    }
    if (changed.has('open')) {
      if (this.open) this.closeSettleToken++;
      else void this.settleClosedLayout();
    }
    if (this.open && this.searchable && changed.has('searchQuery') && this.searchQuery.trim() &&
        this.visibleEntries.length === 0) {
      this.searchAnnouncements ??= acquireAnnouncementSink('polite', { document: this.ownerDocument, source: this });
      this.searchAnnouncements.announce(this.localize('localePickerEmpty'));
    }
    if (changed.has('searchable') && this.searchable && activeElementIn(this.shadowRoot) === this.triggerElement) {
      this.queueSearchFocus();
    }
    if (changed.has('touched') || changed.has('required') || changed.has('value')) {
      this.toggleAttribute('data-invalid', this.touched && !this.internals.validity.valid);
    }
  }

  private commitDispatching = false;
  private valueWriteVersion = 0;
  private loadGeneration = 0;
  private loadAnnouncements?: AnnouncementSink;
  @state() private loadingTag?: string;
  @state() private loadFailureTag?: string;

  private cancelLocaleLoad(): void {
    this.loadAnnouncements?.release();
    this.loadAnnouncements = undefined;
    this.loadGeneration++;
    this.loadingTag = undefined;
    this.loadFailureTag = undefined;
  }

  private announceLoad(key: 'loading' | 'statusError'): void {
    this.loadAnnouncements ??= acquireAnnouncementSink('polite', { document: this.ownerDocument, source: this });
    this.loadAnnouncements.announce(key === 'loading' ? this.localize('loading') : this.localize('statusError'));
  }

  /** Requests a selection before loading or updating the control and the global locale. */
  private commit(tag: string): void {
    if (this.commitDispatching || this.liveDisabled || !this.entryFor(tag)) return;
    if (tag === this._value && tag === getLyraLocale()) {
      this.hide();
      return;
    }
    this.commitDispatching = true;
    try {
      const previousValue = this._value;
      const version = this.valueWriteVersion;
      const loader = this.localeLoader;
      const generation = this.loadGeneration;
      const detail = Object.freeze({ value: tag, previousValue, direction: getLyraLocaleDirection(tag) });
      const request = this.emit('lr-change-request', detail, { cancelable: true });
      if (request.defaultPrevented || this.liveDisabled || this.valueWriteVersion !== version ||
          this.loadGeneration !== generation || this.localeLoader !== loader || !this.entryFor(tag)) return;
      const commitValue = () => {
        const searchFocus = this.searchElement && activeElementIn(this.shadowRoot) === this.searchElement
          ? this.searchElement : undefined;
        this.value = tag;
        this.hide();
        setLyraLocale(tag);
        const committed = Object.freeze({ ...detail, direction: getLyraLocaleDirection(tag) });
        emitValueEvents(this, 'input', committed, detail => this.emit('lr-input', detail));
        emitValueEvents(this, 'change', committed, detail => this.emit('lr-change', detail));
        if (searchFocus && this.isConnected && this.searchable && activeElementIn(this.shadowRoot) === searchFocus) this.focus();
      };
      if (loader === undefined) {
        commitValue();
        return;
      }
      this.cancelLocaleLoad();
      const operation = this.loadGeneration;
      const ownerDocument = this.ownerDocument;
      this.loadingTag = tag;
      this.announceLoad('loading');
      const ownsSelection = () => this.isConnected && this.ownerDocument === ownerDocument &&
        this.loadGeneration === operation && this.valueWriteVersion === version &&
        this.localeLoader === loader && !this.liveDisabled && this.entryFor(tag) !== undefined;
      void Promise.resolve().then(() => {
        if (!ownsSelection()) return;
        return loader(tag);
      }).then(() => {
        if (ownsSelection()) commitValue();
      }, () => {
        if (!ownsSelection()) return;
        this.loadingTag = undefined;
        this.loadFailureTag = tag;
        this.announceLoad('statusError');
      });
    } finally {
      this.commitDispatching = false;
    }
  }

  private retryLocaleLoad = (): void => {
    const restoreFocus = activeElementIn(this.shadowRoot)?.getAttribute('part') === 'load-retry';
    if (this.loadFailureTag !== undefined) this.commit(this.loadFailureTag);
    if (restoreFocus && this.loadFailureTag === undefined && this.isConnected &&
        activeElementIn(this.shadowRoot)?.getAttribute('part') === 'load-retry') this.focus();
  };

  private onTriggerClick = (): void => {
    if (this.liveDisabled) return;
    this.open ? this.hide() : this.show();
  };
  private onTriggerBlur = (event: FocusEvent): void => {
    if (this.isSearchFocusTransfer(event)) {
      event.stopPropagation();
      return;
    }
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
    if (this.isSearchFocusTransfer(event)) {
      event.stopPropagation();
      return;
    }
    if (this.liveDisabled) {
      event.stopPropagation();
      return;
    }
    relayNativeEvent(this, event);
  };

  private isSearchFocusTransfer(event: FocusEvent): boolean {
    const related = event.relatedTarget;
    return (this.searchable || event.currentTarget === this.searchElement || related === this.searchElement) &&
      related !== null && 'nodeType' in related && this.renderRoot.contains(related as Node);
  }

  private onSearchInput = (event: Event): void => {
    event.stopPropagation();
    if (!this.searchable || !this.open || this.liveDisabled) return;
    this.searchQuery = (event.currentTarget as HTMLInputElement).value;
    this.setActiveIndex(this.visibleEntries.length ? 0 : -1);
  };

  private onSearchChange = (event: Event): void => { event.stopPropagation(); };

  private onSearchKeyDown = (event: KeyboardEvent): void => {
    if (this.liveDisabled || !this.open || event.isComposing || event.keyCode === 229) return;
    const rows = this.visibleEntries;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.setActiveIndex(event.key === 'ArrowDown'
        ? Math.min(rows.length - 1, this.activeIndex + 1)
        : Math.max(0, this.activeIndex - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const row = rows[this.activeIndex];
      if (row) this.commit(row.tag);
    } else if (event.key === 'Escape' &&
        (!this.overlayHandle?.isActive() || this.overlayHandle.isTopmost())) {
      event.preventDefault();
      this.dismissFromEscape();
    }
  };

  /** Standard listbox type-ahead: moves to the next row whose native name starts with the
   *  accumulated buffer, cycling from just after the "current" row (the active row while open,
   *  the preview tag while closed). While open this only moves `activeIndex` (a highlight,
   *  matching Arrow-key nav); while closed it commits immediately, matching `<lr-select>`'s
   *  identical closed-state type-ahead. */
  private typeAhead(char: string): void {
    this.typeBuffer.add(char, this.effectiveLocale);

    const rows = this.normalizedEntries;
    if (!rows.length) return;
    const currentTag = this.open ? rows[this.activeIndex]?.tag : this.previewTag;
    const currentIndex = rows.findIndex((r) => r.tag === currentTag);
    const match = this.typeBuffer.match(rows, currentIndex, row => row.label, this.effectiveLocale);
    if (match === null) return;
    if (this.open) this.setActiveIndex(match);
    else this.commit(rows[match]!.tag);
  }

  /** Updates active-descendant ownership and keeps the resulting row visible after render. */
  private setActiveIndex(index: number): void {
    const last = this.visibleEntries.length - 1;
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
      const row = this.shadowRoot?.getElementById(`${this.listId}-opt-${index}`);
      const popup = this.renderRoot.querySelector<HTMLElement>('[part="listbox"]');
      if (row && popup) revealRow(popup, row, this.searchElement?.offsetHeight);
    });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.liveDisabled || e.isComposing || e.keyCode === 229) return;
    const rows = this.visibleEntries;
    const move = (): number | null => resolveListMove(e, {
      count: rows.length,
      current: this.activeIndex,
      orientation: 'vertical',
      wrap: false,
      clamp: true,
      backwardFromMissing: 'first',
    });
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!this.open) return this.show();
        this.setActiveIndex(move() ?? -1);
        this.queueSearchFocus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!this.open) return this.show();
        this.setActiveIndex(move() ?? -1);
        this.queueSearchFocus();
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
        if (
          this.open &&
          (!this.overlayHandle?.isActive() || this.overlayHandle.isTopmost())
        ) {
          e.preventDefault();
          this.dismissFromEscape();
        }
        break;
      case 'Home':
        if (this.open) {
          e.preventDefault();
          this.setActiveIndex(move() ?? -1);
        }
        break;
      case 'End':
        if (this.open) {
          e.preventDefault();
          this.setActiveIndex(move() ?? -1);
        }
        break;
      default:
        if (this.typeBuffer.accepts(e)) {
          if (this.searchable) {
            e.preventDefault();
            this.show();
            this.searchQuery += e.key;
            this.setActiveIndex(this.visibleEntries.length ? 0 : -1);
            this.queueSearchFocus();
          } else this.typeAhead(e.key);
        }
        break;
    }
  };

  // Delegated onto [part="listbox"] rather than one closure pair allocated per row per render --
  // resolves the target row via closest('[part="option"]') + a data-value lookup, mirroring
  // lr-select/lr-model-select.
  private onListboxMouseDown = (e: MouseEvent): void => {
    if (e.composedPath()[0] !== this.searchElement) e.preventDefault();
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
        ${!this.withoutFlags
          ? entry.country
            ? html`<lr-flag part="option-flag" country=${entry.country} fidelity="compact" aria-hidden="true" inert></lr-flag>`
            : html`<lr-flag part="option-flag" language=${entry.tag} fidelity="compact" aria-hidden="true" inert></lr-flag>`
          : ''}
        <span part="option-label">
          <span>${entry.label}</span>
          ${this.optionDisplay === 'label'
            ? nothing
            : html`<span part="option-tag">${entry.tag}</span>`}
        </span>
      </div>`;
    });
  }

  override render(): TemplateResult {
    const rows = this.visibleEntries;
    const activeId = this.activeIndex >= 0 && rows[this.activeIndex] ? `${this.listId}-opt-${this.activeIndex}` : '';
    const previewTag = this.previewTag;
    const previewEntry = this.entryFor(previewTag);
    const flagOnly = this.triggerDisplay === 'flag' && !this.withoutFlags;
    const hasLabel = this.slotPresence.has('label') || (this.label ?? '').length > 0;
    const hasHint = this.slotPresence.has('hint') || (this.hint ?? '').length > 0;
    const hasError = this.slotPresence.has('error') || (this.errorText ?? '').length > 0;
    const describedBy = this.localDescriptionIds = [flagOnly ? 'locale-picker-value' : '', hasError ? 'locale-picker-error' : '', hasHint ? 'locale-picker-hint' : '', this.loadingTag || this.loadFailureTag ? 'locale-picker-load-status' : '']
      .filter(Boolean)
      .join(' ');
    return html`
      <div part="form-control">
        <label part="form-control-label" for=${this.controlId} ?hidden=${!hasLabel}>
          ${this.label}<slot name="label"></slot>
        </label>
        <button
          id=${this.controlId}
          part="trigger"
          class=${flagOnly ? 'flag-only' : nothing}
          type="button"
          role="combobox"
          aria-haspopup=${this.searchable ? 'dialog' : 'listbox'}
          aria-busy=${this.loadingTag !== undefined ? 'true' : 'false'}
          aria-expanded=${this.open ? 'true' : 'false'}
          aria-controls=${this.listId}
          aria-activedescendant=${this.searchable ? nothing : activeId}
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
          ${!this.withoutFlags && this.triggerDisplay !== 'label'
            ? previewEntry?.country
              ? html`<lr-flag part="trigger-flag" country=${previewEntry.country} fidelity="compact" aria-hidden="true" inert></lr-flag>`
              : html`<lr-flag part="trigger-flag" language=${previewTag} fidelity="compact" aria-hidden="true" inert></lr-flag>`
            : ''}
          <span id="locale-picker-value" part="trigger-label" class=${flagOnly ? 'trigger-label sr-only' : 'trigger-label'}>${this.labelFor(previewTag)}</span>
          ${flagOnly ? nothing : html`<span part="expand-icon" aria-hidden="true" inert>${chevronIcon()}</span>`}
        </button>
        <div
          part="listbox"
          ?hidden=${this.listboxHidden}
          id=${this.listId}
          role=${this.searchable ? 'dialog' : 'listbox'}
          aria-label=${this.searchable ? this.localize('localePickerLabel') : nothing}
          @mousedown=${this.onListboxMouseDown}
          @click=${this.onListboxClick}
        >
          <span class="glass-scroll-layer" aria-hidden="true"></span>
          ${this.searchable ? html`
            <input
              part="search-input"
              type="search"
              role="combobox"
              aria-label=${this.localize('localePickerSearchLabel')}
              placeholder=${this.localize('localePickerSearchLabel')}
              aria-haspopup="listbox"
              aria-autocomplete="list"
              aria-expanded=${this.open ? 'true' : 'false'}
              aria-controls=${`${this.listId}-matches`}
              aria-activedescendant=${activeId || nothing}
              aria-describedby=${rows.length ? nothing : `${this.listId}-empty`}
              autocomplete=${this.autocomplete}
              inputmode=${this.inputMode || nothing}
              enterkeyhint=${this.enterKeyHint || nothing}
              spellcheck=${this.spellcheck ? 'true' : 'false'}
              autocapitalize=${this.autocapitalize || nothing}
              autocorrect=${this.autocorrect ? 'on' : 'off'}
              tabindex=${this.open ? '0' : '-1'}
              ?disabled=${this.effectiveDisabled || !this.open}
              .value=${this.searchQuery}
              @input=${this.onSearchInput}
              @change=${this.onSearchChange}
              @keydown=${this.onSearchKeyDown}
              @focus=${this.onTriggerFocus}
              @blur=${this.onTriggerBlur}
            >
            <div id=${`${this.listId}-matches`} role="listbox" aria-label=${this.localize('localePickerLabel')}>
              ${this.renderRows(rows, activeId)}
            </div>
            ${rows.length ? nothing : html`<div part="empty" id=${`${this.listId}-empty`}>${this.localize('localePickerEmpty')}</div>`}
          ` : this.renderRows(rows, activeId)}
        </div>
        ${this.loadingTag !== undefined || this.loadFailureTag !== undefined ? html`
          <div id="locale-picker-load-status" part="load-status">
            ${this.loadingTag !== undefined ? this.localize('loading') : this.localize('statusError')}
            ${this.loadFailureTag !== undefined ? html`<button part="load-retry" type="button" ?disabled=${this.effectiveDisabled} @click=${this.retryLocaleLoad}
              @focus=${this.searchable ? this.onTriggerFocus : nothing}
              @blur=${this.searchable ? this.onTriggerBlur : nothing}>${this.localize('retry')}</button>` : nothing}
          </div>` : nothing}
        ${renderFormControlHintError({ idPrefix: 'locale-picker', hint: this.hint, errorText: this.errorText, hasHint, hasError })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-locale-picker': LyraLocalePicker;
  }
}
