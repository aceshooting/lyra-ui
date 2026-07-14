import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { place } from '../../internal/positioner.js';
import { nextId } from '../../internal/a11y.js';
import { chevronIcon, closeIcon } from '../../internal/icons.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../internal/anchored-validity.js';
import { styles } from './combobox.styles.js';
import { LyraOption } from './option.class.js';
import './option.class.js';

export type OptionFilter = (option: LyraOption, query: string) => boolean;

export interface ComboboxSourceRow {
  value: string;
  label: string;
  sub?: string;
  dotColor?: string;
  group?: string;
  disabled?: boolean;
}

export type ComboboxSource = (query: string) => Promise<ComboboxSourceRow[]>;

export interface LyraComboboxEventMap {
  'lyra-show': CustomEvent<undefined>;
  'lyra-hide': CustomEvent<undefined>;
  'lyra-clear': CustomEvent<undefined>;
}
/**
 * `<lyra-combobox>` — a filterable single/multi select that combines a text
 * input with a listbox. Mirrors the core `<wa-combobox>` API under `lyra-`.
 *
 * Options are `<lyra-option value>` children. Emits native-style `change`/`input`
 * (like Web Awesome) plus `lyra-show`/`lyra-hide`/`lyra-clear`.
 *
 * @customElement lyra-combobox
 * @slot - `<lyra-option>` elements.
 * @slot label - Custom label content.
 * @slot hint - Custom hint content.
 * @slot error - Custom error content.
 * @event {Event} change - The selection changed through user interaction. A bubbling,
 * composed, non-cancelable Event.
 * @event {InputEvent | Event} input - The user typed in the filter or changed the selection. Text
 * edits expose the original InputEvent; selection changes emit a bubbling,
 * composed, non-cancelable Event.
 * @event lyra-show - The listbox opened.
 * @event lyra-hide - The listbox closed.
 * @event lyra-clear - The value was cleared.
 * @csspart form-control - The outer wrapper around label, combobox, listbox, error and hint.
 * @csspart form-control-label - The `<label>` element.
 * @csspart combobox - The input container (positioning anchor).
 * @csspart combobox-input - The text input.
 * @csspart listbox - The options popover.
 * @csspart option - An option row.
 * @csspart option-dot - An option row's leading status dot (when `dot-color` is set).
 * @csspart option-label - An option row's label/sub wrapper.
 * @csspart option-sub - An option row's secondary line (when `sub` is set).
 * @csspart option-overflow - The "+N more" indicator shown when rows are capped by `maxRender`.
 * @csspart tags - The multi-select tag container.
 * @csspart tag - An individual selected tag.
 * @csspart tag__remove-button - A tag's remove button.
 * @csspart clear-button - The clear button.
 * @csspart expand-icon - The dropdown indicator.
 * @csspart error - The error message.
 * @csspart hint - The hint message.
 */
export class LyraCombobox extends LyraElement<LyraComboboxEventMap> {
  static formAssociated = true;
  static styles = [LyraElement.styles, styles];

