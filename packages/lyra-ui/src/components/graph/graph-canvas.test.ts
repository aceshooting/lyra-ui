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
});
