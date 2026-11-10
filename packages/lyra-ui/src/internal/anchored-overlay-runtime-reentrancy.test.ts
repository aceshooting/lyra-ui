import { expect, waitUntil } from '@open-wc/testing';
import {
  __setAnchoredOverlayRuntimeLoaderForTesting,
  deferredPlace,
  deferredPlaceReady,
  deferredPlaceSession,
  deferredTrackRect,
  type AnchoredOverlayRuntime,
  type DeferredPlacementSession,
} from './anchored-overlay-runtime.js';

afterEach(() => __setAnchoredOverlayRuntimeLoaderForTesting(undefined));

for (const [name, place] of [['lean', deferredPlace], ['ready', deferredPlaceReady]] as const) {
  it(`releases ${name} placement when its first callback disposes it during setup`, async () => {
    let starts = 0, stops = 0;
    __setAnchoredOverlayRuntimeLoaderForTesting(async () => ({
      place: (_anchor, _popup, options = {}) => {
        starts++;
        options.onPlaced?.({ placement: 'bottom' });
        return () => { stops++; };
      },
      trackRect: () => () => undefined,
    }));
    const popup = document.createElement('div');
    popup.style.visibility = 'visible';
    const dispose = place(document.createElement('button'), popup, { onPlaced: () => dispose() });
    try {
      await waitUntil(() => starts === 1, 'placement did not start');
      expect(stops, 'disposing during setup releases the returned subscription').to.equal(1);
      expect(popup.style.visibility).to.equal('visible');
      dispose();
      expect(stops, 'repeated disposal does not release twice').to.equal(1);
    } finally { dispose(); }
  });
}

it('releases rect tracking when the initial rect callback disposes it during setup', async () => {
  let starts = 0, stops = 0;
  __setAnchoredOverlayRuntimeLoaderForTesting(async () => ({
    place: () => () => undefined,
    trackRect: (_target, onUpdate) => {
      starts++;
      onUpdate(new DOMRect(10, 20, 30, 40));
      return () => { stops++; };
    },
  }));
  const dispose = deferredTrackRect(document.createElement('button'), () => dispose());
  try {
    await waitUntil(() => starts === 1, 'rect tracking did not start');
    expect(stops, 'disposing from the initial rect releases native observers').to.equal(1);
    dispose();
    expect(stops).to.equal(1);
  } finally { dispose(); }
});

it('releases rect tracking once when native cleanup reenters disposal', async () => {
  let starts = 0, stops = 0;
  __setAnchoredOverlayRuntimeLoaderForTesting(async () => ({
    place: () => () => undefined,
    trackRect: () => {
      starts++;
      return () => { if (++stops === 1) dispose(); };
    },
  }));
  const dispose = deferredTrackRect(document.createElement('button'), () => undefined);
  try {
    await waitUntil(() => starts === 1, 'rect tracking did not start');
    dispose();
    expect(stops).to.equal(1);
    dispose();
    expect(stops).to.equal(1);
  } finally { dispose(); }
});

for (const retained of [false, true]) {
  for (const resumeImmediately of [false, true]) {
    it(`refreshes ${retained ? 'retained' : 'legacy'} geometry invalidated during setup${resumeImmediately ? ' with immediate resume' : ''}`, async () => {
      let starts = 0, stops = 0, updates = 0, invalidations = 0, publications = 0;
      const callbacks: (() => void)[] = [];
      const start: NonNullable<AnchoredOverlayRuntime['placeSession']> = (_anchor, _popup, options = {}) => {
        starts++;
        const publish = () => options.onPlaced?.({ placement: 'bottom' });
        callbacks.push(publish);
        publish();
        return Object.assign(() => { stops++; }, {
          isActive: () => true,
          invalidate() { invalidations++; },
          update() { updates++; publish(); },
        });
      };
      __setAnchoredOverlayRuntimeLoaderForTesting(async () => ({
        place: start,
        ...(retained ? { placeSession: start } : {}),
        trackRect: () => () => undefined,
      }));
      const popup = document.createElement('div');
      popup.style.visibility = 'visible';
      const operation: DeferredPlacementSession = deferredPlaceSession(document.createElement('button'), popup, {
        onPlaced: () => {
          publications++;
          if (publications !== 1) return;
          operation.invalidate();
          if (resumeImmediately) operation.update();
        },
      });
      try {
        expect(await operation.ready).to.equal(true);
        if (!resumeImmediately) {
          callbacks[0]!();
          expect(publications, 'an invalidated session cannot publish before new geometry').to.equal(1);
          operation.update();
        }
        expect(starts).to.equal(retained ? 1 : 2);
        expect(stops).to.equal(retained ? 0 : 1);
        expect(invalidations).to.equal(retained ? 1 : 0);
        expect(updates).to.equal(retained ? 1 : 0);
        expect(publications).to.equal(2);
        expect(operation.isActive()).to.equal(true);
        expect(popup.style.visibility).to.equal('visible');
        operation();
        operation.invalidate(); operation.update();
        callbacks.at(-1)!();
        expect(stops).to.equal(retained ? 1 : 2);
        expect(publications, 'retired callbacks cannot publish').to.equal(2);
        expect(operation.isActive()).to.equal(false);
      } finally { operation(); }
    });
  }
}
