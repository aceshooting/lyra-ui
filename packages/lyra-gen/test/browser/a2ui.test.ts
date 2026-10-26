import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../lyra-ui/test/wtr-focus.js';
import { A2UI_STABLE_REVISION, A2uiProcessor, a2uiClientCapabilities, createA2uiCatalog } from '../../src/adapters/a2ui.js';
import type { A2uiActionEnvelope, A2uiCatalog } from '../../src/adapters/a2ui.js';
import { createCatalog, initialCatalog } from '../../src/catalog.js';
import { LyraGenViewElement } from '../../src/gen-view.js';
import type { JsonObject, LyraGenResult } from '../../src/types.js';
import { reportCatalogId, reportMessages, reportSurface, reportUpdate } from '../fixtures/a2ui/extended-report.js';

const owner = { ownerId: 'report-agent' };
const sourceLabel = 'Viewer-approved quarterly report';
const viewCatalog = createCatalog({
  id: 'lyra-report-fixture', version: '1',
  components: Object.fromEntries(['stack', 'text', 'chart', 'table', 'stat', 'citation'].map(role => [role, initialCatalog.components[role]!])),
  actions: { 'inspect-source': { payload: { type: 'object', properties: { sourceId: { type: 'string' } }, required: ['sourceId'], additionalProperties: false } } },
});
function accepted<T>(result: LyraGenResult<T>): T {
  expect(result.ok, JSON.stringify(result.diagnostics)).to.equal(true);
  if (!result.ok) throw new Error('Expected accepted stable-profile input');
  return result.value;
}
function rejected<T>(result: LyraGenResult<T>, code: string): void {
  expect(result.ok).to.equal(false);
  expect(result.diagnostics[0]?.code).to.equal(code);
}
function query<T extends HTMLElement = HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing rendered ${selector}`);
  return element;
}
async function settled(host: LyraGenViewElement): Promise<void> {
  await host.updateComplete;
  await waitUntil(() => host.status === 'ready', 'Stable A2UI view committed', { timeout: 5000 });
  for (const child of host.shadowRoot!.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) {
    if (child.updateComplete) await child.updateComplete;
  }
}
async function mount() {
  const sources = new Map([['quarterly-report', sourceLabel]]);
  const declared = createA2uiCatalog(viewCatalog);
  // The host resolves source identity and label for the current viewer before conversion.
  const catalog: A2uiCatalog = { ...declared, components: { ...declared.components, citation: {
    ...declared.components['citation']!,
    toNode(node, children) {
      const label = sources.get(String(node.props['sourceId']));
      if (!label) return { id: node.id, type: 'text', text: 'Source unavailable' };
      return declared.components['citation']!.toNode({ ...node, props: { ...node.props, label } }, children);
    },
  } } };
  const processor = new A2uiProcessor({ catalogs: [catalog] });
  for (const message of reportMessages) accepted(processor.process(message, owner));
  const host = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${viewCatalog}
    .document=${accepted(processor.toView(reportSurface))}></lr-gen-view>`);
  const outbound: A2uiActionEnvelope[] = [];
  host.addEventListener('lr-gen-action', event => {
    const action = event.detail;
    const sourceId = (action.payload as JsonObject)['sourceId'];
    // Source authorization is checked again at activation, independently of rendered labels.
    if (typeof sourceId !== 'string' || !sources.has(sourceId)) return;
    const result = processor.createAction(action.surfaceId, action.nodeId, { ...owner, expectedRevision: action.revision }, '2026-10-26T12:00:00.000Z');
    if (result.ok) outbound.push(result.value);
  });
  await settled(host);
  return { host, processor, sources, outbound, catalog };
}
async function activateCitation(host: LyraGenViewElement): Promise<void> {
  const citation = query(host.shadowRoot!, 'lr-citation-badge');
  await focusByKeyboard(query(citation.shadowRoot!, 'button'));
  await sendKeys({ press: 'Enter' });
}
function renderedCells(host: LyraGenViewElement): string[] {
  return Array.from(query(host.shadowRoot!, 'lr-table').shadowRoot!.querySelectorAll('tbody [part="cell"]'), cell => cell.textContent!.trim());
}

