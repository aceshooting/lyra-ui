import { getNumberFormat } from './intl-cache.js';
import { finiteInteger, finiteRange } from './numbers.js';

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

/** File-size rungs, labelled through localized unit strings rather than Intl unit names. */
const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

export type FileSizeUnit = (typeof FILE_SIZE_UNITS)[number];

export type FileSizeUnitKey = 'fileSizeUnitB' | 'fileSizeUnitKb' | 'fileSizeUnitMb' | 'fileSizeUnitGb' | 'fileSizeUnitTb';

/** Maps each file-size unit to its localization key. */
export const FILE_SIZE_UNIT_KEYS: Readonly<Record<FileSizeUnit, FileSizeUnitKey>> = {
  B: 'fileSizeUnitB',
  KB: 'fileSizeUnitKb',
  MB: 'fileSizeUnitMb',
  GB: 'fileSizeUnitGb',
  TB: 'fileSizeUnitTb',
};

/**
 * `512` -> `512 B`; `2415919` -> `2.3 MB`: binary rungs up to TB, whole bytes without a decimal and
 * every larger unit with exactly one. Returns `''` for a negative or non-finite size.
 */
export function formatFileSize(
  bytes: number,
  unitLabel: (unit: FileSizeUnit) => string = (unit) => unit,
  numberLabel: (value: number, fractionDigits: number) => string = (value, digits) => value.toFixed(digits),
): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  const rung = byteUnitIndex(bytes, 1024, FILE_SIZE_UNITS.length);
  // `+ 0` turns a negative zero into zero, which Intl would otherwise print with a sign.
  const amount = rung === 0 ? Math.round(bytes) + 0 : bytes / 1024 ** rung;
  return `${numberLabel(amount, rung === 0 ? 0 : 1)} ${unitLabel(FILE_SIZE_UNITS[rung]!)}`;
}

/** A `formatFileSize` number label with exactly the fraction digits it asks for, in `locale`. */
export function localizedNumberLabel(locale: string): (value: number, fractionDigits: number) => string {
  return (value, fractionDigits) =>
    getNumberFormat(locale, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(value);
}

/**
 * `formatFileSize` with locale digits and unit labels resolved through localization keys, e.g.
 * `formatLocalizedFileSize(size, this.effectiveLocale, (key) => this.localize(key))`.
 */
export function formatLocalizedFileSize(
  bytes: number,
  locale: string,
  unitLabel: (key: FileSizeUnitKey) => string,
): string {
  return formatFileSize(bytes, (unit) => unitLabel(FILE_SIZE_UNIT_KEYS[unit]), localizedNumberLabel(locale));
}
