import { expect } from '@open-wc/testing';
import { completionCameraFacts, completionUiFixture } from '../../../../test/map-scene-completion-fixtures.js';
import { sceneMarker, scenePath } from '../../../../test/map-scene-admission-fixtures.js';
import { createMapSceneCompletionAdapter, createMapSceneCompletionHost } from './map-scene-completion-adapter.js';
import type { SceneCompletedFrame } from '../../../internal/map-scene-contract.js';

describe('map scene completion authority and failure recovery', () => {
  it('rejects mismatched connection, state, owner and unregistered host identities before acquiring resources', async () => {
    const h = await completionUiFixture(), other = await completionUiFixture();
    try {
      const options = { connection: h.connection, state: h.owner.state, owner: h.owner, host: h.host, port: h.port };
      for (const invalid of [
        { ...options, connection: other.connection },
        { ...options, state: other.owner.state },
        { ...options, owner: other.owner },
        { ...options, host: { ...h.host } },
      ]) {
        expect(() => createMapSceneCompletionAdapter(invalid)).to.throw(TypeError, 'Invalid map scene completion adapter');
      }
      expect(h.subscriptions).to.equal(0); expect(h.watched).to.deep.equal([]);
      expect(other.subscriptions).to.equal(0); expect(other.watched).to.deep.equal([]);
      const valid = createMapSceneCompletionAdapter(options);
      valid.backing.requestFrame(); expect(h.requests).to.equal(1); valid.dispose();
    } finally { h.close(); other.close(); }
  });

  it('contains failed current-connection checks and refuses a publication replaced during the check', async () => {
    const h = await completionUiFixture();
    let check: () => boolean = () => { throw new Error('Connection is unavailable'); };
    let cameraReads = 0;
    try {
      const host = createMapSceneCompletionHost({ owner: h.owner, isCurrent: () => check(),
        captureCameraFacts: () => { cameraReads++; return completionCameraFacts(); } });
      const input = host.captureInput();
      expect(host.claimPaintSerial(input)).to.equal(undefined);
      expect(host.captureCameraFacts(input)).to.equal(undefined);
      expect(cameraReads).to.equal(0);
      check = () => { h.owner.invalidatePresentation(); return true; };
      expect(host.claimPaintSerial(input)).to.equal(undefined);
      expect(host.captureInput().phase).to.equal('pending');
      check = () => true; h.resolve();
      const replacement = host.captureInput();
      expect(host.claimPaintSerial(replacement)).to.be.a('number');
      expect(host.captureCameraFacts(replacement)).to.deep.equal(completionCameraFacts());
      expect(cameraReads).to.equal(1);
    } finally { h.close(); }
  });

  it('discards camera facts after a failed read or a synchronous publication change and recovers', async () => {
    const h = await completionUiFixture();
    let read = (): ReturnType<typeof completionCameraFacts> => { throw new Error('Camera is unavailable'); };
    try {
      const host = createMapSceneCompletionHost({ owner: h.owner, isCurrent: () => true, captureCameraFacts: () => read() });
      const input = host.captureInput();
      expect(host.captureCameraFacts(input)).to.equal(undefined);
      let notifications = 0;
      const release = host.subscribeInput(() => notifications++);
      read = () => { h.owner.invalidatePresentation(); return completionCameraFacts(); };
      expect(host.captureCameraFacts(input)).to.equal(undefined);
      expect(notifications).to.equal(1);
      release(); h.resolve(); expect(notifications).to.equal(1);
      read = completionCameraFacts;
      expect(host.captureCameraFacts(host.captureInput())).to.deep.equal(completionCameraFacts());
      expect(host.captureCameraFacts(input)).to.equal(undefined);
    } finally { h.close(); }
  });

  it('contains renderer current and projection errors without losing the valid frame receipt', async () => {
    const h = await completionUiFixture();
    try {
      const frames: SceneCompletedFrame[] = [];
      h.adapter.backing.subscribeCompletedFrames(frame => frames.push(frame));
      const frame = h.frame(), target = h.target(); h.emit(frame);
      expect(frames.length).to.equal(1);
      h.hooks.current = () => { throw new Error('Renderer context is unavailable'); };
      expect(h.adapter.backing.current(frame, target)).to.equal(false);
      expect(h.adapter.backing.projectTarget(frame, target.id)).to.equal(undefined);
      h.hooks.current = undefined;
      h.hooks.project = () => { throw new Error('Projection is unavailable'); };
      expect(h.adapter.backing.projectTarget(frame, target.id)).to.equal(undefined);
      expect(h.adapter.backing.current(frame, target)).to.equal(true);
      h.hooks.project = undefined;
      expect(h.adapter.backing.projectTarget(frame, target.id)?.point).to.deep.equal([350, 240]);
      expect(h.adapter.backing.projectTarget(frame, 'missing')).to.equal(undefined);
    } finally { h.close(); }
  });

  it('releases independent watches and subscriptions when their teardown callbacks throw', async () => {
    const h = await completionUiFixture();
    const retired: string[] = [];
    let delivered = 0;
    const adapter = createMapSceneCompletionAdapter({ connection: h.connection, state: h.owner.state, owner: h.owner, host: h.host,
      port: { ...h.port,
        watchTarget(id) {
          const release = h.port.watchTarget(id);
          return () => { release(); retired.push(id); if (id === 'first') throw new Error('Watch teardown failed'); };
        },
        subscribeCompletedFrames(listener) {
          const release = h.port.subscribeCompletedFrames(listener);
          return () => { release(); retired.push('subscription'); throw new Error('Subscription teardown failed'); };
        },
      } });
    try {
      const releaseFirst = adapter.backing.watchTarget('first');
      adapter.backing.watchTarget('second');
      adapter.backing.subscribeCompletedFrames(() => delivered++);
      const frame = h.frame(); h.emit(frame); expect(delivered).to.equal(1);
      adapter.dispose(); adapter.dispose(); releaseFirst();
      expect(retired).to.deep.equal(['first', 'second', 'subscription']);
      expect(h.retired).to.deep.equal(['first', 'second']); expect(h.releases).to.equal(1);
      for (const callback of h.history) callback(frame);
      expect(delivered).to.equal(1);
    } finally { adapter.dispose(); h.close(); }
  });

  it('keeps disposed handles inert without subscribing, watching, requesting or delivering more frames', async () => {
    const h = await completionUiFixture();
    try {
      let delivered = 0;
      h.adapter.backing.subscribeCompletedFrames(() => delivered++);
      h.adapter.backing.watchTarget('target');
      const frame = h.frame(), target = h.target(); h.emit(frame);
      h.adapter.backing.requestFrame();
      h.adapter.dispose();
      const releaseWatch = h.adapter.backing.watchTarget('new');
      const releaseFrames = h.adapter.backing.subscribeCompletedFrames(() => delivered++);
      h.adapter.backing.requestFrame();
      for (const callback of h.history) callback(frame);
      releaseWatch(); releaseWatch(); releaseFrames(); releaseFrames();
      expect(delivered).to.equal(1); expect(h.requests).to.equal(1);
      expect(h.subscriptions).to.equal(1); expect(h.releases).to.equal(1);
      expect(h.watched).to.deep.equal(['target']); expect(h.retired).to.deep.equal(['target']);
      expect(h.adapter.backing.current(frame, target)).to.equal(false);
      expect(h.adapter.backing.projectTarget(frame, 'target')).to.equal(undefined);
    } finally { h.close(); }
  });

  it('cannot rebind a previously delivered frame to a newer publication even when its target identity survives', async () => {
    const h = await completionUiFixture();
    try {
      const frames: SceneCompletedFrame[] = [];
      h.adapter.backing.subscribeCompletedFrames(frame => frames.push(frame));
      const first = h.frame(), target = h.target(); h.emit(first);
      h.owner.assign({ objects: [{ ...sceneMarker(), label: 'New label' }] }); h.resolve();
      expect(h.target() === target).to.equal(true);
      h.emit(first);
      expect(frames.length).to.equal(1);
      expect(h.adapter.backing.current(first, target)).to.equal(false);
      const second = h.frame(); h.emit(second);
      expect(frames.length).to.equal(2); expect(frames[1] === second).to.equal(true);
      expect(h.adapter.backing.current(second, target)).to.equal(true);
    } finally { h.close(); }
  });

  it('does not project path geometry as a point target while retaining marker projections', async () => {
    const h = await completionUiFixture();
    try {
      h.owner.assign({ objects: [sceneMarker(), scenePath()] }); h.resolve();
      h.adapter.backing.subscribeCompletedFrames(() => {});
      const frame = h.frame(); h.emit(frame);
      const path = h.owner.state.capture().targets.find(target => target.kind === 'path');
      expect(path !== undefined).to.equal(true);
      expect(h.adapter.backing.projectTarget(frame, path!.id)).to.equal(undefined);
      expect(h.adapter.backing.projectTarget(frame, 'target')?.point).to.deep.equal([350, 240]);
    } finally { h.close(); }
  });
});
