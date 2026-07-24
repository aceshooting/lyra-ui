import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './retrieval-trace.js';
import { LyraRetrievalTrace } from './retrieval-trace.js';
import type { RetrievalStage } from './retrieval-trace.class.js';
import type { LyraChunkInspector } from '../chunk-inspector/chunk-inspector.js';
import type { LyraSpanWaterfall } from '../../agent-tools/span-waterfall/span-waterfall.js';

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

  it('falls back the internal timeline\'s accessible name to a host aria-label when label is unset', async () => {
    // The `label` property's own doc comment promises: "Falls back to a host `aria-label`, then
    // the timeline's own localized default." -- mirrors `<lr-trace-tree>`'s identical `label`
    // fallback chain, forwarded here to the internal `<lr-span-waterfall>` since that's the
    // element whose own `aria-label` actually renders.
    const el = (await fixture(
      html`<lr-retrieval-trace aria-label="Custom trace label" .stages=${STAGES}></lr-retrieval-trace>`,
    )) as LyraRetrievalTrace;
    await el.updateComplete;
    const waterfall = el.shadowRoot!.querySelector('lr-span-waterfall') as LyraSpanWaterfall;
    await waterfall.updateComplete;
    expect(waterfall.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Custom trace label');
  });

  it('keeps host aria-label ahead of label across late add, change, and removal', async () => {
    const el = (await fixture(
      html`<lr-retrieval-trace label="Explicit label" .stages=${STAGES}></lr-retrieval-trace>`,
    )) as LyraRetrievalTrace;
    const waterfall = el.shadowRoot!.querySelector('lr-span-waterfall') as LyraSpanWaterfall;
    await waterfall.updateComplete;
    expect(waterfall.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Explicit label');

    el.setAttribute('aria-label', 'Host trace label');
    await el.updateComplete;
    await waterfall.updateComplete;
    expect(waterfall.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Host trace label');

    el.setAttribute('aria-label', 'Changed host label');
    await el.updateComplete;
    await waterfall.updateComplete;
    expect(waterfall.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Changed host label');

    el.removeAttribute('aria-label');
    await el.updateComplete;
    await waterfall.updateComplete;
    expect(waterfall.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Explicit label');

    el.label = '';
    await el.updateComplete;
    await waterfall.updateComplete;
    expect(waterfall.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Span timeline');
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
    expect(values).to.deep.equal(['text-embedding-3', '1,536']);
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

  it('uses instance- and occurrence-safe evidence ids for hostile and duplicate stages', async () => {
    const stage: RetrievalStage = {
      ...STAGES[0]!,
      id: 'raw id\" with spaces',
    };
    const wrapper = (await fixture(
      html`<div>
        <lr-retrieval-trace .stages=${[stage, stage]}></lr-retrieval-trace>
        <lr-retrieval-trace .stages=${[stage]}></lr-retrieval-trace>
      </div>`,
    )) as HTMLDivElement;
    const traces = [...wrapper.querySelectorAll('lr-retrieval-trace')] as LyraRetrievalTrace[];
    const firstControls = [...traces[0]!.shadowRoot!.querySelectorAll('[part="evidence-toggle"]')].map(
      (toggle) => toggle.getAttribute('aria-controls')!,
    );
    const secondControls = traces[1]!.shadowRoot!
      .querySelector('[part="evidence-toggle"]')!
      .getAttribute('aria-controls')!;

    expect(firstControls).to.have.length(2);
    expect(new Set(firstControls).size).to.equal(2);
    expect(new Set([...firstControls, secondControls]).size).to.equal(3);
    for (const controls of firstControls) {
      expect(controls).to.not.include(stage.id);
      expect(traces[0]!.shadowRoot!.getElementById(controls)?.getAttribute('part')).to.equal(
        'evidence-body',
      );
    }
  });

  it('formats numeric evidence metadata with the effective locale', async () => {
    const el = (await fixture(
      html`<lr-retrieval-trace lang="ar-u-nu-arab" .stages=${STAGES}></lr-retrieval-trace>`,
    )) as LyraRetrievalTrace;
    (el.shadowRoot!.querySelector('[data-id="embed"] [part="evidence-toggle"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const values = [...el.shadowRoot!.querySelectorAll('[part="evidence-metadata-value"]')].map(
      (value) => value.textContent,
    );
    expect(values).to.include('١٬٥٣٦');
  });

  it('suppresses the raw child span-select event after translating it', async () => {
    const el = (await fixture(html`<lr-retrieval-trace .stages=${STAGES}></lr-retrieval-trace>`)) as LyraRetrievalTrace;
    let leaked = 0;
    el.addEventListener('lr-span-select', () => leaked++);
    el.shadowRoot!.querySelector('lr-span-waterfall')!.dispatchEvent(
      new CustomEvent('lr-span-select', { detail: { id: 'rewrite' }, bubbles: true, composed: true }),
    );
    await el.updateComplete;
    expect(leaked).to.equal(0);
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

describe('active-evidence cssprop escape hatch', () => {
  function resolvedInShadow(el: LyraRetrievalTrace, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  async function activeTrace(style = ''): Promise<{ el: LyraRetrievalTrace; row: HTMLElement }> {
    const wrapper = (await fixture(
      html`<div style=${style}>
        <lr-retrieval-trace .stages=${STAGES} active-stage-id="rewrite"></lr-retrieval-trace>
      </div>`,
    )) as HTMLElement;
    const el = wrapper.querySelector('lr-retrieval-trace') as LyraRetrievalTrace;
    await el.updateComplete;
    const row = el.shadowRoot!.querySelector('[part="evidence-row"][data-active]') as HTMLElement;
    return { el, row };
  }

  it('recolors the active evidence-row border from an ancestor via --lr-retrieval-trace-active-border', async () => {
    const { row } = await activeTrace('--lr-retrieval-trace-active-border: rgb(0, 51, 102)');
    expect(getComputedStyle(row).borderTopColor).to.equal('rgb(0, 51, 102)');
  });

  it('renders byte-identical to the brand token when unset', async () => {
    const { el, row } = await activeTrace();
    expect(getComputedStyle(row).borderTopColor).to.equal(
      resolvedInShadow(el, 'border-top-color: var(--lr-color-brand)', 'border-top-color'),
    );
  });

  it('is accessible with the active-evidence prop themed', async () => {
    const { el } = await activeTrace('--lr-retrieval-trace-active-border: rgb(0, 51, 102)');
    await expect(el).to.be.accessible();
  });
});

describe('lifecycle: super calls', () => {
  it('calls super.willUpdate() so a future shared mixin layered under LyraElement keeps running', async () => {
    // Neither LyraElement nor LitElement override willUpdate today (a true no-op on
    // ReactiveElement.prototype), so this can only be proven by spying on the inherited method
    // itself and confirming lr-retrieval-trace's own override still reaches it via
    // `super.willUpdate()` -- mirrors `<lr-graph>`'s identical test for the same pattern. The spy
    // is filtered to `this === el` because `LyraElement.prototype` is shared by every Lyra
    // component -- unfiltered, the nested `<lr-span-waterfall>`/`<lr-live-region>` instances this
    // component renders would also trip it on their own (unrelated) update cycles.
    const proto = Object.getPrototypeOf(LyraRetrievalTrace.prototype) as {
      willUpdate?: (changed: unknown) => void;
    };
    const hadOwnWillUpdate = Object.prototype.hasOwnProperty.call(proto, 'willUpdate');
    const originalWillUpdate = proto.willUpdate;
    let willUpdateCalls = 0;
    // Created (and the `el` reference bound) via `document.createElement` *before* connecting to
    // the DOM -- unlike `fixture()`, which appends and awaits `updateComplete` internally, so its
    // own first `willUpdate` call would already have fired before an `await fixture(...)`
    // assignment lands, leaving `el` still `undefined` when the spy's `this === el` check runs.
    const el = document.createElement('lr-retrieval-trace') as LyraRetrievalTrace;
    proto.willUpdate = function (this: unknown, changed: unknown) {
      if (this === el) willUpdateCalls++;
      originalWillUpdate?.call(this, changed);
    };
    try {
      document.body.appendChild(el);
      await el.updateComplete;
      expect(willUpdateCalls).to.be.greaterThan(0);
    } finally {
      el.remove();
      if (hadOwnWillUpdate) proto.willUpdate = originalWillUpdate;
      else delete proto.willUpdate;
    }
  });
});
