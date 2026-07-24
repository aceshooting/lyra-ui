const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/** Maps each byte-unit abbreviation to its localization key. */
export const FILE_SIZE_UNIT_KEYS: Record<(typeof BYTE_UNITS)[number], string> = {
  B: 'fileSizeUnitB',
  KB: 'fileSizeUnitKb',
  MB: 'fileSizeUnitMb',
  GB: 'fileSizeUnitGb',
  TB: 'fileSizeUnitTb',
};

/**
 * `512` -> `"512 B"`; `2415919` -> `"2.3 MB"`. Whole bytes never get a
 * decimal; every larger unit gets exactly one decimal place. Returns `""`
 * for a negative or non-finite input.
 */
export function formatFileSize(
  bytes: number,
  unitLabel: (unit: (typeof BYTE_UNITS)[number]) => string = (unit) => unit,
  numberLabel: (value: number, fractionDigits: number) => string = (value, fractionDigits) =>
    value.toFixed(fractionDigits),
): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${numberLabel(Math.round(bytes), 0)} ${unitLabel('B')}`;
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${numberLabel(value, 1)} ${unitLabel(BYTE_UNITS[unitIndex]!)}`;
}
