import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { createCatalog, initialCatalog } from '../../../../packages/lyra-gen/dist/catalog.js';
import { A2uiProcessor, a2uiClientCapabilities, createA2uiCatalog } from '../../../../packages/lyra-gen/dist/adapters/a2ui.js';
import { LyraGenAiSdkBridge } from '../../../../packages/lyra-gen/dist/ai-sdk.js';
import { adaptAiSdkMessage } from '../../../../packages/lyra-ui/dist/ai/index.js';
import { fixtureDefinitions as a2uiDefinitions, reportIdentity, reportData, reportMessages, reportUpdate, createReportCatalog } from './a2ui.js';
import { fixtureDefinitions as sdkDefinitions, sdkIdentity, sdkPayloads, sdkProseChunks, sdkToolChunks, assertSdkProse } from './ai-sdk.js';
import { createViewCatalog, createViewDefinition } from './views.js';

const sdkRequire = createRequire(new URL('../../../../packages/lyra-gen/package.json', import.meta.url));
const { readUIMessageStream } = await import(pathToFileURL(sdkRequire.resolve('ai')).href);
const accepted = result => { assert.equal(result.ok, true, JSON.stringify(result.diagnostics)); return result.value; };

test('SDK prose oracle reads one complete plain-text wrapper with all 3200 rendered characters', () => {
  const parts = [{ part: 'part text', dataset: { type: 'text', state: 'complete' }, textContent: sdkPayloads().prose }];
  const transcript = { shadowRoot: { querySelectorAll: selector => selector === '[data-type="text"]' ? parts : [] } };
  assert.equal(assertSdkProse(transcript), 3200);
  assert.equal(transcript.shadowRoot.querySelectorAll('[part="text"]').length, 0, 'An exact part attribute does not match the real tokenized wrapper.');
  parts[0].textContent = parts[0].textContent.slice(0, -1); assert.throws(() => assertSdkProse(transcript), /SDK prose/u);
  parts[0].textContent = sdkPayloads().prose; parts[0].dataset.state = 'streaming'; assert.throws(() => assertSdkProse(transcript), /SDK prose/u);
  parts[0].dataset.state = 'complete'; parts.push({ ...parts[0] }); assert.throws(() => assertSdkProse(transcript), /SDK prose/u);
  parts.length = 0; assert.throws(() => assertSdkProse(transcript), /SDK prose/u);
});

test('owned A2UI report preserves exact counts, catalog identity, all updates and explicit action ownership', () => {
  const sources = new Map([[reportIdentity.sourceId, reportIdentity.sourceLabel]]);
  const { catalog } = createReportCatalog({ createCatalog, initialCatalog, createA2uiCatalog }, sources);
  const processor = new A2uiProcessor({ catalogs: [catalog] });
  const owner = { ownerId: reportIdentity.ownerId };
  assert.equal(catalog.id, 'https://github.com/aceshooting/lyra-ui/a2ui/v0.9.1/lyra-report-fixture/1');
  assert.deepEqual(a2uiClientCapabilities(processor), { 'v0.9': { supportedCatalogIds: [] } });
  for (const message of reportMessages()) accepted(processor.process(message, owner));
  const initial = accepted(processor.toView(reportIdentity.surfaceId));
  assert.equal(initial.revision, 2);
  assert.deepEqual(initial.root.children.map(node => node.type), ['chart', 'table', 'stat', 'citation']);
  assert.equal(initial.root.children[0].props.labels.length, 100);
  assert.equal(initial.root.children[0].props.datasets[0].data.length, 100);
  assert.equal(initial.root.children[1].props.rows.length, 100);
  assert.equal(initial.root.children[1].props.columns.length, 2);
  assert.equal(initial.root.children[3].props.label, reportIdentity.sourceLabel);
  const ids = initial.root.children.map(node => node.id);
  for (let tick = 1; tick <= 100; tick++) {
    const result = accepted(processor.process(reportUpdate(tick), owner));
    assert.equal(result.revision, tick + 2); assert.equal(result.dataRevision, tick + 1);
    assert.equal(result.data.rows.length, 100); assert.equal(result.data.series[0].data.length, 100);
    assert.deepEqual(result.data.rows.map(row => row.c1), Array.from({ length: 100 }, (_, index) => index + 1 + tick));
  }
  const final = accepted(processor.toView(reportIdentity.surfaceId));
  assert.deepEqual(final.root.children.map(node => node.id), ids);
  assert.equal(final.root.children[2].props.value, '15050');
  const action = accepted(processor.createAction(reportIdentity.surfaceId, final.root.children[3].id, { ...owner, expectedRevision: 102 }, reportIdentity.timestamp));
  assert.equal(action.ownerId, 'report-agent'); assert.equal(action.revision, 102);
  assert.deepEqual(action.message.action.context, { sourceId: 'quarterly-report' });
  assert.deepEqual(action.dataModel.surfaces[reportIdentity.surfaceId], reportData(100));
  sources.clear();
  assert.equal(accepted(processor.toView(reportIdentity.surfaceId)).root.children[3].text, 'Source unavailable');
  accepted(processor.process({ version: 'v0.9.1', deleteSurface: { surfaceId: reportIdentity.surfaceId } }, owner));
  assert.equal(processor.toView(reportIdentity.surfaceId).diagnostics[0].code, 'a2ui-unknown-surface');
  sources.set(reportIdentity.sourceId, reportIdentity.sourceLabel);
  for (const message of reportMessages()) accepted(processor.process(message, owner));
  assert.equal(processor.getSurface(reportIdentity.surfaceId).revision, 106);
  assert.equal(processor.createAction(reportIdentity.surfaceId, final.root.children[3].id, { ...owner, expectedRevision: 102 }).diagnostics[0].code, 'a2ui-revision');
  assert.equal(JSON.parse(a2uiDefinitions.A.operations.at(-1).expectedFingerprint).revision, 106);
});

