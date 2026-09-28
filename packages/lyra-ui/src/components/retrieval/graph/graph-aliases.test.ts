import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './graph.js';
import type { LyraGraph, LyraGraphEdge, LyraGraphLink } from './graph.js';
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
// The deprecated `LyraGraphLink` interface stays assignable to and from `LyraGraphEdge`, so data
// typed with either name keeps compiling against both the `links` alias and `edges`.
const legacyEdges: readonly LyraGraphLink[] = edges;

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

  it('keeps links, selectedLinkIds and dimmedLinkIds working as aliases, each warning once', async () => {
    const canonical = linkState(
      await drawn(
        await fixture<LyraGraph>(html`<lr-graph
          selection-mode="multiple"
          .nodes=${nodes}
          .edges=${edges}
          .selectedEdgeIds=${['ab']}
          .dimmedEdgeIds=${['ab']}
        ></lr-graph>`)
      )
    );
    const states: string[] = [];
    const readback: string[] = [];
    const warnings = await captureDeprecationWarnings(ALIASES, async () => {
      for (let index = 0; index < 2; index += 1) {
        const el = await fixture<LyraGraph>(html`<lr-graph selection-mode="multiple"></lr-graph>`);
        el.nodes = nodes;
        el.links = legacyEdges;
        el.selectedLinkIds = ['ab'];
        el.dimmedLinkIds = ['ab'];
        await drawn(el);
        const readEdges: readonly LyraGraphEdge[] = el.links;
        states.push(linkState(el));
        readback.push(
          JSON.stringify([
            JSON.stringify(readEdges) === JSON.stringify(el.edges),
            el.selectedLinkIds,
            el.selectedEdgeIds,
            el.dimmedLinkIds,
            el.dimmedEdgeIds,
          ])
        );
      }
    });
    expect(states).to.deep.equal([canonical, canonical]);
    expect(readback[0]).to.equal('[true,["ab"],["ab"],["ab"],["ab"]]');
    expect(warnings.map(({ key }) => key)).to.deep.equal([
      'lyra-deprecated:lr-graph:property:links',
      'lyra-deprecated:lr-graph:property:selectedLinkIds',
      'lyra-deprecated:lr-graph:property:dimmedLinkIds',
    ]);
    expect(warnings[0]!.message).to.contain('edges');
  });

  it('keeps show-edge-labels and link-distance working as attribute aliases, warning once each', async () => {
    const canonical = linkState(
      await drawn(
        await fixture<LyraGraph>(html`<lr-graph
          with-edge-labels
          edge-distance="42"
          .nodes=${nodes}
          .edges=${edges}
        ></lr-graph>`)
      )
    );
    let state = '';
    let values: unknown[] = [];
    const warnings = await captureDeprecationWarnings(ALIASES, async () => {
      const el = await drawn(
        await fixture<LyraGraph>(html`<lr-graph
          show-edge-labels
          link-distance="42"
          .nodes=${nodes}
          .edges=${edges}
        ></lr-graph>`)
      );
      state = linkState(el);
      values = [el.withEdgeLabels, el.showEdgeLabels, el.edgeDistance, el.linkDistance];
    });
    expect(state).to.equal(canonical);
    expect(values).to.deep.equal([true, true, 42, 42]);
    expect(warnings.map(({ key }) => key).sort()).to.deep.equal([
      'lyra-deprecated:lr-graph:property:linkDistance',
      'lyra-deprecated:lr-graph:property:showEdgeLabels',
    ]);
  });

  it('lets the later of edge-distance and link-distance win in markup', async () => {
    const distances: number[] = [];
    await captureDeprecationWarnings(ALIASES, async () => {
      for (const markup of [
        html`<lr-graph edge-distance="20" link-distance="300"></lr-graph>`,
        html`<lr-graph link-distance="300" edge-distance="20"></lr-graph>`,
      ]) {
        const el = await fixture<LyraGraph>(markup);
        distances.push(el.edgeDistance);
      }
    });
    expect(distances).to.deep.equal([300, 20]);
  });

  it('syncs every canonical edge property back into its alias without warning', async () => {
    let readback = '';
    const warnings = await captureDeprecationWarnings(ALIASES, async () => {
      const el = await fixture<LyraGraph>(html`<lr-graph .nodes=${nodes}></lr-graph>`);
      el.edges = edges;
      el.selectedEdgeIds = ['ab'];
      el.dimmedEdgeIds = ['ab'];
      el.edgeDistance = 64;
      el.withEdgeLabels = true;
      await el.updateComplete;
      readback = JSON.stringify([
        el.links,
        el.selectedLinkIds,
        el.dimmedLinkIds,
        el.linkDistance,
        el.showEdgeLabels,
      ]);
    });
    expect(readback).to.equal(JSON.stringify([edges, ['ab'], ['ab'], 64, true]));
    expect(warnings).to.have.length(0);
  });

  it('fires lr-edge-enter/lr-edge-leave, then the lr-link-* aliases with their own equal detail, never warning', async () => {
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
    const detail = JSON.stringify({ sourceNodeId: 'a', targetNodeId: 'b', linkId: 'ab' });
    expect(seen).to.deep.equal([
      { type: 'lr-edge-enter', detail, cancelable: false },
      { type: 'lr-link-enter', detail, cancelable: false },
      { type: 'lr-edge-leave', detail, cancelable: false },
      { type: 'lr-link-leave', detail, cancelable: false },
    ]);
    expect(details.size, 'each event carries its own detail object').to.equal(4);
    expect(warnings).to.have.length(0);
  });

  it('fires lr-community-activate, then the lr-community-click alias, never warning', async () => {
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
      `lr-community-click:${detail}`,
      `lr-community-activate:${detail}`,
      `lr-community-click:${detail}`,
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

  it('keeps the deprecated --lr-link-color and --lr-node-fill working as fallbacks', async () => {
    const painted = await paint('--lr-link-color: rgb(1, 2, 3); --lr-node-fill: rgb(4, 5, 6)');
    expect(painted).to.deep.equal({ stroke: 'rgb(1, 2, 3)', fill: 'rgb(4, 5, 6)' });
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
