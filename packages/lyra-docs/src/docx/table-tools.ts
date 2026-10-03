import type { DocxResult, DocxRevision, DocxSelectionLease, DocxSession, DocxTableAction } from './types.js';

/** UI drafts stay strings so empty, fractional and incomplete input cannot become a default. */
export function tableInsertDraft(rows: string, columns: string): DocxTableAction | null {
  const dimension = (value: string) => /^\d{1,2}$/.test(value) && Number(value) >= 1 && Number(value) <= 20;
  return dimension(rows) && dimension(columns) ? { type: 'insert-table', rows: Number(rows), columns: Number(columns) } : null;
}

/** A dialog keeps its original intent even after the facade invalidates its selection lease. */
class TableToolIntent {
  private released = false;
  constructor(private readonly session: DocxSession, private readonly lease: DocxSelectionLease,
    private readonly revision: DocxRevision, private readonly selectionVersion: number) {}
  valid(session: DocxSession | null): boolean {
    const snapshot = session?.snapshot();
    return !this.released && session === this.session && snapshot?.status === 'ready' &&
      snapshot.revision?.documentId === this.revision.documentId && snapshot.revision.value === this.revision.value &&
      snapshot.selection.version === this.selectionVersion && snapshot.selection.kind === 'caret';
  }
  execute(session: DocxSession | null, action: DocxTableAction): DocxResult<DocxRevision> {
    try {
      if (!this.valid(session)) return { ok: false, code: 'stale-selection' };
      return this.session.execute(action, { expectedRevision: this.revision, selection: this.lease });
    } finally { this.release(); }
  }
  release(): void {
    if (this.released) return;
    this.released = true;
    this.lease.release();
  }
}

export function captureTableToolIntent(session: DocxSession | null): TableToolIntent | null {
  const snapshot = session?.snapshot();
  if (!session || snapshot?.status !== 'ready' || !snapshot.revision || snapshot.selection.kind !== 'caret') return null;
  const retained = session.retainSelection();
  if (!retained.ok) return null;
  const intent = new TableToolIntent(session, retained.value, snapshot.revision, snapshot.selection.version);
  if (intent.valid(session)) return intent;
  intent.release();
  return null;
}
