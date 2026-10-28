import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { getWorkerUrl, setWorkerUrl } from '@aceshooting/lyra-map';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { createMapCameraSessionController } from '../../../internal/map-camera-session-controller.js';
import { createSimulationClock, type ClockScheduler } from '../../../simulation-clock.js';
import { LyraMap, LYRA_MAP_EMPTY_STYLE } from './map.js';
void LyraMap;

interface NativeCamera {
  getCanvas(): HTMLCanvasElement;
  getCenter(): { lng: number; lat: number };
  getZoom(): number;
  isMoving(): boolean;
}
const view = (zoom = 2) => ({ center: [0, 0] as const, zoom, bearing: 0, pitch: 0 });
const tour = { keyframes: [{ instant: 0, view: view(2) }, { instant: 100, view: view(4) }] };
const releases: (() => void)[] = [];
function clock() {
  let next = 0;
  const jobs = new Map<number, () => void>();
  const scheduler: ClockScheduler = {
    monotonicNow: () => 0, epochNow: () => 0,
    requestFrame(callback) { const id = ++next; jobs.set(id, callback); return id; },
    cancelFrame(handle) { jobs.delete(handle as number); },
  };
  const value = createSimulationClock({ range: [0, 100], instant: 0 }, { scheduler });
  releases.push(() => value.dispose()); return value;
}
function camera(element: LyraMap): NativeCamera {
  const map = element.map;
  if (!map || typeof map.getCanvas !== 'function' || typeof map.getCenter !== 'function' || typeof map.getZoom !== 'function') {
    throw new Error('Native camera capability unavailable');
  }
  const moving: unknown = Reflect.get(map, 'isMoving');
  if (typeof moving !== 'function') throw new Error('Native movement capability unavailable');
  return {
    getCanvas: () => map.getCanvas(), getCenter: () => map.getCenter(), getZoom: () => map.getZoom(),
    isMoving() {
      const value: unknown = moving.call(map);
      if (typeof value !== 'boolean') throw new Error('Native movement state must be boolean');
      return value;
    },
  };
}
function position(map: NativeCamera): readonly [number, number] { const center = map.getCenter(); return [center.lng, center.lat]; }
function changed(first: readonly number[], second: readonly number[]): boolean {
  return Math.abs(first[0]! - second[0]!) > 1e-5 || Math.abs(first[1]! - second[1]!) > 1e-5;
}
async function mount(engine: 'modular' | 'maplibre', reduced = false) {
  const wrapper = await fixture<HTMLDivElement>(html`<div data-lr-motion=${reduced ? 'reduce' : 'system'}>
    <lr-map .engine=${engine} initialization="eager" style="inline-size:480px;block-size:360px"
      .mapStyle=${LYRA_MAP_EMPTY_STYLE} .controls=${{ navigation: true, attribution: false }} .zoom=${2}></lr-map>
  </div>`);
  const element = wrapper.querySelector('lr-map') as LyraMap;
  await element.whenStyleReady(); await element.whenControlsReady(); await element.whenIdle();
  const controller = createMapCameraSessionController(element); releases.push(() => controller.dispose());
  return { wrapper, element, map: camera(element), controller };
}
function zoomIn(element: LyraMap): HTMLButtonElement {
  const target = element.shadowRoot!.querySelector<HTMLButtonElement>('[part~="zoom-in"]');
  if (!target) throw new Error('Missing native navigation button');
  return target;
}

