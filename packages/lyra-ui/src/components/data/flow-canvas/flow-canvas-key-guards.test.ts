import { fixture, expect, html } from '@open-wc/testing';
import { twoFrames } from '../../../../test/frames.js';
import '../../lr-flow-canvas.js';
import '../../lr-flow-minimap.js';
import type { LyraFlowCanvas, FlowNode, FlowEdge } from '../../lr-flow-canvas.js';
import type { LyraFlowMinimap } from '../../lr-flow-minimap.js';

const nodes: FlowNode[] = [
  { id: 'a', position: { x: 0, y: 0 }, data: { label: 'Fetch' } },
  { id: 'b', position: { x: 200, y: 0 }, data: { label: 'Summarize' } },
];
const edges: FlowEdge[] = [{ id: 'a-b', source: 'a', target: 'b' }];

function press(target: Element, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

function nodeControl(el: LyraFlowCanvas, id: string): HTMLElement {
  const wrapper = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="node"][data-node-id]')]
    .find((candidate) => candidate.dataset['nodeId'] === id);
  return wrapper!.querySelector('[part="node-control"]') as HTMLElement;
}

async function canvas(markup = html`<lr-flow-canvas connectable style="width:400px;height:300px"></lr-flow-canvas>`): Promise<LyraFlowCanvas> {
  const el = (await fixture(markup)) as LyraFlowCanvas;
  el.nodes = nodes;
  el.edges = edges;
  await el.updateComplete;
  return el;
}

describe('lr-flow-canvas modified and composing keys', () => {
  for (const init of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { isComposing: true }]) {
    it(`leaves viewport shortcuts alone for ${JSON.stringify(init)}`, async () => {
      const el = await canvas();
      const viewport = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
      const before = JSON.stringify(el.viewport);
      for (const key of ['=', '-', '0', 'ArrowRight']) {
        expect(press(viewport, { key, ...init }).defaultPrevented, key).to.equal(false);
      }
      expect(JSON.stringify(el.viewport)).to.equal(before);
    });
  }

  it('does not start keyboard connect or roving on Ctrl+C or Alt+Arrow', async () => {
    const el = await canvas();
    const first = nodeControl(el, 'a');
    expect(press(first, { key: 'c', ctrlKey: true }).defaultPrevented).to.equal(false);
    expect(press(first, { key: 'c', metaKey: true }).defaultPrevented).to.equal(false);
    expect(press(first, { key: 'ArrowRight', altKey: true }).defaultPrevented).to.equal(false);
    expect(press(first, { key: 'Home', ctrlKey: true }).defaultPrevented).to.equal(false);
    expect(nodeControl(el, 'a').getAttribute('tabindex')).to.equal('0');
    expect(press(first, { key: 'c' }).defaultPrevented).to.equal(true);
  });

  it('keeps Ctrl+Enter as additive selection', async () => {
    const el = await canvas();
    const first = nodeControl(el, 'a');
    expect(press(first, { key: 'Enter', ctrlKey: true }).defaultPrevented).to.equal(true);
  });

  it('activates once per held Enter and ignores repeated Delete', async () => {
    const el = await canvas();
    const first = nodeControl(el, 'a');
    let selections = 0;
    el.addEventListener('lr-node-activate', () => { selections++; });
    press(first, { key: 'Enter' });
    press(first, { key: 'Enter', repeat: true });
    press(first, { key: 'Enter', repeat: true });
    await el.updateComplete;
    expect(selections).to.equal(1);
    let deletes = 0;
    el.addEventListener('lr-selection-delete', () => { deletes++; });
    press(first, { key: 'Delete', repeat: true });
    expect(deletes).to.equal(0);
  });
});

describe('lr-flow-minimap modified keys', () => {
  it('leaves zoom shortcuts to the browser while Ctrl, Meta or Alt is held', async () => {
    const wrapper = (await fixture(html`
      <lr-flow-canvas style="width:400px;height:300px">
        <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
      </lr-flow-canvas>
    `)) as LyraFlowCanvas;
    wrapper.nodes = nodes;
    await wrapper.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const minimap = wrapper.querySelector('lr-flow-minimap') as LyraFlowMinimap;
    await minimap.updateComplete;
    const hit = minimap.shadowRoot!.querySelector('[part="viewport-hit-area"]') as HTMLElement;
    const before = wrapper.viewport.zoom;
    for (const init of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
      expect(press(hit, { key: '=', ...init }).defaultPrevented).to.equal(false);
      expect(press(hit, { key: 'Home', ...init }).defaultPrevented).to.equal(false);
    }
    expect(wrapper.viewport.zoom).to.equal(before);
    expect(press(hit, { key: '+' }).defaultPrevented).to.equal(true);
  });

  it('draws the viewport outline with a screen-sized stroke', async () => {
    const wrapper = (await fixture(html`
      <lr-flow-canvas style="width:400px;height:300px">
        <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
      </lr-flow-canvas>
    `)) as LyraFlowCanvas;
    wrapper.nodes = nodes;
    await wrapper.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const minimap = wrapper.querySelector('lr-flow-minimap') as LyraFlowMinimap;
    await minimap.updateComplete;
    const outline = minimap.shadowRoot!.querySelector('[part="viewport"]') as SVGElement;
    expect(getComputedStyle(outline).vectorEffect).to.equal('non-scaling-stroke');
  });
});

describe('lr-flow-canvas edge strokes under zoom', () => {
  it('keeps the drawn stroke and hit area a constant screen size', async () => {
    const el = await canvas();
    await twoFrames();
    el.setViewport({ x: 0, y: 0, zoom: 0.25 });
    await el.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const edge = el.shadowRoot!.querySelector('[part="edge"]') as SVGElement;
    const hit = el.shadowRoot!.querySelector('[part="edge-hit-area"]') as SVGElement;
    const zoom = el.viewport.zoom;
    const screen = (node: SVGElement) => parseFloat(getComputedStyle(node).strokeWidth) * zoom;
    expect(zoom).to.equal(0.25);
    expect(screen(edge)).to.be.closeTo(1.5, 0.01);
    expect(screen(hit) >= 24).to.equal(true);
  });
});

describe('lr-flow-canvas companion notification', () => {
  it('keeps notifying later companions when one subscriber throws', async () => {
    const el = await canvas();
    let seen = 0;
    const stopBad = el.registerCompanion(() => { throw new Error('subscriber failed'); });
    const stopGood = el.registerCompanion(() => { seen++; });
    el.setViewport({ x: 5, y: 5, zoom: 1 });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    stopBad();
    stopGood();
    expect(seen > 0).to.equal(true);
  });
});

it('leaves modified nudge shortcuts alone during composition or Alt navigation', async () => {
  const el = await canvas(html`<lr-flow-canvas nodes-draggable></lr-flow-canvas>`);
  const first = nodeControl(el, 'a');
  let moves = 0;
  el.addEventListener('lr-node-move', () => { moves++; });
  for (const init of [{ isComposing: true }, { altKey: true }]) {
    expect(press(first, { key: 'ArrowRight', ctrlKey: true, ...init }).defaultPrevented).to.equal(false);
  }
  expect(moves).to.equal(0);
});
