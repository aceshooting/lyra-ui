import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { LyraGraph } from './graph.js';

interface ColorFootprint {
  readonly pixels: number;
  readonly area: number;
}

function colorFootprint(canvas: HTMLCanvasElement, color: 'red' | 'blue'): ColorFootprint {
  const image = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
  let pixels = 0;
  let left = canvas.width;
  let right = 0;
  let top = canvas.height;
  let bottom = 0;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      const red = image.data[index]!;
      const green = image.data[index + 1]!;
      const blue = image.data[index + 2]!;
      const alpha = image.data[index + 3]!;
      const matches = color === 'red'
        ? red > 200 && green < 50 && blue < 50 && alpha > 200
        : blue > 200 && red < 50 && green < 50 && alpha > 200;
      if (!matches) continue;
      pixels += 1;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  return { pixels, area: pixels ? (right - left + 1) * (bottom - top + 1) : 0 };
}

describe('3D graph canvas rendering', () => {
  it('renders square and diamond node types with their distinct public shapes', async () => {
    const el = await fixture<LyraGraph>(html`
      <lr-graph view="3d" style="inline-size:640px;block-size:480px"
        .nodes=${[
          { id: 'square', type: 'square', position: { x: -70, y: 0, z: 0 }, color: '#ff0000' },
          { id: 'diamond', type: 'diamond', position: { x: 70, y: 0, z: 0 }, color: '#0000ff' },
        ]}
        .nodeTypes=${[
          { id: 'square', label: 'Square', shape: 'square' as const },
          { id: 'diamond', label: 'Diamond', shape: 'diamond' as const },
        ]}
        .camera=${{ yaw: 0, pitch: 0, distance: 300, target: { x: 0, y: 0, z: 0 } }}
        node-labels="none"></lr-graph>
    `);
    const canvas = el.shadowRoot!.querySelector<HTMLCanvasElement>('[part="spatial-canvas"]')!;
    await waitUntil(() => colorFootprint(canvas, 'red').pixels > 20 && colorFootprint(canvas, 'blue').pixels > 20,
      'Both typed nodes are painted');

    const square = colorFootprint(canvas, 'red');
    const diamond = colorFootprint(canvas, 'blue');
    expect(square.pixels / square.area, 'the square fills its raster bounds').to.be.greaterThan(0.85);
    expect(diamond.pixels / diamond.area, 'the diamond leaves its corner pixels unfilled').to.be.within(0.35, 0.7);
  });

  it('adds a visible arrowhead when a public 3D edge is directed', async () => {
    const el = await fixture<LyraGraph>(html`
      <lr-graph view="3d" style="inline-size:640px;block-size:480px" node-labels="none"
        .nodes=${[
          { id: 'from', position: { x: -60, y: 0, z: 0 }, color: '#ff0000' },
          { id: 'to', position: { x: 60, y: 0, z: 0 }, color: '#ff0000' },
        ]}
        .edges=${[{ id: 'relationship', source: 'from', target: 'to', color: '#0000ff', width: 4 }]}
        .camera=${{ yaw: 0, pitch: 0, distance: 300, target: { x: 0, y: 0, z: 0 } }}></lr-graph>
    `);
    const canvas = el.shadowRoot!.querySelector<HTMLCanvasElement>('[part="spatial-canvas"]')!;
    await waitUntil(() => colorFootprint(canvas, 'blue').pixels > 0, 'The undirected link is painted');
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const undirectedPixels = colorFootprint(canvas, 'blue').pixels;

    el.edges = [{ id: 'relationship', source: 'from', target: 'to', color: '#0000ff', width: 4, directed: true }];
    await el.updateComplete;
    await waitUntil(() => colorFootprint(canvas, 'blue').pixels > undirectedPixels + 5,
      'The directed link paints its arrowhead');
    expect(colorFootprint(canvas, 'blue').pixels).to.be.greaterThan(undirectedPixels + 5);
  });

  it('fits a spread of positioned nodes with the focused canvas Home control', async () => {
    const initialCamera = { yaw: 0, pitch: 0, distance: 150, target: { x: 0, y: 0, z: 0 } };
    const el = await fixture<LyraGraph>(html`
      <lr-graph view="3d" style="inline-size:320px;block-size:240px" node-labels="none"
        .nodes=${[
          { id: 'left', position: { x: -1000, y: 0, z: 0 } },
          { id: 'right', position: { x: 1000, y: 0, z: 0 } },
        ]}
        .camera=${initialCamera}></lr-graph>
    `);
    const canvas = el.shadowRoot!.querySelector<HTMLCanvasElement>('[part="spatial-canvas"]')!;
    await focusByKeyboard(canvas);
    const changed = oneEvent(el, 'lr-camera-change');
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect((await changed).detail.camera.distance).to.be.greaterThan(initialCamera.distance);

    const canvasBounds = canvas.getBoundingClientRect();
    const hostBounds = el.getBoundingClientRect();
    for (const id of ['left', 'right']) {
      const point = el.getNodeScreenPosition(id)!;
      const x = hostBounds.left + point.x;
      const y = hostBounds.top + point.y;
      expect(x, `${id} node remains inside the canvas horizontally`).to.be.within(canvasBounds.left, canvasBounds.right);
      expect(y, `${id} node remains inside the canvas vertically`).to.be.within(canvasBounds.top, canvasBounds.bottom);
    }
  });

  it('focuses a public 3D node without changing its authored world position', async () => {
    const el = await fixture<LyraGraph>(html`
      <lr-graph view="3d" style="inline-size:320px;block-size:240px" node-labels="none"
        .nodes=${[
          { id: 'origin', position: { x: 0, y: 0, z: 0 } },
          { id: 'target', position: { x: 80, y: 20, z: -10 } },
        ]}
        .camera=${{ yaw: 0, pitch: 0, distance: 300, target: { x: 0, y: 0, z: 0 } }}></lr-graph>
    `);
    const worldPosition = el.getNodePosition3d('target');
    const changed = oneEvent(el, 'lr-camera-change');
    expect(await el.focusNode('target')).to.equal(true);
    expect((await changed).detail.camera.target).to.deep.equal(worldPosition);
    expect(el.getNodePosition3d('target')).to.deep.equal(worldPosition);

    const point = el.getNodeScreenPosition('target')!;
    const canvas = el.shadowRoot!.querySelector<HTMLCanvasElement>('[part="spatial-canvas"]')!;
    const hostBounds = el.getBoundingClientRect();
    const canvasBounds = canvas.getBoundingClientRect();
    expect(point.x).to.be.closeTo(canvasBounds.left - hostBounds.left + canvas.clientWidth / 2, 1);
    expect(point.y).to.be.closeTo(canvasBounds.top - hostBounds.top + canvas.clientHeight / 2, 1);
  });
});
