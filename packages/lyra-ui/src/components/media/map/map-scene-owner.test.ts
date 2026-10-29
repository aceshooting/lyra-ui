import { expect, fixture, html } from '@open-wc/testing';
import { createMapSceneSessionFacade } from '../../../internal/map-scene-session.js';
import { sceneArc, sceneMarker, sceneModel, scenePath } from '../../../../test/map-scene-admission-fixtures.js';
import { createMapSceneOwner } from './map-scene-owner.js';

async function harness() {
  const element = await fixture<HTMLElement>(html`<div></div>`);
  const connection = Object.freeze({});
  let current = true, changes = 0;
  const owner = createMapSceneOwner({ element, connection, isCurrentConnection: () => current, changed() { changes++; } });
  const facade = createMapSceneSessionFacade({ connection });
  expect(facade.bindState(owner.state)).to.equal(true);
  return { owner, facade, element, retire() { current = false; }, get changes() { return changes; },
    close() { facade.close(); owner.close(); } };
}

function modelReceipt(owner: ReturnType<typeof createMapSceneOwner>) {
  const object = owner.captureAccepted().objects[0];
  if (!object || object.kind !== 'model') throw new Error('Expected admitted model');
  return object.source;
}

describe('map scene owner', () => {
  it('keeps default undefined inactive without notices or source fetches', async () => {
    const original = window.fetch; let fetches = 0;
    window.fetch = (...args) => { fetches++; return original(...args); };
    let h: Awaited<ReturnType<typeof harness>> | undefined;
    let releaseAccepted: (() => void) | undefined, releaseState: (() => void) | undefined;
    let accepted = 0, state = 0;
    try {
      h = await harness();
      releaseAccepted = h.owner.subscribeAccepted(() => { accepted++; });
      releaseState = h.owner.state.subscribe(() => { state++; });
      h.owner.assign(undefined);
      expect(h.owner.captureView()).to.deep.equal({ active: false, accepted: { acceptedSceneRevision: 0, objects: [] }, status: undefined });
      expect(h.owner.state.capture().targets).to.deep.equal([]);
      expect([h.changes, accepted, state, fetches]).to.deep.equal([0, 0, 0, 0]);
    } finally { window.fetch = original; releaseAccepted?.(); releaseState?.(); h?.close(); }
  });

  it('synchronously publishes canonical full objects and authoritative target facts', async () => {
    const h = await harness();
    try {
      const marker = { ...sceneMarker('pin', 540), radius: 9, opacity: 0.25, interactive: false, showLabel: true, color: 'red' };
      h.owner.assign({ objects: [marker, scenePath(), sceneArc(), sceneModel()] });
      const accepted = h.owner.captureAccepted();
      expect(accepted.objects.map(object => object.kind)).to.deep.equal(['marker', 'path', 'arc', 'model']);
      const object = accepted.objects[0]!;
      if (object.kind !== 'marker') throw new Error('Expected marker');
      expect(object).to.deep.equal({ ...marker, position: { lngLat: [-180, 0], altitude: 0, altitudeReference: 'sea-level' } });
      const lookup = h.facade.attachment.target('pin');
      if (lookup.status !== 'accepted') throw new Error('Expected accepted target');
      expect(lookup.target.position).to.deep.equal(object.position);
      expect(h.facade.attachment.target('route')).to.deep.equal({ status: 'unsupported-kind', kind: 'path' });
      expect(h.owner.state.capture().acceptedSceneRevision).to.equal(accepted.acceptedSceneRevision);
      expect(h.owner.captureView().status).to.deep.equal({ revision: accepted.acceptedSceneRevision, state: 'unavailable', code: 'engine' });
      expect(h.owner.state.capture().viewport).to.equal(undefined);
    } finally { h.close(); }
  });

  it('reports initial invalid input at revision zero and preserves accepted intent on later rejection', async () => {
    const h = await harness();
    let releaseAccepted: (() => void) | undefined, releaseState: (() => void) | undefined;
    let acceptedNotices = 0, stateNotices = 0;
    try {
      h.owner.assign({ objects: [null] });
      expect(h.owner.captureView()).to.deep.equal({ active: true, accepted: { acceptedSceneRevision: 0, objects: [] }, status: { revision: 0, state: 'error', code: 'invalid' } });
      h.owner.assign({ objects: [sceneMarker()] });
      const accepted = h.owner.captureAccepted(), state = h.owner.state.capture();
      releaseAccepted = h.owner.subscribeAccepted(() => { acceptedNotices++; });
      releaseState = h.owner.state.subscribe(() => { stateNotices++; });
      h.owner.assign({ objects: [sceneMarker(), sceneMarker()] });
      expect(h.owner.captureAccepted() === accepted).to.equal(true);
      expect(h.owner.state.capture() === state).to.equal(true);
      expect(h.owner.captureView().status).to.deep.equal({ revision: accepted.acceptedSceneRevision, state: 'error', code: 'invalid' });
      expect(h.facade.attachment.target('target').status).to.equal('accepted');
      expect([acceptedNotices, stateNotices]).to.deep.equal([0, 0]);
    } finally { releaseAccepted?.(); releaseState?.(); h.close(); }
  });

  it('distinguishes explicit empty intent from clear and advances the accepted empty revision', async () => {
    const h = await harness();
    try {
      h.owner.assign({ objects: [] });
      const empty = h.owner.captureView();
      expect(empty.active).to.equal(true);
      expect(empty.status).to.deep.equal({ revision: empty.accepted.acceptedSceneRevision, state: 'empty' });
      h.owner.assign({ objects: [sceneMarker()] });
      const revision = h.owner.captureAccepted().acceptedSceneRevision;
      h.owner.assign(undefined);
      const cleared = h.owner.captureView();
      expect(cleared.active).to.equal(false); expect(cleared.accepted.objects).to.deep.equal([]);
      expect(cleared.accepted.acceptedSceneRevision).to.be.greaterThan(revision);
      expect(cleared.status).to.deep.equal({ revision: cleared.accepted.acceptedSceneRevision, state: 'empty' });
      expect(h.facade.attachment.target('target').status).to.equal('absent');
    } finally { h.close(); }
  });

  it('preserves exact position facts on source-only replacement while notifying accepted metadata', async () => {
    const h = await harness(); let metadata = 0;
    const changedIds: string[][] = [];
    const release = h.owner.subscribeAccepted(() => { metadata++; });
    const releaseTargets = h.facade.attachment.subscribeTargets(notice => { changedIds.push([...notice.changedIds]); });
    try {
      h.owner.assign({ objects: [sceneModel()] });
      const first = h.facade.attachment.target('model'), revision = h.owner.captureAccepted().acceptedSceneRevision;
      if (first.status !== 'accepted') throw new Error('Expected target');
      metadata = 0; changedIds.length = 0;
      h.owner.assign({ objects: [sceneModel('model', { format: 'glb', bytes: new Uint8Array([4]) })] });
      const next = h.facade.attachment.target('model');
      if (next.status !== 'accepted') throw new Error('Expected target');
      expect(next.target === first.target).to.equal(true);
      expect(h.owner.captureAccepted().acceptedSceneRevision).to.be.greaterThan(revision);
      expect(metadata).to.equal(1); expect(changedIds.flat()).to.deep.equal([]);
    } finally { release(); releaseTargets(); h.close(); }
  });

  it('reuses an accepted byte record after mutation and detachment until clear revokes it', async () => {
    const h = await harness();
    try {
      const bytes = new Uint8Array([1, 2, 3]), source = { format: 'glb' as const, bytes };
      h.owner.assign({ objects: [sceneModel('model', source)] });
      const receipt = modelReceipt(h.owner);
      bytes[0] = 99;
      structuredClone(bytes.buffer, { transfer: [bytes.buffer] });
      h.owner.assign({ objects: [sceneModel('model', source)] });
      expect(modelReceipt(h.owner) === receipt).to.equal(true);
      expect(h.owner.captureView().status?.state).to.equal('unavailable');
      h.owner.assign(undefined);
      h.owner.assign({ objects: [sceneModel('model', source)] });
      expect(h.owner.captureAccepted().objects.length).to.equal(0);
      expect(h.owner.captureView().status?.code).to.equal('invalid');
    } finally { h.close(); }
  });

  it('charges accepted and staged byte copies against the shared 64 MiB owner budget', async () => {
    const h = await harness();
    try {
      const bytes = new Uint8Array(64 * 1024 * 1024);
      const source = { format: 'glb' as const, bytes };
      h.owner.assign({ objects: [sceneModel('model', source)] });
      const accepted = h.owner.captureAccepted(), receipt = modelReceipt(h.owner);
      const fact = h.facade.attachment.target('model');
      if (fact.status !== 'accepted') throw new Error('Expected target');
      expect(h.owner.captureView().status?.state).to.equal('unavailable');
      h.owner.assign({ objects: [sceneModel('model', { format: 'glb', bytes: new Uint8Array([1]) })] });
      expect(h.owner.captureAccepted() === accepted).to.equal(true);
      expect(modelReceipt(h.owner) === receipt).to.equal(true);
      const after = h.facade.attachment.target('model');
      if (after.status !== 'accepted') throw new Error('Expected target');
      expect(after.target === fact.target).to.equal(true);
      expect(h.owner.captureView().status).to.deep.equal({ revision: accepted.acceptedSceneRevision, state: 'error', code: 'limit' });
      h.owner.assign(undefined);
      h.owner.assign({ objects: [sceneModel('model', { format: 'glb', bytes: new Uint8Array([1]) })] });
      expect(h.owner.captureView().status?.state).to.equal('unavailable');
      h.owner.assign(undefined);
      h.owner.assign({ objects: [sceneModel('model', source)] });
      expect(h.owner.captureView().status?.state).to.equal('unavailable');
      expect(modelReceipt(h.owner) === receipt).to.equal(false);
    } finally { h.close(); }
  });

  it('rejects changed source metadata without replacing the accepted snapshot', async () => {
    const h = await harness();
    try {
      const source = { format: 'glb', bytes: new Uint8Array([1]) };
      h.owner.assign({ objects: [{ ...sceneModel(), source }] });
      const accepted = h.owner.captureAccepted();
      source.format = 'obj';
      h.owner.assign({ objects: [{ ...sceneModel(), source }] });
      expect(h.owner.captureAccepted() === accepted).to.equal(true);
      expect(h.owner.captureView().status?.code).to.equal('invalid');
    } finally { h.close(); }
  });

  it('keeps captured snapshots stable, deeply frozen and isolated from caller mutation', async () => {
    const h = await harness();
    try {
      const path = scenePath();
      h.owner.assign({ objects: [path] });
      const old = h.owner.captureAccepted(), view = h.owner.captureView(), state = h.owner.state.capture();
      expect(h.owner.captureAccepted() === old).to.equal(true);
      expect(h.owner.captureView() === view).to.equal(true);
      path.positions[0]!.lngLat[0] = 123; path.label = 'changed';
      h.owner.assign({ objects: [sceneMarker('new')] });
      const object = old.objects[0]!;
      if (object.kind !== 'path') throw new Error('Expected path');
      expect(object.positions[0]!.lngLat).to.deep.equal([0, 0]); expect(object.label).to.equal('route');
      expect([old, old.objects, object, object.positions, object.positions[0], object.positions[0]!.lngLat, view, state].every(Object.isFrozen)).to.equal(true);
      expect(state.targets.map(target => target.id)).to.deep.equal(['route']);
    } finally { h.close(); }
  });

  it('ignores assignment after connection retirement and idempotent close', async () => {
    const h = await harness();
    h.owner.assign({ objects: [sceneMarker()] });
    const accepted = h.owner.captureAccepted(), changes = h.changes;
    h.retire(); h.owner.assign({ objects: [sceneMarker('late')] });
    expect(h.owner.captureAccepted() === accepted).to.equal(true); expect(h.changes).to.equal(changes);
    h.owner.close(); h.owner.close();
    const closed = h.owner.captureView();
    h.owner.assign({ objects: [sceneMarker('later')] });
    expect(h.owner.captureView() === closed).to.equal(true); expect(h.changes).to.equal(changes);
    h.facade.close();
  });

  it('accepts owner-relative URLs without starting a fetch and rejects unsafe schemes', async () => {
    const h = await harness(); const original = window.fetch; let fetches = 0;
    window.fetch = (...args) => { fetches++; return original(...args); };
    try {
      h.owner.assign({ objects: [{ ...sceneModel(), source: { format: 'glb', src: './model.glb' } }] });
      expect(h.owner.captureView().status?.state).to.equal('unavailable');
      const accepted = h.owner.captureAccepted();
      h.owner.assign({ objects: [{ ...sceneModel(), source: { format: 'glb', src: 'javascript:void(0)' } }] });
      expect(h.owner.captureAccepted() === accepted).to.equal(true);
      expect(h.owner.captureView().status?.code).to.equal('invalid'); expect(fetches).to.equal(0);
    } finally { window.fetch = original; h.close(); }
  });

  it('keeps an accepted relative URL association across owner-document base changes', async () => {
    const frame = await fixture<HTMLIFrameElement>(html`<iframe title="Scene source realm"></iframe>`);
    const document = frame.contentDocument, realm = frame.contentWindow;
    if (!document || !realm) throw new Error('Expected frame realm');
    const base = document.createElement('base'); base.href = 'https://example.invalid/first/'; document.head.append(base);
    const element = document.createElement('div'); document.body.append(element);
    const connection = Object.freeze({}); let current = true, fetches = 0;
    const original = realm.fetch;
    realm.fetch = (...args) => { fetches++; return original(...args); };
    let owner: ReturnType<typeof createMapSceneOwner> | undefined;
    try {
      owner = createMapSceneOwner({ element, connection, isCurrentConnection: () => current, changed() {} });
      const source = { format: 'glb', src: './model.glb' };
      owner.assign({ objects: [{ ...sceneModel(), source }] });
      const receipt = modelReceipt(owner);
      base.href = 'https://example.invalid/second/';
      owner.assign({ objects: [{ ...sceneModel(), source }] });
      expect(modelReceipt(owner) === receipt).to.equal(true);
      expect(owner.captureView().status?.state).to.equal('unavailable');
      const accepted = owner.captureAccepted(); current = false; element.remove();
      owner.assign({ objects: [{ ...sceneModel(), source: { format: 'glb', src: './new.glb' } }] });
      expect(owner.captureAccepted() === accepted).to.equal(true); expect(fetches).to.equal(0);
    } finally { realm.fetch = original; owner?.close(); }
  });

  it('lets accepted subscribers read current facade facts and replace the whole scene reentrantly', async () => {
    const h = await harness();
    const observations: { id: string; target: string; revision: number; stateRevision: number }[] = [];
    let replaced = false;
    const release = h.owner.subscribeAccepted(() => {
      const accepted = h.owner.captureAccepted(), object = accepted.objects[0];
      if (!object) return;
      const lookup = h.facade.attachment.target(object.id);
      observations.push({ id: object.id, target: lookup.status, revision: accepted.acceptedSceneRevision,
        stateRevision: h.owner.state.capture().acceptedSceneRevision });
      if (!replaced) { replaced = true; h.owner.assign({ objects: [{ ...sceneMarker('B', 40), radius: 17 }] }); }
    });
    try {
      h.owner.assign({ objects: [sceneMarker('A')] });
      expect(observations.length).to.be.greaterThan(0);
      expect(observations.every(value => value.target === 'accepted' && value.revision === value.stateRevision)).to.equal(true);
      const object = h.owner.captureAccepted().objects[0];
      if (!object || object.kind !== 'marker') throw new Error('Expected marker');
      expect(object.id).to.equal('B'); expect(object.radius).to.equal(17);
      expect(h.owner.captureView().status?.revision).to.equal(h.owner.captureAccepted().acceptedSceneRevision);
    } finally { release(); h.close(); }
  });

  it('does not publish an older deferred status after a state subscriber closes the owner', async () => {
    const h = await harness(); let closed = false;
    let closedView: ReturnType<typeof h.owner.captureView> | undefined;
    const release = h.owner.state.subscribe(() => {
      if (closed) return;
      closed = true; h.owner.close(); closedView = h.owner.captureView();
    });
    try {
      h.owner.assign({ objects: [sceneMarker()] });
      expect(closed).to.equal(true);
      expect(h.owner.captureView() === closedView).to.equal(true);
      const changes = h.changes;
      h.owner.assign({ objects: [sceneMarker('late')] });
      expect(h.owner.captureView() === closedView).to.equal(true); expect(h.changes).to.equal(changes);
    } finally { release(); h.close(); }
  });

  it('publishes coherent full objects and facade reads during synchronous reentrant acceptance', async () => {
    const h = await harness(); const observations: { ids: string[]; targets: string[]; revision: number; stateRevision: number }[] = [];
    let replaced = false;
    const release = h.owner.state.subscribe(() => {
      if (!replaced) { replaced = true; h.owner.assign({ objects: [sceneMarker('B', 20), scenePath()] }); }
      const accepted = h.owner.captureAccepted(), state = h.owner.state.capture();
      observations.push({ ids: accepted.objects.map(object => object.id), targets: state.targets.map(target => target.id), revision: accepted.acceptedSceneRevision, stateRevision: state.acceptedSceneRevision });
    });
    try {
      h.owner.assign({ objects: [sceneMarker('A')] });
      expect(observations.length).to.be.greaterThan(0);
      expect(observations.every(value => value.ids.join() === value.targets.join() && value.revision === value.stateRevision)).to.equal(true);
      expect(h.owner.captureAccepted().objects.map(object => object.id)).to.deep.equal(['B', 'route']);
      expect(h.facade.attachment.target('A').status).to.equal('absent');
      expect(h.facade.attachment.target('B').status).to.equal('accepted');
      expect(h.owner.captureView().status?.revision).to.equal(h.owner.captureAccepted().acceptedSceneRevision);
    } finally { release(); h.close(); }
  });
});
