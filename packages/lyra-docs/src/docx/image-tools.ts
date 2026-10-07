import { normalizeDocxAction } from './commands.js';
import { captureSelectionIntent, type DocxSelectionIntent } from './selection-intent.js';
import type {
  DocxImageAction, DocxImageContext, DocxImageDescription, DocxResult,
  DocxRevision, DocxSession,
} from './types.js';

type Resize = Extract<DocxImageAction, { type: 'resize-image' }>;
type Description = Extract<DocxImageAction, { type: 'image-description' }>;
const stale = Object.freeze({ ok: false, code: 'stale-selection' } as const);

function dimension(value: string): number | null {
  if (value.length > 40 || !/^\d+(?:\.\d+)?$/.test(value)) return null;
  const points = Number(value);
  return Number.isFinite(points) && points >= 1 && points <= 1440 ? points : null;
}

/** Preserve the actual committed EMU value rather than round it for display. */
export function imageDimensionDraft(points: number): string { return String(points); }

/** Numeric drafts remain strings until both complete, bounded dimensions are supplied. */
export function imageResizeDraft(width: string, height: string): Resize | null {
  const widthPoints = dimension(width), heightPoints = dimension(height);
  return widthPoints === null || heightPoints === null ? null : { type: 'resize-image', widthPoints, heightPoints };
}

/** Match the engine's independent per-axis EMU conversion. */
export function imageResizeUnchanged(action: Resize, original: Readonly<DocxImageContext>): boolean {
  return Math.round(action.widthPoints * 12700) === Math.round(original.widthPoints * 12700) &&
    Math.round(action.heightPoints * 12700) === Math.round(original.heightPoints * 12700);
}

/** Always derive the partner from the captured original ratio, never an earlier rounded draft. */
export function imageRatioPartner(value: string, axis: 'width' | 'height', original: Readonly<DocxImageContext>): string | null {
  const points = dimension(value);
  if (points === null) return null;
  const partner = axis === 'width' ? points * original.heightPoints / original.widthPoints :
    points * original.widthPoints / original.heightPoints;
  return Number.isFinite(partner) && partner >= 1 && partner <= 1440 ? imageDimensionDraft(partner) : null;
}

export function imageDescriptionDraft(title: string, description: string): Description | null {
  const normalized = normalizeDocxAction({ type: 'image-description', title, description });
  return normalized.ok ? normalized.value as Description : null;
}

/** A popup owns the original lease even after the facade has invalidated it. */
class ImageToolIntent {
  readonly image: Readonly<DocxImageContext>;
  constructor(private readonly session: DocxSession, private readonly intent: DocxSelectionIntent, image: Readonly<DocxImageContext>) {
    this.image = Object.freeze({ widthPoints: image.widthPoints, heightPoints: image.heightPoints });
  }
  valid(session: DocxSession | null): boolean {
    return this.intent.valid(session);
  }
  description(session: DocxSession | null): DocxResult<Readonly<DocxImageDescription>> {
    if (!this.valid(session)) return stale;
    const result = this.session.imageDescription();
    if (!this.valid(session)) return stale;
    return result.ok ? { ok: true, value: Object.freeze({ title: result.value.title, description: result.value.description }) } : result;
  }
  execute(session: DocxSession | null, action: DocxImageAction): DocxResult<DocxRevision> {
    return this.intent.execute(session, action);
  }
  release(): void {
    this.intent.release();
  }
}

export function captureImageToolIntent(session: DocxSession | null): ImageToolIntent | null {
  const snapshot = session?.snapshot();
  if (!session || snapshot?.status !== 'ready' || !snapshot.revision || !snapshot.image) return null;
  const retained = captureSelectionIntent(session, current => current.image !== null, snapshot);
  return retained ? new ImageToolIntent(session, retained, snapshot.image) : null;
}
