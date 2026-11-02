import type { DocxRevision } from './types.js';

/** A copied body heading. Level 1 is Word's outline level zero. IDs are revision scoped. */
export interface DocxOutlineItem {
  readonly id: string;
  readonly level: number;
  readonly text: string;
  readonly textTruncated: boolean;
}
export interface DocxOutline {
  readonly revision: DocxRevision;
  readonly items: readonly DocxOutlineItem[];
  readonly truncated: boolean;
}
export type DocxDocumentDiagnosticRule =
  | 'heading-level-skipped' | 'image-description-missing' | 'table-header-missing' | 'unsupported-content';
/** Rule data contains bounded scalar substitutions, never engine messages or visible labels. */
export interface DocxDocumentDiagnostic {
  readonly rule: DocxDocumentDiagnosticRule;
  readonly data: Readonly<Record<string, string | number>>;
  readonly locationId: string | null;
}
export type DocxDocumentCapabilityCode = 'body-headings' | 'inline-image-descriptions' | 'simple-table-headers';
export type DocxCapabilityFact = 'supported' | 'unsupported' | 'unverified';
/**
 * Counts inspected objects in this query's profile. Refused means at least one observed
 * object could not be checked. Preservation, rendering and authoring are unverified:
 * this metadata query performs no export, layout qualification or editing preflight.
 */
export interface DocxDocumentCapability {
  readonly code: DocxDocumentCapabilityCode;
  readonly count: number;
  readonly preserved: DocxCapabilityFact;
  readonly renderable: DocxCapabilityFact;
  readonly editable: DocxCapabilityFact;
  readonly refused: boolean;
}
/** Bounded body metadata checks; neither an accessibility certification nor a format audit. */
export interface DocxDocumentInspection {
  readonly revision: DocxRevision;
  readonly scope: 'body';
  readonly diagnostics: readonly DocxDocumentDiagnostic[];
  readonly capabilities: readonly DocxDocumentCapability[];
  readonly truncated: boolean;
}

export type DocxFragmentBlockKind = 'paragraph' | 'table' | 'other';
/**
 * One copied top-level body block. `id` is present for paragraphs only; it is revision scoped,
 * selectable with `selectFragmentBlock()` and usable as an edit-batch target until the next
 * content edit. Text is the plain run text: tabs and breaks as `\t`/`\n`; in tables, cells are
 * separated by tabs, rows by line breaks and a cell's paragraphs by spaces. Deleted revision text
 * and field instructions are omitted.
 */
export interface DocxFragmentBlock {
  readonly id: string | null;
  /** Zero-based position among the body's top-level blocks at this revision. */
  readonly index: number;
  readonly kind: DocxFragmentBlockKind;
  /** The paragraph's direct style id, or null. */
  readonly styleId: string | null;
  /** 1–9 from a direct or style-inherited outline level or a "heading N" style; otherwise null. */
  readonly headingLevel: number | null;
  readonly text: string;
  readonly textTruncated: boolean;
}
/** A bounded, contiguous slice of body blocks. Continue from `next` while it is not null. */
export interface DocxFragment {
  readonly revision: DocxRevision;
  readonly start: number;
  /** Count of top-level body blocks at this revision. */
  readonly blockCount: number;
  readonly next: number | null;
  /** True when any returned block's text was clipped by a text or traversal budget. */
  readonly truncated: boolean;
  readonly blocks: readonly DocxFragmentBlock[];
}
/** Start at a block index (default 0) or at an outline item; never both. */
export interface DocxFragmentRequest {
  readonly start?: number;
  /** An id from the latest `outline()` at the current revision. */
  readonly outlineItemId?: string;
  /** 1–64 blocks; defaults to 16. */
  readonly maxBlocks?: number;
  /** 1–32,768 UTF-16 code units across the fragment; defaults to 8,192. */
  readonly maxText?: number;
  readonly expectedRevision?: DocxRevision;
}
