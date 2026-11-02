import assert from 'node:assert/strict';
import test from 'node:test';
import { openEigenpalDocument } from './eigenpal-adapter.js';
import { WORD_NS as W } from './ooxml.js';
import type { DocxEngineBatchResult, DocxEngineEvent, DocxEnginePort } from './engine-port.js';
import type { DocxBatchEdit, DocxResult } from './types.js';
import { deferred, harness, reached, sessionStates, settled, type SessionControl } from '../../test/eigenpal-adapter-harness.js';

const node = (id: string, localName: string, children: unknown[] = [], attributes: Record<string, string> = {}) => ({
  kind: 'element', id, localName, namespaceUri: W, children,
  attributes: Object.entries(attributes).map(([localName, value]) => ({ localName, namespaceUri: W, value })),
});
/** An adapter over a two-paragraph package whose paragraph-style writes and undo the fake engine applies. */
async function batchHarness(options: { readOnly?: boolean } = {}) {
  const h = harness();
  let revision = 0, owned = true, styles = ['Normal', 'Normal'], lastGroup: object | null = null;
  const undo: string[][] = [];
  const build = () => {
    const paragraphs = styles.map((style, index) => node(`p${index + 1}`, 'p', [node(`r${index}-${revision}`, 'pPr', [node(`s${index}-${revision}`, 'pStyle', [], { val: style })])]));
    const part = { name: '/word/document.xml', contentType: 'main', root: node('d', 'document', [node('b', 'body', paragraphs)]) };
    return { mainDocumentPart: part.name, parts: new Map([[part.name, part]]), partBytes: new Map(), relationships: new Map() };
  };
  let pkg = build();
  const f = { refuseExec: false, brokenUndo: false, commands: [] as string[], groups: 0, flushes: 0, onFlush() {} };
  const commit = () => { revision++; pkg = build(); h.emit('change', { revision }); };
  Object.defineProperty(h.engine, 'surface', { configurable: true, value: {
    session: { packageRevision: () => revision, part: () => pkg.parts.get('/word/document.xml'), currentPackage: () => pkg },
    state: () => ({ selection: { anchor: { paragraphId: 'p1', offset: 0 }, head: { paragraphId: 'p1', offset: 0 } }, cellSelection: null }),
    flushPendingInput() { f.flushes++; f.onFlush(); },
  } });
  let caret = 'p1';
  Object.assign(h.engine, {
    mountGeneration: 0,
    getDocumentStyles: () => [{ type: 'paragraph', styleId: 'Title', name: 'Title' }, { type: 'paragraph', styleId: 'Quote', name: 'Quote' }],
    beginHistoryGroup() { f.groups++; const group = { state: 'open', end() { this.state = 'closed'; } }; return group; },
    can: () => ({ ok: true }),
    exec(command: { type: string; styleId?: string; range?: { anchor: { paragraphId: string } } }, execOptions: { historyGroup?: object } = {}) {
      f.commands.push(command.type);
      if (command.type === 'setSelection') { caret = command.range!.anchor.paragraphId; return { ok: true, changed: false }; }
      if (command.type === 'undo') { const previous = undo.pop(); if (previous && !f.brokenUndo) styles = previous; commit(); lastGroup = null; return { ok: true, changed: true }; }
      if (f.refuseExec && undo.length) return { ok: false, code: 'locked', reason: 'private' };
      const extended = execOptions.historyGroup !== undefined && execOptions.historyGroup === lastGroup;
      if (!extended) undo.push(styles);
      lastGroup = execOptions.historyGroup ?? null;
      styles = styles.map((style, index) => `p${index + 1}` === caret ? command.styleId ?? style : style);
      commit();
      return { ok: true, changed: true, history: { kind: extended ? 'extended' : 'started' } };
    },
  });
  const opened = await openEigenpalDocument({ mount: h.mount }, { kind: 'blank' },
    { readOnly: options.readOnly ?? false, signal: new AbortController().signal }, () => owned, h.loader);
  assert(opened.ok);
  const port = opened.value as DocxEnginePort & Required<Pick<DocxEnginePort, 'executeBatch' | 'fragment'>>;
  const events: DocxEngineEvent[] = [];
  port.subscribe(event => { events.push(event); });
  const control = (validate: () => DocxResult<void> = settled) => {
    const trace = { arms: 0 };
    return { trace, control: { validate, arm: () => { trace.arms++; return validate(); } } };
  };
  const targets = () => {
    const fragment = port.fragment({ maxBlocks: 4, maxText: 100 });
    assert(fragment.ok);
    return fragment.value.blocks.map(block => block.token!);
  };
  return { ...h, port, f, events, control, targets, styles: () => styles, revision: () => revision, revise: () => { revision++; },
    loseOwnership: () => { owned = false; } };
}
const style = (styleId: string): DocxBatchEdit => ({ type: 'paragraph-style', styleId });

test('a batch moves to each target and writes inside one history group after its features are ready', async () => {
  const h = await batchHarness();
  const [first, second] = h.targets();
  const prepared: string[] = [];
  h.prepareWith(async features => { prepared.push(...features); });
  const { trace, control } = h.control();
  const result = await h.port.executeBatch([{ edit: style('Title'), target: second }, { edit: style('Quote'), target: first }], control);
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(h.styles(), ['Quote', 'Title']);
  assert.deepEqual(prepared, ['setParagraphStyle', 'setParagraphStyle'], 'features are prepared before the first write');
  assert.deepEqual([trace.arms, h.f.groups, h.f.flushes], [1, 1, 1]);
  assert.deepEqual(h.f.commands, ['setSelection', 'setParagraphStyle', 'setSelection', 'setParagraphStyle', 'setSelection']);
  assert.equal(h.events.filter(event => event === 'change').length, 2);
});

