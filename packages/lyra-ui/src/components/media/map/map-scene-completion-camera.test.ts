import { expect } from '@open-wc/testing';
import { captureMapSceneCompletionCamera } from './map-scene-completion-camera.js';
import { completionUiFixture } from '../../../../test/map-scene-completion-fixtures.js';
import { sceneViewport } from '../../../../test/map-scene-render-fixtures.js';
import { createMapCameraFollowScene } from '../../../internal/map-camera-follow-scene.js';
import type { MapCameraFollowFrame } from '../../../internal/map-camera-follow-controller.js';

async function cameraFixture() {
  const h = await completionUiFixture(); let live = true;
  const calls = { commands: 0, observers: 0 }, hooks: { center?: () => void; zoom?: () => void } = {};
  const values = { latitude: 12, zoom: 8, pitch: 0, bounds: undefined as object | undefined, min: -2, max: 22,
    terrain: null as { source: string } | null, moving: false, projection: { type: 'mercator' } };
  const intent = { explicitBounds: false, explicitZoomLimits: false };
  const map = { getCenter() { hooks.center?.(); return { lng: 0, lat: values.latitude }; },
    getZoom() { hooks.zoom?.(); return values.zoom; }, getPitch: () => values.pitch,
    getMaxBounds: () => values.bounds, getMinZoom: () => values.min, getMaxZoom: () => values.max,
    getTerrain: () => values.terrain, isMoving: () => values.moving, getProjection: () => values.projection,
    panBy() { calls.commands++; }, stop() { calls.commands++; },
    on() { calls.observers++; }, off() { calls.observers++; } };
  let selected: typeof map | undefined = map;
  return { h, map, values, intent, calls, hooks,
    replaceMap() { selected = { ...map }; }, expire() { live = false; h.expire(); },
    capture(expected = h.owner.captureRenderPublication()) {
      return captureMapSceneCompletionCamera({ expected, capturePublication: () => h.owner.captureRenderPublication(),
        captureMap: () => selected, captureIntent: () => intent, isCurrent: () => live });
    }, close: () => h.close() };
}

