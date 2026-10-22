import { expect, fixture, html, oneEvent, waitUntil, aTimeout } from '@open-wc/testing';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './embedding-explorer.js';
import type { LyraEmbeddingExplorer } from './embedding-explorer.class.js';
import type { LyraPointColumns } from '../../../internal/typed-columns.js';
import type { Engine3dHost, Engine3dInstance } from '../../../internal/engine-3d-loader.js';
import { embeddingPointsLoader, embeddingEngineEnvironment } from './embedding-explorer-engine.js';

function columns(count: number): LyraPointColumns {
  return { ids: Array.from({ length: count }, (_, i) => `p${i}`), x: Float32Array.from({ length: count }, (_, i) => i), y: new Float32Array(count) };
}

describe('lr-embedding-explorer engine and columns', () => {
  const available = embeddingEngineEnvironment.available;
  let creates: number;
  let rows: number;
  let mode: string;
  let mountError: Error | undefined;
  let disposed: number;
  let stateError: boolean;
  let styleError: boolean;
  let styleCalls: number;
  let stateCalls: number;
  let resizeCalls: number;
  let host: Engine3dHost | undefined;
  let completeMount: (() => void) | undefined;
  let deferMount: boolean;
  beforeEach(() => {
    creates = rows = disposed = styleCalls = stateCalls = resizeCalls = 0; mode = ''; mountError = undefined; stateError = styleError = false;
    host = undefined; completeMount = undefined; deferMount = false;
    embeddingEngineEnvironment.available = () => true;
    embeddingPointsLoader.override(async () => ({ createEngine: (): Engine3dInstance => {
      creates++;
      return {
        contract: 1,
        async mount(_container, callbacks) { host = callbacks; if (mountError) throw mountError; if (deferMount) await new Promise<void>(resolve => { completeMount = resolve; }); },
        setData(data) { rows = (data as { positions: Float32Array }).positions.length / 3; mode = (data as { mode: string }).mode; },
        setStyle() { styleCalls++; if (styleError) throw new Error('style failed'); },
        setState() { stateCalls++; if (stateError) throw new Error('state failed'); },
        setCamera() {}, resize() { resizeCalls++; }, fit() {},
        dispose() { disposed++; },
      };
    } }));
  });
  afterEach(() => { embeddingEngineEnvironment.available = available; embeddingPointsLoader.override(undefined); });

  it('keeps an unset engine builtin and preserves ordinary sampling without a companion load', async () => {
    const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer .points=${Array.from({ length: 1200 }, (_, i) => ({ id: `p${i}`, x: i, y: 0 }))}></lr-embedding-explorer>`);
    expect(el.engine).to.equal('builtin');
    expect(creates).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="point"]').length).to.equal(1000);
    el.engine = 'mistyped' as 'builtin';
    await el.updateComplete;
    expect(el.engine).to.equal('builtin');
    expect(creates).to.equal(0);
  });

  it('pages all columns, gives columns precedence and reaches the last row by keyboard', async () => {
    const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer .pointColumns=${columns(405)} .points=${[{ id: 'ignored', x: 0, y: 0 }]}></lr-embedding-explorer>`);
    expect(el.shadowRoot!.querySelectorAll('[part="point"]').length).to.equal(200);
    expect(el.shadowRoot!.querySelectorAll('[data-id="ignored"]').length).to.equal(0);
    await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>('[data-row="0"]')!);
    await sendKeys({ press: 'End' });
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement?.getAttribute('data-row')).to.equal('404');
    const selected = oneEvent(el, 'lr-point-select');
    await sendKeys({ press: 'Enter' });
    const detail = (await selected).detail;
    expect(detail.id).to.equal('p404'); expect(detail.index).to.equal(404);
    expect(detail.point.id).to.equal('p404');
  });

  it('renders asynchronous mount state without another public assignment', async () => {
    deferMount = true;
    const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer engine="webgl" .pointColumns=${columns(2)}></lr-embedding-explorer>`);
    await waitUntil(() => completeMount !== undefined);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-busy')).to.equal('true');
    expect(el.shadowRoot!.querySelectorAll('[part="engine-notice"]').length).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('[part="point"]').length).to.equal(2);
    completeMount!();
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="row"]').length === 2);
    expect(el.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-busy')).to.equal('false');
    expect(el.shadowRoot!.querySelectorAll('[part="point"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="engine-notice"]').length).to.equal(0);
    expect(creates).to.equal(1);
  });

  it('restarts a ready renderer on reconnect without replacing its columns', async () => {
    const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer engine="webgl" .pointColumns=${columns(2)}></lr-embedding-explorer>`);
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="row"]').length === 2);
    const parent = el.parentElement!;
    el.remove();
    expect(disposed).to.equal(1);
    parent.append(el);
    await waitUntil(() => creates === 2 && el.shadowRoot!.querySelectorAll('[part="row"]').length === 2);
    const selected = oneEvent(el, 'lr-point-select');
    host!.pick(1, { shift: false, ctrl: false, double: false });
    expect((await selected).detail.id).to.equal('p1');
  });

  it('renders a delayed source result without rebinding the source', async () => {
    const bounds = { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    const result = { matchedCount: 1, bins: [{ bounds, count: 1 }], points: [{ id: 'delayed', x: 0, y: 0, sourceIndex: 0 }] };
    let resolve: ((value: typeof result) => void) | undefined;
    let queries = 0;
    const source = { revision: 1, count: 1, bounds,
      query: () => { queries++; return new Promise<typeof result>(complete => { resolve = complete; }); },
      getPoint: () => null,
    };
    const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer .source=${source}></lr-embedding-explorer>`);
    await waitUntil(() => resolve !== undefined);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-busy')).to.equal('true');
    const before = queries;
    resolve!(result);
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[data-id="delayed"]').length === 1);
    expect(el.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-busy')).to.equal('false');
    expect(queries).to.equal(before);
  });

  it('rejects invalid columns rather than revealing the lower-precedence points', async () => {
    const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer .pointColumns=${{ ...columns(2), ids: ['same', 'same'] }} .points=${[{ id: 'ignored', x: 0, y: 0 }]} .strings=${{ largeDataInvalid: 'Invalid {column}' }}></lr-embedding-explorer>`);
    expect(el.shadowRoot!.querySelector('[part="error"]')?.textContent).to.contain('Invalid pointColumns.ids');
    expect(el.shadowRoot!.querySelectorAll('[part="point"]').length).to.equal(0);
    el.pointColumns = columns(0); await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="empty"]').length).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
  });

  it('loads every admitted row without a per-row DOM cloud and preserves pick identity', async () => {
    const input = columns(1201);
    const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer engine="webgl" .pointColumns=${input}></lr-embedding-explorer>`);
    await waitUntil(() => rows === 1201);
    expect(el.shadowRoot!.querySelectorAll('[part="point"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(200);
    const selected = oneEvent(el, 'lr-point-select');
    host!.pick(1200, { shift: false, ctrl: false, double: false });
    expect((await selected).detail.index).to.equal(1200);
    expect(input.x[1200]).to.equal(1200);
    el.pointColumns = columns(3);
    await waitUntil(() => rows === 3);
  });

  it('checks WebGL before importing and renders localized fallback without a shadow live region', async () => {
    embeddingEngineEnvironment.available = () => false;
    const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer .pointColumns=${columns(2)} .strings=${{ engine3dUnsupported: 'No graphics', engine3dShowingBuiltin: 'Standard points' }}></lr-embedding-explorer>`);
    const fallback = oneEvent(el, 'lr-engine-fallback');
    el.engine = 'webgl';
    expect((await fallback).detail).to.deep.equal({ from: 'webgl', to: 'builtin', reason: 'unsupported' });
    await el.updateComplete;
    expect(creates).to.equal(0);
    expect(el.shadowRoot!.querySelector('[part="engine-notice"]')?.textContent).to.contain('No graphics');
    expect(el.shadowRoot!.querySelector('[part="engine-notice"]')?.getAttribute('role')).to.equal(null);
    expect(document.body.textContent).to.contain('No graphics');
  });

  it('disposes a pending mount after a live switch and ignores obsolete callbacks', async () => {
    deferMount = true;
    const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer engine="webgl" .pointColumns=${columns(2)}></lr-embedding-explorer>`);
    await waitUntil(() => completeMount !== undefined);
    const stale = host!;
    let picks = 0; el.addEventListener('lr-point-select', () => { picks++; });
    el.engine = 'builtin'; await el.updateComplete;
    completeMount!();
    await Promise.resolve(); await Promise.resolve();
    stale.pick(1, { shift: false, ctrl: false, double: false });
    expect(disposed).to.be.greaterThan(0); expect(picks).to.equal(0);
    expect(rows).to.equal(0);
  });

  it('preserves a lost engine for restoration, then suppresses restoration after disconnect', async () => {
    const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer engine="webgl" .pointColumns=${columns(2)}></lr-embedding-explorer>`);
    await waitUntil(() => rows === 2);
    const fallback = oneEvent(el, 'lr-engine-fallback');
    const callbacks = host!;
    callbacks.lost('context-lost');
    expect((await fallback).detail.reason).to.equal('context-lost');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="point"]').length).to.equal(2);
    expect(disposed).to.equal(0);
    callbacks.restored!(); await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="point"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(2);
    expect(creates).to.equal(1);
    expect(disposed).to.equal(0);
    el.remove(); callbacks.restored!();
    expect(disposed).to.equal(1);
    expect(creates).to.equal(1);
    expect((el as unknown as { renderer: { ready: boolean } }).renderer.ready).to.equal(false);
  });
  it('uses all ordinary admitted points in WebGL and supports optional z without mutating coordinates', async () => {
    const points = Array.from({ length: 1201 }, (_, index) => ({ id: `ordinary-${index}`, x: index, y: -index }));
    const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer engine="webgl" .points=${points}></lr-embedding-explorer>`);
    await waitUntil(() => rows === 1201);
    expect(mode).to.equal('2d');
    const data = columns(3);
    el.pointColumns = { ...data, z: new Float32Array([0, 1, 2]) };
    await waitUntil(() => rows === 3);
    expect(mode).to.equal('3d'); expect(data.x[2]).to.equal(2);
    const before = creates;
    el.pointColumns = el.pointColumns;
    await el.updateComplete;
    expect(creates).to.equal(before);
  });

  it('does not download while hidden and mounts when first visible', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div hidden><lr-embedding-explorer engine="webgl" .pointColumns=${columns(2)}></lr-embedding-explorer></div>`);
    await aTimeout(30);
    expect(creates).to.equal(0);
    wrapper.hidden = false;
    await waitUntil(() => rows === 2);
  });

  it('reports missing peers and mount rejection through the fallback contract', async () => {
    expectDevWarning('lyra-3d-points-unavailable');
    embeddingPointsLoader.override(async () => { throw new Error('unavailable'); });
    const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer .pointColumns=${columns(2)}></lr-embedding-explorer>`);
    const fallback = oneEvent(el, 'lr-engine-fallback');
    el.engine = 'webgl';
    expect((await fallback).detail.reason).to.equal('unavailable');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="point"]').length).to.equal(2);
  });

  it('falls back after a mount rejection and reconnects with a fresh engine', async () => {
    mountError = new Error('mount rejected');
    const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer .pointColumns=${columns(2)}></lr-embedding-explorer>`);
    const fallback = oneEvent(el, 'lr-engine-fallback');
    el.engine = 'webgl';
    expect((await fallback).detail.reason).to.equal('error');
    const parent = el.parentElement!;
    el.remove(); mountError = undefined;
    parent.append(el);
    await waitUntil(() => rows === 2);
    expect(creates).to.equal(2);
  });

  it('retains source precedence, reveal authority and a visible unsupported notice', async () => {
    const bounds = { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    const source = {
      revision: 1, count: 2, bounds,
      query: () => ({ matchedCount: 2, bins: [{ bounds, count: 2 }], points: [{ id: 'source', x: 0, y: 0, sourceIndex: 0 }] }),
      getPoint: (id: string) => id === 'revealed' ? { id, x: 1, y: 1, sourceIndex: 1 } : null,
    };
    const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer .source=${source} .pointColumns=${columns(3)}></lr-embedding-explorer>`);
    const fallback = oneEvent(el, 'lr-engine-fallback');
    el.engine = 'webgl';
    expect((await fallback).detail.reason).to.equal('unsupported');
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[data-id="source"]').length === 1);
    expect(creates).to.equal(0);
    expect(await el.revealSourcePoint('revealed')).to.equal(true);
    expect(el.shadowRoot!.activeElement?.getAttribute('data-id')).to.equal('revealed');
    el.source = null;
    await waitUntil(() => rows === 3);
    expect(await el.revealSourcePoint('revealed')).to.equal(false);
  });

  it('rejects blank IDs and the point ceiling, and accepts unnamed sparse cluster values', async () => {
    const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer .pointColumns=${{ ...columns(1), ids: [' '] }}></lr-embedding-explorer>`);
    expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(1);
    el.pointColumns = { ids: new Array<string>(1_000_001), x: new Float32Array(0), y: new Float32Array(0) };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="error"]')?.textContent).to.contain('1,000,000');
    el.pointColumns = { ...columns(2), cluster: new Uint16Array([2, 65535]) };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-row="1"]')?.getAttribute('aria-description')).to.equal('65535');
    expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
  });

  it('supports RTL row navigation, shrinks the cursor, and exposes a populated accessible alternative', async () => {
    const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer dir="rtl" .pointColumns=${columns(205)}></lr-embedding-explorer>`);
    await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>('[data-row="0"]')!);
    await sendKeys({ press: 'ArrowLeft' });
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement?.getAttribute('data-row')).to.equal('1');
    await sendKeys({ press: 'End' });
    await el.updateComplete;
    el.pointColumns = columns(2);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="point"][tabindex="0"]').length).to.equal(1);
    expect(el.shadowRoot!.activeElement?.getAttribute('data-row')).to.equal('0');
    el.engine = 'webgl';
    await waitUntil(() => rows === 2);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(2);
    await expect(el).to.be.accessible();
  });

  it('includes all visible row content in localized names while preserving the host name', async () => {
    const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer engine="webgl" lang="de" aria-label="Chosen plot" label="Other plot"
      .points=${[{ id: 'labelled', label: 'Alpha', x: 1234.5, y: -2.5, z: 3.5, cluster: 'Guides' }]}
      .strings=${{
        embeddingExplorerPoint: '{label}; Punkt {index}',
        paginationLabel: 'Seitennavigation',
        previous: 'Zurück',
        next: 'Weiter',
        paginationApplied: 'Seite {page} von {totalPages}',
        engine3dLoading: '3D-Ansicht wird geladen…',
      }}></lr-embedding-explorer>`);
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="row"]').length === 1);
    const row = el.shadowRoot!.querySelector('[part="row"]')!;
    expect(row.textContent?.replace(/\s+/g, ' ').trim()).to.equal('Alpha 1.234,5, -2,5, 3,5 Guides');
    expect(row.getAttribute('aria-label')).to.equal('Alpha 1.234,5, -2,5, 3,5 Guides; Punkt 1');
    expect(el.shadowRoot!.querySelector('[part="rows"]')?.getAttribute('aria-label')).to.equal('Chosen plot');
    expect(el.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-label')).to.equal('Chosen plot');
    expect(el.shadowRoot!.querySelector('[part="pagination"]')?.getAttribute('aria-label')).to.equal('Seitennavigation');
    expect(el.shadowRoot!.querySelector('[part="pagination"]')?.textContent).to.contain('Seite 1 von 1');
    await expect(el).to.be.accessible();
  });

  it('retains a ready engine across unchanged engine and null-source assignments', async () => {
    const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer engine="webgl" .pointColumns=${columns(2)}></lr-embedding-explorer>`);
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="row"]').length === 2);
    const callbacks = host!;
    el.engine = 'webgl';
    el.source = null;
    await el.updateComplete;
    expect(disposed).to.equal(0);
    expect(creates).to.equal(1);
    const selected = oneEvent(el, 'lr-point-select');
    callbacks.pick(1, { shift: false, ctrl: false, double: false });
    expect((await selected).detail.id).to.equal('p1');
  });

  it('exposes named cluster descriptions on the ready text alternative', async () => {
    const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer engine="webgl" .pointColumns=${{ ...columns(2), cluster: new Uint16Array([0, 1]), clusters: ['Guides', 'Examples'] }}></lr-embedding-explorer>`);
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="row"]').length === 2);
    expect(el.shadowRoot!.querySelector('[part="row"][data-row="1"]')?.getAttribute('aria-description')).to.equal('Examples');
  });

  for (const duringMount of [false, true]) {
    it(`releases terminal engine resources after ${duringMount ? 'initial state' : 'live style'} failure without descending twice`, async () => {
      const OriginalResizeObserver = window.ResizeObserver;
      const observations: Array<{ target: Element | null; disconnected: boolean; deliver: () => void }> = [];
      window.ResizeObserver = class implements ResizeObserver {
        private readonly observation: typeof observations[number];
        constructor(callback: ResizeObserverCallback) {
          this.observation = { target: null, disconnected: false, deliver: () => callback([], this) };
          observations.push(this.observation);
        }
        observe(target: Element): void { this.observation.target = target; }
        unobserve(target: Element): void { if (this.observation.target === target) this.observation.target = null; }
        disconnect(): void { this.observation.disconnected = true; }
      };
      let el: LyraEmbeddingExplorer | undefined;
      try {
        el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer .pointColumns=${columns(2)}></lr-embedding-explorer>`);
        let fallbacks = 0;
        el.addEventListener('lr-engine-fallback', () => { fallbacks++; });
        stateError = duringMount;
        const fallback = oneEvent(el, 'lr-engine-fallback');
        el.engine = 'webgl';
        if (!duringMount) {
          await waitUntil(() => el!.shadowRoot!.querySelectorAll('[part="row"]').length === 2);
          styleError = true;
          el.label = 'Changed name';
        }
        expect((await fallback).detail).to.deep.equal({ from: 'webgl', to: 'builtin', reason: 'error' });
        await el.updateComplete;
        const observer = observations.find(item => item.target?.getAttribute('part') === 'engine');
        expect(observer !== undefined).to.equal(true);
        expect(observer!.disconnected).to.equal(true);
        expect(disposed).to.equal(1);
        const calls = [styleCalls, stateCalls, resizeCalls];
        observer!.deliver();
        host!.lost('error'); host!.restored!();
        el.label = 'Another name';
        await el.updateComplete;
        expect([styleCalls, stateCalls, resizeCalls]).to.deep.equal(calls);
        expect(fallbacks).to.equal(1);
        expect(el.shadowRoot!.querySelectorAll('[part="point"]').length).to.equal(2);
        expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(0);
      } finally {
        el?.remove();
        window.ResizeObserver = OriginalResizeObserver;
      }
    });
  }

  for (const fence of ['aria-hidden', 'inert', 'visibility'] as const) {
    it(`starts after ${fence} is removed without another native intersection change`, async () => {
      const OriginalIntersectionObserver = window.IntersectionObserver;
      let element: Element | undefined;
      const intersected = new Set<Element>();
      window.IntersectionObserver = class extends OriginalIntersectionObserver {
        constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
          super((entries, observer) => {
            callback(entries, observer);
            for (const entry of entries) {
              const root = entry.target.getRootNode();
              if (entry.isIntersecting && root instanceof ShadowRoot) intersected.add(root.host);
            }
          }, options);
        }
      };
      let wrapper: HTMLDivElement | undefined;
      try {
        wrapper = await fixture<HTMLDivElement>(html`<div aria-hidden=${fence === 'aria-hidden' ? 'true' : 'false'} ?inert=${fence === 'inert'}
          style=${fence === 'visibility' ? 'visibility:hidden' : ''}><lr-embedding-explorer engine="webgl" .pointColumns=${columns(2)}></lr-embedding-explorer></div>`);
        element = wrapper.firstElementChild!;
        await waitUntil(() => element !== undefined && intersected.has(element), 'real native IO must report the hidden semantic branch intersecting');
        expect(creates).to.equal(0);
        const box = element.getBoundingClientRect();
        wrapper.removeAttribute('aria-hidden'); wrapper.inert = false; wrapper.style.visibility = 'visible';
        const after = element.getBoundingClientRect();
        expect([after.x, after.y, after.width, after.height]).to.deep.equal([box.x, box.y, box.width, box.height]);
        await waitUntil(() => element!.shadowRoot!.querySelectorAll('[part="row"]').length > 0, 'eligible unchanged geometry must admit renderer');
        expect(creates).to.equal(1);
        const internals = element as unknown as { renderer: { eligibility?: MutationObserver } };
        expect(internals.renderer.eligibility === undefined).to.equal(true);
      } finally {
        wrapper?.remove();
        window.IntersectionObserver = OriginalIntersectionObserver;
      }
    });
  }

});
