import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './drilldown-panel.js';
import type { LyraDrilldownPanel, DrilldownNode } from './drilldown-panel.js';
import type { LyraEntity } from '../../retrieval/entity-card/entity-card.js';
import type { LyraTabGroup } from '../tab-group/tab-group.js';
import type { LyraSourceCard } from '../../retrieval/source-card/source-card.js';
import type { LyraDocumentPreview } from '../../viewers/document-preview/document-preview.js';
import type { LyraEntityCard } from '../../retrieval/entity-card/entity-card.js';

const entity: LyraEntity = { id: 'e1', label: 'Marie Curie', type: 'person' };

const nodeWithEvidenceOnly: DrilldownNode = {
  id: 'datum-1',
  label: 'Q3 revenue anomaly',
  evidence: [{ id: 'src-1', title: 'annual_report.pdf', page: 12, href: 'https://example.com/report.pdf', excerpt: 'Revenue grew 12%…', full: 'Revenue grew 12% year over year, driven by…' }],
};

const nodeWithAllCategories: DrilldownNode = {
  id: 'datum-2',
  label: 'EMEA region',
  evidence: [{ id: 'src-2', title: 'field_notes.txt', excerpt: 'Observed a spike…' }],
  documents: [{ id: 'doc-1', name: 'contract.pdf', mimeType: 'application/pdf', uri: 'https://example.com/contract.pdf' }],
  entities: [entity],
};

async function populated(): Promise<LyraDrilldownPanel> {
  const el = (await fixture(html`<lr-drilldown-panel></lr-drilldown-panel>`)) as LyraDrilldownPanel;
  el.path = [nodeWithEvidenceOnly, nodeWithAllCategories];
  await el.updateComplete;
  return el;
}

it('defaults to an empty path, empty types, and showFocusButton=true', async () => {
  const el = (await fixture(html`<lr-drilldown-panel></lr-drilldown-panel>`)) as LyraDrilldownPanel;
  expect(el.path).to.deep.equal([]);
  expect(el.types).to.deep.equal([]);
  expect(el.communityLabel).to.equal('');
  expect(el.showFocusButton).to.be.true;
});

it('renders a "no item selected" empty state and no breadcrumb when path is empty', async () => {
  const el = (await fixture(html`<lr-drilldown-panel></lr-drilldown-panel>`)) as LyraDrilldownPanel;
  const empty = el.shadowRoot!.querySelector('[part="empty"]');
  expect((empty) != null).to.equal(true);
  expect(empty!.getAttribute('heading')).to.equal('No item selected');
  expect((el.shadowRoot!.querySelector('lr-breadcrumb')) == null).to.be.true;
});

it('renders the noData empty state when the current node has no content in any category', async () => {
  const el = (await fixture(html`<lr-drilldown-panel></lr-drilldown-panel>`)) as LyraDrilldownPanel;
  el.path = [{ id: 'datum-3', label: 'Empty datum' }];
  await el.updateComplete;
  const empty = el.shadowRoot!.querySelector('[part="empty"]');
  expect((empty) != null).to.equal(true);
  expect(empty!.getAttribute('heading')).to.equal('No data');
  // The breadcrumb still renders -- only the content area is empty.
  expect(el.shadowRoot!.querySelector('lr-breadcrumb')).to.exist;
});

it('renders one lr-breadcrumb-item per path node, marking only the last as current', async () => {
  const el = await populated();
  const items = el.shadowRoot!.querySelectorAll('lr-breadcrumb-item');
  expect(items.length).to.equal(2);
  expect(items[0].hasAttribute('current')).to.be.false;
  expect(items[1].hasAttribute('current')).to.be.true;
  expect(items[0].textContent!.trim()).to.equal('Q3 revenue anomaly');
  expect(items[1].textContent!.trim()).to.equal('EMEA region');
});

it('renders a clickable button for every non-current step and plain text (no button) for the current step', async () => {
  const el = await populated();
  const items = el.shadowRoot!.querySelectorAll('lr-breadcrumb-item');
  expect(items[0].shadowRoot!.querySelector('button[part~="base"]')).to.exist;
  expect(items[0].getAttribute('exportparts')).to.equal('base: breadcrumb-button');
  expect((items[1].shadowRoot!.querySelector('button[part~="base"]')) == null).to.be.true;
});

