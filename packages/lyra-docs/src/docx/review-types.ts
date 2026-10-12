import type { DocxAction, DocxResult, DocxRevision } from './types.js';
import { ownDataRecord } from './own-data-record.js';
import { isDocxXmlText } from './xml-text.js';

export type DocxReviewKind = 'comment' | 'insert' | 'delete' | 'unsupported';
export type DocxReviewDecision = 'accept' | 'reject' | 'resolve' | 'reopen' | 'delete';
/** Copied review text. Identifiers are opaque and expire after a document edit. */
export interface DocxReviewItem {
  readonly id: string;
  readonly kind: DocxReviewKind;
  readonly text: string;
  readonly author: string;
  readonly date?: string;
  readonly resolved?: boolean;
  readonly parentId?: string;
  readonly readOnly: boolean;
  readonly orphaned: boolean;
  readonly navigable: boolean;
}
export interface DocxReviewReport {
  readonly revision: DocxRevision;
  readonly items: readonly DocxReviewItem[];
  readonly truncated: boolean;
  readonly hasUnsupported: boolean;
  readonly trackingSupported: boolean;
  readonly enabled: boolean;
  readonly author: string | null;
}
export type DocxReviewAction =
  | Readonly<{ type: 'add-comment'; text: string; author: string }>
  | Readonly<{ type: 'reply-comment'; id: string; text: string; author: string }>
  | Readonly<{ type: 'review-decision'; id: string; decision: DocxReviewDecision }>
  | Readonly<{ type: 'track-changes'; enabled: boolean; author: string }>;

export const DOCX_REVIEW_LIMITS = Object.freeze({ author: 128, text: 4096, id: 256, items: 100 });
/** Discriminator for actions already copied by the public normalizer. */
export function isDocxReviewAction(action: DocxAction): action is DocxReviewAction {
  return typeof action === 'object' && ['add-comment', 'reply-comment', 'review-decision', 'track-changes'].includes(action.type);
}
const invalid = { ok: false, code: 'invalid-option' } as const;
/** Own data only: normalizing an action never invokes caller accessors. */
export function normalizeDocxReviewAction(value: unknown): DocxResult<DocxReviewAction> {
  try {
    const action = ownDataRecord(value);
    if (!action) return invalid;
    const type = action['type'];
    const allowed = type === 'add-comment' ? ['type', 'text', 'author'] : type === 'reply-comment' ? ['type', 'id', 'text', 'author'] :
      type === 'review-decision' ? ['type', 'id', 'decision'] : type === 'track-changes' ? ['type', 'enabled', 'author'] : null;
    if (!allowed) return { ok: false, code: 'unsupported' };
    if (Object.keys(action).some(key => !allowed.includes(key))) return invalid;
    for (const key of allowed.filter(key => key === 'author' || key === 'text' || key === 'id')) {
      const text = action[key];
      if (typeof text !== 'string' || !text.trim() || !isDocxXmlText(text)) return invalid;
      if (text.length > DOCX_REVIEW_LIMITS[key as 'author' | 'text' | 'id']) return { ok: false, code: 'resource-limit' };
    }
    if (type === 'track-changes' && typeof action['enabled'] !== 'boolean') return invalid;
    if (type === 'review-decision' && (typeof action['decision'] !== 'string' || !['accept', 'reject', 'resolve', 'reopen', 'delete'].includes(action['decision']))) return invalid;
    return { ok: true, value: Object.freeze(action) as unknown as DocxReviewAction };
  } catch { return invalid; }
}
