import { expect, fixtureCleanup, nextFrame, waitUntil } from '@open-wc/testing';
import { platform } from '@floating-ui/dom';
import {
  addAnchor, base, captureCloses, content, hidden, mountMap, placed,
  restoreMapEnvironment, stubMapEnvironment,
} from '../../../../test/map-anchors.js';
import { __setAnchoredOverlayRuntimeLoaderForTesting } from '../../../internal/anchored-overlay-runtime.js';

describe('map anchor placement failure and recovery', () => {
  beforeEach(() => { stubMapEnvironment(); });
  afterEach(() => {
    fixtureCleanup();
    restoreMapEnvironment();
    __setAnchoredOverlayRuntimeLoaderForTesting(undefined);
  });

  for (const failure of ['import', 'setup'] as const) {
    it(`recovers from an initial positioning ${failure} failure without closing the anchor`, async () => {
      const runtime = await import('../../../internal/positioner.js');
      let imports = 0, attempts = 0, failed = false;
      __setAnchoredOverlayRuntimeLoaderForTesting(async () => {
        imports++;
        if (failure === 'import' && !failed) {
          failed = true;
          throw new Error('Positioning chunk unavailable');
        }
        return {
          place: runtime.placeAnchoredSurface,
          trackRect: runtime.trackRect,
          placeSession: (...args) => {
            attempts++;
            if (failure === 'setup' && !failed) {
              failed = true;
              throw new Error('Positioning setup unavailable');
            }
            return runtime.placeAnchoredSurfaceSession(...args);
          },
        };
      });
      const { map, engine } = await mountMap();
      const anchor = addAnchor(map, { closable: true }), events = captureCloses(anchor);
      await waitUntil(() => failed, 'first placement reaches the injected failure');
      await hidden(anchor);
      expect(anchor.open).to.equal(true);
      expect(anchor.matches(':state(placed)')).to.equal(false);
      expect(anchor.focusContent()).to.equal(false);
      expect(events.order).to.deep.equal([]);

      engine.pan(1);
      await placed(anchor);
      expect(imports).to.equal(failure === 'import' ? 2 : 1);
      expect(attempts).to.equal(failure === 'setup' ? 2 : 1);
      expect(anchor.focusContent()).to.equal(true);
      expect(anchor.close()).to.equal(true);
      expect(events.order).to.deep.equal(['request:api', 'close:api']);
    });
  }

  for (const dimension of ['width', 'height'] as const) {
    it(`hides a panel when its clipping ${dimension} reaches the placement padding and recovers after expansion`, async () => {
      const { map, wrapper } = await mountMap();
      const anchor = addAnchor(map, { closable: true }), events = captureCloses(anchor);
      await placed(anchor);
      const bounds = map.getBoundingClientRect(), boundary = document.createElement('div');
      boundary.style.cssText = `position:fixed;left:${bounds.left}px;top:${bounds.top}px;width:480px;height:320px;pointer-events:none`;
      boundary.style[dimension] = '16px';
      wrapper.append(boundary);
      anchor.boundary = boundary;
      await hidden(anchor);
      expect(anchor.open).to.equal(true);
      expect(anchor.matches(':state(placed)')).to.equal(false);
      expect(anchor.focusContent()).to.equal(false);
      expect(events.order).to.deep.equal([]);

      boundary.style[dimension] = dimension === 'width' ? '480px' : '320px';
      await placed(anchor);
      expect(anchor.open).to.equal(true);
      expect(events.order).to.deep.equal([]);
      await waitUntil(() => anchor.focusContent(), 'expanded boundary publishes focusable geometry');
    });
  }

  it('retains its request when individually usable boundaries have no intersection, then recovers when they overlap', async () => {
    const { map, engine, wrapper } = await mountMap();
    const anchor = addAnchor(map, { closable: true }), events = captureCloses(anchor);
    await placed(anchor);
    const bounds = map.getBoundingClientRect();
    const left = document.createElement('div'), right = document.createElement('div');
    left.style.cssText = `position:fixed;left:${bounds.left}px;top:${bounds.top}px;width:180px;height:320px;pointer-events:none`;
    right.style.cssText = `position:fixed;left:${bounds.left + 300}px;top:${bounds.top}px;width:180px;height:320px;pointer-events:none`;
    wrapper.append(left, right);
    anchor.boundary = [left, right];
    await hidden(anchor);
    expect(anchor.open).to.equal(true);
    expect(anchor.focusContent()).to.equal(false);
    expect(events.order).to.deep.equal([]);

    left.style.width = '480px';
    right.style.left = `${bounds.left}px`;
    right.style.width = '480px';
    engine.fire('move');
    await placed(anchor);
    expect(events.order).to.deep.equal([]);
    await waitUntil(() => anchor.focusContent(), 'overlapping boundaries publish focusable geometry');
  });

  it('discards a pending placement after its content is removed and places restored content', async () => {
    const { map, engine } = await mountMap();
    const anchor = addAnchor(map, { open: false }), events = captureCloses(anchor);
    await anchor.updateComplete;
    const panel = base(anchor), original = platform.getElementRects;
    let release!: () => void, entered = false;
    const pending = new Promise<void>(resolve => { release = resolve; });
    platform.getElementRects = async function (...args) {
      if (args[0].floating === panel) { entered = true; await pending; }
      return original.apply(this, args);
    };
    try {
      anchor.open = true;
      await waitUntil(() => entered, 'first placement is awaiting native geometry');
      anchor.replaceChildren();
      await hidden(anchor);
      release();
      await nextFrame();
      expect(anchor.open).to.equal(true);
      expect(anchor.matches(':state(placed)')).to.equal(false);
      expect(anchor.focusContent()).to.equal(false);
      expect(panel.hidden).to.equal(true);
      expect(events.order).to.deep.equal([]);

      platform.getElementRects = original;
      anchor.append(content('Restored action'));
      engine.fire('move');
      await placed(anchor);
      expect(anchor.querySelector('button')?.textContent).to.equal('Restored action');
      expect(anchor.focusContent()).to.equal(true);
      expect(events.order).to.deep.equal([]);
    } finally { release(); platform.getElementRects = original; }
  });
});
