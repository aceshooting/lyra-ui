import { PanoramaController as SharedPanoramaController, panoramaLoader as sharedPanoramaLoader } from '../../../internal/media-panorama.js';
import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './image-viewer.js';
import type { LyraImageViewer } from './image-viewer.class.js';
import type { Engine3dHost, Engine3dInstance } from '../../../internal/engine-3d-loader.js';
import { PanoramaController, normalizePanoramaCamera, PANORAMA_DEFAULT_CAMERA, panoramaLoader, panoramaEnvironment } from './image-viewer-panorama.js';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

describe('lr-image-viewer panorama', () => {
  it('preserves panorama identity through compatibility entry points', () => {
    expect(PanoramaController).to.equal(SharedPanoramaController);
    expect(panoramaLoader).to.equal(sharedPanoramaLoader);
  });

  const available = panoramaEnvironment.available;
  let creates: number, disposed: number;
  let source: unknown, camera: unknown, style: unknown;
  let focusedHotspots: (number | undefined)[];
  let host: Engine3dHost;
  let finish: (() => void) | undefined;
  let pending: boolean;
  let rejectData: boolean;
  beforeEach(() => {
    creates = disposed = 0; source = camera = style = undefined; pending = rejectData = false; finish = undefined;
    focusedHotspots = [];
    panoramaEnvironment.available = () => true;
    panoramaLoader.override(async () => ({ createEngine: (): Engine3dInstance => {
      creates++;
      return { contract: 1, async mount(_container, callbacks) { host = callbacks; if (pending) await new Promise<void>(resolve => { finish = resolve; }); },
        setData(data) { if (rejectData) throw new Error('unusable texture'); source = (data as { source: { image: HTMLImageElement } }).source.image; },
        setCamera(value) { camera = value; }, setStyle(value) { style = value; },
        setState(value) { focusedHotspots.push((value as { focus?: number }).focus); }, resize() {}, dispose() { disposed++; } };
    } }));
  });
  afterEach(() => { panoramaEnvironment.available = available; panoramaLoader.override(undefined); });

  it('defaults non-object camera values without coercing them', () => {
    for (const value of [undefined, null, false, 1, 'camera', Symbol('camera')]) {
      expect(normalizePanoramaCamera(value)).to.deep.equal(PANORAMA_DEFAULT_CAMERA);
    }
    let reads = 0;
    expect(normalizePanoramaCamera({ get yaw() { reads++; return 1; }, pitch: 0.5, fieldOfView: 60 }))
      .to.deep.equal({ yaw: 0, pitch: 0.5, fieldOfView: 60 });
    expect(reads).to.equal(0);
  });

  it('keeps the unset flat image and empty hotspots free of optional downloads', async () => {
    const el = await fixture<LyraImageViewer>(html`<lr-image-viewer src=${PNG}></lr-image-viewer>`);
    await waitUntil(() => el.shadowRoot!.querySelector<HTMLImageElement>('img')?.complete === true);
    expect(el.engine).to.equal('builtin'); expect(el.projection).to.equal('flat'); expect(el.hotspots.length).to.equal(0);
    expect(creates).to.equal(0);
    el.engine = 'webgl'; await el.updateComplete;
    expect(creates).to.equal(0);
  });

  it('uses the existing loaded image, preserves it across live switches, and maps hotspot identities', async () => {
    const el = await fixture<LyraImageViewer>(html`<lr-image-viewer src=${PNG} .hotspots=${[{ id: 'door', yaw: 1, pitch: 0, label: 'Door' }]}></lr-image-viewer>`);
    const image = el.shadowRoot!.querySelector<HTMLImageElement>('[part="image"]')!;
    el.engine = 'webgl'; el.projection = 'equirectangular';
    await waitUntil(() => source === image);
    await waitUntil(() => el.shadowRoot!.querySelector('[part="panorama"]')?.hasAttribute('data-ready') === true, 'renderer readiness reaches the DOM');
    expect(el.shadowRoot!.querySelector('[part="frame"]')?.hasAttribute('hidden')).to.equal(true);
    const selected = oneEvent(el, 'lr-panorama-hotspot-select');
    host.pick(0, { shift: false, ctrl: false, double: false });
    expect((await selected).detail).to.deep.equal({ hotspot: { id: 'door', yaw: 1, pitch: 0, label: 'Door' }, id: 'door', index: 0 });
    el.engine = 'webgl'; el.src = el.src; await el.updateComplete; expect(disposed).to.equal(0);
    el.projection = 'flat'; await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="image"]') === image).to.equal(true);
    expect(disposed).to.equal(1);
  });

  it('supports RTL look-around and zoom keys with localized instructions', async () => {
    const el = await fixture<LyraImageViewer>(html`<lr-image-viewer src=${PNG} engine="webgl" projection="equirectangular" dir="rtl" .strings=${{ panoramaInstructions: 'Look with arrows' }}></lr-image-viewer>`);
    await waitUntil(() => source !== undefined);
    const viewport = el.shadowRoot!.querySelector<HTMLElement>('[part="panorama"]')!;
    expect(viewport.getAttribute('aria-description')).to.equal('Look with arrows');
    await focusByKeyboard(viewport);
    const changed = oneEvent(el, 'lr-panorama-camera-change');
    await sendKeys({ press: 'ArrowLeft' });
    expect((await changed).detail.camera.yaw).to.be.greaterThan(0);
    await sendKeys({ press: 'Shift+Equal' });
    expect((camera as { fieldOfView: number }).fieldOfView).to.be.lessThan(75);
  });

  it('pans vertically, zooms out, and restores the default camera from keyboard focus', async () => {
    const el = await fixture<LyraImageViewer>(html`<lr-image-viewer src=${PNG} engine="webgl" projection="equirectangular"
      .panoramaCamera=${{ yaw: 1, pitch: 0.2, fieldOfView: 60 }}></lr-image-viewer>`);
    await waitUntil(() => el.shadowRoot!.querySelector('[part="panorama"]')?.hasAttribute('data-ready') === true);
    const viewport = el.shadowRoot!.querySelector<HTMLElement>('[part="panorama"]')!;
    await focusByKeyboard(viewport);
    const changes: unknown[] = [];
    el.addEventListener('lr-panorama-camera-change', event => changes.push(event.detail.camera));
    await sendKeys({ press: 'ArrowUp' });
    expect((camera as { pitch: number }).pitch).to.be.closeTo(0.2 + Math.PI / 18, 1e-10);
    await sendKeys({ press: 'ArrowDown' });
    expect((camera as { pitch: number }).pitch).to.be.closeTo(0.2, 1e-10);
    await sendKeys({ press: 'Minus' });
    expect((camera as { fieldOfView: number }).fieldOfView).to.equal(65);
    await sendKeys({ press: 'Shift+Minus' });
    expect((camera as { fieldOfView: number }).fieldOfView).to.equal(70);
    await sendKeys({ press: 'Home' });
    expect(camera).to.deep.equal(PANORAMA_DEFAULT_CAMERA);
    expect(changes).to.have.lengthOf(5);
    expect(changes.at(-1)).to.deep.equal(PANORAMA_DEFAULT_CAMERA);
    expect(el.shadowRoot!.activeElement === viewport).to.equal(true);
  });

  it('leaves keys from a focused peer control unconsumed and does not move the panorama', async () => {
    const el = await fixture<LyraImageViewer>(html`<lr-image-viewer src=${PNG} engine="webgl" projection="equirectangular"></lr-image-viewer>`);
    await waitUntil(() => el.shadowRoot!.querySelector('[part="panorama"]')?.hasAttribute('data-ready') === true);
    const viewport = el.shadowRoot!.querySelector<HTMLElement>('[part="panorama"]')!;
    const button = document.createElement('button'); button.textContent = 'Peer control';
    viewport.querySelector('[part="panorama-engine"]')!.append(button);
    await focusByKeyboard(button);
    let changes = 0, prevented: boolean | undefined;
    el.addEventListener('lr-panorama-camera-change', () => { changes++; });
    viewport.addEventListener('keydown', event => { prevented = event.defaultPrevented; });
    await sendKeys({ press: 'ArrowUp' });
    expect(prevented).to.equal(false); expect(changes).to.equal(0);
    expect(camera).to.deep.equal(PANORAMA_DEFAULT_CAMERA);
    expect(el.shadowRoot!.activeElement === button).to.equal(true);
  });

  it('rejects invalid peer hotspot indices while retaining valid hotspot identity', async () => {
    const hotspots = [{ id: 'first', yaw: 0, pitch: 0 }, { id: 'second', yaw: 1, pitch: 0.2, label: 'Second' }];
    const el = await fixture<LyraImageViewer>(html`<lr-image-viewer src=${PNG} engine="webgl" projection="equirectangular" .hotspots=${hotspots}></lr-image-viewer>`);
    await waitUntil(() => el.shadowRoot!.querySelector('[part="panorama"]')?.hasAttribute('data-ready') === true);
    const selections: unknown[] = [];
    el.addEventListener('lr-panorama-hotspot-select', event => selections.push(event.detail));
    for (const index of [null, -1, 0.5, NaN, Infinity, 2]) host.pick(index, { shift: false, ctrl: false, double: false });
    expect(selections).to.deep.equal([]);
    host.pick(1, { shift: false, ctrl: false, double: false });
    await waitUntil(() => el.shadowRoot!.querySelector('[data-panorama-index="1"]')?.getAttribute('tabindex') === '0',
      'the selected hotspot becomes the text alternative tab stop');
    expect(selections).to.deep.equal([{ hotspot: hotspots[1], id: 'second', index: 1 }]);
    expect(el.shadowRoot!.querySelector('[data-panorama-index="1"]')?.getAttribute('tabindex')).to.equal('0');
    expect(disposed).to.equal(0);
  });

  it('falls back visibly and ignores callbacks after a pending mount is superseded', async () => {
    pending = true;
    const el = await fixture<LyraImageViewer>(html`<lr-image-viewer src=${PNG} engine="webgl" projection="equirectangular"></lr-image-viewer>`);
    await waitUntil(() => finish !== undefined);
    let picks = 0; el.addEventListener('lr-panorama-hotspot-select', () => { picks++; });
    el.projection = 'flat'; await el.updateComplete;
    finish!(); await Promise.resolve(); await Promise.resolve();
    host.pick(0, { shift: false, ctrl: false, double: false });
    expect(source).to.equal(undefined); expect(picks).to.equal(0);
    panoramaEnvironment.available = () => false;
    const fallback = oneEvent(el, 'lr-engine-fallback');
    el.projection = 'equirectangular';
    expect((await fallback).detail.reason).to.equal('unsupported');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="panorama-notice"]') !== null, 'fallback notice rendered').to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="panorama-notice"]')!.textContent).to.contain('This browser');
    expect(el.shadowRoot!.querySelector('[part="panorama-notice"]')?.getAttribute('role')).to.equal(null);
  });
  it('keeps passive anchors in panorama and switches to flat for an explicit region reveal', async () => {
    const el = await fixture<LyraImageViewer>(html`<lr-image-viewer style="inline-size: 320px; block-size: 240px" src=${PNG} engine="webgl" projection="equirectangular"></lr-image-viewer>`);
    await waitUntil(() => source !== undefined);
    const image = el.shadowRoot!.querySelector('[part="image"]');
    const region = { kind: 'region' as const, rect: { x: 10, y: 10, width: 40, height: 40 } };
    el.anchor = region;
    await el.updateComplete;
    expect(el.projection).to.equal('equirectangular');
    const revealed = el.scrollToAnchor(region);
    expect(el.projection).to.equal('flat');
    await revealed;
    expect(el.shadowRoot!.querySelector('[part="image"]') === image).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="frame"]')?.hasAttribute('hidden')).to.equal(false);
  });

  for (const direction of ['ltr', 'rtl'] as const) {
    for (const engine of ['builtin', 'webgl'] as const) {
      it(`navigates and activates paged panorama hotspots in ${direction} with the ${engine} renderer`, async () => {
        const hotspots = Array.from({ length: 205 }, (_, index) => ({ id: `spot-${index}`, yaw: index / 100, pitch: 0 }));
        const el = await fixture<LyraImageViewer>(html`
          <lr-image-viewer src=${PNG} .engine=${engine} projection="equirectangular" dir=${direction}
            .hotspots=${hotspots}></lr-image-viewer>
        `);
        if (engine === 'webgl') await waitUntil(() => el.shadowRoot!.querySelector('[part="panorama"]')?.hasAttribute('data-ready') === true);
        await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="panorama-hotspot"]').length === 200);
        await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>('[data-panorama-index="0"]')!);
        const forward = direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
        const backward = direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
        for (const [key, index] of [
          [backward, 0], ['ArrowUp', 0], [forward, 1], ['ArrowDown', 2], [backward, 1], ['ArrowUp', 0],
          ['End', 204], [forward, 204], ['ArrowDown', 204], [backward, 203], ['Home', 0], ['End', 204],
        ] as const) {
          await sendKeys({ press: key });
          await waitUntil(() => el.shadowRoot!.activeElement?.getAttribute('data-panorama-index') === String(index),
            `${key} focuses hotspot ${index}`);
          expect(el.shadowRoot!.querySelectorAll('[part="panorama-hotspot"][tabindex="0"]').length).to.equal(1);
          expect(el.shadowRoot!.querySelector('[part="panorama-hotspot"][tabindex="0"]')?.getAttribute('data-panorama-index')).to.equal(String(index));
          if (engine === 'webgl') expect(focusedHotspots.at(-1)).to.equal(index);
        }
        expect(el.shadowRoot!.querySelectorAll('[part="panorama-hotspot"]').length).to.equal(5);
        let prevented: boolean | undefined;
        el.addEventListener('keydown', event => { prevented = event.defaultPrevented; }, { once: true });
        await sendKeys({ press: 'a' });
        expect(prevented).to.equal(false);
        expect(el.shadowRoot!.activeElement?.getAttribute('data-panorama-index')).to.equal('204');
        const selected = oneEvent(el, 'lr-panorama-hotspot-select');
        await sendKeys({ press: 'Space' });
        expect((await selected).detail).to.deep.equal({ hotspot: el.hotspots[204], id: 'spot-204', index: 204 });
        expect(creates).to.equal(engine === 'webgl' ? 1 : 0);
        expect(el.panoramaCamera).to.deep.equal(PANORAMA_DEFAULT_CAMERA);
      });
    }
  }

  it('keeps every admitted hotspot reachable through bounded text pages and omits invalid duplicate IDs', async () => {
    const hotspots = Array.from({ length: 205 }, (_, index) => ({ id: `spot-${index}`, yaw: index / 100, pitch: 0 }));
    const el = await fixture<LyraImageViewer>(html`<lr-image-viewer src=${PNG} projection="equirectangular" .hotspots=${[...hotspots, { id: 'spot-0', yaw: 2, pitch: 1 }, { id: '', yaw: 0, pitch: 0 }, { id: 'bad', yaw: NaN, pitch: 0 }]}></lr-image-viewer>`);
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="panorama-hotspot"]').length === 200, 'hotspot snapshot reaches the text alternative');
    expect(el.hotspots.length).to.equal(205);
    expect(el.shadowRoot!.querySelectorAll('[part="panorama-hotspot"]').length).to.equal(200);
    await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>('[data-panorama-index="0"]')!);
    await sendKeys({ press: 'End' });
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement?.getAttribute('data-panorama-index')).to.equal('204');
    const selected = oneEvent(el, 'lr-panorama-hotspot-select');
    await sendKeys({ press: 'Enter' });
    expect((await selected).detail.id).to.equal('spot-204');
    expect(creates).to.equal(0);
    await expect(el).to.be.accessible();
  });

  it('replays authored camera changes after context restoration without emitting authored changes', async () => {
    const el = await fixture<LyraImageViewer>(html`<lr-image-viewer src=${PNG} engine="webgl" projection="equirectangular"></lr-image-viewer>`);
    await waitUntil(() => source !== undefined);
    host.lost('context-lost'); await el.updateComplete;
    let changes = 0; el.addEventListener('lr-panorama-camera-change', () => { changes++; });
    el.panoramaCamera = { yaw: 1, pitch: 0.2, fieldOfView: 40 };
    el.style.setProperty('--lr-color-brand', 'rgb(1, 2, 3)');
    await el.updateComplete;
    host.restored!(); await el.updateComplete;
    expect(camera).to.deep.equal(el.panoramaCamera);
    expect(changes).to.equal(0);
    expect((style as { accent: string }).accent).to.equal('rgba(1, 2, 3, 1)');
  });

  it('keeps the native image on texture rejection and does not expose raw failure details', async () => {
    rejectData = true;
    const el = await fixture<LyraImageViewer>(html`<lr-image-viewer src=${PNG}></lr-image-viewer>`);
    const image = el.shadowRoot!.querySelector('[part="image"]');
    const fallback = oneEvent(el, 'lr-engine-fallback');
    el.engine = 'webgl'; el.projection = 'equirectangular';
    expect((await fallback).detail.reason).to.equal('error');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="image"]') === image).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="frame"]')?.hasAttribute('hidden')).to.equal(false);
    expect(el.shadowRoot!.querySelector('[part="panorama-notice"]') !== null, 'fallback notice rendered').to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="panorama-notice"]')!.textContent).not.to.contain('unusable texture');
    expect(disposed).to.equal(1);
  });

  it('renders the flat fallback when the panorama companion is missing', async () => {
    expectDevWarning('lyra-3d-panorama-unavailable');
    panoramaLoader.override(async () => { throw new Error('unavailable'); });
    const el = await fixture<LyraImageViewer>(html`<lr-image-viewer src=${PNG}></lr-image-viewer>`);
    const fallback = oneEvent(el, 'lr-engine-fallback');
    el.engine = 'webgl'; el.projection = 'equirectangular';
    expect((await fallback).detail.reason).to.equal('unavailable');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="frame"]')?.hasAttribute('hidden')).to.equal(false);
  });

  for (const fence of ['aria-hidden', 'inert', 'visibility'] as const) {
    it(`starts after ${fence} is removed without another native intersection change`, async () => {
      const OriginalIntersectionObserver = window.IntersectionObserver;
      let element: Element | undefined;
      const intersected = new Set<Element>();
      window.IntersectionObserver = class extends OriginalIntersectionObserver {
        constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
          super((entries, observer) => {
            callback(entries, observer);
            for (const entry of entries) {
              const root = entry.target.getRootNode();
              if (entry.isIntersecting && root instanceof ShadowRoot) intersected.add(root.host);
            }
          }, options);
        }
      };
      let wrapper: HTMLDivElement | undefined;
      try {
        wrapper = await fixture<HTMLDivElement>(html`<div aria-hidden=${fence === 'aria-hidden' ? 'true' : 'false'} ?inert=${fence === 'inert'}
          style=${fence === 'visibility' ? 'visibility:hidden' : ''}><lr-image-viewer engine="webgl" src=${PNG} projection="equirectangular"></lr-image-viewer></div>`);
        element = wrapper.firstElementChild!;
        await waitUntil(() => element !== undefined && intersected.has(element), 'real native IO must report the hidden semantic branch intersecting');
        expect(creates).to.equal(0);
        const box = element.getBoundingClientRect();
        wrapper.removeAttribute('aria-hidden'); wrapper.inert = false; wrapper.style.visibility = 'visible';
        const after = element.getBoundingClientRect();
        expect([after.x, after.y, after.width, after.height]).to.deep.equal([box.x, box.y, box.width, box.height]);
        await waitUntil(() => element!.shadowRoot!.querySelectorAll('[part="panorama"][data-ready]').length > 0, 'eligible unchanged geometry must admit renderer');
        expect(creates).to.equal(1);
        const internals = element as unknown as { panorama: { eligibility?: MutationObserver } };
        expect(internals.panorama.eligibility === undefined).to.equal(true);
      } finally {
        wrapper?.remove();
        window.IntersectionObserver = OriginalIntersectionObserver;
      }
    });
  }

  for (const phase of ['style', 'data', 'camera', 'resize', 'restored-style', 'restored-camera', 'restored-state'] as const) {
    it(`stops peer work and resource setup after synchronous terminal loss during ${phase}`, async () => {
      const element = await fixture<HTMLDivElement>(html`<div style="width:320px;height:180px"></div>`);
      const image = document.createElement('img');
      const container = document.createElement('div');
      container.style.cssText = 'width:320px;height:180px'; element.append(container);
      const calls: string[] = [];
      let callbacks: Engine3dHost | undefined;
      let armed = !phase.startsWith('restored-');
      let failures = 0;
      let changes = 0;
      let disposedHere = 0;
      const peerCall = (name: string): void => {
        calls.push(name);
        if (armed && name === phase.replace('restored-', '')) { armed = false; callbacks!.lost('error'); }
      };
      panoramaLoader.override(async () => ({ createEngine: (): Engine3dInstance => ({
        contract: 1, async mount(_target, next) { callbacks = next; },
        setStyle() { peerCall('style'); }, setData() { peerCall('data'); },
        setCamera() { peerCall('camera'); }, setState() { peerCall('state'); },
        resize() { peerCall('resize'); }, dispose() { disposedHere += 1; },
      }) }));
      const controller = new PanoramaController(element, {
        changed: () => { changes += 1; }, updated: async () => {}, localize: key => key,
        direction: () => 'ltr', camera: () => {}, pick: () => {}, fallback: () => { failures += 1; },
      });
      try {
        controller.update(true, image, 1, [], PANORAMA_DEFAULT_CAMERA, container);
        if (phase.startsWith('restored-')) {
          await waitUntil(() => controller.ready);
          callbacks!.lost('context-lost');
          armed = true; calls.length = 0;
          callbacks!.restored!();
        }
        await waitUntil(() => failures === (phase.startsWith('restored-') ? 2 : 1));
        expect(calls[calls.length - 1]).to.equal(phase.replace('restored-', ''));
        expect(controller.ready).to.equal(false);
        expect(controller.loading).to.equal(false);
        expect(disposedHere).to.equal(1);
        const before = changes;
        // Terminal ownership must not retain post-loss peer observers or permit restoration.
        callbacks!.restored!();
        element.style.color = 'rgb(1, 2, 3)';
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        expect(changes).to.equal(before);
        expect(calls[calls.length - 1]).to.equal(phase.replace('restored-', ''));
        const internals = controller as unknown as { resize?: ResizeObserver; theme?: MutationObserver; cleanups: unknown[] };
        expect(internals.resize === undefined).to.equal(true);
        expect(internals.theme === undefined).to.equal(true);
        expect(internals.cleanups.length).to.equal(0);
      } finally { controller.disconnect(); element.remove(); }
    });
  }

  it('does not let a throwing retired camera command fail its replacement initialization', async () => {
    const element = await fixture<HTMLDivElement>(html`<div style="width:320px;height:180px"></div>`);
    const image = document.createElement('img');
    const container = document.createElement('div');
    container.style.cssText = 'width:320px;height:180px'; element.append(container);
    const hotspots: [] = [];
    let callbacks: Engine3dHost | undefined;
    let armed = false;
    let failures = 0;
    let creations = 0;
    panoramaLoader.override(async () => ({ createEngine: (): Engine3dInstance => {
      creations += 1;
      return {
        contract: 1, async mount(_target, next) { callbacks = next; },
        setStyle() {}, setData() {}, setState() {}, resize() {}, dispose() {},
        setCamera() {
          if (!armed) return;
          armed = false;
          callbacks!.lost('error');
          throw new Error('retired camera failed');
        },
      };
    } }));
    const controller = new PanoramaController(element, {
      changed: () => {}, updated: async () => {}, localize: key => key, direction: () => 'ltr',
      camera: () => {}, pick: () => {}, fallback: () => {
        failures += 1;
        if (failures === 1) controller.update(true, image, 2, hotspots, PANORAMA_DEFAULT_CAMERA, container);
      },
    });
    try {
      controller.update(true, image, 1, hotspots, PANORAMA_DEFAULT_CAMERA, container);
      await waitUntil(() => controller.ready);
      armed = true;
      controller.update(true, image, 1, hotspots, { yaw: 1, pitch: 0, fieldOfView: 75 }, container);
      await waitUntil(() => creations === 2 && controller.ready, 'replacement must survive retired command throw');
      expect(failures).to.equal(1);
      expect(controller.notice === null).to.equal(true);
    } finally { controller.disconnect(); element.remove(); }
  });

  it('does not publish a keyboard camera change after its peer loses ownership synchronously', async () => {
    const element = await fixture<HTMLDivElement>(html`<div tabindex="0" style="width:320px;height:180px"></div>`);
    const image = document.createElement('img');
    const container = document.createElement('div');
    container.style.cssText = 'width:320px;height:180px'; element.append(container);
    let callbacks: Engine3dHost | undefined;
    let armed = false;
    let cameraEvents = 0;
    let failures = 0;
    panoramaLoader.override(async () => ({ createEngine: (): Engine3dInstance => ({
      contract: 1, async mount(_target, next) { callbacks = next; },
      setStyle() {}, setData() {}, setState() {}, resize() {}, dispose() {},
      setCamera() { if (armed) { armed = false; callbacks!.lost('error'); } },
    }) }));
    const controller = new PanoramaController(element, {
      changed: () => {}, updated: async () => {}, localize: key => key, direction: () => 'ltr',
      camera: () => { cameraEvents += 1; }, pick: () => {}, fallback: () => { failures += 1; },
    });
    element.addEventListener('keydown', event => controller.keydown(event, 'ltr'));
    try {
      controller.update(true, image, 1, [], PANORAMA_DEFAULT_CAMERA, container);
      await waitUntil(() => controller.ready);
      await focusByKeyboard(element);
      armed = true;
      await sendKeys({ press: 'ArrowRight' });
      expect(failures).to.equal(1);
      expect(cameraEvents).to.equal(0);
      expect(controller.ready).to.equal(false);
    } finally { controller.disconnect(); element.remove(); }
  });

  for (const phase of ['disconnect', 'replacement', 'render failure'] as const) {
    it(`isolates a throwing panorama disposer during ${phase}`, async () => {
      const element = await fixture<HTMLDivElement>(html`<div style="width:320px;height:180px"></div>`);
      const image = document.createElement('img');
      const container = element.appendChild(document.createElement('div'));
      container.style.cssText = 'width:320px;height:180px';
      let callbacks: Engine3dHost | undefined;
      let retired = 0;
      let failures = 0;
      let creations = 0;
      panoramaLoader.override(async () => ({ createEngine: (): Engine3dInstance => {
        const serial = ++creations;
        return {
          contract: 1, async mount(_target, next) { callbacks = next; },
          setStyle() {}, setData() {}, setCamera() {}, resize() {},
          dispose() { retired++; if (serial === 1) throw new Error('private disposal failure'); },
        };
      } }));
      const controller = new PanoramaController(element, {
        changed: () => {}, updated: async () => {}, localize: key => key,
        direction: () => 'ltr', camera: () => {}, pick: () => {}, fallback: () => { failures++; },
      });
      const hotspots: [] = [];
      try {
        controller.update(true, image, 1, hotspots, PANORAMA_DEFAULT_CAMERA, container);
        await waitUntil(() => controller.ready);
        if (phase === 'disconnect') controller.disconnect();
        else if (phase === 'render failure') callbacks!.lost('error');
        else controller.update(true, image, 2, hotspots, PANORAMA_DEFAULT_CAMERA, container);
        expect(retired).to.equal(1);
        expect(failures).to.equal(phase === 'render failure' ? 1 : 0);
        if (phase === 'replacement') {
          await waitUntil(() => controller.ready);
          expect(creations).to.equal(2);
        } else expect(controller.ready).to.equal(false);
        controller.disconnect();
        expect(retired).to.equal(phase === 'replacement' ? 2 : 1);
      } finally { controller.disconnect(); element.remove(); }
    });
  }

  it('reports repeated context loss only once while awaiting restoration', async () => {
    const el = await fixture<LyraImageViewer>(html`<lr-image-viewer src=${PNG} engine="webgl" projection="equirectangular"></lr-image-viewer>`);
    await waitUntil(() => source !== undefined);
    const failures: string[] = [];
    el.addEventListener('lr-engine-fallback', event => failures.push(event.detail.reason));
    host.lost('context-lost'); host.lost('context-lost');
    await el.updateComplete;
    expect(failures).to.deep.equal(['context-lost']);
    expect(disposed).to.equal(0);
    host.restored!(); await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="panorama"]')?.hasAttribute('data-ready')).to.equal(true);
  });

  it('disposes a late renderer once when it finishes loading after disconnect', async () => {
    const element = await fixture<HTMLDivElement>(html`<div style="width:320px;height:180px"></div>`);
    const image = document.createElement('img');
    const container = element.appendChild(document.createElement('div'));
    container.style.cssText = 'width:320px;height:180px';
    let complete!: (module: { createEngine(): Engine3dInstance }) => void;
    let retired = 0;
    let mounts = 0;
    let failures = 0;
    panoramaLoader.override(() => new Promise(resolve => { complete = resolve; }));
    const controller = new PanoramaController(element, {
      changed: () => {}, updated: async () => {}, localize: key => key,
      direction: () => 'ltr', camera: () => {}, pick: () => {}, fallback: () => { failures++; },
    });
    try {
      controller.update(true, image, 1, [], PANORAMA_DEFAULT_CAMERA, container);
      await waitUntil(() => controller.loading && complete !== undefined);
      controller.disconnect();
      complete({ createEngine: () => ({
        contract: 1, async mount() { mounts++; }, setStyle() {}, setData() {}, setCamera() {}, resize() {},
        dispose() { retired++; throw new Error('late disposal failure'); },
      }) });
      await waitUntil(() => retired > 0);
      expect(retired).to.equal(1);
      expect(mounts).to.equal(0); expect(failures).to.equal(0);
      expect(controller.ready).to.equal(false);
      expect(controller.loading).to.equal(false);
    } finally { controller.disconnect(); element.remove(); }
  });

  for (const retirement of ['disable', 'disconnect', 'replacement'] as const) {
    it(`ignores a pending panorama mount rejection after ${retirement}`, async () => {
      const element = await fixture<HTMLDivElement>(html`<div style="width:320px;height:180px"></div>`);
      const image = document.createElement('img');
      const container = element.appendChild(document.createElement('div'));
      container.style.cssText = 'width:320px;height:180px';
      let rejectMount!: (reason: unknown) => void;
      const pendingMount = new Promise<void>((_resolve, reject) => { rejectMount = reject; });
      const releases: number[] = [];
      const dataWrites: number[] = [];
      let creations = 0;
      let entered = false;
      let failures = 0;
      panoramaLoader.override(async () => ({ createEngine: (): Engine3dInstance => {
        const serial = ++creations;
        return {
          contract: 1,
          async mount() { if (serial === 1) { entered = true; await pendingMount; } },
          setStyle() {}, setData() { dataWrites.push(serial); }, setCamera() {}, resize() {},
          dispose() { releases.push(serial); },
        };
      } }));
      const controller = new PanoramaController(element, {
        changed: () => {}, updated: async () => {}, localize: key => key,
        direction: () => 'ltr', camera: () => {}, pick: () => {}, fallback: () => { failures++; },
      });
      const hotspots: [] = [];
      try {
        controller.update(true, image, 1, hotspots, PANORAMA_DEFAULT_CAMERA, container);
        await waitUntil(() => entered, 'first renderer waits for mount');
        if (retirement === 'disconnect') controller.disconnect();
        else controller.update(retirement !== 'disable', image, 2, hotspots, PANORAMA_DEFAULT_CAMERA, container);
        expect(releases).to.deep.equal([1]);
        if (retirement === 'replacement') await waitUntil(() => controller.ready, 'replacement renderer becomes ready');
        rejectMount(new Error('Retired renderer mount failed'));
        // The original start task observes the rejection on the next promise turn.
        await pendingMount.catch(() => {});
        await Promise.resolve();
        expect(failures).to.equal(0);
        expect(releases).to.deep.equal([1]);
        expect(controller.ready).to.equal(retirement === 'replacement');
        expect(controller.loading).to.equal(false);
        if (retirement !== 'replacement') {
          controller.update(true, image, 3, hotspots, PANORAMA_DEFAULT_CAMERA, container);
          await waitUntil(() => controller.ready, 'a new explicit intent starts a working renderer');
        }
        expect(creations).to.equal(2);
        expect(dataWrites).to.deep.equal([2]);
        controller.disconnect();
        expect(releases).to.deep.equal([1, 2]);
      } finally { rejectMount(new Error('Test cleanup')); controller.disconnect(); element.remove(); }
    });
  }

  it('shows the localized native-image fallback when renderer cleanup throws', async () => {
    panoramaLoader.override(async () => ({ createEngine: (): Engine3dInstance => ({
      contract: 1, async mount(_target, callbacks) { host = callbacks; },
      setStyle() {}, setData() {}, setCamera() {}, resize() {},
      dispose() { disposed++; throw new Error('private cleanup detail'); },
    }) }));
    const el = await fixture<LyraImageViewer>(html`<lr-image-viewer src=${PNG} engine="webgl" projection="equirectangular"
      .strings=${{ engine3dError: 'Renderer unavailable', engine3dShowingBuiltin: 'Native image restored' }}></lr-image-viewer>`);
    await waitUntil(() => el.shadowRoot!.querySelector('[part="panorama"]')?.hasAttribute('data-ready') === true);
    const image = el.shadowRoot!.querySelector('[part="image"]');
    const reasons: string[] = [];
    el.addEventListener('lr-engine-fallback', event => reasons.push(event.detail.reason));
    host.lost('error');
    await waitUntil(() => el.shadowRoot!.querySelector('[part="panorama-notice"]')?.textContent?.includes('Renderer unavailable') === true, 'the scheduled fallback reaches the DOM');
    expect(reasons).to.deep.equal(['error']);
    expect(disposed).to.equal(1);
    expect(el.shadowRoot!.querySelector('[part="image"]') === image).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="frame"]')?.hasAttribute('hidden')).to.equal(false);
    const notice = el.shadowRoot!.querySelector('[part="panorama-notice"]')!;
    expect(notice.textContent).to.include('Renderer unavailable').and.to.include('Native image restored');
    expect(notice.textContent).not.to.include('private cleanup detail');
    el.remove(); expect(disposed).to.equal(1);
  });

  it('keeps resolved theme colors when no auxiliary 2D canvas context is available', async () => {
    const el = await fixture<LyraImageViewer>(html`<lr-image-viewer src=${PNG} data-lr-theme-scope style="--lr-color-brand:rgb(11, 22, 33)"></lr-image-viewer>`);
    const original = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext')!;
    const getContext = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      ...original,
      value(this: HTMLCanvasElement, contextId: string, ...options: unknown[]): unknown {
        return contextId === '2d' ? null : Reflect.apply(getContext, this, [contextId, ...options]);
      },
    });
    try {
      el.engine = 'webgl'; el.projection = 'equirectangular';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="panorama"]')?.hasAttribute('data-ready') === true);
      expect((style as { accent: string }).accent).to.equal('rgb(11, 22, 33)');
      expect(el.shadowRoot!.querySelectorAll('[part="panorama-notice"]').length).to.equal(0);
    } finally { el.remove(); Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', original); }
  });

  for (const placement of ['shadow', 'slotted'] as const) {
    it(`observes author visibility and inherited theme through a ${placement} host`, async () => {
      const wrapper = await fixture<HTMLDivElement>(html`<div aria-hidden="true"></div>`);
      const shadow = wrapper.attachShadow({ mode: 'open' });
      const el = document.createElement('lr-image-viewer') as LyraImageViewer;
      el.src = PNG; el.engine = 'webgl'; el.projection = 'equirectangular';
      if (placement === 'slotted') { shadow.appendChild(document.createElement('slot')); wrapper.appendChild(el); }
      else shadow.appendChild(el);
      try {
        await el.updateComplete;
        await waitUntil(() => el.shadowRoot!.querySelector<HTMLImageElement>('[part="image"]')?.complete === true);
        expect(creates).to.equal(0);
        wrapper.removeAttribute('aria-hidden');
        await waitUntil(() => el.shadowRoot!.querySelector('[part="panorama"]')?.hasAttribute('data-ready') === true);
        expect(creates).to.equal(1);
        wrapper.style.setProperty('--lr-color-brand', 'rgb(11, 22, 33)');
        await waitUntil(() => (style as { accent: string })?.accent === 'rgba(11, 22, 33, 1)', 'the renderer receives inherited theme changes');
        expect(disposed).to.equal(0);
      } finally { el.remove(); }
      expect(disposed).to.equal(1);
    });
  }

});
