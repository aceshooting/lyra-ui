import { captureSelectionIntent, type DocxSelectionIntent } from './selection-intent.js';
import type { DocxSession, DocxTableAction } from './types.js';

/** UI drafts stay strings so empty, fractional and incomplete input cannot become a default. */
export function tableInsertDraft(rows: string, columns: string): DocxTableAction | null {
  const dimension = (value: string) => /^\d{1,2}$/.test(value) && Number(value) >= 1 && Number(value) <= 20;
  return dimension(rows) && dimension(columns) ? { type: 'insert-table', rows: Number(rows), columns: Number(columns) } : null;
}

export function captureTableToolIntent(session: DocxSession | null): DocxSelectionIntent | null {
  return captureSelectionIntent(session, snapshot => snapshot.selection.kind === 'caret');
}
