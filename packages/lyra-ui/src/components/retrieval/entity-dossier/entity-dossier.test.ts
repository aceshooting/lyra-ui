import { expectLabelInName, reviewComponentLabels } from '../../../../test/reviewed-labels.js';
import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import '../../lr-entity-dossier.js';
import type { LyraEntityDossier, LyraEntityDossierConfidence } from '../../lr-entity-dossier.js';
import type { LyraEntity } from '../../lr-entity-card.js';
import type { LyraNeighborRow } from '../../lr-neighbor-list.js';
import type { LyraChunk } from '../../lr-chunk-inspector.js';
import type { LyraProvenance } from '../../lr-provenance-panel.js';
import type { LyraTabGroup } from '../../lr-tab-group.js';
import type { LyraNeighborList } from '../../lr-neighbor-list.js';
import type { LyraChunkInspector } from '../../lr-chunk-inspector.js';
import type { LyraProvenancePanel } from '../../lr-provenance-panel.js';
import type { LyraStat } from '../../lr-stat.js';
import type { LyraEntityCard } from '../../lr-entity-card.js';

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

it('defaults to a null entity, empty collections, and withoutFocusButton=false', async () => {
  const el = (await fixture(html`<lr-entity-dossier></lr-entity-dossier>`)) as LyraEntityDossier;
  expect(el.entity).to.equal(null);
  expect(el.types).to.deep.equal([]);
  expect(el.communityLabel).to.equal('');
  expect(el.withoutFocusButton).to.be.false;
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
  expect((empty) != null).to.equal(true);
  expect(empty!.getAttribute('heading')).to.equal('No data');
  expect((el.shadowRoot!.querySelector('lr-tab-group')) == null).to.be.true;
});

it('renders lr-entity-card with entity/types/communityLabel/withoutFocusButton forwarded', async () => {
  const el = (await fixture(html`<lr-entity-dossier></lr-entity-dossier>`)) as LyraEntityDossier;
  el.entity = entity;
  el.types = [{ id: 'person', label: 'Person' }];
  el.communityLabel = 'Nobel laureates';
  el.withoutFocusButton = true;
  await el.updateComplete;
  const card = el.shadowRoot!.querySelector('lr-entity-card') as LyraEntityCard;
  expect(card).to.exist;
  expect(card.entity).to.deep.equal(entity);
  expect(card.types).to.deep.equal([{ id: 'person', label: 'Person' }]);
  expect(card.communityLabel).to.equal('Nobel laureates');
  expect(card.withoutFocusButton).to.be.true;
});

it('honors the plain without-focus-button attribute form, not just a property binding', async () => {
  const el = (await fixture(
    html`<lr-entity-dossier without-focus-button></lr-entity-dossier>`,
  )) as LyraEntityDossier;
  expect(el.withoutFocusButton).to.be.true;
  el.entity = entity;
  await el.updateComplete;
  const card = el.shadowRoot!.querySelector('lr-entity-card') as LyraEntityCard;
  expect(card.withoutFocusButton).to.be.true;
});

it('omits the confidence stat entirely when confidence is null (the default)', async () => {
  const el = (await fixture(html`<lr-entity-dossier></lr-entity-dossier>`)) as LyraEntityDossier;
  el.entity = entity;
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('[part="confidence"]')) == null).to.be.true;
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

it('gives a minimal confidence a blank unit and caption and the neutral variant', async () => {
  const el = (await fixture(html`<lr-entity-dossier></lr-entity-dossier>`)) as LyraEntityDossier;
  el.entity = entity;
  el.confidence = { label: 'Confidence', value: '71%' };
  await el.updateComplete;
  const stat = el.shadowRoot!.querySelector('[part="confidence"]') as LyraStat;

  expect([stat.label, stat.value, stat.unit, stat.caption, stat.variant]).to.deep.equal(['Confidence', '71%', '', '', 'neutral']);
});

it('renders three tabs labelled Relationships, Retrieved chunks, and Grounding, reusing the composed children\'s own default strings', async () => {
  const el = await populated();
  const tabs = el.shadowRoot!.querySelector('lr-tab-group') as LyraTabGroup;
  await tabs.updateComplete;
  const labels = [...tabs.shadowRoot!.querySelectorAll('[part="tab"]')].map((b) => b.textContent!.trim());
  expect(labels).to.deep.equal(['Relationships', 'Retrieved chunks', 'Grounding']);
});

