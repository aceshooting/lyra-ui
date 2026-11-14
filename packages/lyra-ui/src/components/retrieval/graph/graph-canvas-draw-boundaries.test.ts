import { expect } from '@open-wc/testing';
import { drawGraphScene, drawPickingScene, type CanvasScene } from './graph-canvas.js';

type Op = { name: string; args: unknown[]; state: { globalAlpha: number; lineWidth: number; fillStyle: string; strokeStyle: string } };

/** Records each drawing call on a real 2D context together with the paint state it used. */
function recordingContext(width = 200, height = 200): { ctx: CanvasRenderingContext2D; ops: Op[]; assigned: Map<string, unknown[]> } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const real = canvas.getContext('2d')!;
  const ops: Op[] = [];
  const assigned = new Map<string, unknown[]>();
  const ctx = new Proxy(real, {
    get(target, key) {
      const value = Reflect.get(target, key, target) as unknown;
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        ops.push({
          name: String(key),
          args,
          state: {
            globalAlpha: target.globalAlpha,
            lineWidth: target.lineWidth,
            fillStyle: String(target.fillStyle),
            strokeStyle: String(target.strokeStyle),
          },
        });
        return (value as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
    set(target, key, value) {
      const list = assigned.get(String(key)) ?? [];
      list.push(value);
      assigned.set(String(key), list);
      return Reflect.set(target, key, value, target);
    },
  });
  return { ctx, ops, assigned };
}

function baseScene(overrides: Partial<CanvasScene> = {}): CanvasScene {
  return {
    hulls: [],
    links: [],
    edgeLabels: [],
    nodes: [],
    nodeLabels: [],
    showNodeLabels: false,
    haloColor: 'rgb(0, 0, 255)',
    selectedColor: 'rgb(255, 0, 0)',
    labelColor: 'rgb(0, 0, 0)',
    labelHaloColor: 'rgb(255, 255, 255)',
    font: '12px sans-serif',
    ...overrides,
  };
}

const camera = { x: 0, y: 0, k: 1 };

describe('drawGraphScene() boundaries', () => {
  it('draws a finite arrowhead for a zero-length directed link instead of dividing by zero', () => {
    const { ctx, ops } = recordingContext();
    drawGraphScene(ctx, camera, baseScene({
      links: [{ x1: 50, y1: 50, x2: 50, y2: 50, color: 'rgb(0, 128, 0)', width: 2, directed: true }],
    }));
    const fill = ops.findIndex((op) => op.name === 'fill');
    expect(fill).to.be.greaterThan(-1);
    const arrow = ops.slice(0, fill).filter((op) => op.name === 'lineTo');
    expect(arrow.length).to.be.at.least(2);
    for (const op of arrow) for (const value of op.args) expect(Number.isFinite(value)).to.equal(true);
  });

  it('paints a dimmed link at the scene dimmed opacity and a resting link at full opacity', () => {
    const { ctx, ops } = recordingContext();
    drawGraphScene(ctx, camera, baseScene({
      dimmedOpacity: 0.25,
      links: [
        { x1: 10, y1: 10, x2: 90, y2: 10, color: 'rgb(0, 128, 0)', width: 2, dimmed: true },
        { x1: 10, y1: 40, x2: 90, y2: 40, color: 'rgb(0, 128, 0)', width: 2 },
      ],
    }));
    const strokes = ops.filter((op) => op.name === 'stroke').map((op) => op.state.globalAlpha);
    expect(strokes).to.include(0.25);
    expect(strokes).to.include(1);
  });

  it('keeps a 16px label culling margin when the scene font has no leading pixel size', () => {
    const { ctx, ops } = recordingContext();
    drawGraphScene(ctx, camera, baseScene({
      font: 'bold sans-serif',
      showNodeLabels: true,
      // Both labels sit 10px above the viewport: inside the 16px fallback margin, so they still paint.
      edgeLabels: [{ x: 100, y: -10, text: 'edge' }],
      nodeLabels: [{ x: 100, y: -10, text: 'node' }],
    }), { width: 200, height: 200 });
    const painted = ops.filter((op) => op.name === 'fillText').map((op) => op.args[0]);
    expect(painted).to.deep.equal(['edge', 'node']);
  });

  it('draws an expand badge even when the scene supplies no badge colors', () => {
    const { ctx, ops, assigned } = recordingContext();
    drawGraphScene(ctx, camera, baseScene({ expandIndicators: [{ x: 60, y: 60, r: 10 }] }));
    expect(assigned.get('fillStyle')).to.include('');
    expect(assigned.get('strokeStyle')).to.include('');
    const badge = ops.filter((op) => (op.name === 'fill' || op.name === 'stroke') && op.args[0] instanceof Path2D);
    expect(badge.map((op) => op.name)).to.deep.equal(['fill', 'stroke']);
    // The "+" cross is stroked in the label color after the badge outline.
    expect(ops.filter((op) => op.name === 'stroke').at(-1)!.state.strokeStyle).to.equal('#000000');
  });

  it('strokes the keyboard focus ring at the default medium border width without scene border widths', () => {
    const { ctx, ops } = recordingContext();
    drawGraphScene(ctx, camera, baseScene({ keyboardFocusRing: { x: 50, y: 50, r: 12 } }));
    const arc = ops.findIndex((op) => op.name === 'arc');
    const stroke = ops.slice(arc).find((op) => op.name === 'stroke')!;
    expect(stroke.state.lineWidth).to.equal(2);
    expect(stroke.state.strokeStyle).to.equal('#0000ff');
  });
});

describe('drawPickingScene() camera scale fallback', () => {
  for (const k of [0, Number.NaN]) {
    it(`keeps the 26 world-px minimum pick stroke for a degenerate camera scale (${String(k)})`, () => {
      const { ctx, ops } = recordingContext();
      drawPickingScene(ctx, { x: 0, y: 0, k }, {
        hulls: [],
        links: [{ x1: 0, y1: 0, x2: 10, y2: 0, width: 1 }],
        nodes: [],
      });
      const stroke = ops.find((op) => op.name === 'stroke')!;
      // (24px target + 2px raster guard) / a fallback scale of 1.
      expect(stroke.state.lineWidth).to.equal(26);
    });
  }

  it('divides the minimum pick stroke by a real camera scale', () => {
    const { ctx, ops } = recordingContext();
    drawPickingScene(ctx, { x: 0, y: 0, k: -2 }, {
      hulls: [],
      links: [{ x1: 0, y1: 0, x2: 10, y2: 0, width: 1 }],
      nodes: [],
    });
    expect(ops.find((op) => op.name === 'stroke')!.state.lineWidth).to.equal(13);
  });
});
