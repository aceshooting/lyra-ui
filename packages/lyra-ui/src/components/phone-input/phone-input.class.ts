import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { nextId } from '../../internal/a11y.js';
import { SET_ANCHORED_VALIDITY, VALIDITY_ANCHOR } from '../../internal/anchored-validity.js';
import { FormAssociated } from '../../internal/form-associated.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './phone-input.styles.js';

export type PhoneNumberStatus = 'empty' | 'incomplete' | 'invalid' | 'valid';

export interface PhoneCountry {
  /** ISO 3166-1 alpha-2 region code. */
  code: string;
  /** International calling code without a leading plus sign. */
  callingCode: string;
  /** Optional display-name override. `Intl.DisplayNames` is used when omitted. */
  label?: string;
}

export interface PhoneNumberParseResult {
  status: PhoneNumberStatus;
  /** Canonical E.164 value. Required when `status` is `valid`. */
  e164?: string;
  /** Best-effort display text, normally national formatting for the selected country. */
  formatted?: string;
  /** Detected ISO 3166-1 alpha-2 region code. */
  country?: string;
}

/**
 * Synchronous formatting seam for a numbering-plan implementation. The base
 * component deliberately includes no country metadata. An adapter can be
 * supplied directly, or created lazily with `loadLibphonenumberAdapter()`.
 */
export interface PhoneNumberAdapter {
  readonly countries?: readonly PhoneCountry[];
  parse(input: string, country?: string): PhoneNumberParseResult;
}

interface LibphonenumberPhoneLike {
  number: string;
  country?: string;
  isValid(): boolean;
  isPossible(): boolean;
  formatNational(): string;
  formatInternational(): string;
}

/** Structural subset implemented by `libphonenumber-js` entry points. */
export interface LibphonenumberModuleLike<CountryCode extends string = string> {
  getCountries(): CountryCode[];
  getCountryCallingCode(country: CountryCode): string;
  parsePhoneNumberFromString(
    input: string,
    defaultCountry?: CountryCode,
  ): LibphonenumberPhoneLike | undefined;
  validatePhoneNumberLength?(input: string, defaultCountry?: CountryCode): string | undefined;
}

/**
 * Lazily creates an adapter from a `libphonenumber-js`-compatible module.
 * Keeping the loader consumer-supplied avoids a static import, so neither the
 * dependency nor its numbering metadata enters Lyra's base bundle.
 *
 * @example
 * `el.adapter = await loadLibphonenumberAdapter(() => import('libphonenumber-js/min'))`
 */
export async function loadLibphonenumberAdapter<CountryCode extends string>(
  loader: () => Promise<LibphonenumberModuleLike<CountryCode>>,
): Promise<PhoneNumberAdapter> {
  const module = await loader();
  const countries = module.getCountries().map((code) => ({
    code: normalizeCountry(code),
    callingCode: module.getCountryCallingCode(code),
  }));

  return {
    countries,
    parse(input, country) {
      const raw = input.trim();
      if (!raw) return { status: 'empty' };
      const normalizedCountry = country ? normalizeCountry(country) as CountryCode : undefined;
      const phone = module.parsePhoneNumberFromString(raw, normalizedCountry);
      if (!phone) {
        const length = module.validatePhoneNumberLength?.(raw, normalizedCountry);
        return {
          status: length === 'TOO_SHORT' || isDialLike(raw) ? 'incomplete' : 'invalid',
          formatted: raw,
        };
      }

      const formatted = raw.startsWith('+') ? phone.formatInternational() : phone.formatNational();
      if (phone.isValid()) {
        return {
          status: 'valid',
          e164: phone.number,
          formatted,
          country: phone.country ? normalizeCountry(phone.country) : normalizedCountry,
        };
      }

      const length = module.validatePhoneNumberLength?.(raw, normalizedCountry);
      return {
        status: length === 'TOO_SHORT' || (!length && !phone.isPossible()) ? 'incomplete' : 'invalid',
        formatted,
        country: phone.country ? normalizeCountry(phone.country) : normalizedCountry,
      };
    },
  };
}

export interface LyraPhoneInputEventDetail {
  /** Canonical E.164 value, or an empty string until the current input is valid. */
  value: string;
  /** The editable, best-effort formatted text shown to the user. */
  inputValue: string;
  country: string;
  valid: boolean;
  status: PhoneNumberStatus;
}

export interface LyraPhoneInputEventMap {
  input: CustomEvent<LyraPhoneInputEventDetail>;
  change: CustomEvent<LyraPhoneInputEventDetail>;
  focus: CustomEvent<undefined>;
  blur: CustomEvent<undefined>;
}

class LyraPhoneInputBase extends LyraElement<LyraPhoneInputEventMap> {}

