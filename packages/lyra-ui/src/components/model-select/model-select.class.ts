import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { place } from '../../internal/positioner.js';
import { nextId } from '../../internal/a11y.js';
import { chevronIcon } from '../../internal/icons.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../internal/anchored-validity.js';
import { styles } from './model-select.styles.js';

/** A catalog row: a selectable model, keyed by `id` with a display `label`. */
export interface LyraModelCatalogEntry {
  id: string;
  label: string;
}

/**
 * The `catalog` shape: either every entry is a plain string (used as both id
 * and label) or every entry is a full `{ id, label }` row — not a mix of both.
 */
export type LyraModelCatalog = string[] | LyraModelCatalogEntry[];

/** A catalog row plus whether it's the synthetic "stale value" row — see `effectiveEntries`. */
interface DisplayEntry extends LyraModelCatalogEntry {
  synthetic: boolean;
}

export interface LyraModelSelectEventMap {
  'lyra-change': CustomEvent<{ value: string; inCatalog: boolean }>;
}
/**
 * `<lyra-model-select>` — a provider/model picker that renders as a closed
 * dropdown when a fixed `catalog` is available, or as a filterable free-text
 * combobox when it isn't (or when `allow-custom` explicitly permits typing
 * something outside the catalog). Built directly on the shared
 * trigger-button/aria-activedescendant listbox technique `<lyra-select>` uses
 * and the filter-as-you-type suggestion-popup technique `<lyra-combobox>`
 * uses — not by composing either element, since the mode switch and the
 * stale-value handling below are specific to this control.
 *
 * A `value` that isn't present in `catalog` (e.g. a model id saved from a
 * provider whose live catalog has since changed) is never silently dropped:
 * `effectiveEntries` appends it to the rendered option list as a synthetic,
 * visually-distinct row (dashed border, italic label, "not in catalog"
 * badge — see `model-select.styles.ts`) computed fresh from `catalog` +
 * `value` on every render, without ever mutating the `catalog` property
 * itself.
 *
 * @customElement lyra-model-select
 * @event lyra-change - The selected/typed value changed. `detail: { value: string; inCatalog: boolean }`.
 * @event {Event} change - Fired alongside `lyra-change`, mirroring `<lyra-select>`/`<lyra-combobox>`'s
 *   native-style value-change pair so native form bindings/framework `v-model` handlers behave
 *   consistently across the picker family.
 * @event {Event} input - Fired alongside `change`/`lyra-change` (see `change`).
 * @csspart form-control-label - The `<label>` element (only rendered — and only contributes to the
 *   accessible name — once `label` is non-empty).
 * @csspart trigger - The trigger button (closed-dropdown mode's positioning anchor).
 * @csspart combobox - The text-input container (free-text mode's positioning anchor).
 * @csspart combobox-input - The free-text mode's text input.
 * @csspart provider-badge - The optional leading `provider` label.
 * @csspart listbox - The options popover (shared by both modes).
 * @csspart option - An option row.
 * @csspart option-label - An option row's label.
 * @csspart option-badge - The "not in catalog" badge on a synthetic stale-value row.
 * @csspart expand-icon - The dropdown indicator.
 */
export class LyraModelSelect extends LyraElement<LyraModelSelectEventMap> {
  static formAssociated = true;
  static styles = [LyraElement.styles, styles];

  static properties = {
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    required: { type: Boolean, reflect: true, noAccessor: true },
    value: { noAccessor: true },
    name: { reflect: true, noAccessor: true },
  };

  /** Informational only — e.g. `'ollama'`. Rendered as a small leading badge for display grouping. */
  @property() provider = '';
  /** The full model list. Omit (or leave empty) to fall back to plain free-text entry. */
  @property({ attribute: false }) catalog?: LyraModelCatalog;
  /** Let the user type/commit a value that isn't in `catalog`, even when `catalog` is non-empty. */
  @property({ type: Boolean, reflect: true, attribute: 'allow-custom' }) allowCustom = false;
  /**
   * Optional visible title above the control, mirroring `lyra-select`'s
   * `label` exactly: rendered via a `part="form-control-label"` `<label>`
   * paired with the control's id, and — once non-empty — it takes over as
   * the accessible-name source (the `aria-label` fallback below is then only
   * emitted when the host has an explicit `aria-label` override, same
   * precedence as `lyra-select`). Leaving it empty (the default) keeps
   * today's `aria-label || placeholder || 'Model'` chain untouched.
   */
  @property() label = '';
  @property() placeholder = '';
  @property({ type: Boolean, reflect: true }) open = false;

