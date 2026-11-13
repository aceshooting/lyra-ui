import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { EmbeddingEngineController, embeddingEngineEnvironment, embeddingPointsLoader } from './embedding-explorer-engine.js';
import { EmbeddingRows } from './embedding-explorer-data.js';
import type { Engine3dHost, Engine3dInstance } from '../../../internal/engine-3d-loader.js';
import type { Engine3dFallbackDetail } from '../../../internal/engine-3d.js';

describe('embedding renderer callback ownership', () => {
  const available = embeddingEngineEnvironment.available;
  const rows = new EmbeddingRows(null, [{ id: 'first', x: 0, y: 0 }]);
  const replacementRows = new EmbeddingRows(null, [{ id: 'replacement', x: 1, y: 1 }]);
  let host: HTMLDivElement & { requestUpdate(): void };
  let surface: HTMLDivElement;
  let controller: EmbeddingEngineController;
  let engines: Engine3dInstance[];
  let callbacks: Engine3dHost[];
  let calls: string[][];
  let disposals: number[];
  let fallbacks: Engine3dFallbackDetail[];
  let picks: number[];
  let prepare: ((engine: Engine3dInstance) => void) | undefined;

  beforeEach(async () => {
    engines = []; callbacks = []; calls = []; disposals = []; fallbacks = []; picks = [];
    prepare = undefined;
    host = Object.assign(await fixture<HTMLDivElement>(html`<div style="width: 320px; height: 200px"><div style="width: 100%; height: 100%"></div></div>`), {
      requestUpdate() {},
    });
    surface = host.firstElementChild as HTMLDivElement;
    controller = new EmbeddingEngineController(host, () => {}, detail => fallbacks.push(detail), index => picks.push(index));
    embeddingEngineEnvironment.available = () => true;
    embeddingPointsLoader.override(async () => ({ createEngine() {
      const index = engines.length;
      calls.push([]); disposals.push(0);
      const engine: Engine3dInstance = {
        contract: 1,
        async mount(_container, value) { calls[index]!.push('mount'); callbacks[index] = value; },
        setStyle() { calls[index]!.push('setStyle'); },
        setData() { calls[index]!.push('setData'); },
        setCamera() {},
        resize() { calls[index]!.push('resize'); },
        fit() { calls[index]!.push('fit'); },
        setState() { calls[index]!.push('setState'); },
        dispose() { disposals[index] = disposals[index]! + 1; },
      };
      engines.push(engine);
      if (index === 0) prepare?.(engine);
      return engine;
    } }));
  });

  afterEach(() => {
    controller.disconnect(); host.remove();
    embeddingEngineEnvironment.available = available;
    embeddingPointsLoader.override(undefined);
  });

  function start(data = rows): void { controller.update('webgl', data, false, surface, -1, -1); }
  async function settled(): Promise<void> {
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }
  async function replacementReady(): Promise<void> {
    await waitUntil(() => engines.length === 2 && controller.ready, 'the replacement renderer becomes ready');
    callbacks[1]!.pick(0, { shift: false, ctrl: false, double: false });
    expect(picks).to.deep.equal([0]);
    expect(disposals).to.deep.equal([1, 0]);
    expect(controller.loading).to.equal(false);
    expect(controller.notice).to.equal(null);
  }

  for (const stage of ['setStyle', 'setData', 'resize', 'fit'] as const) {
    it(`stops startup when ${stage} disconnects the renderer and supports a fresh connection`, async () => {
      prepare = engine => {
        engine[stage] = () => { calls[0]!.push(stage); controller.disconnect(); };
      };
      start();
      await waitUntil(() => disposals[0] === 1);
      await settled();
      const order = ['mount', 'setStyle', 'setData', 'resize', 'fit'];
      expect(calls[0]).to.deep.equal(order.slice(0, order.indexOf(stage) + 1));
      expect(controller.ready).to.equal(false);
      expect(controller.loading).to.equal(false);
      callbacks[0]!.pick(0, { shift: false, ctrl: false, double: false });
      expect(picks).to.deep.equal([]);
      expect(fallbacks).to.deep.equal([]);
      start(replacementRows);
      await replacementReady();
    });
  }

  for (const outcome of ['resolve', 'reject'] as const) {
    it(`disposes a retired renderer once when its pending mount later ${outcome}s`, async () => {
      let finish: (() => void) | undefined;
      prepare = engine => {
        engine.mount = (_container, value) => {
          callbacks[0] = value;
          return new Promise<void>((resolve, reject) => {
            finish = () => outcome === 'resolve' ? resolve() : reject(new Error('Retired mount failed'));
          });
        };
      };
      start();
      await waitUntil(() => finish !== undefined);
      controller.disconnect();
      start(replacementRows);
      await replacementReady();
      finish!();
      await settled();
      expect(disposals).to.deep.equal([1, 0]);
      expect(controller.ready).to.equal(true);
      expect(fallbacks).to.deep.equal([]);
      expect(calls[0]).to.deep.equal([]);
    });
  }

  it('contains a throwing disposer and permits a replacement renderer', async () => {
    start();
    await waitUntil(() => controller.ready);
    engines[0]!.dispose = () => { disposals[0] = disposals[0]! + 1; throw new Error('Peer disposal failed'); };
    expect(() => controller.disconnect()).not.to.throw();
    expect(controller.ready).to.equal(false);
    start(replacementRows);
    await replacementReady();
    expect(fallbacks).to.deep.equal([]);
  });

  for (const trigger of ['disconnect', 'inputs', 'failure'] as const) {
    it(`preserves a renderer started by disposal during ${trigger}`, async () => {
      start();
      await waitUntil(() => controller.ready);
      engines[0]!.dispose = () => { disposals[0] = disposals[0]! + 1; start(replacementRows); };
      if (trigger === 'disconnect') controller.disconnect();
      else if (trigger === 'inputs') controller.update('builtin', rows, false, surface, -1, -1);
      else callbacks[0]!.lost('error');
      await replacementReady();
      expect(controller.selection.renderer).to.equal('webgl');
      expect(fallbacks).to.deep.equal([]);
    });
  }

  for (const trigger of ['update', 'resize', 'style', 'hover', 'restore'] as const) {
    it(`ignores a retired peer's exception during ${trigger} and keeps its replacement usable`, async () => {
      start();
      await waitUntil(() => controller.ready);
      // Let the initial native resize settle before replacing the peer operation under test.
      await settled();
      let retired = false;
      const retire = () => {
        retired = true;
        start(replacementRows);
        throw new Error('Retired peer callback failed');
      };
      if (trigger === 'hover' || trigger === 'restore') engines[0]!.setState = retire;
      else engines[0]!.setStyle = retire;
      if (trigger === 'update') start();
      else if (trigger === 'resize') surface.style.width = '240px';
      else if (trigger === 'style') host.style.color = 'rgb(1, 2, 3)';
      else if (trigger === 'hover') callbacks[0]!.hover(0);
      else { callbacks[0]!.lost('context-lost'); callbacks[0]!.restored!(); }
      await waitUntil(() => retired);
      await replacementReady();
      expect(fallbacks.map(detail => detail.reason)).to.deep.equal(trigger === 'restore' ? ['context-lost'] : []);
    });
  }
});