it('fires lr-drilldown-navigate with the step\'s id/index when a non-current breadcrumb button is activated', async () => {
  const el = await populated();
  const first = el.shadowRoot!.querySelector('lr-breadcrumb-item')!;
  const button = first.shadowRoot!.querySelector('button[part~="base"]') as HTMLButtonElement;
  const listener = oneEvent(el, 'lr-drilldown-navigate');
  button.click();
  const event = await listener;
  expect(event.detail).to.deep.equal({ id: 'datum-1', index: 0 });
  // Controlled component: the panel never mutates `path` itself in response.
  expect(el.path).to.deep.equal([nodeWithEvidenceOnly, nodeWithAllCategories]);
});

it('renders a single category directly with no lr-tab-group chrome when only one category has content', async () => {
  const el = (await fixture(html`<lr-drilldown-panel></lr-drilldown-panel>`)) as LyraDrilldownPanel;
  el.path = [nodeWithEvidenceOnly];
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('lr-tab-group')) == null).to.be.true;
  const category = el.shadowRoot!.querySelector('[part="category"]');
  expect((category) != null).to.equal(true);
  expect(category!.getAttribute('aria-label')).to.equal('Sources');
  expect(category!.querySelector('lr-source-card')).to.exist;
});

it('keeps a present host aria-label when categories shrink to a single region', async () => {
  const el = (await fixture(html`<lr-drilldown-panel aria-label="Related content"></lr-drilldown-panel>`)) as LyraDrilldownPanel;
  el.path = [nodeWithAllCategories];
  await el.updateComplete;

  el.path = [nodeWithEvidenceOnly];
  await el.updateComplete;
  const category = el.shadowRoot!.querySelector<HTMLElement>('[part="category"]')!;
  expect(category.getAttribute('aria-label')).to.equal('Related content');

  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(category.hasAttribute('aria-label')).to.equal(true);
  expect(category.getAttribute('aria-label')).to.equal('');

  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(category.getAttribute('aria-label')).to.equal('Sources');

  el.accessibleLabel = 'Programmatic content';
  await el.updateComplete;
  expect(category.getAttribute('aria-label')).to.equal('Programmatic content');

  el.path = [nodeWithAllCategories];
  await el.updateComplete;
  const tabs = el.shadowRoot!.querySelector('lr-tab-group') as LyraTabGroup;
  expect(tabs.getAttribute('aria-label')).to.equal('Programmatic content');
  await tabs.updateComplete;
  const tablist = tabs.shadowRoot!.querySelector('[role="tablist"]')!;
  expect(tablist.getAttribute('aria-label')).to.equal('Programmatic content');

  el.accessibleLabel = '';
  await el.updateComplete;
  await tabs.updateComplete;
  expect(tablist.hasAttribute('aria-label')).to.equal(true);
  expect(tablist.getAttribute('aria-label')).to.equal('');

  el.accessibleLabel = null;
  await el.updateComplete;
  await tabs.updateComplete;
  expect(tablist.hasAttribute('aria-label')).to.equal(false);
});

it('wraps content in lr-tab-group, labelled Sources/Documents/Entities, when the current node spans multiple categories', async () => {
  const el = await populated();
  const tabs = el.shadowRoot!.querySelector('lr-tab-group') as LyraTabGroup;
  expect(tabs).to.exist;
  await tabs.updateComplete;
  const labels = [...tabs.shadowRoot!.querySelectorAll('[part="tab"]')].map((b) => b.textContent!.trim());
  expect(labels).to.deep.equal(['Sources', 'Documents', 'Entities']);
});

it('renders lr-source-card per evidence item with source-id/title/page/href and excerpt/full slots mapped field-for-field', async () => {
  const el = (await fixture(html`<lr-drilldown-panel></lr-drilldown-panel>`)) as LyraDrilldownPanel;
  el.path = [nodeWithEvidenceOnly];
  await el.updateComplete;
  const card = el.shadowRoot!.querySelector('lr-source-card') as LyraSourceCard;
  expect(card.sourceId).to.equal('src-1');
  expect(card.title).to.equal('annual_report.pdf');
  expect(card.page).to.equal(12);
  expect(card.href).to.equal('https://example.com/report.pdf');
  expect(card.querySelector('[slot="excerpt"]')!.textContent).to.equal('Revenue grew 12%…');
  expect(card.querySelector('[slot="full"]')!.textContent).to.equal('Revenue grew 12% year over year, driven by…');
});

it('renders lr-document-preview per document with src/mime-type/filename derived from DocumentRef', async () => {
  const el = await populated();
  const preview = el.shadowRoot!.querySelector('lr-document-preview') as LyraDocumentPreview;
  expect(preview.src).to.equal('https://example.com/contract.pdf');
  expect(preview.mimeType).to.equal('application/pdf');
  expect(preview.filename).to.equal('contract.pdf');
});

