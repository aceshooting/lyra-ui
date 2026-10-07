import { readOwnDataValue } from './data-descriptors.js';

export interface LyraLabeledOption {
  readonly value: string;
  readonly label?: string;
}

export function boundedRecordString(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

/** Normalize a bounded, first-value-wins option list without reading provider accessors. */
export function normalizeLabeledOptions(value: unknown, maxCount: number, maxText: number): readonly LyraLabeledOption[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  const seen = new Set<string>();
  const result: LyraLabeledOption[] = [];
  for (const candidate of value.slice(0, maxCount)) {
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const optionValue = boundedRecordString(readOwnDataValue(candidate, 'value'), maxText);
    if (!optionValue.trim() || seen.has(optionValue)) continue;
    seen.add(optionValue);
    const label = boundedRecordString(readOwnDataValue(candidate, 'label'), maxText);
    result.push(Object.freeze({ value: optionValue, ...(label ? { label } : {}) }));
  }
  return Object.freeze(result);
}
