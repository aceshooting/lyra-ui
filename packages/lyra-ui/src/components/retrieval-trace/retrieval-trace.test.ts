import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './retrieval-trace.js';
import type { LyraRetrievalTrace } from './retrieval-trace.js';
import type { RetrievalStage } from './retrieval-trace.class.js';
import type { LyraChunkInspector } from '../chunk-inspector/chunk-inspector.js';
import type { LyraSpanWaterfall } from '../span-waterfall/span-waterfall.js';

const STAGES: RetrievalStage[] = [
  {
    id: 'rewrite',
    kind: 'query-rewrite',
    startMs: 0,
    endMs: 40,
    status: 'success',
    evidence: { text: 'best hiking trails near Seattle' },
  },
  {
    id: 'embed',
    kind: 'embed',
    startMs: 40,
    endMs: 70,
    status: 'success',
    evidence: { metadata: { model: 'text-embedding-3', dimensions: 1536 } },
  },
  {
    id: 'retrieve',
    kind: 'retrieve',
    startMs: 70,
    endMs: 140,
    status: 'success',
    detail: '2 chunks',
    evidence: {
      chunks: [
        { id: 'c1', text: 'Mount Si is a popular day hike.', score: 0.91, source: { id: 's1', name: 'trail-guide.pdf' } },
        { id: 'c2', text: 'Rattlesnake Ledge offers sweeping views.', score: 0.84, source: { id: 's2', name: 'trail-guide.pdf' } },
      ],
    },
  },
  // No evidence -- must not grow an evidence row.
  { id: 'rerank', kind: 'rerank', startMs: 140, endMs: 160, status: 'success' },
  { id: 'filter', kind: 'filter', startMs: 160, endMs: 170, status: 'running' },
];

