import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { Engine3dHost, Engine3dInstance } from '../../../internal/engine-3d-loader.js';
import { chart3dEngineEnvironment, chart3dPointsLoader } from './chart-3d-engine.js';
import type { LyraChart3d, LyraChart3dColumns } from './chart-3d.class.js';
import './chart-3d.js';

function columns(): LyraChart3dColumns {
  return {
    ids: ['a', 'b', 'c'],
    x: Float32Array.from([0, 1, 2]),
    y: Float32Array.from([0, 2, 4]),
    z: Float32Array.from([0, 0, 1]),
  };
}

/** A renderer double that records the order of calls and lets a test act at one chosen step. */
interface Run {
  steps: string[];
  disposed: number;
  hosts: Engine3dHost[];
  onStep?: (step: string) => void;
  mountGate?: Promise<void>;
  mountFailure?: Error;
}

describe('lr-chart-3d renderer lifecycle re-entry', () => {
  const available = chart3dEngineEnvironment.available;
  let run: Run;

  const engine = (): Engine3dInstance => {
    const record = (step: string) => { run.steps.push(step); run.onStep?.(step); };
    return {
      contract: 1,
      async mount(_container, host) {
        run.hosts.push(host);
        record('mount');
        await run.mountGate;
        if (run.mountFailure) throw run.mountFailure;
      },
      setData() { record('setData'); },
      setStyle() { record('setStyle'); },
      setState() { record('setState'); },
      setCamera() { record('setCamera'); },
      fit() { record('fit'); },
      resize() { record('resize'); },
      dispose() { run.disposed++; },
    };
  };

  beforeEach(() => {
    run = { steps: [], disposed: 0, hosts: [] };
    chart3dEngineEnvironment.available = () => true;
    chart3dPointsLoader.override(async () => ({ createEngine: engine }));
  });

  afterEach(() => {
    chart3dPointsLoader.override(undefined);
    chart3dEngineEnvironment.available = available;
  });

  async function mount(): Promise<{ el: LyraChart3d; wrapper: HTMLElement }> {
    const wrapper = await fixture<HTMLElement>(html`<div></div>`);
    const el = document.createElement('lr-chart-3d') as LyraChart3d;
    el.setAttribute('engine', 'webgl');
    el.data = columns();
    wrapper.append(el);
    await el.updateComplete;
    return { el, wrapper };
  }

  for (const [interrupted, expected] of [
    ['setStyle', ['mount', 'setStyle']],
    ['setData', ['mount', 'setStyle', 'setData']],
    ['fit', ['mount', 'setStyle', 'setData', 'fit']],
    ['resize', ['mount', 'setStyle', 'setData', 'fit', 'resize']],
  ] as const) {
    it(`stops configuring and releases the renderer once when the element leaves during ${interrupted}`, async () => {
      const { el } = await mount();
      run.onStep = (step) => { if (step === interrupted) { run.onStep = undefined; el.remove(); } };
      await waitUntil(() => run.steps.includes(interrupted), `${interrupted} was never reached`, { timeout: 5000 });
      // wait-reason: asserting that no later configuration step ever runs; nothing signals the absence
      await aTimeout(60);
      expect(run.steps).to.deep.equal(expected);
      expect(run.disposed).to.equal(1);
    });
  }

  it('disposes a renderer the loader delivers after the element has already left', async () => {
    let deliver!: () => void;
    chart3dPointsLoader.override(() => new Promise((resolve) => { deliver = () => resolve({ createEngine: engine }); }));
    const { el } = await mount();
    await waitUntil(() => deliver !== undefined, 'the loader was never asked for the renderer');
    el.remove();
    deliver();
    await waitUntil(() => run.disposed === 1, 'the late renderer was not disposed');
    expect(run.steps).to.deep.equal([]);
  });

  it('reports no failure for a renderer whose mount rejects after the element has left', async () => {
    let release!: () => void;
    run.mountGate = new Promise<void>((resolve) => { release = resolve; });
    run.mountFailure = new Error('late mount rejection');
    const { el } = await mount();
    await waitUntil(() => run.hosts.length === 1, 'the renderer was never mounted');
    const fallbacks: unknown[] = [];
    el.addEventListener('lr-engine-fallback', (event) => fallbacks.push((event as CustomEvent).detail));
    el.remove();
    release();
    // wait-reason: asserting that no failure is ever reported for the retired renderer
    await aTimeout(60);
    expect(fallbacks).to.deep.equal([]);
    expect(run.disposed).to.equal(1);
  });

  it('ignores a rendering report from a renderer that was retired by disconnection', async () => {
    const { el, wrapper } = await mount();
    await waitUntil(() => el.shadowRoot!.querySelector('[part~="fit-button"]') !== null, 'the renderer did not become ready', { timeout: 5000 });
    const retired = run.hosts[0]!;
    el.remove();
    retired.rendering!({ software: true });
    wrapper.append(el);
    await waitUntil(() => run.hosts.length === 2 && el.shadowRoot!.querySelector('[part~="fit-button"]') !== null, 'the renderer did not restart', { timeout: 5000 });
    expect(el.shadowRoot!.querySelector('[part="engine-notice"]') === null).to.equal(true);
  });
});
