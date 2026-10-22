import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './chart-3d.js';
import type { LyraChart3d, LyraChart3dColumns } from './chart-3d.class.js';
import { capture, changedPixels, clickCenter, loseContext, matches, nativeCanvas, requireWebgl2 } from '../../../../test/native-3d-ui.js';
import { resetMouse } from '../../../../test/wtr-mouse.js';

const RED = [255, 0, 0] as const;
const BLUE = [0, 0, 255] as const;

function planar(prefix: string, size?: Float32Array): LyraChart3dColumns {
  return {
    ids: [`${prefix}-left`, `${prefix}-center`, `${prefix}-right`],
    x: new Float32Array([-1, 0, 1]),
    y: new Float32Array([-1, 0, 1]),
    z: new Float32Array(3),
    ...(size ? { size } : {}),
  };
}

const scope = 'inline-size:480px;--lr-color-brand:rgb(255,0,0);--lr-focus-ring-color:rgb(255,0,0);--lr-theme-color-chart-1:rgb(0,0,255)';

async function ready(el: LyraChart3d): Promise<HTMLCanvasElement> {
  await waitUntil(() => el.shadowRoot!.querySelector('[part="fit-button"]') !== null,
    'The chart UI did not become ready', { timeout: 15000 });
  return nativeCanvas(el, 'engine');
}

/** Whether a pixel near the canvas center matches; axis lines cross the center, so a window is searched. */
function nearCenter(canvas: HTMLCanvasElement, pixels: Uint8Array, color: readonly number[], radius = 8): boolean {
  const cx = Math.floor(canvas.width / 2);
  const cy = Math.floor(canvas.height / 2);
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const offset = ((cy + dy) * canvas.width + cx + dx) * 4;
      if (matches([pixels[offset]!, pixels[offset + 1]!, pixels[offset + 2]!], color)) return true;
    }
  }
  return false;
}

/** Pixels of one color in the left and right halves of the canvas. */
function halves(canvas: HTMLCanvasElement, pixels: Uint8Array, color: readonly number[]): [number, number] {
  let left = 0;
  let right = 0;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const offset = (y * canvas.width + x) * 4;
      if (!matches([pixels[offset]!, pixels[offset + 1]!, pixels[offset + 2]!], color)) continue;
      if (x < canvas.width / 2) left++;
      else right++;
    }
  }
  return [left, right];
}

describe('lr-chart-3d actual companion integration', function () {
  this.timeout(30000);
  before(requireWebgl2);
  afterEach(resetMouse);

  it('N01 draws the table first, then paints the selected row and maps a trusted pick to its source index', async () => {
    const el = await fixture<LyraChart3d>(html`<lr-chart-3d data-lr-theme-scope style=${scope} .data=${planar('plain')}></lr-chart-3d>`);
    expect(el.shadowRoot!.querySelectorAll('[part="engine"] canvas').length).to.equal(0);
    el.engine = 'webgl';
    const canvas = await ready(el);
    const pixels = await capture(el, canvas, () => { el.selectedId = 'plain-center'; });
    expect(nearCenter(canvas, pixels, RED)).to.equal(true);
    expect(el.shadowRoot!.querySelectorAll('tbody tr').length).to.equal(3);
    const selected = oneEvent(el, 'lr-chart-row-select');
    await clickCenter(canvas);
    expect((await selected).detail).to.deep.equal({ id: 'plain-center', index: 1 });
  });

  it('N02 sizes bubbles by their diameter and draws uniform dots for a scatter chart', async () => {
    const size = new Float32Array([8, 8, 120]);
    const el = await fixture<LyraChart3d>(html`<lr-chart-3d data-lr-theme-scope engine="webgl" type="bubble" style=${scope} .data=${planar('bubble', size)}></lr-chart-3d>`);
    const canvas = await ready(el);
    // The drawing buffer is not preserved, so every read follows a camera write that schedules a frame.
    const bubbles = halves(canvas, await capture(el, canvas, () => el.fit()), BLUE);
    expect(bubbles[1]).to.be.above(3000);
    expect(bubbles[0]).to.be.below(bubbles[1] / 10);
    el.type = 'scatter';
    await el.updateComplete;
    const uniform = await ready(el);
    const dots = halves(uniform, await capture(el, uniform, () => el.fit()), BLUE);
    expect(dots[1]).to.be.below(1500);
    expect(dots[0] + dots[1]).to.be.above(0);
  });

  it('N03 joins adjacent rows with a line and keeps the rows themselves pickable', async () => {
    const el = await fixture<LyraChart3d>(html`<lr-chart-3d data-lr-theme-scope engine="webgl" style=${scope} .data=${planar('line')}></lr-chart-3d>`);
    const scatter = await ready(el);
    const dots = await capture(el, scatter, () => el.fit());
    el.type = 'line';
    await el.updateComplete;
    const joined = await ready(el);
    const lines = await capture(el, joined, () => el.fit());
    expect(changedPixels(dots, lines)).to.be.above(50);
    const selected = oneEvent(el, 'lr-chart-row-select');
    await clickCenter(joined);
    expect((await selected).detail).to.deep.equal({ id: 'line-center', index: 1 });
  });

  it('N04 keeps one renderer through a real context loss, reports it once and repaints after restoration', async () => {
    const el = await fixture<LyraChart3d>(html`<lr-chart-3d data-lr-theme-scope engine="webgl" style=${scope} .data=${planar('lost')}></lr-chart-3d>`);
    const canvas = await ready(el);
    expect(nearCenter(canvas, await capture(el, canvas, () => { el.selectedId = 'lost-center'; }), RED)).to.equal(true);
    const restore = await loseContext(el, canvas);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="engine-notice"]')?.textContent).to.contain('graphics context');
    expect(el.shadowRoot!.querySelectorAll('tbody tr').length).to.equal(3);
    await restore();
    await ready(el);
    expect(nearCenter(canvas, await capture(el, canvas, () => el.fit()), RED)).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="engine"] canvas') === canvas).to.equal(true);
    // A host without a GPU keeps its software-rendering notice, so only the lost-context notice must be gone.
    expect(el.shadowRoot!.querySelector('[part="engine-notice"]')?.textContent ?? '').to.not.contain('graphics context');
  });

  it('N05 rejects invalid data after native rendering without keeping a stale canvas', async () => {
    const el = await fixture<LyraChart3d>(html`<lr-chart-3d engine="webgl" style="inline-size:480px" .data=${planar('valid')}></lr-chart-3d>`);
    const canvas = await ready(el);
    el.data = { ...planar('invalid'), ids: ['same', 'same', 'last'] };
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
    expect(canvas.isConnected).to.equal(false);
    expect(el.shadowRoot!.querySelectorAll('[part="engine"] canvas').length).to.equal(0);
    el.data = planar('again');
    const replacement = await ready(el);
    const selected = oneEvent(el, 'lr-chart-row-select');
    await clickCenter(replacement);
    expect((await selected).detail.id).to.equal('again-center');
  });
});
