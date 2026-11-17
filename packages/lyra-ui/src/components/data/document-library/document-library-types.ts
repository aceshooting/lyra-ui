import type { DocumentRef } from '../../../ai/types.js';

/** How recently a document's content was verified/updated, consumer-computed (this component
 *  performs no staleness calculation of its own -- it only renders whichever bucket the host
 *  already assigned). Ordered fresh -> aging -> stale for `freshness`-column sorting. */
export type LibraryDocumentFreshness = 'fresh' | 'aging' | 'stale';

/**
 * One inventory row. Extends the shared `DocumentRef` (`src/ai/types.ts`) -- `id`/`name`/
 * `mimeType`/`uri`/`version` assign directly onto/from it with no adapter -- with the
 * tags/owner/freshness fields specific to an inventory view that the provider-neutral
 * `DocumentRef` deliberately doesn't carry. `updatedAt` reuses
 * `ChatMessage.timestamp`'s own `Date | string` shape from the same `src/ai/types.ts` module for
 * consistency across this component family.
 */
export interface LibraryDocument extends DocumentRef {
  /** Optional tags. An own undefined value is treated like omission. */
  tags?: readonly string[];
  owner?: string;
  /** Last-updated timestamp. `Date | string` (ISO-8601), matching `ChatMessage.timestamp`. */
  updatedAt?: Date | string;
  freshness?: LibraryDocumentFreshness;
}

/** Column keys `sortKey` accepts. Not every column is sortable (`type`/`tags`/`select` are not). */
export type LibraryDocumentSortKey =
  | 'name'
  | 'version'
  | 'owner'
  | 'freshness'
  | 'updatedAt';
