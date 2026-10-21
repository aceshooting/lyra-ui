import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './flow-canvas.js';
import type { LyraFlowCanvas } from './flow-canvas.class.js';
import type { FlowNode, FlowEdge, FlowStructureSnapshot } from './flow-types.js';
import type { LyraGraphSource } from '../../../data-sources.js';

type Source = LyraGraphSource<FlowNode, FlowEdge>;
type Canvas = LyraFlowCanvas & { graphSource: Source | undefined; readonly sourceTotal: number | null };

const TOTAL = 5;

function provider(failScene: boolean): Source {
  const row = (index: number) => ({
    key: `node:${index}`,
    order: index,
    value: { kind: 'node' as const, value: { id: String(index), accessibleLabel: `Node ${index}` } },
  });
  return {
    revision: 1,
    records: {
      revision: 1,
      query: async (request) => {
        const start = request.page * request.pageSize;
        const rows = Array.from({ length: TOTAL }, (_, index) => row(index)).slice(start, start + request.pageSize);
        return { rows, total: TOTAL, summary: { nodes: TOTAL, edges: 0 } };
      },
      lookup: async (keys) => keys.map((key) => row(Number(key.slice(5)))),
      locate: async (key) => Number(key.slice(5)),
    },
    scene: async () => {
      if (failScene) throw new Error('scene unavailable');
      return {
        nodes: [0, 1].map((index) => ({ key: `node:${index}`, value: { id: String(index), data: { label: `Node ${index}` } }, position: { x: index * 100, y: 0 } })),
        edges: [],
        coverage: 'complete',
        total: { nodes: TOTAL, edges: 0 },
        worldBounds: { x: 0, y: 0, width: 200, height: 100 },
      };
    },
  };
}

const nextSnapshot = (el: LyraFlowCanvas): Promise<FlowStructureSnapshot> =>
  new Promise((resolve) => {
    const release = el.registerCompanion((value) => { release(); resolve(value); });
  });

const sourceKey = (el: Canvas): string | null | undefined => el.shadowRoot!.activeElement?.getAttribute('data-source-key');

it('drops the scene when the source scene fails but keeps the records page and offers a retry', async () => {
  const el = await fixture<Canvas>(html`<lr-flow-canvas style="width:640px;height:480px" .graphSource=${provider(true)}></lr-flow-canvas>`);
  await waitUntil(() => el.sourceTotal === TOTAL, 'records page');
  await waitUntil(() => el.shadowRoot!.querySelector('[part="source-status"]') !== null, 'scene failure surfaced');
  expect(el.shadowRoot!.querySelectorAll('[part~="node"]').length).to.equal(0);
  expect(el.nodes.length).to.equal(0);
  expect(el.shadowRoot!.querySelectorAll('[data-source-key]').length).to.equal(TOTAL);
  expect(el.shadowRoot!.querySelector('[part="source-status"] button') !== null).to.equal(true);
  expect((await nextSnapshot(el)).nodes.length).to.equal(0);
});

it('walks the source records with the arrow keys and stops at both ends', async () => {
  const el = await fixture<Canvas>(html`<lr-flow-canvas style="width:640px;height:480px" .graphSource=${provider(false)}></lr-flow-canvas>`);
  await waitUntil(() => el.sourceTotal === TOTAL, 'records page');
  await el.updateComplete;
  const first = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-key="node:0"]')!;
  await focusByKeyboard(first);
  await sendKeys({ press: 'ArrowDown' });
  await waitUntil(() => sourceKey(el) === 'node:1', 'ArrowDown steps to the next record');
  await sendKeys({ press: 'ArrowDown' });
  await waitUntil(() => sourceKey(el) === 'node:2');
  await sendKeys({ press: 'ArrowUp' });
  await waitUntil(() => sourceKey(el) === 'node:1', 'ArrowUp steps back');
  await sendKeys({ press: 'ArrowUp' });
  await waitUntil(() => sourceKey(el) === 'node:0');
  await sendKeys({ press: 'ArrowUp' });
  await el.updateComplete;
  expect(sourceKey(el), 'the first record is the upper bound').to.equal('node:0');
});

it('ignores Home and End when every node is disabled', async () => {
  const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas style="width:400px;height:300px"
    .nodes=${[
      { id: 'a', position: { x: 0, y: 0 }, disabled: true },
      { id: 'b', position: { x: 200, y: 0 }, disabled: true },
    ]}></lr-flow-canvas>`);
  await el.updateComplete;
  const control = el.shadowRoot!.querySelector<HTMLElement>('[data-node-id="a"] [part="node-control"]')!;
  for (const key of ['End', 'Home']) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    control.dispatchEvent(event);
    expect(event.defaultPrevented, `${key} is consumed`).to.equal(true);
  }
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement === null || el.shadowRoot!.activeElement.getAttribute('part') === 'viewport').to.equal(true);
  expect(el.shadowRoot!.querySelectorAll('[part="node-control"][tabindex="0"]').length).to.equal(0);
});

it('lays unmeasured nodes out with a zero block size when the fallback size token cannot be resolved', async () => {
  const host = await fixture<HTMLElement>(html`<div hidden>
    <lr-flow-canvas style="--lr-size-4rem:not-a-length" .nodes=${[{ id: 'a', position: { x: 0, y: 0 } }]}></lr-flow-canvas>
  </div>`);
  const el = host.querySelector('lr-flow-canvas') as LyraFlowCanvas;
  const first = await nextSnapshot(el);
  expect(first.nodes.length).to.equal(1);
  expect(first.nodes[0]!.width).to.be.greaterThan(0);
  expect(first.nodes[0]!.height).to.equal(0);
});
