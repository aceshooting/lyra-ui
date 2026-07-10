import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { place } from '../../internal/positioner.js';
import { nextId } from '../../internal/a11y.js';
import { styles } from './combobox.styles.js';
import { LyraOption } from './option.js';
import './option.js';

export type OptionFilter = (option: LyraOption, query: string) => boolean;

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
 * @event change - The selection changed.
 * @event input - The user typed in the filter or changed the selection.
 * @event lyra-show - The listbox opened.
 * @event lyra-hide - The listbox closed.
 * @event lyra-clear - The value was cleared.
 * @csspart combobox - The input container (positioning anchor).
 * @csspart combobox-input - The text input.
 * @csspart listbox - The options popover.
 * @csspart option - An option row.
 * @csspart tags - The multi-select tag container.
 * @csspart tag - An individual selected tag.
 * @csspart clear-button - The clear button.
 * @csspart expand-icon - The dropdown indicator.
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
  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: Boolean, attribute: 'with-clear' }) withClear = false;
  @property({ attribute: 'max-options-visible', type: Number }) maxOptionsVisible = 3;
  @property({ attribute: 'empty-text' }) emptyText = 'No results';
  @property({ attribute: false }) filter: OptionFilter | null = null;

  @state() private query = '';
  @state() private activeIndex = -1;
  @state() private options: LyraOption[] = [];

  private internals: ElementInternals;
  private listId = nextId('combobox-list');
  private cleanup?: () => void;
  private _selected: string[] = [];
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

  /** The selected value(s): a string in single mode, a string[] in `multiple` mode. */
  get value(): string | string[] {
    return this.multiple ? [...this._selected] : (this._selected[0] ?? '');
  }
  set value(next: string | string[]) {
    const old = this._selected;
    this._selected = Array.isArray(next) ? [...next] : next ? [next] : [];
    if (!this._defaultCaptured) {
      this._defaultSelected = [...this._selected];
      this._defaultCaptured = true;
    }
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
      const fd = new FormData();
      const key = this.name || 'value';
      for (const v of this._selected) fd.append(key, v);
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
    document.removeEventListener('pointerdown', this.onDocPointer);
  }

  private collectOptions = (e: Event): void => {
    const slot = e.target as HTMLSlotElement;
    this.options = slot
      .assignedElements({ flatten: true })
      .filter((el): el is LyraOption => el instanceof LyraOption);
    if (!this._defaultCaptured) {
      // Seed the initial selection from declarative `<lyra-option selected>`
      // markup — mirrors native `<select><option selected>` — the exact case
      // the audit found silently ignored (forms-core §combobox, Medium).
      const declared = this.options.filter((o) => o.selected).map((o) => o.value);
      if (declared.length) {
        this.value = this.multiple ? declared : declared[0];
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
    return this.options.find((o) => o.value === value)?.label ?? value;
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
    this.emit('lyra-show');
    document.addEventListener('pointerdown', this.onDocPointer);
  }
  private hide(): void {
    if (!this.open) return;
    this.open = false;
    this.activeIndex = -1;
    this.emit('lyra-hide');
    document.removeEventListener('pointerdown', this.onDocPointer);
  }
  private onDocPointer = (e: PointerEvent): void => {
    if (!e.composedPath().includes(this)) this.hide();
  };

  protected updated(changed: PropertyValues): void {
    if (changed.has('open')) {
      this.cleanup?.();
      this.cleanup = undefined;
      if (this.open) {
        const anchor = this.renderRoot.querySelector('[part="combobox"]') as HTMLElement | null;
        const listbox = this.renderRoot.querySelector('[part="listbox"]') as HTMLElement | null;
        if (anchor && listbox) this.cleanup = place(anchor, listbox);
      }
    }
    if (changed.has('required')) this.updateValidity();
  }

  private pick(option: LyraOption): void {
    if (option.disabled) return;
    if (this.multiple) {
      const set = new Set(this._selected);
      set.has(option.value) ? set.delete(option.value) : set.add(option.value);
      this.value = [...set];
      this.query = '';
    } else {
      this.value = option.value;
      this.query = '';
      this.hide();
    }
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
    this.emit('lyra-clear');
    this.emit('change');
  }

  private onInput = (e: Event): void => {
    this.query = (e.target as HTMLInputElement).value;
    this.activeIndex = -1;
    this.show();
    this.emit('input');
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const opts = this.filtered.filter((o) => !o.disabled);
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!this.open) return this.show();
        this.activeIndex = Math.min(opts.length - 1, this.activeIndex + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.activeIndex = Math.max(0, this.activeIndex - 1);
        break;
      case 'Enter':
        if (this.open && this.activeIndex >= 0 && opts[this.activeIndex]) {
          e.preventDefault();
          this.pick(opts[this.activeIndex]);
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
          this.activeIndex = opts.length - 1;
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

  private renderRows(filtered: LyraOption[], activeId: string): TemplateResult[] {
    const rows: TemplateResult[] = [];
    let currentGroup: string | undefined;
    let optIndex = 0;
    filtered.forEach((o) => {
      if (o.group !== currentGroup) {
        currentGroup = o.group;
        if (currentGroup) rows.push(html`<div class="group-label">${currentGroup}</div>`);
      }
      const id = `${this.listId}-opt-${optIndex++}`;
      const selected = this._selected.includes(o.value);
      rows.push(
        html`<div
          part="option"
          id=${id}
          role="option"
          aria-selected=${selected ? 'true' : 'false'}
          aria-disabled=${o.disabled ? 'true' : 'false'}
          ?data-active=${id === activeId}
          @mousedown=${(e: Event) => e.preventDefault()}
          @click=${() => this.pick(o)}
        >
          <span>${o.label}</span>
        </div>`,
      );
    });
    return rows;
  }

  render(): TemplateResult {
    const filtered = this.filtered;
    const activeOpts = filtered.filter((o) => !o.disabled);
    const active = this.activeIndex >= 0 ? activeOpts[this.activeIndex] : undefined;
    const activeId = active ? `${this.listId}-opt-${filtered.indexOf(active)}` : '';

    const shownTags = this.multiple ? this._selected.slice(0, this.maxOptionsVisible) : [];
    const extra = this.multiple ? this._selected.length - shownTags.length : 0;
    const hasValue = this._selected.length > 0;

    return html`
      <div part="form-control">
        <label part="form-control-label">${this.label}<slot name="label"></slot></label>
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
                  &times;</button
                ></span
              >`,
            )}
            ${extra > 0 ? html`<span part="tag">+${extra}</span>` : ''}
          </div>
          <input
            part="combobox-input"
            role="combobox"
            aria-label=${this.label || this.placeholder || 'Combobox'}
            aria-expanded=${this.open ? 'true' : 'false'}
            aria-controls=${this.listId}
            aria-activedescendant=${activeId}
            aria-autocomplete="list"
            autocomplete="off"
            .value=${this.displayValue}
            placeholder=${hasValue && !this.multiple ? '' : this.placeholder}
            ?disabled=${this.disabled}
            @input=${this.onInput}
            @keydown=${this.onKeyDown}
            @focus=${() => this.show()}
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
                &times;
              </button>`
            : ''}
          <span part="expand-icon" aria-hidden="true">▾</span>
        </div>
        <div part="listbox" id=${this.listId} role="listbox" aria-multiselectable=${this.multiple ? 'true' : 'false'}>
          ${filtered.length === 0
            ? html`<div class="empty">${this.emptyText}</div>`
            : this.renderRows(filtered, activeId)}
        </div>
        <div part="hint">${this.hint}<slot name="hint"></slot></div>
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
