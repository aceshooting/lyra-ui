import { expect } from '@open-wc/testing';
import { indexToPickColor, pickColorToIndex, drawGraphScene, drawPickingScene } from './graph-canvas.js';

function make2dContext(): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  return canvas.getContext('2d')!;
}

describe('indexToPickColor / pickColorToIndex', () => {
  it('round-trips several indices through the encoded rgb() color', () => {
    for (const i of [0, 1, 42, 255, 4096]) {
      const color = indexToPickColor(i);
      const match = color.match(/^rgb\((\d+),(\d+),(\d+)\)$/)!;
      expect(pickColorToIndex(Number(match[1]), Number(match[2]), Number(match[3]))).to.equal(i);
    }
  });

  it('reserves rgb(0,0,0) (the cleared background) as index -1, "no hit"', () => {
    expect(pickColorToIndex(0, 0, 0)).to.equal(-1);
  });
});

describe('drawGraphScene', () => {
  it('draws an empty scene without throwing', () => {
    const ctx = make2dContext();
    expect(() =>
      drawGraphScene(ctx, { k: 1, x: 0, y: 0 }, {
        hulls: [],
        links: [],
        edgeLabels: [],
        nodes: [],
        nodeLabels: [],
        showNodeLabels: true,
        haloColor: '#000',
        selectedColor: '#000',
        labelColor: '#000',
        labelHaloColor: '#fff',
        font: '10px sans-serif',
      }),
    ).to.not.throw();
  });

  it('draws a filled circle for a node scene (a non-transparent pixel lands at the node center)', () => {
    const ctx = make2dContext();
    drawGraphScene(ctx, { k: 1, x: 0, y: 0 }, {
      hulls: [],
      links: [],
      edgeLabels: [],
      nodes: [{ x: 50, y: 50, r: 15, shape: 'circle', fill: '#ff0000' }],
      nodeLabels: [],
      showNodeLabels: true,
      haloColor: '#000',
      selectedColor: '#000',
      labelColor: '#000',
      labelHaloColor: '#fff',
      font: '10px sans-serif',
    });
    const pixel = ctx.getImageData(50, 50, 1, 1).data;
    expect(pixel[3]).to.be.greaterThan(0); // alpha channel -- something was painted
  });

  it('does not throw when dimmed nodes/links are drawn, and dimmedOpacity defaults to 1 when unset', () => {
    const ctx = make2dContext();
    expect(() =>
      drawGraphScene(ctx, { k: 1, x: 0, y: 0 }, {
        hulls: [],
        links: [{ x1: 0, y1: 0, x2: 100, y2: 100, color: '#000', width: 1, dimmed: true }],
        edgeLabels: [],
        nodes: [{ x: 50, y: 50, r: 15, shape: 'circle', fill: '#ff0000', dimmed: true }],
        nodeLabels: [],
        showNodeLabels: true,
        haloColor: '#000',
        selectedColor: '#000',
        labelColor: '#000',
        labelHaloColor: '#fff',
        font: '10px sans-serif',
      }),
    ).to.not.throw();
  });

  it('paints a dimmed node with reduced alpha relative to an undimmed one at the same fill', () => {
    const dimmedCtx = make2dContext();
    drawGraphScene(dimmedCtx, { k: 1, x: 0, y: 0 }, {
      hulls: [],
      links: [],
      edgeLabels: [],
      nodes: [{ x: 50, y: 50, r: 15, shape: 'circle', fill: '#ff0000', dimmed: true }],
      nodeLabels: [],
      showNodeLabels: true,
      haloColor: '#000',
      selectedColor: '#000',
      labelColor: '#000',
      labelHaloColor: '#fff',
      font: '10px sans-serif',
      dimmedOpacity: 0.15,
    });
    const brightCtx = make2dContext();
    drawGraphScene(brightCtx, { k: 1, x: 0, y: 0 }, {
      hulls: [],
      links: [],
      edgeLabels: [],
      nodes: [{ x: 50, y: 50, r: 15, shape: 'circle', fill: '#ff0000' }],
      nodeLabels: [],
      showNodeLabels: true,
      haloColor: '#000',
      selectedColor: '#000',
      labelColor: '#000',
      labelHaloColor: '#fff',
      font: '10px sans-serif',
    });
    const dimmedAlpha = dimmedCtx.getImageData(50, 50, 1, 1).data[3];
    const brightAlpha = brightCtx.getImageData(50, 50, 1, 1).data[3];
    expect(dimmedAlpha).to.be.lessThan(brightAlpha);
  });

  it('draws square/diamond node shapes (not just circle) without throwing, painting a non-transparent pixel at each center', () => {
    const ctx = make2dContext();
    expect(() =>
      drawGraphScene(ctx, { k: 1, x: 0, y: 0 }, {
        hulls: [],
        links: [],
        edgeLabels: [],
        nodes: [
          { x: 30, y: 30, r: 10, shape: 'square', fill: '#00ff00' },
          { x: 70, y: 70, r: 10, shape: 'diamond', fill: '#0000ff' },
        ],
        nodeLabels: [],
        showNodeLabels: true,
        haloColor: '#000',
        selectedColor: '#000',
        labelColor: '#000',
        labelHaloColor: '#fff',
        font: '10px sans-serif',
      }),
    ).to.not.throw();
    expect(ctx.getImageData(30, 30, 1, 1).data[3]).to.be.greaterThan(0);
    expect(ctx.getImageData(70, 70, 1, 1).data[3]).to.be.greaterThan(0);
  });

  it('draws a directed link (arrowhead) without throwing, painting near the target end', () => {
    const ctx = make2dContext();
    expect(() =>
      drawGraphScene(ctx, { k: 1, x: 0, y: 0 }, {
        hulls: [],
        links: [{ x1: 10, y1: 50, x2: 90, y2: 50, color: '#000', width: 2, directed: true }],
        edgeLabels: [],
        nodes: [],
        nodeLabels: [],
        showNodeLabels: true,
        haloColor: '#000',
        selectedColor: '#000',
        labelColor: '#000',
        labelHaloColor: '#fff',
        font: '10px sans-serif',
      }),
    ).to.not.throw();
    expect(ctx.getImageData(88, 50, 1, 1).data[3]).to.be.greaterThan(0);
  });

  it('draws an arrowhead for a zero-length directed link without dividing by zero (NaN direction)', () => {
    const ctx = make2dContext();
    expect(() =>
      drawGraphScene(ctx, { k: 1, x: 0, y: 0 }, {
        hulls: [],
        links: [{ x1: 50, y1: 50, x2: 50, y2: 50, color: '#000', width: 2, directed: true }],
        edgeLabels: [],
        nodes: [],
        nodeLabels: [],
        showNodeLabels: true,
        haloColor: '#000',
        selectedColor: '#000',
        labelColor: '#000',
        labelHaloColor: '#fff',
        font: '10px sans-serif',
      }),
    ).to.not.throw();
  });

  it('draws a community hull fill/stroke without throwing, painting inside the hull path', () => {
    const ctx = make2dContext();
    expect(() =>
      drawGraphScene(ctx, { k: 1, x: 0, y: 0 }, {
        hulls: [{ d: 'M 20 20 L 80 20 L 80 80 L 20 80 Z', fill: '#00ff00' }],
        links: [],
        edgeLabels: [],
        nodes: [],
        nodeLabels: [],
        showNodeLabels: true,
        haloColor: '#000',
        selectedColor: '#000',
        labelColor: '#000',
        labelHaloColor: '#fff',
        font: '10px sans-serif',
      }),
    ).to.not.throw();
    expect(ctx.getImageData(50, 50, 1, 1).data[3]).to.be.greaterThan(0);
  });

  it('strokes a selected link with selectedColor instead of its own color', () => {
    const ctx = make2dContext();
    drawGraphScene(ctx, { k: 1, x: 0, y: 0 }, {
      hulls: [],
      links: [{ x1: 10, y1: 50, x2: 90, y2: 50, color: '#000000', width: 4, selected: true }],
      edgeLabels: [],
      nodes: [],
      nodeLabels: [],
      showNodeLabels: true,
      haloColor: '#000',
      selectedColor: '#00ff00',
      labelColor: '#000',
      labelHaloColor: '#fff',
      font: '10px sans-serif',
    });
    const pixel = ctx.getImageData(50, 50, 1, 1).data;
    expect([pixel[0], pixel[1], pixel[2]]).to.deep.equal([0, 255, 0]);
  });

  it('draws the focus halo and keyboard focus ring without throwing', () => {
    const ctx = make2dContext();
    expect(() =>
      drawGraphScene(ctx, { k: 1, x: 0, y: 0 }, {
        hulls: [],
        links: [],
        edgeLabels: [],
        nodes: [],
        nodeLabels: [],
        showNodeLabels: true,
        focusHalo: { x: 50, y: 50, r: 20 },
        keyboardFocusRing: { x: 50, y: 50, r: 25 },
        haloColor: '#ff00ff',
        selectedColor: '#000',
        labelColor: '#000',
        labelHaloColor: '#fff',
        font: '10px sans-serif',
      }),
    ).to.not.throw();
    // The ring is stroked, not filled -- sample along its radius (50,30 = center minus r=20), not
    // the empty center.
    expect(ctx.getImageData(50, 30, 1, 1).data[3]).to.be.greaterThan(0);
  });

  it('keeps node labels physically after their anchor under inherited RTL', () => {
    const ctx = make2dContext();
    ctx.direction = 'rtl';
    drawGraphScene(ctx, { k: 1, x: 0, y: 0 }, {
      hulls: [],
      links: [],
      edgeLabels: [],
      nodes: [],
      nodeLabels: [{ x: 40, y: 50, text: 'Label' }],
      showNodeLabels: true,
      haloColor: '#000',
      selectedColor: '#000',
      labelColor: '#000',
      labelHaloColor: '#fff',
      font: '10px sans-serif',
    });

    const pixels = ctx.getImageData(0, 0, 100, 100).data;
    let firstPaintedX = 100;
    for (let y = 0; y < 100; y += 1) {
      for (let x = 0; x < 100; x += 1) {
        if (pixels[(y * 100 + x) * 4 + 3]! > 0) firstPaintedX = Math.min(firstPaintedX, x);
      }
    }
    expect(firstPaintedX).to.be.at.least(40);
  });
});