  @state() private activeIndex = -1;
  // Free-text mode's live input text. Only meaningful while `open` — the
  // input is otherwise controlled by the committed value's label (see
  // `renderFreeText`), so this never needs resetting on commit/hide.
  @state() private query = '';
  // Set on first blur; gates the `data-invalid` reflection below so
  // validity styling never flashes on first render (matches lyra-select).
  @state() private touched = false;

  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  private listId = nextId('model-select-list');
  private controlId = nextId('model-select-control');
  private cleanup?: () => void;
  private _value = '';
  private _fieldsetDisabled = false;
  private _name = '';
  private _disabled = false;
  private _required = false;
  // What `form.reset()` restores to — captured from the `value` *content
  // attribute* only, mirroring native `<input>`/`FormAssociated`'s
  // `_defaultValue` (see internal/form-associated.ts). There's no child
  // markup here to seed a declarative default from (unlike lyra-select's
  // `<lyra-option selected>`), so the initial attribute is the only source.
  private _defaultValue = '';

  constructor() {
    super();
    this.internals = this.attachInternals();
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
    // Native <input> always has a submission value ("") from construction —
    // without this, a control whose `value` is never touched is entirely
    // absent from FormData instead of present as "" (see form-associated.ts).
    this.internals.setFormValue('');
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
    return this.renderRoot?.querySelector('[part="trigger"], [part="combobox-input"]') ?? null;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.updateValidity();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanup?.();
    this.cleanup = undefined;
    document.removeEventListener('pointerdown', this.onDocPointer);
    // Reset so a reconnect (e.g. a drag-drop reparent) re-triggers
    // `updated()`'s `open`-driven branch -- without this, `open` stays
    // `true` across the disconnect/reconnect and `changed.has('open')` never
    // fires again, leaving the listbox rendered open with no positioning and
    // no outside-click listener.
    this.open = false;
  }

  attributeChangedCallback(name: string, old: string | null, val: string | null): void {
    super.attributeChangedCallback(name, old, val);
    if (name === 'value') this._defaultValue = this._value;
  }

  /** The current model id (empty string when nothing is selected). */
  get value(): string {
    return this._value;
  }
  set value(next: string) {
    const old = this._value;
    this._value = next ?? '';
    this.internals.setFormValue(this._value);
    this.updateValidity();
    this.requestUpdate('value', old);
  }

  /** The form submission key, reflected synchronously for native form APIs. */
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
    this.requestUpdate('name', old);
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

  /** Whether the control is disabled explicitly or by an ancestor fieldset. */
  get effectiveDisabled(): boolean {
    return this.disabled || this._fieldsetDisabled;
  }

  private updateValidity(): void {
    if (this.required && !this._value) {
      this.validityController.setValidity({ valueMissing: true }, this.localize('modelSelectRequired'));
    } else {
      this.validityController.setValidity({});
    }
  }

  formResetCallback(): void {
    this.value = this._defaultValue;
  }
  formStateRestoreCallback(
    state: string | File | FormData | null,
    _mode?: 'restore' | 'autocomplete',
  ): void {
    this.value = typeof state === 'string' ? state : '';
  }
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

  /** `catalog`, normalized to `{ id, label }[]` regardless of the plain-string-array shorthand. */
  private get normalizedCatalog(): LyraModelCatalogEntry[] {
    const raw = this.catalog;
    if (!raw || raw.length === 0) return [];
    return raw.map((item): LyraModelCatalogEntry => (typeof item === 'string' ? { id: item, label: item } : item));
  }

  /** Closed-dropdown-with-listbox mode vs. free-text filterable mode — see class doc. */
  private get closedMode(): boolean {
    return this.normalizedCatalog.length > 0 && !this.allowCustom;
  }

