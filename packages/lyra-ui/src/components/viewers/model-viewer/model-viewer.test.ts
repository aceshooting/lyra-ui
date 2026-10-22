import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { setColorScheme, setForcedColors, setReducedMotion } from '../../../../test/wtr-media.js';
import './model-viewer.js';
import { modelEngineEnvironment, modelEngineLoader } from './model-viewer-loader.js';
import type { LyraModelViewer } from './model-viewer.class.js';
import type { Engine3dHost } from '../../../internal/engine-3d-loader.js';

const camera = () => ({ yaw: 0, pitch: 0, distance: 10, target: { x: 0, y: 0, z: 0 } });
const source = 'data:text/plain,v%200%200%200%0Av%201%200%200%0Av%200%201%200%0Af%201%202%203';
let hosts: Engine3dHost[]; let disposed: number; let imports: number; let data: unknown[]; let cameras: unknown[]; let styles: unknown[]; let resizes: Array<[number, number]>;
const available = modelEngineEnvironment.available;
function install() {
  hosts = []; disposed = imports = 0; data = []; cameras = []; styles = []; resizes = [];
  modelEngineEnvironment.available = () => true;
  modelEngineLoader.override(async () => {
    imports++;
    return { createEngine: () => ({
      contract: 1, async mount(container: HTMLElement, host: Engine3dHost) { hosts.push(host); container.append(document.createElement('canvas')); },
      setData(value: unknown) { data.push(value); const host = hosts.at(-1)!; queueMicrotask(() => host.progress?.(36, 36)); },
      setStyle(value: unknown) { styles.push(value); }, setCamera(value: unknown) { cameras.push(value); }, fit: camera, resize(width: number, height: number) { resizes.push([width, height]); }, dispose() { disposed++; },
    }) };
  });
}
beforeEach(install);
afterEach(() => { modelEngineLoader.override(undefined); modelEngineEnvironment.available = available; });
const ready = async (viewer: LyraModelViewer) => { await waitUntil(() => viewer.shadowRoot!.querySelector('[part="viewport"]')?.hasAttribute('data-ready') === true); await viewer.updateComplete; };

