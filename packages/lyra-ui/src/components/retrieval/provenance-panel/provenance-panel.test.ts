import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './provenance-panel.js';
import type { LyraProvenancePanel, LyraProvenance } from './provenance-panel.js';

const provenance: LyraProvenance = {
  entities: [{ id: 'e1', label: 'Marie Curie', type: 'person' }],
  relationships: [{ path: [{ kind: 'node', node: { id: 'e1', label: 'Marie Curie' } }, { kind: 'edge', relation: 'discovered' }, { kind: 'node', node: { id: 'e2', label: 'Polonium' } }] }],
  communities: [{ id: 'c1', label: 'Nobel laureates', memberCount: 3 }],
  chunks: [{ id: 'ch1', text: 'chunk text', score: 0.8, sourceId: 's1' }],
};

it('renders the provenanceEmpty state when provenance is null (the default)', async () => {
  const el = (await fixture(html`<lr-provenance-panel></lr-provenance-panel>`)) as LyraProvenancePanel;
  expect(el.provenance).to.equal(null);
  expect(el.shadowRoot!.querySelector('lr-empty')).to.exist;
});

it('renders one section per non-empty provenance key, in fixed order, and omits empty ones', async () => {
  const el = (await fixture(html`<lr-provenance-panel></lr-provenance-panel>`)) as LyraProvenancePanel;
  el.provenance = { entities: provenance.entities };
  await el.updateComplete;
  const sections = el.shadowRoot!.querySelectorAll('[part="section"]');
  expect(sections.length).to.equal(1);
  expect(sections[0]!.textContent).to.include('Entities');
});

it('renders all four sections with counts when every key is present', async () => {
  const el = (await fixture(html`<lr-provenance-panel></lr-provenance-panel>`)) as LyraProvenancePanel;
  el.provenance = provenance;
  await el.updateComplete;
  const headers = [...el.shadowRoot!.querySelectorAll('[part="header"]')].map((h) => h.textContent);
  expect(headers.some((h) => h!.includes('Entities') && h!.includes('1'))).to.be.true;
  expect(headers.some((h) => h!.includes('Relationships'))).to.be.true;
  expect(headers.some((h) => h!.includes('Communities'))).to.be.true;
  expect(headers.some((h) => h!.includes('Text chunks'))).to.be.true;
});

it('renders entities as lr-entity-chip with resolved typeLabel from types', async () => {
  const el = (await fixture(html`<lr-provenance-panel></lr-provenance-panel>`)) as LyraProvenancePanel;
  el.provenance = { entities: provenance.entities };
  el.types = [{ id: 'person', label: 'Person' }];
  await el.updateComplete;
  const chip = el.shadowRoot!.querySelector('lr-entity-chip')!;
  expect(chip.getAttribute('type-label')).to.equal('Person');
});

it('renders relationships as lr-path-strip, communities as compact lr-community-card, chunks as compact lr-chunk-inspector', async () => {
  const el = (await fixture(html`<lr-provenance-panel></lr-provenance-panel>`)) as LyraProvenancePanel;
  el.provenance = provenance;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('lr-path-strip')).to.exist;
  const communityCard = el.shadowRoot!.querySelector('lr-community-card')!;
  expect(communityCard.hasAttribute('compact')).to.be.true;
  const inspector = el.shadowRoot!.querySelector('lr-chunk-inspector')!;
  expect(inspector.hasAttribute('compact')).to.be.true;
});

it('all four sections start expanded, and toggling one emits lr-toggle without collapsing the others', async () => {
  const el = (await fixture(html`<lr-provenance-panel></lr-provenance-panel>`)) as LyraProvenancePanel;
  el.provenance = provenance;
  await el.updateComplete;
  const headers = el.shadowRoot!.querySelectorAll('[part="header"]');
  expect([...headers].every((h) => h.getAttribute('aria-expanded') === 'true')).to.be.true;

  const listener = oneEvent(el, 'lr-toggle');
  (headers[0] as HTMLButtonElement).click();
  const event = await listener;
  expect(event.detail.expanded).to.be.false;
  await el.updateComplete;
  expect(headers[0]!.getAttribute('aria-expanded')).to.equal('false');
  expect(headers[1]!.getAttribute('aria-expanded')).to.equal('true');
});

it('re-emits child events unmodified (lr-chunk-open bubbles through)', async () => {
  const el = (await fixture(html`<lr-provenance-panel></lr-provenance-panel>`)) as LyraProvenancePanel;
  el.provenance = { chunks: provenance.chunks };
  await el.updateComplete;
  const listener = oneEvent(el, 'lr-chunk-open');
  (el.shadowRoot!.querySelector('lr-chunk-inspector')!.shadowRoot!.querySelector('[part="open-button"]') as HTMLButtonElement).click();
  const event = await listener;
  expect(event.detail).to.deep.equal({ id: 'ch1', sourceId: 's1' });
});

it('is accessible with full provenance', async () => {
  const el = (await fixture(html`<lr-provenance-panel></lr-provenance-panel>`)) as LyraProvenancePanel;
  el.provenance = provenance;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});
