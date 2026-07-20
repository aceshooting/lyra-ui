import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './entity-dossier.js';
import type { LyraEntityDossier, LyraEntityDossierConfidence } from './entity-dossier.js';
import type { LyraEntity } from '../entity-card/entity-card.js';
import type { LyraNeighborRow } from '../neighbor-list/neighbor-list.js';
import type { LyraChunk } from '../chunk-inspector/chunk-inspector.js';
import type { LyraProvenance } from '../provenance-panel/provenance-panel.js';
import type { LyraTabs } from '../../layout/tabs/tabs.js';
import type { LyraNeighborList } from '../neighbor-list/neighbor-list.js';
import type { LyraChunkInspector } from '../chunk-inspector/chunk-inspector.js';
import type { LyraProvenancePanel } from '../provenance-panel/provenance-panel.js';
import type { LyraStat } from '../../data/stat/stat.js';
import type { LyraEntityCard } from '../entity-card/entity-card.js';

const entity: LyraEntity = {
  id: 'e1',
  label: 'Marie Curie',
  type: 'person',
  description: 'Physicist and chemist.',
  properties: { born: '1867' },
  degree: 4,
  communityId: 'c1',
};

const neighbors: LyraNeighborRow[] = [{ relation: 'discovered', direction: 'out', node: { id: 'elem1', label: 'Polonium' } }];

const chunks: LyraChunk[] = [{ id: 'ch1', text: 'Marie Curie discovered polonium and radium.', score: 0.92, sourceId: 's1', title: 'curie-bio.pdf' }];

const provenance: LyraProvenance = { entities: [entity], chunks };

const confidence: LyraEntityDossierConfidence = { label: 'Confidence', value: '92%', variant: 'success', unit: '', caption: 'From 3 sources' };

async function populated(): Promise<LyraEntityDossier> {
  const el = (await fixture(html`<lr-entity-dossier></lr-entity-dossier>`)) as LyraEntityDossier;
  el.entity = entity;
  el.types = [{ id: 'person', label: 'Person' }];
  el.confidence = confidence;
  el.neighbors = neighbors;
  el.chunks = chunks;
  el.provenance = provenance;
  await el.updateComplete;
  return el;
}

it('defaults to a null entity, empty collections, and showFocusButton=true', async () => {
  const el = (await fixture(html`<lr-entity-dossier></lr-entity-dossier>`)) as LyraEntityDossier;
  expect(el.entity).to.equal(null);
  expect(el.types).to.deep.equal([]);
  expect(el.communityLabel).to.equal('');
  expect(el.showFocusButton).to.be.true;
  expect(el.confidence).to.equal(null);
  expect(el.neighbors).to.deep.equal([]);
  expect(el.groupByRelation).to.be.false;
  expect(el.expandable).to.be.false;
  expect(el.chunks).to.deep.equal([]);
  expect(el.thresholds).to.deep.equal({ high: 0.75, medium: 0.5 });
  expect(el.provenance).to.equal(null);
});

it('renders the noData empty state and no tabs when entity is null', async () => {
  const el = (await fixture(html`<lr-entity-dossier></lr-entity-dossier>`)) as LyraEntityDossier;
  const empty = el.shadowRoot!.querySelector('[part="empty"]');
  expect(empty).to.exist;
  expect(empty!.getAttribute('heading')).to.equal('No data');
  expect(el.shadowRoot!.querySelector('lr-tabs')).to.not.exist;
});

it('renders lr-entity-card with entity/types/communityLabel/showFocusButton forwarded', async () => {
  const el = (await fixture(html`<lr-entity-dossier></lr-entity-dossier>`)) as LyraEntityDossier;
  el.entity = entity;
  el.types = [{ id: 'person', label: 'Person' }];
  el.communityLabel = 'Nobel laureates';
  el.showFocusButton = false;
  await el.updateComplete;
  const card = el.shadowRoot!.querySelector('lr-entity-card') as LyraEntityCard;
  expect(card).to.exist;
  expect(card.entity).to.deep.equal(entity);
  expect(card.types).to.deep.equal([{ id: 'person', label: 'Person' }]);
  expect(card.communityLabel).to.equal('Nobel laureates');
  expect(card.showFocusButton).to.be.false;
});

it('honors the plain show-focus-button="false" attribute form, not just a property binding', async () => {
  const el = (await fixture(
    html`<lr-entity-dossier show-focus-button="false"></lr-entity-dossier>`,
  )) as LyraEntityDossier;
  expect(el.showFocusButton).to.be.false;
  el.entity = entity;
  await el.updateComplete;
  const card = el.shadowRoot!.querySelector('lr-entity-card') as LyraEntityCard;
  expect(card.showFocusButton).to.be.false;
});

it('omits the confidence stat entirely when confidence is null (the default)', async () => {
  const el = (await fixture(html`<lr-entity-dossier></lr-entity-dossier>`)) as LyraEntityDossier;
  el.entity = entity;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="confidence"]')).to.not.exist;
});

it('renders the confidence lr-stat with every field forwarded when confidence is set', async () => {
  const el = await populated();
  const stat = el.shadowRoot!.querySelector('[part="confidence"]') as LyraStat;
  expect(stat).to.exist;
  expect(stat.label).to.equal('Confidence');
  expect(stat.value).to.equal('92%');
  expect(stat.variant).to.equal('success');
  expect(stat.caption).to.equal('From 3 sources');
});