it('keeps an empty viewer idle with an accessible text alternative and no companion import', async () => {
  const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer></lr-model-viewer>`);
  expect(imports).to.equal(0); expect(viewer.shadowRoot!.querySelector('[part="alternative"]')?.textContent).to.contain('3D');
  await expect(viewer).to.be.accessible();
});
it('loads bounded bytes into the structural model engine and exposes localized progress', async () => {
  const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src=${source} format="obj" name="Triangle" alt="A flat triangular face"></lr-model-viewer>`);
  await ready(viewer); expect(imports).to.equal(1); expect(data).to.have.length(1);
  const loaded = data[0] as { bytes: ArrayBuffer; format: string }; expect(loaded.format).to.equal('obj'); expect(loaded.bytes.byteLength).to.be.greaterThan(0);
  expect(viewer.shadowRoot!.querySelector('[part="alternative"]')?.textContent).to.contain('A flat triangular face');
  expect(viewer.shadowRoot!.querySelector('[part="status"]')?.textContent).to.contain('ready'); await expect(viewer).to.be.accessible();
});
it('honors host aria-label by presence, instructions and strings overrides without shadow live regions', async () => {
  const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer aria-label="Custom model" src=${source} format="obj" .strings=${{ modelViewerFit: 'Frame object', modelViewerReady: 'Object loaded' }}></lr-model-viewer>`);
  await ready(viewer); expect(viewer.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-label')).to.equal('Custom model');
  expect(viewer.shadowRoot!.textContent).to.contain('Frame object'); expect(viewer.shadowRoot!.textContent).to.contain('Object loaded');
  expect(viewer.shadowRoot!.querySelector('[aria-live], [role="alert"], [role="status"]') === null).to.equal(true);
  await expect(viewer).to.be.accessible();
  viewer.setAttribute('aria-label', ''); await viewer.updateComplete;
  expect(viewer.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-label')).to.equal('');
});
it('marks the engine canvas decorative without making it focusable', async () => {
  const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src=${source} format="obj"></lr-model-viewer>`); await ready(viewer);
  const canvas = viewer.shadowRoot!.querySelector('[part="viewport"] canvas')!;
  expect(canvas.getAttribute('aria-hidden')).to.equal('true'); expect(canvas.hasAttribute('tabindex')).to.equal(false);
});
it('keyboard orbit respects RTL and camera assignments stay silent', async () => {
  const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src=${source} format="obj" dir="rtl"></lr-model-viewer>`); await ready(viewer);
  let changes = 0; viewer.addEventListener('lr-camera-change', () => changes++); viewer.camera = camera(); await viewer.updateComplete;
  expect(changes).to.equal(0); const surface = viewer.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!; await focusByKeyboard(surface);
  surface.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); await viewer.updateComplete;
  expect(viewer.camera!.yaw).to.be.lessThan(0); expect(changes).to.equal(1);
  surface.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })); await viewer.updateComplete;
  expect(viewer.camera!.yaw).to.equal(0); expect(changes).to.equal(2);
});
it('retains the context-lost engine for restoration and retires it exactly once on disconnect', async () => {
  const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src=${source} format="obj"></lr-model-viewer>`); await ready(viewer);
  const host = hosts[0]!; host.lost('context-lost'); await viewer.updateComplete; expect(disposed).to.equal(0);
  expect(viewer.shadowRoot!.textContent).to.contain('context'); host.restored?.(); await viewer.updateComplete;
  viewer.remove(); expect(disposed).to.equal(1); host.lost('error'); host.progress?.(1, 1); await viewer.updateComplete; expect(disposed).to.equal(1);
});
it('reconnect loads a fresh owned engine and populated controls fit a narrow allocation', async () => {
  const holder = await fixture<HTMLDivElement>(html`<div style="inline-size:320px"><lr-model-viewer src=${source} format="obj" name="A long descriptive title for a small three-dimensional example"></lr-model-viewer></div>`);
  const viewer = holder.firstElementChild as LyraModelViewer; await ready(viewer); viewer.remove(); holder.append(viewer);
  await waitUntil(() => data.length === 2); await ready(viewer);
  expect(data).to.have.length(2); expect(disposed).to.equal(1); expect(viewer.scrollWidth).to.be.at.most(holder.clientWidth); await expect(viewer).to.be.accessible();
});
it('copies and validates authored cameras before accepting them', async () => {
  const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer></lr-model-viewer>`); const value = camera(); viewer.camera = value; value.target.x = 999;
  expect(viewer.camera!.target.x).to.equal(0); expect(() => { viewer.camera = { ...camera(), distance: NaN }; }).to.throw(TypeError);
  expect(viewer.camera!.target.x).to.equal(0); expect(imports).to.equal(0);
});

it('unsetting an authored camera returns the current model to automatic fit', async () => {
  const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src=${source} format="obj" .camera=${{ ...camera(), distance: 100 }}></lr-model-viewer>`); await ready(viewer);
  expect(viewer.camera!.distance).to.equal(100); viewer.camera = undefined; await viewer.updateComplete;
  expect(viewer.camera!.distance).to.equal(10);
});

