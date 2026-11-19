import { expect, fixture, nextFrame, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { Engine3dFallbackDetail } from '../../../internal/engine-3d.js';
import type { Engine3dHost } from '../../../internal/engine-3d-loader.js';
import type { GraphComponentEngine } from './graph-engine-adapter.js';
import type { LyraGraphCamera } from './graph-model.js';
import { GraphSpatialController } from './graph-spatial-controller.js';
import { LyraGraph } from './graph.js';
void LyraGraph;

type EngineFault = 'position' | 'fit' | 'camera';
interface EngineProbe {
  callbacks?: Engine3dHost;
  fault?: EngineFault;
  faultCalls: number;
  disposed: number;
  dataCalls: number;
  cameras: unknown[];
  fits: (number | undefined)[];
}

const diagnostic = 'Companion operation refused';
const camera = (): LyraGraphCamera => ({ yaw: 0, pitch: 0, distance: 500, target: { x: 0, y: 0, z: 0 } });

function setup(available = () => true) {
  const engines: EngineProbe[] = [];
  const fallbacks: Engine3dFallbackDetail[] = [];
  const activations: string[] = [];
  const create = async (): Promise<GraphComponentEngine> => {
    const probe: EngineProbe = { faultCalls: 0, disposed: 0, dataCalls: 0, cameras: [], fits: [] };
    engines.push(probe);
    let canvas: HTMLCanvasElement | undefined;
    const fail = (method: EngineFault): void => {
      if (probe.fault !== method) return;
      probe.faultCalls++;
      throw new Error(diagnostic);
    };
    return {
      contract: 1,
      async mount(container, callbacks) {
        probe.callbacks = callbacks;
        canvas = container.ownerDocument.createElement('canvas');
        container.append(canvas);
      },
      setData() { probe.dataCalls++; },
      setStyle() {},
      setAppearance() {},
      resize() {},
      setCamera(value) { probe.cameras.push(value); fail('camera'); },
      fit(padding) { probe.fits.push(padding); fail('fit'); return { ...camera(), distance: 900 }; },
      positionOf(row) {
        fail('position');
        return row === 0 ? { x: -30, y: 0, z: 0 } : row === 1 ? { x: 30, y: 0, z: 0 } : null;
      },
      dispose() { probe.disposed++; canvas?.remove(); },
    };
  };
  class InjectedSpatial extends GraphSpatialController {
    constructor(...args: ConstructorParameters<typeof GraphSpatialController>) {
      super(args[0], { ...args[1], engineServices: { available, create } });
    }
  }
  const graph = document.createElement('lr-graph') as LyraGraph;
  graph.style.cssText = 'display:block;inline-size:360px;block-size:280px';
  graph.width = 360;
  graph.height = 280;
  graph.view = '3d';
  graph.engine = 'webgl';
  graph.camera = camera();
  graph.nodes = [
    { id: 'a', label: 'Alpha', position: { x: -30, y: 0, z: 0 } },
    { id: 'b', label: 'Beta', position: { x: 30, y: 0, z: 0 } },
  ];
  graph.strings = { engine3dError: 'Renderer stopped', engine3dShowingBuiltin: 'Standard view available' };
  (graph as unknown as { loadSpatialController(): Promise<{ GraphSpatialController: typeof GraphSpatialController }> })
    .loadSpatialController = async () => ({ GraphSpatialController: InjectedSpatial });
  graph.addEventListener('lr-engine-fallback', event => fallbacks.push(event.detail));
  graph.addEventListener('lr-node-activate', event => activations.push(event.detail.nodeId));
  const clearFaults = (): void => { for (const engine of engines) engine.fault = undefined; };
  return { graph, engines, fallbacks, activations, clearFaults,
    cleanup() { clearFaults(); graph.remove(); } };
}

type Subject = ReturnType<typeof setup>;

async function mount(subject: Subject): Promise<EngineProbe> {
  await fixture(subject.graph);
  await waitUntil(() => subject.engines.length === 1 && subject.engines[0]!.dataCalls > 0 &&
    subject.engines[0]!.cameras.length > 0 && subject.engines[0]!.callbacks !== undefined,
  'the companion mounts and receives data and camera before a failure is armed', { timeout: 3000 });
  await subject.graph.updateComplete;
  await nextFrame();
  await nextFrame();
  expect(subject.fallbacks.length).to.equal(0);
  expect(subject.engines[0]!.disposed).to.equal(0);
  return subject.engines[0]!;
}

async function expectFallbackAndRecovery(subject: Subject, failed: EngineProbe): Promise<void> {
  const { graph } = subject;
  expect(failed.faultCalls, 'the failing companion operation was reached').to.be.greaterThan(0);
  await waitUntil(() => failed.disposed === 1 && subject.fallbacks.length === 1,
    'the failed companion is released and its fallback is reported', { timeout: 3000 });
  await graph.updateComplete;
  await nextFrame();
  expect(subject.fallbacks).to.deep.equal([{ from: 'webgl', to: 'builtin', reason: 'error' }]);
  const notice = graph.shadowRoot!.querySelector('[part="engine-notice"]')?.textContent ?? '';
  expect(notice).to.include('Renderer stopped');
  expect(notice).to.include('Standard view available');
  expect(graph.shadowRoot!.textContent).not.to.include(diagnostic);
  expect(graph.shadowRoot!.querySelectorAll('canvas[part="spatial-canvas"]').length).to.equal(1);
  expect(graph.getNodePosition3d('a')).to.deep.equal({ x: -30, y: 0, z: 0 });
  expect(await graph.focusNode('a')).to.equal(true);

  failed.callbacks!.pick(0, { ctrl: false, shift: false, double: false });
  expect(subject.activations).to.deep.equal([]);
  graph.view = 'list';
  await graph.updateComplete;
  const item = graph.shadowRoot!.querySelector<HTMLButtonElement>('[part="spatial-list-item"][data-node-id="a"]');
  expect(item !== null).to.equal(true);
  await focusByKeyboard(item!);
  await sendKeys({ press: 'Enter' });
  expect(subject.activations).to.deep.equal(['a']);

  subject.clearFaults();
  graph.engine = 'builtin';
  graph.view = '3d';
  await graph.updateComplete;
  graph.engine = 'webgl';
  await graph.updateComplete;
  await waitUntil(() => subject.engines.length === 2 && subject.engines[1]!.dataCalls > 0 &&
    subject.engines[1]!.cameras.length > 0, 'a fresh companion resumes the same scene', { timeout: 3000 });
  expect(failed.disposed).to.equal(1);
  expect(subject.engines[1]!.disposed).to.equal(0);
  graph.fit({ padding: 23 });
  expect(subject.engines[1]!.fits.at(-1)).to.equal(23);
  await graph.updateComplete;
  await nextFrame();
  expect(subject.fallbacks.length).to.equal(1);
  expect(graph.shadowRoot!.querySelectorAll('[part="engine-notice"]').length).to.equal(0);
}

describe('graph companion failure recovery after a successful mount', () => {
  it('releases a failed companion even when preserving its positions also throws', async () => {
    const subject = setup();
    try {
      const engine = await mount(subject);
      engine.fault = 'position';
      expect(() => engine.callbacks!.lost('error')).not.to.throw();
      await expectFallbackAndRecovery(subject, engine);
    } finally { subject.cleanup(); }
  });

  it('falls back when the companion refuses a public fit request and accepts a later fit', async () => {
    const subject = setup();
    try {
      const engine = await mount(subject);
      engine.fault = 'fit';
      expect(() => subject.graph.fit({ padding: 37 })).not.to.throw();
      expect(engine.fits.at(-1)).to.equal(37);
      await expectFallbackAndRecovery(subject, engine);
    } finally { subject.cleanup(); }
  });

  it('falls back when the companion refuses a new public camera property', async () => {
    const subject = setup();
    try {
      const engine = await mount(subject);
      engine.fault = 'camera';
      subject.graph.camera = { ...camera(), distance: 750 };
      await subject.graph.updateComplete;
      await expectFallbackAndRecovery(subject, engine);
    } finally { subject.cleanup(); }
  });

  it('keeps native camera controls usable after a companion camera failure', async () => {
    const subject = setup();
    try {
      const engine = await mount(subject);
      const orbit = subject.graph.shadowRoot!.querySelector<HTMLButtonElement>('[data-spatial-action="right"]');
      expect(orbit !== null).to.equal(true);
      await focusByKeyboard(orbit!);
      engine.fault = 'camera';
      await sendKeys({ press: 'Enter' });
      await expectFallbackAndRecovery(subject, engine);
    } finally { subject.cleanup(); }
  });
});

for (const retire of [false, true]) {
  it(`contains a failed capability check when the graph is ${retire ? 'removed' : 'current'} and can reopen`, async () => {
    let attempted = false;
    const subject = setup(() => {
      if (attempted) return true;
      attempted = true;
      if (retire) subject.graph.remove();
      throw new Error(diagnostic);
    });
    try {
      await fixture(subject.graph);
      await waitUntil(() => attempted);
      if (retire) {
        await nextFrame();
        expect(subject.fallbacks).to.deep.equal([]);
        document.body.append(subject.graph);
      } else {
        await waitUntil(() => subject.fallbacks.length === 1);
        expect(subject.fallbacks[0]?.reason).to.equal('error');
        subject.graph.engine = 'builtin';
        await subject.graph.updateComplete;
        subject.graph.engine = 'webgl';
      }
      await waitUntil(() => (subject.engines[0]?.dataCalls ?? 0) > 0);
      expect(subject.engines[0]!.disposed).to.equal(0);
    } finally { subject.cleanup(); }
  });
}
