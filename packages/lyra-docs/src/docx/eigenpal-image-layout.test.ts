import assert from 'node:assert/strict';
import test from 'node:test';
import type { SemanticLayout } from '@docx-editor.dev/core/layout';
import { qualifyImageLayout } from './eigenpal-image-layout.js';

const target = { drawingId: 'image', paragraphId: 'paragraph' };
const line = (start: number, end: number, drawing = false) => ({
  range: { paragraphId: 'paragraph', start, end }, spans: [],
  drawings: drawing ? [{ kind: 'inlineDrawing', drawingNodeId: 'image', paragraphId: 'paragraph', start,
    accessibility: { hidden: false }, resource: { kind: 'ready' } }] : [],
});
const layout = (lines: unknown[]) => ({ pages: [{ fragments: [{ kind: 'paragraph', lines }] }] }) as unknown as SemanticLayout;

test('image layout refuses real shared endpoint shapes before selection regardless of decode readiness', () => {
  for (const [before, offset] of [[1575, 1592], [295, 311]]) {
    const lines = [line(before!, offset!), line(offset!, offset! + 1, true)];
    assert.deepEqual(qualifyImageLayout(layout(lines), target), { ok: false, code: 'unsupported' });
    lines[1]!.drawings[0]!.resource.kind = 'pending';
    assert.deepEqual(qualifyImageLayout(layout(lines), target), { ok: false, code: 'unsupported' });
  }
});

test('image layout accepts one unambiguous line including a nonzero drawing offset', () => {
  const imageLine = line(300, 312, true); imageLine.drawings[0]!.start = 311;
  assert.deepEqual(qualifyImageLayout(layout([line(280, 300), imageLine]), target), { ok: true, value: undefined });
  assert.deepEqual(qualifyImageLayout(layout([line(0, 1, true)]), target), { ok: true, value: undefined });
});

test('image layout refuses missing duplicate hidden and malformed target positions', () => {
  assert.equal(qualifyImageLayout(layout([line(0, 1)]), target).ok, false);
  assert.equal(qualifyImageLayout(layout([line(0, 1, true), line(0, 1, true)]), target).ok, false);
  for (const offset of [-1, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    assert.equal(qualifyImageLayout(layout([line(offset, offset + 1, true)]), target).ok, false);
  }
  const hidden = line(0, 1, true); hidden.drawings[0]!.accessibility.hidden = true;
  assert.equal(qualifyImageLayout(layout([hidden]), target).ok, false);
});

test('image layout array budgets refuse before walking oversized arrays', () => {
  for (const key of ['pages', 'fragments', 'lines', 'spans', 'drawings']) {
    const value = layout([line(0, 1, true)]) as unknown as { pages: { fragments: { lines: Record<string, unknown>[] }[] }[] };
    const oversized = new Array(key === 'pages' ? 257 : 20_001);
    Object.defineProperty(oversized, 0, { get() { throw Error('oversized array was read'); } });
    if (key === 'pages') Object.assign(value, { pages: oversized });
    else if (key === 'fragments') Object.assign(value.pages[0]!, { fragments: oversized });
    else if (key === 'lines') Object.assign(value.pages[0]!.fragments[0]!, { lines: oversized });
    else Object.assign(value.pages[0]!.fragments[0]!.lines[0]!, { [key]: oversized });
    assert.deepEqual(qualifyImageLayout(value as unknown as SemanticLayout, target), { ok: false, code: 'resource-limit' });
  }
});

test('image layout scans nested and non-body lines conservatively without recursive indexes', () => {
  const image = { kind: 'paragraph', lines: [line(0, 1, true)] };
  const other = { kind: 'paragraph', lines: [{ range: { paragraphId: 'other', start: 0, end: 1 }, spans: [], drawings: [] }] };
  const nested = { pages: [{ fragments: [{ kind: 'table', rows: [{ cells: [{ blocks: [image] }] }] }],
    header: { fragments: [other] }, footer: { fragments: [other] },
    footnotes: { notes: [{ fragments: [other] }], separator: { fragments: [other] } },
    endnotes: { notes: [], continuationNotice: { fragments: [other] } } }] } as unknown as SemanticLayout;
  assert.deepEqual(qualifyImageLayout(nested, target), { ok: true, value: undefined });
  const duplicate = { pages: [{ fragments: [image], header: { fragments: [image] } }] } as unknown as SemanticLayout;
  assert.deepEqual(qualifyImageLayout(duplicate, target), { ok: false, code: 'unsupported' });
});

test('image layout includes span and drawing ranges when detecting ambiguous boundaries', () => {
  const previous = { range: { paragraphId: 'other', start: 0, end: 0 },
    spans: [{ range: { paragraphId: 'paragraph', start: 0, end: 5 } }], drawings: [] };
  assert.deepEqual(qualifyImageLayout(layout([previous, line(5, 6, true)]), target), { ok: false, code: 'unsupported' });
  const previousDrawing = { range: { paragraphId: 'other', start: 0, end: 0 }, spans: [],
    drawings: [{ drawingNodeId: 'other-image', paragraphId: 'paragraph', start: 4 }] };
  assert.deepEqual(qualifyImageLayout(layout([previousDrawing, line(5, 6, true)]), target), { ok: false, code: 'unsupported' });
});

test('image layout charges pending blocks and nested row cell budgets before access', () => {
  const unread = new Array(10_000);
  Object.defineProperty(unread, 0, { get() { throw Error('pending budget not reserved'); } });
  const pending = { pages: [{ fragments: new Array(10_000).fill({ kind: 'paragraph', lines: [] }) }, { fragments: unread }] } as unknown as SemanticLayout;
  assert.deepEqual(qualifyImageLayout(pending, target), { ok: false, code: 'resource-limit' });
  for (const key of ['rows', 'cells', 'blocks', 'notes', 'anchoredDrawings']) {
    const oversized = new Array(20_001);
    Object.defineProperty(oversized, 0, { get() { throw Error('nested oversized array was read'); } });
    const page: Record<string, unknown> = { fragments: [] };
    if (key === 'rows') page.fragments = [{ kind: 'table', rows: oversized }];
    if (key === 'cells') page.fragments = [{ kind: 'table', rows: [{ cells: oversized }] }];
    if (key === 'blocks') page.fragments = [{ kind: 'table', rows: [{ cells: [{ blocks: oversized }] }] }];
    if (key === 'notes') page.footnotes = { notes: oversized };
    if (key === 'anchoredDrawings') page.anchoredDrawings = oversized;
    assert.deepEqual(qualifyImageLayout({ pages: [page] } as unknown as SemanticLayout, target), { ok: false, code: 'resource-limit' });
  }
});

test('unexpected layout access faults propagate instead of becoming ordinary unsupported content', () => {
  const failure = new Error('layout access failed');
  const value = layout([line(0, 1, true)]);
  Object.defineProperty(value, 'pages', { get() { throw failure; } });
  assert.throws(() => qualifyImageLayout(value, target), error => error === failure);
});