  /**
   * `normalizedCatalog` plus, when `value` isn't one of its ids, a synthetic
   * trailing row for it — recomputed from scratch on every access so it
   * always reflects the *current* `catalog`/`value`, never a snapshot from
   * whenever `value` happened to be assigned.
   */
  private get effectiveEntries(): DisplayEntry[] {
    const catalog = this.normalizedCatalog;
    const entries: DisplayEntry[] = catalog.map((e) => ({ ...e, synthetic: false }));
    if (catalog.length > 0 && this._value && !catalog.some((e) => e.id === this._value)) {
      entries.push({ id: this._value, label: this._value, synthetic: true });
    }
    return entries;
  }

  /** `effectiveEntries` filtered by the typed `query` (free-text mode only; id or label substring, case-insensitive). */
  private get filteredEntries(): DisplayEntry[] {
    const q = this.query.trim().toLowerCase();
    if (!q) return this.effectiveEntries;
    return this.effectiveEntries.filter((e) => e.id.toLowerCase().includes(q) || e.label.toLowerCase().includes(q));
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

  protected updated(changed: PropertyValues): void {
    const reposition =
      changed.has('open') || (this.open && (changed.has('catalog') || changed.has('allowCustom')));
    if (reposition) {
      this.cleanup?.();
      this.cleanup = undefined;
      if (this.open) {
        document.addEventListener('pointerdown', this.onDocPointer);
        const anchor = this.renderRoot.querySelector(
          this.closedMode ? '[part="trigger"]' : '[part="combobox"]',
        ) as HTMLElement | null;
        const listbox = this.renderRoot.querySelector('[part="listbox"]') as HTMLElement | null;
        if (anchor && listbox) this.cleanup = place(anchor, listbox);
      } else {
        document.removeEventListener('pointerdown', this.onDocPointer);
      }
    }
    if (changed.has('required') || changed.has('touched') || changed.has('value')) {
      this.toggleAttribute('data-invalid', this.touched && !this.internals.validity.valid);
    }
  }

  private commitValue(next: string): void {
    const inCatalog = this.normalizedCatalog.some((e) => e.id === next);
    this.value = next;
    this.hide();
    this.emit('lyra-change', { value: next, inCatalog });
    this.emitValueEvents();
  }

  /** Dispatches the platform-style value-event pair alongside `lyra-change`,
   * mirroring `<lyra-select>`/`<lyra-combobox>` so native form bindings and
   * framework `v-model` handlers behave consistently across the picker
   * family. */
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
    if (this.activeIndex >= 0 && rows[this.activeIndex]) {
      this.commitValue(rows[this.activeIndex].id);
      return;
    }
    this.commitValue(this.query.trim());
  }

  // -- Closed-dropdown mode (trigger button) --------------------------------

