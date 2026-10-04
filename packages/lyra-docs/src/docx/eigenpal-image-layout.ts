import type { BlockFragmentRecord, SemanticLayout } from '@docx-editor.dev/core/layout';
import type { DocxResult } from './types.js';

const LIMIT = 20_000;
class LayoutRefusal extends Error {
  constructor(readonly code: 'unsupported' | 'resource-limit') { super(code); }
}

/** A chosen image must have one unambiguous line at its native selection offset. */
export function qualifyImageLayout(layout: SemanticLayout,
  target: { drawingId: string; paragraphId: string }): DocxResult<void> {
  let used = 0;
  const charge = (count: number) => {
    if (!Number.isSafeInteger(count) || count < 0 || count > LIMIT - used) throw new LayoutRefusal('resource-limit');
    used += count;
  };
  const reject = (): never => { throw new LayoutRefusal('unsupported'); };
  const stack: BlockFragmentRecord[] = [];
  const enqueue = (blocks: readonly BlockFragmentRecord[]) => {
    charge(blocks.length);
    for (const block of blocks) stack.push(block);
  };
  const ranges: { start: number; end: number; own: boolean }[] = [];
  let targetStart = -1, occurrences = 0;
  try {
    if (layout.pages.length > 256) throw new LayoutRefusal('resource-limit');
    charge(layout.pages.length);
    for (const page of layout.pages) {
      enqueue(page.fragments);
      charge(page.anchoredDrawings?.length ?? 0);
      for (const drawing of page.anchoredDrawings ?? []) if (drawing.drawingNodeId === target.drawingId) reject();
      for (const story of [page.header, page.footer]) if (story) {
        charge(1); enqueue(story.fragments);
        charge(story.anchoredDrawings?.length ?? 0);
        for (const drawing of story.anchoredDrawings ?? []) if (drawing.drawingNodeId === target.drawingId) reject();
      }
      for (const area of [page.footnotes, page.endnotes]) if (area) {
        charge(1); charge(area.notes.length);
        for (const note of area.notes) enqueue(note.fragments);
        for (const separator of [area.separator, area.continuationNotice]) if (separator) {
          charge(1); enqueue(separator.fragments);
        }
      }
    }
    while (stack.length) {
      const block = stack.pop()!;
      if (block.kind === 'table') {
        charge(block.rows.length);
        for (const row of block.rows) {
          charge(row.cells.length);
          for (const cell of row.cells) enqueue(cell.blocks);
        }
        continue;
      }
      charge(block.lines.length);
      for (const line of block.lines) {
        charge(line.spans.length); charge(line.drawings?.length ?? 0);
        let start = Infinity, end = -Infinity, own = false;
        const include = (paragraphId: string, from: number, to: number) => {
          if (paragraphId !== target.paragraphId) return;
          if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || to < from) reject();
          start = Math.min(start, from); end = Math.max(end, to);
        };
        include(line.range.paragraphId, line.range.start, line.range.end);
        for (const span of line.spans) include(span.range.paragraphId, span.range.start, span.range.end);
        for (const drawing of line.drawings ?? []) {
          include(drawing.paragraphId, drawing.start, drawing.start + 1);
          if (drawing.drawingNodeId !== target.drawingId) continue;
          if (drawing.paragraphId !== target.paragraphId || drawing.kind !== 'inlineDrawing' || drawing.accessibility.hidden) reject();
          occurrences++; targetStart = drawing.start; own = true;
        }
        if (start !== Infinity) ranges.push({ start, end, own });
      }
    }
    if (occurrences !== 1) reject();
    let containing = 0, own = false;
    for (const range of ranges) if (targetStart >= range.start && targetStart <= range.end) {
      containing++; own ||= range.own;
    }
    if (containing !== 1 || !own) reject();
    return { ok: true, value: undefined };
  } catch (error) {
    if (error instanceof LayoutRefusal) return { ok: false, code: error.code };
    throw error;
  }
}
