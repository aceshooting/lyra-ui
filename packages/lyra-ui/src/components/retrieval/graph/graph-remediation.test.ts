import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import {
  hoverUntilMatched,
  resetMouse,
  sendMouse,
  sendWheel,
  settlePointer,
} from '../../../../test/wtr-mouse.js';
import { LyraGraph, type LyraGraphLink } from './graph.js';
import { drawGraphScene } from './graph-canvas.js';

const nodes = [
  { id: 'a', label: 'Alpha', color: 'blue' },
  { id: 'b', label: 'Beta', color: 'blue' },
];

async function readyGraph(renderer: 'svg' | 'canvas', links: LyraGraphLink[]) {
  const graph = await fixture<LyraGraph>(html`
    <lr-graph
      renderer=${renderer}
      layout="layered"
      width="400"
      height="360"
      style="width:400px;height:360px"
      .nodes=${nodes}
      .links=${links}
    ></lr-graph>
  `);
  await waitUntil(
    () => graph.getNodePosition('b') != null,
    'Layered nodes positioned'
  );
  await graph.updateComplete;
  await settlePointer();
  return graph;
}

function canvasPoint(graph: LyraGraph, nodeId?: string): [number, number] {
  const canvas = graph.shadowRoot!.querySelector('canvas')!;
  const rect = canvas.getBoundingClientRect();
  const a = graph.getNodePosition(nodeId ?? 'a')!;
  const b = nodeId ? a : graph.getNodePosition('b')!;
  return [
    Math.round(rect.left + (a.x + b.x) / 2),
    Math.round(rect.top + (a.y + b.y) / 2),
  ];
}

