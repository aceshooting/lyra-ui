import { html, nothing, type TemplateResult, type PropertyValues, type ComplexAttributeConverter } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { place } from '../../../internal/positioner.js';
import { nextId } from '../../../internal/a11y.js';
import { chevronIcon } from '../../../internal/icons.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { styles } from './model-select.styles.js';

/**
 * String-aware boolean attribute converter for `spellcheck`. Lit's built-in `type: Boolean`
 * converter is presence-based -- the attribute's mere presence (regardless of its string value)
 * maps to `true`, so a plain-markup consumer writing the literal `spellcheck="false"` would
 * actually get `true` (this property's default), the opposite of what that string reads as -- the
 * same bug class `<lr-textarea>`'s `spellcheckConverter` and `<lr-date-input>`'s identical
 * converter document and fix.
 */
const spellcheckConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute(value): boolean {
    return value !== 'false';
  },
  toAttribute(value): string | null {
    // `true` is this property's default, so there's nothing worth reflecting for it; only the
    // non-default `false` needs an attribute at all.
    return value ? null : 'false';
  },
};

/** Visual size, same `xs`-`xl` scale as `<lr-select>`'s `size`. */
export type LyraModelSelectSize = 'xs' | 's' | 'm' | 'l' | 'xl';

/** A no-op stand-in for `ElementInternals`, used only when the host environment has no real
 *  implementation of it (e.g. a downstream consumer's Vitest + happy-dom test suite) --
 *  `attachInternals()` is browser-only, and calling it unconditionally in the constructor would
 *  otherwise throw before any test assertion runs, merely from constructing or importing this
 *  component. Every member here is either an inert value or a no-op: native `<form>`
 *  participation is unavailable in that environment, but that's an acceptable degradation rather
 *  than a hard failure -- same fix as `<lr-tool-param-form>`'s identical
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
  'lr-change': CustomEvent<{ value: string; inCatalog: boolean }>;
  blur: CustomEvent<undefined>;
  focus: CustomEvent<undefined>;
}
/**
 * `<lr-model-select>` — a provider/model picker that renders as a closed
 * dropdown when a fixed `catalog` is available, or as a filterable free-text
 * combobox when it isn't (or when `allow-custom` explicitly permits typing
 * something outside the catalog). Built directly on the shared
 * trigger-button/aria-activedescendant listbox technique `<lr-select>` uses
 * and the filter-as-you-type suggestion-popup technique `<lr-combobox>`
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
 * Ships an opt-in `hint`/`errorText` form-control chrome (props + matching named slots +
 * `hint`/`error` parts), mirroring `<lr-select>`'s exact pattern -- left unset, neither renders.
 * Pairs with the existing `label` prop/part (also mirroring `<lr-select>`) for a full
 * label/hint/error field.
 *
 * @customElement lr-model-select
 * @event lr-change - The selected/typed value changed. `detail: { value: string; inCatalog: boolean }`.
 * @event {Event} change - Fired alongside `lr-change`, mirroring `<lr-select>`/`<lr-combobox>`'s
 *   native-style value-change pair so native form bindings/framework `v-model` handlers behave
 *   consistently across the picker family.
 * @event {Event} input - Fired alongside `change`/`lr-change` (see `change`).
 * @event blur - Re-dispatched from the free-text mode's internal native `<input>`'s own `blur` --
 *   bubbling and composed (unlike the native event, which is neither), so a listener above the
 *   shadow boundary can observe it. Closed-dropdown mode's trigger `<button>` has no equivalent
 *   re-dispatch, matching `<lr-select>`'s own trigger.
 * @event focus - Re-dispatched from the free-text mode's internal native `<input>`'s own `focus`,
 *   for the same reason as `blur`.
 * @slot hint - Custom hint content.
 * @slot error - Custom error content.
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
 * @csspart empty - The empty-listbox message, shown when no rows match.
 * @csspart expand-icon - The dropdown indicator.
 * @csspart hint - The hint message.
 * @csspart error - The error message.
 * @cssprop [--lr-model-select-trigger-padding=var(--lr-space-xs) var(--lr-space-s)] - Trigger/combobox padding shorthand, scaled by `size`.
 * @cssprop [--lr-model-select-trigger-min-height=var(--lr-size-2-5rem)] - Trigger/combobox block-size floor, scaled by `size`.
 * @cssprop [--lr-model-select-font-size=var(--lr-font-size-md)] - Trigger/combobox font size, scaled by `size`.
 * @cssprop [--lr-model-select-expand-size=var(--lr-size-1-75rem)] - Decorative expand-icon box size, scaled by `size`.
 * @cssprop [--lr-model-select-option-active-bg=var(--lr-color-brand-quiet)] - Background of a hovered or keyboard-active option row.
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
   * Optional visible title above the control, mirroring `lr-select`'s
   * `label` exactly: rendered via a `part="form-control-label"` `<label>`
   * paired with the control's id, and — once non-empty — it takes over as
   * the accessible-name source (the `aria-label` fallback below is then only
   * emitted when the host has an explicit `aria-label` override, same
   * precedence as `lr-select`). Leaving it empty (the default) keeps
   * today's `aria-label || placeholder || 'Model'` chain untouched.
   */
  @property() label = '';
  /** Hint text below the field. Unset (the default): no hint chrome renders. */
  @property() hint = '';
  /** Error text below the field (overridden by slotted `error` content). Unset (the default): no
   *  error chrome renders. */
  @property({ attribute: 'error-text' }) errorText = '';
  @property() placeholder = '';
  /** Forwarded to the free-text mode's native `<input>`'s own `spellcheck`. Defaults to `true`,
   *  matching the native element's own default. No effect in closed-dropdown mode (no native text
   *  input there). `spellcheck="false"` is parsed as `false` (see `spellcheckConverter` above). */
  @property({ converter: spellcheckConverter }) spellcheck = true;
  /** Forwarded to the free-text mode's native `<input>`'s own `autocapitalize`. Empty string omits
   *  the attribute (browser default). */
  @property() autocapitalize = '';
  /** Forwarded to the free-text mode's native `<input>`'s own `autocorrect` (Safari/WebKit-specific).
   *  Empty string omits the attribute (browser default). Named `autoCorrect` (capital `C`), not
   *  `autocorrect`, purely to dodge a TS `lib.dom.d.ts` collision: newer DOM typings declare a
   *  `boolean`-typed `HTMLElement.autocorrect` IDL member, which conflicts with this string-typed
   *  property of the same name -- same fix as `<lr-textarea>`/`<lr-date-input>`. The explicit
   *  attribute mapping preserves the lowercase wire name in generated component metadata. */
  @property({ attribute: 'autocorrect' }) autoCorrect = '';
  /** Native editing and virtual-keyboard hints forwarded to free-text mode's input. */
  @property() autocomplete = 'off';
  @property({ attribute: 'inputmode' }) inputMode = '';
  @property({ attribute: 'enterkeyhint' }) enterKeyHint = '';
  @property({ type: Boolean, reflect: true }) open = false;
  /** Visual size — same `xs`–`xl` scale as `lr-select`'s `size`. */
  @property({ reflect: true }) size: LyraModelSelectSize = 'm';

  @state() private activeIndex = -1;
  // Free-text mode's live input text. Only meaningful while `open` — the
  // input is otherwise controlled by the committed value's label (see
  // `renderFreeText`), so this never needs resetting on commit/hide.
  @state() private query = '';
  // Set on first blur; gates the `data-invalid` reflection below so
  // validity styling never flashes on first render (matches lr-select).
  @state() private touched = false;
  // `[part]:empty` never matches -- the part always contains a literal <slot> child element
  // regardless of assigned content -- so real emptiness is tracked here instead (same fix as
  // lr-select's identical hasHintSlot/hasErrorSlot) and reflected via the hidden attribute.
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;

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
  // Replacing the currently focused trigger/input during a mode switch fires
  // `blur` synchronously while Lit is rendering. That structural blur must not
  // mutate reactive touched/open state from inside the active update cycle.
  private suppressControlBlur = false;
  // What `form.reset()` restores to — captured from the `value` *content
  // attribute* only, mirroring native `<input>`/`FormAssociated`'s
  // `_defaultValue` (see internal/form-associated.ts). There's no child
  // markup here to seed a declarative default from (unlike lr-select's
  // `<lr-option selected>`), so the initial attribute is the only source.
  private _defaultValue = '';

  constructor() {
    super();
    this.internals = createInternalsSafely(this);
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
    // Native <input> always has a submission value ("") from construction —
    // without this, a control whose `value` is never touched is entirely
    // absent from FormData instead of present as "" (see form-associated.ts).
    this.internals.setFormValue('');
  }

  /** Forwards to the internal trigger button (closed-dropdown mode) or combobox input (free-text
   *  mode) -- mirrors `<lr-button>`'s host `click()` forwarding so a generic form-automation
   *  helper or another component calling `.click()` on the host element actually opens the
   *  picker instead of silently doing nothing.
   *
   *  Closed-dropdown mode forwards via `.click()` itself, since the trigger is a real
   *  `<button>` wired to `@click`. Free-text mode instead calls `.focus()` on the input: unlike a
   *  genuine pointer click, `HTMLElement.click()` never moves focus (that's a mousedown side
   *  effect the browser applies only to *real* pointer interaction), and this control's open
   *  behavior for that mode is wired to the input's `focus` event (see `onInputFocus`), not a
   *  `click` handler on the input itself. */
  override click(): void {
    const trigger = this.renderRoot?.querySelector('[part="trigger"]') as HTMLButtonElement | null;
    if (trigger) {
      trigger.click();
      return;
    }
    (this.renderRoot?.querySelector('[part="combobox-input"]') as HTMLInputElement | null)?.focus();
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

  protected willUpdate(): void {
    if (this.hasUpdated) {
      const renderedClosedMode = this.renderRoot.querySelector('[part="trigger"]') !== null;
      this.suppressControlBlur = renderedClosedMode !== this.closedMode;
    }
    if (!this.hasUpdated) {
      this.hasHintSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'hint');
      this.hasErrorSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'error');
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanup?.();
    this.cleanup = undefined;
    this.ownerDocument.removeEventListener('pointerdown', this.onDocPointer);
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
    this.touched = false;
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
    const q = this.query.trim().toLocaleLowerCase(this.effectiveLocale);
    if (!q) return this.effectiveEntries;
    return this.effectiveEntries.filter(
      (e) =>
        e.id.toLocaleLowerCase(this.effectiveLocale).includes(q) ||
        e.label.toLocaleLowerCase(this.effectiveLocale).includes(q),
    );
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
        this.ownerDocument.addEventListener('pointerdown', this.onDocPointer);
        const anchor = this.renderRoot.querySelector(
          this.closedMode ? '[part="trigger"]' : '[part="combobox"]',
        ) as HTMLElement | null;
        const listbox = this.renderRoot.querySelector('[part="listbox"]') as HTMLElement | null;
        if (anchor && listbox) this.cleanup = place(anchor, listbox);
      } else {
        this.ownerDocument.removeEventListener('pointerdown', this.onDocPointer);
      }
    }
    if (changed.has('required') || changed.has('touched') || changed.has('value')) {
      this.toggleAttribute('data-invalid', this.touched && !this.internals.validity.valid);
    }
    this.suppressControlBlur = false;
  }

  private commitValue(next: string): void {
    const inCatalog = this.normalizedCatalog.some((e) => e.id === next);
    this.value = next;
    this.hide();
    this.emit('lr-change', { value: next, inCatalog });
    this.emitValueEvents();
  }

  /** Dispatches the platform-style value-event pair alongside `lr-change`,
   * mirroring `<lr-select>`/`<lr-combobox>` so native form bindings and
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
    if (this.suppressControlBlur) return;
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
    // Bubbling, composed re-dispatch of the native (non-bubbling,
    // non-composed) input focus -- so a host-level listener on
    // <lr-model-select> can observe it across the shadow boundary.
    this.emit('focus');
  };
  private onInput = (e: Event): void => {
    this.query = (e.target as HTMLInputElement).value;
    this.activeIndex = -1;
    this.show();
  };
  private onInputBlur = (): void => {
    if (this.suppressControlBlur) return;
    this.touched = true;
    this.hide();
    // Same re-dispatch reasoning as onInputFocus above.
    this.emit('blur');
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
  // + a data-value lookup, mirroring lr-select/lr-combobox.
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
          ? html`<div part="empty" role="option" aria-selected="false" aria-disabled="true">${emptyText}</div>`
          : this.renderRows(rows, activeId)}
      </div>
    `;
  }

  private onHintSlotChange = (e: Event): void => {
    this.hasHintSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onErrorSlotChange = (e: Event): void => {
    this.hasErrorSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  /** `part="form-control-label"` — see `label`'s doc comment for its precedence over `aria-label`. */
  private renderLabel(): TemplateResult {
    return html`<label part="form-control-label" for=${this.controlId} ?hidden=${!this.label}>${this.label}</label>`;
  }

  /** `part="hint"`/`part="error"` — mirrors `lr-select`'s identical hint/error chrome, rendered
   *  identically in both closed-dropdown and free-text mode. */
  private renderHintError(hasError: boolean, hasHint: boolean): TemplateResult {
    return html`
      <div id="model-select-error" part="error" ?hidden=${!hasError}>
        ${this.errorText}<slot name="error" @slotchange=${this.onErrorSlotChange}></slot>
      </div>
      <div id="model-select-hint" part="hint" ?hidden=${!hasHint}>
        ${this.hint}<slot name="hint" @slotchange=${this.onHintSlotChange}></slot>
      </div>
    `;
  }

  private renderClosed(): TemplateResult {
    const rows = this.effectiveEntries;
    const activeId = this.activeIndex >= 0 && rows[this.activeIndex] ? `${this.listId}-opt-${this.activeIndex}` : '';
    const hasValue = this._value.length > 0;
    const hasLabel = this.label.length > 0;
    const hasHint = this.hasHintSlot || this.hint.length > 0;
    const hasError = this.hasErrorSlot || this.errorText.length > 0;
    const describedBy = [hasError ? 'model-select-error' : '', hasHint ? 'model-select-hint' : '']
      .filter(Boolean)
      .join(' ');
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
        aria-describedby=${describedBy || nothing}
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
      ${this.renderHintError(hasError, hasHint)}
    `;
  }

  private renderFreeText(): TemplateResult {
    const rows = this.filteredEntries;
    const activeId = this.activeIndex >= 0 && rows[this.activeIndex] ? `${this.listId}-opt-${this.activeIndex}` : '';
    const hasLabel = this.label.length > 0;
    const hasHint = this.hasHintSlot || this.hint.length > 0;
    const hasError = this.hasErrorSlot || this.errorText.length > 0;
    const describedBy = [hasError ? 'model-select-error' : '', hasHint ? 'model-select-hint' : '']
      .filter(Boolean)
      .join(' ');
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
          aria-describedby=${describedBy || nothing}
          aria-required=${this.required ? 'true' : 'false'}
          aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'}
          autocomplete=${this.autocomplete || nothing}
          spellcheck=${this.spellcheck}
          autocapitalize=${this.autocapitalize || nothing}
          autocorrect=${this.autoCorrect || nothing}
          inputmode=${this.inputMode || nothing}
          enterkeyhint=${this.enterKeyHint || nothing}
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
      ${this.renderHintError(hasError, hasHint)}
    `;
  }

  render(): TemplateResult {
    return this.closedMode ? this.renderClosed() : this.renderFreeText();
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-model-select': LyraModelSelect;
  }
}
