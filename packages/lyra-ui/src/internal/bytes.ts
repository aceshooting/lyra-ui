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

export interface ByteSizeOptions {
  readonly unit?: LyraFormatBytesUnit;
  readonly display?: LyraFormatDisplay;
  /** Defaults to the decimal 1000; pass 1024 for binary scaling. */
  readonly unitStep?: number;
  /** Maximum fraction digits, 0-10; defaults to 1. */
  readonly decimals?: number;
}

/** A byte or bit quantity in Intl unit wording (`1.5 kB`), or `''` for a non-finite value. */
export function formatByteSize(value: number, locale: string | undefined, options: ByteSizeOptions = {}): string {
  if (!Number.isFinite(value)) return '';
  const { amount, options: format } = byteFormat(
    value,
    options.unit ?? 'byte',
    options.display ?? 'short',
    options.unitStep ?? 1000,
    options.decimals ?? 1,
  );
  return getNumberFormat(locale, format).format(amount);
}

/**
 * A file size on binary (1024) rungs in Intl unit wording for `locale` -- `1536` reads `1.5 kB`,
 * `2415919` reads `2.3 MB` -- with at most one fraction digit, the same formatter
 * `<lr-format-bytes unit-step="1024">` uses. An omitted or `'auto'` locale resolves to the page's
 * active `setLyraLocale()` locale. Returns `''` for a negative or non-finite size.
 */
export function formatFileSize(bytes: number, locale?: string): string {
  if (!(bytes >= 0)) return '';
  // `+ 0` turns a negative zero into zero, which Intl would otherwise print with a sign.
  return formatByteSize(bytes + 0, resolveActiveOrExplicitLocale(locale), { unitStep: 1024 });
}
