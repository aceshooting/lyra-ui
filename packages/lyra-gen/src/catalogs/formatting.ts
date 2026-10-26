import type { JsonValue } from '../types.js';

/** Display metadata never changes the admitted numeric or ISO value. */
export type TableValueFormat =
  | { readonly kind: 'number'; readonly maximumFractionDigits?: number }
  | { readonly kind: 'date' | 'datetime'; readonly timeZone: 'UTC' };

function isoDate(value: string, datetime: boolean): Date | undefined {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value.slice(0, 10));
  if (!date) return undefined;
  const [, year, month, day] = date;
  const calendar = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (calendar.getUTCFullYear() !== Number(year) || calendar.getUTCMonth() + 1 !== Number(month) || calendar.getUTCDate() !== Number(day)) return undefined;
  if (!datetime) return value.length === 10 ? calendar : undefined;
  const time = /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](\d{2}):(\d{2}))$/u.exec(value);
  if (!time || Number(time[1]) > 23 || Number(time[2]) > 59 || Number(time[3]) > 59 || Number(time[4] ?? 0) > 23 || Number(time[5] ?? 0) > 59) return undefined;
  const instant = new Date(value);
  return Number.isFinite(instant.getTime()) ? instant : undefined;
}

/** Strict opt-in formatting: strings never become numbers and arbitrary text never becomes dates. */
export function formatTableValue(value: JsonValue | undefined, format: TableValueFormat | undefined, locale: string): string {
  const plain = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';
  if (!format) return plain;
  if (format.kind === 'number') return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat(locale, { maximumFractionDigits: format.maximumFractionDigits ?? 3 }).format(value) : plain;
  if (typeof value !== 'string') return plain;
  const instant = isoDate(value, format.kind === 'datetime');
  if (!instant) return plain;
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
    ...(format.kind === 'datetime' ? { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' as const } : {}),
  }).format(instant);
}
