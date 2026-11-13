import { expect, fixture, html } from '@open-wc/testing';
import { createMapSceneOwner } from './map-scene-owner.js';
import { sceneMarker } from '../../../../test/map-scene-admission-fixtures.js';
import { scenePresentation, sceneViewport } from '../../../../test/map-scene-render-fixtures.js';

async function setup() {
  const element = await fixture<HTMLElement>(html`<div></div>`);
  const state = { throws: false, changed: 0 };
  const owner = createMapSceneOwner({ element, connection: {},
    isCurrentConnection() { if (state.throws) throw new Error('Connection unavailable'); return true; },
    changed() { state.changed++; },
  });
  return { owner, state };
}
type Owner = ReturnType<typeof createMapSceneOwner>;
const subscriptions = [
  ['state', (owner: Owner, callback: () => void) => owner.state.subscribe(callback)],
  ['accepted', (owner: Owner, callback: () => void) => owner.subscribeAccepted(callback)],
  ['render', (owner: Owner, callback: () => void) => owner.subscribeRenderPublication(callback)],
] as const;

for (const [name, subscribe] of subscriptions) {
  it(`rejects an invalid ${name} subscriber without disturbing a valid subscription`, async () => {
    const { owner } = await setup(); let notices = 0;
    try {
      expect(() => subscribe(owner, null as unknown as () => void)).to.throw(TypeError);
      const release = subscribe(owner, () => { notices++; });
      owner.assign({ objects: [sceneMarker()] });
      expect(notices).to.equal(1);
      release();
    } finally { owner.close(); }
  });

  it(`returns an idempotent inert ${name} subscription after closure`, async () => {
    const { owner } = await setup(); let notices = 0;
    owner.assign({ objects: [sceneMarker()] });
    const before = owner.captureAccepted(); owner.close();
    const release = subscribe(owner, () => { notices++; });
    release(); release(); owner.assign({ objects: [sceneMarker('later')] });
    expect(notices).to.equal(0);
    expect(owner.captureAccepted() === before).to.equal(true);
  });

  it(`skips a ${name} observer removed by an earlier observer in the same notification`, async () => {
    const { owner } = await setup(); let later = 0, first = 0;
    let removeLater = (): void => {};
    try {
      const releaseFirst = subscribe(owner, () => { first++; removeLater(); });
      removeLater = subscribe(owner, () => { later++; });
      owner.assign({ objects: [sceneMarker()] });
      expect([first, later]).to.deep.equal([1, 0]);
      releaseFirst();
      const releaseFresh = subscribe(owner, () => { later++; });
      owner.assign({ objects: [sceneMarker('new')] });
      expect([first, later]).to.deep.equal([1, 1]);
      releaseFresh();
    } finally { owner.close(); }
  });

  it(`stops ${name} notification and downstream publications when a subscriber closes the owner`, async () => {
    const { owner, state } = await setup(); let first = 0, later = 0;
    subscribe(owner, () => { first++; owner.close(); });
    subscribe(owner, () => { later++; });
    owner.assign({ objects: [sceneMarker()] });
    expect([first, later, state.changed]).to.deep.equal([1, 0, 0]);
    expect(owner.captureAccepted().objects.map(object => object.id)).to.deep.equal(['target']);
    owner.assign(undefined);
    expect([first, later, state.changed]).to.deep.equal([1, 0, 0]);
  });
}

for (const operation of ['commit', 'fail', 'viewport', 'invalidate', 'paint serial'] as const) {
  it(`refuses ${operation} when connection validation throws and recovers without losing accepted intent`, async () => {
    const { owner, state } = await setup();
    try {
      owner.assign({ objects: [sceneMarker()] });
      if (operation === 'paint serial') {
        const pending = owner.captureRenderPublication();
        expect(owner.commitPresentation(pending, scenePresentation(pending.accepted))).to.equal(true);
      }
      const before = owner.captureRenderPublication();
      const run = (): boolean | number | undefined => {
        if (operation === 'commit') return owner.commitPresentation(before, scenePresentation(before.accepted));
        if (operation === 'fail') return owner.failPresentation(before);
        if (operation === 'viewport') return owner.setViewport(sceneViewport());
        if (operation === 'invalidate') return owner.invalidatePresentation();
        return owner.claimPaintFrameSerial(before);
      };
      state.throws = true;
      expect(run()).to.equal(operation === 'paint serial' ? undefined : false);
      expect(owner.captureRenderPublication() === before).to.equal(true);
      expect(owner.captureAccepted() === before.accepted).to.equal(true);
      state.throws = false;
      expect(run()).to.equal(operation === 'paint serial' ? 1 : true);
    } finally { owner.close(); }
  });
}

for (const [name, viewport] of [
  ['zero width', sceneViewport(0)], ['infinite height', sceneViewport(640, Infinity)],
  ['negative scale', sceneViewport(640, 480, -1)],
  ['negative padding', { ...sceneViewport(), padding: { top: -1, right: 0, bottom: 0, left: 0 } }],
] as const) {
  it(`rejects ${name} while preserving the previous allocation and accepted objects`, async () => {
    const { owner } = await setup();
    try {
      owner.assign({ objects: [sceneMarker()] });
      owner.setViewport(sceneViewport()); const before = owner.captureRenderPublication();
      expect(owner.setViewport(viewport)).to.equal(false);
      expect(owner.captureRenderPublication() === before).to.equal(true);
      expect(owner.setViewport(sceneViewport(800))).to.equal(true);
      expect(owner.captureRenderPublication().state.viewport?.width).to.equal(800);
      expect(owner.captureAccepted() === before.accepted).to.equal(true);
    } finally { owner.close(); }
  });
}

it('rejects resolved colors for another marker without consuming the pending publication', async () => {
  const { owner } = await setup();
  try {
    owner.assign({ objects: [sceneMarker()] }); const pending = owner.captureRenderPublication();
    expect(owner.commitPresentation(pending, { reducedMotion: false, markers: [{ id: 'other', rgba: [1, 0, 0, 1] }] })).to.equal(false);
    expect(owner.captureRenderPublication() === pending).to.equal(true);
    expect(owner.commitPresentation(pending, scenePresentation(pending.accepted))).to.equal(true);
    expect(owner.captureRenderPublication().input.markers.map(marker => marker.id)).to.deep.equal(['target']);
  } finally { owner.close(); }
});
