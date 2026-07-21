import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { place } from '../../../internal/positioner.js';
import { nextId } from '../../../internal/a11y.js';
import { chevronIcon, closeIcon } from '../../../internal/icons.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { finiteCount } from '../../../internal/numbers.js';
import { styles } from './combobox.styles.js';
import { LyraOption } from './option.class.js';
import './option.class.js';

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
export type LyraComboboxSize = '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl';

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
}

export type ComboboxSource = (query: string) => Promise<ComboboxSourceRow[]>;
export type LyraComboboxSelectionDirection = 'forward' | 'backward' | 'none';

const spellcheckConverter = {
  fromAttribute: (value: string | null): boolean => value !== 'false',
  toAttribute: (value: boolean): string => (value ? 'true' : 'false'),
};

/** Detail of `lr-filter`: the in-progress filter text, never the committed selection. */
export interface ComboboxFilterDetail {
  value: string;
}

export interface LyraComboboxEventMap {
  'lr-show': CustomEvent<undefined>;
  'lr-hide': CustomEvent<undefined>;
  'lr-clear': CustomEvent<undefined>;
  'lr-filter': CustomEvent<ComboboxFilterDetail>;
  blur: CustomEvent<undefined>;
  focus: CustomEvent<undefined>;
}
/**
 * `<lr-combobox>` — a filterable single/multi select that combines a text
 * input with a listbox. Mirrors the core `<wa-combobox>` API under `lr-`.
 *
 * Options are `<lr-option value>` children. Emits native-style `change`/`input`
 * (like Web Awesome) plus `lr-show`/`lr-hide`/`lr-clear`.
 * Standard size tiers share their outer control height with sibling Lyra controls; the decorative
 * expand icon scales inside that allocation without creating an independent action target.
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
 * @event {Event} change - The selection changed through user interaction. A bubbling,
 * composed, non-cancelable Event.
 * @event {InputEvent | Event} input - The user typed in the filter or changed the selection. Text
 * edits expose the original InputEvent; selection changes emit a bubbling,
 * composed, non-cancelable Event.
 * @event lr-show - The listbox opened.
 * @event lr-hide - The listbox closed.
 * @event lr-clear - The value was cleared.
 * @event {CustomEvent<ComboboxFilterDetail>} lr-filter - The in-progress filter text changed
 * through user input. `detail.value` is the live filter string, which is not the same thing as the
 * host's `value` (the committed selection). User-input only: typing and the clear button announce
 * it, while the programmatic paths that blank the filter — picking a row, `form.reset()`,
 * dismissing the listbox, a `value` write, `setRangeText()` — are all silent, mirroring
 * `<lr-input>`'s `lr-input`.
 * @event blur - Re-dispatched from the internal native input as a bubbling, composed event.
 * @event focus - Re-dispatched from the internal native input as a bubbling, composed event.
 * @csspart form-control - The outer wrapper around label, combobox, listbox, error and hint.
 * @csspart form-control-label - The `<label>` element.
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
 * @csspart tag__remove-button - A tag's remove button.
 * @csspart clear-button - The clear button.
 * @csspart expand-icon - The dropdown indicator.
 * @csspart error - The error message.
 * @csspart hint - The hint message.
 * @cssprop --lr-combobox-trigger-padding - Padding inside the input container.
 * @cssprop --lr-combobox-trigger-min-height - Minimum input-container block size, scaled by `size`.
 * @cssprop --lr-combobox-trigger-height - Exact input-container height. Unset by default, which
 *   leaves `--lr-combobox-trigger-min-height` as a floor only; set it to a length to both floor and
 *   cap the row (e.g. to pixel-match `<lr-input>`/`<lr-select>` in the same toolbar). Because it is
 *   never declared by the component itself, it can be set from an ancestor or an outer-tree rule as
 *   well as inline on the element. Intended for a single-row combobox: in `multiple` mode a tag row
 *   long enough to wrap overflows the pinned box visibly (nothing is clipped or made unreachable),
 *   so leave it unset there.
 * @cssprop --lr-combobox-font-size - Input text size.
 * @cssprop --lr-combobox-tag-padding - Selected-tag padding.
 * @cssprop --lr-combobox-tag-font-size - Selected-tag text size.
 * @cssprop --lr-combobox-expand-size - Decorative expand-icon box size, scaled by `size`.
 * @cssprop [--lr-combobox-gap=var(--lr-space-xs)] - Gap between the start/end adornments, tags,
 *   and filter input inside the trigger row. Unlike the size knobs above it does not vary by
 *   `size` tier. Override it to retune without a `::part(combobox)` rule.
 * @cssprop [--lr-combobox-radius=var(--lr-radius)] - Corner radius of the trigger row
 *   (`[part='combobox']`). Does not vary by `size` tier.
 * @cssprop [--lr-combobox-option-active-bg=var(--lr-color-brand-quiet)] - Background of a hovered
 *   or keyboard-active option row.
 */
