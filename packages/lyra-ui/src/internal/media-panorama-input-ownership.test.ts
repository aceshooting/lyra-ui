import { expect, fixture } from '@open-wc/testing';
import { LyraImageViewer } from '../components/media/image-viewer/image-viewer.js';
import { LyraVideo } from '../components/media/video/video.js';
import type { LyraPanoramaCamera, LyraPanoramaHotspot } from './media-panorama.js';
void LyraImageViewer;
void LyraVideo;

for (const tag of ['lr-image-viewer', 'lr-video'] as const) {
  for (const failure of [false, true]) {
    it(`keeps the latest ${tag} hotspots when an older input ${failure ? 'throws after' : 'completes after'} a replacement`, async () => {
      const element = await fixture<LyraImageViewer | LyraVideo>(document.createElement(tag));
      const latest: LyraPanoramaHotspot[] = [{ id: 'current', yaw: 0, pitch: 0.25, label: 'Current location' }];
      let replaced = false;
      const obsolete = new Proxy<LyraPanoramaHotspot[]>([{ id: 'obsolete', yaw: 1, pitch: 0 }], {
        getOwnPropertyDescriptor(target, key) {
          if (key === '0' && !replaced) {
            replaced = true;
            element.hotspots = latest;
            if (failure) throw new Error('Obsolete hotspot descriptor');
          }
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
      });

      element.hotspots = obsolete;
      await element.updateComplete;
      expect(replaced).to.equal(true);
      expect(element.hotspots).to.deep.equal(latest);
      expect(Object.isFrozen(element.hotspots)).to.equal(true);
      expect(element.hotspots === latest).to.equal(false);
      latest[0] = { id: 'mutated', yaw: 1, pitch: 1 };
      expect(element.hotspots.map(item => item.id)).to.deep.equal(['current']);
      const snapshot = element.hotspots;
      element.hotspots = snapshot;
      await element.updateComplete;
      expect(element.hotspots === snapshot).to.equal(true);
    });

    it(`keeps the latest ${tag} panorama camera when an older input ${failure ? 'throws after' : 'completes after'} a replacement`, async () => {
      const element = await fixture<LyraImageViewer | LyraVideo>(document.createElement(tag));
      const latest: LyraPanoramaCamera = { yaw: 0, pitch: 0.25, fieldOfView: 90 };
      let replaced = false;
      const obsolete = new Proxy<LyraPanoramaCamera>({ yaw: 1, pitch: -0.25, fieldOfView: 30 }, {
        getOwnPropertyDescriptor(target, key) {
          if (key === 'yaw' && !replaced) {
            replaced = true;
            element.panoramaCamera = latest;
            if (failure) throw new Error('Obsolete camera descriptor');
          }
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
      });

      element.panoramaCamera = obsolete;
      await element.updateComplete;
      expect(replaced).to.equal(true);
      expect(element.panoramaCamera).to.deep.equal(latest);
      expect(Object.isFrozen(element.panoramaCamera)).to.equal(true);
      expect(element.panoramaCamera === latest).to.equal(false);
      const snapshot = element.panoramaCamera;
      element.panoramaCamera = snapshot;
      await element.updateComplete;
      expect(element.panoramaCamera === snapshot).to.equal(true);
    });
  }
}
