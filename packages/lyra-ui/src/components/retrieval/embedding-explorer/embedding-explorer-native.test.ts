import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './embedding-explorer.js';
import type { LyraEmbeddingExplorer } from './embedding-explorer.class.js';
import { capture, center, clickCenter, loseContext, matches, nativeCanvas, requireWebgl2 } from '../../../../test/native-3d-ui.js';
import { resetMouse } from '../../../../test/wtr-mouse.js';

const points = [{ id: 'left', x: -1, y: -1 }, { id: 'center', x: 0, y: 0 }, { id: 'right', x: 1, y: 1 }];
const columns = (prefix: string, depth = false) => ({ ids: [`${prefix}-left`, `${prefix}-center`, `${prefix}-right`],
  x: new Float32Array([-1, 0, 1]), y: new Float32Array([-1, 0, 1]), ...(depth ? { z: new Float32Array([-1, 0, 1]) } : {}) });

async function ready(el: LyraEmbeddingExplorer): Promise<HTMLCanvasElement> {
  await waitUntil(() => el.shadowRoot!.querySelector('[part="rows"]') !== null &&
    el.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-busy') === 'false', 'Embedding UI did not become ready', { timeout: 15000 });
  return nativeCanvas(el, 'engine');
}

describe('lr-embedding-explorer actual companion integration', function () {
  this.timeout(30000);
  before(requireWebgl2);
  afterEach(resetMouse);

  it('N01 renders ordinary planar points through the lazy companion and maps a trusted pick', async () => {
    const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer data-lr-theme-scope style="inline-size:480px;--lr-color-brand:rgb(255,0,0);--lr-focus-ring-color:rgb(255,0,0)" .points=${points}></lr-embedding-explorer>`);
    expect(el.shadowRoot!.querySelectorAll('[part="engine"] canvas').length).to.equal(0);
    el.engine = 'webgl'; const canvas = await ready(el);
    const pixels = await capture(el, canvas, () => { el.selectedPointId = 'center'; });
    expect(matches(center(canvas, pixels), [255, 0, 0])).to.equal(true);
    const selected = oneEvent(el, 'lr-point-select'); await clickCenter(canvas);
    const detail = (await selected).detail;
    expect(detail.id).to.equal('center'); expect(detail.index).to.equal(1);
    expect(detail.point).to.deep.equal(points[1]);
  });

  it('N02 retains typed 3D identities through replacement and real context restoration', async () => {
    const input = columns('before', true);
    const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer data-lr-theme-scope engine="webgl" style="inline-size:480px;--lr-color-brand:rgb(255,0,0);--lr-focus-ring-color:rgb(255,0,0)" .pointColumns=${input}></lr-embedding-explorer>`);
    const initial = await ready(el);
    expect(matches(center(initial, await capture(el, initial, () => { el.selectedPointId = 'before-center'; })), [255, 0, 0])).to.equal(true);
    el.pointColumns = columns('after', true); await el.updateComplete;
    const canvas = await ready(el);
    const selected = oneEvent(el, 'lr-point-select'); await clickCenter(canvas);
    const detail = (await selected).detail;
    expect(detail.id).to.equal('after-center'); expect(detail.index).to.equal(1); expect(detail.point.z).to.equal(0);
    const restore = await loseContext(el, canvas); await restore();
    await ready(el);
    const pixels = await capture(el, canvas, () => { el.selectedPointId = 'after-center'; });
    expect(matches(center(canvas, pixels), [255, 0, 0])).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="engine"] canvas') === canvas).to.equal(true);
    expect(Array.from(input.x)).to.deep.equal([-1, 0, 1]); expect(input.ids[1]).to.equal('before-center');
  });

  it('N03 rejects invalid high-priority columns after native rendering without revealing ordinary points', async () => {
    const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer engine="webgl" style="inline-size:480px" .pointColumns=${columns('valid')} .points=${points}></lr-embedding-explorer>`);
    const canvas = await ready(el);
    el.pointColumns = { ...columns('invalid'), ids: ['duplicate', 'duplicate', 'last'] };
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
    expect(canvas.isConnected).to.equal(false);
    expect(el.shadowRoot!.querySelectorAll('[part="engine"] canvas').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[data-id="center"]').length).to.equal(0);
    el.pointColumns = null; await el.updateComplete;
    const replacement = await ready(el);
    const selected = oneEvent(el, 'lr-point-select'); await clickCenter(replacement);
    expect((await selected).detail.id).to.equal('center');
  });
});
