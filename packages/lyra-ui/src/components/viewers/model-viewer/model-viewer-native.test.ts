import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { webgl2Available } from '../../../internal/engine-3d.js';
import './model-viewer.js';
import type { LyraModelViewer } from './model-viewer.class.js';

// These cases drive the real companion engine, so they need a WebGL2 context. Engines without one
// (headless Firefox on a host with no GPU) skip them cleanly instead of waiting on a canvas that
// can never render. The stubbed-engine suites cover the same lifecycle on every engine.
const hasWebgl2 = (): boolean => webgl2Available();
const dataUrl = (text: string): string => `data:text/plain,${encodeURIComponent(text)}`;
const triangle = dataUrl('v -1 -1 0\nv 1 -1 0\nv 0 1 0\nf 1 2 3\n');
const cloud = dataUrl('-1 -1 0 255 0 0\n1 -1 0 0 255 0\n0 1 0 0 0 255\n');
const positions = new Uint8Array(new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0]).buffer);
/** A one-triangle glTF whose single buffer is embedded unless a different URI is supplied. */
const gltf = (uri = `data:application/octet-stream;base64,${btoa(String.fromCharCode(...positions))}`): string => dataUrl(JSON.stringify({
  asset: { version: '2.0' },
  buffers: [{ byteLength: positions.length, uri }],
  bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.length }],
  accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-1, -1, 0], max: [1, 1, 0] }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
  nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0,
}));
const viewportOf = (viewer: LyraModelViewer): HTMLElement => viewer.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
const partText = (viewer: LyraModelViewer, part: string): string => viewer.shadowRoot!.querySelector(`[part="${part}"]`)?.textContent ?? '';
const isReady = (viewer: LyraModelViewer): boolean => viewportOf(viewer).hasAttribute('data-ready');
const READY = { timeout: 20000 };

async function mount(source: string, format: string): Promise<{ viewer: LyraModelViewer; loaded: Promise<CustomEvent> }> {
  const holder = await fixture<HTMLDivElement>(html`<div style="inline-size:480px"></div>`);
  const viewer = document.createElement('lr-model-viewer') as LyraModelViewer;
  viewer.setAttribute('format', format); viewer.setAttribute('name', `shape.${format}`); viewer.setAttribute('alt', 'A reference shape');
  viewer.setAttribute('src', source);
  const loaded = oneEvent(viewer, 'lr-load') as Promise<CustomEvent>;
  holder.append(viewer);
  return { viewer, loaded };
}

