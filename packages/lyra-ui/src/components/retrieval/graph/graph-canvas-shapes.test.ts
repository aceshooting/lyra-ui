import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { loadD3 } from './graph-loader.js';
import type { LyraGraph } from './graph.class.js';
import './graph.js';

function redPixels(canvas: HTMLCanvasElement): { count: number; area: number } {
  const image = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
  let count = 0;
  let left = canvas.width;
  let right = 0;
  let top = canvas.height;
  let bottom = 0;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      if (image.data[index]! < 240 || image.data[index + 1]! > 15 || image.data[index + 2]! > 15 || image.data[index + 3]! < 240) continue;
      count += 1;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  return { count, area: count ? (right - left + 1) * (bottom - top + 1) : 0 };
}

async function graph(): Promise<LyraGraph> {
  expect(await loadD3() !== null).to.equal(true);
  return fixture<LyraGraph>(html`<lr-graph renderer="canvas" layout="layered" width="320" height="240"
    node-labels="none" selection-mode="single" style="width:320px;height:240px;--lr-graph-focus-halo-color:rgb(255,0,0)"></lr-graph>`);
}

for (const shape of ['square', 'diamond'] as const) {
  it(`paints and picks the public ${shape} node shape after camera zoom`, async () => {
    const element = await graph();
    element.nodeTypes = [{ id: 'type', label: shape, shape }];
    element.nodes = [{ id: 'only', label: 'Only node', type: 'type', radius: 20, color: '#ff0000' }];
    await element.updateComplete;
    await waitUntil(() => element.shadowRoot!.querySelectorAll('canvas').length === 1);
    const canvas = element.shadowRoot!.querySelector<HTMLCanvasElement>('canvas')!;
    await waitUntil(() => redPixels(canvas).count > 100);
    const before = redPixels(canvas);
    expect(before.count / before.area).to.be.within(shape === 'square' ? 0.94 : 0.45, shape === 'square' ? 1 : 0.60);
    expect(await element.focusNode('only', { zoom: 2 })).to.equal(true);
    await waitUntil(() => redPixels(canvas).count > before.count * 3);
    const painted = redPixels(canvas);
    expect(painted.count / painted.area).to.be.within(shape === 'square' ? 0.94 : 0.45, shape === 'square' ? 1 : 0.60);
    let activated = '';
    element.addEventListener('lr-node-activate', (event) => { activated = event.detail.nodeId; });
    const bounds = canvas.getBoundingClientRect();
    try {
      await sendMouse({ type: 'click', position: [Math.round(bounds.left + bounds.width / 2), Math.round(bounds.top + bounds.height / 2)] });
      expect(activated).to.equal('only');
    } finally {
      await resetMouse();
    }
  });
}

it('paints a keyboard edge halo while preserving roving focus and activation', async () => {
  const element = await graph();
  element.nodes = [{ id: 'a', label: 'First', color: '#00ff00' }, { id: 'b', label: 'Second', color: '#00ff00' }];
  element.edges = [{ id: 'edge', source: 'a', target: 'b', color: '#0000ff' }];
  await element.updateComplete;
  await waitUntil(() => element.shadowRoot!.querySelectorAll('[part="cursor-item"]').length === 3);
  const canvas = element.shadowRoot!.querySelector<HTMLCanvasElement>('canvas')!;
  const first = element.shadowRoot!.querySelector<HTMLElement>('[part="cursor-item"]')!;
  await focusByKeyboard(first);
  await sendKeys({ press: 'End' });
  await waitUntil(() => element.shadowRoot!.activeElement?.getAttribute('aria-label')?.includes('First') === true
    && element.shadowRoot!.activeElement?.getAttribute('aria-label')?.includes('Second') === true);
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  await waitUntil(() => redPixels(canvas).count > 10);
  expect(element.shadowRoot!.activeElement?.getAttribute('tabindex')).to.equal('0');
  let activated = '';
  element.addEventListener('lr-edge-activate', (event) => { activated = event.detail.edgeId ?? ''; });
  await sendKeys({ press: 'Enter' });
  expect(activated).to.equal('edge');
});

it('paints the focused community outline when the virtual cursor reaches its hull', async () => {
  const element = await graph();
  element.nodes = [{ id: 'a', label: 'First', communityId: 'team', color: '#00ff00' },
    { id: 'b', label: 'Second', communityId: 'team', color: '#00ff00' }];
  element.communities = [{ id: 'team', label: 'Research team', memberIds: ['a', 'b'], color: '#0000ff' }];
  await element.updateComplete;
  await waitUntil(() => element.shadowRoot!.querySelectorAll('[part="cursor-item"]').length === 3);
  const first = element.shadowRoot!.querySelector<HTMLElement>('[part="cursor-item"]')!;
  const canvas = element.shadowRoot!.querySelector<HTMLCanvasElement>('canvas')!;
  await focusByKeyboard(first);
  await sendKeys({ press: 'End' });
  await waitUntil(() => element.shadowRoot!.activeElement?.getAttribute('aria-label')?.includes('Research team') === true);
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  await waitUntil(() => redPixels(canvas).count > 10);
  expect(element.shadowRoot!.activeElement?.getAttribute('tabindex')).to.equal('0');
});
