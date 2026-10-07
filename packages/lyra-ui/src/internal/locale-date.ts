import { getDateTimeFormat, getNumberFormat } from './intl-cache.js';

export type LocaleDateField = 'day' | 'month' | 'year';

const BIDI_FORMATTING_MARKS = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu;
const UNICODE_DECIMAL_DIGIT = /^\p{Nd}$/u;

/** Removes the bidi formatting controls that Intl may include around localized digits. */
export function stripBidiFormattingMarks(text: string): string {
  return text.replace(BIDI_FORMATTING_MARKS, '');
}

/** Determines day/month/year order from a real sample; `calendar` preserves each caller's format. */
export function localeDateOrder(
  locale: string,
  calendar?: Intl.DateTimeFormatOptions['calendar'],
): LocaleDateField[] {
  try {
    const parts = getDateTimeFormat(locale, {
      ...(calendar ? { calendar } : {}),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(2026, 0, 2));
    const order = parts
      .filter(
        (part): part is Intl.DateTimeFormatPart & { type: LocaleDateField } =>
          part.type === 'day' || part.type === 'month' || part.type === 'year',
      )
      .map((part) => part.type);
    return order.length === 3 ? order : ['month', 'day', 'year'];
  } catch {
    return ['month', 'day', 'year'];
  }
}

function unicodeDecimalValue(character: string): number | undefined {
  const codePoint = character.codePointAt(0);
  if (codePoint === undefined || !UNICODE_DECIMAL_DIGIT.test(character)) return undefined;
  if (codePoint >= 0x30 && codePoint <= 0x39) return codePoint - 0x30;
  let rangeStart = codePoint;
  while (rangeStart > 0 && UNICODE_DECIMAL_DIGIT.test(String.fromCodePoint(rangeStart - 1))) {
    rangeStart--;
  }
  return (codePoint - rangeStart) % 10;
}

/** Builds the non-decimal locale digit substitutions that Intl formats for this locale. */
export function localeDigitMap(locale: string): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  try {
    const formatter = getNumberFormat(locale, { useGrouping: false });
    for (let digit = 0; digit <= 9; digit++) {
      const localized = stripBidiFormattingMarks(formatter.format(digit));
      if (localized && localized !== String(digit)) map.set(localized, String(digit));
    }
  } catch {
    return map;
  }

  return map;
}

/** Converts Unicode decimal and locale-native digits to ASCII after removing bidi marks. */
export function normalizeLocaleDigits(
  text: string,
  locale: string,
  digits: ReadonlyMap<string, string> = localeDigitMap(locale),
): string {
  let normalized = '';
  for (const character of stripBidiFormattingMarks(text)) {
    const value = unicodeDecimalValue(character);
    normalized += value === undefined ? digits.get(character) ?? character : String(value);
  }
  return normalized;
}
