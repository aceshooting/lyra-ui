import { expect, fixture, html } from '@open-wc/testing';
import type { ReactiveElement } from 'lit';
import '../chunk-inspector/chunk-inspector.js';
import '../claim-evidence/claim-evidence.js';
import '../community-card/community-card.js';
import '../entity-card/entity-card.js';
import '../entity-dossier/entity-dossier.js';
import '../graph/graph.js';
import '../graph-legend/graph-legend.js';
import '../grounding-summary/grounding-summary.js';
import '../knowledge-base/knowledge-base.js';
import '../knowledge-base-admin/knowledge-base-admin.js';
import '../knowledge-graph-explorer/knowledge-graph-explorer.js';
import '../memory-panel/memory-panel.js';
import '../provenance-panel/provenance-panel.js';
import '../rag-answer/rag-answer.js';
import '../rag-eval-dashboard/rag-eval-dashboard.js';
import '../retrieval-results/retrieval-results.js';
import '../source-card/source-card.js';
import '../source-list/source-list.js';
import '../source-picker/source-picker.js';

describe('retrieval canonical public properties', () => {
  it('lr-chunk-inspector exposes size without reactive compact', () => {
    const element = document.createElement('lr-chunk-inspector');
    const ctor = element.constructor as typeof ReactiveElement;
    expect(ctor.elementProperties.has('compact')).to.equal(false);
    expect(ctor.elementProperties.has('size')).to.equal(true);
  });
  it('lr-claim-evidence exposes size without reactive compact', () => {
    const element = document.createElement('lr-claim-evidence');
    const ctor = element.constructor as typeof ReactiveElement;
    expect(ctor.elementProperties.has('compact')).to.equal(false);
    expect(ctor.elementProperties.has('size')).to.equal(true);
  });
  it('lr-community-card exposes size without reactive compact', () => {
    const element = document.createElement('lr-community-card');
    const ctor = element.constructor as typeof ReactiveElement;
    expect(ctor.elementProperties.has('compact')).to.equal(false);
    expect(ctor.elementProperties.has('size')).to.equal(true);
  });
  it('lr-entity-card exposes size without reactive compact', () => {
    const element = document.createElement('lr-entity-card');
    const ctor = element.constructor as typeof ReactiveElement;
    expect(ctor.elementProperties.has('compact')).to.equal(false);
    expect(ctor.elementProperties.has('size')).to.equal(true);
  });
  it('lr-entity-card exposes withoutFocusButton without reactive showFocusButton', () => {
    const element = document.createElement('lr-entity-card');
    const ctor = element.constructor as typeof ReactiveElement;
    expect(ctor.elementProperties.has('showFocusButton')).to.equal(false);
    expect(ctor.elementProperties.has('withoutFocusButton')).to.equal(true);
  });
  it('lr-entity-dossier exposes withoutFocusButton without reactive showFocusButton', () => {
    const element = document.createElement('lr-entity-dossier');
    const ctor = element.constructor as typeof ReactiveElement;
    expect(ctor.elementProperties.has('showFocusButton')).to.equal(false);
    expect(ctor.elementProperties.has('withoutFocusButton')).to.equal(true);
  });
  it('lr-graph-legend exposes withoutInteraction without reactive interactive', () => {
    const element = document.createElement('lr-graph-legend');
    const ctor = element.constructor as typeof ReactiveElement;
    expect(ctor.elementProperties.has('interactive')).to.equal(false);
    expect(ctor.elementProperties.has('withoutInteraction')).to.equal(true);
  });
  it('lr-graph exposes dimmedEdgeIds without reactive dimmedLinkIds', () => {
    const element = document.createElement('lr-graph');
    const ctor = element.constructor as typeof ReactiveElement;
    expect(ctor.elementProperties.has('dimmedLinkIds')).to.equal(false);
    expect(ctor.elementProperties.has('dimmedEdgeIds')).to.equal(true);
  });
  it('lr-graph exposes edgeDistance without reactive linkDistance', () => {
    const element = document.createElement('lr-graph');
    const ctor = element.constructor as typeof ReactiveElement;
    expect(ctor.elementProperties.has('linkDistance')).to.equal(false);
    expect(ctor.elementProperties.has('edgeDistance')).to.equal(true);
  });
  it('lr-graph exposes edges without reactive links', () => {
    const element = document.createElement('lr-graph');
    const ctor = element.constructor as typeof ReactiveElement;
    expect(ctor.elementProperties.has('links')).to.equal(false);
    expect(ctor.elementProperties.has('edges')).to.equal(true);
  });
  it('lr-graph exposes selectedEdgeIds without reactive selectedLinkIds', () => {
    const element = document.createElement('lr-graph');
    const ctor = element.constructor as typeof ReactiveElement;
    expect(ctor.elementProperties.has('selectedLinkIds')).to.equal(false);
    expect(ctor.elementProperties.has('selectedEdgeIds')).to.equal(true);
  });
  it('lr-graph exposes withEdgeLabels without reactive showEdgeLabels', () => {
    const element = document.createElement('lr-graph');
    const ctor = element.constructor as typeof ReactiveElement;
    expect(ctor.elementProperties.has('showEdgeLabels')).to.equal(false);
    expect(ctor.elementProperties.has('withEdgeLabels')).to.equal(true);
  });
  it('lr-grounding-summary exposes withoutClaims without reactive showClaims', () => {
    const element = document.createElement('lr-grounding-summary');
    const ctor = element.constructor as typeof ReactiveElement;
    expect(ctor.elementProperties.has('showClaims')).to.equal(false);
    expect(ctor.elementProperties.has('withoutClaims')).to.equal(true);
  });
  it('lr-knowledge-base-admin exposes withoutIngestion without reactive hideIngestion', () => {
    const element = document.createElement('lr-knowledge-base-admin');
    const ctor = element.constructor as typeof ReactiveElement;
    expect(ctor.elementProperties.has('hideIngestion')).to.equal(false);
    expect(ctor.elementProperties.has('withoutIngestion')).to.equal(true);
  });
  it('lr-knowledge-base exposes withoutCreate without reactive hideCreate', () => {
    const element = document.createElement('lr-knowledge-base');
    const ctor = element.constructor as typeof ReactiveElement;
    expect(ctor.elementProperties.has('hideCreate')).to.equal(false);
    expect(ctor.elementProperties.has('withoutCreate')).to.equal(true);
  });
  it('lr-knowledge-base exposes withoutSummary without reactive hideSummary', () => {
    const element = document.createElement('lr-knowledge-base');
    const ctor = element.constructor as typeof ReactiveElement;
    expect(ctor.elementProperties.has('hideSummary')).to.equal(false);
    expect(ctor.elementProperties.has('withoutSummary')).to.equal(true);
  });
  it('lr-knowledge-graph-explorer exposes edges without reactive links', () => {
    const element = document.createElement('lr-knowledge-graph-explorer');
    const ctor = element.constructor as typeof ReactiveElement;
    expect(ctor.elementProperties.has('links')).to.equal(false);
    expect(ctor.elementProperties.has('edges')).to.equal(true);
  });
  it('lr-knowledge-graph-explorer exposes query without reactive searchQuery', () => {
    const element = document.createElement('lr-knowledge-graph-explorer');
    const ctor = element.constructor as typeof ReactiveElement;
    expect(ctor.elementProperties.has('searchQuery')).to.equal(false);
    expect(ctor.elementProperties.has('query')).to.equal(true);
  });
  it('lr-rag-answer exposes withoutClaims without reactive showClaims', () => {
    const element = document.createElement('lr-rag-answer');
    const ctor = element.constructor as typeof ReactiveElement;
    expect(ctor.elementProperties.has('showClaims')).to.equal(false);
    expect(ctor.elementProperties.has('withoutClaims')).to.equal(true);
  });
  it('lr-rag-answer exposes withoutSources without reactive showSources', () => {
    const element = document.createElement('lr-rag-answer');
    const ctor = element.constructor as typeof ReactiveElement;
    expect(ctor.elementProperties.has('showSources')).to.equal(false);
    expect(ctor.elementProperties.has('withoutSources')).to.equal(true);
  });
  it('lr-rag-eval-dashboard exposes withoutChart without reactive showChart', () => {
    const element = document.createElement('lr-rag-eval-dashboard');
    const ctor = element.constructor as typeof ReactiveElement;
    expect(ctor.elementProperties.has('showChart')).to.equal(false);
    expect(ctor.elementProperties.has('withoutChart')).to.equal(true);
  });
  it('lr-retrieval-results exposes withoutDedupe without reactive dedupe', () => {
    const element = document.createElement('lr-retrieval-results');
    const ctor = element.constructor as typeof ReactiveElement;
    expect(ctor.elementProperties.has('dedupe')).to.equal(false);
    expect(ctor.elementProperties.has('withoutDedupe')).to.equal(true);
  });
  it('lr-retrieval-results exposes withoutSelection without reactive selectable', () => {
    const element = document.createElement('lr-retrieval-results');
    const ctor = element.constructor as typeof ReactiveElement;
    expect(ctor.elementProperties.has('selectable')).to.equal(false);
    expect(ctor.elementProperties.has('withoutSelection')).to.equal(true);
  });
  it('lr-source-card exposes size without reactive compact', () => {
    const element = document.createElement('lr-source-card');
    const ctor = element.constructor as typeof ReactiveElement;
    expect(ctor.elementProperties.has('compact')).to.equal(false);
    expect(ctor.elementProperties.has('size')).to.equal(true);
  });
  it('lr-source-card exposes heading without reactive title', () => {
    const element = document.createElement('lr-source-card');
    const ctor = element.constructor as typeof ReactiveElement;
    expect(ctor.elementProperties.has('title')).to.equal(false);
    expect(ctor.elementProperties.has('heading')).to.equal(true);
  });
  it('lr-source-list exposes size without reactive compact', () => {
    const element = document.createElement('lr-source-list');
    const ctor = element.constructor as typeof ReactiveElement;
    expect(ctor.elementProperties.has('compact')).to.equal(false);
    expect(ctor.elementProperties.has('size')).to.equal(true);
  });
  it('lr-source-picker exposes withoutSearch without reactive searchable', () => {
    const element = document.createElement('lr-source-picker');
    const ctor = element.constructor as typeof ReactiveElement;
    expect(ctor.elementProperties.has('searchable')).to.equal(false);
    expect(ctor.elementProperties.has('withoutSearch')).to.equal(true);
  });
  it('lr-source-picker exposes withoutSelectAll without reactive showSelectAll', () => {
    const element = document.createElement('lr-source-picker');
    const ctor = element.constructor as typeof ReactiveElement;
    expect(ctor.elementProperties.has('showSelectAll')).to.equal(false);
    expect(ctor.elementProperties.has('withoutSelectAll')).to.equal(true);
  });
  it('source-card title remains a native tooltip independent of its heading', async () => {
    const element = await fixture<HTMLElement & { heading: string }>(html`<lr-source-card heading="Source heading"></lr-source-card>`);
    element.title = 'Native tooltip';
    expect(element.getAttribute('title')).to.equal('Native tooltip');
    expect(element.heading).to.equal('Source heading');
    expect(element.shadowRoot?.querySelector('[part="title"]')?.textContent).to.contain('Source heading');
  });
});
