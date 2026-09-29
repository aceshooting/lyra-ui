import { expectStaleAttribute } from '../../../../test/expected-stale-attributes.js';
import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './graph.js';
import type { LyraGraph, LyraGraphEdge } from './graph.js';
import {
  captureDeprecationWarnings,
  type DeprecatedUsage,
} from '../../../../test/expected-deprecations.js';

const TIMEOUT = 5000;
const nodes = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
];
const edges: LyraGraphEdge[] = [{ id: 'ab', source: 'a', target: 'b', label: 'knows' }];

const ALIASES: readonly DeprecatedUsage[] = [
  { tag: 'lr-graph', kind: 'property', name: 'links' },
  { tag: 'lr-graph', kind: 'property', name: 'selectedLinkIds' },
  { tag: 'lr-graph', kind: 'property', name: 'dimmedLinkIds' },
  { tag: 'lr-graph', kind: 'property', name: 'linkDistance' },
  { tag: 'lr-graph', kind: 'property', name: 'showEdgeLabels' },
  { tag: 'lr-graph', kind: 'event', name: 'lr-link-enter' },
  { tag: 'lr-graph', kind: 'event', name: 'lr-link-leave' },
  { tag: 'lr-graph', kind: 'event', name: 'lr-community-click' },
];

async function drawn(el: LyraGraph, count = 2): Promise<LyraGraph> {
  await el.updateComplete;
  await waitUntil(
    () => el.shadowRoot!.querySelectorAll('[part="node"]').length === count,
    'graph never drew its nodes',
    { timeout: TIMEOUT }
  );
  return el;
}

function linkState(el: LyraGraph): string {
  const link = el.shadowRoot!.querySelector('[part="link"]:not([data-dangling])');
  return [
    el.shadowRoot!.querySelectorAll('[part="link"]:not([data-dangling])').length,
    el.shadowRoot!.querySelectorAll('[part="link-label"]').length,
    link?.hasAttribute('data-selected'),
    link?.hasAttribute('data-dimmed'),
  ].join('|');
}

function rootFontSize(): number {
  return Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
}

