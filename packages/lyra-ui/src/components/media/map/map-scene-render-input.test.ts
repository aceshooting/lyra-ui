import { expect, fixture, html } from '@open-wc/testing';
import { sceneArc, sceneMarker, sceneModel, scenePath } from '../../../../test/map-scene-admission-fixtures.js';
import { scenePresentation, sceneViewport } from '../../../../test/map-scene-render-fixtures.js';
import type { TestScenePresentation } from '../../../../test/map-scene-render-fixtures.js';
import { createMapSceneOwner } from './map-scene-owner.js';
import { buildSceneRenderInput, snapshotScenePresentation, snapshotSceneViewport } from './map-scene-render-input.js';

async function inputHarness(objects: unknown[]) {
  const element = await fixture<HTMLElement>(html`<div></div>`);
  const owner = createMapSceneOwner({ element, connection: Object.freeze({}), isCurrentConnection: () => true, changed() {} });
  owner.assign({ objects });
  return { owner, accepted: owner.captureAccepted(), state: owner.state.capture() };
}

describe('map scene render input', () => {
  it('rejects malformed presentation shells and rows without reading accessors', () => {
    let reads = 0;
    const row = { id: 'pin', rgba: [0, 0, 0, 1] };
    const accessor = Object.defineProperty({}, 'markers', { get() { reads++; return [row]; } });
    const rowAccessor = Object.defineProperty({ id: 'pin' }, 'rgba', { get() { reads++; return row.rgba; } });
    for (const value of [null, [], new Date(), accessor, { markers: {}, reducedMotion: false },
      { markers: [], reducedMotion: 'false' }, { markers: [null], reducedMotion: false },
      { markers: [rowAccessor], reducedMotion: false }, { markers: new Array(1), reducedMotion: false }]) {
      expect(snapshotScenePresentation(value)).to.equal(undefined);
    }
    expect(reads).to.equal(0);
    expect(snapshotScenePresentation({ markers: [row], reducedMotion: false })?.markers[0]?.id).to.equal('pin');
  });

  it('contains reflective presentation failures and accepts a subsequent valid snapshot', () => {
    const row = { id: 'pin', rgba: [0, 0, 0, 1] };
    for (const value of [
      new Proxy({}, { getPrototypeOf() { throw new Error('private application failure'); } }),
      { markers: new Proxy([row], { getOwnPropertyDescriptor() { throw new Error('private application failure'); } }), reducedMotion: true },
    ]) expect(snapshotScenePresentation(value)).to.equal(undefined);
    expect(snapshotScenePresentation({ markers: [row], reducedMotion: true })?.reducedMotion).to.equal(true);
  });

  it('rejects invalid allocation dimensions and unsafe or empty backing stores', () => {
    for (const value of [undefined, [], new Date(), { ...sceneViewport(), padding: null }]) {
      expect(snapshotSceneViewport(value)).to.equal(undefined);
    }
    for (const key of ['width', 'height', 'pixelRatio']) {
      for (const value of [0, -1, NaN, Infinity, '640']) {
        expect(snapshotSceneViewport({ ...sceneViewport(), [key]: value })).to.equal(undefined);
      }
    }
    for (const value of [sceneViewport(0.1, 1, 1), sceneViewport(1, 0.1, 1),
      sceneViewport(Number.MAX_VALUE, 1, 2), sceneViewport(1, Number.MAX_SAFE_INTEGER, 2)]) {
      expect(snapshotSceneViewport(value)).to.equal(undefined);
    }
    expect(snapshotSceneViewport(sceneViewport(0.5, 0.5, 1))?.width).to.equal(0.5);
  });

  it('rejects invalid padding and accessors without consulting application values', () => {
    let reads = 0;
    for (const side of ['top', 'right', 'bottom', 'left']) {
      for (const value of [-1, NaN, Infinity, '0', undefined]) {
        expect(snapshotSceneViewport({ ...sceneViewport(), padding: { ...sceneViewport().padding, [side]: value } })).to.equal(undefined);
      }
    }
    const viewport = Object.defineProperty({ ...sceneViewport() }, 'width', { get() { reads++; return 640; } });
    expect(snapshotSceneViewport(viewport)).to.equal(undefined);
    expect(reads).to.equal(0);
    expect(snapshotSceneViewport(new Proxy({}, { getPrototypeOf() { throw new Error('unavailable allocation'); } }))).to.equal(undefined);
  });

  it('owns allocation scalars and padding independently of later application mutations', () => {
    const padding = { top: 0, right: 1, bottom: 2, left: 3 };
    const input = { width: 640, height: 480, pixelRatio: 2, padding };
    const output = snapshotSceneViewport(input);
    input.width = 1; padding.top = 100;
    expect(output).to.deep.equal({ width: 640, height: 480, pixelRatio: 2, padding: { top: 0, right: 1, bottom: 2, left: 3 } });
    expect(Object.isFrozen(output) && Object.isFrozen(output?.padding)).to.equal(true);
  });

  it('joins actual accepted marker geography and excludes other kinds and source receipts', async () => {
    const h = await inputHarness([{ ...sceneMarker('pin', 540), radius: 13 }, scenePath(), sceneArc(), sceneModel()]);
    try {
      const packet = buildSceneRenderInput({ accepted: h.accepted, state: h.state, phase: 'resolved', presentationRevision: 2,
        presentation: scenePresentation(h.accepted) });
      expect(packet?.markers.length).to.equal(1);
      const marker = packet!.markers[0]!, fact = h.state.targets.find(target => target.id === 'pin');
      if (!fact || fact.kind !== 'marker') throw new Error('Expected accepted marker target');
      expect(marker).to.deep.equal({ id: 'pin', position: fact.position, acceptedPositionRevision: fact.acceptedPositionRevision,
        radiusCss: 13, rgba: [0.2, 0.4, 0.6, 0.8] });
      expect(Object.keys(marker).sort()).to.deep.equal(['acceptedPositionRevision', 'id', 'position', 'radiusCss', 'rgba']);
      expect(marker.position.lngLat).to.deep.equal([-180, 0]);
      expect(packet!.acceptedSceneRevision).to.equal(h.accepted.acceptedSceneRevision);
    } finally { h.owner.close(); }
  });

  it('deeply freezes copied presentation arrays without retaining their mutable values', async () => {
    const h = await inputHarness([sceneMarker()]);
    try {
      const rgba: [number, number, number, number] = [0.1, 0.2, 0.3, 0.4];
      const rows = [{ id: 'target', rgba }];
      const packet = buildSceneRenderInput({ accepted: h.accepted, state: h.state, phase: 'resolved', presentationRevision: 3,
        presentation: { markers: rows, reducedMotion: true } });
      expect(packet?.markers.length).to.equal(1);
      rgba[0] = 1; rows[0]!.id = 'changed'; rows.push({ id: 'extra', rgba });
      expect(packet!.markers[0]!.rgba).to.deep.equal([0.1, 0.2, 0.3, 0.4]);
      expect(packet!.markers[0]!.id).to.equal('target');
      expect([packet, packet!.markers, packet!.markers[0], packet!.markers[0]!.rgba,
        packet!.markers[0]!.position, packet!.markers[0]!.position.lngLat].every(Object.isFrozen)).to.equal(true);
    } finally { h.owner.close(); }
  });

  it('multiplies alpha by authored opacity once while preserving unpremultiplied RGB', async () => {
    const h = await inputHarness([0, 0.5, 1].map((opacity, index) => ({ ...sceneMarker(`pin-${index}`), opacity })));
    try {
      const packet = buildSceneRenderInput({ accepted: h.accepted, state: h.state, phase: 'resolved', presentationRevision: 4,
        presentation: scenePresentation(h.accepted, 0.4) });
      expect(packet?.markers.map(marker => marker.rgba)).to.deep.equal([[0.2, 0.4, 0.6, 0], [0.2, 0.4, 0.6, 0.2], [0.2, 0.4, 0.6, 0.4]]);
    } finally { h.owner.close(); }
  });

  it('refuses a mismatched accepted and target revision without mutating either snapshot', async () => {
    const h = await inputHarness([sceneMarker()]);
    try {
      const before = h.owner.state.capture();
      const packet = buildSceneRenderInput({ accepted: h.accepted, state: { ...h.state, acceptedSceneRevision: h.accepted.acceptedSceneRevision + 1 },
        phase: 'resolved', presentationRevision: 5, presentation: scenePresentation(h.accepted) });
      expect(packet).to.equal(undefined);
      expect(h.owner.captureAccepted() === h.accepted && h.owner.state.capture() === before).to.equal(true);
    } finally { h.owner.close(); }
  });

  it('refuses missing duplicate and unknown presentation IDs instead of joining by array position', async () => {
    const h = await inputHarness([sceneMarker('A'), sceneMarker('B')]);
    try {
      const row = { id: 'A', rgba: [1, 0, 0, 1] as const };
      for (const markers of [[row], [row, row], [row, { ...row, id: 'unknown' }]]) {
        expect(buildSceneRenderInput({ accepted: h.accepted, state: h.state, phase: 'resolved', presentationRevision: 6,
          presentation: { markers, reducedMotion: false } })).to.equal(undefined);
      }
    } finally { h.owner.close(); }
  });

  it('refuses invalid RGBA and over-limit presentation before walking entries and accepts empty intent', async () => {
    const h = await inputHarness([sceneMarker()]);
    try {
      for (const value of [NaN, Infinity, -0.1, 1.1]) {
        const presentation: TestScenePresentation = { markers: [{ id: 'target', rgba: [value, 0, 0, 1] }], reducedMotion: false };
        expect(buildSceneRenderInput({ accepted: h.accepted, state: h.state, phase: 'resolved', presentationRevision: 7, presentation })).to.equal(undefined);
      }
      let descriptorProbes = 0, valueProbes = 0;
      const numeric = (key: PropertyKey) => typeof key === 'string' && /^(?:0|[1-9]\d*)$/.test(key);
      const markers = new Proxy(new Array<TestScenePresentation['markers'][number]>(2001), {
        getOwnPropertyDescriptor(target, key) { if (numeric(key)) descriptorProbes++; return Reflect.getOwnPropertyDescriptor(target, key); },
        get(target, key, receiver) { if (numeric(key)) valueProbes++; return Reflect.get(target, key, receiver); },
      });
      expect(buildSceneRenderInput({ accepted: h.accepted, state: h.state, phase: 'resolved', presentationRevision: 7,
        presentation: { markers, reducedMotion: false } })).to.equal(undefined);
      expect([descriptorProbes, valueProbes]).to.deep.equal([0, 0]);
      h.owner.assign({ objects: [] });
      const empty = buildSceneRenderInput({ accepted: h.owner.captureAccepted(), state: h.owner.state.capture(), phase: 'resolved', presentationRevision: 8 });
      expect(empty?.markers).to.deep.equal([]);
    } finally { h.owner.close(); }
  });

  it('copies exact present allocation and keeps absent allocation undefined', async () => {
    const h = await inputHarness([sceneMarker()]);
    try {
      const viewport = { ...sceneViewport(), allocationRevision: 9 };
      const packet = buildSceneRenderInput({ accepted: h.accepted, state: { ...h.state, viewport }, phase: 'resolved', presentationRevision: 9,
        presentation: scenePresentation(h.accepted) });
      expect(packet?.allocation).to.deep.equal({ revision: 9, width: 640, height: 480, pixelRatio: 1.25,
        padding: { top: 3, right: 5, bottom: 7, left: 11 } });
      expect(Object.isFrozen(packet!.allocation) && Object.isFrozen(packet!.allocation!.padding)).to.equal(true);
      const absent = buildSceneRenderInput({ accepted: h.accepted, state: h.state, phase: 'resolved', presentationRevision: 10,
        presentation: scenePresentation(h.accepted) });
      expect(absent?.allocation).to.equal(undefined);
      expect(absent?.markers.length).to.equal(1);
    } finally { h.owner.close(); }
  });

  it('builds current-revision zero-work pending and unavailable input without changing accepted intent', async () => {
    const h = await inputHarness([sceneMarker()]);
    try {
      const state = { ...h.state, viewport: { ...sceneViewport(), allocationRevision: 12 } };
      for (const phase of ['pending', 'unavailable'] as const) {
        const packet = buildSceneRenderInput({ accepted: h.accepted, state, phase, presentationRevision: 11 });
        expect(packet?.acceptedSceneRevision).to.equal(h.accepted.acceptedSceneRevision);
        expect(packet?.allocation?.revision).to.equal(12);
        expect(packet?.markers).to.deep.equal([]);
        expect(packet?.reducedMotion).to.equal(true);
        expect(h.owner.captureAccepted().objects.length).to.equal(1);
        expect(h.owner.captureView().status?.state).to.equal('loading');
      }
    } finally { h.owner.close(); }
  });
});