const E164_RE = /^\+[1-9]\d{1,14}$/;
const DIAL_LIKE_RE = /^[+\d\s().-]+$/;

function normalizeCountry(country: string): string {
  return country.trim().toUpperCase();
}

function isDialLike(value: string): boolean {
  return DIAL_LIKE_RE.test(value.trim());
}

function fallbackParse(input: string): PhoneNumberParseResult {
  const raw = input.trim();
  if (!raw) return { status: 'empty' };
  const compact = raw.replace(/[\s().-]/g, '');
  if (E164_RE.test(compact)) return { status: 'valid', e164: compact, formatted: raw };
  if (isDialLike(raw)) return { status: 'incomplete', formatted: raw };
  return { status: 'invalid', formatted: raw };
}

/**
 * `<lyra-phone-input>` — a country-aware telephone field whose form value is
 * canonical E.164. National formatting and numbering-plan validation are
 * supplied through `adapter`; without one, already-international E.164 input
 * remains useful and national input stays editable with `incomplete` validity.
 *
 * User edits emit native-style `input` and `change` events. Event detail
 * exposes both the canonical `value` and editable `inputValue`; programmatic
 * property changes are silent. Phone-number text is deliberately LTR while
 * the form chrome and country selector follow the inherited direction.
 *
 * @customElement lyra-phone-input
 * @slot label - Custom label content.
 * @slot hint - Custom hint content.
 * @slot error - Custom error content.
 * @slot country-prefix - Optional visual displayed before the country selector, such as a flag.
 * @event input - Fired for user edits and country changes; detail contains canonical and display values.
 * @event change - Fired when the native input commits or the country changes.
 * @event focus - Fired when the internal telephone input receives focus.
 * @event blur - Fired when the internal telephone input loses focus.
 * @csspart form-control - The outer form-control wrapper.
 * @csspart form-control-label - The visible label.
 * @csspart input-wrapper - The country selector and telephone input wrapper.
 * @csspart country-prefix - Optional country adornment slot wrapper.
 * @csspart country-select - The native country selector.
 * @csspart calling-code - The selected country's calling code.
 * @csspart input - The native telephone input.
 * @csspart hint - The hint message.
 * @csspart error - The error or validation message.
 */
export class LyraPhoneInput extends FormAssociated(LyraPhoneInputBase) {
  static styles = [LyraElement.styles, styles];
  static properties = {
    country: { noAccessor: true },
  };

  /** Formatting and validation implementation. No metadata is bundled by default. */
  @property({ attribute: false }) adapter?: PhoneNumberAdapter;
  /** Explicit country rows. Takes precedence over `adapter.countries`. */
  @property({ attribute: false }) countries: readonly PhoneCountry[] = [];
  /** Country selected when no explicit `country` has been set. */
  @property({ attribute: 'default-country' }) defaultCountry = '';
  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  @property() placeholder = '';
  @property({ attribute: 'aria-label' }) private accessibleLabel: string | null = null;
  /** Accessible name for the country selector. */
  @property({ attribute: 'country-label' }) countryLabel = 'Select';
  /** Accessible-name override for the telephone input. */
  @property({ attribute: 'phone-label' }) phoneLabel = '';
  /** Validation message for a number that may still become valid with more digits. */
  @property({ attribute: 'incomplete-text' }) incompleteText = 'The value is invalid.';
  /** Validation message for a completed but invalid number. */
  @property({ attribute: 'invalid-text' }) invalidText = 'The value is invalid.';
  @property() autocomplete = 'tel';
  @property() inputmode: 'tel' | 'numeric' | 'text' = 'tel';
  @property() enterkeyhint = '';

  @query('input[part="input"]') private inputElement?: HTMLInputElement;
  @state() private editableValue = '';
  @state() private status: PhoneNumberStatus = 'empty';
  @state() private touched = false;
  @state() private hasLabelSlot = false;
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;
  @state() private hasCountryPrefixSlot = false;

  private inputId = nextId('phone-input');
  private hintId = nextId('phone-hint');
  private errorId = nextId('phone-error');
  private explicitCountry = '';

  /** Currently selected ISO 3166-1 alpha-2 country code. */
  get country(): string {
    const firstCountry = this.countries[0]?.code ?? this.adapter?.countries?.[0]?.code ?? '';
    return normalizeCountry(this.explicitCountry || this.defaultCountry || firstCountry);
  }

  set country(next: string) {
    const old = this.country;
    this.explicitCountry = normalizeCountry(next ?? '');
    this.requestUpdate('country', old);
  }

  /** The underlying telephone input for platform-specific integrations. */
  get input(): HTMLInputElement | undefined {
    return this.inputElement;
  }

  /** Editable display text, including a partial or invalid number. */
  get inputValue(): string {
    return this.editableValue;
  }

