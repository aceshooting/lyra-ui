import { expect, fixture, html } from '@open-wc/testing';
import { createMapSceneSessionFacade } from '../../../internal/map-scene-session.js';
import { sceneArc, sceneMarker, sceneModel, scenePath } from '../../../../test/map-scene-admission-fixtures.js';
import { createMapSceneOwner } from './map-scene-owner.js';
import { publicationCoherent, renderOwner, scenePresentation, sceneViewport } from '../../../../test/map-scene-render-fixtures.js';
import type { TestScenePublication, TestSceneRenderOwner } from '../../../../test/map-scene-render-fixtures.js';

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

describe('map scene owner render publication', () => {
  it('publishes accepted state and pending input before earlier state observers run', async () => {
    const h = await harness();
    const coherent: boolean[] = [], order: string[] = [];
    const releaseState = h.owner.state.subscribe(() => {
      order.push('state');
      const capture: unknown = Reflect.get(h.owner, 'captureRenderPublication');
      if (typeof capture !== 'function') { coherent.push(false); return; }
      const publication = (capture as () => TestScenePublication).call(h.owner);
      coherent.push(publicationCoherent(publication) && publication.accepted === h.owner.captureAccepted() &&
        publication.state === h.owner.state.capture());
    });
    const releaseAccepted = h.owner.subscribeAccepted(() => { order.push('accepted'); });
    try {
      h.owner.assign({ objects: [sceneMarker('A')] });
      expect(coherent.length).to.be.greaterThan(0);
      expect(coherent.every(Boolean)).to.equal(true);
      expect(order.indexOf('state')).to.be.lessThan(order.indexOf('accepted'));
      const publication = renderOwner(h.owner).captureRenderPublication();
      expect(publication.phase).to.equal('pending');
      expect(publication.input.markers).to.deep.equal([]);
      expect(publication.accepted === h.owner.captureAccepted() && publication.state === h.owner.state.capture()).to.equal(true);
    } finally { releaseState(); releaseAccepted(); h.close(); }
  });

  it('contains an observer throw and drains synchronous resolved publication to remaining listeners', async () => {
    const h = await harness(), owner = renderOwner(h.owner);
    const coherent: boolean[] = [], phases: string[] = [];
    let laterState = 0;
    const releaseThrow = owner.state.subscribe(() => { throw new Error('Observer failure is contained'); });
    const releaseLater = owner.state.subscribe(() => { laterState++; });
    let releasePrepare: (() => void) | undefined, releaseObserve: (() => void) | undefined;
    try {
      releasePrepare = owner.subscribeRenderPublication(() => {
        const publication = owner.captureRenderPublication();
        coherent.push(publicationCoherent(publication) && publication.accepted === owner.captureAccepted() && publication.state === owner.state.capture());
        if (publication.phase === 'pending') owner.commitPresentation(publication, scenePresentation(publication.accepted));
      });
      releaseObserve = owner.subscribeRenderPublication(() => {
        const publication = owner.captureRenderPublication();
        coherent.push(publicationCoherent(publication) && publication.accepted === owner.captureAccepted() && publication.state === owner.state.capture());
        phases.push(publication.phase);
      });
      owner.assign({ objects: [sceneMarker()] });
      expect(laterState).to.be.greaterThan(0);
      expect(coherent.length).to.be.greaterThan(0);
      expect(coherent.every(Boolean)).to.equal(true);
      expect(phases.at(-1)).to.equal('resolved');
      const current = owner.captureRenderPublication();
      expect(owner.captureRenderPublication() === current).to.equal(true);
      expect(current.input.markers.map(marker => marker.id)).to.deep.equal(['target']);
    } finally { releaseThrow(); releaseLater(); releasePrepare?.(); releaseObserve?.(); h.close(); }
  });

  it('keeps position and allocation identity on metadata-only acceptance while advancing input revision', async () => {
    const h = await harness(), owner = renderOwner(h.owner);
    try {
      expect(owner.setViewport(sceneViewport())).to.equal(true);
      owner.assign({ objects: [sceneMarker()] });
      const before = owner.captureRenderPublication(), fact = owner.state.capture().targets[0];
      expect(owner.commitPresentation(before, scenePresentation(before.accepted))).to.equal(true);
      owner.assign({ objects: [{ ...sceneMarker(), label: 'Updated label' }] });
      const after = owner.captureRenderPublication();
      expect(after.accepted.acceptedSceneRevision).to.be.greaterThan(before.accepted.acceptedSceneRevision);
      expect(after.input.acceptedSceneRevision).to.equal(after.accepted.acceptedSceneRevision);
      expect(after.input.presentationRevision).to.be.greaterThan(before.input.presentationRevision);
      expect(after.state.targets[0] === fact).to.equal(true);
      expect(after.state.viewport === before.state.viewport).to.equal(true);
      expect(publicationCoherent(after)).to.equal(true);
    } finally { h.close(); }
  });

  it('clears accepted source ownership while preserving viewport and resolved empty work without preparation', async () => {
    const h = await harness(), owner = renderOwner(h.owner);
    let release: (() => void) | undefined, preparations = 0;
    try {
      const bytes = new Uint8Array([1, 2]), source = { format: 'glb' as const, bytes };
      owner.setViewport(sceneViewport()); owner.assign({ objects: [sceneModel('model', source), sceneMarker()] });
      const pending = owner.captureRenderPublication(), viewport = pending.state.viewport;
      owner.commitPresentation(pending, scenePresentation(pending.accepted));
      structuredClone(bytes.buffer, { transfer: [bytes.buffer] });
      release = owner.subscribeRenderPublication(() => { if (owner.captureRenderPublication().phase === 'pending') preparations++; });
      owner.assign(undefined);
      const cleared = owner.captureRenderPublication();
      expect(cleared.phase).to.equal('resolved'); expect(cleared.input.markers).to.deep.equal([]);
      expect(cleared.accepted.objects.length).to.equal(0);
      expect(cleared.state.viewport === viewport).to.equal(true);
      expect(cleared.input.allocation?.revision).to.equal(viewport?.allocationRevision);
      expect(preparations).to.equal(0);
      owner.assign({ objects: [sceneModel('model', source)] });
      expect(owner.captureView().status?.code).to.equal('invalid');
      expect(owner.captureRenderPublication() === cleared).to.equal(true);
    } finally { release?.(); h.close(); }
  });

  it('treats equal viewport values as an exact identity and notification no-op', async () => {
    const h = await harness(), owner = renderOwner(h.owner);
    let releaseRender: (() => void) | undefined, releaseState: (() => void) | undefined;
    let renderNotices = 0, stateNotices = 0;
    try {
      owner.setViewport(sceneViewport()); owner.assign({ objects: [sceneMarker()] });
      const pending = owner.captureRenderPublication(); owner.commitPresentation(pending, scenePresentation(pending.accepted));
      const before = owner.captureRenderPublication();
      releaseRender = owner.subscribeRenderPublication(() => { renderNotices++; });
      releaseState = owner.state.subscribe(() => { stateNotices++; });
      expect(owner.setViewport(sceneViewport())).to.equal(false);
      expect(owner.captureRenderPublication() === before && owner.state.capture() === before.state).to.equal(true);
      expect([renderNotices, stateNotices]).to.deep.equal([0, 0]);
    } finally { releaseRender?.(); releaseState?.(); h.close(); }
  });

  it('updates allocation with cached resolved presentation without resetting accepted facts or preparing colors', async () => {
    const h = await harness(), owner = renderOwner(h.owner);
    let release: (() => void) | undefined, preparations = 0;
    try {
      owner.setViewport(sceneViewport()); owner.assign({ objects: [sceneMarker()] });
      const pending = owner.captureRenderPublication(); owner.commitPresentation(pending, scenePresentation(pending.accepted, 0.4));
      const before = owner.captureRenderPublication();
      release = owner.subscribeRenderPublication(() => { if (owner.captureRenderPublication().phase === 'pending') preparations++; });
      expect(owner.setViewport({ ...sceneViewport(800, 600, 2), padding: { top: 13, right: 17, bottom: 19, left: 23 } })).to.equal(true);
      const after = owner.captureRenderPublication();
      expect(after.phase).to.equal('resolved'); expect(preparations).to.equal(0);
      expect(after.accepted === before.accepted && after.state.targets === before.state.targets).to.equal(true);
      expect(after.state.registryRevision).to.equal(before.state.registryRevision);
      expect(after.state.viewport!.allocationRevision).to.be.greaterThan(before.state.viewport!.allocationRevision);
      expect(after.input.presentationRevision).to.be.greaterThan(before.input.presentationRevision);
      expect(after.input.markers[0]!.rgba).to.deep.equal(before.input.markers[0]!.rgba);
      expect(publicationCoherent(after)).to.equal(true);
    } finally { release?.(); h.close(); }
  });

  it('retains allocation high-water through absence and identical-size restoration', async () => {
    const h = await harness(), owner = renderOwner(h.owner);
    try {
      owner.assign({ objects: [sceneMarker()] }); owner.setViewport(sceneViewport());
      const before = owner.captureRenderPublication();
      expect(owner.setViewport(undefined)).to.equal(true);
      expect(owner.captureRenderPublication().state.viewport).to.equal(undefined);
      expect(owner.captureRenderPublication().input.allocation).to.equal(undefined);
      expect(owner.setViewport(sceneViewport())).to.equal(true);
      const after = owner.captureRenderPublication();
      expect(after.state.viewport!.allocationRevision).to.be.greaterThan(before.state.viewport!.allocationRevision);
      expect(after.accepted === before.accepted && after.state.targets === before.state.targets).to.equal(true);
    } finally { h.close(); }
  });

  it('keeps allocation sequence across native replacement while new connections own independent authority', async () => {
    const h = await harness(), second = await harness(), owner = renderOwner(h.owner), other = renderOwner(second.owner);
    const revisions: number[] = [];
    const release = h.facade.attachment.subscribeViewport(viewport => { revisions.push(viewport.allocationRevision); });
    try {
      owner.setViewport(sceneViewport()); const first = owner.state.capture().viewport!.allocationRevision;
      owner.setViewport(undefined); owner.setViewport(sceneViewport(900, 600, 2));
      const next = owner.state.capture().viewport!.allocationRevision;
      expect(next).to.be.greaterThan(first);
      expect(revisions).to.deep.equal([first, next]);
      other.setViewport(sceneViewport());
      expect(other.state.capture().viewport!.allocationRevision).to.equal(first);
      expect(owner.captureRenderPublication().input.allocation!.revision).to.equal(next);
    } finally { release(); h.close(); second.close(); }
  });

  it('supersedes even pending presentation on a new theme invalidation without changing accepted targets', async () => {
    const h = await harness(), owner = renderOwner(h.owner);
    try {
      owner.assign({ objects: [sceneMarker()] }); const initial = owner.captureRenderPublication();
      owner.commitPresentation(initial, scenePresentation(initial.accepted));
      const resolved = owner.captureRenderPublication();
      expect(owner.invalidatePresentation()).to.equal(true); const firstPending = owner.captureRenderPublication();
      expect(firstPending.phase).to.equal('pending'); expect(firstPending.input.markers).to.deep.equal([]);
      expect(firstPending.accepted === resolved.accepted && firstPending.state === resolved.state).to.equal(true);
      expect(owner.invalidatePresentation()).to.equal(true); const secondPending = owner.captureRenderPublication();
      expect(secondPending === firstPending).to.equal(false);
      expect(owner.commitPresentation(firstPending, scenePresentation(firstPending.accepted))).to.equal(false);
      expect(owner.captureRenderPublication() === secondPending).to.equal(true);
      expect(owner.commitPresentation(secondPending, scenePresentation(secondPending.accepted, 0.3))).to.equal(true);
      expect(owner.captureRenderPublication().input.markers[0]!.rgba[3]).to.equal(0.3);
    } finally { h.close(); }
  });

  it('rechecks presentation currency after reflection and connection callbacks that accept a newer scene', async () => {
    const h = await harness();
    try {
      for (const mode of ['reflection', 'current'] as const) {
        let armed = false, reentered = false, nested: TestScenePublication | undefined;
        let owner: TestSceneRenderOwner;
        const replace = () => {
          if (armed) {
            armed = false; reentered = true; owner.assign({ objects: [sceneMarker('B')] });
            nested = owner.captureRenderPublication();
          }
        };
        owner = renderOwner(createMapSceneOwner({ element: h.element, connection: Object.freeze({}),
          isCurrentConnection() { if (mode === 'current') replace(); return true; }, changed() {} }));
        try {
          owner.assign({ objects: [sceneMarker('A')] }); const expected = owner.captureRenderPublication();
          const value = scenePresentation(expected.accepted);
          const presentation = mode === 'reflection' ? new Proxy(value, {
            getOwnPropertyDescriptor(target, key) { replace(); return Reflect.getOwnPropertyDescriptor(target, key); },
          }) : value;
          armed = true;
          expect(owner.commitPresentation(expected, presentation)).to.equal(false);
          expect(reentered).to.equal(true);
          const current = owner.captureRenderPublication();
          expect(current === nested).to.equal(true);
          expect(current.accepted.objects.map(object => object.id)).to.deep.equal(['B']);
          expect(current.phase).to.equal('pending'); expect(current.input.markers).to.deep.equal([]);
          expect(publicationCoherent(current)).to.equal(true);
          expect(owner.invalidatePresentation()).to.equal(true);
          expect(owner.captureRenderPublication().input.presentationRevision).to.equal(current.input.presentationRevision + 1);
        } finally { owner.close(); }
      }
    } finally { h.close(); }
  });

  it('refuses an outer viewport after validation reenters a newer viewport on the same owner', async () => {
    const h = await harness(), owner = renderOwner(h.owner);
    try {
      owner.assign({ objects: [sceneMarker()] }); owner.setViewport(sceneViewport());
      const expected = owner.captureRenderPublication(); let reentered = false, nested: TestScenePublication | undefined;
      const outer = new Proxy(sceneViewport(800, 600, 1), {
        getOwnPropertyDescriptor(target, key) {
          if (!reentered) {
            reentered = true; owner.setViewport(sceneViewport(900, 700, 2));
            nested = owner.captureRenderPublication();
          }
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
      });
      expect(owner.setViewport(outer)).to.equal(false); expect(reentered).to.equal(true);
      const current = owner.captureRenderPublication();
      expect(current === nested).to.equal(true);
      expect(current.state.viewport!.width).to.equal(900); expect(current.input.allocation!.height).to.equal(700);
      expect(owner.commitPresentation(expected, scenePresentation(expected.accepted))).to.equal(false);
      expect(owner.captureRenderPublication() === current).to.equal(true);
      expect(publicationCoherent(current)).to.equal(true);
      expect(owner.setViewport(sceneViewport(1000, 700, 2))).to.equal(true);
      const next = owner.captureRenderPublication();
      expect(next.input.presentationRevision).to.equal(current.input.presentationRevision + 1);
      expect(next.state.viewport!.allocationRevision).to.equal(current.state.viewport!.allocationRevision + 1);
    } finally { h.close(); }
  });

  it('refuses malformed presentation without a partial swap and keeps accepted ownership on explicit failure', async () => {
    const h = await harness(), owner = renderOwner(h.owner);
    try {
      owner.assign({ objects: [sceneModel(), sceneMarker()] });
      const expected = owner.captureRenderPublication(), receipt = modelReceipt(owner);
      expect(owner.commitPresentation(expected, { markers: [{ id: 'target', rgba: [1, 0, 0, NaN] }], reducedMotion: false })).to.equal(false);
      expect(owner.captureRenderPublication() === expected).to.equal(true);
      expect(owner.failPresentation(expected)).to.equal(true);
      const failed = owner.captureRenderPublication();
      expect(failed.phase).to.equal('unavailable'); expect(failed.input.markers).to.deep.equal([]);
      expect(failed.accepted === expected.accepted && failed.state === expected.state).to.equal(true);
      expect(modelReceipt(owner) === receipt).to.equal(true);
      expect(owner.captureView().status?.state).to.equal('unavailable');
      expect(h.facade.attachment.target('target').status).to.equal('accepted');
      expect(owner.failPresentation(expected)).to.equal(false);
      expect(owner.captureRenderPublication() === failed).to.equal(true);
    } finally { h.close(); }
  });

  it('keeps exact rendered publication on rejected replacement while changing only the rejection notice', async () => {
    const h = await harness(), owner = renderOwner(h.owner);
    let release: (() => void) | undefined, notices = 0;
    try {
      owner.setViewport(sceneViewport()); owner.assign({ objects: [sceneMarker()] });
      const pending = owner.captureRenderPublication(); owner.commitPresentation(pending, scenePresentation(pending.accepted));
      const before = owner.captureRenderPublication();
      release = owner.subscribeRenderPublication(() => { notices++; });
      owner.assign({ objects: [sceneMarker('bad'), sceneMarker('bad')] });
      expect(owner.captureRenderPublication() === before).to.equal(true);
      expect(owner.captureAccepted() === before.accepted && owner.state.capture() === before.state).to.equal(true);
      expect(owner.captureView().status?.code).to.equal('invalid'); expect(notices).to.equal(0);
      expect(owner.captureRenderPublication().input.markers.map(marker => marker.id)).to.deep.equal(['target']);
    } finally { release?.(); h.close(); }
  });

  it('keeps releases independent and refuses every late transaction after close', async () => {
    const h = await harness(), owner = renderOwner(h.owner);
    let first = 0, second = 0;
    let releaseFirst: (() => void) | undefined, releaseSecond: (() => void) | undefined;
    try {
      const initial = owner.captureRenderPublication();
      expect(initial.phase).to.equal('resolved'); expect(initial.accepted.acceptedSceneRevision).to.equal(0);
      expect(initial.input.presentationRevision).to.equal(1); expect(initial.input.markers).to.deep.equal([]);
      releaseFirst = owner.subscribeRenderPublication(() => { first++; });
      releaseSecond = owner.subscribeRenderPublication(() => { second++; });
      releaseFirst(); releaseFirst(); owner.assign({ objects: [sceneMarker()] });
      expect(first).to.equal(0); expect(second).to.be.greaterThan(0);
      const pending = owner.captureRenderPublication(), count = second;
      owner.close(); const closed = owner.captureRenderPublication();
      expect(owner.commitPresentation(pending, scenePresentation(pending.accepted))).to.equal(false);
      expect(owner.failPresentation(pending)).to.equal(false);
      expect(owner.invalidatePresentation()).to.equal(false);
      expect(owner.setViewport(sceneViewport())).to.equal(false);
      expect(owner.captureRenderPublication() === closed).to.equal(true); expect(second).to.equal(count);
    } finally { releaseFirst?.(); releaseSecond?.(); h.close(); }
  });
});