  static properties = {
    multiple: { type: Boolean, reflect: true, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    required: { type: Boolean, reflect: true, noAccessor: true },
    value: { noAccessor: true },
    name: { reflect: true, noAccessor: true },
  };

  @property() placeholder = '';
  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: Boolean, attribute: 'with-clear' }) withClear = false;
  @property({ attribute: 'max-options-visible', type: Number }) maxOptionsVisible = 3;
  /** Status copy shown in the listbox when no rows match. Empty string falls back to a localized message. */
  @property({ attribute: 'empty-text' }) emptyText = '';
  /** Status copy shown in the listbox while a `source` fetch is in flight. Empty string falls back to a localized message. */
  @property({ attribute: 'loading-text' }) loadingText = '';
  /** Status copy shown when `maxRender` caps the row list; `{n}` is replaced with the hidden count. Empty string falls back to a localized message. */
  @property({ attribute: 'overflow-text' }) overflowText = '';
  @property({ attribute: false }) filter: OptionFilter | null = null;
  @property({ attribute: false }) source: ComboboxSource | null = null;
  @property({ attribute: 'max-render', type: Number }) maxRender = 200;

  @state() private query = '';
  @state() private activeIndex = -1;
  @state() private options: LyraOption[] = [];
  // Set on the combobox input's first `blur`; gates the `data-invalid`
  // reflection below so validity styling never flashes on first render.
  @state() private touched = false;
  // `[part]:empty` never matches — the part always contains a literal
  // `<slot>` child element regardless of assigned content — so real
  // emptiness is tracked in JS instead (same fix as lyra-stat's
  // icon/caption) and reflected via `hidden`. Applies to
  // `form-control-label` too: the required-asterisk `::after` attaches to
  // that box, so leaving it always-visible orphans a stray ' *' when no
  // `label` is set.
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;
  @state() private hasLabelSlot = false;
  @state() private loading = false;
  @state() private asyncRows: ComboboxSourceRow[] = [];
  private sourceTimer?: ReturnType<typeof setTimeout>;
  private sourceToken = 0;
  // Guards the proactive `asyncRows` warm-up in `willUpdate()` below so it
  // fires at most once per mount instead of re-running (and endlessly
  // resetting the debounce timer) on every subsequent render while the fetch
  // is still in flight.
  private _sourceWarmed = false;
  private _selectedLabelCache = new Map<string, string>();
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
  // `<lyra-option selected>` markup was present the first time slotted
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

  constructor() {
    super();
    this.internals = this.attachInternals();
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

  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | null {
    return this.renderRoot?.querySelector('[part="combobox-input"]') ?? null;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.updateValidity();
  }

  protected willUpdate(): void {
    // `hasUpdated` flips to `true` before `updated()` even sees its first
    // call, so it can't distinguish "just mounted" from "just changed" there
    // -- capture that distinction here, while it's still reliable, for
    // `updated()`'s `open`-handling below to consult.
    this._isFirstUpdate = !this.hasUpdated;
    if (!this.hasUpdated) {
      this.hasHintSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'hint');
      this.hasErrorSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'error');
      this.hasLabelSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'label');
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
    this.syncFormValue();
    this.reflectSelected();
    this.updateValidity();
    this.requestUpdate('value', old);
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

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanup?.();
    this.cleanup = undefined;
    clearTimeout(this.sourceTimer);
    document.removeEventListener('pointerdown', this.onDocPointer);
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
      // declarative `<lyra-option selected>` markup — mirrors native
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
    // source rows backing it have since changed), a slotted `<lyra-option>`
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
    const q = this.query.trim().toLowerCase();
    const selectedLabel = !this.multiple ? (this.labelFor(this._selected[0] ?? '') ?? '') : '';
    const effective = q && q === selectedLabel.toLowerCase() ? '' : q;
    if (!effective) return this.options;
    const fn: OptionFilter =
      this.filter ??
      ((o, query) => o.label.toLowerCase().includes(query) || o.searchText.toLowerCase().includes(query));
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

  protected updated(changed: PropertyValues): void {
    if (changed.has('open')) {
      this.cleanup?.();
      this.cleanup = undefined;
      // All `open`-driven side effects (positioning, the click-outside
      // listener, and the lyra-show/lyra-hide events) live here rather than
      // in show()/hide() so they fire however `open` became true -- via
      // show()/hide()'s own user-interaction paths, or a consumer/test
      // setting `el.open` directly, which bypasses both entirely.
      if (this.open) {
        document.addEventListener('pointerdown', this.onDocPointer);
        // Don't announce a "show" transition for markup that's simply
        // rendering open for the first time (e.g. `<lyra-combobox open>`) --
        // only for an actual closed-to-open transition.
        if (!this._isFirstUpdate) this.emit('lyra-show');
        const anchor = this.renderRoot.querySelector('[part="combobox"]') as HTMLElement | null;
        const listbox = this.renderRoot.querySelector('[part="listbox"]') as HTMLElement | null;
        if (anchor && listbox) this.cleanup = place(anchor, listbox);
        if (this.source && this.asyncRows.length === 0) this.runSource(this.query);
      } else {
        document.removeEventListener('pointerdown', this.onDocPointer);
        if (!this._isFirstUpdate) this.emit('lyra-hide');
      }
    }
    if (changed.has('name')) this.syncFormValue();
    if (changed.has('touched') || changed.has('required') || changed.has('value')) {
      this.toggleAttribute('data-invalid', this.touched && !this.internals.validity.valid);
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
    this._selectedLabelCache.set(row.value, row.label);
    if (this.multiple) {
      const set = new Set(this._selected);
      set.has(row.value) ? set.delete(row.value) : set.add(row.value);
      this.value = [...set];
      this.query = '';
    } else {
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

  private clear(): void {
    if (this._selected.length === 0) return;
    this.value = [];
    this.query = '';
    if (this.source) this.runSource(this.query);
    this.emitValueEvents();
    this.emit('lyra-clear');
  }

  private onInput = (e: Event): void => {
    this.query = (e.target as HTMLInputElement).value;
    this.activeIndex = -1;
    this.show();
    if (this.source) this.runSource(this.query);
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
        })
        .catch((err) => {
          if (token !== this.sourceToken || !this.isConnected) return;
          console.warn('<lyra-combobox> source() rejected:', err);
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
  // pair allocated per option per render -- resolves the target row via
  // closest('[part="option"]') + a data-value lookup into `_rowsByValue`.
  private onListboxMouseDown = (e: MouseEvent): void => {
    if ((e.target as HTMLElement).closest('[part="option"]')) e.preventDefault();
  };

  private onListboxClick = (e: MouseEvent): void => {
    const optionEl = (e.target as HTMLElement).closest('[part="option"]') as HTMLElement | null;
    const value = optionEl?.dataset.value;
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
          ?data-active=${id === activeId}
        >
          ${o.dotColor ? html`<span part="option-dot" style=${`background:${o.dotColor}`}></span>` : ''}
          <span part="option-label">
            <span>${o.label}</span>
            ${o.sub ? html`<span part="option-sub">${o.sub}</span>` : ''}
          </span>
        </div>`,
      );
    });
    return out;
  }

  render(): TemplateResult {
    const { rows, overflow } = this.renderedRows;
    this._rowsByValue = new Map(rows.map((r) => [r.value, r]));
    const navigable = rows.filter((r) => !r.disabled);
    const active = this.activeIndex >= 0 ? navigable[this.activeIndex] : undefined;
    const activeId = active ? `${this.listId}-opt-${rows.indexOf(active)}` : '';

    const shownTags = this.multiple ? this._selected.slice(0, this.maxOptionsVisible) : [];
    const extra = this.multiple ? this._selected.length - shownTags.length : 0;
    const hasValue = this._selected.length > 0;
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
          <div part="tags">
            ${shownTags.map(
              (v) => html`<span part="tag"
                >${this.labelFor(v)}<button
                  part="tag__remove-button"
                  type="button"
                  ?disabled=${this.effectiveDisabled}
                  aria-label="${this.localize('remove')} ${this.labelFor(v)}"
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
            autocomplete="off"
            .value=${this.displayValue}
            placeholder=${hasValue && !this.multiple ? '' : this.placeholder}
            ?disabled=${this.effectiveDisabled}
            @input=${this.onInput}
            @keydown=${this.onKeyDown}
            @focus=${() => this.show()}
            @blur=${this.onInputBlur}
          />
          ${this.withClear && hasValue
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
      <slot @slotchange=${this.collectOptions} @lyra-option-change=${this.onOptionChange} hidden></slot>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lyra-combobox': LyraCombobox;
  }
}
