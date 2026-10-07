import type { DocxAction, DocxImageSource, DocxResult, DocxRevision, DocxSelectionLease, DocxSession, DocxSnapshot } from './types.js';

/** Owns one retained selection from capture through execution or release. */
export class DocxSelectionIntent {
  private phase: 'owned' | 'dispatched' | 'released' = 'owned';

  constructor(
    private readonly session: DocxSession,
    private readonly lease: DocxSelectionLease,
    private readonly revision: DocxRevision,
    private readonly selectionVersion: number,
    private readonly qualifies: (snapshot: DocxSnapshot) => boolean,
  ) {}

  valid(session: DocxSession | null): boolean {
    const snapshot = session?.snapshot();
    return this.phase === 'owned' && session === this.session && snapshot?.status === 'ready' &&
      snapshot.revision?.documentId === this.revision.documentId && snapshot.revision.value === this.revision.value &&
      snapshot.selection.version === this.selectionVersion && this.qualifies(snapshot);
  }

  execute(session: DocxSession | null, action: DocxAction): DocxResult<DocxRevision> {
    try {
      if (!this.valid(session)) return { ok: false, code: 'stale-selection' };
      return this.session.execute(action, { expectedRevision: this.revision, selection: this.lease });
    } finally { this.release(); }
  }

  async insertImage(source: DocxImageSource): Promise<DocxResult<DocxRevision>> {
    if (!this.valid(this.session)) { this.release(); return { ok: false, code: 'stale-selection' }; }
    this.phase = 'dispatched';
    try { return await this.session.insertImage(source, { expectedRevision: this.revision, selection: this.lease }); }
    finally { this.phase = 'released'; this.lease.release(); }
  }

  release(): void {
    if (this.phase !== 'owned') return;
    this.phase = 'released';
    this.lease.release();
  }
}

export function captureSelectionIntent(session: DocxSession | null, qualifies: (snapshot: DocxSnapshot) => boolean, captured?: DocxSnapshot): DocxSelectionIntent | null {
  const snapshot = captured ?? session?.snapshot();
  if (!session || snapshot?.status !== 'ready' || !snapshot.revision || !qualifies(snapshot)) return null;
  const retained = session.retainSelection();
  if (!retained.ok) return null;
  const intent = new DocxSelectionIntent(session, retained.value, snapshot.revision, snapshot.selection.version, qualifies);
  if (intent.valid(session)) return intent;
  intent.release();
  return null;
}