it('renders the owned stable chart/table/stat/citation profile through create, update, native action and delete', async () => {
  const { host, processor, outbound, catalog } = await mount();
  expect(A2UI_STABLE_REVISION).to.equal('409ded29ccac3eebc541979ae5320771703248e8');
  expect(catalog.id).to.equal(reportCatalogId);
  expect(catalog.id).to.not.contain('/catalogs/basic/');
  const chart = query(host.shadowRoot!, 'lr-lite-chart');
  const stat = query(host.shadowRoot!, 'lr-stat');
  const citation = query(host.shadowRoot!, 'lr-citation-badge');
  expect(query(chart.shadowRoot!, 'svg').getAttribute('aria-label')).to.equal('Orders by quarter');
  expect(chart.shadowRoot!.querySelectorAll('[part="bar"]').length).to.equal(2);
  expect(query(chart.shadowRoot!, '[part="data-table"]').textContent).to.contain('16');
  expect(renderedCells(host)).to.deep.equal(['Q1', '8', 'Q2', '16']);
  expect(query(stat.shadowRoot!, '[part="value"]').textContent).to.contain('24');
  expect(query(citation.shadowRoot!, 'button').getAttribute('aria-label')).to.contain(sourceLabel);
  await activateCitation(host);
  expect(outbound.length).to.equal(1);
  expect(outbound[0]!.message.action).to.deep.equal({ name: 'inspect-source', surfaceId: reportSurface,
    sourceComponentId: 'source', timestamp: '2026-10-26T12:00:00.000Z', context: { sourceId: 'quarterly-report' } });
  expect(outbound[0]!.ownerId).to.equal(owner.ownerId);
  expect(Object.keys(outbound[0]!.dataModel!.surfaces)).to.deep.equal([reportSurface]);
  accepted(processor.process(reportUpdate, owner));
  host.document = accepted(processor.toView(reportSurface));
  await settled(host);
  expect(query(host.shadowRoot!, 'lr-lite-chart') === chart).to.equal(true);
  expect(renderedCells(host)).to.deep.equal(['Q1', '8', 'Q2', '24']);
  expect(query(stat.shadowRoot!, '[part="value"]').textContent).to.contain('32');
  expect(chart.shadowRoot!.querySelector('[part="data-table"]')!.textContent).to.contain('24');
  await activateCitation(host);
  expect(outbound.length).to.equal(2);
  expect(outbound[1]!.revision).to.equal(processor.getSurface(reportSurface)!.revision);
  accepted(processor.process({ version: 'v0.9.1', deleteSurface: { surfaceId: reportSurface } }, owner));
  host.document = undefined;
  await host.updateComplete;
  expect(host.shadowRoot!.querySelectorAll('lr-lite-chart,lr-table,lr-stat,lr-citation-badge').length).to.equal(0);
  citation.dispatchEvent(new CustomEvent('lr-citation-activate', { bubbles: true, composed: true, detail: { sourceId: 'quarterly-report' } }));
  expect(outbound.length).to.equal(2);
  rejected(processor.toView(reportSurface), 'a2ui-unknown-surface');
});

it('rejects unsupported fields, candidate messages and stale or foreign ownership without replacing the rendered view', async () => {
  const { host, processor, outbound } = await mount();
  const previous = processor.getSurface(reportSurface)!;
  const source = accepted(processor.resolveSurface(reportSurface)).root!.children.find(node => node.sourceComponentId === 'source')!;
  rejected(processor.process({ version: 'v0.9.1', updateComponents: { surfaceId: reportSurface,
    components: [{ id: 'chart', component: 'chart', label: 'Rejected', src: 'https://unapproved.example/chart' }] } }, owner), 'a2ui-unsupported-member');
  rejected(processor.process({ version: 'v1.0', deleteSurface: { surfaceId: reportSurface } }, owner), 'a2ui-version');
  rejected(processor.process(reportUpdate, { ownerId: 'another-agent' }), 'a2ui-owner');
  rejected(processor.process({ version: 'v0.9.1', deleteSurface: { surfaceId: reportSurface } }, { ownerId: 'another-agent' }), 'a2ui-owner');
  rejected(processor.createAction(reportSurface, source.id, { ownerId: 'another-agent', expectedRevision: previous.revision }), 'a2ui-owner');
  expect(processor.getSurface(reportSurface)).to.deep.equal(previous);
  expect(renderedCells(host)).to.deep.equal(['Q1', '8', 'Q2', '16']);
  accepted(processor.process(reportUpdate, owner));
  rejected(processor.createAction(reportSurface, source.id, { ...owner, expectedRevision: previous.revision }), 'a2ui-revision');
  // The still-visible old document cannot dispatch after protocol state has advanced.
  await activateCitation(host);
  expect(outbound.length).to.equal(0);
  host.document = accepted(processor.toView(reportSurface));
  await settled(host);
  await activateCitation(host);
  expect(outbound.length).to.equal(1);
});

it('rechecks viewer source access at activation and replaces revoked citations with an explicit fallback', async () => {
  const { host, processor, sources, outbound } = await mount();
  sources.clear();
  await activateCitation(host);
  expect(outbound.length).to.equal(0);
  // Viewer policy changed independently of the wire revision; retire its old projection first.
  host.document = undefined;
  await host.updateComplete;
  host.document = accepted(processor.toView(reportSurface));
  await settled(host);
  expect(host.shadowRoot!.querySelectorAll('lr-citation-badge').length).to.equal(0);
  expect(host.shadowRoot!.textContent).to.contain('Source unavailable');
  expect(renderedCells(host)).to.deep.equal(['Q1', '8', 'Q2', '16']);
});

it('keeps transport catalog advertising empty after local rendering qualification', async () => {
  const { processor, catalog } = await mount();
  expect(a2uiClientCapabilities(processor)).to.deep.equal({ 'v0.9': { supportedCatalogIds: [] } });
  expect(processor.supportedCatalogIds).to.not.include(catalog.id);
});

it('keeps a retired rendered action inert when the same owner recreates the same surface and component IDs', async () => {
  const { host, processor, outbound } = await mount();
  const retired = query(host.shadowRoot!, 'lr-citation-badge');
  accepted(processor.process({ version: 'v0.9.1', deleteSurface: { surfaceId: reportSurface } }, owner));
  for (const message of reportMessages) accepted(processor.process(message, owner));
  await activateCitation(host);
  expect(outbound.length).to.equal(0);
  host.document = accepted(processor.toView(reportSurface));
  await settled(host);
  expect(query(host.shadowRoot!, 'lr-citation-badge') === retired).to.equal(false);
  await activateCitation(host);
  expect(outbound.length).to.equal(1);
});
