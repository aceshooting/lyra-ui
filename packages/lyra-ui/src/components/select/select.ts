import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { place } from '../../internal/positioner.js';
import { nextId } from '../../internal/a11y.js';
import { chevronIcon } from '../../internal/icons.js';
import { styles } from './select.styles.js';
import { LyraOption } from '../combobox/option.js';
import '../combobox/option.js';

/**
 * `<lyra-select>` — a plain closed-list dropdown: a direct `<lyra-*>`
 * counterpart to `<wa-select>`/`<wa-option>`. Trigger is a button (not a text
 * input) -- click/Enter/Space/ArrowDown opens it, there's no typing-to-filter.
 * A printable keypress instead jumps (or, while closed, directly selects) the
 * next option whose label starts with what's been typed, like a native
 * `<select>`'s type-ahead.
 *
 * Options are `<lyra-option value>` children, the same element `<lyra-combobox>`
 * uses. Unlike `lyra-combobox` this is single-select only, with no filter/
 * source/with-clear/max-options-visible/empty-text/max-render/multiple surface
 * -- see `<lyra-combobox>` for the filterable/multi-select case.
 *
 * Reuses `lyra-combobox`'s popup positioning (`internal/positioner.js`) and
 * click-outside/Escape/Home/End/Arrow-key listbox navigation patterns,
 * adapted to a trigger button that keeps DOM focus throughout (the listbox's
 * "active" row is conveyed via `aria-activedescendant`, never actual focus),
 * matching the WAI-ARIA "select-only combobox" pattern.
 *
 * @customElement lyra-select
 * @slot - `<lyra-option>` elements.
 * @slot label - Custom label content.
 * @slot hint - Custom hint content.
 * @slot error - Custom error content.
 * @event change - The selection changed.
 * @event input - Fired alongside `change` on every selection change (native
 *   `<select>` doesn't meaningfully distinguish the two either).
 * @event lyra-show - The listbox opened.
 * @event lyra-hide - The listbox closed.
 * @csspart form-control - The outer wrapper around label, trigger, listbox, error and hint.
 * @csspart form-control-label - The `<label>` element.
 * @csspart trigger - The trigger button (positioning anchor).
 * @csspart listbox - The options popover.
 * @csspart option - An option row.
 * @csspart option-dot - An option row's leading status dot (when `dot-color` is set).
 * @csspart option-label - An option row's label/sub wrapper.
 * @csspart option-sub - An option row's secondary line (when `sub` is set).
 * @csspart expand-icon - The dropdown indicator.
 * @csspart error - The error message.
 * @csspart hint - The hint message.
 */
export class LyraSelect extends LyraElement {
  static formAssociated = true;
  static styles = [LyraElement.styles, styles];

  static properties = {
    value: { noAccessor: true },
    name: { reflect: true, noAccessor: true },
  };

