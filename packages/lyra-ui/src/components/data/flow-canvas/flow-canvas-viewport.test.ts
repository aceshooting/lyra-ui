import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './flow-canvas.js';
import type { LyraFlowCanvas, FlowNode } from './flow-canvas.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { registerLyraLocale } from '../../../internal/localization-runtime.js';

async function mount() {
  const nodes = Array.from({ length: 1000 }, (_, i) => ({ id: `n${i}`, position: { x: i * 1000, y: 0 } }));
  const canvas = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas style="width:400px;height:300px" .nodes=${nodes}></lr-flow-canvas>`);
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  canvas.setViewport({ x: 0, y: 0, zoom: 1 }); await canvas.updateComplete;
  return canvas;
}

it('retains selected nodes, selected edge endpoints, keyboard connect targets and incident edges outside the viewport', async () => {
  const canvas = await mount();
  canvas.edges = [{ id: 'far', source: 'n998', target: 'n999' }];
  canvas.selectedNodeIds = ['n999']; await canvas.updateComplete;
  expect(canvas.shadowRoot!.querySelector('[data-node-id="n999"]') !== null).to.equal(true);
  expect(canvas.shadowRoot!.querySelector('[data-edge-id="far"]') !== null).to.equal(true);
  canvas.selectedNodeIds = []; canvas.selectedEdgeIds = ['far']; await canvas.updateComplete;
  expect(canvas.shadowRoot!.querySelector('[data-node-id="n998"]') !== null).to.equal(true);
  canvas.selectedEdgeIds = [];
  const work = canvas as unknown as { keyboardConnectSourceId: string; keyboardConnectTargetIndex: number };
  work.keyboardConnectSourceId = 'n0'; work.keyboardConnectTargetIndex = 998;
  await canvas.updateComplete;
  expect(canvas.shadowRoot!.querySelector('[data-node-id="n999"][data-connect-target]') !== null).to.equal(true);
});

for (const direction of ['ltr', 'rtl']) it(`reveals and focuses a culled node using the full keyboard order in ${direction}`, async () => {
  const canvas = await mount(); canvas.dir = direction; await canvas.updateComplete;
  const first = canvas.shadowRoot!.querySelector<HTMLButtonElement>('[data-node-id="n0"] [part="node-control"]')!;
  await focusByKeyboard(first);
  first.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  await canvas.updateComplete;
  await waitUntil(() => canvas.shadowRoot!.activeElement?.closest('[data-node-id]')?.getAttribute('data-node-id') === 'n999');
  const node = canvas.shadowRoot!.querySelector<HTMLElement>('[data-node-id="n999"]')!;
  const bounds = node.getBoundingClientRect(), viewport = canvas.getBoundingClientRect();
  expect(bounds.right > viewport.left && bounds.left < viewport.right).to.equal(true);
  expect(canvas.shadowRoot!.querySelectorAll('[part="node-control"][tabindex="0"]').length).to.equal(1);
  expect(canvas.nodes.length).to.equal(1000);
});

it('requeries the visible nodes when the canvas allocation grows', async () => {
  const canvas = await mount();
  expect(canvas.shadowRoot!.querySelector('[data-node-id="n1"]') === null).to.equal(true);
  canvas.style.width = '1400px';
  await waitUntil(() => canvas.shadowRoot!.querySelector('[data-node-id="n1"]') !== null);
});

it('refreshes guarded node names on an explicit update coalesced with cursor and selection writes', async () => {
  const canvas = await mount();
  const work = canvas as unknown as { nodeAccessibleText(node: FlowNode): string; activeItemIndex: number };
  const original = work.nodeAccessibleText;
  work.nodeAccessibleText = node => `Updated ${node.id}`;
  try {
    canvas.requestUpdate(); work.activeItemIndex = 1; canvas.selectedNodeIds = ['n0'];
    await canvas.updateComplete;
    expect(canvas.shadowRoot!.querySelector('[data-node-id="n0"]')?.getAttribute('aria-label')).to.equal('Updated n0');
    expect(canvas.shadowRoot!.querySelector('[data-node-id="n1"]')?.getAttribute('aria-label')).to.equal('Updated n1');
  } finally { work.nodeAccessibleText = original; }
});

it('refreshes guarded node labels when the same locale catalog is replaced', async () => {
  registerLyraLocale('en-XF', { flowNode: 'First {label}' });
  const canvas = await mount(); canvas.locale = 'en-XF'; await canvas.updateComplete;
  expect(canvas.shadowRoot!.querySelector('[data-node-id="n0"]')?.getAttribute('aria-label')).to.equal('First n0');
  registerLyraLocale('en-XF', { flowNode: 'Second {label}' });
  (canvas as unknown as { activeItemIndex: number }).activeItemIndex = 1;
  await canvas.updateComplete;
  expect(canvas.shadowRoot!.querySelector('[data-node-id="n0"]')?.getAttribute('aria-label')).to.equal('Second n0');
});

it('keeps a physically visible RTL card after its selection reservation is removed', async () => {
  const canvas = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas dir="rtl" style="width:400px;height:300px"
    .nodes=${[{ id: 'first', position: { x: -1000, y: 0 } }, { id: 'visible', position: { x: -250, y: 0 } }]}
    .selectedNodeIds=${['visible']}></lr-flow-canvas>`);
  for (let i = 0; i < 5; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  canvas.setViewport({ x: 0, y: 0, zoom: 1 }); await canvas.updateComplete;
  const card = canvas.shadowRoot!.querySelector<HTMLElement>('[data-node-id="visible"]')!;
  const box = card.getBoundingClientRect(), viewport = canvas.getBoundingClientRect();
  expect(box.right > viewport.left && box.left < viewport.right).to.equal(true);
  canvas.selectedNodeIds = []; await canvas.updateComplete;
  expect(canvas.shadowRoot!.querySelector('[data-node-id="visible"]') !== null).to.equal(true);
});

it('keeps focus on a reserved control when visible membership changes', async () => {
  const canvas = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas style="width:400px;height:300px"
    .nodes=${[{ id: 'a', position: { x: 0, y: 0 } }, { id: 'b', position: { x: 250, y: 0 } }]}></lr-flow-canvas>`);
  for (let i = 0; i < 4; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  canvas.setViewport({ x: 0, y: 0, zoom: 1 }); await canvas.updateComplete;
  const button = canvas.shadowRoot!.querySelector<HTMLButtonElement>('[data-node-id="a"] [part="node-control"]')!;
  await focusByKeyboard(button);
  canvas.setViewport({ x: -250, y: 0, zoom: 1 }); await canvas.updateComplete;
  expect(canvas.shadowRoot!.activeElement === button).to.equal(true);
});

it('reserves an authored card containing the actual focused input', async () => {
  const canvas = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas style="width:400px;height:300px"
    .nodes=${[{ id: 'a', position: { x: 0, y: 0 } }, { id: 'b', position: { x: 250, y: 0 } }]}>
    <div node-id="b"><input aria-label="Editor"></div></lr-flow-canvas>`);
  for (let i = 0; i < 4; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  canvas.setViewport({ x: 0, y: 0, zoom: 1 }); await canvas.updateComplete;
  const input = canvas.querySelector('input')!; await focusByKeyboard(input);
  canvas.setViewport({ x: -1000, y: 0, zoom: 1 }); await canvas.updateComplete;
  expect(canvas.shadowRoot!.querySelector('[data-node-id="b"]') !== null).to.equal(true);
  expect(document.activeElement === input).to.equal(true);
});
