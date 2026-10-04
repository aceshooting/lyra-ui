import type { DocxEditorInstance } from '@docx-editor.dev/core';
import { imageCandidates } from './eigenpal-images.js';
import type { DocxImageDirection, DocxResult } from './types.js';

/** Explicit bounded discovery; targets remain private to the adapter. */
export function selectImageTarget(editor: DocxEditorInstance, currentImageId: string | null,
  direction: DocxImageDirection): DocxResult<{ drawingId: string; paragraphId: string; unchanged: boolean }> {
  const candidates = imageCandidates(editor);
  if (!candidates.ok) return candidates;
  const items = candidates.value;
  if (!items.length) return { ok: false, code: 'no-selection' };
  const current = items.findIndex(item => item.drawingId === currentImageId);
  const index = current < 0 ? direction === 'next' ? 0 : items.length - 1 :
    (current + (direction === 'next' ? 1 : items.length - 1)) % items.length;
  const target = items[index]!;
  return { ok: true, value: { drawingId: target.drawingId, paragraphId: target.paragraphId, unchanged: target.drawingId === currentImageId } };
}