it('distinguishes a valid empty model from a parser failure', async () => {
  modelEngineLoader.override(async () => ({ createEngine: () => {
    let host: Engine3dHost;
    return { contract: 1, async mount(_container: HTMLElement, value: Engine3dHost) { host = value; }, setData() { queueMicrotask(() => host.progress?.(0, 0)); }, setStyle() {}, setCamera() {}, fit: camera, positionOf: () => null, resize() {}, dispose() {} };
  } }));
  const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src="data:," format="obj"></lr-model-viewer>`);
  await waitUntil(() => (viewer.shadowRoot!.querySelector('[part="status"]')?.textContent ?? '').includes('no visible geometry'));
  expect(viewer.shadowRoot!.querySelector('[part="error"]') === null).to.equal(true); await expect(viewer).to.be.accessible();
});

for (const completionFirst of [false, true]) {
  it(`preserves parse completion when context ${completionFirst ? 'restores after' : 'restores before'} completion`, async () => {
    let host: Engine3dHost | undefined; let fits = 0; let loads = 0;
    modelEngineLoader.override(async () => ({ createEngine: () => ({ contract: 1,
      async mount(_container: HTMLElement, value: Engine3dHost) { host = value; }, setData() {}, setStyle() {}, setCamera() {},
      fit() { fits++; return camera(); }, positionOf: () => ({ x: 0, y: 0, z: 0 }), resize() {}, dispose() {},
    }) }));
    const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src=${source} format="obj"></lr-model-viewer>`);
    viewer.addEventListener('lr-load', () => loads++); await waitUntil(() => Boolean(host));
    host!.lost('context-lost');
    if (completionFirst) { host!.progress?.(1, 1); await viewer.updateComplete; expect(fits).to.equal(0); expect(viewer.shadowRoot!.querySelector('[part="error"]')).not.to.equal(null); host!.restored?.(); }
    else { host!.restored?.(); await viewer.updateComplete; expect(viewer.shadowRoot!.querySelector('[part="viewport"]')?.getAttribute('aria-busy')).to.equal('true'); expect(loads).to.equal(0); host!.progress?.(1, 1); }
    await ready(viewer); host!.progress?.(1, 1); expect(loads).to.equal(1); expect(fits).to.equal(1);
  });
}
it('unsetting a camera during context loss fits only after restoration', async () => {
  const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src=${source} format="obj" .camera=${{ ...camera(), distance: 100 }}></lr-model-viewer>`);
  await ready(viewer); hosts[0]!.lost('context-lost'); viewer.camera = undefined; expect(viewer.camera).to.equal(undefined);
  hosts[0]!.restored?.(); await ready(viewer); expect(viewer.camera!.distance).to.equal(10);
});
for (const operation of ['setCamera', 'fit', 'positionOf']) {
  it(`retires a failing ${operation} without publishing a successful load`, async () => {
    let host: Engine3dHost | undefined; let disposedHere = 0; let loads = 0; let errors = 0; let fail = false;
    modelEngineLoader.override(async () => ({ createEngine: () => ({ contract: 1,
      async mount(_container: HTMLElement, value: Engine3dHost) { host = value; }, setData() {}, setStyle() {},
      setCamera() { if (operation === 'setCamera' && fail) throw new Error('private detail'); },
      fit() { if (operation === 'fit' && fail) throw new Error('private detail'); return camera(); },
      positionOf() { if (operation === 'positionOf' && fail) throw new Error('private detail'); return { x: 0, y: 0, z: 0 }; },
      resize() {}, dispose() { disposedHere++; },
    }) }));
    const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src=${source} format="obj"></lr-model-viewer>`);
    viewer.addEventListener('lr-load', () => loads++); viewer.addEventListener('lr-render-error', () => errors++); await waitUntil(() => Boolean(host));
    if (operation === 'setCamera') { host!.progress?.(1, 1); await ready(viewer); loads = 0; }
    fail = true; expect(() => { if (operation === 'setCamera') viewer.camera = camera(); else host!.progress?.(1, 1); }).not.to.throw();
    await viewer.updateComplete; expect(errors).to.equal(1); expect(disposedHere).to.equal(1); expect(loads).to.equal(0);
    expect(viewer.shadowRoot!.querySelector('[part="error"]')?.textContent).to.contain('could not'); expect(viewer.shadowRoot!.textContent).not.to.contain('private detail');
    host!.restored?.(); host!.progress?.(1, 1); await viewer.updateComplete; expect(disposedHere).to.equal(1); expect(loads).to.equal(0);
  });
}

