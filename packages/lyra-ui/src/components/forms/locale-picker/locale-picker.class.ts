import { html, nothing, type TemplateResult, type PropertyValues, type ComplexAttributeConverter } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { place } from '../../../internal/positioner.js';
import { nextId } from '../../../internal/a11y.js';
import { chevronIcon } from '../../../internal/icons.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import {
  getRegisteredLyraLocales,
  subscribeLyraLocaleRegistry,
  setLyraLocale,
} from '../../../internal/localization.js';
import { localeNativeName } from '../../media/flag/language-map.js';
import { styles } from './locale-picker.styles.js';

/** `true`-defaulting boolean attribute converter -- Lit's default presence-based `type: Boolean`
 *  can never be set back to `false` from a plain-HTML attribute once a property's own default is
 *  `true` (removing an attribute that was never present fires no `attributeChangedCallback`), so
 *  `fromAttribute` checks the literal string instead. Duplicated locally rather than imported,
 *  matching this exact converter's repeated per-component convention elsewhere in this library.
 *  `showFlags` (the only property using this converter) doesn't set `reflect: true`, so there's
 *  no `toAttribute` half -- Lit only calls it when reflecting. */
const trueDefaultBooleanConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute(value): boolean {
    return value !== 'false';
  },
};

/** A no-op stand-in for `ElementInternals`, used only when the host environment has no real
 *  implementation of it (e.g. a downstream consumer's Vitest + happy-dom test suite) --
 *  `attachInternals()` is browser-only, and calling it unconditionally in the constructor would
 *  otherwise throw before any test assertion runs, merely from constructing or importing this
 *  component. Same fix as `<lr-select>`'s/`<lr-model-select>`'s identical
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

/** One offered locale row. `label` overrides the derived `localeNativeName(tag)` endonym when
 *  given -- e.g. offering a locale before its strings are registered ("Français (bientôt)").
 *  `country` overrides the row's derived flag country when given -- e.g. showing Lebanon's flag
 *  for an `'ar'` row instead of the library's default Saudi Arabia mapping. */
export interface LyraLocaleEntry {
  /** BCP-47 locale tag, e.g. `'pt-BR'`. */
  tag: string;
  /** Overrides `localeNativeName(tag)` when given. */
  label?: string;
  /** ISO 3166-1 alpha-2 country code (e.g. `'lb'`) overriding this row's `<lr-flag>` derivation
   *  -- when given, the row renders `<lr-flag country={country}>` instead of the default
   *  `<lr-flag language={tag}>`. Unset (the default) keeps today's tag-derived flag. Ignored
   *  while `showFlags` is `false`. */
  country?: string;
}

/** `locales` accepts either a plain array of BCP-47 tags (endonym label derived automatically,
 *  no per-row flag override available) or `{ tag, label, country }` rows for custom
 *  labels/ordering/subsets/flag overrides. */
export type LyraLocaleCatalog = string[] | LyraLocaleEntry[];

interface NormalizedLocaleEntry {
  tag: string;
  label: string;
  country?: string;
}

/** Visual size, same `2xs`–`xl` scale as `<lr-select>`'s `size`. */
export type LyraLocalePickerSize = '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl';

