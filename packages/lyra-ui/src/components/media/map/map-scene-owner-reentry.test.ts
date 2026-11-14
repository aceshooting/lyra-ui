import { expect, fixture, html } from '@open-wc/testing';
import { sceneMarker } from '../../../../test/map-scene-admission-fixtures.js';
import { createMapSceneOwner } from './map-scene-owner.js';

/** An owner whose connection check can run caller code on a chosen call, as a host callback may. */
async function reentrantOwner() {
  const element = await fixture<HTMLElement>(html`<div></div>`);
  let calls = 0, reenterAt = 0, changes = 0;
  let reenter: (() => void) | undefined;
  const owner = createMapSceneOwner({ element, connection: Object.freeze({}), changed() { changes++; },
    isCurrentConnection: () => {
      if (++calls === reenterAt && reenter) { const callback = reenter; reenter = undefined; callback(); }
      return true;
    } });
  return { owner, get changes() { return changes; },
    arm(at: number, callback: () => void) { calls = 0; reenterAt = at; reenter = callback; },
    get armed() { return reenter !== undefined; } };
}

const ids = (owner: ReturnType<typeof createMapSceneOwner>) => owner.captureAccepted().objects.map(object => object.id);

describe('map scene owner connection-check reentry', () => {
  for (const at of [2, 3, 4, 5]) {
    it(`keeps the newer scene when connection check ${at} of an outer assignment accepts another scene`, async () => {
      const h = await reentrantOwner();
      try {
        h.owner.assign({ objects: [sceneMarker('initial')] });
        const before = h.owner.captureAccepted().acceptedSceneRevision;
        h.arm(at, () => { h.owner.assign({ objects: [sceneMarker('inner', 20)] }); });
        h.owner.assign({ objects: [sceneMarker('outer', 40)] });
        expect(h.armed, 'the reentrant assignment ran').to.equal(false);
        expect(ids(h.owner)).to.deep.equal(['inner']);
        expect(h.owner.captureAccepted().acceptedSceneRevision).to.equal(before + 1);
        expect(h.owner.captureView().status).to.deep.equal({ revision: before + 1, state: 'loading' });
        const lookup = h.owner.state.capture().targets.map(target => target.id);
        expect(lookup).to.deep.equal(['inner']);
      } finally { h.owner.close(); }
    });
  }

  for (const at of [2]) {
    it(`keeps the newer scene when connection check ${at} of a clear accepts another scene`, async () => {
      const h = await reentrantOwner();
      try {
        h.owner.assign({ objects: [sceneMarker('initial')] });
        h.arm(at, () => { h.owner.assign({ objects: [sceneMarker('inner', 20)] }); });
        h.owner.assign(undefined);
        expect(h.armed).to.equal(false);
        expect(ids(h.owner)).to.deep.equal(['inner']);
        expect(h.owner.captureView().active).to.equal(true);
        h.owner.assign(undefined);
        expect(ids(h.owner)).to.deep.equal([]);
        expect(h.owner.captureView().active, 'an uninterrupted clear deactivates the scene').to.equal(false);
        h.owner.assign({ objects: [{ ...sceneMarker('bad'), kind: 'sphere' }] });
        expect(h.owner.captureView().status?.state, 'invalid input after a clear is reported, not swallowed').to.equal('error');
        expect(h.owner.captureView().status?.code).to.equal('invalid');
      } finally { h.owner.close(); }
    });
  }

  it('bounds an observer that replaces the scene on every notice and stays usable afterwards', async () => {
    const h = await reentrantOwner();
    let notices = 0, replacing = true;
    const release = h.owner.subscribeAccepted(() => {
      notices++;
      if (replacing) h.owner.assign({ objects: [sceneMarker(`loop-${notices}`, notices % 180)] });
    });
    try {
      h.owner.assign({ objects: [sceneMarker('start')] });
      expect(notices).to.be.greaterThan(1000);
      expect(notices).to.be.at.most(6144);
      replacing = false;
      h.owner.assign({ objects: [sceneMarker('settled')] });
      expect(ids(h.owner)).to.deep.equal(['settled']);
    } finally { release(); h.owner.close(); }
  });
});
