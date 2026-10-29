import { expect } from '@open-wc/testing';
import { createMapSceneSessionFacade } from './map-scene-session.js';
import { sceneBackingHarness, sceneStateHarness, sceneTarget } from '../../test/map-scene-session-fixtures.js';

function setup() {
  const h = sceneStateHarness(), target = sceneTarget(); h.set([target]);
  const facade = createMapSceneSessionFacade({ connection: h.connection });
  facade.bindState(h.state);
  const backing = sceneBackingHarness(h);
  return { h, target, facade, a: facade.attachment, backing };
}

describe('map scene callback reentry isolation', () => {
  it('refuses recursive currency queries before invoking another backend callback', () => {
    const { target, facade, a, backing } = setup(); facade.promote(backing.backing);
    const frame = backing.frame(1); backing.emit(frame);
    let depth = 0, maximumDepth = 0;
    const nested: boolean[] = [];
    backing.hooks.current = () => {
      depth++; maximumDepth = Math.max(maximumDepth, depth);
      try { if (depth < 8) nested.push(a.current(frame, target)); }
      finally { depth--; }
    };
    try {
      expect(a.current(frame, target)).to.equal(true);
      expect(maximumDepth).to.equal(1); expect(backing.currentCalls).to.equal(1);
      expect(nested).to.deep.equal([false]);
    } finally { facade.close(); }
  });

  it('refuses recursive projection queries before invoking another backend callback', () => {
    const { facade, a, backing } = setup(); facade.promote(backing.backing);
    const frame = backing.frame(1); backing.emit(frame);
    let depth = 0, maximumDepth = 0;
    const nested: boolean[] = [];
    backing.hooks.project = () => {
      depth++; maximumDepth = Math.max(maximumDepth, depth);
      try { if (depth < 8) nested.push(a.projectTarget(frame, 'target') === undefined); }
      finally { depth--; }
    };
    try {
      expect(a.projectTarget(frame, 'target')?.status).to.equal('resolved');
      expect(maximumDepth).to.equal(1); expect(backing.projects).to.equal(1);
      expect(backing.currentCalls).to.equal(2);
      expect(nested).to.deep.equal([true]);
    } finally { facade.close(); }
  });

  it('preserves a newer promotion when the obsolete subscribe, watch or request callback throws', () => {
    for (const boundary of ['subscribe', 'watch', 'request'] as const) {
      const { h, facade, a, backing } = setup();
      const replacement = sceneBackingHarness(h);
      a.watchTarget('target'); if (boundary === 'request') a.requestFrame();
      backing.hooks[boundary] = () => {
        facade.promote(replacement.backing); throw new Error('Obsolete callback failed');
      };
      try {
        facade.promote(backing.backing);
        expect(replacement.subscriptions, boundary).to.equal(1);
        expect([...replacement.activeWatches.keys()], boundary).to.deep.equal(['target']);
        expect(backing.activeWatches.size, boundary).to.equal(0);
        expect(backing.releases, boundary).to.equal(1);
        expect(h.releases, boundary).to.equal(0);
        const frames: number[] = []; a.subscribeCompletedFrames(frame => frames.push(frame.stamp.paintFrameSerial));
        replacement.emit(replacement.frame(1)); expect(frames, boundary).to.deep.equal([1]);
        if (boundary === 'request') expect(replacement.requests).to.equal(1);
      } finally { facade.close(); }
    }
  });

  it('preserves a newer promotion when an obsolete acquisition returns no release handle', () => {
    for (const boundary of ['subscribeCompletedFrames', 'watchTarget'] as const) {
      const { h, facade, a, backing } = setup();
      const replacement = sceneBackingHarness(h); a.watchTarget('target');
      const obsolete = Object.freeze({ ...backing.backing,
        [boundary]: () => { facade.promote(replacement.backing); return undefined as unknown as () => void; },
      });
      try {
        facade.promote(obsolete);
        expect(replacement.subscriptions, boundary).to.equal(1);
        expect([...replacement.activeWatches.keys()], boundary).to.deep.equal(['target']);
        expect(h.releases, boundary).to.equal(0);
      } finally { facade.close(); }
    }
  });
});