describe('camera sessions with native map engines', function () {
  this.timeout(45000);
  let workerUrl: string;
  before(function () { if (!document.createElement('canvas').getContext('webgl2')) this.skip(); });
  beforeEach(() => { workerUrl = getWorkerUrl(); setWorkerUrl(new URL('/__lyra-map-worker__/worker.mjs', location.origin).href); });
  afterEach(async () => {
    await resetMouse();
    for (const release of releases.splice(0).reverse()) release();
    fixtureCleanup(); setWorkerUrl(workerUrl);
  });

  for (const engine of ['modular', 'maplibre'] as const) {
    it(`completes a real ${engine} ease after its single reflected command event`, async () => {
      const { element, map, controller } = await mount(engine);
      const commands: { zoom: number; active: boolean }[] = [];
      element.addEventListener('lr-map-view-change', event => {
        const detail = (event as CustomEvent<{ source: string; zoom: number }>).detail;
        if (detail.source === 'command') commands.push({ zoom: detail.zoom, active: controller.snapshot.active });
      });
      controller.restore(view(3), { kind: 'ease', duration: 300 });
      expect(controller.snapshot.active).to.equal(true);
      await waitUntil(() => controller.snapshot.reason === 'complete', 'Owned native ease completed', { timeout: 10000 });
      expect(commands.length).to.equal(1); expect(commands[0]!.zoom).to.be.closeTo(3, 1e-6);
      expect(commands[0]!.active, 'Reflect event precedes session completion').to.equal(true);
      expect(element.zoom).to.be.closeTo(3, 1e-6); expect(map.getZoom()).to.be.closeTo(3, 1e-6);
      expect(controller.snapshot).to.include({ mode: 'viewpoint', active: false });
    });

    it(`preserves a reentrant ${engine} restore from the stopped ordinary animation event`, async () => {
      const { element, map, controller: unused } = await mount(engine);
      unused.dispose();
      expect(element.easeTo({ center: [5, 5], zoom: 5, bearing: 20, duration: 5000 })).to.equal(true);
      await waitUntil(() => map.isMoving(), 'Ordinary native animation started before acquisition');
      const controller = createMapCameraSessionController(element); releases.push(() => controller.dispose());
      const target = { center: [-12, 7] as const, zoom: 6, bearing: 30, pitch: 10 };
      const events: { center: readonly number[]; zoom: number; source: string }[] = [];
      const completions: number[] = []; let replaced = false;
      controller.subscribe(snapshot => { if (snapshot.reason === 'complete') completions.push(map.getZoom()); });
      element.addEventListener('lr-map-view-change', event => {
        const detail = (event as CustomEvent<{ center: readonly number[]; zoom: number; source: string }>).detail;
        events.push({ center: [...detail.center], zoom: detail.zoom, source: detail.source });
        if (!replaced && detail.source === 'command') {
          replaced = true;
          controller.restore(target);
        }
      });
      controller.restore(view(3));
      await waitUntil(() => replaced && controller.snapshot.reason === 'complete', 'Newest reentrant restore completed');
      await element.updateComplete;
      expect(events.length).to.be.greaterThan(1);
      expect(events[0]!.source).to.equal('command');
      expect(events[0]!.zoom, 'Stopped ordinary camera was recorded before replacement').not.to.equal(target.zoom);
      expect(position(map)[0]).to.be.closeTo(target.center[0], 1e-6);
      expect(position(map)[1]).to.be.closeTo(target.center[1], 1e-6);
      expect(map.getZoom()).to.be.closeTo(target.zoom, 1e-6);
      expect(element.center[0]).to.be.closeTo(target.center[0], 1e-6);
      expect(element.center[1]).to.be.closeTo(target.center[1], 1e-6);
      expect(element.zoom).to.be.closeTo(target.zoom, 1e-6);
      expect(completions).to.deep.equal([target.zoom]);
      const captured = controller.capture();
      expect(captured.center[0]).to.be.closeTo(target.center[0], 1e-6);
      expect(captured.center[1]).to.be.closeTo(target.center[1], 1e-6);
      expect(captured.zoom).to.be.closeTo(target.zoom, 1e-6);
      expect(captured.bearing).to.be.closeTo(target.bearing, 1e-6);
      expect(captured.pitch).to.be.closeTo(target.pitch, 1e-6);
    });

    it(`honors a reentrant stop from the stopped ordinary ${engine} animation event`, async () => {
      const { element, map, controller: unused } = await mount(engine);
      unused.dispose();
      expect(element.easeTo({ center: [5, 5], zoom: 5, bearing: 20, duration: 5000 })).to.equal(true);
      await waitUntil(() => map.isMoving(), 'Ordinary native animation started before acquisition');
      const controller = createMapCameraSessionController(element); releases.push(() => controller.dispose());
      let stopped: { center: readonly number[]; zoom: number } | undefined;
      let completions = 0;
      controller.subscribe(snapshot => { if (snapshot.reason === 'complete') completions++; });
      element.addEventListener('lr-map-view-change', event => {
        const detail = (event as CustomEvent<{ center: readonly number[]; zoom: number; source: string }>).detail;
        if (!stopped && detail.source === 'command') {
          stopped = { center: [...detail.center], zoom: detail.zoom };
          controller.stop();
        }
      });
      controller.restore({ center: [-12, 7], zoom: 6, bearing: 30, pitch: 10 });
      await waitUntil(() => stopped !== undefined && controller.snapshot.reason === 'stop', 'Reentrant stop retained ownership');
      await element.updateComplete;
      expect(controller.snapshot).to.include({ mode: 'idle', active: false, reason: 'stop' });
      expect(completions).to.equal(0);
      expect(position(map)[0]).to.be.closeTo(stopped!.center[0]!, 1e-6);
      expect(position(map)[1]).to.be.closeTo(stopped!.center[1]!, 1e-6);
      expect(map.getZoom()).to.be.closeTo(stopped!.zoom, 1e-6);
      expect(element.center[0]).to.be.closeTo(stopped!.center[0]!, 1e-6);
      expect(element.center[1]).to.be.closeTo(stopped!.center[1]!, 1e-6);
      expect(element.zoom).to.be.closeTo(stopped!.zoom, 1e-6);
      expect(map.isMoving()).to.equal(false);
    });

    it(`uses deliberate reduced-motion jumps and lower-keyframe holds on ${engine}`, async () => {
      const { element, map, controller } = await mount(engine, true);
      let commands = 0;
      element.addEventListener('lr-map-view-change', event => { if ((event as CustomEvent).detail.source === 'command') commands++; });
      controller.restore(view(3), { kind: 'fly', duration: 2000 });
      expect(controller.snapshot.reason).to.equal('complete'); expect(map.isMoving()).to.equal(false);
      const time = clock(); controller.tour(time, tour); const attached = commands;
      time.seek(50); await element.updateComplete;
      expect(commands).to.equal(attached); expect(map.getZoom()).to.be.closeTo(2, 1e-6);
      time.seek(100); await element.updateComplete;
      expect(commands).to.equal(attached + 1); expect(map.getZoom()).to.be.closeTo(4, 1e-6);
      expect(controller.snapshot).to.include({ mode: 'tour', active: true });
    });

    it(`allows a genuine keyboard navigation gesture to finish after interrupting ${engine} tour ownership`, async () => {
      const { element, map, controller } = await mount(engine);
      const target = zoomIn(element); await focusByKeyboard(target);
      const time = clock(); controller.tour(time, tour);
      const initial = map.getZoom(); let movingAtInterruption = false;
      controller.subscribe(snapshot => { if (snapshot.reason === 'user') movingAtInterruption = map.isMoving(); });
      await sendKeys({ press: 'Enter' });
      await waitUntil(() => controller.snapshot.reason === 'user', 'Native keyboard control interrupted tour');
      expect(controller.snapshot.active).to.equal(false);
      expect(movingAtInterruption, 'Incoming native movement remains active').to.equal(true);
      await waitUntil(() => !map.isMoving(), 'Native navigation animation finished', { timeout: 10000 });
      expect(map.getZoom()).to.be.closeTo(initial + 1, 1e-5);
      const settled = map.getZoom(); time.seek(100); await element.updateComplete;
      expect(map.getZoom()).to.be.closeTo(settled, 1e-6);
    });

    it(`preserves continued native dragging after ${engine} tour interruption`, async () => {
      const { element, map, controller } = await mount(engine);
      const time = clock(); controller.tour(time, tour);
      const canvas = map.getCanvas(), box = canvas.getBoundingClientRect();
      const x = Math.round(box.left + box.width / 2), y = Math.round(box.top + box.height / 2);
      const initial = position(map);
      await sendMouse({ type: 'move', position: [x, y] }); await sendMouse({ type: 'down' });
      try {
        await sendMouse({ type: 'move', position: [x + 35, y + 10] });
        await waitUntil(() => controller.snapshot.reason === 'user' && changed(initial, position(map)), 'Native drag interrupted and moved');
        const first = position(map);
        await sendMouse({ type: 'move', position: [x + 75, y + 25] });
        await waitUntil(() => changed(first, position(map)), 'Incoming drag continues after cancellation');
      } finally { await sendMouse({ type: 'up' }); }
      await waitUntil(() => !map.isMoving(), 'Drag and inertia finished', { timeout: 10000 });
      const settled = position(map); time.seek(100); await element.updateComplete;
      expect(position(map)).to.deep.equal(settled); expect(controller.snapshot.active).to.equal(false);
    });

    it(`retains ${engine} tour ownership for equal controlled mirrors and cancels for an external jump`, async () => {
      const { element, map, controller } = await mount(engine);
      const time = clock(); controller.tour(time, tour); time.seek(25); await element.updateComplete;
      element.center = [...position(map)]; element.zoom = map.getZoom(); await element.updateComplete;
      expect(controller.snapshot).to.include({ mode: 'tour', active: true });
      time.seek(50); await element.updateComplete; expect(map.getZoom()).to.be.closeTo(3, 1e-6);
      expect(element.jumpTo({ center: [12, 8], zoom: 5 })).to.equal(true);
      expect(controller.snapshot).to.include({ active: false, reason: 'external' });
      const settled = controller.capture(); time.seek(100); await element.updateComplete;
      expect(controller.capture()).to.deep.equal(settled);
    });

    it(`prevents ${engine} clock writes after stop and committed style replacement`, async () => {
      const { element, controller } = await mount(engine);
      const time = clock(); controller.tour(time, tour); time.seek(25); controller.stop();
      const stopped = controller.capture(); time.seek(80); await element.updateComplete;
      expect(controller.capture()).to.deep.equal(stopped);
      controller.tour(time, tour);
      element.mapStyle = { ...LYRA_MAP_EMPTY_STYLE, layers: [] };
      expect(controller.snapshot).to.include({ active: false, reason: 'style' });
      await element.updateComplete; await element.whenStyleReady();
      const replacement = controller.capture(); time.seek(0); await element.updateComplete;
      expect(controller.capture()).to.deep.equal(replacement); expect(controller.snapshot.active).to.equal(false);
    });

    it(`permanently disposes the ${engine} session on disconnect without ghost reconnect tracking`, async () => {
      const { wrapper, element, controller } = await mount(engine);
      const time = clock(); controller.tour(time, tour); element.remove();
      expect(controller.snapshot).to.include({ active: false, reason: 'disconnect' });
      let disposed = false; try { controller.capture(); } catch (error) { disposed = (error as { code?: string }).code === 'disposed'; }
      expect(disposed).to.equal(true); time.seek(100);
      wrapper.append(element); await element.updateComplete; await element.whenStyleReady();
      const reconnected = camera(element).getZoom(); time.seek(0); await element.updateComplete;
      expect(camera(element).getZoom()).to.be.closeTo(reconnected, 1e-6);
      const fresh = createMapCameraSessionController(element); releases.push(() => fresh.dispose());
      fresh.restore(view(3)); expect(fresh.snapshot.reason).to.equal('complete');
    });
  }
});