it('does not emit a camera change when a user fit retires the engine', async () => {
  let shouldFail = false; let host: Engine3dHost;
  modelEngineLoader.override(async () => ({ createEngine: () => ({ contract: 1,
    async mount(_container: HTMLElement, value: Engine3dHost) { host = value; }, setData() { queueMicrotask(() => host.progress?.(1, 1)); }, setStyle() {}, setCamera() {},
    fit() { if (shouldFail) throw new Error('fit failed'); return camera(); }, resize() {}, dispose() {},
  }) }));
  const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src=${source} format="obj"></lr-model-viewer>`); await ready(viewer);
  let changes = 0; viewer.addEventListener('lr-camera-change', () => changes++); shouldFail = true;
  const surface = viewer.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!; await focusByKeyboard(surface);
  surface.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })); await viewer.updateComplete;
  expect(changes).to.equal(0); expect(viewer.shadowRoot!.querySelector('[part="error"]')?.textContent).to.contain('could not');
});

const surfaceOf = (viewer: LyraModelViewer) => viewer.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
const partText = (viewer: LyraModelViewer, part: string) => viewer.shadowRoot!.querySelector(`[part="${part}"]`)?.textContent?.trim() ?? '';
const toolbarButtons = (viewer: LyraModelViewer) => [...viewer.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="toolbar"] button')];
const objectResponse = () => new Response('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n');
async function withFetch<T>(handler: typeof window.fetch, run: () => Promise<T>): Promise<T> {
  const original = window.fetch; window.fetch = handler;
  try { return await run(); } finally { window.fetch = original; }
}
const failed = (viewer: LyraModelViewer) => waitUntil(() => viewer.shadowRoot!.querySelector('[part="error"]') !== null);

describe('empty, unsupported and failed states', () => {
  it('names the idle state with the localized model label instead of leaving a placeholder', async () => {
    const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer></lr-model-viewer>`);
    expect(partText(viewer, 'status')).to.equal('No 3D model to display.');
    viewer.strings = { modelViewerLabel: 'Objet 3D', documentPreviewEmpty: 'Aucun {type} à afficher.' }; await viewer.updateComplete;
    expect(partText(viewer, 'status')).to.equal('Aucun Objet 3D à afficher.');
    expect(surfaceOf(viewer).hasAttribute('hidden')).to.equal(true);
  });
  it('fails closed on an unknown format before any fetch or companion import', async () => {
    let fetched = 0;
    await withFetch(async () => { fetched++; return objectResponse(); }, async () => {
      const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src="/shape.fbx" format="fbx" name="shape.fbx" alt="A shape"></lr-model-viewer>`);
      await failed(viewer);
      expect(partText(viewer, 'error')).to.equal('This model format is not supported.');
      expect(fetched).to.equal(0); expect(imports).to.equal(0); expect(partText(viewer, 'alternative')).to.equal('A shape');
      expect(viewer.shadowRoot!.querySelector('a[part="download"]') !== null).to.equal(true);
      await expect(viewer).to.be.accessible();
    });
  });
  it('reports a failure once through lr-render-error and the lr-engine-fallback chain', async () => {
    const holder = await fixture<HTMLDivElement>(html`<div></div>`); const viewer = document.createElement('lr-model-viewer') as LyraModelViewer;
    const fallbacks: unknown[] = []; const errors: unknown[] = [];
    viewer.addEventListener('lr-engine-fallback', event => fallbacks.push((event as CustomEvent).detail));
    viewer.addEventListener('lr-render-error', event => errors.push((event as CustomEvent).detail));
    viewer.setAttribute('src', '/shape.fbx'); viewer.setAttribute('format', 'fbx'); holder.append(viewer);
    await waitUntil(() => errors.length === 1); await viewer.updateComplete;
    expect(fallbacks).to.deep.equal([{ from: 'webgl', to: 'list', reason: 'unsupported' }]);
    expect((errors[0] as { error: unknown }).error instanceof Error).to.equal(true);
  });
  it('shows an accessible failure with the alternative and download link, then retries from the button', async () => {
    let attempts = 0;
    await withFetch(async () => { attempts++; return attempts === 1 ? new Response('missing', { status: 404 }) : objectResponse(); }, async () => {
      const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src="/model.obj" name="model.obj" alt="A teapot"></lr-model-viewer>`);
      await failed(viewer);
      expect(partText(viewer, 'error')).to.equal('This model could not be displayed.');
      expect(partText(viewer, 'alternative')).to.equal('A teapot');
      expect(viewer.shadowRoot!.querySelector('a[part="download"]')?.getAttribute('download')).to.equal('model.obj');
      expect(viewer.shadowRoot!.querySelector('[role="alert"], [aria-live]') === null).to.equal(true);
      await expect(viewer).to.be.accessible();
      const retry = viewer.shadowRoot!.querySelector<HTMLButtonElement>('[part="footer"] button')!;
      expect(retry.textContent!.trim()).to.equal('Retry'); retry.click();
      await ready(viewer); expect(attempts).to.equal(2); expect(viewer.shadowRoot!.querySelector('[part="error"]') === null).to.equal(true);
      expect(viewer.shadowRoot!.querySelector('[part="footer"] button') === null).to.equal(true);
    });
  });
  it('maps an engine without WebGL2 to the browser support message', async () => {
    modelEngineLoader.override(async () => ({ createEngine: () => ({ contract: 1,
      async mount() { throw Object.assign(new Error('no context'), { code: 'webgl-unavailable' }); },
      setData() {}, setStyle() {}, setCamera() {}, fit: camera, resize() {}, dispose() { disposed++; },
    }) }));
    const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src=${source} format="obj"></lr-model-viewer>`); await failed(viewer);
    expect(partText(viewer, 'error')).to.equal('This browser cannot display 3D graphics.'); expect(disposed).to.equal(1);
  });
  it('keeps a lost context accessible with the alternative and shows the software-rendering notice', async () => {
    const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src=${source} format="obj" alt="A flat shape"></lr-model-viewer>`); await ready(viewer);
    hosts[0]!.rendering?.({ software: true }); await viewer.updateComplete;
    expect(partText(viewer, 'status')).to.contain('Model ready.'); expect(viewer.shadowRoot!.textContent).to.contain('without hardware acceleration');
    hosts[0]!.lost('context-lost'); await viewer.updateComplete;
    expect(partText(viewer, 'error')).to.equal('The 3D view lost its graphics context.'); expect(partText(viewer, 'alternative')).to.equal('A flat shape');
    expect(toolbarButtons(viewer).every(button => button.disabled)).to.equal(true); await expect(viewer).to.be.accessible();
  });
  it('wraps long unbroken text inside a 320px allocation in the failed state', async () => {
    const long = 'x'.repeat(240);
    await withFetch(async () => new Response('missing', { status: 404 }), async () => {
      const holder = await fixture<HTMLDivElement>(html`<div style="inline-size:320px"><lr-model-viewer src="/model.obj" name=${`${long}.obj`} alt=${long}></lr-model-viewer></div>`);
      const viewer = holder.firstElementChild as LyraModelViewer; await failed(viewer);
      const base = viewer.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
      expect(base.scrollWidth).to.be.at.most(base.clientWidth); expect(base.clientWidth).to.be.at.most(320); await expect(viewer).to.be.accessible();
    });
  });
});

