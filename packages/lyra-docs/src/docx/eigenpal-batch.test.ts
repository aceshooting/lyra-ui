import assert from 'node:assert/strict';
import test from 'node:test';
import type { DocxEditorInstance, EditorCommand } from '@docx-editor.dev/core';
import { packageFingerprint, runEigenpalBatch, type DocxBatchPlanStep } from './eigenpal-batch.js';
import { WORD_NS as W } from './ooxml.js';
import type { DocxResult } from './types.js';

let sequence = 0;
const node = (localName: string, children: unknown[] = [], attributes: Record<string, string> = {}) => ({
  kind: 'element', id: `n-${++sequence}`, localName, namespaceUri: W, children,
  attributes: Object.entries(attributes).map(([localName, value]) => ({ localName, namespaceUri: W, value })),
});
/** An immutable package rebuilt with fresh node ids from plain paragraph state. */
function build(paragraphs: readonly { id: string; style: string; text: string }[]) {
  const body = node('body', paragraphs.map(p => ({ ...node('p', [node('pPr', [node('pStyle', [], { val: p.style })]),
    node('r', [node('t', [{ kind: 'textValue', id: `n-${++sequence}`, value: p.text }])])]), id: p.id })));
  const part = { name: '/word/document.xml', contentType: 'main+xml', root: node('document', [body]) };
  return { mainDocumentPart: part.name, parts: new Map([[part.name, part]]),
    partBytes: new Map([['/word/document.xml', new Uint8Array(3)], ['/word/media/a.png', new Uint8Array(5)]]),
    relationships: new Map([['/word/document.xml', [{ id: 'rId1', type: 'image', target: 'media/a.png' }]]]) };
}
type Package = ReturnType<typeof build>;
const fingerprint = (pkg: unknown, budget?: number) => packageFingerprint(pkg as never, budget);

/** A fake engine with grouped undo units over immutable package snapshots. */
function engine() {
  let state = [{ id: 'p1', style: 'Normal', text: 'one' }, { id: 'p2', style: 'Normal', text: 'two' }, { id: 'p3', style: 'Normal', text: 'three' }];
  const undo: (typeof state)[] = [];
  let pkg: Package = build(state), caret = 'p1';
  let openGroup: object | null = null, lastGroup: object | null = null;
  const f = {
    split: false, brokenUndo: false, undoRefused: false, refuseCan: -1, refuseExec: -1, throwAt: -1, writes: 0,
    commands: [] as string[], selections: [] as string[],
    get state() { return state; }, get caret() { return caret; }, set caret(value: string) { caret = value; },
    get undoDepth() { return undo.length; },
  };
  const editor = {
    beginHistoryGroup() {
      const group = { state: 'open', end() { this.state = 'closed'; if (openGroup === group) openGroup = null; } };
      openGroup = group; return group;
    },
    can(command: EditorCommand) {
      if (command.type === 'setSelection') return { ok: state.some(p => p.id === (command as { range: { anchor: { paragraphId: string } } }).range.anchor.paragraphId) };
      return { ok: f.writes !== f.refuseCan };
    },
    exec(command: EditorCommand, options: { historyGroup?: object } = {}) {
      f.commands.push(command.type);
      if (command.type === 'setSelection') {
        caret = (command as { range: { anchor: { paragraphId: string } } }).range.anchor.paragraphId;
        f.selections.push(caret);
        return { ok: true, changed: false };
      }
      if (command.type === 'undo') {
        if (f.undoRefused) return { ok: false, code: 'unsupported', reason: '' };
        const previous = undo.pop();
        if (previous && !f.brokenUndo) { state = previous; pkg = build(state); }
        lastGroup = null;
        return { ok: true, changed: true };
      }
      const index = f.writes++;
      if (index === f.throwAt) throw new Error('engine detail');
      if (index === f.refuseExec) return { ok: false, code: 'locked', reason: 'private' };
      const extended = !f.split && options.historyGroup !== undefined && options.historyGroup === openGroup && lastGroup === openGroup;
      if (!extended) undo.push(state);
      lastGroup = options.historyGroup ?? null;
      const styleId = (command as { styleId?: string }).styleId ?? command.type;
      state = state.map(p => p.id === caret ? { ...p, style: styleId } : p);
      pkg = build(state);
      return { ok: true, changed: true, history: { kind: extended ? 'extended' : 'started' } };
    },
  } as unknown as DocxEditorInstance;
  return { f, editor, current: () => pkg as never };
}
const style = (styleId: string, paragraphId: string | null = null): DocxBatchPlanStep => ({ command: { type: 'setParagraphStyle', styleId } as EditorCommand, paragraphId });
const okGuard = (): DocxResult<void> => ({ ok: true, value: undefined });
const original = { anchor: { paragraphId: 'p1', offset: 0 }, head: { paragraphId: 'p1', offset: 0 } };

