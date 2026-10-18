import type { LyraSourceRecord } from '../../../data-sources.js';
import { getOwnDataDescriptor, MISSING_OWN_DATA_DESCRIPTOR, UNSAFE_OWN_DATA_DESCRIPTOR } from '../../../internal/data-descriptors.js';
import type { RubricKey, RubricValue } from '../../forms/rubric-form/rubric-form.class.js';
import type { EvalRunResult } from './eval-run-result.js';

type Current = () => boolean;
function read(value: unknown, key: string, current: Current, required = false): unknown {
  if (!current()) throw new Error('Source record revoked');
  if (!value || typeof value !== 'object') throw new TypeError('Invalid source run');
  const descriptor = getOwnDataDescriptor(value, key);
  if (!current()) throw new Error('Source record revoked');
  if (descriptor === UNSAFE_OWN_DATA_DESCRIPTOR || (required && descriptor === MISSING_OWN_DATA_DESCRIPTOR)) throw new TypeError('Invalid source field');
  return descriptor === MISSING_OWN_DATA_DESCRIPTOR ? undefined : descriptor.value;
}

/** Fixed fields are owned; complete score/review dictionaries remain opaque provider values. */
export function projectEvalSourceRun(record: LyraSourceRecord<unknown>, current: Current): EvalRunResult {
  const id = read(record.value, 'id', current, true);
  const label = read(record.value, 'label', current, true);
  const model = read(record.value, 'model', current);
  const promptVersion = read(record.value, 'promptVersion', current);
  const output = read(record.value, 'output', current);
  let units = 0;
  for (const value of [id, label, model, promptVersion, output]) {
    if (value !== undefined && typeof value !== 'string') throw new TypeError('Invalid source run text');
    units += typeof value === 'string' ? value.length : 0;
  }
  if (typeof id !== 'string' || !id.trim() || id !== record.key || typeof label !== 'string' || units > 65_536) throw new TypeError('Invalid source run');
  const scores = read(record.value, 'scores', current);
  const review = read(record.value, 'review', current);
  for (const value of [scores, review]) if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('Invalid source run values');
  return Object.freeze({ id, label, ...(model === undefined ? {} : { model: model as string }), ...(promptVersion === undefined ? {} : { promptVersion: promptVersion as string }), output: output as string ?? '', ...(scores === undefined ? {} : { scores: scores as RubricValue }), ...(review === undefined ? {} : { review: review as RubricValue }) });
}

/** Inspect configured fields only; the child retains its existing rubric normalization semantics. */
export function projectEvalSourceReview(review: RubricValue | undefined, keys: readonly RubricKey[], current: Current): RubricValue {
  const value: Record<string, number | string | readonly string[] | undefined> = Object.create(null);
  let entries = 0; let units = 0;
  for (const key of keys) {
    if (++entries > 10_000) throw new RangeError('Source review too large');
    units += key.key.length;
    const field = review === undefined ? undefined : read(review, key.key, current);
    if (typeof field === 'string') { units += field.length; value[key.key] = field; }
    else if (typeof field === 'number' && Number.isFinite(field)) value[key.key] = field;
    else if (field === undefined) value[key.key] = undefined;
    else if (Array.isArray(field)) {
      const length = read(field, 'length', current, true);
      if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 || entries + length > 10_000) throw new RangeError('Source review too large');
      entries += length; const values: string[] = [];
      for (let index = 0; index < length; index++) {
        const item = read(field, String(index), current, true);
        if (typeof item !== 'string') throw new TypeError('Invalid source review value');
        units += item.length;
        if (units > 65_536) throw new RangeError('Source review too large');
        values.push(item);
      }
      value[key.key] = Object.freeze(values);
    } else throw new TypeError('Invalid source review value');
    if (units > 65_536) throw new RangeError('Source review too large');
  }
  return Object.freeze(value);
}