describe('lr-retrieval-trace', () => {
  it('renders one bar per stage through the internal lr-span-waterfall, sorted by startMs', async () => {
    const el = (await fixture(html`<lr-retrieval-trace .stages=${STAGES}></lr-retrieval-trace>`)) as LyraRetrievalTrace;
    await el.updateComplete;
    const waterfall = el.shadowRoot!.querySelector('lr-span-waterfall') as LyraSpanWaterfall;
    expect(waterfall).to.exist;
    const bars = [...waterfall.shadowRoot!.querySelectorAll('[part="bar"]')].map((b) => b.getAttribute('data-id'));
    expect(bars).to.deep.equal(['rewrite', 'embed', 'retrieve', 'rerank', 'filter']);
  });

  it('maps each stage kind to its localized default name, with a per-stage label override winning', async () => {
    const el = (await fixture(html`<lr-retrieval-trace .stages=${STAGES}></lr-retrieval-trace>`)) as LyraRetrievalTrace;
    await el.updateComplete;
    const waterfall = el.shadowRoot!.querySelector('lr-span-waterfall') as LyraSpanWaterfall;
    const names = [...waterfall.shadowRoot!.querySelectorAll('[part="row"] [part="name"]')].map((n) => n.textContent);
    expect(names).to.deep.equal(['Query rewrite', 'Embed', 'Retrieve', 'Rerank', 'Filter']);

    el.stages = [{ ...STAGES[0]!, label: 'Rewrite (gpt-4o-mini)' }];
    await el.updateComplete;
    const overridden = waterfall.shadowRoot!.querySelector('[part="row"] [part="name"]');
    expect(overridden!.textContent).to.equal('Rewrite (gpt-4o-mini)');
  });

  it('forwards activeStageId to the internal waterfall as activeSpanId', async () => {
    const el = (await fixture(
      html`<lr-retrieval-trace .stages=${STAGES} active-stage-id="retrieve"></lr-retrieval-trace>`,
    )) as LyraRetrievalTrace;
    await el.updateComplete;
    const waterfall = el.shadowRoot!.querySelector('lr-span-waterfall') as LyraSpanWaterfall;
    const bar = waterfall.shadowRoot!.querySelector('[data-id="retrieve"]') as HTMLElement;
    expect(bar.getAttribute('aria-current')).to.equal('true');
  });

  it('emits lr-stage-select when a timeline bar is activated', async () => {
    const el = (await fixture(html`<lr-retrieval-trace .stages=${STAGES}></lr-retrieval-trace>`)) as LyraRetrievalTrace;
    await el.updateComplete;
    const waterfall = el.shadowRoot!.querySelector('lr-span-waterfall') as LyraSpanWaterfall;
    const bar = waterfall.shadowRoot!.querySelector('[data-id="rewrite"]') as HTMLElement;
    setTimeout(() => bar.click());
    const ev = await oneEvent(el, 'lr-stage-select');
    expect(ev.detail).to.deep.equal({ id: 'rewrite' });
  });

  it('only stages with evidence grow an evidence row', async () => {
    const el = (await fixture(html`<lr-retrieval-trace .stages=${STAGES}></lr-retrieval-trace>`)) as LyraRetrievalTrace;
    await el.updateComplete;
    const rowIds = [...el.shadowRoot!.querySelectorAll('[part="evidence-row"]')].map((r) => r.getAttribute('data-id'));
    expect(rowIds).to.deep.equal(['rewrite', 'embed', 'retrieve']);
  });

  it('renders no evidence-list at all when no stage has evidence', async () => {
    const bare: RetrievalStage[] = [{ id: 'x', kind: 'retrieve', startMs: 0, status: 'success' }];
    const el = (await fixture(html`<lr-retrieval-trace .stages=${bare}></lr-retrieval-trace>`)) as LyraRetrievalTrace;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="evidence-list"]')).to.not.exist;
  });

  it('evidence rows start collapsed', async () => {
    const el = (await fixture(html`<lr-retrieval-trace .stages=${STAGES}></lr-retrieval-trace>`)) as LyraRetrievalTrace;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[data-id="retrieve"] [part="evidence-toggle"]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).to.equal('false');
    const body = el.shadowRoot!.querySelector('[data-id="retrieve"] [part="evidence-body"]') as HTMLElement;
    expect(body.hidden).to.be.true;
  });

  it('selecting a stage with evidence for the first time opens its evidence panel and emits lr-stage-toggle', async () => {
    const el = (await fixture(html`<lr-retrieval-trace .stages=${STAGES}></lr-retrieval-trace>`)) as LyraRetrievalTrace;
    await el.updateComplete;
    const waterfall = el.shadowRoot!.querySelector('lr-span-waterfall') as LyraSpanWaterfall;
    const bar = waterfall.shadowRoot!.querySelector('[data-id="retrieve"]') as HTMLElement;
    const listener = oneEvent(el, 'lr-stage-toggle');
    bar.click();
    const ev = await listener;
    expect(ev.detail).to.deep.equal({ id: 'retrieve', expanded: true });
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[data-id="retrieve"] [part="evidence-toggle"]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).to.equal('true');
  });

  it('selecting a stage with no evidence emits no lr-stage-toggle', async () => {
    const el = (await fixture(html`<lr-retrieval-trace .stages=${STAGES}></lr-retrieval-trace>`)) as LyraRetrievalTrace;
    await el.updateComplete;
    const waterfall = el.shadowRoot!.querySelector('lr-span-waterfall') as LyraSpanWaterfall;
    const bar = waterfall.shadowRoot!.querySelector('[data-id="rerank"]') as HTMLElement;
    let toggled = false;
    el.addEventListener('lr-stage-toggle', () => {
      toggled = true;
    });
    const listener = oneEvent(el, 'lr-stage-select');
    bar.click();
    await listener;
    expect(toggled).to.be.false;
  });

  it('clicking the evidence-toggle button directly toggles aria-expanded/hidden and emits lr-stage-toggle both ways', async () => {
    const el = (await fixture(html`<lr-retrieval-trace .stages=${STAGES}></lr-retrieval-trace>`)) as LyraRetrievalTrace;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[data-id="rewrite"] [part="evidence-toggle"]') as HTMLButtonElement;
    const body = el.shadowRoot!.querySelector('[data-id="rewrite"] [part="evidence-body"]') as HTMLElement;

    let listener = oneEvent(el, 'lr-stage-toggle');
    toggle.click();
    let ev = await listener;
    expect(ev.detail).to.deep.equal({ id: 'rewrite', expanded: true });
    await el.updateComplete;
    expect(toggle.getAttribute('aria-expanded')).to.equal('true');
    expect(body.hidden).to.be.false;

    listener = oneEvent(el, 'lr-stage-toggle');
    toggle.click();
    ev = await listener;
    expect(ev.detail).to.deep.equal({ id: 'rewrite', expanded: false });
    await el.updateComplete;
    expect(toggle.getAttribute('aria-expanded')).to.equal('false');
    expect(body.hidden).to.be.true;
  });

  it('renders free-form text evidence', async () => {
    const el = (await fixture(html`<lr-retrieval-trace .stages=${STAGES}></lr-retrieval-trace>`)) as LyraRetrievalTrace;
    await el.updateComplete;
    (el.shadowRoot!.querySelector('[data-id="rewrite"] [part="evidence-toggle"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const text = el.shadowRoot!.querySelector('[data-id="rewrite"] [part="evidence-text"]');
    expect(text!.textContent).to.equal('best hiking trails near Seattle');
  });

  it('renders chunk evidence via a compact lr-chunk-inspector, mapping source.id/name to sourceId/title', async () => {
    const el = (await fixture(html`<lr-retrieval-trace .stages=${STAGES}></lr-retrieval-trace>`)) as LyraRetrievalTrace;
    await el.updateComplete;
    (el.shadowRoot!.querySelector('[data-id="retrieve"] [part="evidence-toggle"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const inspector = el.shadowRoot!.querySelector('[data-id="retrieve"] lr-chunk-inspector') as LyraChunkInspector;
    expect(inspector).to.exist;
    expect(inspector.hasAttribute('compact')).to.be.true;
    expect(inspector.chunks).to.deep.equal([
      { id: 'c1', text: 'Mount Si is a popular day hike.', score: 0.91, sourceId: 's1', title: 'trail-guide.pdf' },
      { id: 'c2', text: 'Rattlesnake Ledge offers sweeping views.', score: 0.84, sourceId: 's2', title: 'trail-guide.pdf' },
    ]);
  });

  it('renders metadata evidence as a key/value list', async () => {
    const el = (await fixture(html`<lr-retrieval-trace .stages=${STAGES}></lr-retrieval-trace>`)) as LyraRetrievalTrace;
    await el.updateComplete;
    (el.shadowRoot!.querySelector('[data-id="embed"] [part="evidence-toggle"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const keys = [...el.shadowRoot!.querySelectorAll('[data-id="embed"] [part="evidence-metadata-key"]')].map((k) => k.textContent);
    const values = [...el.shadowRoot!.querySelectorAll('[data-id="embed"] [part="evidence-metadata-value"]')].map((v) => v.textContent);
    expect(keys).to.deep.equal(['model', 'dimensions']);
    expect(values).to.deep.equal(['text-embedding-3', '1536']);
  });

  it('prunes a stale expanded stage id when stages shrinks, instead of throwing or leaving it expanded (dangling-reference fixture)', async () => {
    const el = (await fixture(html`<lr-retrieval-trace .stages=${STAGES}></lr-retrieval-trace>`)) as LyraRetrievalTrace;
    await el.updateComplete;
    (el.shadowRoot!.querySelector('[data-id="retrieve"] [part="evidence-toggle"]') as HTMLButtonElement).click();
    await el.updateComplete;

    el.stages = STAGES.filter((s) => s.id !== 'retrieve');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-id="retrieve"]')).to.not.exist;

    el.stages = STAGES;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[data-id="retrieve"] [part="evidence-toggle"]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).to.equal('false');
  });

  it('registers lr-span-waterfall, lr-chunk-inspector, lr-live-region and lr-empty as a side effect of importing retrieval-trace.js (regression)', async () => {
    // Importing the *.class.js module alone never calls defineElement -- only the barrel (*.js)
    // does. Rendering an un-registered dependency silently produces a plain, un-upgraded
    // HTMLElement instead of the real component.
    expect(customElements.get('lr-span-waterfall')).to.exist;
    expect(customElements.get('lr-chunk-inspector')).to.exist;
    expect(customElements.get('lr-live-region')).to.exist;
    expect(customElements.get('lr-empty')).to.exist;
  });

  it('falls back to built-in English stage labels and honors a strings override', async () => {
    const el = (await fixture(html`<lr-retrieval-trace .stages=${STAGES}></lr-retrieval-trace>`)) as LyraRetrievalTrace;
    await el.updateComplete;
    const waterfall = el.shadowRoot!.querySelector('lr-span-waterfall') as LyraSpanWaterfall;
    expect(waterfall.shadowRoot!.querySelector('[part="row"] [part="name"]')!.textContent).to.equal('Query rewrite');

    el.strings = { retrievalStageQueryRewrite: 'Reformulation de requête' };
    await el.updateComplete;
    expect(waterfall.shadowRoot!.querySelector('[part="row"] [part="name"]')!.textContent).to.equal('Reformulation de requête');
  });

  it('falls back to the built-in English evidence-toggle template and honors a strings override', async () => {
    const el = (await fixture(html`<lr-retrieval-trace .stages=${STAGES}></lr-retrieval-trace>`)) as LyraRetrievalTrace;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[data-id="rewrite"] [part="evidence-toggle"]')!;
    expect(toggle.textContent!.trim()).to.equal('Query rewrite evidence');

    el.strings = { retrievalTraceEvidenceToggle: 'Preuves : {label}' };
    await el.updateComplete;
    const toggled = el.shadowRoot!.querySelector('[data-id="rewrite"] [part="evidence-toggle"]')!;
    expect(toggled.textContent!.trim()).to.equal('Preuves : Query rewrite');
  });

  it('reverses the collapsed evidence-toggle chevron under dir="rtl"', async () => {
    const ltr = (await fixture(html`<lr-retrieval-trace .stages=${STAGES}></lr-retrieval-trace>`)) as LyraRetrievalTrace;
    await ltr.updateComplete;
    const ltrIcon = ltr.shadowRoot!.querySelector('[data-id="rewrite"] [part="evidence-toggle-icon"] svg') as SVGElement;
    const ltrTransform = getComputedStyle(ltrIcon).transform;

    const rtl = (await fixture(html`<lr-retrieval-trace dir="rtl" .stages=${STAGES}></lr-retrieval-trace>`)) as LyraRetrievalTrace;
    await rtl.updateComplete;
    const rtlIcon = rtl.shadowRoot!.querySelector('[data-id="rewrite"] [part="evidence-toggle-icon"] svg') as SVGElement;
    const rtlTransform = getComputedStyle(rtlIcon).transform;

    expect(rtlTransform).to.not.equal(ltrTransform);
  });

  it('renders lr-empty inside the timeline when stages is empty (via lr-span-waterfall)', async () => {
    const el = (await fixture(html`<lr-retrieval-trace></lr-retrieval-trace>`)) as LyraRetrievalTrace;
    await el.updateComplete;
    const waterfall = el.shadowRoot!.querySelector('lr-span-waterfall') as LyraSpanWaterfall;
    expect(waterfall.shadowRoot!.querySelector('lr-empty')).to.exist;
  });

  it('is accessible with stages, an expanded chunk evidence panel, and an expanded metadata panel', async () => {
    const el = (await fixture(html`<lr-retrieval-trace .stages=${STAGES}></lr-retrieval-trace>`)) as LyraRetrievalTrace;
    await el.updateComplete;
    (el.shadowRoot!.querySelector('[data-id="retrieve"] [part="evidence-toggle"]') as HTMLButtonElement).click();
    (el.shadowRoot!.querySelector('[data-id="embed"] [part="evidence-toggle"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-id="retrieve"] lr-chunk-inspector')).to.exist;
    expect(el.shadowRoot!.querySelector('[data-id="embed"] [part="evidence-metadata"]')).to.exist;
    await expect(el).to.be.accessible();
  });
});