test('the fingerprint ignores engine node ids but sees structure, text, parts, relationships and entry sizes', () => {
  const state = [{ id: 'a', style: 'Normal', text: 'x' }];
  const base = fingerprint(build(state));
  assert.equal(typeof base, 'string');
  assert.equal(fingerprint(build(state)), base, 'fresh node ids do not change the digest');
  assert.notEqual(fingerprint(build([{ id: 'a', style: 'Title', text: 'x' }])), base);
  assert.notEqual(fingerprint(build([{ id: 'a', style: 'Normal', text: 'y' }])), base);
  assert.notEqual(fingerprint(build([...state, { id: 'b', style: 'Normal', text: '' }])), base);
  const relationship = build(state); relationship.relationships.set('/word/document.xml', [{ id: 'rId1', type: 'image', target: 'media/b.png' }]);
  assert.notEqual(fingerprint(relationship), base);
  const media = build(state); media.partBytes.set('/word/media/a.png', new Uint8Array(6));
  assert.notEqual(fingerprint(media), base);
  const xmlBytes = build(state); xmlBytes.partBytes.set('/word/document.xml', new Uint8Array(99));
  assert.equal(fingerprint(xmlBytes), base, 'stale serialized bytes of a modeled XML part are not compared');
  const part = build(state); part.parts.set('/word/extra.xml', { name: '/word/extra.xml', contentType: 'x', root: node('extra') } as never);
  assert.notEqual(fingerprint(part), base);
  assert.equal(fingerprint(build(state), 3), null, 'the node budget bounds the digest');
  assert.equal(fingerprint({ parts: [] }), null);
  assert.equal(fingerprint({ parts: new Map([['x', { root: { localName: 1 } }]]), partBytes: new Map(), relationships: new Map() }), null);
});

test('a batch commits every step in one undo unit and restores a moved caret', () => {
  const h = engine();
  const run = runEigenpalBatch(h.editor, [style('Title', 'p2'), style('Quote', 'p3'), style('Strong')], okGuard, h.current, original);
  assert.deepEqual(run, { result: { ok: true }, fault: false });
  assert.deepEqual(h.f.state.map(p => p.style), ['Normal', 'Title', 'Strong']);
  assert.equal(h.f.undoDepth, 1, 'one grouped undo unit');
  assert.equal(h.f.caret, 'p1', 'the original caret is restored');
});

test('a refused step mid-batch reverts the earlier steps and reports its index', () => {
  for (const failure of ['can', 'exec', 'throw'] as const) {
    const h = engine();
    if (failure === 'can') h.f.refuseCan = 2;
    else if (failure === 'exec') h.f.refuseExec = 2;
    else h.f.throwAt = 2;
    const before = fingerprint(h.current());
    const run = runEigenpalBatch(h.editor, [style('Title', 'p2'), style('Quote', 'p3'), style('Strong', 'p1'), style('Never')], okGuard, h.current, original);
    assert.deepEqual(run, { result: { ok: false, code: 'unsupported', step: 2, rolledBack: true }, fault: false }, failure);
    assert.deepEqual(h.f.state.map(p => p.style), ['Normal', 'Normal', 'Normal'], failure);
    assert.equal(fingerprint(h.current()), before, failure);
    assert.equal(h.f.caret, 'p1', `${failure}: the caret returns`);
    assert.equal(h.f.commands.filter(type => type === 'undo').length, 1, failure);
  }
});

