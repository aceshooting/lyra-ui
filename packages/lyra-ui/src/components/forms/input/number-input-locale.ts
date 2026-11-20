/**
 * Locale-aware text conversion for `<lr-number-input localized>`.
 *
 * The component keeps its `value` in the native `<input type="number">` form (ASCII digits, an
 * optional leading `-`, `.` as the decimal point, no grouping), so form submission, `valueAsNumber`
 * and range/step validity stay the platform's. These helpers only translate between that canonical
 * string and the text a person types or reads in a given locale.
 *
 * Parsing is strict about grouping so an ambiguous entry is rejected instead of misread: in `de`,
 * `25.000` is twenty-five thousand and `10,24` is ten point two four, while `10.24` (a dot followed
 * by two digits) is not a valid group and parses to `null`. The same holds the other way round in
 * `en`, where `10,24` is rejected rather than read as one thousand and twenty-four.
 */

import { getNumberFormat } from '../../../internal/intl-cache.js';

/** Separators and digits a locale uses, derived from `Intl.NumberFormat`. */
interface LocaleNumberSymbols {
  readonly decimal: string;
  /** Every character accepted as a group separator (a space-like group accepts all spaces). */
  readonly groups: ReadonlySet<string>;
  /** Size of the group nearest the decimal point (3 in most locales). */
  readonly primaryGroup: number;
  /** Size of every further group (2 in `en-IN`, otherwise usually the primary size). */
  readonly secondaryGroup: number;
  /** Locale digit -> ASCII digit, for locales with their own numbering system. */
  readonly digits: ReadonlyMap<string, string>;
  /** Text the locale writes before a negative integer (a minus sign, possibly with bidi marks). */
  readonly negativePrefix: string;
}

const SPACE_GROUPS = [' ', ' ', ' '];
const APOSTROPHE_GROUPS = ["'", '’'];
// Bidi controls some locales wrap around signs; they carry no numeric meaning.
const BIDI_MARKS = /[‎‏؜]/g;
const MINUS_SIGNS = new Set(['-', '−']);
const CANONICAL_DECIMAL = /^(-?)(\d*)(?:\.(\d*))?$/;
const ASCII_DIGIT = /^[0-9]$/;

const symbolCache = new Map<string, LocaleNumberSymbols>();

function groupSizes(formatter: Intl.NumberFormat): { primary: number; secondary: number } {
  const integerRuns = formatter
    .formatToParts(1234567890)
    .filter((part) => part.type === 'integer')
    .map((part) => part.value.length);
  if (integerRuns.length < 2) return { primary: 3, secondary: 3 };
  const primary = integerRuns[integerRuns.length - 1]!;
  const secondary = integerRuns.length > 2 ? integerRuns[integerRuns.length - 2]! : primary;
  return { primary, secondary };
}

/** Resolves (and caches) the number symbols of `locale`. */
export function localeNumberSymbols(locale: string): LocaleNumberSymbols {
  const cached = symbolCache.get(locale);
  if (cached) return cached;
  const formatter = getNumberFormat(locale, { useGrouping: true });
  const decimal = formatter.formatToParts(1.5).find((part) => part.type === 'decimal')?.value ?? '.';
  const group = formatter.formatToParts(1234567).find((part) => part.type === 'group')?.value ?? ',';
  const groups = new Set<string>([group]);
  if (SPACE_GROUPS.includes(group)) for (const space of SPACE_GROUPS) groups.add(space);
  if (APOSTROPHE_GROUPS.includes(group)) for (const mark of APOSTROPHE_GROUPS) groups.add(mark);
  const { primary, secondary } = groupSizes(formatter);
  const plain = getNumberFormat(locale, { useGrouping: false });
  const digits = new Map<string, string>();
  for (let digit = 0; digit <= 9; digit += 1) {
    const localDigit = plain.format(digit);
    if (localDigit !== String(digit)) digits.set(localDigit, String(digit));
  }
  const negativeParts = formatter.formatToParts(-1);
  const integerIndex = negativeParts.findIndex((part) => part.type === 'integer');
  const negativePrefix = negativeParts.slice(0, Math.max(integerIndex, 0)).map((part) => part.value).join('') || '-';
  const symbols: LocaleNumberSymbols = { decimal, groups, primaryGroup: primary, secondaryGroup: secondary, digits, negativePrefix };
  symbolCache.set(locale, symbols);
  return symbols;
}

function validGrouping(chunks: readonly string[], symbols: LocaleNumberSymbols): boolean {
  if (chunks.length < 2) return true;
  const last = chunks.length - 1;
  return chunks.every((chunk, index) => {
    if (index === last) return chunk.length === symbols.primaryGroup;
    // The leading group may be shorter than a full group; every inner group is full.
    if (index === 0) return chunk.length >= 1 && chunk.length <= symbols.secondaryGroup;
    return chunk.length === symbols.secondaryGroup;
  });
}

/**
 * Parses text typed in `locale` into the canonical `<input type="number">` value string.
 * Returns `''` for blank text and `null` for text that is not a number in that locale.
 */
export function parseLocaleNumber(text: string, locale: string): string | null {
  const symbols = localeNumberSymbols(locale);
  let rest = text.replace(BIDI_MARKS, '').trim();
  if (rest === '') return '';
  let negative = false;
  const first = rest[0]!;
  if (MINUS_SIGNS.has(first) || first === '+') {
    negative = first !== '+';
    rest = rest.slice(1).trimStart();
  }
  let integer = '';
  let fraction: string | null = null;
  const chunks: string[] = [''];
  let groupPending = false;
  for (const char of rest) {
    const digit = ASCII_DIGIT.test(char) ? char : symbols.digits.get(char);
    if (digit !== undefined) {
      if (fraction === null) {
        integer += digit;
        chunks[chunks.length - 1] += digit;
      } else fraction += digit;
      groupPending = false;
      continue;
    }
    if (char === symbols.decimal && fraction === null && !groupPending) {
      fraction = '';
      continue;
    }
    if (symbols.groups.has(char) && fraction === null && integer !== '' && !groupPending) {
      chunks.push('');
      groupPending = true;
      continue;
    }
    return null;
  }
  if (groupPending || !validGrouping(chunks, symbols)) return null;
  if (integer === '' && (fraction === null || fraction === '')) return null;
  const whole = integer === '' ? '0' : integer;
  const canonical = fraction ? `${whole}.${fraction}` : whole;
  return negative ? `-${canonical}` : canonical;
}

/**
 * Formats a canonical value string for display in `locale`, keeping every fraction digit (so
 * `10.50` reads `10,50` in `de`). A value that is not a plain decimal (an exponent, stray text) is
 * returned unchanged so the field still shows exactly what was assigned.
 */
export function formatLocaleNumber(value: string, locale: string): string {
  const match = CANONICAL_DECIMAL.exec(value);
  if (!match || (match[2] === '' && !match[3])) return value;
  const [, sign, integer, fraction] = match;
  const symbols = localeNumberSymbols(locale);
  const formatter = getNumberFormat(locale, { useGrouping: true, maximumFractionDigits: 0 });
  const wholeText = formatter.format(BigInt(integer || '0'));
  let fractionText = '';
  if (fraction) {
    const localDigits = new Map(Array.from(symbols.digits, ([local, ascii]) => [ascii, local]));
    fractionText = symbols.decimal + Array.from(fraction, (digit) => localDigits.get(digit) ?? digit).join('');
  }
  return `${sign ? symbols.negativePrefix : ''}${wholeText}${fractionText}`;
}