describe('public properties', () => {
  it('emits lr-load once with the parsed format', async () => {
    const holder = await fixture<HTMLDivElement>(html`<div></div>`); const viewer = document.createElement('lr-model-viewer') as LyraModelViewer;
    const loads: unknown[] = []; viewer.addEventListener('lr-load', event => loads.push((event as CustomEvent).detail));
    viewer.setAttribute('src', source); viewer.setAttribute('format', 'obj'); holder.append(viewer); await ready(viewer);
    expect(loads).to.deep.equal([{ format: 'obj' }]);
  });
  it('returns to automatic format detection when the format attribute is removed', async () => {
    const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src=${source} name="triangle.obj" format="stl"></lr-model-viewer>`); await ready(viewer);
    expect((data[0] as { format: string }).format).to.equal('stl');
    viewer.removeAttribute('format'); await waitUntil(() => data.length === 2);
    expect((data[1] as { format: string }).format).to.equal('obj'); expect(viewer.format).to.equal('auto');
  });
  it('treats a null camera as unset and keeps the previous camera when an assignment is invalid', async () => {
    const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer></lr-model-viewer>`);
    viewer.camera = camera(); expect(viewer.camera!.distance).to.equal(10);
    expect(() => { viewer.camera = { ...camera(), target: { x: 0, y: Infinity, z: 0 } }; }).to.throw(TypeError); expect(viewer.camera!.distance).to.equal(10);
    (viewer as { camera: unknown }).camera = null; expect(viewer.camera).to.equal(undefined);
  });
  it('lets a strings override rename a reused key and a model key', async () => {
    const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src=${source} format="obj" .strings=${{ zoomIn: 'Rapprocher', modelViewerRotateLeft: 'Tourner à gauche' }}></lr-model-viewer>`); await ready(viewer);
    expect(toolbarButtons(viewer).map(button => button.textContent!.trim())).to.deep.equal(['Tourner à gauche', 'Rotate right', 'Rotate up', 'Rotate down', 'Rapprocher', 'Zoom out', 'Fit model']);
  });
  it('guards the download link for every target and author rel value', async () => {
    await withFetch(async () => objectResponse(), async () => {
      const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src="/model.obj" name="model.obj"></lr-model-viewer>`); await ready(viewer);
      const link = () => viewer.shadowRoot!.querySelector<HTMLAnchorElement>('a[part="download"]')!;
      expect(link().getAttribute('target')).to.equal('_blank'); expect(link().rel.split(' ').sort()).to.deep.equal(['noopener', 'noreferrer']);
      expect(link().getAttribute('download')).to.equal('model.obj'); expect(link().href.endsWith('/model.obj')).to.equal(true);
      viewer.rel = 'OPENER nofollow'; await viewer.updateComplete;
      expect(link().rel.split(' ').sort()).to.deep.equal(['nofollow', 'noopener', 'noreferrer']);
      viewer.target = ''; await viewer.updateComplete;
      expect(link().hasAttribute('target')).to.equal(false); expect(link().rel).to.equal('nofollow');
      viewer.rel = ''; await viewer.updateComplete; expect(link().hasAttribute('rel')).to.equal(false);
      viewer.target = 'report'; await viewer.updateComplete; expect(link().rel.split(' ').sort()).to.deep.equal(['noopener', 'noreferrer']);
    });
  });
});

