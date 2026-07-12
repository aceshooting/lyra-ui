import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { place } from '../../internal/positioner.js';
import { nextId } from '../../internal/a11y.js';
import { chevronIcon, closeIcon } from '../../internal/icons.js';
import { styles } from './combobox.styles.js';
import { LyraOption } from './option.js';
import './option.js';

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
 * @event change - The selection changed.
 * @event input - The user typed in the filter or changed the selection.
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
export class LyraCombobox extends LyraElement {
  static formAssociated = true;
  static styles = [LyraElement.styles, styles];

  static properties = {
    value: { noAccessor: true },
  };

  @property({ type: Boolean, reflect: true }) multiple = false;
  @property() placeholder = '';
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ type: Boolean, reflect: true }) required = false;
  @property() name = '';
  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: Boolean, attribute: 'with-clear' }) withClear = false;
  @property({ attribute: 'max-options-visible', type: Number }) maxOptionsVisible = 3;
  @property({ attribute: 'empty-text' }) emptyText = 'No results';
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
  // icon/caption, commit 6c1004c) and reflected via `hidden`. Applies to
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
  private _selectedLabelCache = new Map<string, string>();
  // Rebuilt once per render (in render(), before renderRows()) from the
  // currently-visible row set -- backs the delegated listbox click/mousedown
  // handlers' data-value lookup below, instead of each option row closing
  // over its own row object.
  private _rowsByValue = new Map<string, ComboboxSourceRow>();

  private internals: ElementInternals;
  private listId = nextId('combobox-list');
  private inputId = nextId('combobox-input');
  private cleanup?: () => void;
  private _isFirstUpdate = true;
  private _selected: string[] = [];
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

  constructor() {
    super();
    this.internals = this.attachInternals();
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
  }

  /** The selected value(s): a string in single mode, a string[] in `multiple` mode. */
  get value(): string | string[] {
    return this.multiple ? [...this._selected] : (this._selected[0] ?? '');
  }
  set value(next: string | string[]) {
    const old = this._selected;
    this._selected = Array.isArray(next) ? [...next] : next ? [next] : [];
    this.syncFormValue();
    this.reflectSelected();
    this.updateValidity();
    this.requestUpdate('value', old);
  }

  private updateValidity(): void {
    if (this.required && this._selected.length === 0) {
      this.internals.setValidity({ valueMissing: true }, 'Please select an option.');
    } else {
      this.internals.setValidity({});
    }
  }

  private syncFormValue(): void {
    if (this.multiple) {
      // A FormData form value submits under the keys baked into the FormData
      // itself, bypassing the element's own `name` the way a plain string
      // value would use it -- so an unnamed multi-select must contribute
      // nothing (matching a nameless native `<select multiple>`) rather than
      // inventing a shared key that would merge with any other unnamed
      // combobox in the same form.
      if (!this.name) {
        this.internals.setFormValue(null);
        return;
      }
      const fd = new FormData();
      for (const v of this._selected) fd.append(this.name, v);
      this.internals.setFormValue(fd);
    } else {
      this.internals.setFormValue(this._selected[0] ?? '');
    }
  }

  formResetCallback(): void {
    this.value = [...this._defaultSelected];
    this.query = '';
  }
  formDisabledCallback(disabled: boolean): void {
    this.disabled = disabled;
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
    clearTimeout(this.sourceTimer);
    document.removeEventListener('pointerdown', this.onDocPointer);
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
      if (declared.length) {
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
      if (newlySelected.length) {
        this.value = this.multiple
          ? [...new Set([...this._selected, ...newlySelected])]
          : newlySelected[newlySelected.length - 1];
        return; // `value=`'s setter already called reflectSelected()
      }
    }
    this.reflectSelected();
  };

  private reflectSelected(): void {
    const sel = new Set(this._selected);
    for (const o of this.options) o.selected = sel.has(o.value);
  }

  private labelFor(value: string): string {
    return this._selectedLabelCache.get(value) ?? this.options.find((o) => o.value === value)?.label ?? value;
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
    const capped = all.slice(0, this.maxRender);
    const cappedValues = new Set(capped.map((r) => r.value));
    for (const v of this._selected) {
      if (!cappedValues.has(v)) {
        const selectedRow = all.find((r) => r.value === v);
        if (selectedRow) capped.push(selectedRow);
      }
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
    if (this.open || this.disabled) return;
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
    if (changed.has('required')) this.updateValidity();
    if (changed.has('touched') || changed.has('required') || changed.has('value')) {
      this.toggleAttribute('data-invalid', this.touched && !this.internals.validity.valid);
    }
  }

  private pickRow(row: ComboboxSourceRow): void {
    if (row.disabled) return;
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
    this.emit('input');
    this.emit('change');
  }

  private removeValue(value: string): void {
    this.value = this._selected.filter((v) => v !== value);
    this.emit('change');
  }

  private clear(): void {
    this.value = [];
    this.query = '';
    if (this.source) this.runSource(this.query);
    this.emit('lyra-clear');
    this.emit('change');
  }

  private onInput = (e: Event): void => {
    this.query = (e.target as HTMLInputElement).value;
    this.activeIndex = -1;
    this.show();
    if (this.source) this.runSource(this.query);
    this.emit('input');
  };

  private runSource(query: string): void {
    if (!this.source) return;
    clearTimeout(this.sourceTimer);
    this.sourceTimer = setTimeout(() => {
      const token = ++this.sourceToken;
      this.loading = true;
      this.source!(query)
        .then((rows) => {
          if (token !== this.sourceToken || !this.isConnected) return;
          this.asyncRows = rows;
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
    if (this.disabled) return;
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

    return html`
      <div part="form-control">
        <label part="form-control-label" for=${this.inputId} ?hidden=${!hasLabel}>
          ${this.label}<slot name="label" @slotchange=${this.onLabelSlotChange}></slot>
        </label>
        <div part="combobox" @mousedown=${this.onComboMouseDown}>
          <div part="tags" style="display:contents">
            ${shownTags.map(
              (v) => html`<span part="tag"
                >${this.labelFor(v)}<button
                  part="tag__remove-button"
                  type="button"
                  aria-label="Remove ${this.labelFor(v)}"
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
            aria-label=${this.getAttribute('aria-label') || this.label || this.placeholder || 'Combobox'}
            aria-expanded=${this.open ? 'true' : 'false'}
            aria-controls=${this.listId}
            aria-activedescendant=${activeId}
            aria-autocomplete="list"
            aria-required=${this.required ? 'true' : 'false'}
            aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'}
            autocomplete="off"
            .value=${this.displayValue}
            placeholder=${hasValue && !this.multiple ? '' : this.placeholder}
            ?disabled=${this.disabled}
            @input=${this.onInput}
            @keydown=${this.onKeyDown}
            @focus=${() => this.show()}
            @blur=${this.onInputBlur}
          />
          ${this.withClear && hasValue
            ? html`<button
                part="clear-button"
                type="button"
                aria-label="Clear"
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
            ? html`<div class="loading" role="option" aria-selected="false" aria-disabled="true">Loading…</div>`
            : rows.length === 0
              ? html`<div class="empty" role="option" aria-selected="false" aria-disabled="true">${this.emptyText}</div>`
              : html`${this.renderRows(rows, activeId)}
                  ${overflow > 0
                    ? html`<div part="option-overflow">+${overflow} more — refine your search</div>`
                    : ''}`}
        </div>
        <div part="error" ?hidden=${!hasError}>
          ${this.errorText}<slot name="error" @slotchange=${this.onErrorSlotChange}></slot>
        </div>
        <div part="hint" ?hidden=${!hasHint}>
          ${this.hint}<slot name="hint" @slotchange=${this.onHintSlotChange}></slot>
        </div>
      </div>
      <slot @slotchange=${this.collectOptions} hidden></slot>
    `;
  }
}

defineElement('combobox', LyraCombobox);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-combobox': LyraCombobox;
  }
}