  /** Current parse/validation state. */
  get phoneStatus(): PhoneNumberStatus {
    return this.status;
  }

  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | null {
    return this.inputElement ?? null;
  }

  get value(): string {
    return super.value;
  }

  set value(next: string) {
    const raw = next ?? '';
    const parsed = this.parse(raw);
    this.applyParsed(raw, parsed);
  }

  private get selectedCountry(): string {
    return this.country;
  }

  private get availableCountries(): PhoneCountry[] {
    const source = this.countries.length ? this.countries : (this.adapter?.countries ?? []);
    const seen = new Set<string>();
    const rows: PhoneCountry[] = [];
    for (const item of source) {
      const code = normalizeCountry(item.code);
      if (!/^[A-Z]{2}$/.test(code) || seen.has(code)) continue;
      seen.add(code);
      rows.push({ ...item, code, callingCode: item.callingCode.replace(/^\+/, '') });
    }
    if (rows.length === 0 && this.selectedCountry) {
      rows.push({ code: this.selectedCountry, callingCode: '' });
    }
    return rows;
  }

  private parse(input: string): PhoneNumberParseResult {
    if (!this.adapter) return fallbackParse(input);
    try {
      const parsed = this.adapter.parse(input, this.selectedCountry || undefined);
      if (parsed.status === 'valid' && (!parsed.e164 || !E164_RE.test(parsed.e164))) {
        return { status: 'invalid', formatted: parsed.formatted ?? input, country: parsed.country };
      }
      return parsed;
    } catch {
      return fallbackParse(input);
    }
  }

  private applyParsed(raw: string, parsed: PhoneNumberParseResult): void {
    this.editableValue = parsed.formatted ?? raw;
    this.status = parsed.status;
    if (parsed.country) this.country = normalizeCountry(parsed.country);
    super.value = parsed.status === 'valid' ? parsed.e164! : '';
    this.setAttribute('data-phone-status', parsed.status);
  }

  private get eventDetail(): LyraPhoneInputEventDetail {
    return {
      value: super.value,
      inputValue: this.editableValue,
      country: this.selectedCountry,
      valid: this.internals.validity.valid,
      status: this.status,
    };
  }

  private get effectiveCountryLabel(): string {
    return this.localize('select', this.countryLabel === 'Select' ? undefined : this.countryLabel);
  }

  private get effectivePhoneLabel(): string | undefined {
    return this.phoneLabel || this.accessibleLabel || this.label || this.placeholder || undefined;
  }

  private get incompleteMessage(): string {
    return this.localize(
      'valueInvalid',
      this.incompleteText === 'The value is invalid.' ? undefined : this.incompleteText,
    );
  }

  private get invalidMessage(): string {
    return this.localize(
      'valueInvalid',
      this.invalidText === 'The value is invalid.' ? undefined : this.invalidText,
    );
  }

  private countryName(row: PhoneCountry): string {
    if (row.label) return row.label;
    try {
      return new Intl.DisplayNames([this.effectiveLocale], { type: 'region' }).of(row.code) ?? row.code;
    } catch {
      return row.code;
    }
  }

  protected updateValidity(): void {
    const flags: ValidityStateFlags = {};
    let message = '';
    if (this.required && this.status === 'empty') {
      flags.valueMissing = true;
      message = this.localize('fieldRequired');
    } else if (this.status === 'incomplete') {
      flags.badInput = true;
      message = this.incompleteMessage;
    } else if (this.status === 'invalid') {
      flags.typeMismatch = true;
      message = this.invalidMessage;
    }
    this[SET_ANCHORED_VALIDITY](flags, message);
  }

  protected willUpdate(changed: PropertyValues): void {
    if (!this.hasUpdated) {
      this.hasLabelSlot = Array.from(this.children).some((child) => child.getAttribute('slot') === 'label');
      this.hasHintSlot = Array.from(this.children).some((child) => child.getAttribute('slot') === 'hint');
      this.hasErrorSlot = Array.from(this.children).some((child) => child.getAttribute('slot') === 'error');
      this.hasCountryPrefixSlot = Array.from(this.children).some(
        (child) => child.getAttribute('slot') === 'country-prefix',
      );
    }
    if (
      (changed.has('adapter') || changed.has('country') || changed.has('defaultCountry')) &&
      this.editableValue
    ) {
      this.applyParsed(this.editableValue, this.parse(this.editableValue));
    }
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (
      changed.has('touched') ||
      changed.has('required') ||
      changed.has('value') ||
      changed.has('status')
    ) {
      const invalid = this.touched && !this.internals.validity.valid;
      this.toggleAttribute('data-invalid', invalid);
      if (invalid) this.setAttribute('aria-invalid', 'true');
      else this.removeAttribute('aria-invalid');
    }
  }