export interface LyraLocalePickerEventMap {
  'lr-change': CustomEvent<{ value: string; previousValue: string }>;
  blur: CustomEvent<undefined>;
  focus: CustomEvent<undefined>;
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
 * Built directly on the shared trigger-button/`aria-activedescendant` listbox technique
 * `<lr-select>` uses (not composed from it) — a plain closed list, no filter/free-text mode; a
 * locale catalog is realistically dozens of rows, not thousands, so `<lr-combobox>`'s filterable
 * model would be more surface than the job needs.
 *
 * Selecting a row sets `value` and emits a cancelable `lr-change` — if a listener doesn't call
 * `event.preventDefault()`, the component applies the pick itself via `setLyraLocale()`. A host
 * that wants to intercept the pick (e.g. persist it to a profile first) calls
 * `event.preventDefault()`; `value` still updates so the trigger reflects the pick, but the
 * page-level locale is untouched until the host calls `setLyraLocale()` itself.
 *
 * Does not touch `document.documentElement.lang`/`dir` — applying a picked locale's writing
 * direction to the page is left to the host, which already has everything it needs from
 * `lr-change`'s `value` to do that itself.
 *
 * @customElement lr-locale-picker
 * @event lr-change - The selection changed. `detail: { value, previousValue }`. Cancelable —
 *   `event.preventDefault()` stops the automatic `setLyraLocale()` call without reverting `value`.
 * @event blur - Re-dispatched from the internal trigger button as a bubbling, composed event.
 * @event focus - Re-dispatched from the internal trigger button as a bubbling, composed event.
 * @slot label - Custom label content.
 * @slot hint - Custom hint content.
 * @slot error - Custom error content.
 * @csspart form-control - The outer wrapper around label, trigger, listbox, error and hint.
 * @csspart form-control-label - The `<label>` element (only rendered — and only contributes to
 *   the accessible name — once `label` is non-empty).
 * @csspart trigger - The trigger button (positioning anchor).
 * @csspart listbox - The options popover.
 * @csspart option - An option row.
 * @csspart option-flag - The row's leading `<lr-flag>` (present only while `showFlags` is on).
 * @csspart option-label - An option row's label wrapper (native name + tag).
 * @csspart option-tag - An option row's secondary line — the raw BCP-47 tag.
 * @csspart expand-icon - The dropdown indicator.
 * @csspart hint - The hint message.
 * @csspart error - The error message.
 * @cssprop --lr-locale-picker-trigger-padding - Trigger padding shorthand, scaled by `size`.
 * @cssprop --lr-locale-picker-trigger-min-height - Trigger block-size floor, scaled by `size`.
 * @cssprop --lr-locale-picker-trigger-height - Exact trigger height. Unset by default (a floor
 *   only via `-trigger-min-height`); set a length to both floor and cap the trigger, e.g. to
 *   pixel-match a sibling field in the same toolbar row.
 * @cssprop --lr-locale-picker-font-size - Trigger font size, scaled by `size`.
 * @cssprop --lr-locale-picker-expand-size - Decorative expand-icon box size, scaled by `size`.
 * @cssprop [--lr-locale-picker-option-active-bg=var(--lr-color-brand-quiet)] - Background of a
 *   hovered or keyboard-active option row.
 */
export class LyraLocalePicker extends LyraElement<LyraLocalePickerEventMap> {
  static formAssociated = true;
  static override styles = [LyraElement.styles, styles];

  static override properties = {
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    required: { type: Boolean, reflect: true, noAccessor: true },
    value: { noAccessor: true },
    name: { reflect: true, noAccessor: true },
  };

  /** The offered locale list. Empty (the default) auto-discovers every locale registered via
   *  `registerLyraLocale()` (plus `'en'`) through `getRegisteredLyraLocales()`, kept live via
   *  `subscribeLyraLocaleRegistry()`. An explicit array overrides the auto-discovered list
   *  entirely. */
  @property({ attribute: false }) locales: LyraLocaleCatalog = [];

  /** Each row's leading `<lr-flag>`. The composition recipe this component supersedes
   *  (`lr-popover` + `lr-flag`) already pairs a locale switcher with flags by convention --
   *  defaulting to `true` keeps that continuity; set `false` for text-only rows. */
  @property({ attribute: 'show-flags', type: Boolean, converter: trueDefaultBooleanConverter }) showFlags = true;

  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  @property({ type: Boolean, reflect: true }) open = false;
  /** Visual size — same `2xs`–`xl` scale as `lr-select`'s `size`. */
  @property({ reflect: true }) size: LyraLocalePickerSize = 'm';

  @state() private activeIndex = -1;
  @state() private touched = false;
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;
  @state() private hasLabelSlot = false;
  // Bumped by subscribeLyraLocaleRegistry() -- its own state-property change is what triggers a
  // re-render; normalizedEntries always recomputes fresh from getRegisteredLyraLocales(), so
  // nothing in its body needs to read this field.
  @state() private registryTick = 0;
  @query('[part="trigger"]') private triggerElement?: HTMLButtonElement;

  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  private listId = nextId('locale-picker-list');
  private controlId = nextId('locale-picker-control');
  private cleanup?: () => void;
  private stopRegistrySubscription?: () => void;
  private _value = '';
  private _fieldsetDisabled = false;
  private _name = '';
  private _disabled = false;
  private _required = false;
  private _defaultValue = '';
  // Standard listbox type-ahead: printable keystrokes accumulate into this buffer and reset
  // ~500ms after the last one, matching lr-select's identical buffer/timer pair.
  private typeAheadBuffer = '';
  private typeAheadTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    super();
    this.internals = createInternalsSafely(this);
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
    this.internals.setFormValue('');
  }