test('a refused step reverts the batch, and an unverifiable revert faults the engine', async () => {
  const h = await batchHarness();
  h.f.refuseExec = true;
  const { control } = h.control();
  assert.deepEqual(await h.port.executeBatch([{ edit: style('Title') }, { edit: style('Quote') }], control),
    { ok: false, code: 'unsupported', step: 1, rolledBack: true });
  assert.deepEqual(h.styles(), ['Normal', 'Normal']);

  const broken = await batchHarness();
  broken.f.refuseExec = true; broken.f.brokenUndo = true;
  let inspectedAfterFault = false;
  broken.port.subscribe(event => { if (event === 'state') { try { broken.port.inspect(); } catch { inspectedAfterFault = true; } } });
  assert.deepEqual(await broken.port.executeBatch([{ edit: style('Title') }, { edit: style('Quote') }], broken.control().control),
    { ok: false, code: 'engine-failed', step: 1, rolledBack: false });
  assert.equal(inspectedAfterFault, true, 'the facade learns of the fault through a state event');
  assert.deepEqual(await broken.port.executeBatch([{ edit: style('Title') }], broken.control().control),
    { ok: false, code: 'engine-failed', step: null, rolledBack: false });
});

test('stale targets and unknown paragraph styles are refused by step before anything runs', async () => {
  const h = await batchHarness();
  const [first] = h.targets();
  const { trace, control } = h.control();
  assert.deepEqual(await h.port.executeBatch([{ edit: style('Title') }, { edit: style('Missing') }], control),
    { ok: false, code: 'invalid-option', step: 1, rolledBack: false });
  h.revise();
  assert.deepEqual(await h.port.executeBatch([{ edit: style('Title') }, { edit: style('Quote'), target: first }], control),
    { ok: false, code: 'stale-selection', step: 1, rolledBack: false });
  assert.deepEqual(await h.port.executeBatch([{ edit: style('Title'), target: {} }], control),
    { ok: false, code: 'stale-selection', step: 0, rolledBack: false });
  assert.deepEqual([trace.arms, h.f.flushes, h.f.commands], [0, 0, []]);
});

test('a change while input settles or features load refuses the batch before it arms', async () => {
  for (const moment of ['flush', 'prepare'] as const) {
    const h = await batchHarness();
    if (moment === 'flush') h.f.onFlush = () => h.revise();
    else h.prepareWith(async () => { h.revise(); });
    const { trace, control } = h.control();
    assert.deepEqual(await h.port.executeBatch([{ edit: style('Title') }], control),
      { ok: false, code: 'stale-revision', step: null, rolledBack: false }, moment);
    assert.equal(trace.arms, 0, moment);
    assert.equal(h.f.commands.length, 0, moment);
  }
  const h = await batchHarness();
  assert.deepEqual(await h.port.executeBatch([{ edit: style('Title') }], h.control(() => ({ ok: false, code: 'busy' })).control),
    { ok: false, code: 'busy', step: null, rolledBack: false }, 'the facade verdict applies before arming');
  let calls = 0;
  const refusesArm = { validate: settled, arm: (): DocxResult<void> => { calls++; return { ok: false, code: 'stale-revision' }; } };
  assert.deepEqual(await h.port.executeBatch([{ edit: style('Title') }], refusesArm), { ok: false, code: 'stale-revision', step: null, rolledBack: false });
  assert.deepEqual([calls, h.f.commands], [1, []]);
});

test('the adapter is busy while a batch prepares, and a batch is refused in every unavailable state', async () => {
  const h = await batchHarness();
  const gate = deferred<void>(), entered = deferred<void>();
  h.prepareWith(async () => { entered.resolve(); await gate.promise; });
  const running = h.port.executeBatch([{ edit: style('Title') }], h.control().control);
  assert(await reached(entered.promise, running));
  assert.deepEqual(await h.port.executeBatch([{ edit: style('Quote') }], h.control().control), { ok: false, code: 'busy', step: null, rolledBack: false });
  assert.deepEqual(h.port.fragment({ maxBlocks: 1, maxText: 1 }), { ok: false, code: 'busy' });
  gate.resolve();
  assert.deepEqual(await running, { ok: true });

  for (const [state, code, arrange] of sessionStates('teardown', 'ownership loss', 'engine failure', 'composition', 'native input dispatching', 'save in flight')) {
    const s = await batchHarness();
    const release = await arrange(s as unknown as SessionControl);
    assert.deepEqual(await s.port.executeBatch([{ edit: style('Title') }], s.control().control), { ok: false, code, step: null, rolledBack: false }, state);
    assert.equal(s.f.commands.length, 0, state);
    await release();
  }
  const readOnly = await batchHarness({ readOnly: true });
  assert.deepEqual(await readOnly.port.executeBatch([{ edit: style('Title') }], readOnly.control().control),
    { ok: false, code: 'read-only', step: null, rolledBack: false });
});

test('a batch result reaches the session through the port contract', async () => {
  const h = await batchHarness();
  const results: DocxEngineBatchResult[] = [];
  results.push(await h.port.executeBatch([{ edit: 'bold' }], h.control().control));
  assert.deepEqual(results, [{ ok: true }]);
  assert.deepEqual(h.f.commands, ['toggleMark']);
});
