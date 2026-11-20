import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-flow-canvas.js';
import type { LyraFlowCanvas } from './flow-canvas.class.js';
import type { FlowNode, FlowEdge } from './flow-types.js';
import type { LyraGraphSource } from '../../../data-sources.js';

type Source = LyraGraphSource<FlowNode, FlowEdge>;
type Canvas = LyraFlowCanvas & {
  graphSource: Source | undefined;
  readonly sourceTotal: number | null;
  revealSourceKey(key: string): Promise<boolean>;
};
type SceneRequest = Parameters<NonNullable<Source['scene']>>[0];

interface Fixture {
  source: Source;
  scenes: SceneRequest[];
  queries: number;
}

function provider(total: number, coverage: 'complete' | 'aggregate' | 'neighborhood' = 'complete'): Fixture {
  const row = (index: number) => ({
    key: `node:${index}`,
    order: index,
    value: { kind: 'node' as const, value: { id: String(index), accessibleLabel: `Node ${index}` } },
  });
  const state: Fixture = {
    scenes: [],
    queries: 0,
    source: {
      revision: 1,
      records: {
        revision: 1,
        query: async (request) => {
          state.queries++;
          const start = request.page * request.pageSize;
          const rows = Array.from({ length: total }, (_, index) => row(index)).slice(start, start + request.pageSize);
          return { rows, total, summary: { nodes: total, edges: 0 } };
        },
        lookup: async (keys) => keys.map((key) => row(Number(key.slice(5)))),
        locate: async (key) => {
          const index = Number(key.slice(5));
          return Number.isInteger(index) && index < total ? index : null;
        },
      },
      scene: async (request) => {
        state.scenes.push(request);
        const shown = Math.min(total, 2);
        return {
          nodes: Array.from({ length: shown }, (_, index) => ({
            key: `node:${index}`,
            value: { id: String(index), data: { label: `Node ${index}` } },
            position: { x: index * 100, y: 0 },
          })),
          edges: [],
          coverage,
          total: { nodes: total, edges: 0 },
          worldBounds: { x: 0, y: 0, width: 200, height: 100 },
        };
      },
    },
  };
  return state;
}

const statusText = (el: Canvas) =>
  el.shadowRoot!.querySelector('[part="source-status"]')?.textContent?.trim() ?? '';
const coverageText = (el: Canvas) =>
  el.shadowRoot!.querySelector('[part="source-coverage"]')?.textContent?.trim() ?? '';