test('a refused first step writes nothing and needs no revert', () => {
  const h = engine(); h.f.refuseCan = 0;
  const run = runEigenpalBatch(h.editor, [style('Title'), style('Quote')], okGuard, h.current, null);
  assert.deepEqual(run, { result: { ok: false, code: 'unsupported', step: 0, rolledBack: false }, fault: false });
  assert.equal(h.f.commands.includes('undo'), false);
});

test('a target that no longer exists is a stale selection at its step', () => {
  const h = engine();
  const run = runEigenpalBatch(h.editor, [style('Title', 'p2'), style('Quote', 'gone')], okGuard, h.current, original);
  assert.deepEqual(run, { result: { ok: false, code: 'stale-selection', step: 1, rolledBack: true }, fault: false });
  assert.deepEqual(h.f.state.map(p => p.style), ['Normal', 'Normal', 'Normal']);
});

test('split history is reverted unit by unit', () => {
  const h = engine(); h.f.split = true; h.f.refuseExec = 3;
  const run = runEigenpalBatch(h.editor, [style('A'), style('B'), style('C'), style('D')], okGuard, h.current, null);
  assert.deepEqual(run.result, { ok: false, code: 'unsupported', step: 3, rolledBack: true });
  assert.equal(h.f.commands.filter(type => type === 'undo').length, 3);
  assert.deepEqual(h.f.state.map(p => p.style), ['Normal', 'Normal', 'Normal']);
});

test('a revert that cannot be verified or is refused is a fault', () => {
  for (const problem of ['broken', 'refused'] as const) {
    const h = engine(); h.f.refuseExec = 1;
    if (problem === 'broken') h.f.brokenUndo = true; else h.f.undoRefused = true;
    const run = runEigenpalBatch(h.editor, [style('Title'), style('Quote')], okGuard, h.current, null);
    assert.deepEqual(run, { result: { ok: false, code: 'engine-failed', step: 1, rolledBack: false }, fault: true }, problem);
  }
});

test('a guard failure stops the batch; a terminal session is not reverted', () => {
  const composing = engine();
  let calls = 0;
  const run = runEigenpalBatch(composing.editor, [style('Title'), style('Quote'), style('Strong')],
    () => ++calls >= 3 ? { ok: false, code: 'composing' } : okGuard(), composing.current, null);
  assert.deepEqual(run.result, { ok: false, code: 'composing', step: 1, rolledBack: true });
  assert.deepEqual(composing.f.state.map(p => p.style), ['Normal', 'Normal', 'Normal']);
  for (const code of ['destroyed', 'engine-failed'] as const) {
    const h = engine();
    let guards = 0;
    const terminal = runEigenpalBatch(h.editor, [style('Title'), style('Quote')], () => ++guards >= 2 ? { ok: false, code } : okGuard(), h.current, null);
    assert.deepEqual(terminal, { result: { ok: false, code, step: 0, rolledBack: false }, fault: false }, code);
    assert.equal(h.f.commands.includes('undo'), false, code);
  }
});

test('a package beyond the digest budget is refused before any write', () => {
  const h = engine();
  const run = runEigenpalBatch(h.editor, [style('Title')], okGuard, () => ({ parts: 'not a map' }) as never, null);
  assert.deepEqual(run, { result: { ok: false, code: 'resource-limit', step: null, rolledBack: false }, fault: false });
  assert.deepEqual(h.f.commands, []);
});
