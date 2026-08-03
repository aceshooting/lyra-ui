import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { place } from '../../../internal/positioner.js';
import { nextId } from '../../../internal/a11y.js';
import { chevronIcon, closeIcon } from '../../../internal/icons.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { setCustomState, syncValidityStates } from '../../../internal/custom-states.js';
import { submitOnEnter } from '../../../internal/submit-on-enter.js';
import { finiteCount, finiteDuration } from '../../../internal/numbers.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraAppearance, LyraSize, LyraSizeStep } from '../../../internal/variants.js';
import { styles } from './combobox.styles.js';
import { LyraOption } from './option.class.js';
import './option.class.js';
import {
  autocorrectConverter,
  omittedEmptyStringConverter,
  spellcheckConverter,
} from '../../../internal/converters.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { sanitizeCssColor } from '../../../internal/safe-css.js';
import {
  getFormOwner,
  installCustomErrorProperty,
  isBarredFromValidation,
  setFormOwner,
  type FormOwnerValue,
} from '../../../internal/form-associated.js';
import { installInvalidEventAlias } from '../../../internal/invalid-event-alias.js';
import { tag } from '../../../internal/prefix.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import {
  isOptionSelectedDirty,
  wasOptionInitiallySelected,
  RESET_OPTION_SELECTED_FROM_OWNER,
  SET_OPTION_SELECTED_FROM_OWNER,
} from '../../../internal/option-selection.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_clear, LYRA_DEFAULT_collapse, LYRA_DEFAULT_comboboxCreate, LYRA_DEFAULT_comboboxLabel, LYRA_DEFAULT_comboboxLoadError, LYRA_DEFAULT_comboboxOverflow, LYRA_DEFAULT_comboboxRequired, LYRA_DEFAULT_comboboxSelectedOverflow, LYRA_DEFAULT_date, LYRA_DEFAULT_details, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_loading, LYRA_DEFAULT_noMatches, LYRA_DEFAULT_open, LYRA_DEFAULT_removeWithContext, LYRA_DEFAULT_restore, LYRA_DEFAULT_search } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** A no-op stand-in for `ElementInternals`, used only when the host environment has no real
 *  implementation of it (e.g. a downstream consumer's Vitest + happy-dom test suite) --
 *  `attachInternals()` is browser-only, and calling it unconditionally in the constructor would
 *  otherwise throw before any test assertion runs, merely from constructing or importing this
 *  component. Every member here is either an inert value or a no-op: native `<form>`
 *  participation is unavailable in that environment, but that's an acceptable degradation rather
 *  than a hard failure -- same fix as `<lr-model-select>`'s/`<lr-tool-param-form>`'s identical
 *  `createInternalsSafely`/`createNoopInternals` pair. */
function createInternalsSafely(host: HTMLElement): ElementInternals {
  if (typeof host.attachInternals !== 'function') return createNoopInternals();
  try {
    return host.attachInternals();
  } catch {
    return createNoopInternals();
  }
}

function createNoopInternals(): ElementInternals {
  return {
    form: null,
    labels: [] as unknown as NodeList,
    validity: {} as ValidityState,
    validationMessage: '',
    willValidate: false,
    setFormValue(): void {},
    setValidity(): void {},
    checkValidity(): boolean {
      return true;
    },
    reportValidity(): boolean {
      return true;
    },
  } as unknown as ElementInternals;
}

export type OptionFilter = (option: LyraOption, query: string) => boolean;
/** Alias of the library-wide {@linkcode LyraSizeStep}; kept as a named export so existing imports
 *  and the generated manifest keep resolving while there is exactly one definition of the ladder. */
export type LyraComboboxSize = LyraSizeStep;
export type LyraComboboxAppearance = Extract<LyraAppearance, 'filled' | 'outlined' | 'filled-outlined'>;
export type LyraComboboxPlacement = 'top' | 'bottom';
export type LyraComboboxTagRenderer = (option: LyraOption, index: number) => unknown;

export interface ComboboxSourceRow {
  value: string;
  label: string;
  sub?: string;
  /** Optional decorative leading visual. */
  icon?: unknown;
  /** Optional trailing metadata badge. */
  badge?: string | number;
  /** Spoken option label when the visible row needs additional context. */
  accessibleLabel?: string;
  /** Opaque application payload retained in `selectedRows`. */
  data?: unknown;
  dotColor?: string;
  group?: string;
  disabled?: boolean;
  /** @internal Marks the synthetic, cancelable "create this value" action row. */
  createInput?: string;
}

/** Async row provider for a remote-backed combobox. Receives the current query and an options bag
 *  carrying an `AbortSignal` that the component aborts when a newer query supersedes this one or the
 *  element disconnects — forward it to `fetch(url, { signal })` to cancel stale in-flight requests.
 *  The options parameter is required by the exported type so implementations can consume the
 *  cancellation signal. A one-parameter `(query) => …` function remains assignable under
 *  TypeScript's ordinary function-parameter compatibility rules. */
export type ComboboxSource = (
  query: string,
  options: { signal: AbortSignal },
) => Promise<ComboboxSourceRow[]>;
export type LyraComboboxSelectionDirection = 'forward' | 'backward' | 'none';

/** Detail of `lr-filter`: the in-progress filter text, never the committed selection. */
export interface ComboboxFilterDetail {
  value: string;
}

export interface LyraComboboxEventMap {
  'lr-invalid': CustomEvent<undefined>;
  'lr-show': CustomEvent<undefined>;
  'lr-after-show': CustomEvent<undefined>;
  'lr-hide': CustomEvent<undefined>;
  'lr-after-hide': CustomEvent<undefined>;
  'lr-clear': CustomEvent<undefined>;
  'lr-create': CustomEvent<{ inputValue: string }>;
  'lr-filter': CustomEvent<ComboboxFilterDetail>;
  'lr-change': CustomEvent<{ value: string | string[] }>;
  input: InputEvent | CustomEvent<{ value: string | string[] }>;
  change: CustomEvent<{ value: string | string[] }>;
  blur: FocusEvent;
  focus: FocusEvent;
}
/**
 * `<lr-combobox>` — a filterable single/multi select that combines a text
 * input with a listbox. Mirrors the core `<wa-combobox>` API under `lr-`.
 *
 * Options are `<lr-option value>` children. Emits native-style `change`/`input`
 * (like Web Awesome) plus `lr-show`/`lr-hide`/`lr-clear`.
 * Enter commits the highlighted option while the listbox has one; with nothing highlighted it
 * performs the implicit form submission a native text field would (see
 * `internal/submit-on-enter.ts` — the internal input is in a shadow root and has no form owner, so
 * the platform can never do it here).
 * Standard size tiers share their outer control height with sibling Lyra controls; the decorative
 * expand icon scales inside that allocation without creating an independent action target.
 * An async `source` failure renders as a disabled listbox row, not a shadow-root live region; each
 * current post-mount rejection appends the localized `comboboxLoadError` message to the shared
 * light-DOM assertive announcement sink. Raw caught error text is never exposed to users.
 *
 * @customElement lr-combobox
 * @slot - `<lr-option>` elements.
 * @slot label - Custom label content.
 * @slot hint - Custom hint content.
 * @slot error - Custom error content.
 * @slot start - Adornment at the inline-start of the trigger row, before the selected-value tags
 *   and the filter input. Slotted content is decorative chrome, not an option: `collectOptions()`
 *   only ever collects `<lr-option>` elements from the default slot.
 * @slot end - Adornment after the filter input and the built-in clear action, and before the
 *   expand icon — so consumer content never sits outboard of the dropdown chevron.
 * @slot clear-icon - Replaces the clear button's built-in icon.
 * @slot expand-icon - Replaces the dropdown indicator's built-in icon.
 * @event {CustomEvent<{ value: string | string[] }>} change - The selection changed through user
 * interaction. A bubbling, composed, non-cancelable event carrying `detail: { value }` (the new
 * committed selection: a string in single mode, a string[] in `multiple` mode).
 * @event {InputEvent | CustomEvent<{ value: string | string[] }>} input - The user typed in the
 * filter or changed the selection. Text edits expose the original InputEvent (no `value` detail);
 * selection changes emit a bubbling, composed, non-cancelable event carrying `detail: { value }`.
 * @event {CustomEvent<{ value: string | string[] }>} lr-change - Prefixed compatibility alias fired
 * after `input` and `change` on the same selection change, mirroring `<lr-checkbox>`'s `lr-change`.
 * `detail: { value }`. Not fired for typing or a programmatic `value` assignment.
 * @event lr-show - The listbox is about to open, however `open` became true. Cancelable —
 *   `preventDefault()` leaves it closed and the reflected attribute untouched.
 * @event lr-after-show - The listbox finished opening and its transition settled.
 * @event lr-hide - The listbox is about to close, however `open` became false. Conditionally
 *   cancelable: connected transitions can be vetoed on the same terms as `lr-show`; an
 *   already-removed element closing on disconnect cannot honour a veto.
 * @event lr-after-hide - The listbox finished closing and its transition settled.
 * @event lr-clear - The value was cleared.
 * @event {CustomEvent<{ inputValue: string }>} lr-create - Cancelable request to create a
 *   nonmatching input value. Prevent the event to supply a normalized option/value yourself.
 * @event {CustomEvent<ComboboxFilterDetail>} lr-filter - The in-progress filter text changed
 * through user input. `detail.value` is the live filter string, which is not the same thing as the
 * host's `value` (the committed selection). User-input only: typing and the clear button announce
 * it, while the programmatic paths that blank the filter — picking a row, `form.reset()`,
 * dismissing the listbox, a `value` write, `setRangeText()` — are all silent, mirroring
 * `<lr-input>`'s `lr-input`.
 * @event {FocusEvent} blur - Re-dispatched from the internal native input as a bubbling, composed,
 * non-cancelable event.
 * @event {FocusEvent} focus - Re-dispatched from the internal native input as a bubbling, composed,
 * non-cancelable event.
 * @event lr-invalid - The combobox failed a validity check. Cancelable: calling
 * `preventDefault()` also cancels the native `invalid` event behind it, suppressing the
 * browser's own validation bubble so an app can present the failure its own way.
 * @csspart form-control - The outer wrapper around label, combobox, listbox, error and hint.
 * @csspart form-control-label - The `<label>` element.
 * @csspart label - Compatibility wrapper around the visible label content.
 * @csspart form-control-input - Compatibility wrapper around the editable control.
 * @csspart combobox - The input container (positioning anchor).
 * @csspart combobox-input - The text input.
 * @csspart start - Wrapper around the `start` adornment slot; `hidden` while nothing is slotted.
 * @csspart end - Wrapper around the `end` adornment slot; `hidden` while nothing is slotted.
 * @csspart listbox - The options popover.
 * @csspart option - An option row.
 * @csspart option-dot - An option row's leading status dot (when `dot-color` is set).
 * @csspart option-icon - An async option row's optional decorative leading visual.
 * @csspart option-label - An option row's label/sub wrapper.
 * @csspart option-sub - An option row's secondary line (when `sub` is set).
 * @csspart option-badge - An async option row's optional trailing metadata badge.
 * @csspart option-overflow - The "+N more" indicator shown when rows are capped by `maxRender`.
 * @csspart tags - The multi-select tag container.
 * @csspart tag - An individual selected tag.
 * @csspart tag-label - The wrapping/ellipsis-safe selected-tag label.
 * @csspart tag__content - Compatibility wrapper around a selected tag's visible content.
 * @csspart tag__remove-button - A tag's remove button.
 * @csspart tag__remove-button__base - Compatibility name on a tag's remove button.
 * @csspart clear-button - The clear button.
 * @csspart expand-icon - The dropdown indicator.
 * @csspart error - Ordinary form-validation text referenced by the internal input; it is not a
 *   live region, avoiding a second announcement alongside native validation/focus feedback.
 * @csspart hint - The hint message.
 * @cssprop --lr-combobox-trigger-padding - Padding inside the input container.
 * @cssprop [--lr-combobox-trigger-min-height=var(--lr-form-control-height)] - Minimum
 *   input-container block size. Reads the shared form-control height ladder, so retuning
 *   `--lr-theme-form-control-height-*` moves this control and every sibling field together.
 * @cssprop --lr-combobox-trigger-height - Exact input-container height. Unset by default, which
 *   leaves `--lr-combobox-trigger-min-height` as a floor only; set it to a length to both floor and
 *   cap the row (e.g. to pixel-match `<lr-input>`/`<lr-select>` in the same toolbar). Because it is
 *   never declared by the component itself, it can be set from an ancestor or an outer-tree rule as
 *   well as inline on the element. Intended for a single-row combobox: in `multiple` mode a tag row
 *   long enough to wrap overflows the pinned box visibly (nothing is clipped or made unreachable),
 *   so leave it unset there.
 * @cssprop [--lr-combobox-font-size=var(--lr-form-control-font-size)] - Input text size, from the
 *   shared form-control size ladder.
 * @cssprop --lr-combobox-tag-padding - Selected-tag padding.
 * @cssprop --lr-combobox-tag-font-size - Selected-tag text size.
 * @cssprop --lr-combobox-expand-size - Decorative expand-icon box size, scaled by `size`.
 * @cssprop [--lr-combobox-gap=var(--lr-space-xs)] - Gap between the start/end adornments, tags,
 *   and filter input inside the trigger row. Unlike the size knobs above it does not vary by
 *   `size` tier. Override it to retune without a `::part(combobox)` rule.
 * @cssprop [--lr-combobox-radius=var(--lr-radius)] - Corner radius of the trigger row
 *   (`[part='combobox']`). Does not vary by `size` tier; the `pill` attribute swaps it for
 *   `--lr-radius-pill`.
 * @cssprop [--lr-combobox-option-active-bg=var(--lr-color-brand-quiet)] - Background of a hovered
 *   or keyboard-active option row.
 * @cssprop [--lr-combobox-option-selected-bg=transparent] - Background of the currently-selected
 *   option row. Not declared on `:host`; retheme without hijacking `--lr-color-brand`.
 * @cssprop [--lr-combobox-option-selected-border=var(--lr-color-brand)] - Border color of the
 *   selected option row.
 * @cssprop [--lr-combobox-option-selected-color=var(--lr-color-brand)] - Text color of the
 *   selected option row.
 * @cssprop [--lr-combobox-option-selected-font-weight=var(--lr-font-weight-semibold)] - Font
 *   weight of the selected option row.
 * @cssprop [--tag-max-size=var(--lr-size-5rem)] - Maximum inline size of a built-in selected tag.
 * @cssprop [--show-duration=var(--lr-transition-fast)] - Listbox enter-transition duration.
 * @cssprop [--hide-duration=var(--lr-transition-fast)] - Listbox exit-transition duration.
 * @cssprop [--lr-form-control-required-content=' *'] - The required marker appended to
 * `form-control-label` while `required` is set. Set it to `''` to suppress the marker, or to any
 * other quoted string (`' (required)'`, a localized word) to replace it.
 * @cssprop [--lr-form-control-required-color=var(--lr-color-danger)] - Required-marker color,
 * themeable independently of error text and invalid borders.
 * @cssprop [--lr-form-control-required-offset=0] - Inline space between the label text and the
 * required marker.
 * @cssstate blank - Matches while no value is selected.
 * @cssstate disabled - Matches while disabled directly or by an ancestor fieldset.
 * @cssstate required - Matches while `required` is set, so a consumer can mark the field without
 *   duplicating that flag in their own markup.
 * @cssstate optional - Matches while `required` is not set (the complement of `required`).
 * @cssstate valid - Matches while the control satisfies its constraints.
 * @cssstate invalid - Matches while it does not — including a pristine required-and-empty
 *   combobox, exactly like native `:invalid`.
 * @cssstate user-valid - `valid`, but only after the user has interacted (blurred the filter
 *   input, committed a selection, or been through a `reportValidity()`/submit attempt).
 * @cssstate user-invalid - `invalid`, but only after that same interaction — a required combobox
 *   nobody has touched yet is invalid without being styled as an error.
 * @status stable
 * @since 4.0.0
 */
export class LyraCombobox extends LyraElement<LyraComboboxEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    clear: LYRA_DEFAULT_clear,
    collapse: LYRA_DEFAULT_collapse,
    comboboxCreate: LYRA_DEFAULT_comboboxCreate,
    comboboxLabel: LYRA_DEFAULT_comboboxLabel,
    comboboxLoadError: LYRA_DEFAULT_comboboxLoadError,
    comboboxOverflow: LYRA_DEFAULT_comboboxOverflow,
    comboboxRequired: LYRA_DEFAULT_comboboxRequired,
    comboboxSelectedOverflow: LYRA_DEFAULT_comboboxSelectedOverflow,
    date: LYRA_DEFAULT_date,
    details: LYRA_DEFAULT_details,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    loading: LYRA_DEFAULT_loading,
    noMatches: LYRA_DEFAULT_noMatches,
    open: LYRA_DEFAULT_open,
    removeWithContext: LYRA_DEFAULT_removeWithContext,
    restore: LYRA_DEFAULT_restore,
    search: LYRA_DEFAULT_search,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static formAssociated = true;
  static override styles = [LyraElement.styles, sizes, styles];

  static override properties = {
    customError: { attribute: 'custom-error', reflect: true, noAccessor: true },
    multiple: { type: Boolean, reflect: true, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    required: { type: Boolean, reflect: true, noAccessor: true },
    value: { noAccessor: true },
    name: { reflect: true, noAccessor: true, converter: omittedEmptyStringConverter },
    maxOptionsVisible: { type: Number, attribute: 'max-options-visible', noAccessor: true },
    maxRender: { type: Number, attribute: 'max-render', noAccessor: true },
    sourceDelay: { type: Number, attribute: 'source-delay', noAccessor: true },
  };

  @property() placeholder = '';
  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  @property({ type: Boolean, reflect: true }) open = false;
  /** Allows a nonmatching query to be created as a new option through the cancelable `lr-create`
   * veto point. The default action appends and selects an `<lr-option>`. */
  @property({ type: Boolean, attribute: 'allow-create' }) allowCreate = false;
  /** Lets a single-select combobox commit arbitrary text without adding an option. */
  @property({ type: Boolean, attribute: 'allow-custom-value' }) allowCustomValue = false;
  /** Visual treatment shared with other Lyra form controls. */
  @property({ reflect: true }) appearance: LyraComboboxAppearance = 'outlined';
  /** Preferred vertical side for the floating listbox. */
  @property({ reflect: true }) placement: LyraComboboxPlacement = 'bottom';
  /** Visual size — the library-wide `2xs`–`xl` ladder shared with `lr-input`/`lr-select`. The
   *  Web Awesome / Shoelace spellings `small`/`medium`/`large` are accepted for `s`/`m`/`l`, so a
   *  migration is a tag rename with no attribute rewrite. */
  @property({ reflect: true }) size: LyraSize = 'm';
  /** Rounds the trigger row's corners to a full pill, mirroring `lr-input`'s own `pill`. It is a
   *  single override of `--lr-combobox-radius`, so a consumer setting that property directly still
   *  wins for a bespoke shape. */
  @property({ type: Boolean, reflect: true }) pill = false;
  /** Show a clear button while the combobox has something to clear on either axis: a committed
   *  selection, or visible filter text (the open listbox in single-select, any time in `multiple`
   *  mode — a closed single-select shows the selected label, not the query, so a stale query alone
   *  never surfaces the button). Clearing a selection emits `input`/`change`/`lr-clear`; clearing
   *  filter text emits `lr-filter` with an empty `value`; each fires only for the axis that
   *  actually changed. Named after Shoelace's `clearable`; Web Awesome spells the same idea
   *  `with-clear`, which is accepted as an alias so either migration keeps working. */
  @property({ type: Boolean, reflect: true }) clearable = false;
  /** Web Awesome's spelling of {@link clearable}, accepted so a mechanical `wa-` → `lr-` rename
   *  does not silently drop the clear button. Prefer `clearable` in new code. */
  @property({ type: Boolean, attribute: 'with-clear' }) withClear = false;
  /** SSR slot-presence hint for label content. */
  @property({ type: Boolean, attribute: 'with-label' }) withLabel = false;
  /** SSR slot-presence hint for hint content. */
  @property({ type: Boolean, attribute: 'with-hint' }) withHint = false;
  /** Custom selected-tag renderer in multiple mode. Returned strings stay text, never markup. */
  @property({ attribute: false }) getTag?: LyraComboboxTagRenderer;
  /** Consumer-managed validator inventory, retained for public-surface compatibility. */
  @property({ attribute: false }) validators: unknown[] = [];
  /** Native editing-assistance attributes forwarded to the wrapped input. */
  @property() autocomplete = 'off';
  @property({ attribute: 'inputmode' }) override inputMode = '';
  @property({ attribute: 'enterkeyhint' }) override enterKeyHint = '';
  @property({ converter: spellcheckConverter }) override spellcheck = false;
  @property() override autocapitalize = '';
  private autocorrectValue = true;
  /** Status copy shown in the listbox when no rows match. Empty string falls back to a localized message. */
  @property({ attribute: 'empty-text' }) emptyText = '';
  /** Status copy shown in the listbox while a `source` fetch is in flight. Empty string falls back to a localized message. */
  @property({ attribute: 'loading-text' }) loadingText = '';
  /** Status copy shown when `maxRender` caps the row list; `{n}` is replaced with the hidden count. Empty string falls back to a localized message. */
  @property({ attribute: 'overflow-text' }) overflowText = '';
  @property({ attribute: false }) filter: OptionFilter | null = null;
  @property({ attribute: false }) source: ComboboxSource | null = null;

  /** Web Awesome's boolean `autocorrect` IDL; its HTML attribute uses `on`/`off`. */
  @property({ converter: autocorrectConverter })
  override get autocorrect(): boolean {
    return this.autocorrectValue;
  }
  override set autocorrect(next: boolean) {
    this.autocorrectValue = Boolean(next);
    // Attribute presence controls whether the native hint is omitted, so removing an `on`
    // attribute must render even though the normalized boolean remains `true`.
    this.requestUpdate();
  }
  /** Lowercase mapped IDL aliases for the remaining camel-case native spellings. */
  get inputmode(): string {
    return this.inputMode;
  }
  set inputmode(next: string) {
    this.inputMode = next ?? '';
  }
  get enterkeyhint(): string {
    return this.enterKeyHint;
  }
  set enterkeyhint(next: string) {
    this.enterKeyHint = next ?? '';
  }

  /** Live text in the native filter input. Programmatic writes are event-silent.
   * @default '' */
  get inputValue(): string {
    return this.query;
  }
  set inputValue(next: string) {
    this.explicitInputValue = true;
    this.query = next ?? '';
    this.activeIndex = -1;
    if (this.source) this.runSource(this.query);
    this.requestUpdate();
  }

  // The in-progress filter text. Public read access is the `lr-filter` event
  // rather than a property, so consumers never have to reach into the shadow
  // input for it. Exactly two writers are user-driven and therefore emit:
  // `onInput()` (typing) and `clear()` (the clear button, but only when the
  // query it blanks was actually non-empty). Every other assignment below --
  // `setRangeText()` (a programmatic editing API; native
  // `<input>.setRangeText()` likewise fires no `input` event),
  // `formResetCallback()`, `hide()`, and `pickRow()`'s two commit resets -- is
  // the component blanking its own filter, never the user driving it, so none
  // of them emit.
  @state() private query = '';
  /** Public `inputValue` and `setRangeText()` writes remain visible while closed; stale user filter
   * text left behind by a direct `open = false` write does not. */
  private explicitInputValue = false;
  @state() private activeIndex = -1;
  @state() private options: LyraOption[] = [];
  // Set on the combobox input's first `blur`; gates the `data-invalid`
  // reflection below so validity styling never flashes on first render.
  @state() private touched = false;
  // Applies to `form-control-label` too: leaving that box visible would orphan its required
  // asterisk. The default option slot keeps its identity-aware collection handler below.
  private readonly slotPresence = new SlotPresenceController(this);
  @state() private loading = false;
  @state() private sourceFailed = false;
  @state() private asyncRows: ComboboxSourceRow[] = [];
  private sourceErrorAnnouncementSink?: AnnouncementSink;
  @query('[part="combobox-input"]') private inputEl?: HTMLInputElement;
  private sourceTimer?: { owner: Window; handle: number; token: number };
  private sourceToken = 0;
  /** Aborted when a newer query supersedes the in-flight one, or on disconnect, so the source's
   *  own `fetch` can cancel. */
  private sourceAbort?: AbortController;
  // Guards the proactive `asyncRows` warm-up in `willUpdate()` below so it
  // fires at most once per mount instead of re-running (and endlessly
  // resetting the debounce timer) on every subsequent render while the fetch
  // is still in flight.
  private _sourceWarmed = false;
  private _selectedLabelCache = new Map<string, string>();
  private _selectedRowCache = new Map<string, ComboboxSourceRow>();
  // Rebuilt once per render (in render(), before renderRows()) from the
  // currently-visible row set -- backs the delegated listbox click/mousedown
  // handlers' data-value lookup below, instead of each option row closing
  // over its own row object.
  private _rowsByValue = new Map<string, ComboboxSourceRow>();

  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  /** Consumer-supplied validation message reflected through `custom-error`. */
  declare customError: string | null;
  // Tracked separately from the consumer's own `disabled` -- a native
  // `<input>`'s own `disabled` IDL property/attribute is never mutated by
  // fieldset cascading, so a consumer's explicit `disabled` must survive the
  // fieldset re-enabling (see `formDisabledCallback` below).
  private _fieldsetDisabled = false;
  private listId = nextId('combobox-list');
  private inputId = nextId('combobox-input');
  private cleanup?: () => void;
  private pointerListenerDocument?: Document;
  private pointerListener?: (event: PointerEvent) => void;
  private _isFirstUpdate = true;
  private openVetoed = false;
  private transitionToken = 0;
  private transitionWaiters = new Map<'lr-after-show' | 'lr-after-hide', Set<() => void>>();
  private _selected: string[] = [];
  private _valueDirty = false;
  private _multiple = false;
  private _disabled = false;
  private _required = false;
  // What `form.reset()` restores to. Captured exactly once, from whatever
  // `<lr-option selected>` markup was present the first time slotted
  // options are collected (mirrors native `<select><option selected>`) —
  // never from the `value` setter, so a user picking an option (even the
  // very first pick on an initially-unselected combobox) can't itself
  // become the reset default (native `defaultValue`/`defaultSelected`
  // semantics: only declarative/attribute state feeds the default, plain
  // property assignment never does).
  private _defaultSelected: string[] = [];
  private _defaultCaptured = false;
  // A restored value must win over declarative selected markup collected by
  // the first asynchronous slotchange. Cleared by the next ordinary value write.
  private _restoredStateActive = false;

  // Hand-written accessor (mirrors the `value` accessor below, and the
  // `FormAssociated.name` in `../../internal/form-associated.ts`): a
  // form-associated custom element's submitted entry name is resolved by the
  // browser from the live `name` *content attribute*, read synchronously at
  // FormData-construction/submit time (see `syncFormValue()` below) -- Lit's
  // async (microtask-deferred) `reflect: true` alone would leave a
  // property-only assignment like `el.name = 'b'` invisible to a same-tick
  // `new FormData(form)`/submit, so the attribute write happens here instead.
  private _name = '';
  private validationTargetOverride?: HTMLElement;
  // `noAccessor` hand-rolled accessors (mirrors `name`/`multiple`/etc. above): these feed
  // virtualization/render-limiting logic (`shownTags.slice`, `renderedRows`'s cap) directly, so a
  // NaN/negative value must never reach it -- sanitized synchronously here via `finiteCount`
  // rather than left for Lit's default async field setter to hand through unchecked.
  private _maxOptionsVisible = 3;
  private _maxRender = 200;
  private _sourceDelay = 200;

  constructor() {
    super();
    this.internals = createInternalsSafely(this);
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
    installCustomErrorProperty(this, () => this.validityController.customValidityMessage);
    installInvalidEventAlias(this, (init: { cancelable: true }) =>
      this.emit('lr-invalid', undefined, init));
  }

  get form(): HTMLFormElement | null {
    return getFormOwner(this.internals);
  }
  set form(owner: FormOwnerValue) {
    setFormOwner(this, owner);
  }
  /** Returns the owning form, including an external owner selected by the `form` attribute. */
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

  /** Native element used as the constraint-validation focus anchor. */
  get validationTarget(): HTMLElement | undefined {
    return this.validationTargetOverride ?? this.inputEl ?? undefined;
  }
  set validationTarget(next: HTMLElement | undefined) {
    this.validationTargetOverride = next ?? undefined;
    this.validityController.refreshAnchor();
  }

  /** Clears consumer-supplied validity and restores the current intrinsic constraints. */
  resetValidity(): void {
    this.validityController.setCustomValidity('');
    this.updateValidity();
  }

  /** The internal native filter input, for direct DOM access when needed. */
  get input(): HTMLInputElement | null {
    return this.inputEl ?? null;
  }

  get selectionStart(): number | null {
    return this.inputEl?.selectionStart ?? null;
  }

  set selectionStart(value: number | null) {
    if (this.inputEl) this.inputEl.selectionStart = value;
  }

  get selectionEnd(): number | null {
    return this.inputEl?.selectionEnd ?? null;
  }

  set selectionEnd(value: number | null) {
    if (this.inputEl) this.inputEl.selectionEnd = value;
  }

  get selectionDirection(): LyraComboboxSelectionDirection | null {
    return this.inputEl?.selectionDirection as LyraComboboxSelectionDirection | null;
  }

  set selectionDirection(value: LyraComboboxSelectionDirection | null) {
    if (this.inputEl) this.inputEl.selectionDirection = value;
  }

  override focus(options?: FocusOptions): void {
    this.inputEl?.focus(options);
  }

  override blur(): void {
    this.inputEl?.blur();
  }

  /** Activates the trigger the same way a real mouse click on `[part='combobox']` would --
   *  focuses the filter input and opens the listbox (mirrors `onComboMouseDown` below). Without
   *  this override, `HTMLElement.prototype.click()` on the host is a no-op: a custom element has
   *  no native click activation behavior of its own, so a generic form-submit helper, test
   *  utility, or automation script calling `.click()` on `<lr-combobox>` directly (rather than on
   *  its shadow-internal parts) would otherwise silently do nothing. */
  override click(): void {
    if (this.effectiveDisabled) return;
    this.inputEl?.focus();
    this.show();
  }

  select(): void {
    this.inputEl?.select();
  }

  setSelectionRange(
    start: number | null,
    end: number | null,
    direction?: LyraComboboxSelectionDirection,
  ): void {
    this.inputEl?.setSelectionRange(start, end, direction);
  }

  setRangeText(replacement: string): void;
  setRangeText(replacement: string, start: number, end: number, selectMode?: SelectionMode): void;
  setRangeText(replacement: string, start?: number, end?: number, selectMode?: SelectionMode): void {
    const input = this.inputEl;
    if (!input) return;
    if (start === undefined || end === undefined) {
      input.setRangeText(replacement);
    } else {
      input.setRangeText(replacement, start, end, selectMode);
    }
    this.explicitInputValue = true;
    this.query = input.value;
    this.activeIndex = -1;
    if (this.source) this.runSource(this.query);
  }

  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | undefined {
    return this.validationTarget;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncSourceErrorAnnouncementSink();
    this.updateValidity();
    if (this.hasUpdated) {
      queueMicrotask(() => {
        if (this.open) this.reconnectOpenPopup();
        else if (this.source && this._selected.length && this.asyncRows.length === 0) {
          this.runSource('');
        }
      });
    }
  }

  adoptedCallback(): void {
    this.cleanup?.();
    this.cleanup = undefined;
    this.unbindDocumentPointer();
    this.clearSourceTimer();
    this.sourceToken += 1;
    this.sourceAbort?.abort();
    this.sourceAbort = undefined;
    this.releaseSourceErrorAnnouncementSink();
    this.syncSourceErrorAnnouncementSink();
  }

  private syncSourceErrorAnnouncementSink(): void {
    if (!this.isConnected) return;
    if (this.sourceErrorAnnouncementSink?.element.ownerDocument === this.ownerDocument) return;
    this.releaseSourceErrorAnnouncementSink();
    this.sourceErrorAnnouncementSink = acquireAnnouncementSink('assertive', {
      document: this.ownerDocument,
      source: this,
    });
  }

  private releaseSourceErrorAnnouncementSink(): void {
    this.sourceErrorAnnouncementSink?.release();
    this.sourceErrorAnnouncementSink = undefined;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // no-op in LyraElement/ReactiveElement today, but a future mixin's
    // willUpdate() layered under this class must still run.
    // `hasUpdated` flips to `true` before `updated()` even sees its first
    // call, so it can't distinguish "just mounted" from "just changed" there
    // -- capture that distinction here, while it's still reliable, for
    // `updated()`'s `open`-handling below to consult.
    this._isFirstUpdate = !this.hasUpdated;
    this.announceOpenTransition(changed);
    if (changed.has('source')) {
      this.clearSourceTimer();
      this.sourceAbort?.abort();
      this.sourceAbort = undefined;
      this.sourceToken++;
      this.loading = false;
      this.sourceFailed = false;
      this.asyncRows = [];
      this.activeIndex = -1;
      this._sourceWarmed = false;
      if (this.source && this.open) this.runSource(this.query);
    }
    // In source (async) mode, `labelFor()` can only resolve a programmatically
    // -set value's label from `asyncRows` -- and nothing normally populates
    // `asyncRows` until the listbox is actually opened. Fire the fetch once,
    // independent of `open`, so the closed input / multi-select tag chips can
    // already show the real label the very first time they render (the
    // common "edit an existing record" case) instead of the raw value string.
    if (!this._sourceWarmed && this.source && this._selected.length && this.asyncRows.length === 0) {
      this._sourceWarmed = true;
      this.runSource('');
    }
  }

  /** Submitted field name.
   * @default '' */
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
    this.syncFormValue();
    this.requestUpdate('name', old);
  }

  /** Enables multiple selection.
   * @default false */
  get multiple(): boolean {
    return this._multiple;
  }
  set multiple(next: boolean) {
    const old = this._multiple;
    this._multiple = Boolean(next);
    this.toggleAttribute('multiple', this._multiple);
    this.syncFormValue();
    this.requestUpdate('multiple', old);
  }

  /** Disables every interactive sub-control.
   * @default false */
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    this.toggleAttribute('disabled', this._disabled);
    if (this._disabled) this.hide();
    // Disabling bars constraint validation, so the violation itself is recomputed here -- not just
    // the states republished.
    this.updateValidity();
    this.requestUpdate('disabled', old);
  }

  /** Requires at least one committed selection.
   * @default false */
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

  /** The selected value(s): a string in single mode, a string[] in `multiple` mode. */
  get value(): string | string[] {
    return this.multiple ? [...this._selected] : (this._selected[0] ?? '');
  }
  set value(next: string | string[]) {
    this.setValue(next, true);
  }

  private setValue(next: string | string[], dirty: boolean): void {
    const old = this._selected;
    if (dirty) {
      this._restoredStateActive = false;
      this._valueDirty = true;
    }
    this._selected = Array.isArray(next) ? [...next] : next ? [next] : [];
    const selected = new Set(this._selected);
    for (const value of selected) {
      const row =
        this.effectiveRows.find((candidate) => candidate.value === value) ??
        this.asyncRows.find((candidate) => candidate.value === value);
      if (row) this._selectedRowCache.set(value, row);
    }
    for (const value of this._selectedRowCache.keys()) {
      if (!selected.has(value)) this._selectedRowCache.delete(value);
    }
    // `_selectedLabelCache` gets the identical treatment -- otherwise it
    // grows by one permanent entry per distinct value ever selected over the
    // element's lifetime, unlike `_selectedRowCache` above which is already
    // pruned back to the live selection on every write.
    for (const value of this._selectedLabelCache.keys()) {
      if (!selected.has(value)) this._selectedLabelCache.delete(value);
    }
    this.syncFormValue();
    this.reflectSelected();
    this.updateValidity();
    this.requestUpdate('value', old);
  }

  /** Maximum number of selected-value tags shown before the rest collapse behind a "+N" tag
   *  (multi-select only). Sanitized to a finite, non-negative integer.
   * @default 3 */
  get maxOptionsVisible(): number {
    return this._maxOptionsVisible;
  }
  set maxOptionsVisible(next: number) {
    const old = this._maxOptionsVisible;
    this._maxOptionsVisible = finiteCount(next, 3);
    this.requestUpdate('maxOptionsVisible', old);
  }

  /** Maximum number of rows rendered before the rest collapse behind the overflow indicator
   *  (the current selection is always kept visible regardless). Sanitized to a finite,
   *  non-negative integer.
   *
   *  Rows render in full rather than as a recycled scroll window, because the filter input's
   *  `aria-activedescendant` is an IDREF and can only resolve within its own tree scope — rows
   *  hosted inside a nested windowing element would sit one shadow root deeper than the input
   *  that must point at them. Raising this to cover a few-hundred-entry list (countries,
   *  currencies, time zones) is the intended use; past roughly a thousand rows, `source` narrows
   *  the set before it becomes DOM and is the better tool. */
  get maxRender(): number {
    return this._maxRender;
  }
  /** Debounce (ms) between the last keystroke and the `source` call. Sanitized to a finite
   *  duration clamped to `[0, browser-timer-ceiling]`; `0` fires on every keystroke, a
   *  non-finite value falls back to the `200` default. */
  get sourceDelay(): number {
    return this._sourceDelay;
  }
  set sourceDelay(next: number) {
    const old = this._sourceDelay;
    this._sourceDelay = finiteDuration(next, 200);
    this.requestUpdate('sourceDelay', old);
  }

  set maxRender(next: number) {
    const old = this._maxRender;
    this._maxRender = finiteCount(next, 200);
    this.requestUpdate('maxRender', old);
  }

  /** Structured rows corresponding to the current selection, including opaque async-row data. */
  get selectedRows(): ComboboxSourceRow[] {
    return this._selected
      .map(
        (value) =>
          this._selectedRowCache.get(value) ??
          this.effectiveRows.find((row) => row.value === value) ??
          this.asyncRows.find((row) => row.value === value),
      )
      .filter((row): row is ComboboxSourceRow => row != null);
  }

  /** Shared with every other form control: disabled (own or fieldset-cascaded) bars validation. */
  private get barredFromValidation(): boolean {
    return isBarredFromValidation(this, this.internals);
  }

  private updateValidity(): void {
    if (this.barredFromValidation) {
      // A barred control reports no violation at all, exactly like a native disabled `<select>` --
      // leaving `valueMissing` raised is what leaked `:state(invalid)` onto disabled required
      // comboboxes, and with it the documented `:state(user-invalid)` error styling.
      this.validityController.setValidity({});
    } else if (this.required && this._selected.length === 0) {
      this.validityController.setValidity({ valueMissing: true }, this.localize('comboboxRequired'));
    } else {
      this.validityController.setValidity({});
    }
    this.syncCustomStates();
  }

  /**
   * Publishes the six validity custom states (`:state(required)`/`optional`, `valid`/`invalid`,
   * `user-valid`/`user-invalid`). The implementation is shared with every other form-associated
   * control in the library — see `internal/custom-states.ts`; this component drives
   * `ElementInternals` directly rather than through the `FormAssociated` mixin (its value is a
   * `string[]` in `multiple` mode, which that string-value mixin cannot carry), so it calls the
   * helper itself. `touched` is this component's own interaction flag, already set by the filter
   * input's blur, so the `user-*` pair stays off a pristine control the way native
   * `:user-invalid` does.
   */
  private syncCustomStates(): void {
    syncValidityStates(this.internals, {
      required: this.required,
      hasInteracted: this.touched,
      barred: this.barredFromValidation,
    });
    setCustomState(this.internals, 'blank', this._selected.length === 0);
    setCustomState(this.internals, 'disabled', this.effectiveDisabled);
  }

  private syncFormValue(): void {
    const state = JSON.stringify(this._selected);
    if (this.multiple) {
      // A FormData form value submits under the keys baked into the FormData
      // itself, bypassing the element's own `name` the way a plain string
      // value would use it -- so an unnamed multi-select must contribute
      // nothing (matching a nameless native `<select multiple>`) rather than
      // inventing a shared key that would merge with any other unnamed
      // combobox in the same form.
      if (!this.name) {
        this.internals.setFormValue(null, state);
        return;
      }
      const fd = new FormData();
      for (const v of this._selected) fd.append(this.name, v);
      this.internals.setFormValue(fd, state);
    } else {
      this.internals.setFormValue(this._selected[0] ?? '', state);
    }
  }

  /** Effective disabled state: this element's own `disabled` OR an ancestor
   *  `<fieldset disabled>`'s inherited state -- mirrors native `<input>`, whose
   *  own `disabled` IDL property/attribute is never mutated by a fieldset. */
  get effectiveDisabled(): boolean {
    return this.disabled || this._fieldsetDisabled;
  }

  formResetCallback(): void {
    // A reset form is pristine again, so the `user-*` states stop matching even though a required
    // combobox is immediately invalid once more. The `value` write below re-runs updateValidity()
    // (and therefore syncCustomStates()) with this flag already cleared.
    this.touched = false;
    this._restoredStateActive = false;
    this._valueDirty = false;
    const resetValues = this._defaultSelected.length > 0
      ? this._defaultSelected
      : this.options.filter((option) => wasOptionInitiallySelected(option)).map((option) => option.value);
    if (this._defaultSelected.length === 0 && resetValues.length > 0) this._defaultSelected = [...resetValues];
    const defaults = new Set(resetValues);
    for (const option of this.options) {
      option[RESET_OPTION_SELECTED_FROM_OWNER](defaults.has(option.value));
    }
    this.setValue(this.multiple ? [...resetValues] : (resetValues[0] ?? ''), false);
    this.query = '';
    this.explicitInputValue = false;
  }
  formStateRestoreCallback(
    state: string | File | FormData | null,
    reason: 'autocomplete' | 'restore',
  ): void {
    void reason;
    let selected: string[] = [];
    if (typeof state === 'string') {
      try {
        const parsed: unknown = JSON.parse(state);
        if (Array.isArray(parsed) && parsed.every((value) => typeof value === 'string')) selected = parsed;
      } catch {
        // Malformed persisted state restores an empty selection.
      }
    }
    this.value = this.multiple ? selected : (selected[0] ?? '');
    this._restoredStateActive = true;
  }
  /**
   * Called by the browser when an ancestor `<fieldset disabled>` toggles.
   * Tracked separately from the consumer's own `disabled` (see
   * `effectiveDisabled`) so a consumer's explicit `disabled` survives the
   * fieldset re-enabling instead of being permanently overwritten.
   */
  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
    if (disabled) this.hide();
    // Cascaded disablement bars constraint validation exactly like the control's own `disabled`.
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
   * Sets or clears a consumer-supplied validation error — the standard channel for a rejection no
   * client-side constraint can express ("that option is no longer available"). A non-empty
   * `message` raises `customError` and becomes `validationMessage`, so the control fails
   * `checkValidity()`, blocks submission, and matches `:state(invalid)`; `''` clears it.
   *
   * Clearing restores the control's own computed validity rather than forcing it valid: a
   * `required` combobox with nothing chosen stays `valueMissing`. The custom error also survives
   * every intrinsic recomputation in between (each selection/`required` change re-runs
   * `updateValidity()`) and a `form.reset()` — matching a native control, where only another
   * `setCustomValidity('')` clears it.
   *
   * The message is caller-supplied content, so it is used verbatim and never localized here.
   */
  setCustomValidity(message: string): void {
    this.validityController.setCustomValidity(message ?? '');
    this.syncCustomStates();
  }

  override disconnectedCallback(): void {
    this.transitionToken++;
    this.releaseSourceErrorAnnouncementSink();
    super.disconnectedCallback();
    this.cleanup?.();
    this.cleanup = undefined;
    this.clearSourceTimer();
    this.sourceToken += 1;
    // Cancel any in-flight source request so its fetch is aborted on disconnect.
    this.sourceAbort?.abort();
    this.sourceAbort = undefined;
    this.unbindDocumentPointer();
    this.resolveTransitionWaiters('lr-after-show');
    this.resolveTransitionWaiters('lr-after-hide');
    // Reset so a reconnect (e.g. a drag-drop reparent) re-triggers
    // `updated()`'s `open`-driven branch -- without this, `open` stays
    // `true` across the disconnect/reconnect and `changed.has('open')` never
    // fires again, leaving the listbox rendered open with no positioning and
    // no outside-click listener.
    this.open = false;
  }

  private collectOptions = (e: Event): void => {
    const slot = e.target as HTMLSlotElement;
    const previous = new Set(this.options);
    this.options = slot
      .assignedElements({ flatten: true })
      .filter((el): el is LyraOption => el instanceof LyraOption);
    if (!this._defaultCaptured) {
      this._defaultCaptured = true;
      // Seed the initial selection — and the reset default — from
      // declarative `<lr-option selected>` markup — mirrors native
      // `<select><option selected>`, which was previously silently ignored.
      // This is the only place `_defaultSelected` is set; picking an option
      // later (the `value` setter) never redefines the reset default, so an
      // initially-unselected combobox always resets back to empty even
      // after the user has picked something.
      const allDefaults = this.options.filter((option) => option.defaultSelected).map((option) => option.value);
      const allLive = this.options.filter((option) => option.selected).map((option) => option.value);
      const defaults = this.multiple ? allDefaults : allDefaults.slice(0, 1);
      const live = this.multiple ? allLive : allLive.slice(0, 1);
      const initialLive = this.options.filter((option) => wasOptionInitiallySelected(option)).map((option) => option.value);
      const optionDirty = this.options.some((option) => isOptionSelectedDirty(option));
      const dirtySelected = this.options.filter(
        (option) => isOptionSelectedDirty(option) && option.selected,
      );
      const dirtyValues = dirtySelected.map((option) => option.value);
      this._defaultSelected = [...(defaults.length > 0 ? defaults : (initialLive.length > 0 ? initialLive : live))];
      const fromDefaults = defaults.length > 0;
      const initial = optionDirty
        ? (this.multiple ? allLive : (dirtyValues.slice(-1)[0] ? dirtyValues.slice(-1) : live))
        : (fromDefaults ? defaults : live);
      if (initial.length && !this._restoredStateActive && !this._valueDirty) {
        // safe: initial.length is truthy, so initial[0] exists.
        const next = this.multiple ? initial : initial[0]!;
        if (fromDefaults && !optionDirty) this.setValue(next, false);
        else this.value = next;
        return; // The selection write already called reflectSelected().
      }
      if (optionDirty) this._valueDirty = true;
    } else {
      // Options slotted in after the first pass (e.g. a lazily-populated
      // list appended post-connect) still declare selection the same way a
      // native `<select><option selected>` would -- seed newly-arrived ones
      // into the live selection instead of letting reflectSelected() below
      // strip their `selected` attribute back off.
      const newDefaults = this.options.filter(
        (option) => !previous.has(option) && option.defaultSelected,
      );
      const newLive = this.options.filter(
        (option) => !previous.has(option) && option.selected && !option.defaultSelected,
      );
      this.refreshOptionDefaults();
      const eligible = [
        ...(!this._restoredStateActive && !this._valueDirty ? newDefaults : []),
        ...(!this._restoredStateActive ? newLive : []),
      ];
      if (eligible.length) {
        const values = eligible.map((option) => option.value);
        const next = this.multiple
          ? [...new Set([...this._selected, ...values])]
          // safe: eligible.length is truthy, so the last value exists.
          : values[values.length - 1]!;
        if (newLive.length > 0) this.value = next;
        else this.setValue(next, false);
        return; // `value=`'s setter already called reflectSelected()
      }
    }
    this.reflectSelected();
  };

  private refreshOptionDefaults(): void {
    const declared = this.options
      .filter((option) => option.defaultSelected)
      .map((option) => option.value);
    this._defaultSelected = this.multiple ? declared : declared.slice(0, 1);
    if (!this._valueDirty && !this._restoredStateActive) {
      this.setValue(this.multiple ? [...this._defaultSelected] : (this._defaultSelected[0] ?? ''), false);
    }
  }

  private onOptionChange = (): void => {
    // Touch the `options` array reference so Lit's change-detection sees a
    // "new" value and re-renders `renderRows()`/`filtered`/`labelFor()` off
    // the options' now-current data -- the *set* of options is unchanged,
    // only one member's own properties are, so this skips
    // collectOptions()'s selection-seeding logic entirely.
    queueMicrotask(() => {
      this.refreshOptionDefaults();
      this.reflectSelected();
      this.options = [...this.options];
    });
  };

  private reflectSelected(): void {
    const sel = new Set(this._selected);
    for (const option of this.options) {
      option[SET_OPTION_SELECTED_FROM_OWNER](sel.has(option.value));
    }
  }

  private labelFor(value: string): string {
    // Checked in order: an explicit pick's own label (works even after the
    // source rows backing it have since changed), a slotted `<lr-option>`
    // (local mode), then the last-fetched async row set (source mode) -- a
    // value set programmatically (e.g. `el.value = 'b'` before the listbox
    // has ever been opened) has no chance to have populated the first two,
    // so without this last fallback it would render as the raw value string
    // instead of its label.
    return (
      this._selectedLabelCache.get(value) ??
      this.options.find((o) => o.value === value)?.label ??
      this.asyncRows.find((r) => r.value === value)?.label ??
      value
    );
  }

  /** The current row set in a source-agnostic shape, before capping. */
  private get effectiveRows(): ComboboxSourceRow[] {
    if (this.source) return this.asyncRows;
    return this.filtered.map((o) => ({
      value: o.value,
      label: o.label,
      sub: o.sub || undefined,
      dotColor: o.dotColor || undefined,
      group: o.group || undefined,
      disabled: o.disabled,
    }));
  }

  /** Synthetic action shown only when the current nonempty query has no exact label/value match. */
  private get createRow(): ComboboxSourceRow | undefined {
    if (!this.allowCreate) return undefined;
    const inputValue = this.query.trim();
    if (!inputValue) return undefined;
    const locale = this.effectiveLocale;
    const folded = inputValue.toLocaleLowerCase(locale);
    const rows = this.source ? this.asyncRows : this.options.map((option) => ({
      value: option.value,
      label: option.label,
    }));
    if (
      rows.some(
        (row) =>
          row.value.toLocaleLowerCase(locale) === folded ||
          row.label.toLocaleLowerCase(locale) === folded,
      )
    ) {
      return undefined;
    }
    return {
      value: inputValue,
      label: this.localize('comboboxCreate', undefined, { value: inputValue }),
      createInput: inputValue,
    };
  }

  /** `effectiveRows` capped to `maxRender`, always keeping the current selection visible. */
  private get renderedRows(): { rows: ComboboxSourceRow[]; overflow: number } {
    const all = this.effectiveRows;
    const create = this.createRow;
    if (all.length <= this.maxRender) return { rows: create ? [...all, create] : all, overflow: 0 };
    const originalIndex = new Map(all.map((r, i) => [r, i]));
    const capped = all.slice(0, this.maxRender);
    const cappedValues = new Set(capped.map((r) => r.value));
    let appendedOutOfCap = false;
    for (const v of this._selected) {
      if (!cappedValues.has(v)) {
        const selectedRow = all.find((r) => r.value === v);
        if (selectedRow) {
          capped.push(selectedRow);
          appendedOutOfCap = true;
        }
      }
    }
    if (appendedOutOfCap) {
      // A preserved out-of-cap selection was just tacked onto the very end,
      // regardless of its own `group` -- stable-sort back by each row's
      // original position so it lands among its own group's other rows
      // instead of forcing renderRows() to emit that group's label a second
      // time after whatever group happens to trail the cap.
      capped.sort((a, b) => originalIndex.get(a)! - originalIndex.get(b)!);
    }
    if (create) capped.push(create);
    return { rows: capped, overflow: all.length - capped.length + (create ? 1 : 0) };
  }

  private get filtered(): LyraOption[] {
    // `toLocaleLowerCase()` (not the invariant-Unicode `toLowerCase()`) so a
    // `tr`/`az` locale's dotted/dotless I case-folds the way that locale
    // actually expects -- matches `<lr-table>`'s identical filter fold.
    const locale = this.effectiveLocale;
    const q = this.query.trim().toLocaleLowerCase(locale);
    const selectedLabel = !this.multiple ? (this.labelFor(this._selected[0] ?? '') ?? '') : '';
    const effective = q && q === selectedLabel.toLocaleLowerCase(locale) ? '' : q;
    if (!effective) return this.options;
    const fn: OptionFilter =
      this.filter ??
      ((o, query) =>
        o.label.toLocaleLowerCase(locale).includes(query) || o.searchText.toLocaleLowerCase(locale).includes(query));
    return this.options.filter((o) => fn(o, effective));
  }

  private get displayValue(): string {
    if (this.multiple || this.open || this.explicitInputValue) return this.query;
    return this._selected[0] ? this.labelFor(this._selected[0]) : '';
  }

  /**
   * Emits the cancelable `lr-show`/`lr-hide` veto point for this update's `open` transition.
   *
   * It lives here rather than in `updated()` because a veto has to be answered *before* anything
   * observable happens: `willUpdate()` still runs ahead of render and attribute reflection, so
   * restoring `open` here leaves the listbox, the reflected attribute and the property agreeing
   * with each other without a visible open-then-close flash. Keeping it on the `open` transition
   * (rather than inside `show()`/`hide()`) preserves the existing rule that the lifecycle fires
   * however `open` changed, including a direct `el.open = true` that bypasses both methods.
   */
  private announceOpenTransition(changed: PropertyValues): void {
    this.openVetoed = false;
    if (!changed.has('open') || this._isFirstUpdate) return;
    const name = this.open ? 'lr-show' : 'lr-hide';
    // Removal cannot be vetoed -- the element is already gone -- so the disconnect-driven close
    // is announced without offering a veto nobody could honour.
    if (!this.isConnected) {
      this.emit('lr-hide');
      return;
    }
    if (!this.emit(name, undefined, { cancelable: true }).defaultPrevented) return;
    this.openVetoed = true;
    this.open = !this.open;
    // `show()`/`hide()` already registered a waiter for the transition this veto just cancelled;
    // without resolving it their returned promise would never settle.
    this.resolveTransitionWaiters(this.open ? 'lr-after-hide' : 'lr-after-show');
  }

  /** Opens the listbox and resolves after `lr-after-show`. */
  show(): Promise<void> {
    if (this.open || this.effectiveDisabled) return Promise.resolve();
    this.resolveTransitionWaiters('lr-after-hide');
    const settled = this.waitForTransition('lr-after-show');
    this.open = true;
    return settled;
  }
  /** Closes the listbox and resolves after `lr-after-hide`. */
  hide(): Promise<void> {
    if (!this.open) return Promise.resolve();
    this.resolveTransitionWaiters('lr-after-show');
    const settled = this.waitForTransition('lr-after-hide');
    this.open = false;
    this.activeIndex = -1;
    // Single-select mode only shows `query` while `open` (see `displayValue`
    // above) -- but dismissing without picking a row (blur, Escape, or an
    // outside click) previously left an abandoned filter string sitting in
    // `query` forever, so the *next* reopen would reappear with stale text
    // and re-filter the list from it. Multiple mode is unaffected: its input
    // always shows `query` regardless of `open`, by design (a persistent
    // search box next to the tags).
    if (!this.multiple) {
      const queryChanged = this.query !== '';
      this.query = '';
      this.explicitInputValue = false;
      if (queryChanged && this.source) {
        this.asyncRows = [];
        this.sourceFailed = false;
      }
    }
    return settled;
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

  private reconnectOpenPopup(): void {
    if (!this.isConnected || !this.open) return;
    this.cleanup?.();
    this.bindDocumentPointer();
    const anchor = this.renderRoot.querySelector('[part="combobox"]') as HTMLElement | null;
    const listbox = this.renderRoot.querySelector('[part="listbox"]') as HTMLElement | null;
    if (anchor && listbox) {
      this.cleanup = place(anchor, listbox, { placement: `${this.placement}-start` });
    }
    if (this.source && this.asyncRows.length === 0) this.runSource(this.query);
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed); // no-op in LyraElement/ReactiveElement today, but a future mixin's
    // updated() layered under this class must still run.
    // A vetoed transition already put `open` back during willUpdate(), so `changed` still names it
    // while nothing about the state actually moved: tearing down and rebuilding the popup
    // machinery here would undo the veto it was meant to honour.
    if (changed.has('open') && !this.openVetoed) {
      this.cleanup?.();
      this.cleanup = undefined;
      // All `open`-driven side effects (positioning and the click-outside listener) live here
      // rather than in show()/hide() so they run however `open` became true -- via
      // show()/hide()'s own user-interaction paths, or a consumer/test
      // setting `el.open` directly, which bypasses both entirely. The lr-show/lr-hide veto point
      // itself runs one step earlier, in willUpdate().
      if (this.open && this.isConnected) {
        this.bindDocumentPointer();
        // Don't settle a "show" transition for markup that's simply
        // rendering open for the first time (e.g. `<lr-combobox open>`) --
        // only for an actual closed-to-open transition.
        if (!this._isFirstUpdate) {
          void this.settleTransition('lr-after-show');
        }
        const anchor = this.renderRoot.querySelector('[part="combobox"]') as HTMLElement | null;
        const listbox = this.renderRoot.querySelector('[part="listbox"]') as HTMLElement | null;
        if (anchor && listbox) {
          this.cleanup = place(anchor, listbox, { placement: `${this.placement}-start` });
        }
        if (this.source && this.asyncRows.length === 0) this.runSource(this.query);
      } else if (!this.open) {
        this.unbindDocumentPointer();
        if (!this._isFirstUpdate) {
          void this.settleTransition('lr-after-hide');
        }
      } else {
        this.unbindDocumentPointer();
      }
    }
    if (changed.has('name')) this.syncFormValue();
    if (changed.has('touched') || changed.has('required') || changed.has('value')) {
      this.toggleAttribute('data-invalid', this.touched && !this.internals.validity.valid);
    }
    // The listbox is a fixed-height, scrollable box (see combobox.styles.ts's
    // `max-block-size`/`overflow-y`) -- without this, arrowing/Home/End past
    // its visible rows moves `activeIndex` and `aria-activedescendant`
    // correctly but leaves the highlighted row scrolled out of view for a
    // sighted keyboard user. `block: 'nearest'` is a no-op whenever the
    // active row is already fully visible. Mirrors lr-mention-popover's
    // identical fix for the same shape of listbox.
    if (changed.has('activeIndex')) {
      this.renderRoot.querySelector<HTMLElement>('[part="option"][data-active]')?.scrollIntoView({ block: 'nearest' });
    }
  }

  private async settleTransition(event: 'lr-after-show' | 'lr-after-hide'): Promise<void> {
    const token = ++this.transitionToken;
    await this.updateComplete;
    if (this.transitionToken !== token) return;
    if (this.isConnected) {
      const view = this.ownerDocument.defaultView;
      if (view) await new Promise<void>((resolve) => view.requestAnimationFrame(() => resolve()));
      if (this.transitionToken !== token) return;
      const listbox = this.renderRoot.querySelector('[part="listbox"]');
      const animations = listbox?.getAnimations({ subtree: true }) ?? [];
      await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
      if (this.transitionToken !== token) return;
    }
    this.emit(event);
    this.resolveTransitionWaiters(event);
  }

  private waitForTransition(event: 'lr-after-show' | 'lr-after-hide'): Promise<void> {
    return new Promise<void>((resolve) => {
      const waiters = this.transitionWaiters.get(event) ?? new Set<() => void>();
      waiters.add(resolve);
      this.transitionWaiters.set(event, waiters);
    });
  }

  private resolveTransitionWaiters(event: 'lr-after-show' | 'lr-after-hide'): void {
    const waiters = this.transitionWaiters.get(event);
    if (!waiters) return;
    this.transitionWaiters.delete(event);
    for (const resolve of waiters) resolve();
  }

  /** Dispatches the platform-style value events used by non-text user
   * interactions: `input`, `change`, and the prefixed `lr-change` alias, each
   * carrying `detail: { value }` (the new committed selection). Text editing
   * keeps and exposes the original InputEvent from the shadow input so its
   * data/inputType metadata is not lost. `this.emit()` (from `LyraElement`)
   * already dispatches a bubbling, composed, non-cancelable `CustomEvent`. */
  private emitValueEvents(): void {
    this.emit('input', { value: this.value });
    this.emit('change', { value: this.value });
    this.emit('lr-change', { value: this.value });
  }

  /** Runs the cancelable option-creation contract, then performs its default append/select behavior. */
  private createOption(inputValue: string): void {
    if (this.effectiveDisabled) return;
    const event = this.emit('lr-create', { inputValue }, { cancelable: true });
    if (event.defaultPrevented) return;
    const option = this.ownerDocument.createElement(tag('option')) as LyraOption;
    option.setAttribute('value', inputValue);
    option.textContent = inputValue;
    this.append(option);
    this.pickRow({ value: inputValue, label: inputValue });
  }

  /** Commits arbitrary text in the single-select custom-value mode without adding an option. */
  private commitCustomValue(inputValue: string): void {
    if (this.effectiveDisabled || this.multiple || !inputValue) return;
    const selectionChanged = this._selected[0] !== inputValue;
    this._selectedLabelCache.set(inputValue, inputValue);
    this.value = inputValue;
    this.query = '';
    this.explicitInputValue = false;
    void this.hide();
    if (selectionChanged) this.emitValueEvents();
  }

  private pickRow(row: ComboboxSourceRow): void {
    if (this.effectiveDisabled || row.disabled) return;
    if (row.createInput !== undefined) {
      this.createOption(row.createInput);
      return;
    }
    const selectionChanged = this.multiple || this._selected[0] !== row.value;
    if (this.multiple) {
      const set = new Set(this._selected);
      if (set.has(row.value)) {
        set.delete(row.value);
        this._selectedRowCache.delete(row.value);
      } else {
        set.add(row.value);
        this._selectedLabelCache.set(row.value, row.label);
        this._selectedRowCache.set(row.value, row);
      }
      this.value = [...set];
      this.query = '';
      this.explicitInputValue = false;
    } else {
      this._selectedLabelCache.set(row.value, row.label);
      this._selectedRowCache.clear();
      this._selectedRowCache.set(row.value, row);
      this.value = row.value;
      this.query = '';
      this.explicitInputValue = false;
      this.hide();
    }
    // The query resets to '' above but `asyncRows` doesn't refresh on its
    // own -- re-run `source` so the listbox (still open in multiple mode,
    // and whatever `asyncRows` holds for the next time it reopens in single
    // mode) matches the now-empty input instead of the stale prior query.
    if (this.source) this.runSource(this.query);
    if (selectionChanged) this.emitValueEvents();
  }

  private removeValue(value: string): void {
    const next = this._selected.filter((v) => v !== value);
    if (next.length === this._selected.length) return;
    this.value = next;
    this.emitValueEvents();
  }

  /**
   * The clear button clears both axes the control owns — the committed selection and the
   * in-progress filter text — but each announces only its own change. A query-only clear must stay
   * silent on `input`/`change`/`lr-clear` (there is no selection transition to report; that early
   * return is why the button used to be gated on the selection alone), while a selection-only clear
   * must stay silent on `lr-filter` (the filter text never moved).
   */
  private clear(): void {
    const hadSelection = this._selected.length > 0;
    const queryChanged = this.query !== '';
    if (!hadSelection && !queryChanged) return;
    if (hadSelection) this.value = [];
    this.query = '';
    this.explicitInputValue = false;
    if (this.source) this.runSource(this.query);
    if (hadSelection) {
      this.emitValueEvents();
      this.emit('lr-clear');
    }
    if (queryChanged) this.emit('lr-filter', { value: this.query });
  }

  private onInput = (e: Event): void => {
    this.explicitInputValue = false;
    this.query = (e.target as HTMLInputElement).value;
    this.activeIndex = -1;
    this.show();
    if (this.source) this.runSource(this.query);
    // One of the two user-driven `query` writers that announce the new filter text (the other is
    // the clear button, via `clear()`) -- see the `query` declaration above.
    this.emit('lr-filter', { value: this.query });
  };

  private runSource(query: string): void {
    const source = this.source;
    if (!source) return;
    this.clearSourceTimer();
    // Abort any in-flight request from a prior query so its fetch can be cancelled.
    this.sourceAbort?.abort();
    this.sourceAbort = undefined;
    const token = ++this.sourceToken;
    const ownerWindow = this.ownerDocument.defaultView;
    if (!this.isConnected || !ownerWindow) return;
    const timer = { owner: ownerWindow, handle: 0, token };
    timer.handle = ownerWindow.setTimeout(() => {
      if (
        this.sourceTimer !== timer ||
        token !== this.sourceToken ||
        !this.isConnected ||
        this.ownerDocument.defaultView !== ownerWindow
      ) {
        return;
      }
      this.sourceTimer = undefined;
      const controller = new ownerWindow.AbortController();
      this.sourceAbort = controller;
      this.loading = true;
      this.sourceFailed = false;
      // `Promise.resolve().then(() => this.source!(query, ...))` moves the call
      // itself inside a `.then()` callback, so a *synchronous* throw from
      // `this.source(query)` becomes a normal promise rejection the
      // following `.catch()` handles, instead of escaping this `setTimeout`
      // callback as an uncaught exception.
      Promise.resolve()
        .then(() => source(query, { signal: controller.signal }))
        .then((rows) => {
          if (
            token !== this.sourceToken ||
            !this.isConnected ||
            this.ownerDocument.defaultView !== ownerWindow
          ) {
            return;
          }
          this.asyncRows = rows;
          this.sourceFailed = false;
          const navigableCount = rows.filter((row) => !row.disabled).length;
          if (this.activeIndex >= navigableCount) {
            this.activeIndex = navigableCount ? navigableCount - 1 : -1;
          }
          const selected = new Set(this._selected);
          for (const row of rows) {
            if (selected.has(row.value)) this._selectedRowCache.set(row.value, row);
          }
        })
        .catch((err) => {
          if (
            token !== this.sourceToken ||
            !this.isConnected ||
            this.ownerDocument.defaultView !== ownerWindow
          ) {
            return;
          }
          // A caller that forwarded the signal to fetch() surfaces cancellation as an AbortError;
          // that is expected teardown, not a source failure, so don't warn about it.
          if (
            typeof err === 'object' &&
            err !== null &&
            'name' in err &&
            err.name === 'AbortError'
          ) {
            return;
          }
          this.asyncRows = [];
          this.activeIndex = -1;
          this.sourceFailed = true;
          this.sourceErrorAnnouncementSink?.announce(this.localize('comboboxLoadError'));
          console.warn('<lr-combobox> source() rejected:', err);
        })
        .finally(() => {
          if (token === this.sourceToken) this.loading = false;
        });
    }, this._sourceDelay);
    this.sourceTimer = timer;
  }

  private clearSourceTimer(): void {
    const timer = this.sourceTimer;
    this.sourceTimer = undefined;
    if (timer) timer.owner.clearTimeout(timer.handle);
  }

  private onInputBlur = (): void => {
    this.touched = true;
    // Synchronously, not from `updated()`: `:state(user-invalid)` has to be true the moment focus
    // leaves, the same instant native `:user-invalid` starts matching.
    this.syncCustomStates();
    // A mouse click outside the element is already handled by
    // onDocPointer/hide(), but that leaves keyboard users with no way to
    // dismiss the listbox short of Escape -- tabbing focus away from the
    // input should close it too, the same as it would for a native
    // `<select>`'s popup.
    this.hide();
    this.emit('blur');
  };

  private onInputFocus = (): void => {
    this.show();
    this.emit('focus');
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const navigable = this.renderedRows.rows.filter((r) => !r.disabled);
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!this.open) {
          void this.show();
          return;
        }
        this.activeIndex = Math.min(navigable.length - 1, this.activeIndex + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!this.open) {
          void this.show();
          return;
        }
        this.activeIndex = Math.max(0, this.activeIndex - 1);
        break;
      case 'Enter': {
        const activeRow = navigable[this.activeIndex];
        if (this.open && this.activeIndex >= 0 && activeRow) {
          e.preventDefault();
          this.pickRow(activeRow);
          break;
        }
        const create = this.createRow;
        if (this.open && create) {
          e.preventDefault();
          this.createOption(create.createInput!);
          break;
        }
        if (this.open && this.allowCustomValue && !this.multiple && this.query.trim()) {
          e.preventDefault();
          this.commitCustomValue(this.query.trim());
          break;
        }
        // Nothing highlighted to commit, so the keystroke means what it means in any other text
        // field: implicit submission of the ancestor form. The internal input lives in a shadow
        // root and has no form owner, so the platform can never do it here.
        if (this.effectiveDisabled) break;
        submitOnEnter(this, e);
        break;
      }
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
          this.activeIndex = navigable.length - 1;
        }
        break;
      case 'Backspace':
        if (this.multiple && !this.query && this._selected.length) {
          // safe: _selected.length is truthy, so the last element exists.
          this.removeValue(this._selected[this._selected.length - 1]!);
        }
        break;
    }
  };

  private onComboMouseDown = (e: MouseEvent): void => {
    if (this.effectiveDisabled) return;
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    (this.renderRoot.querySelector('[part="combobox-input"]') as HTMLInputElement | null)?.focus();
    this.show();
  };

  // Delegated onto [part="listbox"] (see render()) rather than one closure
  // pair allocated per option per render -- the click handler resolves the
  // target row via closest('[part="option"]') + a data-value lookup into
  // `_rowsByValue`.
  //
  // mousedown must be cancelled for ANY press inside the listbox, not just on
  // option rows: the browser's default action moves focus to the pressed
  // element, so a drag on the listbox scrollbar, a press on a group label, or
  // the overflow row would blur the input, whose blur handler hides the
  // dropdown mid-interaction. Cancelling mousedown does not suppress the
  // subsequent click, so option selection still lands in onListboxClick.
  private onListboxMouseDown = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private onListboxClick = (e: MouseEvent): void => {
    const optionEl = (e.target as HTMLElement).closest('[part="option"]') as HTMLElement | null;
    const value = optionEl?.dataset['value'];
    if (value === undefined) return;
    const row = this._rowsByValue.get(value);
    if (row) this.pickRow(row);
  };

  private renderRows(rows: ComboboxSourceRow[], activeId: string): TemplateResult[] {
    const out: TemplateResult[] = [];
    let currentGroup: string | undefined;
    let currentGroupRows: TemplateResult[] = [];
    let groupIndex = 0;
    const selectedSet = new Set(this._selected);
    const flushGroup = (): void => {
      if (!currentGroupRows.length) return;
      if (currentGroup) {
        const labelId = `${this.listId}-group-${groupIndex++}`;
        out.push(html`<div role="group" aria-labelledby=${labelId}>
          <div id=${labelId} class="group-label">${currentGroup}</div>
          ${currentGroupRows}
        </div>`);
      } else {
        out.push(...currentGroupRows);
      }
      currentGroupRows = [];
    };
    rows.forEach((o, i) => {
      if (o.group !== currentGroup) {
        flushGroup();
        currentGroup = o.group;
      }
      const id = `${this.listId}-opt-${i}`;
      const selected = selectedSet.has(o.value);
      currentGroupRows.push(
        html`<div
          part="option"
          id=${id}
          role="option"
          data-value=${o.value}
          ?data-create=${o.createInput !== undefined}
          aria-selected=${selected ? 'true' : 'false'}
          aria-disabled=${o.disabled ? 'true' : 'false'}
          aria-label=${o.accessibleLabel || nothing}
          ?data-active=${id === activeId}
        >
          ${o.icon ? html`<span part="option-icon" aria-hidden="true">${o.icon}</span>` : ''}
          ${o.dotColor
            ? html`<span
                part="option-dot"
                style=${styleMap({ background: sanitizeCssColor(o.dotColor) ?? 'transparent' })}
              ></span>`
            : ''}
          <span part="option-label">
            <span>${o.label}</span>
            ${o.sub ? html`<span part="option-sub">${o.sub}</span>` : ''}
          </span>
          ${o.badge != null ? html`<span part="option-badge">${o.badge}</span>` : ''}
        </div>`,
      );
    });
    flushGroup();
    return out;
  }

  /** One built-in selected chip, or the consumer's safe Lit/DOM/text replacement. */
  private renderTag(value: string, index: number): unknown {
    const option = this.options.find((candidate) => candidate.value === value);
    if (this.getTag && option) return this.getTag(option, index);
    const label = this.labelFor(value);
    return html`<span part="tag">
      <span part="tag-label"><span part="tag__content">${label}</span></span>
      <button
        part="tag__remove-button"
        type="button"
        ?disabled=${this.effectiveDisabled}
        aria-label=${this.localize('removeWithContext', undefined, { label })}
        @click=${(event: Event) => {
          event.stopPropagation();
          this.removeValue(value);
        }}
      ><span part="tag__remove-button__base">${closeIcon()}</span></button>
    </span>`;
  }

  override render(): TemplateResult {
    const { rows, overflow } = this.renderedRows;
    this._rowsByValue = new Map(rows.map((r) => [r.value, r]));
    const navigable = rows.filter((r) => !r.disabled);
    const active = this.activeIndex >= 0 ? navigable[this.activeIndex] : undefined;
    const activeId = active ? `${this.listId}-opt-${rows.indexOf(active)}` : '';

    const shownTags = this.multiple ? this._selected.slice(0, this.maxOptionsVisible) : [];
    const extra = this.multiple ? this._selected.length - shownTags.length : 0;
    const hasValue = this._selected.length > 0;
    // The clear button covers both axes, so it also has to render for a filter-only state.
    // `displayValue` only surfaces `query` while the listbox is open (single-select) or in
    // `multiple` mode -- outside those, a closed single-select shows the *selected label*, so a
    // button gated on the bare `query !== ''` would offer to clear text the user cannot see.
    const hasVisibleQuery = this.query !== '' && (this.open || this.multiple);
    const hasHint = this.withHint || this.slotPresence.has('hint') || this.hint.length > 0;
    const hasError = this.slotPresence.has('error') || this.errorText.length > 0;
    const hasLabel = this.withLabel || this.slotPresence.has('label') || this.label.length > 0;
    const describedBy = [hasError ? 'combobox-error' : '', hasHint ? 'combobox-hint' : ''].filter(Boolean).join(' ');

    return html`
      <div part="form-control">
        <label part="form-control-label" for=${this.inputId} ?hidden=${!hasLabel}>
          <span part="label">${this.label}<slot name="label"></slot></span>
        </label>
        <div part="combobox" @mousedown=${this.onComboMouseDown}>
          <span part="form-control-input" class="control-contents">
          <span part="start" ?hidden=${!this.slotPresence.has('start')}>
            <slot name="start"></slot>
          </span>
          <div part="tags">
            ${shownTags.map((value, index) => this.renderTag(value, index))}
            ${extra > 0
              ? html`<span part="tag">${this.localize('comboboxSelectedOverflow', undefined, {
                  n: getNumberFormat(this.effectiveLocale).format(extra),
                })}</span>`
              : ''}
          </div>
          <input
            id=${this.inputId}
            part="combobox-input"
            role="combobox"
            aria-label=${this.getAttribute('aria-label') ||
            (hasLabel ? nothing : this.placeholder || this.localize('comboboxLabel'))}
            aria-describedby=${describedBy || nothing}
            aria-expanded=${this.open ? 'true' : 'false'}
            aria-controls=${this.listId}
            aria-activedescendant=${activeId || nothing}
            aria-autocomplete="list"
            aria-required=${this.required ? 'true' : 'false'}
            aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'}
            autocomplete=${this.autocomplete || nothing}
            inputmode=${this.inputMode || nothing}
            enterkeyhint=${this.enterKeyHint || nothing}
            spellcheck=${this.spellcheck}
            autocapitalize=${this.autocapitalize || nothing}
            autocorrect=${this.hasAttribute('autocorrect') || !this.autocorrect
              ? (this.autocorrect ? 'on' : 'off')
              : nothing}
            .value=${this.displayValue}
            placeholder=${hasValue && !this.multiple ? '' : this.placeholder}
            ?disabled=${this.effectiveDisabled}
            @input=${this.onInput}
            @keydown=${this.onKeyDown}
            @focus=${this.onInputFocus}
            @blur=${this.onInputBlur}
          />
          ${(this.clearable || this.withClear) && (hasValue || hasVisibleQuery)
            ? html`<button
                part="clear-button"
                type="button"
                ?disabled=${this.effectiveDisabled}
                aria-label=${this.localize('clear')}
                @click=${(e: Event) => {
                  e.stopPropagation();
                  this.clear();
                }}
              >
                <slot name="clear-icon">${closeIcon()}</slot>
              </button>`
            : ''}
          <span part="end" ?hidden=${!this.slotPresence.has('end')}>
            <slot name="end"></slot>
          </span>
          <span part="expand-icon" aria-hidden="true"><slot name="expand-icon">${chevronIcon()}</slot></span>
          </span>
        </div>
        <div
          part="listbox"
          id=${this.listId}
          role="listbox"
          aria-multiselectable=${this.multiple ? 'true' : 'false'}
          @mousedown=${this.onListboxMouseDown}
          @click=${this.onListboxClick}
        >
          ${this.loading
            ? html`<div class="loading" role="option" aria-selected="false" aria-disabled="true">${this.localize('loading', this.loadingText || undefined)}</div>`
            : this.sourceFailed
              ? html`<div class="source-error" role="option" aria-selected="false" aria-disabled="true">${this.localize('comboboxLoadError')}</div>`
            : rows.length === 0
              ? html`<div class="empty" role="option" aria-selected="false" aria-disabled="true">${this.localize('noMatches', this.emptyText || undefined)}</div>`
              : html`${this.renderRows(rows, activeId)}
                  ${overflow > 0
                    ? html`<div part="option-overflow">${this.localize('comboboxOverflow', this.overflowText || undefined, {
                        n: getNumberFormat(this.effectiveLocale).format(overflow),
                      })}</div>`
                    : ''}`}
        </div>
        <div id="combobox-error" part="error" ?hidden=${!hasError}>
          ${this.errorText}<slot name="error"></slot>
        </div>
        <div id="combobox-hint" part="hint" ?hidden=${!hasHint}>
          ${this.hint}<slot name="hint"></slot>
        </div>
      </div>
      <slot @slotchange=${this.collectOptions} @lr-option-change=${this.onOptionChange} hidden></slot>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-combobox': LyraCombobox;
  }
}
