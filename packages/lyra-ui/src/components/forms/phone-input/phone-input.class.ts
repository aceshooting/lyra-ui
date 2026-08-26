import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { nextId } from '../../../internal/a11y.js';
import { chevronIcon } from '../../../internal/icons.js';
import { SET_ANCHORED_VALIDITY, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { FormAssociated, isBarredFromValidation } from '../../../internal/form-associated.js';
import { getDisplayNames } from '../../../internal/intl-cache.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraSize } from '../../../internal/variants.js';
import type { LyraSelectionDirection } from '../../../internal/shared-unions.js';
import { styles } from './phone-input.styles.js';
import { submitOnEnter } from '../../../internal/submit-on-enter.js';
import {
  dispatchNativeInputEvent,
  relayNativeEvent,
} from '../../../internal/native-event-relay.js';
import {
  declaredDefaultConverter,
  trueDefaultSpellcheckConverter as spellcheckConverter } from '../../../internal/converters.js';
import { resolveOptionalPeerCapability } from '../../../internal/optional-peer-capabilities.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_phoneInputIncomplete, LYRA_DEFAULT_phoneInputLabel, LYRA_DEFAULT_select, LYRA_DEFAULT_valueInvalid } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type LyraPhoneNumberStatus =
  | 'empty' | 'incomplete' | 'invalid' | 'valid';
export type LyraPhoneInputSelectionDirection = LyraSelectionDirection;
export interface LyraPhoneCountry {
  /** ISO 3166-1 alpha-2 region code. */
  readonly code: string;
  /** International calling code without a leading plus sign. */
  readonly callingCode: string;
  /** Optional display-name override. `Intl.DisplayNames` is used when omitted. */
  readonly label?: string;
}

interface LyraPhoneNumberParseMetadata {
  /** Best-effort display text, normally national formatting for the selected country. */
  formatted?: string;
  /** Detected ISO 3166-1 alpha-2 region code. */
  country?: string;
}

/** Exhaustive adapter result. Only the `valid` branch can carry a canonical form value. */
export type LyraPhoneNumberParseResult =
  | ({ status: 'empty' } & LyraPhoneNumberParseMetadata)
  | ({ status: 'incomplete' } & LyraPhoneNumberParseMetadata)
  | ({ status: 'invalid' } & LyraPhoneNumberParseMetadata)
  | ({ status: 'valid'; e164: string } & LyraPhoneNumberParseMetadata);

/**
 * Synchronous formatting seam for a numbering-plan implementation. The base
 * component deliberately includes no country metadata. An adapter can be
 * supplied directly, or created lazily with `loadLibphonenumberAdapter()`.
 */
export interface LyraPhoneNumberAdapter {
  readonly countries?: readonly LyraPhoneCountry[];
  parse(input: string, country?: string): LyraPhoneNumberParseResult;
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

/** Narrows an unknown resolved peer value to the capability this loader actually calls. */
function isLibphonenumberModule(candidate: unknown): candidate is LibphonenumberModuleLike {
  const api = candidate as Partial<LibphonenumberModuleLike> | null;
  return (
    (typeof api === 'object' || typeof api === 'function') &&
    api !== null &&
    typeof api.getCountries === 'function' &&
    typeof api.getCountryCallingCode === 'function' &&
    typeof api.parsePhoneNumberFromString === 'function'
  );
}

/**
 * Lazily creates an adapter from a `libphonenumber-js`-compatible module.
 * Keeping the loader consumer-supplied avoids a static import, so neither the
 * dependency nor its numbering metadata enters Lyra's base bundle.
 *
 * Accepts either the module namespace directly (named exports, as `libphonenumber-js`'s own type
 * declarations describe it) or a `{ default: {...} }`-wrapped namespace, since some bundler/CJS
 * interop configurations resolve it that way -- the same normalization `map-loader.ts` and
 * `spreadsheet-loader.ts` apply to their own optional peers. Rejects (with a descriptive `TypeError`
 * naming the missing capability, not an incidental "not a function" deep inside this function) a
 * resolved value that has neither shape, or is missing a required method, rather than silently
 * calling into `undefined`.
 *
 * @example
 * `el.adapter = await loadLibphonenumberAdapter(() => import('libphonenumber-js/min'))`
 */
export async function loadLibphonenumberAdapter<CountryCode extends string = string>(
  loader: () => Promise<unknown>,
): Promise<LyraPhoneNumberAdapter> {
  const raw = await loader();
  const resolved = resolveOptionalPeerCapability(raw, isLibphonenumberModule);
  if (!resolved) {
    throw new TypeError(
      'Invalid optional peer for <lr-phone-input>: the module passed to loadLibphonenumberAdapter() ' +
        'does not expose the getCountries/getCountryCallingCode/parsePhoneNumberFromString ' +
        'capability libphonenumber-js provides.',
    );
  }
  const module = resolved as LibphonenumberModuleLike<CountryCode>;
  const countries = Object.freeze(module.getCountries().map((code) =>
    Object.freeze({
      code: normalizeCountry(code),
      callingCode: module.getCountryCallingCode(code),
    })
  ));

  return {
    countries,
    parse(input, country) {
      const raw = input.trim();
      if (!raw) return { status: 'empty' };
      const normalizedCountry = country ? (normalizeCountry(country) as CountryCode)
        : undefined;
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
  status: LyraPhoneNumberStatus;
}

export interface LyraPhoneInputEventMap {
  'lr-invalid': CustomEvent<null>;
  input: InputEvent;
  change: Event;
  focus: FocusEvent;
  blur: FocusEvent;
  'lr-input': CustomEvent<LyraPhoneInputEventDetail>;
  'lr-change': CustomEvent<LyraPhoneInputEventDetail>;
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

/** Digits (not the punctuation/spacing an adapter's formatting inserts) among
 *  `value`'s first `index` characters -- the caret-preservation unit that
 *  survives a reformat, since punctuation position moves but digit order
 *  never does. */
function digitsBefore(value: string, index: number): number {
  let count = 0;
  for (let i = 0; i < index && i < value.length; i++) {
    if (/\d/.test(value[i]!)) count++;
  }
  return count;
}

/** Inverse of `digitsBefore()`: the index in `value` immediately after its
 *  `digitCount`-th digit, or the string's end once `value` doesn't contain
 *  that many digits (e.g. a reformat that removed a stray character). */
function indexAfterDigits(value: string, digitCount: number): number {
  if (digitCount <= 0) return 0;
  let count = 0;
  for (let i = 0; i < value.length; i++) {
    if (/\d/.test(value[i]!)) {
      count++;
      if (count === digitCount) return i + 1;
    }
  }
  return value.length;
}

function fallbackParse(input: string): LyraPhoneNumberParseResult {
  const raw = input.trim();
  if (!raw) return { status: 'empty' };
  const compact = raw.replace(/[\s().-]/g, '');
  if (E164_RE.test(compact)) return { status: 'valid', e164: compact, formatted: raw };
  if (isDialLike(raw)) return { status: 'incomplete', formatted: raw };
  return { status: 'invalid', formatted: raw };
}

/** An adapter is an untrusted public extension seam at runtime even when TypeScript accepted it. */
function normalizeParseResult(result: unknown, input: string): LyraPhoneNumberParseResult {
  try {
    if (result === null || typeof result !== 'object') return { status: 'invalid', formatted: input };
    const record = result as Record<string, unknown>;
    const status = record['status'];
    if (status !== 'empty' && status !== 'incomplete' && status !== 'invalid' && status !== 'valid') {
      return { status: 'invalid', formatted: input };
    }
    const formatted = record['formatted'];
    if (formatted !== undefined && typeof formatted !== 'string') {
      return { status: 'invalid', formatted: input };
    }
    const rawCountry = record['country'];
    if (rawCountry !== undefined && typeof rawCountry !== 'string') {
      return { status: 'invalid', formatted: formatted ?? input };
    }
    const country = typeof rawCountry === 'string' && /^[A-Za-z]{2}$/.test(rawCountry.trim())
      ? normalizeCountry(rawCountry)
      : undefined;
    const metadata = {
      ...(formatted === undefined ? {} : { formatted }),
      ...(country === undefined ? {} : { country }),
    };
    if (status === 'valid') {
      const e164 = record['e164'];
      if (typeof e164 !== 'string' || !E164_RE.test(e164)) {
        return { status: 'invalid', formatted: formatted ?? input, ...(country ? { country } : {}) };
      }
      return { status, e164, ...metadata };
    }
    return { status, ...metadata };
  } catch {
    return { status: 'invalid', formatted: input };
  }
}

const MAX_PHONE_COUNTRIES = 512;

/** Validate and copy public country metadata without trusting iteration or property getters. */
function normalizeCountryCatalog(source: unknown): readonly LyraPhoneCountry[] {
  if (!Array.isArray(source)) return Object.freeze([]);
  const rows: LyraPhoneCountry[] = [];
  const seen = new Set<string>();
  let length = 0;
  try {
    length = Math.min(source.length, MAX_PHONE_COUNTRIES);
  } catch {
    return Object.freeze(rows);
  }
  for (let index = 0; index < length; index += 1) {
    try {
      const item = source[index];
      if (item === null || typeof item !== 'object') continue;
      const candidate = item as Record<string, unknown>;
      const rawCode = candidate['code'];
      const rawCallingCode = candidate['callingCode'];
      const rawLabel = candidate['label'];
      if (typeof rawCode !== 'string' || typeof rawCallingCode !== 'string') continue;
      const code = normalizeCountry(rawCode);
      const callingCode = rawCallingCode.replace(/^\+/, '');
      if (!/^[A-Z]{2}$/.test(code) || !/^[1-9]\d{0,2}$/.test(callingCode) || seen.has(code)) {
        continue;
      }
      if (rawLabel !== undefined && typeof rawLabel !== 'string') continue;
      seen.add(code);
      rows.push(Object.freeze({
        code,
        callingCode,
        ...(rawLabel === undefined ? {} : { label: rawLabel }),
      }));
    } catch {
      // A hostile getter invalidates only its own row; later valid rows remain reachable.
    }
  }
  return Object.freeze(rows);
}

/**
 * `<lr-phone-input>` — a country-aware telephone field whose form value is
 * canonical E.164. National formatting and numbering-plan validation are
 * supplied through `adapter`; without one, already-international E.164 input
 * remains useful and national input stays editable with `incomplete` validity.
 * Adapter results and country metadata are validated at the runtime boundary: only the exhaustive
 * result discriminator is accepted, `valid` requires E.164, malformed or hostile country rows are
 * skipped, and malformed parser output fails closed to `invalid`.
 *
 * Each text edit emits native `input` then `lr-input`; a text commit emits native `change` then
 * `lr-change`, and a country pick emits both pairs in that order. The aliases expose both the
 * canonical `value` and editable `inputValue`; programmatic property changes are silent.
 * Phone-number text is deliberately LTR while
 * the form chrome and country selector follow the inherited direction. A host
 * `aria-label` names the internal telephone input and wins over every derived
 * or component-specific fallback; `phone-label`, `label` and `placeholder` follow in that order,
 * and a field left with none of them still lands on a localized generic name rather than reaching
 * the accessibility tree unnamed. Pressing Enter performs the implicit form submission a native
 * `<input type="tel">` would (see `internal/submit-on-enter.ts` — the internal input is in a
 * shadow root and has no form owner, so the platform can never do it here).
 *
 * The country selector keeps the real, fully accessible native `<select>`
 * (full country names in its popup, native mobile pickers, type-ahead) but
 * renders it invisibly over a compact visual trigger — selected alpha-2 code
 * plus a design-system chevron — so long localized country names never clip
 * the closed control and the calling code isn't shown twice. With `flags`
 * set, the trigger also shows the selected country's `<lr-flag>`; actual flag
 * artwork still comes from the optional `@aceshooting/lyra-flags` peer,
 * registered by the consumer via `components/media/flag/flag-peer.js`
 * exactly as for a standalone `<lr-flag>` (without that registration the
 * trigger simply omits the image). Native `<option>`s cannot contain
 * elements, so the open popup remains text-only by platform design.
 *
 * Component-scoped theme inputs remain undeclared on the host, so values inherited from an
 * ancestor theme wrapper override size and pill fallbacks. A value set directly on the phone
 * input still wins through normal custom-property inheritance.
 * The country selector retains the shared `--lr-icon-button-size` hit floor, and its row uses the
 * same action-bearing height ladder as input, number-input, and time-input.
 * `readonly` locks both telephone and country mutation while retaining focus, selection, copying,
 * form value, and submission. `autofocus` targets the real native telephone input.
 *
 * @customElement lr-phone-input
 * @slot label - Custom label content.
 * @slot hint - Custom hint content.
 * @slot error - Custom error content.
 * @slot country-prefix - Optional visual displayed before the country selector, such as a flag.
 * @event input - Native `InputEvent` fired for user edits and country changes.
 * @event change - Native `Event` fired when the telephone input commits or the country changes.
 * @event lr-input - Lyra input alias; detail contains the canonical and display values.
 * @event lr-change - Lyra commit alias; detail contains the canonical and display values.
 * @event focus - Native `FocusEvent` relayed when the internal telephone input receives focus.
 * @event blur - Native `FocusEvent` relayed when the internal telephone input loses focus.
 * @event lr-invalid - The phone input failed a validity check. Cancelable: `preventDefault()`
 *   forwards to the native `invalid` event, suppressing the browser's own validation bubble and the
 *   focus/scroll `reportValidity()` would otherwise perform.
 * @csspart form-control - The outer form-control wrapper.
 * @csspart form-control-label - The visible label.
 * @csspart input-wrapper - The country selector and telephone input wrapper.
 * @csspart country-prefix - Optional country adornment slot wrapper.
 * @csspart country - The country selector region (invisible native select over the visual trigger).
 * @csspart country-select - The native country selector, stretched invisibly over the trigger.
 * @csspart country-trigger - The visible, decorative closed-state trigger.
 * @csspart flag - The selected country's `<lr-flag>` inside the trigger (only with `flags`).
 * @csspart country-code - The selected alpha-2 code (or placeholder text) inside the trigger.
 * @csspart expand-icon - The dropdown indicator inside the trigger.
 * @csspart calling-code - The selected country's calling code.
 * @csspart input - The native telephone input.
 * @csspart hint - The hint message.
 * @csspart error - Ordinary error/validation text referenced by the native telephone input
 *   through `aria-describedby`; it is not a live region, avoiding duplicate validation feedback.
 * @cssprop --lr-phone-input-padding-block - Input block-padding, scaled by `size` through the
 *   shared form-control ladder.
 * @cssprop --lr-phone-input-font-size - Input/flag/country-code/calling-code font size, scaled by `size`.
 * @cssprop --lr-phone-input-flag-size - Selected flag size, scaled by `size`.
 * @cssprop --lr-phone-input-glyph-size - Country selector glyph size, scaled by `size`.
 * @cssprop [--lr-phone-input-gap=var(--lr-space-xs)] - Country-trigger child gap.
 * @cssprop [--lr-phone-input-radius=var(--lr-radius)] - Input-wrapper corner radius, shared with
 *   the country trigger's leading corners. The `pill` attribute swaps it for `--lr-radius-pill`.
 * @cssprop [--lr-phone-input-focus-border-color=var(--lr-color-brand)] - Focused row border color.
 * @cssprop [--lr-phone-input-invalid-border-color=var(--lr-color-danger)] - Invalid row border color.
 * @cssprop [--lr-phone-input-country-hover-bg=var(--lr-color-brand-quiet)] - Country trigger hover background.
 * @cssprop [--lr-phone-input-control-min-height=var(--lr-form-control-height)] - Input-wrapper
 *   block-size floor. Reads the shared form-control height ladder, so retuning
 *   `--lr-theme-form-control-height-*` moves this control and every sibling field together.
 * @cssprop --lr-phone-input-control-height - Exact input-wrapper height. Unset by default, which
 *   leaves `--lr-phone-input-control-min-height` as a floor only; set it to a length to both floor
 *   and cap the row (e.g. to pixel-match a sibling field in the same toolbar row). Because it is
 *   never declared by the component itself, it can be set from an ancestor or an outer-tree rule
 *   as well as inline on the element.
 * @cssprop [--lr-form-control-required-content=' *'] - The required-field marker rendered after the
 *   label. Set it to `''` to suppress the marker, or to any other quoted string (`' (required)'`, a
 *   localized word) to replace it. Caller-supplied content, so it is never localized here.
 * @cssprop [--lr-form-control-required-color=var(--lr-color-danger)] - Color of that marker,
 *   retunable without touching any other danger-coloured surface.
 * @cssprop [--lr-form-control-required-offset=0] - Inline space between the label text and the
 *   marker.
 * @status stable
 * @since 4.0.0
 */
export class LyraPhoneInput extends FormAssociated(LyraPhoneInputBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    phoneInputIncomplete: LYRA_DEFAULT_phoneInputIncomplete,
    phoneInputLabel: LYRA_DEFAULT_phoneInputLabel,
    select: LYRA_DEFAULT_select,
    valueInvalid: LYRA_DEFAULT_valueInvalid,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, sizes, styles];
  static override properties = {
    country: { noAccessor: true },
  };

  /**
   * Lazily registers `<lr-flag>` (and its skeleton dependency) the first time any
   * `<lr-phone-input>` enables `flags`, so consumers that never turn flags on ship none of that
   * code. Kept static: registration is a page-global concern, not per-instance.
   */
  private static flagRegistration?: Promise<unknown>;

  /**
   * Show the selected country's flag in the country trigger. Rendering uses `<lr-flag
   * fidelity="compact">` (the icon-scale tier); the flag artwork itself still comes from the
   * optional `@aceshooting/lyra-flags` peer package, which the consumer registers by importing
   * `@aceshooting/lyra-ui/components/media/flag/flag-peer.js` — the same contract as a standalone
   * `<lr-flag>`. Without that registration (or the peer package) the trigger simply renders no
   * image; nothing flag-related is bundled while this stays `false`. The native popup list stays
   * text-only — an `<option>` cannot contain elements.
   */
  @property({ type: Boolean, reflect: true }) flags = false;

  /** Formatting and validation implementation. No metadata is bundled by default. */
  private _adapter?: LyraPhoneNumberAdapter;
  private adapterCountries: readonly LyraPhoneCountry[] = Object.freeze([]);
  @property({ attribute: false })
  get adapter(): LyraPhoneNumberAdapter | undefined { return this._adapter; }
  set adapter(next: LyraPhoneNumberAdapter | undefined) {
    const previous = this._adapter;
    this._adapter = next;
    this.adapterCountries = normalizeCountryCatalog(next?.countries);
    this.requestUpdate('adapter', previous);
  }
  /** Explicit country rows. `undefined` discovers `adapter.countries`; every supplied array,
   * including an empty one, is authoritative. Malformed runtime rows are skipped. */
  private _countries?: readonly LyraPhoneCountry[];
  @property({ attribute: false })
  get countries(): readonly LyraPhoneCountry[] | undefined { return this._countries; }
  set countries(next: readonly LyraPhoneCountry[] | undefined) {
    const previous = this._countries;
    this._countries = next === undefined ? undefined : normalizeCountryCatalog(next);
    this.requestUpdate('countries', previous);
  }
  /** Country selected when no explicit `country` has been set. */
  @property({ attribute: 'default-country' }) defaultCountry = '';
  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  @property() placeholder = '';
  /** Visual size — the library-wide `2xs`–`xl` ladder shared with `lr-input`. The Web Awesome /
   *  Shoelace spellings `small`/`medium`/`large` are accepted for `s`/`m`/`l`, so a migration is a
   *  tag rename with no attribute rewrite. */
  @property({ reflect: true,
    converter: declaredDefaultConverter<LyraSize>('m'),
  }) size: LyraSize = 'm';
  /** Rounds the field's corners to a full pill, mirroring `lr-input`'s own `pill`. The country
   *  trigger's leading corners follow, since both read `--lr-phone-input-radius`. */
  @property({ type: Boolean, reflect: true }) pill = false;
  /** Accessible name for the telephone input. Takes precedence over `phoneLabel`, label, and placeholder. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
  /** Accessible name for the country selector. */
  @property({ attribute: 'country-label', useDefault: true }) countryLabel = 'Select';
  /** Accessible-name override for the telephone input. */
  @property({ attribute: 'phone-label' }) phoneLabel = '';
  /** Validation message for a number that may still become valid with more digits. */
  @property({ attribute: 'incomplete-text', useDefault: true }) incompleteText = 'This phone number is incomplete.';
  /** Validation message for a completed but invalid number. */
  @property({ attribute: 'invalid-text', useDefault: true }) invalidText = 'The value is invalid.';
  @property({ useDefault: true }) autocomplete = 'tel';
  @property({ useDefault: true }) inputmode: 'tel' | 'numeric' | 'text' = 'tel';
  @property() enterkeyhint = '';
  /** Native readonly mode: keeps the telephone value focusable/copyable/submittable while
   * preventing telephone and country edits and barring constraint validation. */
  @property({ type: Boolean, reflect: true }) readonly = false;
  /** Forwards native autofocus to the real shadow input rather than the non-focusable host. */
  @property({ type: Boolean, reflect: true }) override autofocus = false;
  /** Forwarded to the internal `<input>`'s own `spellcheck`. Defaults to `true`, matching the
   *  native element's own default. Uses {@link spellcheckConverter} rather than Lit's default
   *  presence-based boolean converter so an explicit `spellcheck="false"` attribute is honored; a
   *  `.spellcheck=${false}` property binding can still turn this off directly. */
  @property({ converter: spellcheckConverter }) override spellcheck = true;
  /** Forwarded to the internal `<input>`'s own `autocapitalize`. Empty string omits the attribute,
   *  leaving the browser's own default behavior. */
  @property() override autocapitalize = '';
  /** Forwarded to the internal `<input>`'s own `autocorrect` (Safari/WebKit-specific). Empty
   *  string omits the attribute. Named `autoCorrect` (capital `C`), not `autocorrect`, purely to
   *  dodge a TS `lib.dom.d.ts` collision: newer DOM typings declare a `boolean`-typed
   *  `HTMLElement.autocorrect` IDL member, which would conflict with this `string`-typed reactive
   *  property; the explicit `attribute: 'autocorrect'` mapping preserves the standard lowercase
   *  `autocorrect` wire name in both Lit and the rendered attribute. */
  @property({ attribute: 'autocorrect' }) autoCorrect = '';

  @query('input[part="input"]') private inputElement?: HTMLInputElement;
  @state() private editableValue = '';
  @state() private status: LyraPhoneNumberStatus = 'empty';
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
    return this.resolveCountry(this.availableCountries);
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
  get phoneStatus(): LyraPhoneNumberStatus {
    return this.status;
  }

  get selectionStart(): number | null {
    return this.inputElement?.selectionStart ?? null;
  }

  set selectionStart(value: number | null) {
    if (this.inputElement) this.inputElement.selectionStart = value ?? 0;
  }

  get selectionEnd(): number | null {
    return this.inputElement?.selectionEnd ?? null;
  }

  set selectionEnd(value: number | null) {
    if (this.inputElement) this.inputElement.selectionEnd = value ?? 0;
  }

  get selectionDirection(): LyraPhoneInputSelectionDirection | null {
    return this.inputElement?.selectionDirection as LyraPhoneInputSelectionDirection | null;
  }

  set selectionDirection(value: LyraPhoneInputSelectionDirection | null) {
    if (this.inputElement) this.inputElement.selectionDirection = value ?? 'none';
  }

  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | null {
    return this.inputElement ?? null;
  }

  override get value(): string {
    return super.value;
  }

  override set value(next: string) {
    const raw = next ?? '';
    const parsed = this.parse(raw);
    this.applyParsed(raw, parsed);
  }

  private get availableCountries(): readonly LyraPhoneCountry[] {
    return this.countries ?? this.adapterCountries;
  }

  private resolveCountry(rows: readonly LyraPhoneCountry[]): string {
    const codes = rows.map((row) => row.code);
    const explicit = normalizeCountry(this.explicitCountry);
    const preferred = normalizeCountry(this.defaultCountry);
    if (codes.includes(explicit)) return explicit;
    if (codes.includes(preferred)) return preferred;
    return codes[0] ?? '';
  }

  private parse(input: string): LyraPhoneNumberParseResult {
    if (!this.adapter) return fallbackParse(input);
    try {
      const parse = this.adapter.parse;
      if (typeof parse !== 'function') return { status: 'invalid', formatted: input };
      return normalizeParseResult(parse.call(this.adapter, input, this.country || undefined), input);
    } catch {
      return { status: 'invalid', formatted: input };
    }
  }

  private reconcileCountryCatalog(): void {
    this.explicitCountry = this.resolveCountry(this.availableCountries);
  }

  private applyParsed(raw: string, parsed: LyraPhoneNumberParseResult): void {
    this.editableValue = parsed.formatted ?? raw;
    this.status = parsed.status;
    if (parsed.country) this.country = normalizeCountry(parsed.country);
    super.value = parsed.status === 'valid' ? parsed.e164! : '';
    this.setAttribute('data-phone-status', parsed.status);
  }

  /** Reassigns `input.value` to the just-reformatted `editableValue`, restoring the caret to the
   *  same *digit* offset it held before reformatting -- assigning `.value` unconditionally moves
   *  the caret to the end (native `<input>` behavior), which makes mid-string edits impossible
   *  once an adapter reformats the text differently from what was typed. A no-op (no reassignment,
   *  no selection change) when the reformat didn't actually change the string, which keeps the
   *  no-adapter path exactly as before. */
  private syncFormattedValue(input: HTMLInputElement, digitsBeforeCaret: number | null): void {
    if (input.value === this.editableValue) return;
    input.value = this.editableValue;
    if (digitsBeforeCaret != null) {
      const position = indexAfterDigits(this.editableValue, digitsBeforeCaret);
      input.setSelectionRange(position, position);
    }
  }

  private get eventDetail(): LyraPhoneInputEventDetail {
    return {
      value: super.value,
      inputValue: this.editableValue,
      country: this.country,
      valid: this.internals.validity.valid,
      status: this.status,
    };
  }

  private get effectiveCountryLabel(): string {
    return this.localize('select', this.countryLabel === 'Select' ? undefined : this.countryLabel);
  }

  /** The telephone input's accessible name. Every consumer-supplied source wins, in the precedence
   *  order this component documents; a bare `<lr-phone-input>` with none of them set still lands on
   *  a localized generic name rather than shipping an unnamed field to the accessibility tree, the
   *  same last-resort every sibling text-entry primitive has (`lr-input`, `lr-time-input`,
   *  `lr-otp-input`, `lr-locale-picker`). A rendered label names the native input through its
   *  `for` association; the generic fallback is needed only while that label is hidden.
   *
   *  Deliberately its own `phoneInputLabel` key rather than borrowing `lr-contact-viewer`'s
   *  identically-worded one: the two read the same in English today, but a locale re-wording
   *  contact-viewer's field label would otherwise silently re-label this control too. */
  private effectivePhoneLabel(hasLabel: boolean): string | typeof nothing {
    if (this.accessibleLabel !== null) return this.accessibleLabel;
    if (this.phoneLabel) return this.phoneLabel;
    if (hasLabel) return nothing;
    return this.placeholder || this.localize('phoneInputLabel');
  }

  private get incompleteMessage(): string {
    return this.localize(
      'phoneInputIncomplete',
      this.incompleteText === 'This phone number is incomplete.' ? undefined : this.incompleteText,
    );
  }

  private get invalidMessage(): string {
    return this.localize(
      'valueInvalid',
      this.invalidText === 'The value is invalid.' ? undefined : this.invalidText,
    );
  }

  private countryName(row: LyraPhoneCountry): string {
    if (row.label) return row.label;
    try {
      // Shared per-locale instance: this runs once per country row on every render of the
      // select, and constructing an `Intl.DisplayNames` is an ICU locale-data lookup that
      // would otherwise repeat for every row (a full libphonenumber country list is ~250).
      return (
        getDisplayNames(this.effectiveLocale, { type: 'region' }).of(row.code) ?? row.code
      );
    } catch {
      return row.code;
    }
  }

  /**
   * Maps the parsed phone `status` onto the element's validity. A control barred from constraint
   * validation (own `disabled`, a `<fieldset disabled>` ancestor, any platform condition
   * `willValidate` folds in) reports no violation at all, exactly like the base mixin and every
   * native control: without this guard a `<lr-phone-input required disabled>` kept `valueMissing`
   * raised and published `:state(invalid)`/`:state(user-invalid)`, painting every disabled field
   * with the documented `:state(user-invalid)` error styling.
   */
  protected updateValidity(): void {
    if (isBarredFromValidation(this, this.internals)) {
      this[SET_ANCHORED_VALIDITY]({});
      return;
    }
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

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (this.flags && !LyraPhoneInput.flagRegistration) {
      // Dynamic (not static) so the flag/skeleton modules stay out of every bundle that never
      // enables flags; the rendered <lr-flag> upgrades in place once the registration lands.
      LyraPhoneInput.flagRegistration = import('../../media/flag/flag.js').catch((error) => {
        console.warn('<lr-phone-input> failed to register <lr-flag> for its flags option:', error);
      });
    }
    if (!this.hasUpdated) {
      this.hasLabelSlot = Array.from(this.children ?? []).some((child) => child.getAttribute('slot') === 'label');
      this.hasHintSlot = Array.from(this.children ?? []).some((child) => child.getAttribute('slot') === 'hint');
      this.hasErrorSlot = Array.from(this.children ?? []).some((child) => child.getAttribute('slot') === 'error');
      this.hasCountryPrefixSlot = Array.from(this.children ?? []).some(
        (child) => child.getAttribute('slot') === 'country-prefix',
      );
    }
    if (
      !this.hasUpdated ||
      changed.has('countries') ||
      changed.has('adapter') ||
      changed.has('country') ||
      changed.has('defaultCountry')
    ) {
      this.reconcileCountryCatalog();
    }
    if (
      (changed.has('adapter') ||
        changed.has('countries') ||
        changed.has('country') ||
        changed.has('defaultCountry')) &&
      this.editableValue
    ) {
      this.applyParsed(this.editableValue, this.parse(this.editableValue));
    }
  }

  protected override updated(changed: PropertyValues): void {
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
    if (this.liveDisabled || this.readonly) {
      event.stopPropagation();
      return;
    }
    const input = event.currentTarget as HTMLInputElement;
    const caret = input.selectionStart;
    const digitsBeforeCaret = caret == null ? null : digitsBefore(input.value, caret);
    this.applyParsed(input.value, this.parse(input.value));
    this.syncFormattedValue(input, digitsBeforeCaret);
    relayNativeEvent(this, event);
    this.emit('lr-input', this.eventDetail);
  };

  private onChange = (event: Event): void => {
    if (this.liveDisabled || this.readonly) {
      event.stopPropagation();
      return;
    }
    this.touched = true;
    relayNativeEvent(this, event);
    this.emit('lr-change', this.eventDetail);
  };

  private onCountryChange = (event: Event): void => {
    if (this.liveDisabled || this.readonly) {
      event.stopPropagation();
      return;
    }
    this.country = normalizeCountry((event.currentTarget as HTMLSelectElement).value);
    this.applyParsed(this.editableValue, this.parse(this.editableValue));
    dispatchNativeInputEvent(this);
    this.emit('lr-input', this.eventDetail);
    relayNativeEvent(this, event);
    this.emit('lr-change', this.eventDetail);
  };

  /**
   * Implicit form submission, through the shared gate in `internal/submit-on-enter.ts` — the
   * internal telephone input lives in a shadow root and has no form owner, so the platform can
   * never run its own. A modifier-held or IME-composition Enter is ignored there, which matters
   * more here than elsewhere: this field's `inputmode="tel"` keyboards are exactly the ones an IME
   * candidate list sits on top of.
   */
  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.liveDisabled) return;
    submitOnEnter(this, event);
  };

  private onFocus = (event: FocusEvent): void => {
    if (this.liveDisabled) {
      event.stopPropagation();
      return;
    }
    relayNativeEvent(this, event);
  };

  private onBlur = (event: FocusEvent): void => {
    // Regression guard: disabling a focused native form control
    // forces the browser to blur it -- plain platform behavior, not a real user interaction.
    // Unconditionally marking `touched` for it could reenter an in-flight Lit update and trip
    // Lit's dev-mode "scheduled an update after an update completed" warning.
    if (!this.liveDisabled) this.touched = true;
    relayNativeEvent(this, event);
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

  /** Reads both component state and the UA's synchronous fieldset cascade before public actions. */
  private get liveDisabled(): boolean {
    return this.effectiveDisabled || this.matches(':disabled');
  }

  /** Activate the internal telephone input unless the form control is effectively disabled. */
  override click(): void {
    if (!this.liveDisabled) this.inputElement?.click();
  }

  /** Focus the internal telephone input unless the form control is effectively disabled. */
  override focus(options?: FocusOptions): void {
    if (!this.liveDisabled) this.inputElement?.focus(options);
  }

  /** Blur the internal telephone input. */
  override blur(): void {
    this.inputElement?.blur();
  }

  /** Select all editable telephone text. */
  select(): void {
    this.inputElement?.select();
  }

  /** Set the selection range in the editable telephone text. */
  setSelectionRange(
    start: number | null,
    end: number | null,
    direction?: LyraPhoneInputSelectionDirection,
  ): void {
    this.inputElement?.setSelectionRange(start, end, direction);
  }

  setRangeText(replacement: string): void;
  setRangeText(replacement: string, start: number, end: number, selectMode?: SelectionMode): void;
  setRangeText(replacement: string, start?: number, end?: number, selectMode?: SelectionMode): void {
    const input = this.inputElement;
    if (!input) return;
    if (start === undefined || end === undefined) {
      input.setRangeText(replacement);
    } else {
      input.setRangeText(replacement, start, end, selectMode);
    }
    const caret = input.selectionStart;
    const digitsBeforeCaret = caret == null ? null : digitsBefore(input.value, caret);
    this.applyParsed(input.value, this.parse(input.value));
    this.syncFormattedValue(input, digitsBeforeCaret);
  }

  override formResetCallback(): void {
    this.explicitCountry = '';
    this.reconcileCountryCatalog();
    super.formResetCallback();
    this.touched = false;
  }

  override render(): TemplateResult {
    const hasLabel = Boolean(this.label || this.hasLabelSlot);
    const validationError = this.touched ? this.validationMessage : '';
    const renderedError = this.errorText || validationError;
    const hasHint = Boolean(this.hint || this.hasHintSlot);
    const hasError = Boolean(renderedError || this.hasErrorSlot);
    const describedBy = [hasHint ? this.hintId : '', hasError ? this.errorId : ''].filter(Boolean).join(' ');
    const rows = this.availableCountries;
    const current = rows.find((row) => row.code === this.country);

    return html`
      <div part="form-control">
        <label part="form-control-label" for=${this.inputId} ?hidden=${!hasLabel}>
          <slot name="label" @slotchange=${this.onLabelSlotChange}>${this.label}</slot>
        </label>
        <div part="input-wrapper">
          <span part="country-prefix" ?hidden=${!this.hasCountryPrefixSlot}>
            <slot name="country-prefix" @slotchange=${this.onCountryPrefixSlotChange}></slot>
          </span>
          <span part="country">
            <select
              part="country-select"
              aria-label=${this.effectiveCountryLabel}
              .value=${this.country}
              aria-readonly=${this.readonly ? 'true' : 'false'}
              ?disabled=${this.effectiveDisabled || this.readonly || rows.length === 0}
              @change=${this.onCountryChange}
            >
              ${rows.length === 0
                ? html`<option value="">${this.effectiveCountryLabel}</option>`
                : rows.map((row) => html`<option
                      value=${row.code}
                      ?selected=${row.code === this.country}
                    >${this.countryName(row)}${row.callingCode ? ` (+${row.callingCode})` : ''}</option>`)}
            </select>
            <span part="country-trigger" aria-hidden="true">
              ${this.flags && this.country
                ? html`<lr-flag part="flag" country=${this.country} fidelity="compact" aria-label=""></lr-flag>`
                : nothing}
              <span part="country-code" ?data-placeholder=${!this.country}>${
                this.country || this.effectiveCountryLabel
              }</span>
              <span part="expand-icon">${chevronIcon()}</span>
            </span>
          </span>
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
            spellcheck=${this.spellcheck}
            autocapitalize=${this.autocapitalize || nothing}
            autocorrect=${this.autoCorrect || nothing}
            aria-label=${this.effectivePhoneLabel(hasLabel)}
            aria-describedby=${describedBy || nothing}
            aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'}
            ?required=${this.required}
            ?disabled=${this.effectiveDisabled}
            ?readonly=${this.readonly}
            ?autofocus=${this.autofocus}
            @input=${this.onInput}
            @change=${this.onChange}
            @keydown=${this.onKeyDown}
            @focus=${this.onFocus}
            @blur=${this.onBlur}
          />
        </div>
        <div id=${this.hintId} part="hint" ?hidden=${!hasHint}>
          <slot name="hint" @slotchange=${this.onHintSlotChange}>${this.hint}</slot>
        </div>
        <div id=${this.errorId} part="error" ?hidden=${!hasError}>
          <slot name="error" @slotchange=${this.onErrorSlotChange}>${renderedError}</slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-phone-input': LyraPhoneInput;
  }
}