it('defaults to the relationships tab active', async () => {
  const el = await populated();
  const tabs = el.shadowRoot!.querySelector('lr-tab-group') as LyraTabGroup;
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

it('surfaces the chunk inspector disclosure, without the removed lr-toggle, lr-chunk-toggle or lr-expand events', async () => {
  const el = await populated();
  const inspector = el.shadowRoot!.querySelector('lr-chunk-inspector') as LyraChunkInspector;
  const seen: string[] = [];
  el.addEventListener('lr-retrieval-disclosure-change', (event) =>
    seen.push(`disclosure:${JSON.stringify((event as CustomEvent).detail)}`)
  );
  for (const type of ['lr-toggle', 'lr-chunk-toggle', 'lr-expand'])
    el.addEventListener(type, () => seen.push(type));
  (inspector.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement).click();
  expect(seen).to.deep.equal(['disclosure:{"origin":"supporting","kind":"chunk","section":"chunks","chunkId":"ch1","expanded":true}']);
});

it('forwards provenance and types to lr-provenance-panel', async () => {
  const el = await populated();
  const panel = el.shadowRoot!.querySelector('lr-provenance-panel') as LyraProvenancePanel;
  expect(panel.provenance).to.deep.equal(provenance);
  expect(panel.types).to.deep.equal([{ id: 'person', label: 'Person' }]);
});

it('switches the active tab and re-renders lr-tab-group.active when a tab button is clicked', async () => {
  const el = await populated();
  const tabs = el.shadowRoot!.querySelector('lr-tab-group') as LyraTabGroup;
  await tabs.updateComplete;
  const chunksTabButton = [...tabs.shadowRoot!.querySelectorAll('[part="tab"]')].find((b) => b.textContent!.trim() === 'Retrieved chunks') as HTMLButtonElement;
  const listener = oneEvent(el, 'lr-tab-show');
  chunksTabButton.click();
  const event = await listener;
  expect(event.detail.tabId).to.equal('chunks');
  await el.updateComplete;
  expect(tabs.active).to.equal('chunks');
});

it('lets a deeply-nested composed event (lr-entity-select from lr-entity-card, two shadow roots deep) bubble to the dossier host unmodified', async () => {
  const el = await populated();
  const card = el.shadowRoot!.querySelector('lr-entity-card') as LyraEntityCard;
  const focusButton = card.shadowRoot!.querySelector('[part="focus-button"]') as HTMLButtonElement;
  const listener = oneEvent(el, 'lr-entity-select');
  focusButton.click();
  const event = await listener;
  expect(event.detail).to.deep.equal({ entityId: 'e1' });
});

describe('provenance-tab conduit events', () => {
  const richProvenance: LyraProvenance = {
    entities: [entity],
    chunks,
    communities: [{ id: 'c1', label: 'Nobel laureates', memberCount: 2 }],
    relationships: [
      {
        path: [
          { kind: 'node', node: entity },
          { kind: 'edge', relation: 'discovered' },
          { kind: 'node', node: { id: 'elem1', label: 'Polonium' } },
        ],
      },
    ],
  };

  async function provenancePanel(): Promise<LyraProvenancePanel> {
    const el = (await fixture(html`<lr-entity-dossier></lr-entity-dossier>`)) as LyraEntityDossier;
    el.entity = entity;
    el.types = [{ id: 'person', label: 'Person' }];
    el.provenance = richProvenance;
    await el.updateComplete;
    const tabs = el.shadowRoot!.querySelector('lr-tab-group') as LyraTabGroup;
    await tabs.updateComplete;
    // Third tab: the provenance panel. Selected by position rather than label so this stays
    // meaningful under a locale override of the reused `provenancePanelLabel` key.
    const provenanceTab = tabs.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="tab"]')[2]!;
    provenanceTab.click();
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('lr-provenance-panel') as LyraProvenancePanel;
    await panel.updateComplete;
    return panel;
  }

  function host(panel: LyraProvenancePanel): LyraEntityDossier {
    return (panel.getRootNode() as ShadowRoot).host as LyraEntityDossier;
  }

  it("surfaces a community card's lr-drill through the dossier host", async () => {
    const panel = await provenancePanel();
    const card = panel.shadowRoot!.querySelector('lr-community-card')!;
    await (card as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
    const drill = card.shadowRoot!.querySelector('[part="drill-button"]') as HTMLElement;
    const listener = oneEvent(host(panel), 'lr-drill');
    drill.click();
    expect((await listener).detail).to.deep.equal({ communityId: 'c1' });
  });

  it("surfaces an entity chip's lr-entity-open through the dossier host", async () => {
    const panel = await provenancePanel();
    const chip = panel.shadowRoot!.querySelector('lr-entity-chip')!;
    await (chip as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
    const listener = oneEvent(host(panel), 'lr-entity-open');
    (chip.shadowRoot!.querySelector('[part="base"]') as HTMLElement).dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true, composed: true }),
    );
    expect((await listener).detail).to.deep.equal({ entityId: 'e1' });
  });

  it("surfaces a relationship path strip's lr-relation-activate through the dossier host", async () => {
    const panel = await provenancePanel();
    const strip = panel.shadowRoot!.querySelector('lr-path-strip')!;
    await (strip as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
    const relation = strip.shadowRoot!.querySelector('[part="relation"]') as HTMLElement;
    const listener = oneEvent(host(panel), 'lr-relation-activate');
    relation.click();
    const detail = (await listener).detail as {
      relation: string;
      sourceNodeId?: string;
      targetNodeId?: string;
      occurrenceIndex: number;
    };
    expect(detail.relation).to.equal('discovered');
    expect(detail.sourceNodeId).to.equal('e1');
    expect(detail.targetNodeId).to.equal('elem1');
    expect(detail.occurrenceIndex).to.equal(1);
  });
});

it('keeps host naming distinct from the internal tab strip across dynamic changes', async () => {
  const el = (await fixture(html`<lr-entity-dossier aria-label="Entity detail"></lr-entity-dossier>`)) as LyraEntityDossier;
  el.entity = entity;
  await el.updateComplete;
  const tabs = el.shadowRoot!.querySelector('lr-tab-group')!;
  expect(el.getAttribute('aria-label')).to.equal('Entity detail');
  expect(tabs.getAttribute('aria-label')).to.equal(null);
  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('');
  expect(tabs.getAttribute('aria-label')).to.equal(null);
  el.setAttribute('aria-label', 'Revised entity detail');
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('Revised entity detail');
  expect(tabs.getAttribute('aria-label')).to.equal(null);
});

it('forwards a JS-only accessibleLabel override onto the internal tab strip', async () => {
  const el = (await fixture(html`<lr-entity-dossier></lr-entity-dossier>`)) as LyraEntityDossier;
  el.entity = entity;
  el.accessibleLabel = 'Person record tabs';
  await el.updateComplete;
  const tabs = el.shadowRoot!.querySelector('lr-tab-group')!;
  expect(el.hasAttribute('aria-label')).to.equal(false);
  expect(tabs.getAttribute('aria-label')).to.equal('Person record tabs');

  el.setAttribute('aria-label', 'Entity detail');
  await el.updateComplete;
  expect(tabs.getAttribute('aria-label')).to.equal(null);
});

it('honors a .strings override of a reused key (neighborListLabel) on the relationships tab label', async () => {
  const el = await populated();
  el.strings = { neighborListLabel: 'Relations' };
  await el.updateComplete;
  const tabs = el.shadowRoot!.querySelector('lr-tab-group') as LyraTabGroup;
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
  expect(el.shadowRoot!.querySelector('lr-tab-group')).to.exist;
  await expect(el).to.be.accessible({ ignoredRules: ['label-content-name-mismatch'] });
  await expectLabelInName(el, reviewComponentLabels(
    el, 'lr-neighbor-list', '[part="node-label"]', 'span:not([part])',
    'The entity name labels its action; relation, direction, type and degree describe the neighbor.',
  ));
});

it('is accessible in the empty (entity=null) state', async () => {
  const el = (await fixture(html`<lr-entity-dossier></lr-entity-dossier>`)) as LyraEntityDossier;
  await expect(el).to.be.accessible({ ignoredRules: ['label-content-name-mismatch'] });
  await expectLabelInName(el, reviewComponentLabels(
    el, 'lr-neighbor-list', '[part="node-label"]', 'span:not([part])',
    'The entity name labels its action; relation, direction, type and degree describe the neighbor.',
  ));
});

it('is accessible in the fully populated state', async () => {
  const el = await populated();
  await expect(el).to.be.accessible({ ignoredRules: ['label-content-name-mismatch'] });
  await expectLabelInName(el, reviewComponentLabels(
    el, 'lr-neighbor-list', '[part="node-label"]', 'span:not([part])',
    'The entity name labels its action; relation, direction, type and degree describe the neighbor.',
  ));
});

it("contains the composed lr-tab-group's lr-activate on a real repeat pick of the active tab", async () => {
  const el = await populated();
  const tabs = el.shadowRoot!.querySelector('lr-tab-group') as LyraTabGroup;
  await tabs.updateComplete;
  expect(tabs.active, 'the dossier opens on relationships').to.equal('relationships');
  const activeTab = tabs.shadowRoot!.querySelector<HTMLElement>('[part="tab"][aria-selected="true"]');
  expect(activeTab?.getAttribute('data-slot')).to.equal('relationships');
  let escaped = 0;
  const listener = (): void => {
    escaped++;
  };
  document.addEventListener('lr-activate', listener);
  try {
    activeTab!.click();
    await el.updateComplete;
  } finally {
    document.removeEventListener('lr-activate', listener);
  }
  await tabs.updateComplete;
  expect(tabs.active, 'the repeat pick changed nothing').to.equal('relationships');
  expect(
    escaped,
    "this component's documented contract is lr-tab-show with `tabId`; the child's raw event never escapes",
  ).to.equal(0);
});

describe('lr-entity-dossier retired show-focus-button alias', () => {
  const observe = (el: LyraEntityDossier): string => String((el.shadowRoot!.querySelector('lr-entity-card') as LyraEntityCard).withoutFocusButton);
  const mount = (markup: ReturnType<typeof html>) => fixture<LyraEntityDossier>(markup);

  it('applies without-focus-button with canonical defaults', async () => {
    let canonical = '';
    let plain = '';
    canonical = observe(await mount(html`<lr-entity-dossier .entity=${entity} without-focus-button></lr-entity-dossier>`));
    plain = observe(await mount(html`<lr-entity-dossier .entity=${entity}></lr-entity-dossier>`));
    expect(canonical).to.not.equal(plain);
  });
});

it('names the overall dossier independently of the compatibility tab-strip name', async () => {
  const el = await populated();
  const base = () => el.shadowRoot!.querySelector('[part="base"]')!;
  const tabs = () => el.shadowRoot!.querySelector('[part="tabs"]')!;
  expect(base().getAttribute('role')).to.equal('group');
  expect(base().getAttribute('aria-label')).to.equal('Details');
  el.accessibleLabel = 'Record tabs';
  el.label = 'Person record';
  await el.updateComplete;
  expect(base().getAttribute('aria-label')).to.equal('Person record');
  expect(tabs().getAttribute('aria-label')).to.equal('Record tabs');
  el.label = '';
  await el.updateComplete;
  expect(base().getAttribute('aria-label')).to.equal('');
  el.setAttribute('aria-label', 'Host record');
  await el.updateComplete;
  expect(base().hasAttribute('aria-label')).to.equal(false);
  expect(base().hasAttribute('role')).to.equal(false);
  expect(tabs().getAttribute('aria-label')).to.equal(null);
  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(base().getAttribute('aria-label')).to.equal('');
  el.removeAttribute('aria-label');
  el.label = null;
  el.strings = { details: 'Détails' };
  await el.updateComplete;
  expect(base().getAttribute('aria-label')).to.equal('Détails');
  await expect(el).to.be.accessible({ ignoredRules: ['label-content-name-mismatch'] });
  await expectLabelInName(el, reviewComponentLabels(
    el, 'lr-neighbor-list', '[part="node-label"]', 'span:not([part])',
    'The entity name labels its action; relation, direction, type and degree describe the neighbor.',
  ));
});


it('qualifies the supporting inspector toggle once, without the removed lr-chunk-toggle event', async () => {
  const el = await populated();
  const inspector = el.shadowRoot!.querySelector('lr-chunk-inspector') as LyraChunkInspector;
  const toggles: unknown[] = [];
  const legacy: unknown[] = [];
  el.addEventListener('lr-retrieval-disclosure-change', (event) => toggles.push(event.detail));
  el.addEventListener('lr-chunk-toggle', (event) => legacy.push((event as CustomEvent).detail));
  inspector.shadowRoot!.querySelector<HTMLButtonElement>('[part="toggle"]')!.click();
  expect(toggles).to.deep.equal([{ origin: 'supporting', kind: 'chunk', section: 'chunks', chunkId: 'ch1', expanded: true }]);
  expect(legacy).to.deep.equal([]);
});

it('leaves descendant toggles distinct from the inspector-owned disclosure event', async () => {
  const el = await populated();
  const inspector = el.shadowRoot!.querySelector('lr-chunk-inspector') as LyraChunkInspector;
  const child = document.createElement('span');
  inspector.append(child);
  const seen: unknown[] = [];
  el.addEventListener('lr-toggle', (event) => seen.push(event.detail));
  child.dispatchEvent(new CustomEvent('lr-toggle', {
    bubbles: true, composed: true, detail: { expanded: true, itemId: 'nested' },
  }));
  expect(seen).to.deep.equal([{ expanded: true, itemId: 'nested' }]);
});

it("lets the inner tab group's lr-tab-hide reach host listeners when the user switches tabs", async () => {
  const el = await populated();
  const tabs = el.shadowRoot!.querySelector('lr-tab-group') as LyraTabGroup;
  await tabs.updateComplete;
  const hidden: unknown[] = [];
  const onHide = (event: Event) => hidden.push((event as CustomEvent).detail);
  document.addEventListener('lr-tab-hide', onHide);
  try {
    const chunksTab = [...tabs.shadowRoot!.querySelectorAll('[part="tab"]')].find((b) => b.textContent!.trim() === 'Retrieved chunks') as HTMLButtonElement;
    const shown = oneEvent(el, 'lr-tab-show');
    chunksTab.click();
    await shown;
    expect(hidden.length).to.equal(1);
  } finally {
    document.removeEventListener('lr-tab-hide', onHide);
  }
});

it('delegates supporting and provenance disclosures once and dispatches no generic toggle', async () => {
  const el = await populated();
  const panel = el.shadowRoot!.querySelector('lr-provenance-panel')!;
  const supporting = el.shadowRoot!.querySelector<LyraChunkInspector>('[part="chunk-inspector"]')!;
  const legacy: unknown[] = [];
  const seen: unknown[] = [];
  el.addEventListener('lr-toggle', (event) => {
    legacy.push({ fromPanel: event.composedPath()[0] === panel, detail: event.detail });
  });
  el.addEventListener('lr-retrieval-disclosure-change', ({ detail }) => {
    const id: string = detail.kind === 'chunk' ? detail.chunkId : detail.section;
    expect(id).to.be.a('string');
  });
  const parent = el.parentElement!;
  parent.addEventListener('lr-retrieval-disclosure-change', (event) => {
    seen.push({ fromDossier: event.composedPath()[0] === el, detail: (event as CustomEvent).detail });
  });

  supporting.shadowRoot!.querySelector<HTMLButtonElement>('[part="toggle"]')!.click();
  panel.shadowRoot!.querySelector<HTMLButtonElement>('[part="header"]')!.click();
  const nested = panel.shadowRoot!.querySelector('lr-chunk-inspector')!;
  nested.size = 'm';
  await nested.updateComplete;
  nested.shadowRoot!.querySelector<HTMLButtonElement>('[part="toggle"]')!.click();
  const child = document.createElement('span');
  panel.append(child);
  child.dispatchEvent(new CustomEvent('lr-retrieval-disclosure-change', {
    bubbles: true, composed: true, detail: { kind: 'section', section: 'chunks', expanded: true },
  }));

  expect(seen).to.deep.equal([
    { fromDossier: true, detail: { kind: 'chunk', section: 'chunks', chunkId: 'ch1', expanded: true, origin: 'supporting' } },
    { fromDossier: true, detail: { kind: 'section', section: 'entities', expanded: false, origin: 'provenance' } },
    { fromDossier: true, detail: { kind: 'chunk', section: 'chunks', chunkId: 'ch1', expanded: true, origin: 'provenance' } },
    { fromDossier: false, detail: { kind: 'section', section: 'chunks', expanded: true } },
  ]);
  expect(legacy).to.deep.equal([]);
});

it('forwards heading-level to the nested entity card title', async () => {
  const el = await fixture<LyraEntityDossier>(html`<lr-entity-dossier heading-level="2" .entity=${entity}></lr-entity-dossier>`);
  const card = el.shadowRoot!.querySelector<LyraEntityCard>('lr-entity-card')!;
  await card.updateComplete;
  const title = () => card.shadowRoot!.querySelector('[part="title"]')!;
  expect(title().getAttribute('aria-level')).to.equal('2');
  el.headingLevel = undefined;
  await el.updateComplete;
  await card.updateComplete;
  expect(title().getAttribute('aria-level')).to.equal('3');
});
