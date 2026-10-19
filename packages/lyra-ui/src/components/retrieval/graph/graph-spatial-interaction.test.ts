import { expect, fixture, html, waitUntil, oneEvent } from '@open-wc/testing';
import { setReducedMotion } from '../../../../test/wtr-media.js';
import { sendMouse, sendWheel, resetMouse, hoverUntilMatched } from '../../../../test/wtr-mouse.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { LyraGraph } from './graph.js';

const nodes = [
  { id: 'near', label: 'Near', position: { x: 0, y: 0, z: 80 } },
  { id: 'far', label: 'Far', position: { x: 0, y: 0, z: -80 } },
];
const camera = { yaw: 0, pitch: 0, distance: 300, target: { x: 0, y: 0, z: 0 } };

async function mount(): Promise<LyraGraph> {
  return fixture<LyraGraph>(html`<lr-graph view="3d" .nodes=${nodes} .camera=${camera}></lr-graph>`);
}

describe('graph spatial views', () => {
  it('leaves the existing 2D SVG default and activation coordinates unchanged when unset', async () => {
    const el = await fixture<LyraGraph>(html`<lr-graph .nodes=${nodes} seed="1"></lr-graph>`);
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, '2D nodes render after optional peer loading', { timeout: 5000 });
    expect(el.view).to.equal('2d');
    expect(el.shadowRoot!.querySelectorAll('[part="spatial-toolbar"]').length).to.equal(0);
    const position = el.getNodePosition('near');
    const event = oneEvent(el, 'lr-node-activate');
    (el.shadowRoot!.querySelector('[part="node"]') as SVGElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const activated = await event;
    expect(activated.detail.x).to.equal(position!.x);
    expect(activated.detail.z).to.equal(undefined);
  });

  it('renders 3D without loading d3 and exposes immutable world coordinates', async () => {
    let loads = 0;
    const el = new LyraGraph();
    Object.assign(el, { loadLibrary: async () => { loads++; return null; } });
    el.view = '3d';
    el.nodes = nodes;
    await fixture(el);
    expect(loads).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="spatial-canvas"]').length).to.equal(1);
    expect(el.getNodePosition3d('near')).to.deep.equal({ x: 0, y: 0, z: 80 });
    expect(el.getNodeScreenPosition('near')?.x).to.be.a('number');
    expect(nodes[0]!.position).to.deep.equal({ x: 0, y: 0, z: 80 });
  });

  it('fits the initial default camera to the allocated narrow canvas', async () => {
    const spread = [{ id: 'left', position: { x: -1000, y: 0, z: 0 } }, { id: 'right', position: { x: 1000, y: 0, z: 0 } }];
    const el = await fixture<LyraGraph>(html`<lr-graph view="3d" style="inline-size:320px" .height=${1000} .nodes=${spread}></lr-graph>`);
    const canvas = el.shadowRoot!.querySelector<HTMLCanvasElement>('[part="spatial-canvas"]')!;
    const canvasBounds = canvas.getBoundingClientRect(), hostBounds = el.getBoundingClientRect();
    for (const { id } of spread) {
      const point = el.getNodeScreenPosition(id)!;
      expect(hostBounds.left + point.x).to.be.greaterThan(canvasBounds.left);
      expect(hostBounds.left + point.x).to.be.lessThan(canvasBounds.right);
    }
  });

  it('fit() reframes a spatial camera that left far nodes outside the canvas and is a safe no-op while disconnected', async () => {
    const spread = [{ id: 'left', position: { x: -1000, y: 0, z: 0 } }, { id: 'right', position: { x: 1000, y: 0, z: 0 } }];
    const el = await fixture<LyraGraph>(html`<lr-graph view="3d" style="inline-size:320px" .height=${400} .nodes=${spread} .camera=${camera}></lr-graph>`);
    const canvas = el.shadowRoot!.querySelector<HTMLCanvasElement>('[part="spatial-canvas"]')!;
    const inside = (id: string) => {
      const point = el.getNodeScreenPosition(id), bounds = canvas.getBoundingClientRect(), host = el.getBoundingClientRect();
      return point !== undefined && host.left + point.x > bounds.left && host.left + point.x < bounds.right;
    };
    expect(inside('left') && inside('right'), 'the explicit camera leaves the spread outside').to.equal(false);
    el.fit({ padding: 20 });
    await waitUntil(() => inside('left') && inside('right'), 'fit frames both nodes', { timeout: 3000 });

    el.remove();
    expect(() => el.fit()).to.not.throw();
  });

  it('provides localized keyboard orbit controls and reverses horizontal movement in RTL', async () => {
    const el = await mount();
    el.strings = { graphOrbitLeft: 'Tourner à gauche', graphSpatialInstructions: 'Utilisez les flèches' };
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector<HTMLCanvasElement>('[part="spatial-canvas"]')!;
    expect(el.shadowRoot!.textContent).to.include('Tourner à gauche');
    expect(el.shadowRoot!.textContent).to.include('Utilisez les flèches');
    await focusByKeyboard(canvas);
    const first = oneEvent(el, 'lr-camera-change');
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    const ltr = await first;
    expect(ltr.detail.camera.yaw).to.be.greaterThan(0);
    el.camera = { ...camera };
    el.dir = 'rtl';
    await el.updateComplete;
    const second = oneEvent(el, 'lr-camera-change');
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect((await second).detail.camera.yaw).to.be.lessThan(0);
  });

  it('pans the camera with a shifted pointer drag while leaving its facing unchanged', async () => {
    const el = await mount();
    const canvas = el.shadowRoot!.querySelector<HTMLCanvasElement>('[part="spatial-canvas"]')!;
    const changed = oneEvent(el, 'lr-camera-change');
    canvas.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 5, clientX: 20, clientY: 20, button: 0, shiftKey: true }));
    canvas.dispatchEvent(new PointerEvent('pointermove', { pointerId: 5, clientX: 44, clientY: 32, shiftKey: true }));
    const next = (await changed).detail.camera;
    expect(next.target).not.to.deep.equal(camera.target);
    expect(next.yaw).to.equal(camera.yaw);
    expect(next.pitch).to.equal(camera.pitch);
    expect(next.distance).to.equal(camera.distance);
    canvas.dispatchEvent(new PointerEvent('pointerup', { pointerId: 5, clientX: 44, clientY: 32, button: 0, shiftKey: true }));
  });

  it('zooms the focused spatial canvas in response to native wheel input', async () => {
    const el = await mount();
    const canvas = el.shadowRoot!.querySelector<HTMLCanvasElement>('[part="spatial-canvas"]')!;
    await hoverUntilMatched(canvas, 'Spatial canvas receives native wheel input');
    await focusByKeyboard(canvas);
    const changed = oneEvent(el, 'lr-camera-change');
    try {
      await sendWheel({ deltaX: 0, deltaY: -120 });
      expect((await changed).detail.camera.distance).to.be.lessThan(camera.distance);
    } finally { await resetMouse(); }
  });

  it('makes every item reachable through visible list pages and retains node activation', async () => {
    const el = await fixture<LyraGraph>(html`<lr-graph view="list" .nodes=${Array.from({ length: 205 }, (_, index) => ({ id: `n${index}`, label: `Node ${index}` }))}></lr-graph>`);
    expect(el.shadowRoot!.querySelectorAll('[part="spatial-list-item"]').length).to.equal(200);
    (el.shadowRoot!.querySelector('[data-spatial-action="next"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="spatial-list-item"]').length).to.equal(5);
    const activated = oneEvent(el, 'lr-node-activate');
    (el.shadowRoot!.querySelector('[part="spatial-list-item"]') as HTMLButtonElement).click();
    expect((await activated).detail.nodeId).to.equal('n200');
    await expect(el).to.be.accessible();
  });

  it('expands a list node after two non-repeated Enter activations', async () => {
    const el = await fixture<LyraGraph>(html`<lr-graph view="list" .nodes=${[{ id: 'expand-me', label: 'Expand me' }]}></lr-graph>`);
    const item = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-node-id="expand-me"]')!;
    await focusByKeyboard(item);
    let expansions = 0;
    el.addEventListener('lr-node-expand', () => { expansions++; });
    const expanded = oneEvent(el, 'lr-node-expand');
    item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(expansions).to.equal(0);
    item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, repeat: true }));
    expect(expansions).to.equal(0);
    item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect((await expanded).detail.nodeId).to.equal('expand-me');
    expect(expansions).to.equal(1);
  });

  it('releases a cancelled gesture and returns to the 2D renderer', async () => {
    const el = await mount();
    const canvas = el.shadowRoot!.querySelector<HTMLCanvasElement>('[part="spatial-canvas"]')!;
    canvas.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 10, clientY: 10, button: 0 }));
    canvas.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 }));
    let changed = 0;
    el.addEventListener('lr-camera-change', () => { changed++; });
    canvas.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 150, clientY: 100 }));
    await el.updateComplete;
    expect(changed).to.equal(0);
    el.view = '2d';
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2, '2D nodes render after optional peer loading', { timeout: 5000 });
    expect(el.shadowRoot!.querySelectorAll('[part="spatial-canvas"]').length).to.equal(0);
  });

  it('uses the host accessible name and keeps community membership counts distinct', async () => {
    const el = await fixture<LyraGraph>(html`<lr-graph view="3d" aria-label="Host graph" label="Other name" .nodes=${nodes}></lr-graph>`);
    expect(el.shadowRoot!.querySelector('[part="spatial-canvas"]')!.getAttribute('aria-label')).to.equal('Host graph');
    el.view = 'list';
    el.nodes = [{ ...nodes[0]!, communityId: 'group' }, nodes[1]!];
    el.communities = [{ id: 'group', label: 'Both', memberIds: ['near', 'near', 'far'] }];
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).to.include('Community Both, 2 nodes');
    expect(el.shadowRoot!.textContent).not.to.include('{count}');
  });

  it('reveals a requested list page without moving DOM focus', async () => {
    const el = await fixture<LyraGraph>(html`<lr-graph view="list" .nodes=${Array.from({ length: 205 }, (_, index) => ({ id: `n${index}` }))}></lr-graph>`);
    const control = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-spatial-action="list"]')!;
    await focusByKeyboard(control);
    expect(await el.focusNode('n204')).to.equal(true);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[data-node-id="n204"]').length).to.equal(1);
    expect(el.shadowRoot!.activeElement === control).to.equal(true);
  });

  it('activates the visually frontmost overlapping node with a native pointer', async () => {
    const el = await mount();
    const position = el.getNodeScreenPosition('near')!;
    const bounds = el.getBoundingClientRect();
    const event = oneEvent(el, 'lr-node-activate');
    try {
      await sendMouse({ type: 'click', position: [Math.round(bounds.left + position.x), Math.round(bounds.top + position.y)] });
      const activated = await event;
      expect(activated.detail.nodeId).to.equal('near');
      expect(activated.detail.z).to.equal(80);
      expect(activated.detail.x).to.equal(0);
    } finally { await resetMouse(); }
  });

  it('falls back to the visible list when the drawing context is unavailable', async () => {
    const original = HTMLCanvasElement.prototype.getContext;
    let el: LyraGraph;
    try {
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: () => null });
      el = await mount();
      await el.updateComplete;
      expect(el.shadowRoot!.querySelectorAll('[part="spatial-list-item"]').length).to.equal(2);
      expect(el.shadowRoot!.textContent).to.include('The 3D drawing surface is unavailable.');
      expect(el.shadowRoot!.querySelectorAll('[part="error"][role="alert"]').length).to.equal(0);
    } finally { Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: original }); }
  });

  it('reconnects without retaining a drag or starting an optional-peer load', async () => {
    const el = await mount();
    const parent = el.parentNode!;
    const canvas = el.shadowRoot!.querySelector<HTMLCanvasElement>('[part="spatial-canvas"]')!;
    canvas.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 17, clientX: 10, clientY: 10 }));
    el.remove();
    parent.appendChild(el);
    await el.updateComplete;
    const before = el.getNodeScreenPosition('near');
    canvas.dispatchEvent(new PointerEvent('pointermove', { pointerId: 17, clientX: 100, clientY: 100 }));
    expect(el.getNodeScreenPosition('near')).to.deep.equal(before);
    expect(el.shadowRoot!.querySelectorAll('[part="spatial-canvas"]').length).to.equal(1);
  });

  for (const preference of ['reduce', 'no-preference'] as const) {
    it(`keeps spatial positions static while preserving user camera controls with ${preference}`, async () => {
      await setReducedMotion(preference);
      try {
        const el = await mount();
        const before = el.getNodePosition3d('near');
        let cameraEvents = 0;
        el.addEventListener('lr-camera-change', () => { cameraEvents++; });
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        expect(cameraEvents).to.equal(0);
        expect(el.getNodePosition3d('near')).to.deep.equal(before);
        const event = oneEvent(el, 'lr-camera-change');
        (el.shadowRoot!.querySelector('[data-spatial-action="right"]') as HTMLButtonElement).click();
        expect((await event).detail.camera.yaw).to.be.greaterThan(0);
      } finally { await setReducedMotion('no-preference'); }
    });
  }

  it('wraps localized controls within a narrow allocation and keeps a populated accessible view', async () => {
    const el = await fixture<LyraGraph>(html`<lr-graph view="3d" style="inline-size:320px;max-inline-size:100%" .nodes=${nodes}
      .strings=${{ graphOrbitLeft: 'Orbit toward the left side of this graph' }}></lr-graph>`);
    const toolbar = el.shadowRoot!.querySelector<HTMLElement>('[part="spatial-toolbar"]')!;
    expect(toolbar.scrollWidth).to.be.at.most(toolbar.clientWidth + 1);
    expect(el.shadowRoot!.querySelectorAll('[part="spatial-canvas"]').length).to.equal(1);
    await expect(el).to.be.accessible();
  });


  it('exposes controlled list selection as current with selection mode unset', async () => {
    const el = await fixture<LyraGraph>(html`<lr-graph view="list" .nodes=${nodes} .selectedNodeIds=${['near']}></lr-graph>`);
    const current = el.shadowRoot!.querySelector<HTMLElement>('[data-node-id="near"]')!;
    const other = el.shadowRoot!.querySelector<HTMLElement>('[data-node-id="far"]')!;
    expect(current.getAttribute('aria-current')).to.equal('true');
    expect(current.hasAttribute('aria-pressed')).to.equal(false);
    expect(getComputedStyle(current).backgroundColor).not.to.equal(getComputedStyle(other).backgroundColor);
    await focusByKeyboard(current);
    const activated = oneEvent(el, 'lr-node-activate');
    current.click();
    expect((await activated).detail.nodeId).to.equal('near');
    el.selectedNodeIds = ['far'];
    await el.updateComplete;
    expect(current.hasAttribute('aria-current')).to.equal(false);
    expect(other.getAttribute('aria-current')).to.equal('true');
  });

  it('snapshots authored position and camera values without allowing later source mutation', async () => {
    const point = { x: 10, y: 20, z: 30 };
    const sourceCamera = { ...camera, target: { x: 1, y: 2, z: 3 } };
    const el = await fixture<LyraGraph>(html`<lr-graph view="3d" .nodes=${[{ id: 'a', position: point }]} .camera=${sourceCamera}></lr-graph>`);
    point.x = 999;
    sourceCamera.target.x = 999;
    expect(el.getNodePosition3d('a')?.x).to.equal(10);
    expect(el.camera?.target.x).to.equal(1);
    expect(Object.isFrozen(el.getNodePosition3d('a'))).to.equal(true);
    expect(Object.isFrozen(el.camera?.target)).to.equal(true);
  });

  it('ignores stale 2D loading completion after switching to a spatial view', async () => {
    let resolveLoad!: (value: null) => void;
    const el = new LyraGraph();
    Object.assign(el, { loadLibrary: () => new Promise<null>((resolve) => { resolveLoad = resolve; }) });
    el.nodes = nodes;
    await fixture(el);
    el.view = '3d';
    await el.updateComplete;
    resolveLoad(null);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="spatial-canvas"]').length).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
    expect(el.getAttribute('aria-busy')).to.equal('false');
  });


  it('resolves a declarative list focus page within the initial render', async () => {
    const el = await fixture<LyraGraph>(html`<lr-graph view="list" focus-node-id="n204"
      .nodes=${Array.from({ length: 205 }, (_, index) => ({ id: `n${index}` }))}></lr-graph>`);
    expect(el.shadowRoot!.querySelectorAll('[part="spatial-list-item"]').length).to.equal(5);
    expect(el.shadowRoot!.querySelectorAll('[data-node-id="n204"]').length).to.equal(1);
  });

});
