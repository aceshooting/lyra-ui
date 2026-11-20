import type { LyraPageSource, LyraCursorSource } from '../../../data-sources.js';
import { cursorQueryText } from './document-library-cursor.js';
import type { LibraryDocument, LibraryDocumentFreshness, LibraryDocumentSortKey } from './document-library-types.js';
export type { LibraryDocument, LibraryDocumentFreshness } from './document-library-types.js';
import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import {
  getOwnDataDescriptor,
  readOwnArrayLength,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';
import type { TableSortDirection } from '../table/table.class.js';

/** Full-source document query; tags use AND semantics and filter receives folded search text. */
export interface DocumentLibrarySourceQuery {
  readonly searchTerm: string;
  readonly tagFilter: readonly string[];
  readonly sortKey: LibraryDocumentSortKey;
  readonly sortDir: 'asc' | 'desc';
  /** The host's `filter` override, or `undefined` for the default match. */
  readonly filter: ((document: LibraryDocument, query: string) => boolean) | undefined;
}
export type DocumentLibrarySource = LyraPageSource<LibraryDocument, DocumentLibrarySourceQuery>;
/** Unknown-total document batches; the provider owns the complete query. */
export type DocumentLibraryCursorSource = LyraCursorSource<LibraryDocument, DocumentLibrarySourceQuery>;
export interface DocumentLibraryQueryChangeDetail {
  readonly searchTerm: string;
  readonly tags: readonly string[];
}

export interface DocumentLibraryFilterChangeDetail {
  readonly searchTerm: string;
  readonly tags: readonly string[];
  readonly matchCount: number;
}
export interface DocumentLibrarySortRequestDetail {
  readonly phase: 'request';
  readonly sortKey: LibraryDocumentSortKey;
  readonly sortDir: TableSortDirection;
}
export interface DocumentLibrarySortCommitDetail {
  readonly phase: 'commit';
  readonly sortKey: LibraryDocumentSortKey;
  readonly sortDir: TableSortDirection;
}
/** Canonical request/commit sort transaction detail. */
export type DocumentLibrarySortDetail =
  | DocumentLibrarySortRequestDetail
  | DocumentLibrarySortCommitDetail;
export interface DocumentLibrarySelectionChangeDetail {
  readonly selectedRowKeys?: readonly string[];
  readonly documentIds: readonly string[];
}
export interface DocumentLibraryOpenDetail {
  readonly documentId: string;
}

export interface LyraDocumentLibraryEventMap {
  'lr-query-change': CustomEvent<LyraEventDetailSnapshot<DocumentLibraryQueryChangeDetail>>;
  'lr-filter-change': CustomEvent<LyraEventDetailSnapshot<DocumentLibraryFilterChangeDetail>>;
  'lr-sort-request': CustomEvent<DocumentLibrarySortRequestDetail>;
  'lr-sort': CustomEvent<DocumentLibrarySortCommitDetail>;
  'lr-selection-change': CustomEvent<LyraEventDetailSnapshot<DocumentLibrarySelectionChangeDetail>>;
  'lr-open': CustomEvent<DocumentLibraryOpenDetail>;
  /** Cancelable retry proposal. The default action clears the parent and nested table error. */
  'lr-retry-request': CustomEvent<null>;
}

export function cursorQuery(value: DocumentLibrarySourceQuery, current: () => boolean): DocumentLibrarySourceQuery {
  const { searchTerm, tagFilter } = cursorQueryText(value.searchTerm, value.tagFilter, current);
  if (!['name', 'version', 'owner', 'freshness', 'updatedAt'].includes(value.sortKey) ||
    (value.sortDir !== 'asc' && value.sortDir !== 'desc') || (value.filter !== undefined && typeof value.filter !== 'function')) throw new TypeError('Invalid cursor query');
  return Object.freeze({ searchTerm, tagFilter, sortKey: value.sortKey, sortDir: value.sortDir, filter: value.filter });
}

export const FRESHNESS_RANK: Record<LibraryDocumentFreshness, number> = {
  fresh: 0,
  aging: 1,
  stale: 2,
};
export const MAX_LIBRARY_COLLECTION_ENTRIES = 10_000;
export const MAX_TAG_FACETS = 500;
export const documentKey = (document: LibraryDocument): string => document.id;
const INVALID_DOCUMENT_DATE = Symbol('invalid-document-date');
export const FRESHNESS_TONE: Record<
  LibraryDocumentFreshness,
  'success' | 'warning' | 'danger'
> = {
  fresh: 'success',
  aging: 'warning',
  stale: 'danger',
};

function projectLibraryStringArray(value: unknown): readonly string[] | undefined {
  try {
    if (!Array.isArray(value)) return undefined;
    const length = readOwnArrayLength(value);
    if (length === undefined) return undefined;
    const tags: string[] = [];
    for (let index = 0; index < Math.min(length, MAX_LIBRARY_COLLECTION_ENTRIES); index += 1) {
      const entry = getOwnDataDescriptor(value, String(index));
      if (
        entry === MISSING_OWN_DATA_DESCRIPTOR ||
        entry === UNSAFE_OWN_DATA_DESCRIPTOR ||
        typeof entry.value !== 'string'
      )
        return undefined;
      tags.push(entry.value);
    }
    return Object.freeze(tags);
  } catch {
    return undefined;
  }
}

function projectLibraryDate(value: unknown): Date | string | typeof INVALID_DOCUMENT_DATE {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return new Date(value);
  try {
    return new Date(Date.prototype.getTime.call(value));
  } catch {
    return INVALID_DOCUMENT_DATE;
  }
}

export function projectLibraryDocument(candidate: unknown): LibraryDocument | undefined {
  try {
    if (
      candidate === null ||
      typeof candidate !== 'object' ||
      Array.isArray(candidate)
    )
      return undefined;
    const id = getOwnDataDescriptor(candidate, 'id');
    const name = getOwnDataDescriptor(candidate, 'name');
    const mimeType = getOwnDataDescriptor(candidate, 'mimeType');
    const uri = getOwnDataDescriptor(candidate, 'uri');
    const version = getOwnDataDescriptor(candidate, 'version');
    const tags = getOwnDataDescriptor(candidate, 'tags');
    const owner = getOwnDataDescriptor(candidate, 'owner');
    const updatedAt = getOwnDataDescriptor(candidate, 'updatedAt');
    const freshness = getOwnDataDescriptor(candidate, 'freshness');
    if (
      id === MISSING_OWN_DATA_DESCRIPTOR ||
      id === UNSAFE_OWN_DATA_DESCRIPTOR ||
      name === MISSING_OWN_DATA_DESCRIPTOR ||
      name === UNSAFE_OWN_DATA_DESCRIPTOR ||
      mimeType === UNSAFE_OWN_DATA_DESCRIPTOR ||
      uri === UNSAFE_OWN_DATA_DESCRIPTOR ||
      version === UNSAFE_OWN_DATA_DESCRIPTOR ||
      tags === UNSAFE_OWN_DATA_DESCRIPTOR ||
      owner === UNSAFE_OWN_DATA_DESCRIPTOR ||
      updatedAt === UNSAFE_OWN_DATA_DESCRIPTOR ||
      freshness === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof id.value !== 'string' ||
      id.value.trim().length === 0 ||
      typeof name.value !== 'string'
    )
      return undefined;

    const mimeTypeValue = mimeType === MISSING_OWN_DATA_DESCRIPTOR ? undefined : mimeType.value;
    const uriValue = uri === MISSING_OWN_DATA_DESCRIPTOR ? undefined : uri.value;
    const versionValue = version === MISSING_OWN_DATA_DESCRIPTOR ? undefined : version.value;
    const ownerValue = owner === MISSING_OWN_DATA_DESCRIPTOR ? undefined : owner.value;
    const freshnessValue = freshness === MISSING_OWN_DATA_DESCRIPTOR ? undefined : freshness.value;
    if (
      (mimeTypeValue !== undefined && typeof mimeTypeValue !== 'string') ||
      (uriValue !== undefined && typeof uriValue !== 'string') ||
      (versionValue !== undefined && typeof versionValue !== 'string') ||
      (ownerValue !== undefined && typeof ownerValue !== 'string') ||
      (freshnessValue !== undefined &&
        freshnessValue !== 'fresh' &&
        freshnessValue !== 'aging' &&
        freshnessValue !== 'stale')
    )
      return undefined;

    const tagsValue = tags === MISSING_OWN_DATA_DESCRIPTOR ? undefined : tags.value;
    const tagValues = tagsValue === undefined ? undefined : projectLibraryStringArray(tagsValue);
    if (tagsValue !== undefined && !tagValues) return undefined;
    const updatedAtValue = updatedAt === MISSING_OWN_DATA_DESCRIPTOR || updatedAt.value === undefined
      ? undefined
      : projectLibraryDate(updatedAt.value);
    if (updatedAtValue === INVALID_DOCUMENT_DATE) return undefined;

    return Object.freeze({
      id: id.value,
      name: name.value,
      ...(mimeTypeValue === undefined ? {} : { mimeType: mimeTypeValue }),
      ...(uriValue === undefined ? {} : { uri: uriValue }),
      ...(versionValue === undefined ? {} : { version: versionValue }),
      ...(tagValues === undefined ? {} : { tags: tagValues }),
      ...(ownerValue === undefined ? {} : { owner: ownerValue }),
      ...(updatedAtValue === undefined ? {} : { updatedAt: updatedAtValue }),
      ...(freshnessValue === undefined ? {} : { freshness: freshnessValue }),
    });
  } catch {
    return undefined;
  }
}

