import type { RetrievalChunk } from '../../../ai/types.js';
import { readOwnDataValue } from '../../../internal/data-descriptors.js';
import { snapshotPublicCollection } from '../../../internal/collection-snapshot.js';
import { isValidRetrievalChunk } from '../retrieval-identity.js';


function fields(value: object, keys: readonly string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const field = readOwnDataValue(value, key);
    if (field !== undefined) result[key] = field;
  }
  return result;
}

/** Copies the rendering schema without traversing opaque metadata or invoking source accessors. */
export function projectRetrievalChunk(value: unknown): RetrievalChunk | undefined {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const sourceValue = readOwnDataValue(value, 'source');
    if (!sourceValue || typeof sourceValue !== 'object' || Array.isArray(sourceValue)) return undefined;
    const source = fields(sourceValue, ['id', 'name', 'mimeType', 'uri', 'version']);
    const row = fields(value, ['id', 'text', 'score', 'metadata', 'rank', 'queryId', 'stage', 'traceId']);
    row['source'] = Object.freeze(source);
    if (!isValidRetrievalChunk(row)) return undefined;
    const locator = readOwnDataValue(value, 'locator');
    if (locator !== undefined) row.locator = snapshotPublicCollection(locator) as RetrievalChunk['locator'];
    const scores = readOwnDataValue(value, 'scores');
    if (scores && typeof scores === 'object' && !Array.isArray(scores)) {
      row.scores = Object.freeze(fields(scores, ['dense', 'sparse', 'rerank', 'final'])) as unknown as RetrievalChunk['scores'];
    }
    return Object.freeze(row);
  } catch { return undefined; }
}
