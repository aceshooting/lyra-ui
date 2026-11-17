import { getOwnDataDescriptor, MISSING_OWN_DATA_DESCRIPTOR, UNSAFE_OWN_DATA_DESCRIPTOR } from '../../../internal/data-descriptors.js';
import { LYRA_VARIANT_VALUES, type LyraVariant } from '../../../internal/variants.js';
import { finiteInteger } from '../../../internal/numbers.js';

/** Caller-localized presentation for an explicitly custom ingestion stage. */
export interface IngestionQueueStagePresentation {
  readonly id: string;
  readonly label: string;
  readonly variant?: LyraVariant;
  readonly showProgress?: boolean;
}

/** An explicit list replaces the row's default actions. Built-ins retain stage eligibility. */
export type IngestionQueueAction =
  | { readonly type: 'retry' | 'cancel'; readonly disabled?: boolean }
  | { readonly type: 'custom'; readonly id: string; readonly label: string; readonly disabled?: boolean };

/** Controlled host action intent; the queue performs no transport or authorization. */
export interface IngestionItemActionEventDetail {
  readonly itemId: string;
  readonly actionId: string;
}

/** Maximum inspected action positions in one row. */
export const INGESTION_ITEM_ACTION_LIMIT = 32;
const MAX_PRESENTATION_TEXT = 65_536;
const EMPTY_ACTIONS: readonly IngestionQueueAction[] = Object.freeze([]);

export interface IngestionPresentationProjection {
  readonly customStage?: IngestionQueueStagePresentation;
  readonly actions?: readonly IngestionQueueAction[];
  readonly actionLimit?: Readonly<{ source: number; retained: number }>;
}

const EMPTY_PRESENTATION: IngestionPresentationProjection = Object.freeze({});

function record(value: unknown): value is object {
  try { return value !== null && typeof value === 'object' && !Array.isArray(value); }
  catch { return false; }
}

/** Descriptor-safe bounded display projection, shared by array and provider rows. */
export function projectIngestionPresentation(
  raw: object,
  stage: unknown,
  isCurrent: () => boolean = () => true,
  maxTextUnits = MAX_PRESENTATION_TEXT,
): IngestionPresentationProjection {
  const read = (value: object, key: PropertyKey): unknown => {
    if (!isCurrent()) throw new TypeError('Obsolete ingestion presentation');
    const descriptor = getOwnDataDescriptor(value, key);
    if (!isCurrent()) throw new TypeError('Obsolete ingestion presentation');
    return descriptor === MISSING_OWN_DATA_DESCRIPTOR ? undefined
      : descriptor === UNSAFE_OWN_DATA_DESCRIPTOR ? UNSAFE_OWN_DATA_DESCRIPTOR : descriptor.value;
  };
  let candidate: unknown;
  if (stage !== 'custom') {
    candidate = read(raw, 'actions');
    if (candidate === undefined) return EMPTY_PRESENTATION;
  }
  let remaining = finiteInteger(maxTextUnits, MAX_PRESENTATION_TEXT, 0, MAX_PRESENTATION_TEXT);
  const text = (value: unknown): string | undefined => {
    if (typeof value !== 'string' || value.trim() === '' || value.length > remaining) return undefined;
    remaining -= value.length;
    return value;
  };
  let customStage: IngestionQueueStagePresentation | undefined;
  if (stage === 'custom') {
    const presentation = read(raw, 'customStage');
    if (record(presentation)) {
      const id = text(read(presentation, 'id'));
      const label = text(read(presentation, 'label'));
      const candidateVariant = read(presentation, 'variant');
      const variant = LYRA_VARIANT_VALUES.find(value => value === candidateVariant) ?? 'neutral';
      const showProgress = read(presentation, 'showProgress') === true;
      if (id !== undefined && label !== undefined) customStage = Object.freeze({ id, label, variant, showProgress });
    }
  }
  if (stage === 'custom') candidate = read(raw, 'actions');
  if (candidate === undefined) return customStage ? Object.freeze({ customStage }) : EMPTY_PRESENTATION;
  const result: IngestionQueueAction[] = [];
  const finish = (actionLimit?: Readonly<{ source: number; retained: number }>): IngestionPresentationProjection => Object.freeze({
    ...(customStage ? { customStage } : {}), actions: result.length ? Object.freeze(result) : EMPTY_ACTIONS,
    ...(actionLimit ? { actionLimit } : {}),
  });
  let array = false;
  try { array = Array.isArray(candidate); } catch { /* An explicit unreadable list is actionless. */ }
  if (!array) return finish();
  const length = read(candidate as object, 'length');
  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) return finish();
  const seen = new Set<string>();
  for (let index = 0; index < Math.min(length, INGESTION_ITEM_ACTION_LIMIT); index++) {
    const entry = read(candidate as object, index);
    if (!record(entry)) continue;
    const type = read(entry, 'type');
    const disabled = read(entry, 'disabled');
    if (disabled !== undefined && typeof disabled !== 'boolean') continue;
    if (type === 'retry' || type === 'cancel') {
      if (seen.has(type)) continue;
      seen.add(type);
      result.push(Object.freeze({ type, ...(disabled === undefined ? {} : { disabled }) }));
    } else if (type === 'custom') {
      const id = text(read(entry, 'id'));
      const label = text(read(entry, 'label'));
      if (id === undefined || label === undefined || seen.has(`custom:${id}`)) continue;
      seen.add(`custom:${id}`);
      result.push(Object.freeze({ type, id, label, ...(disabled === undefined ? {} : { disabled }) }));
    }
  }
  return finish(length > INGESTION_ITEM_ACTION_LIMIT ? Object.freeze({ source: length, retained: result.length }) : undefined);
}

export function ingestionActionKey(action: IngestionQueueAction): string {
  return action.type === 'custom' ? `custom:${action.id}` : action.type;
}
