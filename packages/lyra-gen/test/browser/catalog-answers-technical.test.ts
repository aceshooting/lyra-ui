import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { createCatalog, initialCatalog } from '../../src/catalog.js';
import { technicalAnswerRoles } from '../../src/catalogs/answers-technical.js';
import { LyraGenViewElement } from '../../src/gen-view.js';
import type { JsonValue, LyraGenNode, LyraGenView } from '../../src/types.js';

interface UpdatingElement extends HTMLElement { readonly updateComplete: Promise<boolean> }
const catalog = createCatalog({ id: 'technical-qualification', version: '1', components: { ...initialCatalog.components, ...technicalAnswerRoles } });
const spans: JsonValue = [
  { id: 'agent', name: 'Answer question', kind: 'agent', startMs: 0, endMs: 900, status: 'success' },
  { id: 'search', parentId: 'agent', name: 'Search docs', kind: 'tool', startMs: 40, endMs: 420, status: 'success', detail: '3 hits' },
  { id: 'draft', parentId: 'agent', name: 'Draft reply', kind: 'llm', startMs: 430, endMs: 880, status: 'error' },
];

/** Authored independently of the reviewed examples; every technical role needs one (checked below). */
const scenarios: Readonly<Record<string, LyraGenNode>> = {
  'code-block': { id: 'subject', type: 'code-block', props: { label: 'Retry helper', filename: 'retry.js', code: 'async function retry(fn) {\n  try { return await fn(); } catch { return fn(); }\n}', language: 'javascript', lineNumbers: true, wrap: true } },
  'json-viewer': { id: 'subject', type: 'json-viewer', props: { data: { status: 'degraded', regions: [{ name: 'eu', latencyMs: 120 }, { name: 'us', latencyMs: 85 }], retries: null }, expandDepth: 2 } },
  'diff-view': { id: 'subject', type: 'diff-view', props: { oldText: 'timeout: 30\nretries: 1\nregion: eu\n', newText: 'timeout: 60\nretries: 3\nregion: eu\n', language: 'yaml', layout: 'unified' } },
  'test-results': { id: 'subject', type: 'test-results', props: { runState: 'complete', suites: [
    { id: 'unit', name: 'Unit', tests: [{ id: 'adds', name: 'adds numbers', status: 'passed', durationMs: 4 }, { id: 'parses', name: 'parses dates', status: 'failed', durationMs: 12, message: 'Expected 2026-11-24' }] },
    { id: 'e2e', name: 'End to end', tests: [{ id: 'login', name: 'signs in', status: 'skipped' }] },
  ] } },
  'trace-tree': { id: 'subject', type: 'trace-tree', props: { label: 'Request trace', spans, withoutBars: false } },
  'span-waterfall': { id: 'subject', type: 'span-waterfall', props: { label: 'Request timeline', spans } },
};

async function mount(root: LyraGenNode, dir: 'ltr' | 'rtl'): Promise<{ host: LyraGenViewElement; subject: UpdatingElement }> {
  const document: LyraGenView = { version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'technical-qualification', revision: 0, root };
  const wrapper = await fixture<HTMLDivElement>(html`<div dir=${dir}><lr-gen-view .catalog=${catalog} .document=${document}></lr-gen-view></div>`);
  const host = wrapper.querySelector<LyraGenViewElement>('lr-gen-view')!;
  await waitUntil(() => host.status === 'ready' || host.status === 'error', 'Technical role settled', { timeout: 5000 });
  expect(host.status).to.equal('ready');
  const subject = host.shadowRoot!.querySelector<UpdatingElement>('[data-gen-id="subject"]');
  expect(subject !== null).to.equal(true);
  await subject!.updateComplete;
  return { host, subject: subject! };
}

describe('technical answer roles rendered qualification', () => {
  it('keeps an explicit populated scenario for every technical role', () => {
    expect(Object.keys(scenarios).sort()).to.deep.equal(Object.keys(technicalAnswerRoles).sort());
  });

  for (const [role, root] of Object.entries(scenarios)) {
    it(`renders populated ${role} with its trusted tag and accessible semantics in LTR and RTL`, async () => {
      for (const dir of ['ltr', 'rtl'] as const) {
        const { host, subject } = await mount(root, dir);
        expect(subject.localName).to.equal(technicalAnswerRoles[role]!.tag);
        for (const [key, value] of Object.entries(root.props ?? {})) expect(Reflect.get(subject, key)).to.deep.equal(value);
        // The tree rows carry a reviewed composite accessible name; the component's own suite ignores this one rule.
        await expect(host).to.be.accessible(role === 'trace-tree' ? { ignoredRules: ['label-content-name-mismatch'] } : {});
      }
    });
  }
});