describe('lr-graph edge vocabulary', () => {
  it('renders through the canonical edge names without a deprecation warning', async () => {
    let state = '';
    let distance = 0;
    const warnings = await captureDeprecationWarnings(ALIASES, async () => {
      const el = await drawn(
        await fixture<LyraGraph>(html`<lr-graph
          with-edge-labels
          edge-distance="42"
          selection-mode="multiple"
          .nodes=${nodes}
          .edges=${edges}
          .selectedEdgeIds=${['ab']}
          .dimmedEdgeIds=${['ab']}
        ></lr-graph>`)
      );
      state = linkState(el);
      distance = el.edgeDistance;
    });
    expect(state).to.equal('1|1|true|true');
    expect(distance).to.equal(42);
    expect(warnings).to.have.length(0);
  });

  it('ignores retired attributes regardless of their order next to canonical values', async () => {
    for (const markup of [
      html`<lr-graph edge-distance="20" link-distance="300" show-edge-labels></lr-graph>`,
      html`<lr-graph link-distance="300" show-edge-labels edge-distance="20"></lr-graph>`,
    ]) {
      const el = await fixture<LyraGraph>(markup);
      expect(el.edgeDistance).to.equal(20);
      expect(el.withEdgeLabels).to.equal(false);
    }
  });

  it('owns canonical edge collections without reviving retired aliases', async () => {
    const input = [{ id: 'ab', source: 'a', target: 'b', label: 'Original' }];
    const el = await drawn(await fixture<LyraGraph>(html`<lr-graph .nodes=${nodes} .edges=${input}></lr-graph>`));
    input[0]!.label = 'Caller mutation';
    expect(el.edges[0]!.label).to.equal('Original');
    expect(Object.isFrozen(el.edges)).to.equal(true);
    expect('links' in el).to.equal(false);
    el.selectedEdgeIds = ['ab'];
    el.dimmedEdgeIds = ['ab'];
    await el.updateComplete;
    expect('selectedLinkIds' in el).to.equal(false);
    expect('dimmedLinkIds' in el).to.equal(false);
  });

  it('fires edge hover events with edgeId, without retired link aliases, never warning', async () => {
    const seen: { type: string; detail: string; cancelable: boolean }[] = [];
    const details = new Set<unknown>();
    const warnings = await captureDeprecationWarnings(ALIASES, async () => {
      const el = await drawn(
        await fixture<LyraGraph>(html`<lr-graph .nodes=${nodes} .edges=${edges}></lr-graph>`)
      );
      for (const type of ['lr-edge-enter', 'lr-link-enter', 'lr-edge-leave', 'lr-link-leave']) {
        el.addEventListener(type, (event) => {
          const custom = event as CustomEvent;
          seen.push({ type, detail: JSON.stringify(custom.detail), cancelable: custom.cancelable });
          details.add(custom.detail);
        });
      }
      const link = el.shadowRoot!.querySelector('[part="link"]')!;
      link.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      link.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    });
    const canonical = JSON.stringify({ sourceNodeId: 'a', targetNodeId: 'b', edgeId: 'ab' });
    expect(seen).to.deep.equal([
      { type: 'lr-edge-enter', detail: canonical, cancelable: false },
      { type: 'lr-edge-leave', detail: canonical, cancelable: false },
    ]);
    expect(details.size, 'each event carries its own detail object').to.equal(2);
    expect(warnings).to.have.length(0);
  });

  it('fires lr-community-activate, without the retired alias, never warning', async () => {
    const seen: string[] = [];
    const warnings = await captureDeprecationWarnings(ALIASES, async () => {
      const el = await drawn(
        await fixture<LyraGraph>(html`<lr-graph
          .communities=${[{ id: 'team-1', label: 'Team One', memberIds: [] }]}
          .nodes=${[
            { id: 'a', label: 'A', communityId: 'team-1' },
            { id: 'b', label: 'B', communityId: 'team-1' },
          ]}
          .edges=${[]}
        ></lr-graph>`)
      );
      for (const type of ['lr-community-activate', 'lr-community-click']) {
        el.addEventListener(type, (event) =>
          seen.push(`${type}:${JSON.stringify((event as CustomEvent).detail)}`)
        );
      }
      const hull = el.shadowRoot!.querySelector('[part="hull"]')!;
      hull.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      hull.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    const detail = JSON.stringify({ communityId: 'team-1' });
    expect(seen).to.deep.equal([
      `lr-community-activate:${detail}`,
      `lr-community-activate:${detail}`,
    ]);
    expect(warnings).to.have.length(0);
  });
});

describe('lr-graph custom properties', () => {
  async function paint(style: string): Promise<{ stroke: string; fill: string }> {
    const el = await drawn(
      await fixture<LyraGraph>(html`<lr-graph style=${style} .nodes=${nodes} .edges=${edges}></lr-graph>`)
    );
    return {
      stroke: getComputedStyle(el.shadowRoot!.querySelector('[part="link"]')!).stroke,
      fill: getComputedStyle(el.shadowRoot!.querySelector('[part="node"]')!).fill,
    };
  }

  it('paints edges and nodes from --lr-graph-edge-color and --lr-graph-node-fill', async () => {
    const painted = await paint('--lr-graph-edge-color: rgb(1, 2, 3); --lr-graph-node-fill: rgb(4, 5, 6)');
    expect(painted).to.deep.equal({ stroke: 'rgb(1, 2, 3)', fill: 'rgb(4, 5, 6)' });
  });

  it('ignores retired color tokens and retains canonical defaults', async () => {
    const baseline = await paint('');
    const painted = await paint('--lr-link-color: rgb(1, 2, 3); --lr-node-fill: rgb(4, 5, 6)');
    expect(painted).to.deep.equal(baseline);
  });

  it('ignores retired color fallbacks in the canvas painter and honors canonical colors', async () => {
    async function paintCanvas(style: string): Promise<string[]> {
      const el = await fixture<LyraGraph>(html`<lr-graph renderer="canvas" layout="layered"
        style=${style} .nodes=${nodes} .edges=${edges}></lr-graph>`);
      type CanvasPaint = { canvasScene?: { nodes: { fill: string }[]; links: { color: string }[] } };
      await waitUntil(() => Boolean((el as unknown as CanvasPaint).canvasScene), 'canvas paint never completed', { timeout: TIMEOUT });
      const scene = (el as unknown as CanvasPaint).canvasScene!;
      expect(el.shadowRoot!.querySelector('canvas')!.width).to.be.greaterThan(0);
      return [scene.links[0]!.color, scene.nodes[0]!.fill];
    }
    const baseline = await paintCanvas('');
    expect(await paintCanvas('--lr-link-color:rgb(1,2,3);--lr-node-fill:rgb(4,5,6)')).to.deep.equal(baseline);
    expect(await paintCanvas('--lr-graph-edge-color:rgb(1,2,3);--lr-graph-node-fill:rgb(4,5,6)'))
      .to.deep.equal(['rgb(1, 2, 3)', 'rgb(4, 5, 6)']);
  });

  it('lets the canonical custom properties win over the deprecated ones', async () => {
    const painted = await paint(
      '--lr-graph-edge-color: rgb(1, 2, 3); --lr-link-color: rgb(9, 9, 9); ' +
        '--lr-graph-node-fill: rgb(4, 5, 6); --lr-node-fill: rgb(9, 9, 9)'
    );
    expect(painted).to.deep.equal({ stroke: 'rgb(1, 2, 3)', fill: 'rgb(4, 5, 6)' });
  });

  it('keeps a per-node color ahead of a host --lr-graph-node-fill', async () => {
    const el = await drawn(
      await fixture<LyraGraph>(html`<lr-graph
        style="--lr-graph-node-fill: rgb(4, 5, 6)"
        .nodes=${[{ id: 'a', label: 'A', color: 'rgb(7, 8, 9)' }, { id: 'b', label: 'B' }]}
        .edges=${edges}
      ></lr-graph>`)
    );
    const fills = [...el.shadowRoot!.querySelectorAll('[part="node"]')].map(
      (node) => getComputedStyle(node).fill
    );
    expect(fills).to.deep.equal(['rgb(7, 8, 9)', 'rgb(4, 5, 6)']);
  });
});

describe('lr-graph CSS-length width and height', () => {
  async function viewBox(el: LyraGraph, expected: string): Promise<string> {
    await waitUntil(
      () => el.shadowRoot!.querySelector('svg')?.getAttribute('viewBox') === expected,
      `viewBox never became ${expected}`,
      { timeout: TIMEOUT }
    );
    return el.shadowRoot!.querySelector('svg')!.getAttribute('viewBox')!;
  }

  it('keeps a plain number attribute a number of pixels', async () => {
    const el = await fixture<LyraGraph>(
      html`<lr-graph width="500" height="300" .nodes=${nodes} .edges=${edges}></lr-graph>`
    );
    expect([el.width, el.height]).to.deep.equal([500, 300]);
    expect(await viewBox(el, '0 0 500 300')).to.equal('0 0 500 300');
    expect(getComputedStyle(el).blockSize).to.equal('300px');
  });

  it('resolves rem and em lengths for the drawing space and the host block size', async () => {
    const root = rootFontSize();
    const el = await fixture<LyraGraph>(html`<lr-graph
      style="font-size: 20px"
      width="25rem"
      height="10em"
      .nodes=${nodes}
      .edges=${edges}
    ></lr-graph>`);
    expect([el.width, el.height]).to.deep.equal(['25rem', '10em']);
    const expected = `0 0 ${25 * root} 200`;
    expect(await viewBox(el, expected)).to.equal(expected);
    expect(getComputedStyle(el).blockSize).to.equal('200px');
  });

  it('falls back to the defaults for a value it cannot resolve', async () => {
    const el = await fixture<LyraGraph>(
      html`<lr-graph width="50%" height="tall" .nodes=${nodes} .edges=${edges}></lr-graph>`
    );
    expect(await viewBox(el, '0 0 800 600')).to.equal('0 0 800 600');
    expect(getComputedStyle(el).blockSize).to.equal('600px');
  });
});

expectStaleAttribute('lr-graph', 'link-distance');

expectStaleAttribute('lr-graph', 'show-edge-labels');
