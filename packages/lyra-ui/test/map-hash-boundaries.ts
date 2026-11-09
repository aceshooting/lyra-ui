import { expect, fixtureCleanup } from '@open-wc/testing';
import { loadMapHashRuntime } from '../src/components/media/map/map-feature-loader.js';
import { installCameraPeerEnvironment, mountCameraPeerMap, reconnectCameraPeerMap } from './map-camera-peer.js';
import '../src/components/media/map/map.js';

/** Tests URL ownership across interrupted native camera reads, in a fresh history context per direction. */
export function mapHashBoundaryTests(direction: 'read' | 'write'): void {
  describe(`map hash ${direction} recovery`, () => {
    let restore: () => void;
    let originalUrl: string;
    let originalState: unknown;
    before(() => loadMapHashRuntime());
    beforeEach(() => {
      originalUrl = location.href; originalState = history.state;
      restore = installCameraPeerEnvironment();
    });
    afterEach(() => { fixtureCleanup(); restore(); history.replaceState(originalState, '', originalUrl); });
    for (const method of ['getCenter', 'getZoom', 'getBearing', 'getPitch'] as const) {
      for (const interruption of ['disconnect', 'disable', 'throw'] as const) {
        it(`preserves the URL when ${method} interrupts a hash ${direction} with ${interruption}`, async () => {
          const { element, peer } = await mountCameraPeerMap();
          element.hash = true; await element.updateComplete;
          const original = peer[method];
          const parent = element.parentElement!;
          let reads = 0, commands = 0;
          const jump = peer.jumpTo.bind(peer);
          peer.jumpTo = (...args) => { commands++; return jump(...args); };
          Reflect.set(peer, method, () => {
            reads++;
            if (interruption === 'disconnect') element.remove();
            else if (interruption === 'disable') element.hash = false;
            else throw new Error('Native camera unavailable');
            return Reflect.apply(original, peer, []);
          });
          history.replaceState({ section: 'retained' }, '', '#section&map=9/2/1');
          peer.zoom = 4;
          if (direction === 'read') window.dispatchEvent(new HashChangeEvent('hashchange'));
          else peer.fire('moveend');
          expect(reads).to.be.greaterThan(0);
          // An unreadable centre/zoom only prevents comparing the current view. A valid URL
          // camera can still be applied; losing ownership must always stop the native command.
          expect(commands).to.equal(direction === 'read' && interruption === 'throw' &&
            (method === 'getCenter' || method === 'getZoom') ? 1 : 0);
          expect(location.hash).to.equal('#section&map=9/2/1');
          expect(history.state).to.deep.equal({ section: 'retained' });
          Reflect.set(peer, method, original);
          if (interruption === 'disconnect') {
            const replacement = await reconnectCameraPeerMap(parent, element);
            expect(replacement === peer).to.equal(false);
            expect(peer.removed).to.equal(true);
            expect(replacement.zoom).to.equal(9);
          } else {
            if (interruption === 'disable') { element.hash = true; await element.updateComplete; }
            history.replaceState({ section: 'retained' }, '', '#section&map=7/5/6');
            window.dispatchEvent(new HashChangeEvent('hashchange'));
            expect(peer.zoom).to.equal(7);
            expect(peer.center).to.deep.equal([6, 5]);
            peer.zoom = 8; peer.fire('moveend');
            expect(location.hash).to.equal('#section&map=8/5/6');
            expect(history.state).to.deep.equal({ section: 'retained' });
          }
        });
      }
    }
  });
}