  @property() placeholder = '';
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ type: Boolean, reflect: true }) required = false;
  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  @property({ type: Boolean, reflect: true }) open = false;

  @state() private activeIndex = -1;
  @state() private options: LyraOption[] = [];
  // Set on the trigger button's first `blur`; gates the `data-invalid`
  // reflection below so validity styling never flashes on first render.
  @state() private touched = false;
  // `[part]:empty` never matches -- the part always contains a literal
  // `<slot>` child element regardless of assigned content -- so real
  // emptiness is tracked in JS instead (same fix as lyra-combobox's
  // hasHintSlot/hasErrorSlot/hasLabelSlot) and reflected via `hidden`.
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;
  @state() private hasLabelSlot = false;

  private internals: ElementInternals;
  // Tracked separately from the consumer's own `disabled` -- a native
  // `<input>`'s own `disabled` IDL property/attribute is never mutated by
  // fieldset cascading, so a consumer's explicit `disabled` must survive the
  // fieldset re-enabling (see `formDisabledCallback` below).
  private _fieldsetDisabled = false;
  private listId = nextId('select-list');
  private triggerId = nextId('select-trigger');
  private cleanup?: () => void;
  private _isFirstUpdate = true;
  private _selected = '';
  // What `form.reset()` restores to. Captured exactly once, from whatever
  // `<lyra-option selected>` markup was present the first time slotted
  // options are collected (mirrors native `<select><option selected>`) --
  // never from the `value` setter, so a user picking an option (even the
  // very first pick on an initially-unselected select) can't itself become
  // the reset default. See lyra-combobox's identical `_defaultSelected`.
  private _defaultSelected = '';
  private _defaultCaptured = false;
  // Standard listbox type-ahead: printable keystrokes accumulate into this
  // buffer and reset ~500ms after the last one, so "b" then "a" narrows to
  // "ba" instead of restarting the search on every keystroke.
  private typeAheadBuffer = '';
  private typeAheadTimer?: ReturnType<typeof setTimeout>;

  // Hand-written accessor (mirrors the `value` accessor below, and Task 2's
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

  /** The selected value: a single string (empty when nothing is selected). */
  get value(): string {
    return this._selected;
  }
  set value(next: string) {
    const old = this._selected;
    this._selected = next ?? '';
    this.syncFormValue();
    this.reflectSelected();
    this.updateValidity();
    this.requestUpdate('value', old);
  }

  private updateValidity(): void {
    if (this.required && !this._selected) {
      this.internals.setValidity({ valueMissing: true }, 'Please select an option.');
    } else {
      this.internals.setValidity({});
    }
  }

  private syncFormValue(): void {
    this.internals.setFormValue(this._selected);
  }

  /** Effective disabled state: this element's own `disabled` OR an ancestor
   *  `<fieldset disabled>`'s inherited state -- mirrors native `<input>`, whose
   *  own `disabled` IDL property/attribute is never mutated by a fieldset. */
  get effectiveDisabled(): boolean {
    return this.disabled || this._fieldsetDisabled;
  }

  formResetCallback(): void {
    this.value = this._defaultSelected;
  }
  /**
   * Called by the browser when an ancestor `<fieldset disabled>` toggles.
   * Tracked separately from the consumer's own `disabled` (see
   * `effectiveDisabled`) so a consumer's explicit `disabled` survives the
   * fieldset re-enabling instead of being permanently overwritten.
   */
  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
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
    clearTimeout(this.typeAheadTimer);
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
      // Seed the initial selection -- and the reset default -- from
      // declarative `<lyra-option selected>` markup, mirroring native
      // `<select><option selected>`. Only the *first* declared-selected
      // option matters when several declare it, mirroring lyra-combobox's
      // single-mode behavior. This is the only place `_defaultSelected` is
      // set; picking an option later (the `value` setter) never redefines
      // the reset default.
      const declared = this.options.filter((o) => o.selected).map((o) => o.value);
      this._defaultSelected = declared[0] ?? '';
      if (declared.length) {
        this.value = declared[0];
        return; // `value=`'s setter already called reflectSelected()
      }
    } else {
      // Options slotted in after the first pass (e.g. a lazily-populated
      // list appended post-connect) still declare selection the same way a
      // native `<select><option selected>` would -- seed the newest one
      // into the live selection instead of letting reflectSelected() below
      // strip its `selected` attribute back off.
      const newlySelected = this.options.filter((o) => !previous.has(o) && o.selected).map((o) => o.value);
      if (newlySelected.length) {
        this.value = newlySelected[newlySelected.length - 1];
        return; // `value=`'s setter already called reflectSelected()
      }
    }
    this.reflectSelected();
  };

  private reflectSelected(): void {
    for (const o of this.options) o.selected = o.value === this._selected;
  }

  // Fired by `option.ts`'s `lyra-option-change` (a MutationObserver on the
  // option's own light-DOM content/attributes) when an already-slotted
  // `<lyra-option>` mutates its own data in place -- `collectOptions()` only
  // re-runs on `slotchange`, which never fires for such a mutation, so
  // without this the rendered listbox row would go stale. Reassigning (not
  // mutating) `options` gives Lit a new array reference to diff against.
  private onOptionChange = (): void => {
    this.options = [...this.options];
  };

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
        // rendering open for the first time (e.g. `<lyra-select open>`) --
        // only for an actual closed-to-open transition.
        if (!this._isFirstUpdate) this.emit('lyra-show');
        const anchor = this.renderRoot.querySelector('[part="trigger"]') as HTMLElement | null;
        const listbox = this.renderRoot.querySelector('[part="listbox"]') as HTMLElement | null;
        if (anchor && listbox) this.cleanup = place(anchor, listbox);
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

  private selectOption(option: LyraOption): void {
    if (option.disabled) return;
    this.value = option.value;
    this.hide();
    this.emit('input');
    this.emit('change');
  }

  private onTriggerClick = (): void => {
    if (this.effectiveDisabled) return;
    this.open ? this.hide() : this.show();
  };

  private onTriggerBlur = (): void => {
    this.touched = true;
    // A mouse click outside the element is already handled by
    // onDocPointer/hide(), but that leaves keyboard users with no way to
    // dismiss the listbox short of Escape -- tabbing focus away from the
    // trigger should close it too, the same as lyra-combobox's input blur.
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

  /**
   * Standard listbox type-ahead: moves to the next non-disabled option whose
   * label starts with the accumulated buffer, cycling from just after the
   * "current" option (the active row while open, the selected value while
   * closed). While open this only moves `activeIndex` (a highlight, matching
   * Arrow-key nav -- Enter/click still commits it); while closed there's no
   * highlight to show, so it commits immediately, matching a native
   * `<select>`'s closed-state type-ahead.
   */
  private typeAhead(char: string): void {
    clearTimeout(this.typeAheadTimer);
    this.typeAheadBuffer += char.toLowerCase();
    this.typeAheadTimer = setTimeout(() => {
      this.typeAheadBuffer = '';
    }, 500);

    const navigable = this.options.filter((o) => !o.disabled);
    if (!navigable.length) return;
    const currentValue = this.open ? navigable[this.activeIndex]?.value : this._selected;
    const currentIndex = navigable.findIndex((o) => o.value === currentValue);
    const n = navigable.length;
    for (let step = 1; step <= n; step++) {
      const idx = (currentIndex + step + n) % n;
      const candidate = navigable[idx];
      if (candidate.label.toLowerCase().startsWith(this.typeAheadBuffer)) {
        if (this.open) {
          this.activeIndex = idx;
        } else {
          this.selectOption(candidate);
        }
        return;
      }
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const navigable = this.options.filter((o) => !o.disabled);
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
      case ' ':
        // When closed, let the button's native Enter/Space activation fire
        // its own `click` handler (onTriggerClick) to open -- only intercept
        // here to commit/dismiss while already open, so that synthesized
        // click doesn't also re-toggle it shut.
        if (this.open) {
          e.preventDefault();
          if (this.activeIndex >= 0 && navigable[this.activeIndex]) {
            this.selectOption(navigable[this.activeIndex]);
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
          this.activeIndex = navigable.length - 1;
        }
        break;
      default:
        if (e.key.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey) {
          this.typeAhead(e.key);
        }
        break;
    }
  };

  // Delegated onto [part="listbox"] (see render()) rather than one closure
  // pair allocated per option per render -- resolves the target row via
  // closest('[part="option"]') + a data-value lookup, mirroring lyra-combobox.
  private onListboxMouseDown = (e: MouseEvent): void => {
    if ((e.target as HTMLElement).closest('[part="option"]')) e.preventDefault();
  };

  private onListboxClick = (e: MouseEvent): void => {
    const optionEl = (e.target as HTMLElement).closest('[part="option"]') as HTMLElement | null;
    const value = optionEl?.dataset.value;
    if (value === undefined) return;
    const option = this.options.find((o) => o.value === value);
    if (option) this.selectOption(option);
  };

  private renderRows(options: LyraOption[], activeId: string): TemplateResult[] {
    const out: TemplateResult[] = [];
    let currentGroup: string | undefined;
    options.forEach((o, i) => {
      if (o.group !== currentGroup) {
        currentGroup = o.group;
        if (currentGroup) out.push(html`<div class="group-label">${currentGroup}</div>`);
      }
      const id = `${this.listId}-opt-${i}`;
      const selected = o.value === this._selected;
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
    const options = this.options;
    const navigable = options.filter((o) => !o.disabled);
    const active = this.activeIndex >= 0 ? navigable[this.activeIndex] : undefined;
    const activeId = active ? `${this.listId}-opt-${options.indexOf(active)}` : '';
    const selectedLabel = this._selected
      ? (options.find((o) => o.value === this._selected)?.label ?? this._selected)
      : '';
    const hasValue = this._selected.length > 0;
    const hasHint = this.hasHintSlot || this.hint.length > 0;
    const hasError = this.hasErrorSlot || this.errorText.length > 0;
    const hasLabel = this.hasLabelSlot || this.label.length > 0;

    return html`
      <div part="form-control">
        <label part="form-control-label" for=${this.triggerId} ?hidden=${!hasLabel}>
          ${this.label}<slot name="label" @slotchange=${this.onLabelSlotChange}></slot>
        </label>
        <button
          id=${this.triggerId}
          part="trigger"
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded=${this.open ? 'true' : 'false'}
          aria-controls=${this.listId}
          aria-activedescendant=${activeId}
          aria-label=${hasLabel ? nothing : this.placeholder || 'Select'}
          aria-required=${this.required ? 'true' : 'false'}
          aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'}
          ?disabled=${this.effectiveDisabled}
          @click=${this.onTriggerClick}
          @keydown=${this.onKeyDown}
          @blur=${this.onTriggerBlur}
        >
          <span class="trigger-label" ?data-placeholder=${!hasValue}
            >${hasValue ? selectedLabel : this.placeholder}</span
          >
          <span part="expand-icon" aria-hidden="true">${chevronIcon()}</span>
        </button>
        <div
          part="listbox"
          id=${this.listId}
          role="listbox"
          @mousedown=${this.onListboxMouseDown}
          @click=${this.onListboxClick}
        >
          ${this.renderRows(options, activeId)}
        </div>
        <div part="error" ?hidden=${!hasError}>
          ${this.errorText}<slot name="error" @slotchange=${this.onErrorSlotChange}></slot>
        </div>
        <div part="hint" ?hidden=${!hasHint}>
          ${this.hint}<slot name="hint" @slotchange=${this.onHintSlotChange}></slot>
        </div>
      </div>
      <slot @slotchange=${this.collectOptions} @lyra-option-change=${this.onOptionChange} hidden></slot>
    `;
  }
}

defineElement('select', LyraSelect);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-select': LyraSelect;
  }
}
