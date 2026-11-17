import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { getWorkerUrl, setWorkerUrl } from '@aceshooting/lyra-map';
import { LyraMap, LYRA_MAP_EMPTY_STYLE } from './map.js';
void LyraMap;

function query(root: ParentNode, selector: string): HTMLElement {
  const found = root.querySelector<HTMLElement>(selector);
  if (!found) throw new Error(`Missing native map fixture ${selector}`);
  return found;
}
function closeRect(first: Element, second: Element): boolean {
  const a = first.getBoundingClientRect(), b = second.getBoundingClientRect();
  return [a.left - b.left, a.top - b.top, a.width - b.width, a.height - b.height].every(value => Math.abs(value) < 0.8);
}
async function mount(engine: 'modular' | 'maplibre') {
  const stage = await fixture<HTMLElement>(html`<section style="position:relative;width:600px;height:400px"></section>`);
  const element = document.createElement('lr-map') as LyraMap;
  element.style.cssText = 'position:absolute;left:90px;top:50px;width:480px;height:330px';
  element.engine = engine; element.mapStyle = LYRA_MAP_EMPTY_STYLE; element.initialization = 'eager';
  element.canvasTarget = stage; element.controls = { navigation: true, attribution: false };
  element.center = [6, 49]; element.zoom = 4;
  stage.append(element);
  await element.whenStyleReady(); await element.whenControlsReady(); await element.whenIdle();
  const container = query(element.shadowRoot!, '[part="container"]');
  await waitUntil(() => closeRect(container, stage));
  return { stage, element, container };
}

describe('canvas targets with native map engines', function () {
  this.timeout(45000);
  let previousWorkerUrl: string;
  before(function () { if (!document.createElement('canvas').getContext('webgl2')) this.skip(); });
  beforeEach(() => { previousWorkerUrl = getWorkerUrl(); setWorkerUrl(new URL('/__lyra-map-worker__/worker.mjs', location.origin).href); });
  afterEach(() => { fixtureCleanup(); setWorkerUrl(previousWorkerUrl); });

  for (const choice of ['modular', 'maplibre'] as const) {
    it(`${choice}: centers and fits geographic content inside the actual usable host`, async () => {
      const { element, container } = await mount(choice);
      element.cameraPadding = { left: 17, right: 11, top: 7, bottom: 13 };
      await element.updateComplete; await element.whenIdle();
      const center = element.project([6, 49]);
      expect(center?.[0]).to.be.closeTo((107 + 559) / 2, 0.8);
      expect(center?.[1]).to.be.closeTo((57 + 367) / 2, 0.8);
      expect(closeRect(query(element.shadowRoot!, '.maplibregl-control-container'), element)).to.equal(true);
      expect(element.fitBounds([[5, 48], [7, 50]], { padding: 20, animate: false })).to.equal(true);
      await element.whenIdle();
      for (const corner of [[5, 48], [5, 50], [7, 48], [7, 50]] as const) {
        const projected = element.project(corner);
        expect(projected === undefined).to.equal(false);
        expect(projected![0]).to.be.within(127 - 0.8, 539 + 0.8);
        expect(projected![1]).to.be.within(77 - 0.8, 347 + 0.8);
      }
      const padded = element.getVisibleBounds(), whole = element.getVisibleBounds({ padded: false });
      expect(padded === null || whole === null).to.equal(false);
      expect(padded![0][0]).to.be.greaterThan(whole![0][0]);
      expect(padded![1][0]).to.be.lessThan(whole![1][0]);
      expect(container.clientWidth).to.equal(600);
    });

    it(`${choice}: preserves the camera on live allocation changes and keeps scaled controls in the host`, async () => {
      const { stage, element, container } = await mount(choice);
      const map = element.map!; const before = map.getCenter(), zoom = map.getZoom();
      let changes = 0; element.addEventListener('lr-map-view-change', () => { changes++; });
      stage.style.width = '640px'; stage.style.transformOrigin = 'top left';
      stage.style.transform = 'translate(12px, 8px) scale(0.8)'; stage.style.containerType = 'inline-size';
      element.style.left = '110px';
      await waitUntil(() => closeRect(container, stage) && closeRect(query(element.shadowRoot!, '.maplibregl-control-container'), element));
      await element.whenIdle();
      expect(map.getCenter().lng).to.be.closeTo(before.lng, 1e-7);
      expect(map.getCenter().lat).to.be.closeTo(before.lat, 1e-7);
      expect(map.getZoom()).to.be.closeTo(zoom, 1e-7);
      expect(changes).to.equal(0);
      const point = element.project([before.lng, before.lat]);
      const canvas = container.getBoundingClientRect(), host = element.getBoundingClientRect();
      expect(canvas.left + point![0] * canvas.width / container.clientWidth).to.be.closeTo(host.left + host.width / 2, 0.8);
      expect(canvas.top + point![1] * canvas.height / container.clientHeight).to.be.closeTo(host.top + host.height / 2, 0.8);
    });

    it(`${choice}: recovers from collapsed author padding and a cleared target`, async () => {
      const { element, container } = await mount(choice);
      element.cameraPadding = { top: 200, bottom: 200 };
      await element.updateComplete;
      expect(element.getVisibleBounds()).to.equal(null);
      expect(element.getVisibleBounds({ padded: false }) === null).to.equal(false);
      expect(element.fitBounds([[5, 48], [7, 50]])).to.equal(false);
      element.cameraPadding = undefined; element.canvasTarget = undefined;
      await element.updateComplete; await waitUntil(() => closeRect(container, element));
      await element.whenIdle();
      expect(element.getVisibleBounds() === null).to.equal(false);
      expect(element.fitBounds([[5, 48], [7, 50]], { animate: false })).to.equal(true);
      await element.whenIdle();
    });
  }
});