it('renders lr-entity-card per entity with entity/types/communityLabel/showFocusButton forwarded', async () => {
  const el = await populated();
  el.types = [{ id: 'person', label: 'Person' }];
  el.communityLabel = 'Nobel laureates';
  el.showFocusButton = false;
  await el.updateComplete;
  const card = el.shadowRoot!.querySelector('lr-entity-card') as LyraEntityCard;
  expect(card.entity).to.deep.equal(entity);
  expect(card.types).to.deep.equal([{ id: 'person', label: 'Person' }]);
  expect(card.communityLabel).to.equal('Nobel laureates');
  expect(card.showFocusButton).to.be.false;
});

it('honors the plain show-focus-button="false" attribute form, not just a property binding', async () => {
  const el = (await fixture(
    html`<lr-drilldown-panel show-focus-button="false"></lr-drilldown-panel>`,
  )) as LyraDrilldownPanel;
  expect(el.showFocusButton).to.be.false;
  el.path = [nodeWithAllCategories];
  await el.updateComplete;
  const card = el.shadowRoot!.querySelector('lr-entity-card') as LyraEntityCard;
  expect(card.showFocusButton).to.be.false;
});

it('shows the Agent runs tab only once content is projected into the runs slot, keyed off the light DOM directly', async () => {
  const el = (await fixture(html`<lr-drilldown-panel></lr-drilldown-panel>`)) as LyraDrilldownPanel;
  el.path = [nodeWithEvidenceOnly];
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('lr-tab-group')) == null).to.be.true;

  const runContent = document.createElement('div');
  runContent.setAttribute('slot', 'runs');
  runContent.textContent = 'Run #42 — success';
  el.appendChild(runContent);
  // hasRunsSlot is recomputed by a MutationObserver, which fires asynchronously.
  await new Promise((resolve) => setTimeout(resolve, 0));
  await el.updateComplete;

  const tabs = el.shadowRoot!.querySelector('lr-tab-group') as LyraTabGroup;
  expect(tabs).to.exist;
  await tabs.updateComplete;
  const labels = [...tabs.shadowRoot!.querySelectorAll('[part="tab"]')].map((b) => b.textContent!.trim());
  expect(labels).to.include('Agent runs');
  expect(el.querySelector('[slot="runs"]')!.textContent).to.equal('Run #42 — success');
});

it('detects a slot="runs" attribute toggled on an already-connected child, not just a newly appended one', async () => {
  const el = (await fixture(html`<lr-drilldown-panel></lr-drilldown-panel>`)) as LyraDrilldownPanel;
  el.path = [nodeWithEvidenceOnly];
  await el.updateComplete;

  const runContent = document.createElement('div');
  runContent.textContent = 'Run #99 — success';
  el.appendChild(runContent); // connected, but not slotted into "runs" yet
  await new Promise((resolve) => setTimeout(resolve, 0));
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('lr-tab-group')) == null).to.be.true;

  runContent.setAttribute('slot', 'runs'); // toggled on an already-connected child
  await new Promise((resolve) => setTimeout(resolve, 0));
  await el.updateComplete;

  const tabs = el.shadowRoot!.querySelector('lr-tab-group') as LyraTabGroup;
  expect(tabs).to.exist;
  await tabs.updateComplete;
  const labels = [...tabs.shadowRoot!.querySelectorAll('[part="tab"]')].map((b) => b.textContent!.trim());
  expect(labels).to.include('Agent runs');
});

it('forwards a host aria-label to the internal lr-tab-group strip by presence', async () => {
  const el = (await fixture(html`<lr-drilldown-panel aria-label="Related content"></lr-drilldown-panel>`)) as LyraDrilldownPanel;
  el.path = [nodeWithAllCategories];
  await el.updateComplete;
  const tabs = el.shadowRoot!.querySelector('lr-tab-group') as LyraTabGroup;
  expect(tabs.getAttribute('aria-label')).to.equal('Related content');
  await tabs.updateComplete;
  const tablist = tabs.shadowRoot!.querySelector('[role="tablist"]')!;
  expect(tablist.getAttribute('aria-label')).to.equal('Related content');

  el.setAttribute('aria-label', '');
  await el.updateComplete;
  await tabs.updateComplete;
  expect(tabs.hasAttribute('aria-label')).to.equal(true);
  expect(tabs.getAttribute('aria-label')).to.equal('');
  expect(tablist.hasAttribute('aria-label')).to.equal(true);
  expect(tablist.getAttribute('aria-label')).to.equal('');

  el.removeAttribute('aria-label');
  await el.updateComplete;
  await tabs.updateComplete;
  expect(tabs.hasAttribute('aria-label')).to.equal(false);
  expect(tablist.hasAttribute('aria-label')).to.equal(false);
});