export class LyraCombobox extends LyraElement<LyraComboboxEventMap> {
  static formAssociated = true;
  static override styles = [LyraElement.styles, styles];

  static override properties = {
    multiple: { type: Boolean, reflect: true, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    required: { type: Boolean, reflect: true, noAccessor: true },
    value: { noAccessor: true },
    name: { reflect: true, noAccessor: true },
    maxOptionsVisible: { type: Number, attribute: 'max-options-visible', noAccessor: true },
    maxRender: { type: Number, attribute: 'max-render', noAccessor: true },
  };

  @property() placeholder = '';
  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  @property({ type: Boolean, reflect: true }) open = false;
  /** Visual size — same `2xs`–`xl` scale as `lr-select`'s `size`. */
  @property({ reflect: true }) size: LyraComboboxSize = 'm';
  /** Show a clear button while the combobox has something to clear on either axis: a committed
   *  selection, or visible filter text (the open listbox in single-select, any time in `multiple`
   *  mode — a closed single-select shows the selected label, not the query, so a stale query alone
   *  never surfaces the button). Clearing a selection emits `input`/`change`/`lr-clear`; clearing
   *  filter text emits `lr-filter` with an empty `value`; each fires only for the axis that
   *  actually changed. Mirrors `wa-combobox`'s public name. */
  @property({ type: Boolean, reflect: true }) clearable = false;
  /** @deprecated Use `clearable`. Retained as a compatibility alias. */
  @property({ type: Boolean, attribute: 'with-clear' }) withClear = false;
  /** Native editing-assistance attributes forwarded to the wrapped input. */
  @property() autocomplete = 'off';
  @property({ attribute: 'inputmode' }) override inputMode = '';
  @property({ attribute: 'enterkeyhint' }) override enterKeyHint = '';
  @property({ converter: spellcheckConverter }) override spellcheck = true;
  @property() override autocapitalize = '';
  @property({ attribute: 'autocorrect' }) autoCorrect = '';
  /** Status copy shown in the listbox when no rows match. Empty string falls back to a localized message. */
  @property({ attribute: 'empty-text' }) emptyText = '';
  /** Status copy shown in the listbox while a `source` fetch is in flight. Empty string falls back to a localized message. */
  @property({ attribute: 'loading-text' }) loadingText = '';
  /** Status copy shown when `maxRender` caps the row list; `{n}` is replaced with the hidden count. Empty string falls back to a localized message. */
  @property({ attribute: 'overflow-text' }) overflowText = '';
  @property({ attribute: false }) filter: OptionFilter | null = null;
  @property({ attribute: false }) source: ComboboxSource | null = null;

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
  @state() private activeIndex = -1;
  @state() private options: LyraOption[] = [];
  // Set on the combobox input's first `blur`; gates the `data-invalid`
  // reflection below so validity styling never flashes on first render.
  @state() private touched = false;
  // `[part]:empty` never matches — the part always contains a literal
  // `<slot>` child element regardless of assigned content — so real
  // emptiness is tracked in JS instead (same fix as lr-stat's
  // icon/caption) and reflected via `hidden`. Applies to
  // `form-control-label` too: the required-asterisk `::after` attaches to
  // that box, so leaving it always-visible orphans a stray ' *' when no
  // `label` is set.
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;
  @state() private hasLabelSlot = false;
  @state() private hasStartSlot = false;
  @state() private hasEndSlot = false;
  @state() private loading = false;
  @state() private asyncRows: ComboboxSourceRow[] = [];
  @query('[part="combobox-input"]') private inputEl?: HTMLInputElement;
  private sourceTimer?: ReturnType<typeof setTimeout>;
  private sourceToken = 0;
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
  // Tracked separately from the consumer's own `disabled` -- a native
  // `<input>`'s own `disabled` IDL property/attribute is never mutated by
  // fieldset cascading, so a consumer's explicit `disabled` must survive the
  // fieldset re-enabling (see `formDisabledCallback` below).
  private _fieldsetDisabled = false;
  private listId = nextId('combobox-list');
  private inputId = nextId('combobox-input');
  private cleanup?: () => void;
  private _isFirstUpdate = true;
  private _selected: string[] = [];
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
  // `noAccessor` hand-rolled accessors (mirrors `name`/`multiple`/etc. above): these feed
  // virtualization/render-limiting logic (`shownTags.slice`, `renderedRows`'s cap) directly, so a
  // NaN/negative value must never reach it -- sanitized synchronously here via `finiteCount`
  // rather than left for Lit's default async field setter to hand through unchecked.
  private _maxOptionsVisible = 3;
  private _maxRender = 200;

  constructor() {
    super();
    this.internals = createInternalsSafely(this);
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
  }

  get form(): HTMLFormElement | null {
    return this.internals.form;
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
    this.query = input.value;
    this.activeIndex = -1;
    if (this.source) this.runSource(this.query);
  }

  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | null {
    return this.renderRoot?.querySelector('[part="combobox-input"]') ?? null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.updateValidity();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // no-op in LyraElement/ReactiveElement today, but a future mixin's
    // willUpdate() layered under this class must still run.
    // `hasUpdated` flips to `true` before `updated()` even sees its first
    // call, so it can't distinguish "just mounted" from "just changed" there
    // -- capture that distinction here, while it's still reliable, for
    // `updated()`'s `open`-handling below to consult.
    this._isFirstUpdate = !this.hasUpdated;
    if (!this.hasUpdated) {
      this.hasHintSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'hint');
      this.hasErrorSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'error');
      this.hasLabelSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'label');
      this.hasStartSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'start');
      this.hasEndSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'end');
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
    this.syncFormValue();
    this.requestUpdate('name', old);
  }

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

  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    this.toggleAttribute('disabled', this._disabled);
    if (this._disabled) this.hide();
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

  /** The selected value(s): a string in single mode, a string[] in `multiple` mode. */
  get value(): string | string[] {
    return this.multiple ? [...this._selected] : (this._selected[0] ?? '');
  }
  set value(next: string | string[]) {
    const old = this._selected;
    this._restoredStateActive = false;
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
   *  (multi-select only). Sanitized to a finite, non-negative integer. */
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
   *  non-negative integer. */
  get maxRender(): number {
    return this._maxRender;
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

  private updateValidity(): void {
    if (this.required && this._selected.length === 0) {
      this.validityController.setValidity({ valueMissing: true }, this.localize('comboboxRequired'));
    } else {
      this.validityController.setValidity({});
    }
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
    this.touched = false;
    this.value = [...this._defaultSelected];
    this.query = '';
  }
  formStateRestoreCallback(
    state: string | File | FormData | null,
    _mode?: 'restore' | 'autocomplete',
  ): void {
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
    this.requestUpdate();
  }
  checkValidity(): boolean {
    return this.internals.checkValidity();
  }
  reportValidity(): boolean {
    return this.internals.reportValidity();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanup?.();
    this.cleanup = undefined;
    clearTimeout(this.sourceTimer);
    this.ownerDocument.removeEventListener('pointerdown', this.onDocPointer);
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
      const declared = this.options.filter((o) => o.selected).map((o) => o.value);
      this._defaultSelected = [...declared];
      if (declared.length && !this._restoredStateActive) {
        this.value = this.multiple ? declared : declared[0];
        return; // `value=`'s setter already called reflectSelected()
      }
    } else {
      // Options slotted in after the first pass (e.g. a lazily-populated
      // list appended post-connect) still declare selection the same way a
      // native `<select><option selected>` would -- seed newly-arrived ones
      // into the live selection instead of letting reflectSelected() below
      // strip their `selected` attribute back off.
      const newlySelected = this.options.filter((o) => !previous.has(o) && o.selected).map((o) => o.value);
      if (newlySelected.length && !this._restoredStateActive) {
        this.value = this.multiple
          ? [...new Set([...this._selected, ...newlySelected])]
          : newlySelected[newlySelected.length - 1];
        return; // `value=`'s setter already called reflectSelected()
      }
    }
    this.reflectSelected();
  };

  private onOptionChange = (): void => {
    // Touch the `options` array reference so Lit's change-detection sees a
    // "new" value and re-renders `renderRows()`/`filtered`/`labelFor()` off
    // the options' now-current data -- the *set* of options is unchanged,
    // only one member's own properties are, so this skips
    // collectOptions()'s selection-seeding logic entirely.
    this.options = [...this.options];
  };

  private reflectSelected(): void {
    const sel = new Set(this._selected);
    for (const o of this.options) o.selected = sel.has(o.value);
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

  /** `effectiveRows` capped to `maxRender`, always keeping the current selection visible. */
  private get renderedRows(): { rows: ComboboxSourceRow[]; overflow: number } {
    const all = this.effectiveRows;
    if (all.length <= this.maxRender) return { rows: all, overflow: 0 };
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
    return { rows: capped, overflow: all.length - capped.length };
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
    if (this.multiple || this.open) return this.query;
    return this._selected[0] ? this.labelFor(this._selected[0]) : '';
  }

  private show(): void {
    if (this.open || this.effectiveDisabled) return;
    this.open = true;
  }
  private hide(): void {
    if (!this.open) return;
    this.open = false;
    this.activeIndex = -1;
    // Single-select mode only shows `query` while `open` (see `displayValue`
    // above) -- but dismissing without picking a row (blur, Escape, or an
    // outside click) previously left an abandoned filter string sitting in
    // `query` forever, so the *next* reopen would reappear with stale text
    // and re-filter the list from it. Multiple mode is unaffected: its input
    // always shows `query` regardless of `open`, by design (a persistent
    // search box next to the tags).
    if (!this.multiple) this.query = '';
  }
  private onDocPointer = (e: PointerEvent): void => {
    if (!e.composedPath().includes(this)) this.hide();
  };

  protected override updated(changed: PropertyValues): void {
    super.updated(changed); // no-op in LyraElement/ReactiveElement today, but a future mixin's
    // updated() layered under this class must still run.
    if (changed.has('open')) {
      this.cleanup?.();
      this.cleanup = undefined;
      // All `open`-driven side effects (positioning, the click-outside
      // listener, and the lr-show/lr-hide events) live here rather than
      // in show()/hide() so they fire however `open` became true -- via
      // show()/hide()'s own user-interaction paths, or a consumer/test
      // setting `el.open` directly, which bypasses both entirely.
      if (this.open) {
        this.ownerDocument.addEventListener('pointerdown', this.onDocPointer);
        // Don't announce a "show" transition for markup that's simply
        // rendering open for the first time (e.g. `<lr-combobox open>`) --
        // only for an actual closed-to-open transition.
        if (!this._isFirstUpdate) this.emit('lr-show');
        const anchor = this.renderRoot.querySelector('[part="combobox"]') as HTMLElement | null;
        const listbox = this.renderRoot.querySelector('[part="listbox"]') as HTMLElement | null;
        if (anchor && listbox) this.cleanup = place(anchor, listbox);
        if (this.source && this.asyncRows.length === 0) this.runSource(this.query);
      } else {
        this.ownerDocument.removeEventListener('pointerdown', this.onDocPointer);
        if (!this._isFirstUpdate) this.emit('lr-hide');
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

  /** Dispatches the platform-style value-event pair used by non-text user
   * interactions. Text editing keeps and exposes the original InputEvent
   * from the shadow input so its data/inputType metadata is not lost. */
  private emitValueEvents(): void {
    const EventConstructor = this.ownerDocument.defaultView?.Event ?? Event;
    const init: EventInit = { bubbles: true, composed: true };
    this.dispatchEvent(new EventConstructor('input', init));
    this.dispatchEvent(new EventConstructor('change', init));
  }

  private pickRow(row: ComboboxSourceRow): void {
    if (this.effectiveDisabled || row.disabled) return;
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
    } else {
      this._selectedLabelCache.set(row.value, row.label);
      this._selectedRowCache.clear();
      this._selectedRowCache.set(row.value, row);
      this.value = row.value;
      this.query = '';
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
    if (this.source) this.runSource(this.query);
    if (hadSelection) {
      this.emitValueEvents();
      this.emit('lr-clear');
    }
    if (queryChanged) this.emit('lr-filter', { value: this.query });
  }

  private onInput = (e: Event): void => {
    this.query = (e.target as HTMLInputElement).value;
    this.activeIndex = -1;
    this.show();
    if (this.source) this.runSource(this.query);
    // One of the two user-driven `query` writers that announce the new filter text (the other is
    // the clear button, via `clear()`) -- see the `query` declaration above.
    this.emit('lr-filter', { value: this.query });
  };

  private runSource(query: string): void {
    if (!this.source) return;
    clearTimeout(this.sourceTimer);
    this.sourceTimer = setTimeout(() => {
      const token = ++this.sourceToken;
      this.loading = true;
      // `Promise.resolve().then(() => this.source!(query))` moves the call
      // itself inside a `.then()` callback, so a *synchronous* throw from
      // `this.source(query)` becomes a normal promise rejection the
      // following `.catch()` handles, instead of escaping this `setTimeout`
      // callback as an uncaught exception.
      Promise.resolve()
        .then(() => this.source!(query))
        .then((rows) => {
          if (token !== this.sourceToken || !this.isConnected) return;
          this.asyncRows = rows;
          const selected = new Set(this._selected);
          for (const row of rows) {
            if (selected.has(row.value)) this._selectedRowCache.set(row.value, row);
          }
        })
        .catch((err) => {
          if (token !== this.sourceToken || !this.isConnected) return;
          console.warn('<lr-combobox> source() rejected:', err);
        })
        .finally(() => {
          if (token === this.sourceToken) this.loading = false;
        });
    }, 200);
  }

  private onInputBlur = (): void => {
    this.touched = true;
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

  private onHintSlotChange = (e: Event): void => {
    this.hasHintSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onErrorSlotChange = (e: Event): void => {
    this.hasErrorSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onLabelSlotChange = (e: Event): void => {
    this.hasLabelSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onStartSlotChange = (e: Event): void => {
    this.hasStartSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onEndSlotChange = (e: Event): void => {
    this.hasEndSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const navigable = this.renderedRows.rows.filter((r) => !r.disabled);
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!this.open) return this.show();
        this.activeIndex = Math.min(navigable.length - 1, this.activeIndex + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!this.open) return this.show();
        this.activeIndex = Math.max(0, this.activeIndex - 1);
        break;
      case 'Enter':
        if (this.open && this.activeIndex >= 0 && navigable[this.activeIndex]) {
          e.preventDefault();
          this.pickRow(navigable[this.activeIndex]);
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
          this.activeIndex = navigable.length - 1;
        }
        break;
      case 'Backspace':
        if (this.multiple && !this.query && this._selected.length) {
          this.removeValue(this._selected[this._selected.length - 1]);
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
    const selectedSet = new Set(this._selected);
    rows.forEach((o, i) => {
      if (o.group !== currentGroup) {
        currentGroup = o.group;
        if (currentGroup) out.push(html`<div class="group-label">${currentGroup}</div>`);
      }
      const id = `${this.listId}-opt-${i}`;
      const selected = selectedSet.has(o.value);
      out.push(
        html`<div
          part="option"
          id=${id}
          role="option"
          data-value=${o.value}
          aria-selected=${selected ? 'true' : 'false'}
          aria-disabled=${o.disabled ? 'true' : 'false'}
          aria-label=${o.accessibleLabel || nothing}
          ?data-active=${id === activeId}
        >
          ${o.icon ? html`<span part="option-icon" aria-hidden="true">${o.icon}</span>` : ''}
          ${o.dotColor ? html`<span part="option-dot" style=${`background:${o.dotColor}`}></span>` : ''}
          <span part="option-label">
            <span>${o.label}</span>
            ${o.sub ? html`<span part="option-sub">${o.sub}</span>` : ''}
          </span>
          ${o.badge != null ? html`<span part="option-badge">${o.badge}</span>` : ''}
        </div>`,
      );
    });
    return out;
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
    const hasHint = this.hasHintSlot || this.hint.length > 0;
    const hasError = this.hasErrorSlot || this.errorText.length > 0;
    const hasLabel = this.hasLabelSlot || this.label.length > 0;
    const describedBy = [hasError ? 'combobox-error' : '', hasHint ? 'combobox-hint' : ''].filter(Boolean).join(' ');

    return html`
      <div part="form-control">
        <label part="form-control-label" for=${this.inputId} ?hidden=${!hasLabel}>
          ${this.label}<slot name="label" @slotchange=${this.onLabelSlotChange}></slot>
        </label>
        <div part="combobox" @mousedown=${this.onComboMouseDown}>
          <span part="start" ?hidden=${!this.hasStartSlot}>
            <slot name="start" @slotchange=${this.onStartSlotChange}></slot>
          </span>
          <div part="tags">
            ${shownTags.map(
              (v) => html`<span part="tag"
                >${this.labelFor(v)}<button
                  part="tag__remove-button"
                  type="button"
                  ?disabled=${this.effectiveDisabled}
                  aria-label=${this.localize('removeWithContext', undefined, { label: this.labelFor(v) })}
                  @click=${(e: Event) => {
                    e.stopPropagation();
                    this.removeValue(v);
                  }}
                >
                  ${closeIcon()}</button
                ></span
              >`,
            )}
            ${extra > 0 ? html`<span part="tag">+${extra}</span>` : ''}
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
            aria-activedescendant=${activeId}
            aria-autocomplete="list"
            aria-required=${this.required ? 'true' : 'false'}
            aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'}
            autocomplete=${this.autocomplete || nothing}
            inputmode=${this.inputMode || nothing}
            enterkeyhint=${this.enterKeyHint || nothing}
            spellcheck=${this.spellcheck}
            autocapitalize=${this.autocapitalize || nothing}
            autocorrect=${this.autoCorrect || nothing}
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
                ${closeIcon()}
              </button>`
            : ''}
          <span part="end" ?hidden=${!this.hasEndSlot}>
            <slot name="end" @slotchange=${this.onEndSlotChange}></slot>
          </span>
          <span part="expand-icon" aria-hidden="true">${chevronIcon()}</span>
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
            : rows.length === 0
              ? html`<div class="empty" role="option" aria-selected="false" aria-disabled="true">${this.localize('noMatches', this.emptyText || undefined)}</div>`
              : html`${this.renderRows(rows, activeId)}
                  ${overflow > 0
                    ? html`<div part="option-overflow">${this.localize('comboboxOverflow', this.overflowText || undefined, { n: overflow })}</div>`
                    : ''}`}
        </div>
        <div id="combobox-error" part="error" ?hidden=${!hasError}>
          ${this.errorText}<slot name="error" @slotchange=${this.onErrorSlotChange}></slot>
        </div>
        <div id="combobox-hint" part="hint" ?hidden=${!hasHint}>
          ${this.hint}<slot name="hint" @slotchange=${this.onHintSlotChange}></slot>
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