it('renders three tabs labelled Relationships, Retrieved chunks, and Grounding, reusing the composed children\'s own default strings', async () => {
  const el = await populated();
  const tabs = el.shadowRoot!.querySelector('lr-tabs') as LyraTabs;
  await tabs.updateComplete;
  const labels = [...tabs.shadowRoot!.querySelectorAll('[part="tab"]')].map((b) => b.textContent!.trim());
  expect(labels).to.deep.equal(['Relationships', 'Retrieved chunks', 'Grounding']);
});

it('defaults to the relationships tab active', async () => {
  const el = await populated();
  const tabs = el.shadowRoot!.querySelector('lr-tabs') as LyraTabs;
  expect(tabs.active).to.equal('relationships');
});

it('forwards neighbors/groupByRelation/expandable to lr-neighbor-list regardless of the active tab', async () => {
  const el = await populated();
  el.groupByRelation = true;
  el.expandable = true;
  await el.updateComplete;
  const list = el.shadowRoot!.querySelector('lr-neighbor-list') as LyraNeighborList;
  expect(list.rows).to.deep.equal(neighbors);
  expect(list.groupByRelation).to.be.true;
  expect(list.expandable).to.be.true;
});

it('forwards chunks/thresholds to lr-chunk-inspector, and the same thresholds to lr-provenance-panel', async () => {
  const el = await populated();
  el.thresholds = { high: 0.9, medium: 0.6 };
  await el.updateComplete;
  const inspector = el.shadowRoot!.querySelector('lr-chunk-inspector') as LyraChunkInspector;
  expect(inspector.chunks).to.deep.equal(chunks);
  expect(inspector.thresholds).to.deep.equal({ high: 0.9, medium: 0.6 });
  const panel = el.shadowRoot!.querySelector('lr-provenance-panel') as LyraProvenancePanel;
  expect(panel.thresholds).to.deep.equal({ high: 0.9, medium: 0.6 });
});

it('forwards provenance and types to lr-provenance-panel', async () => {
  const el = await populated();
  const panel = el.shadowRoot!.querySelector('lr-provenance-panel') as LyraProvenancePanel;
  expect(panel.provenance).to.deep.equal(provenance);
  expect(panel.types).to.deep.equal([{ id: 'person', label: 'Person' }]);
});

it('switches the active tab and re-renders lr-tabs.active when a tab button is clicked', async () => {
  const el = await populated();
  const tabs = el.shadowRoot!.querySelector('lr-tabs') as LyraTabs;
  await tabs.updateComplete;
  const chunksTabButton = [...tabs.shadowRoot!.querySelectorAll('[part="tab"]')].find((b) => b.textContent!.trim() === 'Retrieved chunks') as HTMLButtonElement;
  const listener = oneEvent(el, 'lr-tabs-change');
  chunksTabButton.click();
  const event = await listener;
  expect(event.detail.tabId).to.equal('chunks');
  await el.updateComplete;
  expect(tabs.active).to.equal('chunks');
});

it('lets a deeply-nested composed event (lr-entity-activate from lr-entity-card, two shadow roots deep) bubble to the dossier host unmodified', async () => {
  const el = await populated();
  const card = el.shadowRoot!.querySelector('lr-entity-card') as LyraEntityCard;
  const focusButton = card.shadowRoot!.querySelector('[part="focus-button"]') as HTMLButtonElement;
  const listener = oneEvent(el, 'lr-entity-activate');
  focusButton.click();
  const event = await listener;
  expect(event.detail).to.deep.equal({ id: 'e1' });
});

it('forwards a host aria-label to the internal lr-tabs strip', async () => {
  const el = (await fixture(html`<lr-entity-dossier aria-label="Entity detail"></lr-entity-dossier>`)) as LyraEntityDossier;
  el.entity = entity;
  await el.updateComplete;
  const tabs = el.shadowRoot!.querySelector('lr-tabs')!;
  expect(tabs.getAttribute('aria-label')).to.equal('Entity detail');
});

it('honors a .strings override of a reused key (neighborListLabel) on the relationships tab label', async () => {
  const el = await populated();
  el.strings = { neighborListLabel: 'Relations' };
  await el.updateComplete;
  const tabs = el.shadowRoot!.querySelector('lr-tabs') as LyraTabs;
  await tabs.updateComplete;
  const labels = [...tabs.shadowRoot!.querySelectorAll('[part="tab"]')].map((b) => b.textContent!.trim());
  expect(labels[0]).to.equal('Relations');
});

it('renders correctly under dir="rtl"', async () => {
  const el = (await fixture(html`<div dir="rtl"><lr-entity-dossier></lr-entity-dossier></div>`)).querySelector('lr-entity-dossier') as LyraEntityDossier;
  el.entity = entity;
  el.confidence = confidence;
  el.neighbors = neighbors;
  el.chunks = chunks;
  el.provenance = provenance;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('lr-tabs')).to.exist;
  await expect(el).to.be.accessible();
});

it('is accessible in the empty (entity=null) state', async () => {
  const el = (await fixture(html`<lr-entity-dossier></lr-entity-dossier>`)) as LyraEntityDossier;
  await expect(el).to.be.accessible();
});

it('is accessible in the fully populated state', async () => {
  const el = await populated();
  await expect(el).to.be.accessible();
});
