import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { Engine3dHost, Engine3dInstance } from '../../../internal/engine-3d-loader.js';
import type { LyraModelViewer } from './model-viewer.class.js';
import { modelEngineEnvironment, modelEngineLoader } from './model-viewer-loader.js';
import './model-viewer.js';

describe('model renderer callback ownership', () => {
  const available = modelEngineEnvironment.available;
  const source = 'data:text/plain,v%200%200%200%0Av%201%200%200%0Av%200%201%200%0Af%201%202%203';
  const camera = () => ({ yaw: 0, pitch: 0, distance: 10, target: { x: 0, y: 0, z: 0 } });
  let viewer: LyraModelViewer;
  let engines: Engine3dInstance[];
  let hosts: Engine3dHost[];
  let calls: string[][];
  let disposals: number[];
  let errors: number;
  let loads: number;
  let changes: number;
  let prepare: ((engine: Engine3dInstance) => void) | undefined;

  beforeEach(async () => {
    engines = []; hosts = []; calls = []; disposals = [];
    errors = loads = changes = 0; prepare = undefined;
    modelEngineEnvironment.available = () => true;
    modelEngineLoader.override(async () => ({ createEngine() {
      const index = engines.length;
      calls.push([]); disposals.push(0);
      const engine: Engine3dInstance = {
        contract: 1,
        async mount(container, host) {
          calls[index]!.push('mount'); hosts[index] = host;
          const canvas = container.ownerDocument.createElement('canvas');
          canvas.dataset['engine'] = String(index); container.append(canvas);
        },
        setStyle() { calls[index]!.push('setStyle'); },
        resize() { calls[index]!.push('resize'); },
        setCamera() { calls[index]!.push('setCamera'); },
        fit() { calls[index]!.push('fit'); return camera(); },
        positionOf: () => ({ x: 0, y: 0, z: 0 }),
        setData() { calls[index]!.push('setData'); queueMicrotask(() => hosts[index]!.progress?.(36, 36)); },
        dispose() { disposals[index] = disposals[index]! + 1; },
      };
      engines.push(engine);
      if (index === 0) prepare?.(engine);
      return engine;
    } }));
    viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer format="obj"></lr-model-viewer>`);
    viewer.addEventListener('lr-render-error', () => errors++);
    viewer.addEventListener('lr-load', () => loads++);
    viewer.addEventListener('lr-camera-change', () => changes++);
  });

  afterEach(() => {
    viewer.remove();
    modelEngineEnvironment.available = available;
    modelEngineLoader.override(undefined);
  });

  const ready = () => waitUntil(() => viewer.shadowRoot!.querySelector('[part="viewport"]')?.hasAttribute('data-ready') === true);
  const errorText = () => viewer.shadowRoot!.querySelector('[part="error"]')?.textContent ?? '';
  async function replacementReady(): Promise<void> {
    viewer.retry();
    await waitUntil(() => engines.length === 2 && loads === 1);
    await ready();
    expect(disposals).to.deep.equal([1, 0]);
    expect(viewer.shadowRoot!.querySelector('canvas')?.getAttribute('data-engine')).to.equal('1');
    expect(errorText()).to.equal('');
  }

  it('stops before mounting when initial styling clears the source', async () => {
    prepare = engine => { engine.setStyle = () => { calls[0]!.push('setStyle'); viewer.src = ''; }; };
    viewer.src = source;
    await waitUntil(() => disposals[0] === 1);
    await viewer.updateComplete;
    expect(calls[0]).to.deep.equal(['setStyle']);
    expect(viewer.shadowRoot!.querySelectorAll('canvas').length).to.equal(0);
    expect(errors).to.equal(0); expect(loads).to.equal(0);
    viewer.src = source;
    await waitUntil(() => engines.length === 2 && loads === 1);
    await ready();
    expect(disposals).to.deep.equal([1, 0]);
  });

  for (const throws of [false, true]) {
    it(`keeps a render error terminal when automatic fitting ${throws ? 'throws after' : 'returns after'} losing the renderer`, async () => {
      prepare = engine => { engine.fit = () => {
        hosts[0]!.lost('error');
        if (throws) throw new Error('Retired fit failed');
        return camera();
      }; };
      viewer.src = source;
      await waitUntil(() => disposals[0] === 1);
      await viewer.updateComplete;
      expect(errors).to.equal(1); expect(loads).to.equal(0);
      expect(viewer.camera).to.equal(undefined);
      expect(errorText()).to.contain('could not');
      await replacementReady();
    });
  }

  it('keeps context loss visible when geometry inspection reports it during parse completion', async () => {
    let loseContext = true;
    prepare = engine => { engine.positionOf = () => {
      if (loseContext) { loseContext = false; hosts[0]!.lost('context-lost'); }
      return { x: 0, y: 0, z: 0 };
    }; };
    viewer.src = source;
    await waitUntil(() => loads === 1);
    await viewer.updateComplete;
    expect(errorText()).to.contain('graphics context');
    expect(viewer.camera).to.equal(undefined);
    expect(disposals).to.deep.equal([0]);
    hosts[0]!.restored?.();
    await ready();
    expect(viewer.camera?.distance).to.equal(10);
    expect(loads).to.equal(1); expect(errors).to.equal(0);
  });

  it('keeps a geometry inspection failure visible instead of publishing a ready model', async () => {
    prepare = engine => { engine.positionOf = () => {
      hosts[0]!.lost('error'); return { x: 0, y: 0, z: 0 };
    }; };
    viewer.src = source;
    await waitUntil(() => disposals[0] === 1);
    await viewer.updateComplete;
    expect(errorText()).to.contain('could not');
    expect(viewer.shadowRoot!.querySelector('[part="viewport"]')?.hasAttribute('data-ready')).to.equal(false);
    expect(errors).to.equal(1); expect(loads).to.equal(0);
    await replacementReady();
  });

  it('contains a camera assignment exception after the renderer has already reported failure', async () => {
    viewer.src = source; await ready(); loads = 0;
    engines[0]!.setCamera = () => { hosts[0]!.lost('error'); throw new Error('Retired assignment failed'); };
    expect(() => { viewer.camera = { ...camera(), distance: 25 }; }).not.to.throw();
    await viewer.updateComplete;
    expect(errors).to.equal(1); expect(changes).to.equal(0);
    expect(viewer.camera?.distance).to.equal(25);
    await replacementReady();
  });

  it('does not attach environment observers after the initial authored camera clears the source', async () => {
    const ResizeObserver = window.ResizeObserver;
    let observed = 0;
    window.ResizeObserver = class extends ResizeObserver {
      override observe(target: Element, options?: ResizeObserverOptions): void {
        if (target.getRootNode() === viewer.shadowRoot && target.getAttribute('part') === 'viewport') observed++;
        super.observe(target, options);
      }
    };
    try {
      viewer.camera = camera();
      prepare = engine => { engine.setCamera = () => { viewer.src = ''; }; };
      viewer.src = source;
      await waitUntil(() => disposals[0] === 1);
      await viewer.updateComplete;
      expect(observed).to.equal(0);
      expect(calls[0]).to.deep.equal(['setStyle', 'mount']);
      expect(viewer.shadowRoot!.querySelectorAll('canvas').length).to.equal(0);
      expect(errors).to.equal(0); expect(loads).to.equal(0);
      viewer.src = source;
      await waitUntil(() => engines.length === 2 && loads === 1);
      await ready();
      expect(observed).to.equal(1);
    } finally { window.ResizeObserver = ResizeObserver; }
  });

  for (const stage of ['setStyle', 'resize'] as const) {
    for (const throws of [false, true]) {
      it(`reports one failure when restored ${stage} ${throws ? 'throws after' : 'returns after'} losing the renderer`, async () => {
        viewer.src = source; await ready(); loads = 0;
        engines[0]![stage] = () => {
          calls[0]!.push('lost'); hosts[0]!.lost('error');
          if (throws) throw new Error('Retired refresh failed');
        };
        hosts[0]!.lost('context-lost'); hosts[0]!.restored?.();
        await viewer.updateComplete;
        expect(errors).to.equal(1); expect(loads).to.equal(0);
        expect(calls[0]!.at(-1)).to.equal('lost');
        expect(disposals).to.deep.equal([1]);
        expect(errorText()).to.contain('could not');
        await replacementReady();
      });
    }
  }

  for (const key of ['ArrowRight', 'Home']) {
    it(`preserves the last camera when ${key} loses its graphics context`, async () => {
      viewer.src = source; await ready();
      const initial = viewer.camera;
      let loseContext = true;
      const operation = () => {
        if (loseContext) { loseContext = false; hosts[0]!.lost('context-lost'); }
        return { ...camera(), distance: 50 };
      };
      if (key === 'Home') engines[0]!.fit = operation;
      else engines[0]!.setCamera = operation;
      const surface = viewer.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
      await focusByKeyboard(surface);
      surface.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      await viewer.updateComplete;
      expect(errorText()).to.contain('graphics context');
      expect(viewer.camera).to.deep.equal(initial);
      expect(changes).to.equal(0); expect(errors).to.equal(0);
      expect(disposals).to.deep.equal([0]);
      hosts[0]!.restored?.();
      await ready();
      expect(errorText()).to.equal('');
      expect(loads).to.equal(1);
    });

    for (const throws of [false, true]) {
      it(`does not publish the ${key} camera change when the renderer ${throws ? 'throws after' : 'returns after'} failure`, async () => {
        viewer.src = source; await ready(); loads = 0;
        const initial = viewer.camera;
        const operation = () => {
          hosts[0]!.lost('error');
          if (throws) throw new Error('Retired camera failed');
          return { ...camera(), distance: 50 };
        };
        if (key === 'Home') engines[0]!.fit = operation;
        else engines[0]!.setCamera = operation;
        const surface = viewer.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
        await focusByKeyboard(surface);
        surface.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        await viewer.updateComplete;
        expect(errors).to.equal(1); expect(changes).to.equal(0);
        expect(viewer.camera).to.deep.equal(initial);
        expect(errorText()).to.contain('could not');
        await replacementReady();
      });
    }
  }
});