describe('completed scene camera facts', () => {
  it('copies same issue public facts without acquiring a lease command or observer', async () => {
    const c = await cameraFixture();
    try {
      const facts = c.capture(); expect(facts).to.deep.equal({ latitude: 12, zoom: 8, pitch: 0,
        explicitBounds: false, explicitZoomLimits: false, nativeBounds: false, nativeMinZoom: -2, nativeMaxZoom: 22,
        terrain: false, canPan: true, canObserveMotion: true, canStop: true, moving: false, hasProjection: true });
      expect(Object.isFrozen(facts)).to.equal(true); c.values.latitude = 30; expect(facts?.latitude).to.equal(12);
      expect(c.calls).to.deep.equal({ commands: 0, observers: 0 });
    } finally { c.close(); }
  });

  it('getter reentry refuses newer publication and native map identities', async () => {
    const c = await cameraFixture();
    try {
      c.hooks.center = () => c.h.owner.invalidatePresentation(); expect(c.capture()).to.equal(undefined);
      c.hooks.center = undefined; c.h.resolve(); c.hooks.zoom = () => c.replaceMap();
      expect(c.capture()).to.equal(undefined); expect(c.calls.commands).to.equal(0);
    } finally { c.close(); }
  });

  it('missing throwing and nonfinite native facts never receive guessed defaults', async () => {
    const c = await cameraFixture();
    try {
      c.values.zoom = NaN; expect(c.capture()).to.equal(undefined); c.values.zoom = 8;
      c.hooks.center = () => { throw new Error('native getter unavailable'); }; expect(c.capture()).to.equal(undefined);
      c.hooks.center = undefined; const getter = c.map.getMinZoom;
      Reflect.deleteProperty(c.map, 'getMinZoom'); expect(c.capture()).to.equal(undefined); c.map.getMinZoom = getter;
      c.values.max = Infinity; expect(c.capture()).to.equal(undefined);
    } finally { c.close(); }
  });

  it('reports actual explicit constraints native bounds terrain motion and method capabilities', async () => {
    const c = await cameraFixture();
    try {
      c.intent.explicitBounds = true; c.intent.explicitZoomLimits = true; c.values.bounds = {};
      c.values.terrain = { source: 'dem' }; c.values.moving = true; c.values.min = 3; c.values.max = 14;
      Reflect.deleteProperty(c.map, 'panBy'); Reflect.deleteProperty(c.map, 'stop'); Reflect.deleteProperty(c.map, 'off');
      const facts = c.capture(); expect(facts).to.include({ explicitBounds: true, explicitZoomLimits: true,
        nativeBounds: true, nativeMinZoom: 3, nativeMaxZoom: 14, terrain: true, moving: true,
        canPan: false, canStop: false, canObserveMotion: false });
      expect(c.calls).to.deep.equal({ commands: 0, observers: 0 });
    } finally { c.close(); }
  });

  it('preserves raw camera transition when the same uploaded packet rounds to Float32 zero', async () => {
    const c = await cameraFixture();
    try {
      c.h.promote(); const frames: MapCameraFollowFrame[] = [], scene = createMapCameraFollowScene(c.h.facade.attachment);
      const release = scene.subscribeFrames('target', frame => frames.push(frame));
      const base = c.h.frame(), raw = 1e-50;
      const frame = c.h.frame(undefined, { projectionTransition: Math.fround(raw),
        cameraProfile: Object.freeze({ ...base.cameraProfile!, nativeControlTransition: raw }) });
      c.h.emit(frame); expect(frame.projectionTransition).to.equal(0);
      expect((frames[0]!.profile as { projectionTransition: number }).projectionTransition).to.equal(raw);
      expect(frame.cameraProfile!.nativeControlTransition).to.be.greaterThan(0); release();
    } finally { c.close(); }
  });

  it('missing or custom projection capability refuses camera facts without inspecting private transforms', async () => {
    const c = await cameraFixture(); let transformReads = 0;
    try {
      Object.defineProperty(c.map, 'transform', { get() { transformReads++; throw new Error('private transform read'); } });
      expect(c.capture()?.hasProjection).to.equal(true);
      c.values.projection = { type: 'custom' }; expect(c.capture()).to.equal(undefined);
      c.values.projection = { type: 'mercator' }; Reflect.deleteProperty(c.map, 'getProjection');
      expect(c.capture()).to.equal(undefined); expect(c.calls.commands).to.equal(0);
      expect(transformReads).to.equal(0);
    } finally { c.close(); }
  });

  it('keeps dimensions and padding on the exact frame allocation rather than later camera facts', async () => {
    const c = await cameraFixture();
    try {
      const facts = c.capture(); expect(Object.hasOwn(facts!, 'width')).to.equal(false);
      expect(Object.hasOwn(facts!, 'padding')).to.equal(false); c.h.promote();
      const frame = c.h.frame(); c.h.emit(frame); const oldPadding = frame.padding;
      c.h.owner.setViewport(sceneViewport(900, 700, 2));
      expect(frame.width).to.equal(640); expect(frame.height).to.equal(480); expect(frame.padding).to.equal(oldPadding);
      expect(c.h.facade.attachment.current(frame, c.h.target())).to.equal(false);
    } finally { c.close(); }
  });

  it('revoked camera lifetime cannot attach fresh facts to an older point receipt', async () => {
    const c = await cameraFixture();
    try {
      c.h.promote(); const frame = c.h.frame(), profile = frame.cameraProfile; c.h.emit(frame);
      c.values.zoom = 12; c.expire();
      expect(c.capture()).to.equal(undefined); expect(c.h.adapter.backing.current(frame, c.h.target())).to.equal(false);
      expect(c.h.adapter.backing.projectTarget(frame, 'target')).to.equal(undefined);
      expect(frame.cameraProfile).to.equal(profile); expect(frame.cameraProfile!.zoom).to.equal(8);
    } finally { c.close(); }
  });
});
