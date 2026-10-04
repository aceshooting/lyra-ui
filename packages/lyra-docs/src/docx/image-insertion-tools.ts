import { imageDescriptionDraft, imageDimensionDraft, imageResizeDraft } from './image-tools.js';
import type { DocxImageContext, DocxImageSource, DocxResult, DocxRevision, DocxSelectionLease, DocxSession } from './types.js';

interface ImageInsertionDefaults {
  readonly width: string;
  readonly height: string;
  readonly ratioAvailable: boolean;
  readonly original: Readonly<DocxImageContext>;
}
interface ImageInsertionIntent {
  valid(session: DocxSession | null): boolean;
  dispatch(source: DocxImageSource): Promise<DocxResult<DocxRevision>>;
  release(): void;
}

/** Scale encoded pixels at 96dpi without fitting to a page or replacing their original ratio. */
export function imageInsertionDefaults(pixelWidth: number, pixelHeight: number): ImageInsertionDefaults | null {
  if (![pixelWidth, pixelHeight].every(value => Number.isInteger(value) && value >= 1 && value <= 8192)) return null;
  const original = Object.freeze({ widthPoints: pixelWidth, heightPoints: pixelHeight });
  const width = pixelWidth * 0.75, height = pixelHeight * 0.75;
  const lower = Math.max(1 / width, 1 / height), upper = Math.min(1440 / width, 1440 / height);
  if (lower > upper) return Object.freeze({ width: '', height: '', ratioAvailable: false, original });
  const scale = Math.max(lower, Math.min(1, upper));
  return Object.freeze({ width: imageDimensionDraft(Math.min(1440, Math.max(1, width * scale))),
    height: imageDimensionDraft(Math.min(1440, Math.max(1, height * scale))), ratioAvailable: true, original });
}

/** The caller owns already inspected bytes; draft scalars retain their full precision. */
export function imageInsertionDraft(bytes: Uint8Array, width: string, height: string, title: string, description: string): DocxImageSource | null {
  if (bytes.length < 1 || bytes.length > 4 * 1024 * 1024 || title.includes('\r') || description.includes('\r')) return null;
  const dimensions = imageResizeDraft(width, height), metadata = imageDescriptionDraft(title, description);
  return dimensions && metadata ? { bytes, widthPoints: dimensions.widthPoints, heightPoints: dimensions.heightPoints,
    title: metadata.title, description: metadata.description } : null;
}

class CaretInsertionIntent implements ImageInsertionIntent {
  private phase: 'owned' | 'dispatched' | 'released' = 'owned';
  constructor(private readonly session: DocxSession, private readonly lease: DocxSelectionLease,
    private readonly revision: DocxRevision, private readonly selectionVersion: number) {}
  valid(session: DocxSession | null): boolean {
    const snapshot = session?.snapshot();
    return this.phase === 'owned' && session === this.session && snapshot?.status === 'ready' &&
      snapshot.revision?.documentId === this.revision.documentId && snapshot.revision.value === this.revision.value &&
      snapshot.selection.version === this.selectionVersion;
  }
  async dispatch(source: DocxImageSource): Promise<DocxResult<DocxRevision>> {
    if (!this.valid(this.session)) { this.release(); return { ok: false, code: 'stale-selection' }; }
    this.phase = 'dispatched';
    try { return await this.session.insertImage(source, { expectedRevision: this.revision, selection: this.lease }); }
    finally { this.phase = 'released'; this.lease.release(); }
  }
  release(): void {
    if (this.phase !== 'owned') return;
    this.phase = 'released'; this.lease.release();
  }
}

/** Capture once before file activation; no changed caret can repair this intent. */
export function captureImageInsertionIntent(session: DocxSession | null): ImageInsertionIntent | null {
  const snapshot = session?.snapshot();
  if (!session || snapshot?.status !== 'ready' || !snapshot.revision || !session.canInsertImage().enabled) return null;
  const retained = session.retainSelection();
  if (!retained.ok) return null;
  const intent = new CaretInsertionIntent(session, retained.value, snapshot.revision, snapshot.selection.version);
  if (intent.valid(session)) return intent;
  intent.release(); return null;
}