it('honors a .strings override of a component-local key (drilldownDocuments) on the documents tab label', async () => {
  const el = (await fixture(html`<lr-drilldown-panel></lr-drilldown-panel>`)) as LyraDrilldownPanel;
  el.strings = { drilldownDocuments: 'Fichiers' };
  el.path = [nodeWithAllCategories];
  await el.updateComplete;
  const tabs = el.shadowRoot!.querySelector('lr-tab-group') as LyraTabGroup;
  await tabs.updateComplete;
  const labels = [...tabs.shadowRoot!.querySelectorAll('[part="tab"]')].map((b) => b.textContent!.trim());
  expect(labels).to.include('Fichiers');
});

it('survives disconnect + reconnect and keeps tracking the runs slot afterward', async () => {
  const el = (await fixture(html`<lr-drilldown-panel></lr-drilldown-panel>`)) as LyraDrilldownPanel;
  const parent = el.parentElement!;
  parent.removeChild(el);
  parent.appendChild(el);
  el.path = [nodeWithEvidenceOnly];
  await el.updateComplete;

  const runContent = document.createElement('div');
  runContent.setAttribute('slot', 'runs');
  runContent.textContent = 'Run #7';
  el.appendChild(runContent);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await el.updateComplete;
  const tabs = el.shadowRoot!.querySelector('lr-tab-group') as LyraTabGroup;
  await tabs.updateComplete;
  const labels = [...tabs.shadowRoot!.querySelectorAll('[part="tab"]')].map((b) => b.textContent!.trim());
  expect(labels).to.include('Agent runs');
});

it('recreates its slot observer in the adopted owner realm and disconnects it on adoption', async () => {
  const el = (await fixture(html`<lr-drilldown-panel></lr-drilldown-panel>`)) as LyraDrilldownPanel;
  await el.updateComplete;
  el.remove();
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const frameDocument = iframe.contentDocument;
  const frameWindow = iframe.contentWindow;
  if (!frameDocument || !frameWindow) {
    iframe.remove();
    throw new Error('The iframe realm was unavailable.');
  }
  const originalMutationObserver = frameWindow.MutationObserver;
  let observations = 0;
  let disconnects = 0;
  class OwnerMutationObserver implements MutationObserver {
    private observesPanel = false;
    constructor(_callback: MutationCallback) {}
    observe(target: Node, options?: MutationObserverInit): void {
      if (target === el && options?.attributeFilter?.includes('slot')) {
        this.observesPanel = true;
        observations += 1;
      }
    }
    takeRecords(): MutationRecord[] { return []; }
    disconnect(): void { if (this.observesPanel) disconnects += 1; }
  }
  frameWindow.MutationObserver = OwnerMutationObserver;

  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    expect(observations, 'the destination window observes the panel').to.equal(1);
    document.adoptNode(el);
    expect(disconnects, 'adoption disconnects the previous observer').to.equal(1);
  } finally {
    frameWindow.MutationObserver = originalMutationObserver;
    if (el.ownerDocument !== document) document.adoptNode(el);
    el.remove();
    iframe.remove();
  }
});

it('can shrink to a 320px allocation with a multi-category tabbed node', async () => {
  const wrapper = await fixture(html`
    <div style="display: flex; inline-size: 320px;">
      <lr-drilldown-panel></lr-drilldown-panel>
    </div>
  `);
  const el = wrapper.querySelector('lr-drilldown-panel') as LyraDrilldownPanel;
  el.path = [nodeWithEvidenceOnly, nodeWithAllCategories];
  await el.updateComplete;

  expect(getComputedStyle(el).minInlineSize).to.equal('0px');
  expect(el.getBoundingClientRect().width).to.be.at.most(320);
  expect(el.shadowRoot!.querySelector('lr-tab-group')).to.exist;
});

it('renders correctly under dir="rtl"', async () => {
  const wrapper = await fixture(html`<div dir="rtl"><lr-drilldown-panel></lr-drilldown-panel></div>`);
  const el = wrapper.querySelector('lr-drilldown-panel') as LyraDrilldownPanel;
  el.path = [nodeWithEvidenceOnly, nodeWithAllCategories];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('lr-tab-group')).to.exist;
  await expect(el).to.be.accessible();
});

it('is accessible in the empty (path=[]) state', async () => {
  const el = (await fixture(html`<lr-drilldown-panel></lr-drilldown-panel>`)) as LyraDrilldownPanel;
  await expect(el).to.be.accessible();
});

it('is accessible in the fully populated, multi-category tabbed state', async () => {
  const el = await populated();
  await expect(el).to.be.accessible();
});
