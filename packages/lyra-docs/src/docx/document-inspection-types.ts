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