describe('camera controls', () => {
  it('maps each documented key to one camera action and ignores modified, unmapped and nested-target keys', async () => {
    const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src=${source} format="obj"></lr-model-viewer>`); await ready(viewer);
    const surface = surfaceOf(viewer); await focusByKeyboard(surface);
    let changes = 0; viewer.addEventListener('lr-camera-change', () => changes++);
    const press = (key: string, init: KeyboardEventInit = {}, target: HTMLElement = surface) => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }); target.dispatchEvent(event); return event.defaultPrevented;
    };
    const near = (actual: number, expected: number) => expect(actual).to.be.closeTo(expected, 1e-9);
    expect(press('ArrowLeft')).to.equal(true); near(viewer.camera!.yaw, -0.1);
    expect(press('ArrowRight')).to.equal(true); near(viewer.camera!.yaw, 0);
    expect(press('ArrowUp')).to.equal(true); near(viewer.camera!.pitch, 0.1);
    expect(press('ArrowDown')).to.equal(true); near(viewer.camera!.pitch, 0);
    expect(press('+')).to.equal(true); near(viewer.camera!.distance, 8);
    expect(press('=')).to.equal(true); near(viewer.camera!.distance, 6.4);
    expect(press('-')).to.equal(true); near(viewer.camera!.distance, 8);
    expect(press('-')).to.equal(true); near(viewer.camera!.distance, 10);
    expect(press('ArrowLeft')).to.equal(true); expect(press('Home')).to.equal(true); near(viewer.camera!.yaw, 0);
    expect(changes).to.equal(10);
    for (const init of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }, { isComposing: true }]) expect(press('ArrowRight', init)).to.equal(false);
    expect(press('a')).to.equal(false); expect(press('constructor')).to.equal(false);
    expect(press('ArrowRight', {}, surface.querySelector('canvas')!)).to.equal(false);
    expect(changes).to.equal(10); near(viewer.camera!.yaw, 0);
  });
  it('ignores keys inside an inert ancestor', async () => {
    const holder = await fixture<HTMLDivElement>(html`<div inert><lr-model-viewer src=${source} format="obj"></lr-model-viewer></div>`);
    const viewer = holder.firstElementChild as LyraModelViewer; await ready(viewer);
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }); surfaceOf(viewer).dispatchEvent(event);
    expect(event.defaultPrevented).to.equal(false); expect(viewer.camera!.yaw).to.equal(0);
  });
  it('keeps the toolbar disabled while loading', async () => {
    modelEngineLoader.override(async () => ({ createEngine: () => ({ contract: 1, async mount() {}, setData() {}, setStyle() {}, setCamera() {}, fit: camera, resize() {}, dispose() {} }) }));
    const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src=${source} format="obj"></lr-model-viewer>`);
    await waitUntil(() => surfaceOf(viewer).getAttribute('aria-busy') === 'true');
    expect(toolbarButtons(viewer).map(button => button.disabled)).to.deep.equal([true, true, true, true, true, true, true]);
    expect(surfaceOf(viewer).getAttribute('tabindex')).to.equal('-1');
  });
  it('labels and operates every toolbar action and reports each as a user camera change', async () => {
    const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src=${source} format="obj"></lr-model-viewer>`); await ready(viewer);
    const cameras: Array<{ yaw: number; pitch: number; distance: number }> = [];
    viewer.addEventListener('lr-camera-change', event => cameras.push((event as CustomEvent<{ camera: { yaw: number; pitch: number; distance: number } }>).detail.camera));
    const buttons = toolbarButtons(viewer);
    expect(buttons.map(button => button.textContent!.trim())).to.deep.equal(['Rotate left', 'Rotate right', 'Rotate up', 'Rotate down', 'Zoom in', 'Zoom out', 'Fit model']);
    expect(buttons.every(button => !button.disabled)).to.equal(true); expect(surfaceOf(viewer).getAttribute('tabindex')).to.equal('0');
    for (const button of buttons) button.click();
    expect(cameras).to.have.length(7);
    expect(cameras.map(value => Math.sign(value.yaw))).to.deep.equal([-1, 0, 0, 0, 0, 0, 0]);
    expect(cameras.map(value => Math.sign(value.pitch))).to.deep.equal([0, 0, 1, 0, 0, 0, 0]);
    expect(cameras[4]!.distance).to.be.lessThan(10); expect(cameras[6]!.distance).to.equal(10);
    expect(surfaceOf(viewer).style.cursor).to.equal(''); expect(getComputedStyle(surfaceOf(viewer)).cursor).to.equal('grab');
  });
  it('mirrors horizontal rotation from the toolbar under RTL', async () => {
    const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src=${source} format="obj" dir="rtl"></lr-model-viewer>`); await ready(viewer);
    toolbarButtons(viewer)[1]!.click(); expect(viewer.camera!.yaw).to.be.lessThan(0);
    toolbarButtons(viewer)[0]!.click(); toolbarButtons(viewer)[0]!.click(); expect(viewer.camera!.yaw).to.be.greaterThan(0);
    expect(getComputedStyle(viewer).direction).to.equal('rtl'); await expect(viewer).to.be.accessible();
  });
  it('passes the live reduced-motion preference to the engine and refreshes it when the preference changes', async () => {
    await setReducedMotion('reduce');
    try {
      const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src=${source} format="obj"></lr-model-viewer>`); await ready(viewer);
      const reduced = () => (styles.at(-1) as { reducedMotion: boolean }).reducedMotion;
      const transition = () => Number.parseFloat(getComputedStyle(toolbarButtons(viewer)[0]!).transitionDuration);
      expect(reduced()).to.equal(true); expect(transition()).to.be.lessThan(0.001);
      await setReducedMotion('no-preference'); await waitUntil(() => reduced() === false);
      expect(transition()).to.be.greaterThan(0.001);
    } finally { await setReducedMotion('no-preference'); }
  });
});

describe('environment changes', () => {
  const background = () => (styles.at(-1) as { background: string }).background;
  it('resizes the engine to the allocated size and again when the allocation changes', async () => {
    const holder = await fixture<HTMLDivElement>(html`<div style="inline-size:320px"><lr-model-viewer src=${source} format="obj"></lr-model-viewer></div>`);
    const viewer = holder.firstElementChild as LyraModelViewer; await ready(viewer);
    await waitUntil(() => resizes.length > 0); expect(resizes.at(-1)![0]).to.be.closeTo(318, 4);
    holder.style.inlineSize = '200px'; await waitUntil(() => Math.abs(resizes.at(-1)![0] - 198) < 4);
    expect(resizes.at(-1)![1]).to.be.greaterThan(0);
  });
  it('re-resolves the engine colors when an ancestor theme input changes', async () => {
    const holder = await fixture<HTMLDivElement>(html`<div data-lr-theme-scope style="--lr-theme-color-surface-default: rgb(255, 0, 0)"><lr-model-viewer src=${source} format="obj"></lr-model-viewer></div>`);
    const viewer = holder.firstElementChild as LyraModelViewer; await ready(viewer);
    expect(background()).to.equal('rgba(255, 0, 0, 1)');
    holder.style.setProperty('--lr-theme-color-surface-default', 'rgb(0, 0, 255)');
    await waitUntil(() => background() === 'rgba(0, 0, 255, 1)');
  });
  it('refreshes the engine style when the color scheme changes', async () => {
    await setColorScheme('light');
    try {
      const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src=${source} format="obj"></lr-model-viewer>`); await ready(viewer);
      const light = background(); await setColorScheme('dark');
      await waitUntil(() => background() !== light);
    } finally { await setColorScheme('no-preference'); }
  });
  it('hands the live forced-colors preference to the engine', async () => {
    await setForcedColors('active');
    try {
      const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src=${source} format="obj"></lr-model-viewer>`); await ready(viewer);
      const forced = () => (styles.at(-1) as { forcedColors: boolean }).forcedColors;
      expect(forced()).to.equal(true); await setForcedColors('none'); await waitUntil(() => forced() === false);
    } finally { await setForcedColors('none'); }
  });
  it('retires an engine whose size refresh fails', async () => {
    let fail = false; let host: Engine3dHost | undefined; let disposedHere = 0; let errors = 0;
    modelEngineLoader.override(async () => ({ createEngine: () => ({ contract: 1,
      async mount(_container: HTMLElement, value: Engine3dHost) { host = value; }, setData() { queueMicrotask(() => host!.progress?.(1, 1)); }, setStyle() {}, setCamera() {},
      fit: camera, resize() { if (fail) throw new Error('private detail'); }, dispose() { disposedHere++; },
    }) }));
    const holder = await fixture<HTMLDivElement>(html`<div style="inline-size:320px"><lr-model-viewer src=${source} format="obj"></lr-model-viewer></div>`);
    const viewer = holder.firstElementChild as LyraModelViewer; viewer.addEventListener('lr-render-error', () => { errors++; }); await ready(viewer);
    fail = true; holder.style.inlineSize = '260px'; await failed(viewer);
    expect(errors).to.equal(1); expect(disposedHere).to.equal(1); expect(partText(viewer, 'error')).to.equal('This model could not be displayed.');
    expect(viewer.shadowRoot!.textContent).not.to.contain('private detail');
  });
});

describe('engine failures after the model is ready', () => {
  async function readyWith(overrides: Record<string, unknown>) {
    let host: Engine3dHost | undefined; const counts = { disposed: 0, errors: 0 };
    modelEngineLoader.override(async () => ({ createEngine: () => ({ contract: 1,
      async mount(_container: HTMLElement, value: Engine3dHost) { host = value; }, setData() { queueMicrotask(() => host!.progress?.(1, 1)); },
      setStyle() {}, setCamera() {}, fit: camera, positionOf: () => ({ x: 0, y: 0, z: 0 }), resize() {}, dispose() { counts.disposed++; }, ...overrides,
    }) }));
    const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src=${source} format="obj"></lr-model-viewer>`);
    viewer.addEventListener('lr-render-error', () => { counts.errors++; }); await ready(viewer);
    return { viewer, host: host!, counts };
  }
  it('retires an engine that rejects a toolbar camera step', async () => {
    let fail = false; const { viewer, counts } = await readyWith({ setCamera() { if (fail) throw new Error('private detail'); } });
    fail = true; toolbarButtons(viewer)[0]!.click(); await viewer.updateComplete;
    expect(counts.errors).to.equal(1); expect(counts.disposed).to.equal(1); expect(partText(viewer, 'error')).to.equal('This model could not be displayed.');
    expect(viewer.shadowRoot!.textContent).not.to.contain('private detail');
  });
  it('retires an engine that fails while restoring its context', async () => {
    let fail = false; const { viewer, host, counts } = await readyWith({ positionOf() { if (fail) throw new Error('private detail'); return { x: 0, y: 0, z: 0 }; } });
    host.lost('context-lost'); fail = true; host.restored?.(); await viewer.updateComplete;
    expect(counts.errors).to.equal(1); expect(counts.disposed).to.equal(1); expect(partText(viewer, 'error')).to.equal('This model could not be displayed.');
  });
  it('treats a non-context engine loss as a failure', async () => {
    const { viewer, host, counts } = await readyWith({});
    host.lost('error', 'driver detail'); await viewer.updateComplete;
    expect(counts.errors).to.equal(1); expect(counts.disposed).to.equal(1); expect(viewer.shadowRoot!.textContent).not.to.contain('driver detail');
  });
  it('discards an engine whose mount finishes after the source changed', async () => {
    let finishMount!: () => void; let loaded = 0;
    modelEngineLoader.override(async () => ({ createEngine: () => ({ contract: 1,
      mount() { return new Promise<void>(resolve => { finishMount = resolve; }); },
      setData() { loaded++; }, setStyle() {}, setCamera() {}, fit: camera, resize() {}, dispose() { disposed++; },
    }) }));
    const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src=${source} format="obj"></lr-model-viewer>`);
    await waitUntil(() => Boolean(finishMount)); viewer.src = ''; expect(disposed).to.equal(1);
    finishMount(); await viewer.updateComplete; await new Promise(resolve => setTimeout(resolve, 0));
    expect(loaded).to.equal(0); expect(disposed).to.equal(1);
  });
});

describe('ownership', () => {
  it('retires its engine and reloads when adopted into another document', async () => {
    const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`); const inner = frame.contentDocument!;
    const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer src=${source} format="obj"></lr-model-viewer>`); await ready(viewer);
    inner.adoptNode(viewer); inner.body.append(viewer);
    await waitUntil(() => data.length === 2); await ready(viewer);
    expect(disposed).to.equal(1); expect(viewer.ownerDocument === inner).to.equal(true);
  });
  it('normalizes non-string writes to the source properties without loading', async () => {
    const viewer = await fixture<LyraModelViewer>(html`<lr-model-viewer></lr-model-viewer>`);
    const loose = viewer as unknown as Record<string, unknown>;
    loose['src'] = undefined; loose['name'] = null; loose['mimeType'] = 5; loose['format'] = undefined; await viewer.updateComplete;
    expect([viewer.src, viewer.name, viewer.mimeType, viewer.format]).to.deep.equal(['', '', '', 'auto']); expect(imports).to.equal(0);
  });
});