describe('graph rendered interaction contracts', () => {
  afterEach(async () => resetMouse());

  for (const predecessor of [
    { name: 'zero-width', source: 'a', target: 'b', width: 0 },
    { name: 'transparent', source: 'a', target: 'b', color: 'transparent' },
    { name: 'dangling', source: 'a', target: 'missing' },
  ]) {
    it(`moves real SVG focus past a ${predecessor.name} link`, async () => {
      const dangling = predecessor.name === 'dangling';
      const graph = await readyGraph('svg', [
        { ...predecessor, id: 'hidden' },
        ...(dangling
          ? []
          : [
              {
                id: 'visible',
                source: 'a',
                target: 'b',
                label: 'Visible link',
              },
            ]),
      ]);
      graph.communities = [
        { id: 'community', label: 'Community', memberIds: ['a', 'b'] },
      ];
      await graph.updateComplete;
      const root = graph.shadowRoot!;
      const beta = root.querySelectorAll<SVGElement>('[part="node"]')[1]!;
      const hidden = root.querySelector<SVGElement>('[part="link"]')!;
      const target = root.querySelector<SVGElement>(
        dangling ? '[part="hull"]' : '[part="link"][role="button"]'
      )!;
      expect(hidden.hasAttribute('tabindex')).to.equal(false);
      expect(hidden.getAttribute('aria-hidden')).to.equal('true');
      beta.focus();
      await waitUntil(() => root.activeElement === beta, 'Beta receives focus');
      await sendKeys({ press: 'ArrowRight' });
      await waitUntil(
        () => target.getAttribute('tabindex') === '0',
        'Next operable item is the roving stop'
      );
      await settlePointer();
      expect(
        root.activeElement === target,
        'Focus follows the operable index'
      ).to.equal(true);
      await sendKeys({ press: 'ArrowLeft' });
      await waitUntil(
        () => root.activeElement === beta,
        'Backward navigation returns to Beta'
      );
      expect(hidden.hasAttribute('tabindex')).to.equal(false);
      expect(graph.links.length).to.equal(dangling ? 1 : 2);
    });
  }

  for (const renderer of ['svg', 'canvas'] as const) {
    it(`applies live minimum and maximum zoom bounds to native ${renderer} wheel input`, async () => {
      const graph = await readyGraph(renderer, [{ source: 'a', target: 'b' }]);
      const surface = graph.shadowRoot!.querySelector(
        renderer === 'canvas' ? 'canvas' : 'svg'
      )!;
      const scales: number[] = [];
      graph.addEventListener('lr-viewport-change', (event) =>
        scales.push(event.detail.k)
      );
      graph.minZoom = 1;
      graph.maxZoom = 2;
      await graph.updateComplete;
      await hoverUntilMatched(surface, 'Zoom surface hovered', (rect) => [
        rect.left + 20,
        rect.top + 20,
      ]);
      await sendWheel({ deltaX: 0, deltaY: -10000 });
      await waitUntil(
        () => scales.some((scale) => scale > 1),
        'Native wheel emits a zoomed viewport'
      );
      expect(Math.max(...scales)).to.equal(2);
      scales.length = 0;
      await sendWheel({ deltaX: 0, deltaY: 10000 });
      await waitUntil(
        () => scales.length > 0,
        'Reverse wheel emits a viewport'
      );
      expect(Math.min(...scales)).to.equal(1);
    });
  }

  it('emits canvas hover events once per native node/link identity transition and exit', async () => {
    const graph = await readyGraph('canvas', [
      { id: 'ab', source: 'a', target: 'b' },
    ]);
    const root = graph.shadowRoot!;
    const canvas = root.querySelector('canvas')!;
    const tooltip = root.querySelector<HTMLElement>('[part="tooltip"]')!;
    const events: { type: string; detail: unknown }[] = [];
    for (const type of [
      'lr-node-enter',
      'lr-node-leave',
      'lr-link-enter',
      'lr-link-leave',
    ] as const) {
      graph.addEventListener(type, (event) =>
        events.push({ type, detail: event.detail })
      );
    }
    await hoverUntilMatched(canvas, 'Alpha is hovered', () =>
      canvasPoint(graph, 'a')
    );
    await waitUntil(
      () => tooltip.textContent === 'Alpha' && !tooltip.hidden,
      'Alpha tooltip visible'
    );
    const alpha = canvasPoint(graph, 'a');
    await sendMouse({ type: 'move', position: [alpha[0] + 1, alpha[1]] });
    await settlePointer();
    expect(events).to.deep.equal([
      { type: 'lr-node-enter', detail: { nodeId: 'a' } },
    ]);

    // Controlled updates and rebuilt pick objects preserve the same public hover identity.
    graph.dimmedNodeIds = ['b'];
    graph.nodes = nodes.map((node) => ({ ...node }));
    await graph.updateComplete;
    await sendMouse({ type: 'move', position: alpha });
    await settlePointer();
    expect(events.length).to.equal(1);
    await sendMouse({ type: 'move', position: canvasPoint(graph) });
    await waitUntil(
      () => tooltip.textContent === 'Link from Alpha to Beta',
      'Link tooltip visible'
    );
    await sendMouse({ type: 'move', position: canvasPoint(graph, 'b') });
    await waitUntil(
      () => tooltip.textContent === 'Beta',
      'Beta tooltip visible'
    );
    await resetMouse();
    await waitUntil(() => tooltip.hidden, 'Exit hides the tooltip');
    expect(events).to.deep.equal([
      { type: 'lr-node-enter', detail: { nodeId: 'a' } },
      { type: 'lr-node-leave', detail: { nodeId: 'a' } },
      {
        type: 'lr-link-enter',
        detail: { sourceNodeId: 'a', targetNodeId: 'b', linkId: 'ab' },
      },
      {
        type: 'lr-link-leave',
        detail: { sourceNodeId: 'a', targetNodeId: 'b', linkId: 'ab' },
      },
      { type: 'lr-node-enter', detail: { nodeId: 'b' } },
      { type: 'lr-node-leave', detail: { nodeId: 'b' } },
    ]);
  });

  it('retires canvas hover identity on reconnect and a renderer round trip', async () => {
    const graph = await readyGraph('canvas', [{ source: 'a', target: 'b' }]);
    let enters = 0;
    graph.addEventListener('lr-node-enter', () => enters++);
    const hoverAlpha = async () => {
      const before = enters;
      const canvas = graph.shadowRoot!.querySelector('canvas')!;
      await hoverUntilMatched(canvas, 'Alpha hovered', () =>
        canvasPoint(graph, 'a')
      );
      await waitUntil(
        () => enters === before + 1,
        'Fresh hover enters Alpha once'
      );
    };
    await hoverAlpha();
    const parent = graph.parentElement!;
    graph.remove();
    parent.append(graph);
    await graph.updateComplete;
    await settlePointer();
    await hoverAlpha();
    graph.renderer = 'svg';
    await graph.updateComplete;
    graph.renderer = 'canvas';
    await graph.updateComplete;
    await settlePointer();
    await hoverAlpha();
    expect(enters).to.equal(3);
  });

  it('keeps zero-width canvas topology without pixels, picking, or a keyboard cursor', async () => {
    const graph = await readyGraph('canvas', [
      {
        id: 'hidden',
        source: 'a',
        target: 'b',
        color: 'red',
        directed: true,
        width: 0,
      },
    ]);
    const root = graph.shadowRoot!;
    const canvas = root.querySelector('canvas')!;
    const context = canvas.getContext('2d')!;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let redPixels = 0;
    let bluePixels = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (
        pixels[i]! < 50 &&
        pixels[i + 1]! < 50 &&
        pixels[i + 2]! > 200 &&
        pixels[i + 3]! > 0
      )
        bluePixels++;
      if (
        pixels[i]! > 200 &&
        pixels[i + 1]! < 50 &&
        pixels[i + 2]! < 50 &&
        pixels[i + 3]! > 0
      )
        redPixels++;
    }
    expect(bluePixels, 'Visible nodes were painted').to.be.greaterThan(0);
    expect(redPixels).to.equal(0);
    expect(root.querySelectorAll('[part="cursor-item"]').length).to.equal(2);
    expect(graph.links.length).to.equal(1);
    expect(root.querySelector('[part="data-list"]')!.textContent).to.include(
      'Link from Alpha to Beta'
    );
    let clicks = 0;
    graph.addEventListener('lr-link-click', () => clicks++);
    await hoverUntilMatched(canvas, 'Invisible link midpoint hovered', () =>
      canvasPoint(graph)
    );
    await sendMouse({ type: 'click', position: canvasPoint(graph) });
    await settlePointer();
    expect(clicks).to.equal(0);
    expect(
      root.querySelector<HTMLElement>('[part="tooltip"]')!.hidden
    ).to.equal(true);
  });
});

describe('zero-width canvas link paint', () => {
  for (const directed of [false, true]) {
    it(`omits all pixels for a zero-width ${
      directed ? 'directed' : 'undirected'
    } link after a visible link`, () => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const context = canvas.getContext('2d')!;
      drawGraphScene(
        context,
        { k: 1, x: 0, y: 0 },
        {
          hulls: [],
          links: [
            {
              x1: 10,
              y1: 20,
              x2: 90,
              y2: 20,
              width: 8,
              color: 'blue',
              directed: true,
            },
            {
              x1: 10,
              y1: 70,
              x2: 90,
              y2: 70,
              width: 0,
              color: 'red',
              directed,
            },
          ],
          nodes: [],
          edgeLabels: [],
          nodeLabels: [],
          showNodeLabels: false,
          haloColor: 'black',
          selectedColor: 'black',
          labelColor: 'black',
          labelHaloColor: 'white',
          font: '10px sans-serif',
        }
      );
      expect(context.getImageData(50, 20, 1, 1).data[3]).to.be.greaterThan(0);
      const omitted = context.getImageData(0, 50, 100, 50).data;
      expect(omitted.some((channel, i) => i % 4 === 3 && channel > 0)).to.equal(
        false
      );
    });
  }
});
