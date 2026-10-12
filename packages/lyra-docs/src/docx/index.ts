export type * from './types.js';
export { createDocxSession } from './create-session.js';
export type * from './document-inspection-types.js';
export type { DocxReviewAction, DocxReviewDecision, DocxReviewItem, DocxReviewKind, DocxReviewReport } from './review-types.js';
export { DOCX_COMMAND_CATALOG, buildDocxCommandAction } from './command-catalog.js';
export type { DocxCommandDescriptor, DocxCommandGroup, DocxCommandIntent } from './command-catalog.js';