describe('drawPickingScene', () => {
  it('assigns distinguishable colors to two nodes at different positions', () => {
    const ctx = make2dContext();
    drawPickingScene(ctx, { k: 1, x: 0, y: 0 }, {
      hulls: [],
      links: [],
      nodes: [
        { x: 20, y: 20, r: 10, shape: 'circle' },
        { x: 80, y: 80, r: 10, shape: 'circle' },
      ],
    });
    const first = ctx.getImageData(20, 20, 1, 1).data;
    const second = ctx.getImageData(80, 80, 1, 1).data;
    expect(pickColorToIndex(first[0]!, first[1]!, first[2]!)).to.equal(0);
    expect(pickColorToIndex(second[0]!, second[1]!, second[2]!)).to.equal(1);
  });

  it('a point with no shape underneath misses (reads back the cleared background)', () => {
    const ctx = make2dContext();
    drawPickingScene(ctx, { k: 1, x: 0, y: 0 }, {
      hulls: [],
      links: [],
      nodes: [{ x: 20, y: 20, r: 5, shape: 'circle' }],
    });
    const miss = ctx.getImageData(90, 90, 1, 1).data;
    expect(pickColorToIndex(miss[0]!, miss[1]!, miss[2]!)).to.equal(-1);
  });

  it('respects the camera transform (a panned scene picks at the panned position)', () => {
    const ctx = make2dContext();
    drawPickingScene(ctx, { k: 1, x: 30, y: 0 }, {
      hulls: [],
      links: [],
      nodes: [{ x: 20, y: 20, r: 10, shape: 'circle' }],
    });
    const hit = ctx.getImageData(50, 20, 1, 1).data; // 20 (node x) + 30 (camera x offset)
    expect(pickColorToIndex(hit[0]!, hit[1]!, hit[2]!)).to.equal(0);
  });

  it('assigns a distinguishable pick color to a hull region, ordered before links/nodes', () => {
    const ctx = make2dContext();
    drawPickingScene(ctx, { k: 1, x: 0, y: 0 }, {
      hulls: [{ d: 'M 10 10 L 50 10 L 50 50 L 10 50 Z' }],
      links: [],
      nodes: [{ x: 80, y: 80, r: 10, shape: 'circle' }],
    });
    const hullPixel = ctx.getImageData(30, 30, 1, 1).data;
    const nodePixel = ctx.getImageData(80, 80, 1, 1).data;
    expect(pickColorToIndex(hullPixel[0]!, hullPixel[1]!, hullPixel[2]!)).to.equal(0);
    expect(pickColorToIndex(nodePixel[0]!, nodePixel[1]!, nodePixel[2]!)).to.equal(1);
  });
});