  /** Focus the internal trigger. */
  override focus(options?: FocusOptions): void {
    this.triggerElement?.focus(options);
  }
  /** Blur the internal trigger. */
  override blur(): void {
    this.triggerElement?.blur();
  }
  /** Activates the internal trigger -- `HTMLElement.prototype.click()` on a custom element with
   *  no native click semantics is otherwise a silent no-op. Mirrors `<lr-select>`'s identical
   *  `click()`. */
  override click(): void {
    this.triggerElement?.click();
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
    return this.renderRoot?.querySelector('[part="trigger"]') ?? null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.updateValidity();
    this.stopRegistrySubscription = subscribeLyraLocaleRegistry(() => {
      this.registryTick += 1;
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanup?.();
    this.cleanup = undefined;
    this.ownerDocument.removeEventListener('pointerdown', this.onDocPointer);
    this.stopRegistrySubscription?.();
    this.stopRegistrySubscription = undefined;
    clearTimeout(this.typeAheadTimer);
    // Reset so a reconnect (e.g. a drag-drop reparent) re-triggers updated()'s open-driven
    // branch -- without this, `open` stays `true` across the disconnect/reconnect and
    // `changed.has('open')` never fires again, leaving the listbox rendered open with no
    // positioning and no outside-click listener.
    this.open = false;
  }

  override attributeChangedCallback(name: string, old: string | null, val: string | null): void {
    super.attributeChangedCallback(name, old, val);
    if (name === 'value') this._defaultValue = this._value;
  }

  protected override willUpdate(): void {
    if (!this.hasUpdated) {
      this.hasHintSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'hint');
      this.hasErrorSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'error');
      this.hasLabelSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'label');
    }
  }

  /** The current locale tag (empty string when nothing is committed). */
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
      this.validityController.setValidity({ valueMissing: true }, this.localize('localePickerRequired'));
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

  /** `locales` normalized to `{ tag, label }[]`: an explicit non-empty catalog wins outright
   *  (in either the `string[]` or `{tag,label}[]` form); otherwise every locale
   *  `getRegisteredLyraLocales()` currently reports. */
  private get normalizedEntries(): NormalizedLocaleEntry[] {
    const raw = this.locales;
    if (raw && raw.length > 0) {
      return raw.map((entry): NormalizedLocaleEntry =>
        typeof entry === 'string'
          ? { tag: entry, label: localeNativeName(entry) }
          : { tag: entry.tag, label: entry.label ?? localeNativeName(entry.tag), country: entry.country },
      );
    }
    return getRegisteredLyraLocales().map((tag) => ({ tag, label: localeNativeName(tag) }));
  }

  /** The tag actually shown in the trigger: the committed `value` once set, else a live preview
   *  of `effectiveLocale` -- never a committed selection, see the class doc's value/preview
   *  split. */
  private get previewTag(): string {
    return this._value || this.effectiveLocale;
  }

  private labelFor(tag: string): string {
    return this.normalizedEntries.find((e) => e.tag === tag)?.label ?? localeNativeName(tag);
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

  protected override updated(changed: PropertyValues): void {
    const reposition =
      changed.has('open') || (this.open && (changed.has('locales') || changed.has('registryTick')));
    if (reposition) {
      this.cleanup?.();
      this.cleanup = undefined;
      if (this.open) {
        this.ownerDocument.addEventListener('pointerdown', this.onDocPointer);
        const anchor = this.renderRoot.querySelector('[part="trigger"]') as HTMLElement | null;
        const listbox = this.renderRoot.querySelector('[part="listbox"]') as HTMLElement | null;
        if (anchor && listbox) this.cleanup = place(anchor, listbox);
      } else {
        this.ownerDocument.removeEventListener('pointerdown', this.onDocPointer);
      }
    }
    if (changed.has('touched') || changed.has('required') || changed.has('value')) {
      this.toggleAttribute('data-invalid', this.touched && !this.internals.validity.valid);
    }
  }

  /** Commits `tag`: sets `value`, closes the popup, then emits a cancelable `lr-change` --
   *  applying `setLyraLocale(tag)` itself only when the listener doesn't veto it. Unconditional
   *  on every explicit pick (no reselect-guard), mirroring `<lr-model-select>`'s identical
   *  `commitValue()` -- the closest sibling precedent for this event shape. */
  private commit(tag: string): void {
    const previousValue = this._value;
    this.value = tag;
    this.hide();
    const event = this.emit<{ value: string; previousValue: string }>(
      'lr-change',
      { value: tag, previousValue },
      { cancelable: true },
    );
    if (!event.defaultPrevented) setLyraLocale(tag);
  }

  private onTriggerClick = (): void => {
    if (this.effectiveDisabled) return;
    this.open ? this.hide() : this.show();
  };
  private onTriggerBlur = (event: FocusEvent): void => {
    event.stopPropagation();
    this.touched = true;
    this.hide();
    this.emit('blur');
  };
  private onTriggerFocus = (event: FocusEvent): void => {
    event.stopPropagation();
    this.emit('focus');
  };

  private onLabelSlotChange = (e: Event): void => {
    this.hasLabelSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };
  private onHintSlotChange = (e: Event): void => {
    this.hasHintSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };
  private onErrorSlotChange = (e: Event): void => {
    this.hasErrorSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  /** Standard listbox type-ahead: moves to the next row whose native name starts with the
   *  accumulated buffer, cycling from just after the "current" row (the active row while open,
   *  the preview tag while closed). While open this only moves `activeIndex` (a highlight,
   *  matching Arrow-key nav); while closed it commits immediately, matching `<lr-select>`'s
   *  identical closed-state type-ahead. */
  private typeAhead(char: string): void {
    clearTimeout(this.typeAheadTimer);
    this.typeAheadBuffer += char.toLocaleLowerCase(this.effectiveLocale);
    this.typeAheadTimer = setTimeout(() => {
      this.typeAheadBuffer = '';
    }, 500);

    const rows = this.normalizedEntries;
    if (!rows.length) return;
    const currentTag = this.open ? rows[this.activeIndex]?.tag : this.previewTag;
    const currentIndex = rows.findIndex((r) => r.tag === currentTag);
    const n = rows.length;
    for (let step = 1; step <= n; step++) {
      const idx = (currentIndex + step + n) % n;
      if (rows[idx].label.toLocaleLowerCase(this.effectiveLocale).startsWith(this.typeAheadBuffer)) {
        if (this.open) {
          this.activeIndex = idx;
        } else {
          this.commit(rows[idx].tag);
        }
        return;
      }
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const rows = this.normalizedEntries;
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
        // When closed, let the button's native Enter/Space activation fire its own click handler
        // (onTriggerClick) to open -- only intercept here to commit/dismiss while already open.
        if (this.open) {
          e.preventDefault();
          if (this.activeIndex >= 0 && rows[this.activeIndex]) {
            this.commit(rows[this.activeIndex].tag);
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
      default:
        if (e.key.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey) {
          this.typeAhead(e.key);
        }
        break;
    }
  };

  // Delegated onto [part="listbox"] rather than one closure pair allocated per row per render --
  // resolves the target row via closest('[part="option"]') + a data-value lookup, mirroring
  // lr-select/lr-model-select.
  private onListboxMouseDown = (e: MouseEvent): void => {
    if ((e.target as HTMLElement).closest('[part="option"]')) e.preventDefault();
  };
  private onListboxClick = (e: MouseEvent): void => {
    if (this.effectiveDisabled) return;
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
        ${this.showFlags
          ? entry.country
            ? html`<lr-flag part="option-flag" country=${entry.country} variant="compact" aria-hidden="true"></lr-flag>`
            : html`<lr-flag part="option-flag" language=${entry.tag} variant="compact" aria-hidden="true"></lr-flag>`
          : ''}
        <span part="option-label">
          <span>${entry.label}</span>
          <span part="option-tag">${entry.tag}</span>
        </span>
      </div>`;
    });
  }

  override render(): TemplateResult {
    const rows = this.normalizedEntries;
    const activeId = this.activeIndex >= 0 && rows[this.activeIndex] ? `${this.listId}-opt-${this.activeIndex}` : '';
    const hasLabel = this.hasLabelSlot || this.label.length > 0;
    const hasHint = this.hasHintSlot || this.hint.length > 0;
    const hasError = this.hasErrorSlot || this.errorText.length > 0;
    const describedBy = [hasError ? 'locale-picker-error' : '', hasHint ? 'locale-picker-hint' : '']
      .filter(Boolean)
      .join(' ');
    return html`
      <div part="form-control">
        <label part="form-control-label" for=${this.controlId} ?hidden=${!hasLabel}>
          ${this.label}<slot name="label" @slotchange=${this.onLabelSlotChange}></slot>
        </label>
        <button
          id=${this.controlId}
          part="trigger"
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded=${this.open ? 'true' : 'false'}
          aria-controls=${this.listId}
          aria-activedescendant=${activeId}
          aria-label=${this.getAttribute('aria-label') || (hasLabel ? nothing : this.localize('localePickerLabel'))}
          aria-describedby=${describedBy || nothing}
          aria-required=${this.required ? 'true' : 'false'}
          aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'}
          ?disabled=${this.effectiveDisabled}
          @click=${this.onTriggerClick}
          @keydown=${this.onKeyDown}
          @focus=${this.onTriggerFocus}
          @blur=${this.onTriggerBlur}
        >
          <span class="trigger-label">${this.labelFor(this.previewTag)}</span>
          <span part="expand-icon" aria-hidden="true">${chevronIcon()}</span>
        </button>
        <div
          part="listbox"
          id=${this.listId}
          role="listbox"
          @mousedown=${this.onListboxMouseDown}
          @click=${this.onListboxClick}
        >
          ${this.renderRows(rows, activeId)}
        </div>
        <div id="locale-picker-error" part="error" ?hidden=${!hasError}>
          ${this.errorText}<slot name="error" @slotchange=${this.onErrorSlotChange}></slot>
        </div>
        <div id="locale-picker-hint" part="hint" ?hidden=${!hasHint}>
          ${this.hint}<slot name="hint" @slotchange=${this.onHintSlotChange}></slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-locale-picker': LyraLocalePicker;
  }
}
