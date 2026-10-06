import { resolveOptionalPeerCapability } from '../../../internal/optional-peer-capabilities.js';

/** Decorator-free adapter types, loader and helpers, so importing the loader skips the class. */

export type LyraPhoneNumberStatus =
  | 'empty' | 'incomplete' | 'invalid' | 'valid';
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

const E164_RE = /^\+[1-9]\d{1,14}$/;
const DIAL_LIKE_RE = /^[+\d\s().-]+$/;

export function normalizeCountry(country: string): string {
  return country.trim().toUpperCase();
}

function isDialLike(value: string): boolean {
  return DIAL_LIKE_RE.test(value.trim());
}

/** Digits (not the punctuation/spacing an adapter's formatting inserts) among
 *  `value`'s first `index` characters -- the caret-preservation unit that
 *  survives a reformat, since punctuation position moves but digit order
 *  never does. */
export function digitsBefore(value: string, index: number): number {
  let count = 0;
  for (let i = 0; i < index && i < value.length; i++) {
    if (/\d/.test(value[i]!)) count++;
  }
  return count;
}

/** Inverse of `digitsBefore()`: the index in `value` immediately after its
 *  `digitCount`-th digit, or the string's end once `value` doesn't contain
 *  that many digits (e.g. a reformat that removed a stray character). */
export function indexAfterDigits(value: string, digitCount: number): number {
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

export function fallbackParse(input: string): LyraPhoneNumberParseResult {
  const raw = input.trim();
  if (!raw) return { status: 'empty' };
  const compact = raw.replace(/[\s().-]/g, '');
  if (E164_RE.test(compact)) return { status: 'valid', e164: compact, formatted: raw };
  if (isDialLike(raw)) return { status: 'incomplete', formatted: raw };
  return { status: 'invalid', formatted: raw };
}

/** An adapter is an untrusted public extension seam at runtime even when TypeScript accepted it. */
export function normalizeParseResult(result: unknown, input: string): LyraPhoneNumberParseResult {
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
export function normalizeCountryCatalog(source: unknown): readonly LyraPhoneCountry[] {
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
