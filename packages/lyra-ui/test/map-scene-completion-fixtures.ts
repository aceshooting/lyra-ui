import { fixture, html } from '@open-wc/testing';
import { createMapSceneOwner } from '../src/components/media/map/map-scene-owner.js';
import { createMapSceneCompletionHost, createMapSceneCompletionAdapter } from '../src/components/media/map/map-scene-completion-adapter.js';
import { createMapSceneSessionFacade } from '../src/internal/map-scene-session.js';
import { createMapCameraFollowScene } from '../src/internal/map-camera-follow-scene.js';
import { prepareMapCameraFollow, startMapCameraFollow } from '../src/internal/map-camera-follow-controller.js';
import type { MapCameraFollowOwner } from '../src/internal/map-camera-follow-controller.js';
import type { SceneCompletedFrame, SceneTargetFact, SceneTargetProjection } from '../src/internal/map-scene-contract.js';
import type { SceneRenderPublication } from '../src/components/media/map/map-scene-render-contract.js';
import { sceneMarker } from './map-scene-admission-fixtures.js';
import { scenePresentation, sceneViewport } from './map-scene-render-fixtures.js';

export type SerialOwner = ReturnType<typeof createMapSceneOwner> & {
  claimPaintFrameSerial(expected: SceneRenderPublication): number | undefined;
};
export const completionCameraFacts = () => ({ latitude: 0, zoom: 8, pitch: 0, explicitBounds: false,
  explicitZoomLimits: false, nativeBounds: false, nativeMinZoom: -2, nativeMaxZoom: 22,
  terrain: false, canPan: true, canObserveMotion: true, canStop: true, moving: false, hasProjection: true });

export async function completionUiFixture() {
  const element = await fixture<HTMLElement>(html`<div></div>`), connection = Object.freeze({});
  let live = true;
  const owner = createMapSceneOwner({ element, connection, isCurrentConnection: () => live, changed() {} }) as SerialOwner;
  const facade = createMapSceneSessionFacade({ connection }); facade.bindState(owner.state);
  owner.setViewport({ ...sceneViewport(), padding: { top: 0, right: 0, bottom: 0, left: 0 } });
  owner.assign({ objects: [sceneMarker()] });
  owner.commitPresentation(owner.captureRenderPublication(), scenePresentation(owner.captureAccepted()));
  const host = createMapSceneCompletionHost({ owner, isCurrent: () => live, captureCameraFacts: () => completionCameraFacts() });
  const listeners = new Set<(frame: SceneCompletedFrame) => void>();
  const receipts = new WeakMap<SceneCompletedFrame, { readonly input: ReturnType<typeof host.captureInput>; readonly tokens: Map<string, object> }>();
  const history: ((frame: SceneCompletedFrame) => void)[] = [], watched: string[] = [], retired: string[] = [];
  const hooks: { subscribe?: () => void; watch?: () => void; current?: () => void; project?: () => void } = {};
  let subscriptions = 0, releases = 0, requests = 0;
  let projection: SceneTargetProjection | undefined;
  // This port authenticates synthetic immutable records for adapter ownership tests only.
  const port = {
    watchTarget(id: string) { watched.push(id); hooks.watch?.(); let active = true;
      return () => { if (active) { active = false; retired.push(id); } }; },
    subscribeCompletedFrames(listener: (frame: SceneCompletedFrame) => void) {
      listeners.add(listener); history.push(listener); subscriptions++; hooks.subscribe?.(); let active = true;
      return () => { if (active) { active = false; listeners.delete(listener); releases++; } };
    },
    current(frame: SceneCompletedFrame, id: string, target: object) {
      hooks.current?.(); const receipt = receipts.get(frame);
      return live && receipt !== undefined && receipt.tokens.get(id) === target;
    },
    projectTarget(frame: SceneCompletedFrame, id: string): SceneTargetProjection | undefined {
      hooks.project?.(); if (!receipts.get(frame)?.tokens.has(id)) return undefined;
      const target = owner.state.capture().targets.find(row => row.id === id);
      if (!target || (target.kind !== 'marker' && target.kind !== 'model')) return undefined;
      return projection ?? Object.freeze({ acceptedPositionRevision: target.acceptedPositionRevision,
        status: 'resolved', point: Object.freeze([350, 240] as const), visible: true });
    },
    requestFrame() { requests++; }
  };
  const createAdapter = () => createMapSceneCompletionAdapter({ connection, state: owner.state, owner, host, port });
  let adapter = createAdapter();
  const item = { element, connection, owner, facade, host, port, hooks, history, watched, retired,
    get adapter() { return adapter; }, get subscriptions() { return subscriptions; }, get releases() { return releases; }, get requests() { return requests; },
    promote() { return facade.promote(adapter.backing); },
    replaceAdapter() { adapter.dispose(); adapter = createAdapter(); return adapter; },
    resolve() { owner.commitPresentation(owner.captureRenderPublication(), scenePresentation(owner.captureAccepted())); },
    target(id = 'target'): SceneTargetFact { const lookup = facade.attachment.target(id); if (lookup.status !== 'accepted') throw new Error('Expected target'); return lookup.target; },
    frame(serial?: number, changes: Partial<SceneCompletedFrame> = {}): SceneCompletedFrame {
      const input = host.captureInput(), viewport = owner.state.capture().viewport;
      if (!viewport) throw new Error('Expected allocation');
      const value = serial ?? host.claimPaintSerial(input); if (value === undefined) throw new Error('Expected serial');
      const frame = Object.freeze({ width: viewport.width, height: viewport.height, pixelRatio: viewport.pixelRatio,
        padding: viewport.padding, projectionTransition: 0,
        cameraProfile: Object.freeze({ ...completionCameraFacts(), width: viewport.width, height: viewport.height,
          padding: viewport.padding, nativeControlTransition: 0 }), ...changes,
        stamp: Object.freeze({ ownerToken: connection, contextEpoch: 1, styleRevision: 1, samplingViewRevision: 1,
          layoutRevision: 1, allocationRevision: viewport.allocationRevision, acceptedSceneRevision: input.acceptedSceneRevision,
          installedSceneRevision: input.acceptedSceneRevision, placementRevision: 1, paintRevision: 1, paintFrameSerial: value }) });
      receipts.set(frame, { input, tokens: new Map(input.members.filter(row => row.target).map(row => [row.id, row.target!.token])) });
      return frame;
    },
    emit(frame: SceneCompletedFrame) { for (const listener of [...listeners]) listener(frame); },
    setProjection(value: SceneTargetProjection | undefined) { projection = value; },
    expire() { live = false; },
    close() { facade.close(); adapter.dispose(); owner.close(); }
  };
  return item;
}

export function completionFollow(h: Awaited<ReturnType<typeof completionUiFixture>>, mode: 'ground' | 'geographic-visual' = 'geographic-visual') {
  const scene = createMapCameraFollowScene(h.facade.attachment), ground: object[] = [], pans: object[] = [];
  const hooks: { prepare?: () => void } = {};
  const owner: MapCameraFollowOwner = { current: () => true,
    prepareGround: () => Object.freeze({}), commitGround(value) { ground.push(value); return true; },
    preparePan() { hooks.prepare?.(); return Object.freeze({}); }, commitPan(value) { pans.push(value); return true; }, publish() {} };
  const plan = prepareMapCameraFollow({ objectId: 'target', mode }, { current: () => true,
    capture: () => ({ center: [1, 2], zoom: 8, bearing: 0, pitch: 0 }), reducedMotion: () => false, scene });
  const runner = startMapCameraFollow(plan, owner);
  return { scene, runner, ground, pans, hooks };
}