  private onInput = (event: Event): void => {
    event.stopPropagation();
    const input = event.currentTarget as HTMLInputElement;
    this.applyParsed(input.value, this.parse(input.value));
    input.value = this.editableValue;
    this.emit('input', this.eventDetail);
  };

  private onChange = (event: Event): void => {
    event.stopPropagation();
    this.touched = true;
    this.emit('change', this.eventDetail);
  };

  private onCountryChange = (event: Event): void => {
    event.stopPropagation();
    this.country = normalizeCountry((event.currentTarget as HTMLSelectElement).value);
    this.applyParsed(this.editableValue, this.parse(this.editableValue));
    this.emit('input', this.eventDetail);
    this.emit('change', this.eventDetail);
  };

  private onFocus = (event: FocusEvent): void => {
    event.stopPropagation();
    this.emit('focus');
  };

  private onBlur = (event: FocusEvent): void => {
    event.stopPropagation();
    this.touched = true;
    this.emit('blur');
  };

  private onLabelSlotChange = (event: Event): void => {
    this.hasLabelSlot = (event.currentTarget as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onHintSlotChange = (event: Event): void => {
    this.hasHintSlot = (event.currentTarget as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onErrorSlotChange = (event: Event): void => {
    this.hasErrorSlot = (event.currentTarget as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onCountryPrefixSlotChange = (event: Event): void => {
    this.hasCountryPrefixSlot =
      (event.currentTarget as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  /** Focus the internal telephone input. */
  override focus(options?: FocusOptions): void {
    this.inputElement?.focus(options);
  }

  /** Blur the internal telephone input. */
  override blur(): void {
    this.inputElement?.blur();
  }

  /** Select all editable telephone text. */
  select(): void {
    this.inputElement?.select();
  }

  formResetCallback(): void {
    this.country = normalizeCountry(this.defaultCountry || this.availableCountries[0]?.code || '');
    super.formResetCallback();
    this.touched = false;
  }

  render(): TemplateResult {
    const hasLabel = Boolean(this.label || this.hasLabelSlot);
    const validationError = this.touched ? this.validationMessage : '';
    const renderedError = this.errorText || validationError;
    const hasHint = Boolean(this.hint || this.hasHintSlot);
    const hasError = Boolean(renderedError || this.hasErrorSlot);
    const describedBy = [hasHint ? this.hintId : '', hasError ? this.errorId : ''].filter(Boolean).join(' ');
    const rows = this.availableCountries;
    const current = rows.find((row) => row.code === this.selectedCountry);

    return html`
      <div part="form-control">
        <label part="form-control-label" for=${this.inputId} ?hidden=${!hasLabel}>
          <slot name="label" @slotchange=${this.onLabelSlotChange}>${this.label}</slot>
        </label>
        <div part="input-wrapper">
          <span part="country-prefix" ?hidden=${!this.hasCountryPrefixSlot}>
            <slot name="country-prefix" @slotchange=${this.onCountryPrefixSlotChange}></slot>
          </span>
          <select
            part="country-select"
            aria-label=${this.effectiveCountryLabel}
            .value=${this.selectedCountry}
            ?disabled=${this.effectiveDisabled || rows.length === 0}
            @change=${this.onCountryChange}
          >
            ${rows.length === 0
              ? html`<option value="">${this.effectiveCountryLabel}</option>`
              : rows.map((row) => html`<option
                    value=${row.code}
                    ?selected=${row.code === this.selectedCountry}
                  >${this.countryName(row)}${row.callingCode ? ` (+${row.callingCode})` : ''}</option>`)}
          </select>
          ${current?.callingCode
            ? html`<span part="calling-code" aria-hidden="true">+${current.callingCode}</span>`
            : nothing}
          <input
            id=${this.inputId}
            part="input"
            type="tel"
            dir="ltr"
            .value=${this.editableValue}
            placeholder=${this.placeholder}
            autocomplete=${this.autocomplete}
            inputmode=${this.inputmode}
            enterkeyhint=${this.enterkeyhint || nothing}
            aria-label=${this.effectivePhoneLabel ?? nothing}
            aria-describedby=${describedBy || nothing}
            aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'}
            ?required=${this.required}
            ?disabled=${this.effectiveDisabled}
            @input=${this.onInput}
            @change=${this.onChange}
            @focus=${this.onFocus}
            @blur=${this.onBlur}
          />
        </div>
        <div id=${this.hintId} part="hint" ?hidden=${!hasHint}>
          <slot name="hint" @slotchange=${this.onHintSlotChange}>${this.hint}</slot>
        </div>
        <div id=${this.errorId} part="error" role="alert" ?hidden=${!hasError}>
          <slot name="error" @slotchange=${this.onErrorSlotChange}>${renderedError}</slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-phone-input': LyraPhoneInput;
  }
}