describe('lr-flow-canvas graph source boundaries', () => {
  for (const [coverage, prefix] of [['aggregate', 'Summary: showing 2 of 5 nodes'], ['neighborhood', 'Neighborhood: showing 2 of 5 nodes']] as const) {
    it(`describes ${coverage} scene coverage`, async () => {
      const data = provider(5, coverage);
      const el = await fixture<Canvas>(html`<lr-flow-canvas style="width:640px;height:480px" .graphSource=${data.source}></lr-flow-canvas>`);
      await waitUntil(() => coverageText(el) !== '', 'scene coverage');
      expect(coverageText(el).startsWith(prefix), coverageText(el)).to.equal(true);
    });
  }

  it('inflects each count of the totals and complete coverage on its own number', async () => {
    const data = provider(1);
    const el = await fixture<Canvas>(html`<lr-flow-canvas style="width:640px;height:480px" .graphSource=${data.source}></lr-flow-canvas>`);
    await waitUntil(() => coverageText(el) !== '' && statusText(el) !== '' && statusText(el).startsWith('Graph'), 'source status and coverage');
    expect(statusText(el)).to.equal('Graph contains 1 node and 0 edges.');
    expect(coverageText(el)).to.equal('Complete graph: 1 node and 0 edges.');
  });

  it('reports an empty source as no data', async () => {
    const data = provider(0);
    const el = await fixture<Canvas>(html`<lr-flow-canvas style="width:640px;height:480px" .graphSource=${data.source}></lr-flow-canvas>`);
    await waitUntil(() => el.sourceTotal === 0, 'records page');
    await waitUntil(() => statusText(el) === 'No data', 'empty status');
  });

  it('reports a revealed key the source cannot locate as unavailable', async () => {
    const data = provider(5);
    const el = await fixture<Canvas>(html`<lr-flow-canvas style="width:640px;height:480px" .graphSource=${data.source}></lr-flow-canvas>`);
    await waitUntil(() => el.sourceTotal === 5, 'records page');
    expect(await el.revealSourceKey('node:404')).to.equal(false);
    await el.updateComplete;
    expect(statusText(el)).to.equal('This graph record is unavailable.');
  });

  it('includes at most 32 selected keys in scene requests and skips oversized ids', async () => {
    const data = provider(5);
    const el = await fixture<Canvas>(html`<lr-flow-canvas style="width:640px;height:480px" .graphSource=${data.source}></lr-flow-canvas>`);
    await waitUntil(() => data.scenes.length > 0, 'first scene');
    const oversized = 'x'.repeat(65_532);
    el.selectedNodeIds = [oversized, ...Array.from({ length: 40 }, (_, index) => `n${index}`)];
    el.selectedEdgeIds = ['e0'];
    const before = data.scenes.length;
    await el.updateComplete;
    await waitUntil(() => data.scenes.length > before, 'scene re-requested for the selection');
    const keys = data.scenes.at(-1)!.includeKeys;
    expect(keys.length).to.equal(32);
    expect(keys.some((key) => key.length > 65_536)).to.equal(false);
    expect(keys[0]).to.equal('node:n0');
    expect(keys.includes('edge:e0'), 'node keys already filled the budget').to.equal(false);
  });

  it('reloads its records after being removed and reattached', async () => {
    const data = provider(5);
    const el = await fixture<Canvas>(html`<lr-flow-canvas style="width:640px;height:480px" .graphSource=${data.source}></lr-flow-canvas>`);
    await waitUntil(() => el.sourceTotal === 5, 'records page');
    const parent = el.parentNode!;
    el.remove();
    const queries = data.queries;
    parent.appendChild(el);
    await waitUntil(() => data.queries > queries && el.sourceTotal === 5, 'records reloaded');
    expect(el.shadowRoot!.querySelectorAll('[data-source-key]').length).to.equal(5);
  });

  it('fits the provider world bounds once a scene is accepted', async () => {
    const data = provider(2);
    const el = await fixture<Canvas>(html`<lr-flow-canvas style="width:640px;height:480px" .graphSource=${data.source}></lr-flow-canvas>`);
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part~="node"]').length === 2, 'scene accepted');
    el.setViewport({ x: 300, y: 300, zoom: 0.5 });
    el.fit();
    // The 200x100 provider world is centered in the visible viewport surface.
    const surface = el.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!.getBoundingClientRect();
    expect(el.viewport.zoom).to.be.greaterThan(0.5);
    expect(el.viewport.x + 100 * el.viewport.zoom).to.be.closeTo(surface.width / 2, 1);
    expect(el.viewport.y + 50 * el.viewport.zoom).to.be.closeTo(surface.height / 2, 1);
  });

  it('rebinds its records after adoption into another document', async () => {
    const data = provider(5);
    const iframe = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
    const el = await fixture<Canvas>(html`<lr-flow-canvas style="width:640px;height:480px" .graphSource=${data.source}></lr-flow-canvas>`);
    await waitUntil(() => el.sourceTotal === 5, 'records page');
    const queries = data.queries;
    iframe.contentDocument!.body.append(el);
    try {
      await waitUntil(() => data.queries > queries && el.sourceTotal === 5, 'records reloaded in the new document');
      expect(el.ownerDocument === iframe.contentDocument).to.equal(true);
    } finally {
      el.remove();
    }
  });
});