describe('<lr-model-viewer> with the companion engine', () => {
  it('parses an OBJ model into a decorative WebGL canvas and adopts the engine fit', async function () {
    if (!hasWebgl2()) this.skip();
    const { viewer, loaded } = await mount(triangle, 'obj');
    const event = await loaded; await waitUntil(() => isReady(viewer), 'the model did not become ready', READY); await viewer.updateComplete;
    expect((event.detail as { format: string }).format).to.equal('obj');
    const canvas = viewportOf(viewer).querySelector('canvas')!;
    expect(canvas.getAttribute('aria-hidden')).to.equal('true'); expect(canvas.hasAttribute('tabindex')).to.equal(false);
    expect(canvas.getContext('webgl2') !== null).to.equal(true);
    expect(canvas.clientWidth).to.be.greaterThan(0); expect(canvas.clientHeight).to.be.greaterThan(0);
    const fitted = viewer.camera!;
    expect([fitted.yaw, fitted.pitch, fitted.distance, fitted.target.x, fitted.target.y, fitted.target.z].every(Number.isFinite)).to.equal(true);
    expect(fitted.distance).to.be.greaterThan(0);
    expect(partText(viewer, 'status')).to.contain('ready'); expect(viewer.shadowRoot!.querySelector('[part="error"]') === null).to.equal(true);
    await expect(viewer).to.be.accessible();
  });

  it('orbits and refits with real key presses and reports each user camera change once', async function () {
    if (!hasWebgl2()) this.skip();
    const { viewer } = await mount(triangle, 'obj'); await waitUntil(() => isReady(viewer), 'the model did not become ready', READY);
    const changes: Array<{ yaw: number }> = []; viewer.addEventListener('lr-camera-change', event => changes.push((event as CustomEvent<{ camera: { yaw: number } }>).detail.camera));
    const fitted = viewer.camera!.yaw; await focusByKeyboard(viewportOf(viewer));
    await sendKeys({ press: 'ArrowRight' }); await viewer.updateComplete;
    expect(changes).to.have.length(1); expect(viewer.camera!.yaw).to.be.greaterThan(fitted);
    await sendKeys({ press: 'Home' }); await viewer.updateComplete;
    expect(changes).to.have.length(2); expect(viewer.camera!.yaw).to.equal(fitted);
  });

  it('keeps keyboard control after a pointer press on the canvas', async function () {
    if (!hasWebgl2()) this.skip();
    const { viewer } = await mount(triangle, 'obj'); await waitUntil(() => isReady(viewer), 'the model did not become ready', READY);
    let changes = 0; viewer.addEventListener('lr-camera-change', () => { changes++; });
    const canvas = viewportOf(viewer).querySelector('canvas')!; const box = canvas.getBoundingClientRect();
    try {
      await sendMouse({ type: 'click', position: [Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2)] });
      // The press focuses the nearest focusable ancestor, which is the camera surface itself.
      expect(viewer.shadowRoot!.activeElement?.getAttribute('part')).to.equal('viewport');
      const before = changes; await sendKeys({ press: 'ArrowRight' });
      expect(changes).to.equal(before + 1);
    } finally { await resetMouse(); }
  });

  it('reports a pointer drag as a user camera change', async function () {
    if (!hasWebgl2()) this.skip();
    const { viewer } = await mount(triangle, 'obj'); await waitUntil(() => isReady(viewer), 'the model did not become ready', READY);
    const cameras: Array<{ yaw: number }> = []; viewer.addEventListener('lr-camera-change', event => cameras.push((event as CustomEvent<{ camera: { yaw: number } }>).detail.camera));
    const fitted = viewer.camera!.yaw; const box = viewportOf(viewer).querySelector('canvas')!.getBoundingClientRect();
    const x = Math.round(box.left + box.width / 2); const y = Math.round(box.top + box.height / 2);
    try {
      await sendMouse({ type: 'move', position: [x, y] }); await sendMouse({ type: 'down' });
      await sendMouse({ type: 'move', position: [x + 60, y + 10] }); await sendMouse({ type: 'move', position: [x + 120, y + 20] }); await sendMouse({ type: 'up' });
      await waitUntil(() => cameras.length > 0, 'the drag did not report a camera change', READY);
      expect(viewer.camera!.yaw).not.to.equal(fitted);
    } finally { await resetMouse(); }
  });

  it('renders a point cloud through the shared engine without a separate element', async function () {
    if (!hasWebgl2()) this.skip();
    const { viewer, loaded } = await mount(cloud, 'xyz');
    expect(((await loaded).detail as { format: string }).format).to.equal('xyz');
    await waitUntil(() => isReady(viewer), 'the point cloud did not become ready', READY);
    expect(viewportOf(viewer).querySelectorAll('canvas').length).to.equal(1);
    await expect(viewer).to.be.accessible();
  });

  it('renders an embedded glTF but rejects the same model with an external buffer, without requesting it', async function () {
    if (!hasWebgl2()) this.skip();
    const requested: string[] = []; const original = window.fetch;
    window.fetch = (input, init) => { requested.push(input instanceof Request ? input.url : String(input)); return original.call(window, input, init); };
    try {
      const control = await mount(gltf(), 'gltf'); await waitUntil(() => isReady(control.viewer), 'the embedded glTF did not become ready', READY);
      expect(control.viewer.shadowRoot!.querySelector('[part="error"]') === null).to.equal(true);
      const { viewer } = await mount(gltf('https://model-viewer-external.invalid/geometry.bin'), 'gltf'); const errors: unknown[] = [];
      viewer.addEventListener('lr-render-error', event => errors.push((event as CustomEvent).detail));
      await waitUntil(() => viewer.shadowRoot!.querySelector('[part="error"]') !== null, 'the external reference was not rejected', READY);
      expect(errors).to.have.length(1); expect(isReady(viewer)).to.equal(false);
      expect(partText(viewer, 'error')).to.contain('could not be displayed');
      expect(viewer.shadowRoot!.querySelector('[part="alternative"]')?.textContent).to.contain('A reference shape');
      expect(requested.filter(url => !url.startsWith('data:'))).to.deep.equal([]);
      await expect(viewer).to.be.accessible();
    } finally { window.fetch = original; }
  });
});
