import { expect } from '@open-wc/testing';
import { completionFollow, completionUiFixture } from '../../../../test/map-scene-completion-fixtures.js';
import { sceneArc, sceneMarker, sceneModel, scenePath } from '../../../../test/map-scene-admission-fixtures.js';
import { createMapCameraFollowScene } from '../../../internal/map-camera-follow-scene.js';
import type { MapCameraFollowFrame } from '../../../internal/map-camera-follow-controller.js';
import type { SceneCompletedFrame } from '../../../internal/map-scene-contract.js';

describe('completed scene backing adapter', () => {
  it('preserves the existing connection state and original completed frame identity', async () => {
    const h = await completionUiFixture(); const frames: SceneCompletedFrame[] = [];
    try {
      expect(h.adapter.backing.connection).to.equal(h.connection); expect(h.adapter.backing.state).to.equal(h.owner.state);
      const input = h.host.captureInput();
      expect(h.host.claimPaintSerial({ ...input })).to.equal(undefined);
      expect(h.host.captureCameraFacts({ ...input })).to.equal(undefined);
      expect(h.facade.promote({ ...h.adapter.backing, connection: {} })).to.equal(false);
      expect(h.facade.promote({ ...h.adapter.backing, state: { ...h.owner.state } })).to.equal(false);
      expect(h.promote()).to.equal(true); h.facade.attachment.watchTarget('target');
      h.facade.attachment.subscribeCompletedFrames(frame => frames.push(frame));
      const frame = h.frame(); h.emit(frame); expect(frames.length).to.equal(1); expect(frames[0]).to.equal(frame);
    } finally { h.close(); }
  });

  it('projects exhaustive accepted rows into safe metadata without retaining source graphs', async () => {
    const h = await completionUiFixture();
    try {
      h.owner.assign({ objects: [sceneMarker(), scenePath(), sceneArc(), sceneModel()] }); h.resolve();
      const publication = h.owner.captureRenderPublication(), input = h.host.captureInput();
      expect(input.members.map(row => row.kind)).to.deep.equal(['marker', 'path', 'arc', 'model']);
      expect(input.renderInput).to.equal(publication.input); expect(h.host.captureInput()).to.equal(input);
      const forbidden = new Set<object>([publication, publication.accepted, publication.state, ...publication.accepted.objects]);
      const model = publication.accepted.objects.find(row => row.kind === 'model');
      if (model?.kind === 'model') forbidden.add(model.source);
      const visit = (value: unknown): void => { if (!value || typeof value !== 'object' || value === input.renderInput) return;
        expect(forbidden.has(value)).to.equal(false); expect(Object.isFrozen(value)).to.equal(true);
        for (const child of Object.values(value)) visit(child); };
      visit(input); expect(Object.keys(input.members[3]!.rowToken)).to.deep.equal([]);
      expect(input.members[1]!.target).to.equal(undefined); expect(input.members[3]!.target?.position.altitude).to.equal(0);
    } finally { h.close(); }
  });

  it('reuses unchanged target identity through metadata while altered positions receive new tokens', async () => {
    const h = await completionUiFixture();
    try {
      const before = h.host.captureInput(), fact = h.target();
      h.owner.assign({ objects: [{ ...sceneMarker(), label: 'renamed' }] }); h.resolve();
      const metadata = h.host.captureInput(); expect(h.target()).to.equal(fact);
      expect(metadata.members[0]!.target!.token).to.equal(before.members[0]!.target!.token);
      expect(metadata.publicationToken).not.to.equal(before.publicationToken);
      h.owner.assign({ objects: [sceneMarker('target', 10)] }); h.resolve();
      const moved = h.host.captureInput(); expect(moved.members[0]!.target!.token).not.to.equal(before.members[0]!.target!.token);
      expect(moved.members[0]!.target!.acceptedPositionRevision).to.be.greaterThan(fact.acceptedPositionRevision);
    } finally { h.close(); }
  });

  it('reads pending publication before its own invalidation subscriber is notified', async () => {
    const h = await completionUiFixture();
    let observed: { phase: string; claim: number | undefined; camera: unknown; current: boolean; projection: unknown } | undefined;
    let callbackError: unknown;
    try {
      h.promote(); const frame = h.frame(); h.emit(frame); const fact = h.target();
      const release = h.owner.subscribeAccepted(() => {
        try {
          const input = h.host.captureInput();
          observed = { phase: input.phase, claim: h.host.claimPaintSerial(input), camera: h.host.captureCameraFacts(input),
            current: h.adapter.backing.current(frame, fact), projection: h.adapter.backing.projectTarget(frame, 'target') };
        } catch (error) { callbackError = error; }
      });
      h.owner.assign({ objects: [{ ...sceneMarker(), color: 'red' }] }); release();
      expect(callbackError).to.equal(undefined);
      expect(observed).to.deep.equal({ phase: 'pending', claim: undefined, camera: undefined, current: false, projection: undefined });
    } finally { h.close(); }
  });

  it('reconciles prepromotion watches once and never revives an already released watch', async () => {
    const h = await completionUiFixture();
    try {
      const keep = h.facade.attachment.watchTarget('target'), gone = h.facade.attachment.watchTarget('gone'); gone();
      expect(h.watched).to.deep.equal([]); h.promote(); expect(h.watched).to.deep.equal(['target']);
      keep(); keep(); expect(h.retired).to.deep.equal(['target']);
    } finally { h.close(); }
  });

  it('retains the connection serial high water through backing replacement and stale callbacks', async () => {
    const h = await completionUiFixture(); const delivered: number[] = [];
    try {
      h.promote(); h.facade.attachment.subscribeCompletedFrames(frame => delivered.push(frame.stamp.paintFrameSerial));
      const old = h.frame(); h.emit(old); const stale = [...h.history];
      h.replaceAdapter(); h.promote(); const next = h.frame(); h.emit(next);
      for (const callback of stale) callback(old);
      expect(next.stamp.paintFrameSerial).to.be.greaterThan(old.stamp.paintFrameSerial);
      expect(delivered).to.deep.equal([old.stamp.paintFrameSerial, next.stamp.paintFrameSerial]);
      expect(h.facade.attachment.current(old, h.target())).to.equal(false);
    } finally { h.close(); }
  });

  it('disposal during port callbacks releases newly acquired handles and denies stale returns', async () => {
    for (const operation of ['subscribe', 'watch', 'current', 'project'] as const) {
      const h = await completionUiFixture();
      try {
        const frame = h.frame(), fact = h.target(); let triggered = 0;
        if (operation === 'current' || operation === 'project') { h.promote(); h.emit(frame); }
        h.hooks[operation] = () => { triggered++; h.adapter.dispose(); };
        if (operation === 'subscribe') h.adapter.backing.subscribeCompletedFrames(() => {});
        if (operation === 'watch') h.adapter.backing.watchTarget('target');
        if (operation === 'current') expect(h.adapter.backing.current(frame, fact)).to.equal(false);
        if (operation === 'project') expect(h.adapter.backing.projectTarget(frame, 'target')).to.equal(undefined);
        expect(triggered).to.be.greaterThan(0);
        h.adapter.dispose(); expect(h.releases).to.equal(h.subscriptions); expect(h.retired.length).to.equal(h.watched.length);
      } finally { h.close(); }
    }
  });

  it('ground follow reads accepted intent without watches while visual follow stays pending', async () => {
    const h = await completionUiFixture();
    try {
      const ground = completionFollow(h, 'ground'); expect(ground.ground.length).to.equal(1); expect(h.watched).to.deep.equal([]); ground.runner.dispose();
      h.promote(); const visual = completionFollow(h); expect(visual.runner.snapshot.status).to.equal('pending');
      expect(visual.pans.length).to.equal(0); visual.runner.dispose();
    } finally { h.close(); }
  });

  it('existing follow receipts retain original frame authority and reject scalar stamp copies', async () => {
    const h = await completionUiFixture();
    try {
      h.promote(); const scene = createMapCameraFollowScene(h.facade.attachment), values: MapCameraFollowFrame[] = [];
      const release = scene.subscribeFrames('target', frame => values.push(frame)); h.emit(h.frame());
      expect(values.length).to.equal(1); expect(scene.current(values[0]!.stamp)).to.equal(true);
      expect(scene.current({ ...values[0]!.stamp })).to.equal(false);
      h.owner.invalidatePresentation(); expect(scene.current(values[0]!.stamp)).to.equal(false); release();
    } finally { h.close(); }
  });

  it('neither anchor hidden object visible nor anchor clear object empty becomes visual success', async () => {
    const h = await completionUiFixture();
    try {
      h.promote(); const follow = completionFollow(h), revision = h.target().acceptedPositionRevision;
      for (const status of ['occluded', 'unavailable'] as const) {
        h.setProjection({ acceptedPositionRevision: revision, status, point: [350, 240], visible: false }); h.emit(h.frame());
        expect(follow.pans.length).to.equal(0); expect(follow.runner.snapshot.status).not.to.equal('centered');
      }
      follow.runner.dispose();
    } finally { h.close(); }
  });

  it('publication mutation during camera correction preparation denies the prepared write', async () => {
    const h = await completionUiFixture();
    try {
      h.promote(); const follow = completionFollow(h);
      let preparations = 0;
      follow.hooks.prepare = () => { preparations++; h.owner.invalidatePresentation(); }; h.emit(h.frame());
      expect(preparations).to.equal(1);
      expect(follow.pans.length).to.equal(0); follow.runner.dispose();
    } finally { h.close(); }
  });

  it('query completion and theme repaint preserve correction budget and accepted position revision', async () => {
    const h = await completionUiFixture();
    try {
      h.promote(); const follow = completionFollow(h), revision = h.target().acceptedPositionRevision;
      for (let index = 0; index < 8; index++) h.emit(h.frame());
      const corrections = follow.runner.snapshot.corrections;
      expect(corrections).to.be.greaterThan(0);
      h.owner.invalidatePresentation(); h.resolve(); h.emit(h.frame()); h.emit(h.frame());
      expect(h.target().acceptedPositionRevision).to.equal(revision);
      expect(follow.runner.snapshot.corrections).to.equal(corrections); follow.runner.dispose();
    } finally { h.close(); }
  });
});
