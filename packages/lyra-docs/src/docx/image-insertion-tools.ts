import { imageDescriptionDraft, imageDimensionDraft, imageResizeDraft } from './image-tools.js';
import { captureSelectionIntent, type DocxSelectionIntent } from './selection-intent.js';
import type { DocxImageContext, DocxImageSource, DocxResult, DocxRevision, DocxSession } from './types.js';

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
  constructor(private readonly intent: DocxSelectionIntent) {}
  valid(session: DocxSession | null): boolean {
    return this.intent.valid(session);
  }
  async dispatch(source: DocxImageSource): Promise<DocxResult<DocxRevision>> {
    return this.intent.insertImage(source);
  }
  release(): void {
    this.intent.release();
  }
}

/** Capture once before file activation; no changed caret can repair this intent. */
export function captureImageInsertionIntent(session: DocxSession | null): ImageInsertionIntent | null {
  const snapshot = session?.snapshot();
  if (!session || snapshot?.status !== 'ready' || !snapshot.revision || !session.canInsertImage().enabled) return null;
  const retained = captureSelectionIntent(session, () => true, snapshot);
  return retained ? new CaretInsertionIntent(retained) : null;
}
