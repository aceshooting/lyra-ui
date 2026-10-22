import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './image-viewer.js';
import type { LyraImageViewer } from './image-viewer.class.js';
import { capture, center, clickCenter, loseContext, matches, nativeCanvas, redrawPanorama, panoramaAtlas, requireWebgl2 } from '../../../../test/native-3d-ui.js';
import { resetMouse } from '../../../../test/wtr-mouse.js';

const home = { yaw: 0, pitch: 0, fieldOfView: 75 };
async function ready(el: LyraImageViewer): Promise<HTMLCanvasElement> {
  await waitUntil(() => el.shadowRoot!.querySelector('[part="panorama"][data-ready]') !== null, 'Panorama UI did not become ready', { timeout: 15000 });
  return nativeCanvas(el, 'panorama-engine');
}

describe('lr-image-viewer actual panorama companion integration', function () {
  this.timeout(30000);
  before(requireWebgl2);
  afterEach(resetMouse);

  it('N04 renders native image orientations and maps trusted hotspot picks', async () => {
    const el = await fixture<LyraImageViewer>(html`<lr-image-viewer style="inline-size:480px;block-size:320px" src=${panoramaAtlas()}></lr-image-viewer>`);
    await waitUntil(() => el.shadowRoot!.querySelector<HTMLImageElement>('[part="image"]')?.complete === true);
    const image = el.shadowRoot!.querySelector<HTMLImageElement>('[part="image"]')!;
    expect(el.shadowRoot!.querySelectorAll('[part="panorama-engine"] canvas').length).to.equal(0);
    el.engine = 'webgl'; el.projection = 'equirectangular'; const canvas = await ready(el);
    for (const [yaw, pitch, color] of [[0, 0, [0, 0, 255]], [Math.PI / 2, 0, [0, 255, 255]], [-Math.PI / 2, 0, [0, 255, 0]], [0, Math.PI / 3, [255, 255, 0]], [0, -Math.PI / 3, [255, 0, 255]]] as const) {
      const pixels = await capture(el, canvas, () => { el.panoramaCamera = { ...home, yaw, pitch }; redrawPanorama(el); });
      expect(matches(center(canvas, pixels), color)).to.equal(true);
    }
    el.panoramaCamera = home; el.hotspots = [{ id: 'door', yaw: 0, pitch: 0, label: 'Door' }]; await el.updateComplete;
    const pickedCanvas = await ready(el);
    const selected = oneEvent(el, 'lr-panorama-hotspot-select'); await clickCenter(pickedCanvas);
    const detail = (await selected).detail;
    expect(detail.id).to.equal('door'); expect(detail.index).to.equal(0);
    expect(el.shadowRoot!.querySelector('[part="image"]') === image).to.equal(true);
  });

  it('N05 restores actual texture and authored camera after native context loss', async () => {
    const el = await fixture<LyraImageViewer>(html`<lr-image-viewer style="inline-size:480px;block-size:320px" src=${panoramaAtlas()} engine="webgl" projection="equirectangular"></lr-image-viewer>`);
    const canvas = await ready(el); const image = el.shadowRoot!.querySelector('[part="image"]');
    const restore = await loseContext(el, canvas);
    let cameraEvents = 0; el.addEventListener('lr-panorama-camera-change', () => { cameraEvents++; });
    el.panoramaCamera = { ...home, yaw: Math.PI / 2 }; await el.updateComplete;
    await restore(); await ready(el);
    const pixels = await capture(el, canvas, () => redrawPanorama(el));
    expect(matches(center(canvas, pixels), [0, 255, 255])).to.equal(true);
    expect(cameraEvents).to.equal(0); expect(el.shadowRoot!.querySelector('[part="image"]') === image).to.equal(true);
  });

  it('N06 retires the previous source image and preserves the current image across explicit flat anchor reveal', async () => {
    const el = await fixture<LyraImageViewer>(html`<lr-image-viewer style="inline-size:480px;block-size:320px" src=${panoramaAtlas()} engine="webgl" projection="equirectangular"></lr-image-viewer>`);
    const initial = await ready(el); const image = el.shadowRoot!.querySelector<HTMLImageElement>('[part="image"]')!;
    // Looking backward samples the authored base color, outside the three cardinal patches.
    const before = center(initial, await capture(el, initial, () => { el.panoramaCamera = { ...home, yaw: Math.PI }; redrawPanorama(el); }));
    expect(matches(before, [255, 0, 0])).to.equal(true);
    const loaded = oneEvent(el, 'lr-load'); const replacement = panoramaAtlas('#ffffff'); el.src = replacement;
    const load = await loaded;
    expect(load.detail.naturalWidth).to.equal(1024); expect(load.detail.naturalHeight).to.equal(512);
    const currentImage = el.shadowRoot!.querySelector<HTMLImageElement>('[part="image"]')!;
    expect(currentImage !== image).to.equal(true); expect(image.isConnected).to.equal(false);
    expect(currentImage.src).to.equal(replacement);
    expect(currentImage.complete && currentImage.naturalWidth === 1024).to.equal(true);
    const canvas = await ready(el);
    const after = center(canvas, await capture(el, canvas, () => { el.panoramaCamera = { ...home, yaw: Math.PI }; redrawPanorama(el); }));
    expect(matches(after, [255, 255, 255])).to.equal(true); expect(matches(before, after)).to.equal(false);
    let staleLoads = 0, staleErrors = 0;
    el.addEventListener('lr-load', () => { staleLoads++; });
    el.addEventListener('lr-render-error', () => { staleErrors++; });
    image.dispatchEvent(new Event('load')); image.dispatchEvent(new Event('error')); await el.updateComplete;
    expect(staleLoads).to.equal(0); expect(staleErrors).to.equal(0);
    expect(el.shadowRoot!.querySelector('[part="image"]') === currentImage).to.equal(true);
    expect(canvas.isConnected).to.equal(true);
    expect(matches(center(canvas, await capture(el, canvas, () => redrawPanorama(el))), [255, 255, 255])).to.equal(true);
    const region = { kind: 'region' as const, rect: { x: 10, y: 10, width: 40, height: 40 } };
    el.anchor = region; await el.updateComplete; expect(el.projection).to.equal('equirectangular');
    const revealed = el.scrollToAnchor(region); expect(el.projection).to.equal('flat'); await revealed;
    expect(el.shadowRoot!.querySelector('[part="image"]') === currentImage).to.equal(true);
    expect(canvas.isConnected).to.equal(false);
  });
});