  private onTriggerClick = (): void => {
    if (this.effectiveDisabled) return;
    this.open ? this.hide() : this.show();
  };
  private onTriggerBlur = (): void => {
    this.touched = true;
    this.hide();
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
          if (this.activeIndex >= 0 && rows[this.activeIndex]) {
            this.selectEntry(rows[this.activeIndex]);
          } else {
            this.hide();
          }
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

  // -- Free-text mode (text input) ------------------------------------------

  private onComboMouseDown = (e: MouseEvent): void => {
    if (this.effectiveDisabled) return;
    e.preventDefault();
    (this.renderRoot.querySelector('[part="combobox-input"]') as HTMLInputElement | null)?.focus();
  };
  private onInputFocus = (): void => {
    // Seed the editable text from the *current* value each time a fresh
    // editing session starts, not on every keystroke (onInput overwrites
    // `query` directly) — otherwise a same-session reopen via ArrowDown
    // after Escape would clobber the just-reverted text right back to
    // whatever the user had typed before Escape.
    if (!this.open) this.query = this.labelFor(this.value);
    this.show();
  };
  private onInput = (e: Event): void => {
    this.query = (e.target as HTMLInputElement).value;
    this.activeIndex = -1;
    this.show();
  };
  private onInputBlur = (): void => {
    this.touched = true;
    this.hide();
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

  // Delegated onto [part="listbox"] rather than one closure pair allocated
  // per row per render — resolves the target row via closest('[part="option"]')
  // + a data-value lookup, mirroring lyra-select/lyra-combobox.
  private onListboxMouseDown = (e: MouseEvent): void => {
    if ((e.target as HTMLElement).closest('[part="option"]')) e.preventDefault();
  };
  private onListboxClick = (e: MouseEvent): void => {
    if (this.effectiveDisabled) return;
    const optionEl = (e.target as HTMLElement).closest('[part="option"]') as HTMLElement | null;
    const value = optionEl?.dataset.value;
    if (value === undefined) return;
    const entry = (this.closedMode ? this.effectiveEntries : this.filteredEntries).find((e2) => e2.id === value);
    if (entry) this.selectEntry(entry);
  };

  private renderRows(rows: DisplayEntry[], activeId: string): TemplateResult[] {
    return rows.map((entry, i) => {
      const id = `${this.listId}-opt-${i}`;
      const selected = entry.id === this._value;
      return html`<div
        part="option"
        id=${id}
        role="option"
        data-value=${entry.id}
        ?data-synthetic=${entry.synthetic}
        aria-selected=${selected ? 'true' : 'false'}
        ?data-active=${id === activeId}
      >
        <span part="option-label">${entry.label}</span>
        ${entry.synthetic ? html`<span part="option-badge">${this.localize('notInCatalog')}</span>` : ''}
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
          ? html`<div class="empty" role="option" aria-selected="false" aria-disabled="true">${emptyText}</div>`
          : this.renderRows(rows, activeId)}
      </div>
    `;
  }

  /** `part="form-control-label"` — see `label`'s doc comment for its precedence over `aria-label`. */
  private renderLabel(): TemplateResult {
    return html`<label part="form-control-label" for=${this.controlId} ?hidden=${!this.label}>${this.label}</label>`;
  }

  private renderClosed(): TemplateResult {
    const rows = this.effectiveEntries;
    const activeId = this.activeIndex >= 0 && rows[this.activeIndex] ? `${this.listId}-opt-${this.activeIndex}` : '';
    const hasValue = this._value.length > 0;
    const hasLabel = this.label.length > 0;
    return html`
      ${this.renderLabel()}
      <button
        id=${this.controlId}
        part="trigger"
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded=${this.open ? 'true' : 'false'}
        aria-controls=${this.listId}
        aria-activedescendant=${activeId}
        aria-label=${this.getAttribute('aria-label') || (hasLabel ? nothing : this.placeholder || this.localize('model'))}
        aria-required=${this.required ? 'true' : 'false'}
        aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'}
        ?disabled=${this.effectiveDisabled}
        @click=${this.onTriggerClick}
        @keydown=${this.onTriggerKeyDown}
        @blur=${this.onTriggerBlur}
      >
        ${this.provider ? html`<span part="provider-badge">${this.provider}</span>` : ''}
        <span class="trigger-label" ?data-placeholder=${!hasValue}
          >${hasValue ? this.labelFor(this._value) : this.placeholder}</span
        >
        <span part="expand-icon" aria-hidden="true">${chevronIcon()}</span>
      </button>
      ${this.renderListbox(rows, activeId, this.localize('modelSelectNoModels'))}
    `;
  }

  private renderFreeText(): TemplateResult {
    const rows = this.filteredEntries;
    const activeId = this.activeIndex >= 0 && rows[this.activeIndex] ? `${this.listId}-opt-${this.activeIndex}` : '';
    const hasLabel = this.label.length > 0;
    return html`
      ${this.renderLabel()}
      <div part="combobox" @mousedown=${this.onComboMouseDown}>
        ${this.provider ? html`<span part="provider-badge">${this.provider}</span>` : ''}
        <input
          id=${this.controlId}
          part="combobox-input"
          role="combobox"
          aria-label=${this.getAttribute('aria-label') || (hasLabel ? nothing : this.placeholder || this.localize('model'))}
          aria-expanded=${this.open ? 'true' : 'false'}
          aria-controls=${this.listId}
          aria-activedescendant=${activeId}
          aria-autocomplete="list"
          aria-required=${this.required ? 'true' : 'false'}
          aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'}
          autocomplete="off"
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
      ${this.renderListbox(rows, activeId, this.localize('noMatches'))}
    `;
  }

  render(): TemplateResult {
    return this.closedMode ? this.renderClosed() : this.renderFreeText();
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lyra-model-select': LyraModelSelect;
  }
}
