import { getNumberFormat } from './intl-cache.js';
import { finiteInteger, finiteRange } from './numbers.js';
import { resolveActiveOrExplicitLocale } from './localization-runtime.js';

/** Which Intl unit ladder a quantity is scaled on. */
export type LyraFormatBytesUnit = 'byte' | 'bit';

/** `Intl.NumberFormat` `unitDisplay` styles. */
export type LyraFormatDisplay = 'long' | 'short' | 'narrow';

const INTL_LADDERS: Readonly<Record<LyraFormatBytesUnit, readonly string[]>> = {
  byte: ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte', 'petabyte'],
  bit: ['bit', 'kilobit', 'megabit', 'gigabit', 'terabit', 'petabit'],
};
const UNIT_DISPLAYS: readonly LyraFormatDisplay[] = ['long', 'short', 'narrow'];
/** Both Intl ladders have the same number of rungs. */
const INTL_RUNGS = INTL_LADDERS.byte.length;

/** The step between rungs: a finite value above 1, else the decimal 1000. */
export function safeByteUnitStep(unitStep: number): number {
  const step = finiteRange(unitStep, 1000, 1);
  return step === 1 ? 1000 : step;
}

/**
 * The highest rung `value`'s magnitude reaches, compared against the exact divisors the amount is
 * scaled by (a logarithm can round a boundary onto the wrong rung), capped at `unitCount - 1`.
 */
export function byteUnitIndex(value: number, unitStep: number, unitCount: number = INTL_RUNGS): number {
  const step = safeByteUnitStep(unitStep);
  const magnitude = Math.abs(value);
  let index = Math.max(0, unitCount - 1);
  while (index > 0 && !(magnitude >= step ** index)) index -= 1;
  return index;
}

export interface ByteFormatResult {
  index: number;
  amount: number;
  options: Intl.NumberFormatOptions;
}

/** Scales a byte or bit quantity onto its Intl unit ladder and builds validated unit options. A
 *  magnitude that rounds up to the next rung's step at the requested precision is shown on that
 *  rung (`999.96 kB` at one decimal reads `1 MB`, never `1,000 kB`). */
export function byteFormat(
  value: number,
  unit: LyraFormatBytesUnit,
  display: LyraFormatDisplay,
  unitStep: number,
  decimals: number,
): ByteFormatResult {
  const ladder = INTL_LADDERS[unit === 'bit' ? 'bit' : 'byte'];
  const step = safeByteUnitStep(unitStep);
  const fractionDigits = finiteInteger(decimals, 1, 0, 10);
  let index = byteUnitIndex(value, unitStep, ladder.length);
  if (index < ladder.length - 1) {
    const factor = 10 ** fractionDigits;
    const rounded = Math.round(Math.abs(value / step ** index) * factor) / factor;
    if (rounded >= step) index += 1;
  }
  return {
    index,
    amount: value / step ** index,
    options: {
      style: 'unit',
      unit: ladder[index],
      unitDisplay: UNIT_DISPLAYS.includes(display) ? display : 'short',
      maximumFractionDigits: fractionDigits,
    },
  };
}

type PartsFormat = { formatToParts(value: number | string): Intl.NumberFormatPart[] };

const baseUnitSymbols = new WeakMap<Intl.NumberFormat, string>();

function unitText(locale: string, unit: string, unitDisplay: LyraFormatDisplay): string {
  const parts = getNumberFormat(locale, { style: 'unit', unit, unitDisplay }).formatToParts(1);
  return parts.find((part) => part.type === 'unit')?.value.trim() ?? '';
}

/** The narrow symbol a short base rung takes, or `''` to keep Intl's short wording. Many locales'
 *  short base unit is the word (`20 byte`) while the next rung is abbreviated (`1.5 kB`); the base
 *  takes the narrow symbol only when that symbol is how the short kilo rung itself ends (`B` of
 *  `kB`, `o` of `ko`), so a locale whose kilo rung is a word keeps its consistent wording. */
function baseUnitSymbol(formatter: Intl.NumberFormat, unit: string): string {
  let symbol = baseUnitSymbols.get(formatter);
  if (symbol === undefined) {
    const locale = formatter.resolvedOptions().locale;
    const narrow = unitText(locale, unit, 'narrow');
    const kilo = unitText(locale, `kilo${unit}`, 'short');
    symbol = narrow && kilo.length > narrow.length && kilo.endsWith(narrow) ? narrow : '';
    baseUnitSymbols.set(formatter, symbol);
  }
  return symbol;
}

/** Formats a {@link byteFormat} amount for `locale` (`'auto'`/omitted resolves to the active
 *  locale). The short base rung reads with the abbreviated symbol its kilo rung uses (`20 B`
 *  beside `1.5 kB`), keeping the short pattern's spacing and order. */
export function formatByteAmount(locale: string | undefined, amount: number | string, result: ByteFormatResult): string {
  const formatter = getNumberFormat(resolveActiveOrExplicitLocale(locale), result.options);
  const symbol = result.index === 0 && result.options.unitDisplay === 'short'
    ? baseUnitSymbol(formatter, String(result.options.unit))
    : '';
  if (!symbol) return formatter.format(amount as number);
  return (formatter as unknown as PartsFormat).formatToParts(amount)
    .map((part) => (part.type === 'unit' ? symbol : part.value))
    .join('');
}

export interface ByteSizeOptions {
  readonly unit?: LyraFormatBytesUnit;
  readonly display?: LyraFormatDisplay;
  /** Defaults to the decimal 1000; pass 1024 for binary scaling. */
  readonly unitStep?: number;
  /** Maximum fraction digits, 0-10; defaults to 1. */
  readonly decimals?: number;
}

/** A byte or bit quantity in Intl unit wording (`20 B`, `1.5 kB`), or `''` for a non-finite value. */
export function formatByteSize(value: number, locale: string | undefined, options: ByteSizeOptions = {}): string {
  if (!Number.isFinite(value)) return '';
  const result = byteFormat(
    value,
    options.unit ?? 'byte',
    options.display ?? 'short',
    options.unitStep ?? 1000,
    options.decimals ?? 1,
  );
  return formatByteAmount(locale, result.amount, result);
}

/**
 * A file size on binary (1024) rungs in Intl unit wording for `locale` -- `512` reads `512 B`, `1536` reads `1.5 kB`,
 * `2415919` reads `2.3 MB` -- with at most one fraction digit, the same formatter
 * `<lr-format-bytes unit-step="1024">` uses. An omitted or `'auto'` locale resolves to the page's
 * active `setLyraLocale()` locale. Returns `''` for a negative or non-finite size.
 */
export function formatFileSize(bytes: number, locale?: string): string {
  if (!(bytes >= 0)) return '';
  // `+ 0` turns a negative zero into zero, which Intl would otherwise print with a sign.
  return formatByteSize(bytes + 0, resolveActiveOrExplicitLocale(locale), { unitStep: 1024 });
}