test('SDK payloads retain two independent V-sized surfaces and exact prose/tool chunk boundaries', () => {
  assert.equal(sdkRequire('ai/package.json').version, '7.0.154');
  const { data, tool, prose } = sdkPayloads();
  assert.equal(data.surfaceId, 'profile-K-data'); assert.equal(tool.surfaceId, 'profile-K-tool');
  assert.equal(prose.length, 3200); assert.equal(new TextEncoder().encode(prose).length, 3200);
  const deltas = sdkProseChunks().filter(chunk => chunk.type === 'text-delta');
  assert.equal(deltas.length, 50); assert.equal(deltas.every(chunk => chunk.delta.length === 64), true);
  for (const document of [data, tool]) {
    const table = document.root.children.find(node => node.id === 'table');
    const chart = document.root.children.find(node => node.id === 'chart');
    assert.equal(table.props.rows.length, 100); assert.equal(table.props.columns.length, 8);
    assert.equal(chart.props.labels.length, 100); assert.equal(chart.props.datasets.length, 4);
    assert.equal(chart.props.datasets.every(series => series.data.length === 100 && series.data.filter(value => value === null).length === 10), true);
    assert.equal(chart.props.maxRecords, undefined);
  }
  const chunks = sdkToolChunks(tool);
  assert.equal(chunks.some(chunk => chunk.type === 'tool-input-available'), false);
  const fragments = chunks.slice(1).map(chunk => chunk.inputTextDelta);
  assert.equal(fragments.slice(0, -1).every(fragment => fragment.length === 64), true);
  assert.equal(fragments.at(-1).length <= 64, true);
  assert.deepEqual(JSON.parse(fragments.join('')), tool);
  assert.equal(fragments.length, sdkDefinitions.K.sizes.toolDeltas);
});

test('actual pinned SDK assembly stays inert until availability and retains independent admitted views through revision and interruption', async () => {
  const catalog = createViewCatalog({ createCatalog, initialCatalog });
  const bridge = new LyraGenAiSdkBridge({ messageId: sdkIdentity.messageId, catalog, dataNames: ['view'], toolNames: ['show_view'] });
  const payloads = sdkPayloads();
  let latest, selected = new Map(), streaming = 0;
  const consume = async chunks => {
    const stream = new ReadableStream({ start(controller) { chunks.forEach(chunk => controller.enqueue(chunk)); controller.close(); } });
    for await (const message of readUIMessageStream({ stream, ...(latest ? { message: latest } : {}), terminateOnError: true })) {
      latest = message;
      const adapted = adaptAiSdkMessage(message); assert.ok(adapted);
      for (const part of adapted.parts ?? []) {
        const result = bridge.resolve(part); if (!result) continue;
        selected.set(part.id, result);
        if (part.metadata?.aiSdkInputState === 'input-streaming') {
          streaming++; assert.equal(result.status, 'loading'); assert.equal(result.document, undefined);
        }
      }
    }
  };
  await consume(sdkProseChunks()); assert.equal(selected.size, 0);
  await consume([{ type: 'data-view', id: sdkIdentity.dataId, data: payloads.data }]);
  assert.equal(selected.get(sdkIdentity.dataId).document.surfaceId, sdkIdentity.dataSurface);
  await consume(sdkToolChunks(payloads.tool));
  assert.ok(streaming > 0);
  assert.equal(selected.get(sdkIdentity.toolPartId).status, 'loading');
  assert.deepEqual(latest.parts.find(part => part.toolCallId === sdkIdentity.toolId).input, payloads.tool);
  await consume([{ type: 'tool-input-available', toolCallId: sdkIdentity.toolId, toolName: 'show_view', input: payloads.tool }, { type: 'finish', finishReason: 'stop' }]);
  const safeTool = selected.get(sdkIdentity.toolPartId).document;
  assert.equal(safeTool.surfaceId, sdkIdentity.toolSurface);
  await consume([{ type: 'data-view', id: sdkIdentity.dataId, data: createViewDefinition('V', { surfaceId: sdkIdentity.dataSurface, revision: 1 }) }]);
  assert.equal(selected.get(sdkIdentity.dataId).document.revision, 1);
  assert.equal(selected.get(sdkIdentity.toolPartId).document, safeTool);
  const tool = adaptAiSdkMessage(latest).parts.find(part => part.id === sdkIdentity.toolPartId);
  const interrupted = bridge.resolve({ ...tool, state: 'interrupted', interruption: { resumable: true } });
  assert.equal(interrupted.status, 'interrupted'); assert.equal(interrupted.document, safeTool);
  bridge.reset(); selected.clear(); latest = undefined;
});
