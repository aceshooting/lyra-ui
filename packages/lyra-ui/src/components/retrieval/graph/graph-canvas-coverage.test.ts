import { nextFrame, twoFrames } from '../../../../test/frames.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import * as graphSupport from '../../../../test/graph-test-support.js';
const { fixture, expect, html, waitUntil, aTimeout, oneEvent, select, LyraGraphElement, layeredLayout, invalidateLyraTheme, ANNOUNCEMENT_SINK_ATTRIBUTE, resetMouse, sendMouse, asTestGraph, mediaQueryOverride, nodes, links, announcementSink, announcementTexts, stubPointerCapture, stubNoOwnerWindow, NODE_COUNT_TIMEOUT, ALPHA_SETTLE_TIMEOUT, waitForCanvasBackingStore, stubIntersectionObserver } = graphSupport;
void [fixture, expect, html, waitUntil, aTimeout, oneEvent, select, LyraGraphElement, layeredLayout, invalidateLyraTheme, ANNOUNCEMENT_SINK_ATTRIBUTE, resetMouse, sendMouse, asTestGraph, mediaQueryOverride, nodes, links, announcementSink, announcementTexts, stubPointerCapture, stubNoOwnerWindow, NODE_COUNT_TIMEOUT, ALPHA_SETTLE_TIMEOUT, waitForCanvasBackingStore, stubIntersectionObserver];
type GraphSimulationNode = graphSupport.GraphSimulationNode;
type GraphSimulationLink = graphSupport.GraphSimulationLink;
type LyraGraph = graphSupport.LyraGraph;
type LyraGraphEdge = graphSupport.LyraGraphEdge;
type LyraGraphNode = graphSupport.LyraGraphNode;
type LyraGraphNodeLabelsMode = graphSupport.LyraGraphNodeLabelsMode;
type D3SimulationLinkDatum<Node extends D3SimulationNodeDatum> =
  graphSupport.D3SimulationLinkDatum<Node>;
type D3SimulationNodeDatum = graphSupport.D3SimulationNodeDatum;
const typeWitness: [GraphSimulationNode, GraphSimulationLink, LyraGraph, LyraGraphEdge, LyraGraphNode, LyraGraphNodeLabelsMode, D3SimulationLinkDatum<GraphSimulationNode>, D3SimulationNodeDatum] | null = null;
void typeWitness;

describe('coverage: canvas renderer internals', () => {
  it('re-arms the DPR watcher and marks the canvas dirty when the devicePixelRatio media query changes', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        width="400"
        height="300"
        style="width:400px;height:300px"
      ></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    // Stop the simulation before observing canvasScene: onTick() unconditionally nulls it on every
    // tick (markCanvasDirty()) while the coalesced redraw only fires once per real frame, so under a
    // heavily loaded test run canvasScene is falsy far more often than not while ticking -- polling
    // for it without first stopping the ticking is a race the assertion can lose even with a long
    // timeout. Every other test in this describe block that inspects canvasScene follows the same
    // pattern.
    (el as unknown as { simulation?: { stop: () => void } }).simulation?.stop();
    type Internals = { canvasDprQuery?: MediaQueryList; canvasScene?: unknown };
    await waitUntil(
      () => !!(el as unknown as Internals).canvasScene,
      undefined,
      { timeout: NODE_COUNT_TIMEOUT }
    );
    const query = (el as unknown as Internals).canvasDprQuery;
    expect(query).to.exist;
    expect((el as unknown as Internals).canvasScene).to.exist;
    query!.dispatchEvent(new Event('change'));
    expect((el as unknown as Internals).canvasScene).to.be.undefined; // markCanvasDirty() cleared it
  });

  it('resolves a var(--x) node/link color to its cascaded value in the canvas scene (categorical fallback + explicit var() link color)', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        width="400"
        height="300"
        style="width:400px;height:300px"
      ></lr-graph>`
    )) as LyraGraph;
    el.nodeTypes = [{ id: 'person', label: 'Person' }]; // no explicit color -> categorical var(--lr-graph-cat-1) fallback
    el.nodes = [
      { id: 'a', label: 'A', type: 'person' },
      { id: 'b', label: 'B' },
    ];
    el.edges = [{ source: 'a', target: 'b', color: 'var(--lr-color-danger)' }];
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    (el as unknown as { simulation?: { stop: () => void } }).simulation?.stop();
    type Internals = {
      canvasScene?: { nodes: { fill: string }[]; links: { color: string }[] };
    };
    await waitUntil(
      () => !!(el as unknown as Internals).canvasScene,
      undefined,
      { timeout: NODE_COUNT_TIMEOUT }
    );
    const scene = (el as unknown as Internals).canvasScene!;
    expect(scene.nodes.length).to.equal(2);
    for (const n of scene.nodes) {
      expect(n.fill).to.not.include('var(');
      expect(n.fill).to.not.equal('');
    }
    expect(scene.links.length).to.equal(1);
    expect(scene.links[0]!.color).to.not.include('var(');
    expect(scene.links[0]!.color).to.not.equal('');
  });

  it('resolves inherited node, link, and community colors before canvas paint assignment', async () => {
    const el = await fixture<LyraGraph>(html`
      <lr-graph
        renderer="canvas"
        width="400"
        height="300"
        style="width:400px;height:300px;color:rgb(12, 34, 56)"
      ></lr-graph>
    `);
    el.communities = [{ id: 'team', memberIds: ['a', 'b'], color: 'inherit' }];
    el.nodes = [
      { id: 'a', label: 'A', communityId: 'team', color: 'inherit' },
      { id: 'b', label: 'B', communityId: 'team' },
    ];
    el.edges = [{ source: 'a', target: 'b', color: 'unset' }];
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    (el as unknown as { simulation?: { stop: () => void } }).simulation?.stop();
    type Internals = {
      canvasScene?: {
        hulls: { fill: string }[];
        links: { color: string }[];
        nodes: { fill: string }[];
      };
    };
    await waitUntil(
      () => !!(el as unknown as Internals).canvasScene,
      undefined,
      { timeout: NODE_COUNT_TIMEOUT }
    );

    const scene = (el as unknown as Internals).canvasScene!;
    expect(scene.hulls[0]!.fill).to.equal('rgb(12, 34, 56)');
    expect(scene.links[0]!.color).to.equal('rgb(12, 34, 56)');
    expect(scene.nodes[0]!.fill).to.equal('rgb(12, 34, 56)');
  });

  it('shares one computed-color probe across a navigable-link scan', async () => {
    const el = await fixture<LyraGraph>(html`<lr-graph></lr-graph>`);
    el.nodes = [
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
      { id: 'd' },
    ];
    el.edges = [
      { source: 'a', target: 'b', color: 'inherit' },
      { source: 'b', target: 'c', color: 'unset' },
      { source: 'c', target: 'd', color: 'initial' },
    ];
    await el.updateComplete;
    await waitUntil(
      () =>
        (el as unknown as { readonly simNodes: readonly unknown[] }).simNodes
          .length === 4,
      undefined,
      { timeout: NODE_COUNT_TIMEOUT }
    );
    (el as unknown as { simulation?: { stop: () => void } }).simulation?.stop();
    type Internals = {
      navigableLinksCache?: unknown[];
      navigableLinks(): unknown[];
      createCanvasColorProbe(): HTMLElement;
      resolvedCssColorCache: Map<string, string>;
    };
    const internals = el as unknown as Internals;
    internals.navigableLinksCache = undefined;
    internals.resolvedCssColorCache.clear();
    const createProbe = internals.createCanvasColorProbe;
    let probeCount = 0;
    internals.createCanvasColorProbe = () => {
      probeCount += 1;
      return createProbe.call(el);
    };
    try {
      expect(internals.navigableLinks().length).to.equal(3);
      expect(probeCount).to.equal(1);
      // A warm color cache adds no probe at all.
      internals.navigableLinksCache = undefined;
      expect(internals.navigableLinks().length).to.equal(3);
      expect(probeCount).to.equal(1);
    } finally {
      internals.createCanvasColorProbe = createProbe;
    }
  });

  it('reuses the cached canvas scene on a same-band pan/zoom repaint instead of rebuilding it every frame', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        width="400"
        height="300"
        style="width:400px;height:300px"
      ></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    (el as unknown as { simulation?: { stop: () => void } }).simulation?.stop();
    type Internals = { canvasScene?: unknown };
    await waitUntil(
      () => !!(el as unknown as Internals).canvasScene,
      undefined,
      { timeout: NODE_COUNT_TIMEOUT }
    );
    const sceneBefore = (el as unknown as Internals).canvasScene;
    expect(sceneBefore).to.exist;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    // A small in-band zoom (doesn't cross the node-label/edge-label visibility thresholds) triggers
    // markCanvasCameraDirty() -- camera-only, so drawCanvas() reuses the existing scene rather than
    // rebuilding it (see drawCanvas()'s own comment on canvasScene reuse).
    canvas.dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaY: -10,
        clientX: 10,
        clientY: 10,
      })
    );
    // wait-reason: negative assertion, a wheel event over the canvas must not rebuild the canvas scene
    await aTimeout(300);
    expect((el as unknown as Internals).canvasScene).to.equal(sceneBefore);
  });

  it('dragging a node in canvas mode live-updates its fx/fy via onCanvasPointerMove, clearing them on release', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        width="400"
        height="300"
        style="width:400px;height:300px"
      ></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    // Stop the simulation and pin a deterministic position (matching this describe block's other
    // pointer-hit-testing tests) so the hit-test target is exact and stable instead of racing a
    // still-ticking layout.
    (el as unknown as { simulation?: { stop: () => void } }).simulation?.stop();
    const target = el.simNodes.find((n) => n.id === 'a')!;
    target.x = 100;
    target.y = 100;
    (el as unknown as { pickDirty: boolean }).pickDirty = true;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const startX = rect.left + target.x;
    const startY = rect.top + target.y;
    const capture = stubPointerCapture(canvas);
    try {
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          clientX: startX,
          clientY: startY,
          pointerId: 1,
        })
      );
      expect(capture.captured.has(1)).to.equal(true);
      canvas.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientX: startX + 40,
          clientY: startY + 20,
          pointerId: 1,
        })
      );
      expect(target.fx).to.be.a('number');
      expect(target.fy).to.be.a('number');
      canvas.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          clientX: startX + 40,
          clientY: startY + 20,
          pointerId: 1,
        })
      );
      expect(capture.captured.has(1)).to.equal(false);
      expect(target.fx).to.be.null;
      expect(target.fy).to.be.null;
    } finally {
      capture.restore();
    }
  });

  it('cancels a canvas node drag on pointercancel and lostpointercapture', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        width="400"
        height="300"
        style="width:400px;height:300px"
      ></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });

    type Internals = {
      canvasDragNode?: unknown;
      canvasPointerId?: number;
      canvasPointerDownAt?: { x: number; y: number };
      pickDirty: boolean;
      simulation?: { stop: () => void; alphaTarget: () => number };
    };
    const internals = el as unknown as Internals;
    internals.simulation?.stop();
    const target = el.simNodes.find((node) => node.id === 'a')!;
    target.x = 100;
    target.y = 100;
    internals.pickDirty = true;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const startX = rect.left + target.x;
    const startY = rect.top + target.y;
    const captured: number[] = [];
    const released: number[] = [];
    canvas.setPointerCapture = (pointerId) => captured.push(pointerId);
    canvas.releasePointerCapture = (pointerId) => released.push(pointerId);

    canvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        clientX: startX,
        clientY: startY,
        pointerId: 41,
      })
    );
    expect(target.fx).to.equal(100);
    expect(target.fy).to.equal(100);
    canvas.dispatchEvent(
      new PointerEvent('pointercancel', { bubbles: true, pointerId: 41 })
    );
    expect(target.fx).to.be.null;
    expect(target.fy).to.be.null;
    expect(internals.canvasDragNode).to.be.undefined;
    expect(internals.canvasPointerId).to.be.undefined;
    expect(internals.canvasPointerDownAt).to.be.undefined;
    expect(internals.simulation?.alphaTarget()).to.equal(0);
    expect(captured).to.deep.equal([41]);
    expect(released).to.deep.equal([41]);

    internals.pickDirty = true;
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        clientX: startX,
        clientY: startY,
        pointerId: 42,
      })
    );
    expect(target.fx).to.equal(100);
    canvas.dispatchEvent(
      new PointerEvent('lostpointercapture', { bubbles: true, pointerId: 42 })
    );
    expect(target.fx).to.be.null;
    expect(target.fy).to.be.null;
    expect(internals.canvasDragNode).to.be.undefined;
    expect(internals.canvasPointerId).to.be.undefined;
    expect(internals.canvasPointerDownAt).to.be.undefined;
    expect(internals.simulation?.alphaTarget()).to.equal(0);
    expect(captured).to.deep.equal([41, 42]);
    expect(released).to.deep.equal([41]);
  });

  it('cleans up a live canvas node drag when disconnected', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        width="400"
        height="300"
        style="width:400px;height:300px"
      ></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });

    type Internals = {
      canvasDragNode?: unknown;
      canvasPointerId?: number;
      canvasPointerDownAt?: { x: number; y: number };
      pickDirty: boolean;
      simulation?: { stop: () => void; alphaTarget: () => number };
    };
    const internals = el as unknown as Internals;
    internals.simulation?.stop();
    const target = el.simNodes.find((node) => node.id === 'a')!;
    target.x = 100;
    target.y = 100;
    internals.pickDirty = true;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const released: number[] = [];
    canvas.setPointerCapture = () => {};
    canvas.releasePointerCapture = (pointerId) => released.push(pointerId);
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        clientX: rect.left + target.x,
        clientY: rect.top + target.y,
        pointerId: 43,
      })
    );
    expect(target.fx).to.equal(100);

    el.remove();
    expect(target.fx).to.be.null;
    expect(target.fy).to.be.null;
    expect(internals.canvasDragNode).to.be.undefined;
    expect(internals.canvasPointerId).to.be.undefined;
    expect(internals.canvasPointerDownAt).to.be.undefined;
    expect(internals.simulation?.alphaTarget()).to.equal(0);
    expect(released).to.deep.equal([43]);
  });

  it('canvas pointer click resolves a link (not a node) and emits lr-edge-activate', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        width="400"
        height="300"
        style="width:400px;height:300px"
      ></lr-graph>`
    )) as LyraGraph;
    el.nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    el.edges = [{ source: 'a', target: 'b' }];
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    await waitForCanvasBackingStore(canvas);
    (el as unknown as { simulation?: { stop: () => void } }).simulation?.stop();
    const a = el.simNodes.find((n) => n.id === 'a')!;
    const b = el.simNodes.find((n) => n.id === 'b')!;
    // Deterministic, well-separated positions so the link midpoint is far from both node circles.
    a.x = 50;
    a.y = 150;
    b.x = 350;
    b.y = 150;
    (el as unknown as { pickDirty: boolean }).pickDirty = true;
    const rect = canvas.getBoundingClientRect();
    let detail: { sourceNodeId: string; targetNodeId: string } | undefined;
    el.addEventListener(
      'lr-edge-activate',
      (e) => (detail = (e as CustomEvent).detail)
    );
    const midX = rect.left + 200;
    const midY = rect.top + 150;
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        clientX: midX,
        clientY: midY,
        pointerId: 32,
      })
    );
    canvas.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        clientX: midX,
        clientY: midY,
        pointerId: 32,
      })
    );
    expect(detail).to.deep.equal({ sourceNodeId: 'a', targetNodeId: 'b' });
  });

  it('canvas pointer click resolves a community hull (not a node/link) and emits lr-community-activate', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        width="400"
        height="300"
        style="width:400px;height:300px"
      ></lr-graph>`
    )) as LyraGraph;
    el.communities = [{ id: 'team-1', memberIds: [] }]; // no label -- also exercises the id fallback
    el.nodes = [
      { id: 'a', label: 'A', communityId: 'team-1' },
      { id: 'b', label: 'B', communityId: 'team-1' },
      { id: 'c', label: 'C', communityId: 'team-1' },
    ];
    el.edges = [];
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    await waitForCanvasBackingStore(canvas);
    (el as unknown as { simulation?: { stop: () => void } }).simulation?.stop();
    const [a, b, c] = el.simNodes;
    a!.x = 100;
    a!.y = 100;
    b!.x = 300;
    b!.y = 100;
    c!.x = 200;
    c!.y = 250;
    (el as unknown as { pickDirty: boolean }).pickDirty = true;
    const rect = canvas.getBoundingClientRect();
    let detail: { communityId: string } | undefined;
    el.addEventListener(
      'lr-community-activate',
      (e) => (detail = (e as CustomEvent).detail)
    );
    const cx = rect.left + 200;
    const cy = rect.top + 150; // centroid of the a/b/c triangle, well inside the hull, away from every node
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        clientX: cx,
        clientY: cy,
        pointerId: 33,
      })
    );
    canvas.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        clientX: cx,
        clientY: cy,
        pointerId: 33,
      })
    );
    expect(detail).to.deep.equal({ communityId: 'team-1' });
  });

  it('pointerleave cancels an in-flight coalesced hover and hides the tooltip (canvas mode)', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        seed="7"
        width="400"
        height="300"
        style="width:400px;height:300px"
      ></lr-graph>`
    )) as LyraGraph;
    await graphSupport.readyGraphPair(el, 'canvas');
    await waitForCanvasBackingStore(el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement);
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const target = el.simNodes[0]!;
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: rect.left + target.x!,
        clientY: rect.top + target.y!,
        pointerId: 34,
      })
    );
    // Leave before the coalesced rAF hover has a chance to resolve.
    canvas.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
    expect((el as unknown as { hoverRafId?: number }).hoverRafId).to.be
      .undefined;
    const tooltip = el.shadowRoot!.querySelector(
      '[part="tooltip"]'
    ) as HTMLElement;
    expect(tooltip.hasAttribute('hidden')).to.be.true;
    await twoFrames(); // the canceled frame must never fire and re-show it
    expect(tooltip.hasAttribute('hidden')).to.be.true;
  });

  it('nodeAtCanvasPoint finds the nearest node within radius, undefined when nothing is close (dblclick geometric fallback)', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        seed="7"
        width="400"
        height="300"
        style="width:400px;height:300px"
      ></lr-graph>`
    )) as LyraGraph;
    await graphSupport.readyGraphPair(el, 'canvas');
    await waitForCanvasBackingStore(el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement);
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const target = el.simNodes[0]!;
    const rect = canvas.getBoundingClientRect();
    const nodeAtCanvasPoint = (
      el as unknown as {
        nodeAtCanvasPoint: (x: number, y: number) => { id: string } | undefined;
      }
    ).nodeAtCanvasPoint.bind(el);
    const found = nodeAtCanvasPoint(
      rect.left + target.x!,
      rect.top + target.y!
    );
    expect(found?.id).to.equal(target.id);
    const miss = nodeAtCanvasPoint(rect.left - 5000, rect.top - 5000);
    expect(miss).to.be.undefined;
  });

  it('canvas mode draws the focus halo in the built scene when focusNodeId resolves', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        focus-node-id="a"
        width="400"
        height="300"
        style="width:400px;height:300px"
      ></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    (el as unknown as { simulation?: { stop: () => void } }).simulation?.stop();
    type Internals = {
      canvasScene?: { focusHalo?: { x: number; y: number; r: number } };
    };
    await waitUntil(
      () => !!(el as unknown as Internals).canvasScene,
      undefined,
      { timeout: NODE_COUNT_TIMEOUT }
    );
    expect((el as unknown as Internals).canvasScene?.focusHalo).to.exist;
  });

  it('canvas mode paints the cue for the actually focused node, link, or hull only', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        width="400"
        height="300"
        style="width:400px;height:300px"
      ></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = [{ id: 'ab', source: 'a', target: 'b' }];
    el.communities = [{ id: 'team', memberIds: ['a', 'b'] }];
    await el.updateComplete;
    await waitUntil(
      () =>
        el.shadowRoot!.querySelectorAll('[part="cursor-item"]').length === 1,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    (el as unknown as { simulation?: { stop: () => void } }).simulation?.stop();
    const items = [
      ...el.shadowRoot!.querySelectorAll<HTMLButtonElement>(
        '[part="cursor-item"]'
      ),
    ];
    const build = () =>
      (
        el as unknown as {
          buildCanvasScene: (style: CSSStyleDeclaration) => {
            keyboardFocusRing?: unknown;
            keyboardFocusLink?: unknown;
            keyboardFocusHull?: unknown;
            haloColor: string;
          };
        }
      ).buildCanvasScene(getComputedStyle(el));

    expect([
      build().keyboardFocusRing,
      build().keyboardFocusLink,
      build().keyboardFocusHull,
    ]).to.deep.equal([undefined, undefined, undefined]);

    await focusByKeyboard(items[0]!);
    let scene = build();
    expect(Boolean(scene.keyboardFocusRing)).to.equal(true);
    expect(Boolean(scene.keyboardFocusLink)).to.equal(false);
    expect(Boolean(scene.keyboardFocusHull)).to.equal(false);

    items[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    await el.updateComplete;
    items[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    await el.updateComplete;
    scene = build();
    expect(Boolean(scene.keyboardFocusRing)).to.equal(false);
    expect(Boolean(scene.keyboardFocusLink)).to.equal(true);
    expect(Boolean(scene.keyboardFocusHull)).to.equal(false);

    items[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    await el.updateComplete;
    scene = build();
    expect(Boolean(scene.keyboardFocusRing)).to.equal(false);
    expect(Boolean(scene.keyboardFocusLink)).to.equal(false);
    expect(Boolean(scene.keyboardFocusHull)).to.equal(true);

    const originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === '(forced-colors: active)',
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => true,
    })) as typeof window.matchMedia;
    try {
      const probe = document.createElement('span');
      probe.style.color = 'CanvasText';
      el.shadowRoot!.append(probe);
      const expected = getComputedStyle(probe).color;
      probe.remove();
      expect(build().haloColor).to.equal(expected);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('canvas mode with zero visible items becomes the tab stop itself, with no keyboard focus ring/halo in the scene', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        width="400"
        height="300"
        style="width:400px;height:300px"
      ></lr-graph>`
    )) as LyraGraph;
    el.nodeTypes = [{ id: 'x', label: 'X' }];
    el.hiddenTypes = ['x'];
    el.nodes = [{ id: 'a', label: 'A', type: 'x' }];
    el.edges = [];
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    (el as unknown as { simulation?: { stop: () => void } }).simulation?.stop();
    type Internals = {
      canvasScene?: { keyboardFocusRing?: unknown; focusHalo?: unknown };
    };
    await waitUntil(
      () => !!(el as unknown as Internals).canvasScene,
      undefined,
      { timeout: NODE_COUNT_TIMEOUT }
    );
    expect(el.simNodes.length).to.equal(0); // sanity: every node is hidden
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.getAttribute('tabindex')).to.equal('0'); // no roving items -- the canvas itself is the tab stop
    // Every node being hidden always produces a "0 of 1"-style hidden-count announcement (see
    // announceHiddenNodeCount()) -- graphLiveText is therefore never empty here, so this doesn't
    // (and can't, through any public API) exercise the live-region's own empty-string fallback.
    expect(
      el.shadowRoot!.querySelector('[part="live-region"]')!.textContent
    ).to.contain('1 of 1 nodes hidden');
    expect((el as unknown as Internals).canvasScene?.keyboardFocusRing).to.be
      .undefined;
    expect((el as unknown as Internals).canvasScene?.focusHalo).to.be.undefined;
  });

  it('a canvas cursor-item roving sequence can advance from nodes into a link (tabindex true branch for a link cursor-item)', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        width="400"
        height="300"
        style="width:400px;height:300px"
      ></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes; // a, b
    el.edges = links; // one link a->b
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const items = () =>
      [
        ...el.shadowRoot!.querySelectorAll('[part="cursor-item"]'),
      ] as HTMLButtonElement[];
    items()[0]!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    );
    await el.updateComplete;
    items()[0]!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    );
    await el.updateComplete;
    expect(items()[0]!.parentElement!.getAttribute('aria-posinset')).to.equal('3');
  });

  it('canvas virtual cursor reaches communities and activates them via click and Enter, with an id fallback when unlabeled', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        width="400"
        height="300"
        style="width:400px;height:300px"
      ></lr-graph>`
    )) as LyraGraph;
    el.communities = [{ id: 'team-1', memberIds: [] }]; // no label -> falls back to the id
    el.nodes = [
      { id: 'a', label: 'A', communityId: 'team-1' },
      { id: 'b', label: 'B', communityId: 'team-1' },
    ];
    el.edges = [];
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const items = [
      ...el.shadowRoot!.querySelectorAll('[part="cursor-item"]'),
    ] as HTMLButtonElement[];
    expect(items).to.have.length(1);
    const hullItem = items[0]!;
    hullItem.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    await el.updateComplete;
    expect(hullItem.getAttribute('aria-label')).to.contain('team-1');
    let detail: { communityId: string } | undefined;
    el.addEventListener(
      'lr-community-activate',
      (e) => (detail = (e as CustomEvent).detail)
    );
    hullItem.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(detail).to.deep.equal({ communityId: 'team-1' });
    detail = undefined;
    hullItem.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    expect(detail).to.deep.equal({ communityId: 'team-1' });
  });
});

describe('coverage: selection/drag/hover edge cases', () => {
  it('multiple mode: Ctrl-click toggles a LINK selection too, preserving other selected link ids', async () => {
    const el = (await fixture(
      html`<lr-graph selection-mode="multiple"></lr-graph>`
    )) as LyraGraph;
    el.nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ];
    el.edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
    ];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 3,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    const linkEls = [
      ...el.shadowRoot!.querySelectorAll('[part="link"]:not([data-dangling])'),
    ] as SVGElement[];
    let detail: { selectedNodeIds: string[]; selectedEdgeIds: string[] } | undefined;
    el.addEventListener(
      'lr-selection-change',
      (e) => (detail = (e as CustomEvent).detail)
    );

    linkEls[0]!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, ctrlKey: true })
    );
    expect(detail).to.deep.equal({ selectedNodeIds: [], selectedEdgeIds: ['a->b'] });

    el.selectedEdgeIds = ['a->b'];
    await el.updateComplete;
    linkEls[1]!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, ctrlKey: true })
    );
    expect(detail).to.deep.equal({ selectedNodeIds: [], selectedEdgeIds: ['a->b', 'b->c'] });

    el.selectedEdgeIds = ['a->b', 'b->c'];
    await el.updateComplete;
    linkEls[0]!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, ctrlKey: true })
    );
    expect(detail).to.deep.equal({ selectedNodeIds: [], selectedEdgeIds: ['b->c'] });
  });

  it('dragging a node (svg mode) sets fx/fy live and clears them + isDragging on release (d3-drag start/drag/end)', async () => {
    const el = await graphSupport.mountGraphPair();
    const nodeEl = el.shadowRoot!.querySelector(
      '[part="node"]'
    ) as SVGCircleElement;
    const target = el.simNodes.find((n) => n.id === 'a')!;
    nodeEl.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        clientX: 0,
        clientY: 0,
        view: window,
      })
    );
    expect((el as unknown as { isDragging: boolean }).isDragging).to.be.true;
    document.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        clientX: 60,
        clientY: 40,
        view: window,
      })
    );
    expect(target.fx).to.be.a('number');
    expect(target.fy).to.be.a('number');
    document.dispatchEvent(
      new MouseEvent('mouseup', { bubbles: true, view: window })
    );
    expect((el as unknown as { isDragging: boolean }).isDragging).to.be.false;
    expect(target.fx).to.be.null;
    expect(target.fy).to.be.null;
  });

  it('suppresses lr-node-leave and leaves data-hovered untouched while panning (mouseleave, mirrors the existing mouseenter suppression tests)', async () => {
    const el = await graphSupport.mountGraphPair();
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    nodeEl.setAttribute('data-hovered', ''); // as if entered before the pan started
    (el as unknown as { isPanning: boolean }).isPanning = true;
    let fired = false;
    el.addEventListener('lr-node-leave', () => (fired = true));
    nodeEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(fired).to.be.false;
    expect(nodeEl.hasAttribute('data-hovered')).to.be.true; // untouched -- the guard returned early
  });

  it('an unseeded new node linked to an existing neighbor still spawns near it (Math.random() jitter branch)', async () => {
    const el = (await fixture(
      html`<lr-graph edge-distance="100"></lr-graph>`
    )) as LyraGraph;
    el.nodes = [{ id: 'a', label: 'A' }];
    el.edges = [];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 1,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    const before = el.simNodes.find((n) => n.id === 'a')!;
    const aX = before.x!;
    const aY = before.y!;

    el.nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    el.edges = [{ source: 'a', target: 'b' }];
    await el.updateComplete;
    const spawnedB = el.simNodes.find((n) => n.id === 'b')!;
    const distance = Math.hypot(spawnedB.x! - aX, spawnedB.y! - aY);
    expect(distance).to.be.lessThan(el.edgeDistance);
  });
});

describe('coverage: drawn edge label declutter gate (onTick, real ticks)', () => {
  it('a labelless link with withEdgeLabels on does not throw across a real tick (edgeLabelWidth("") fallback)', async () => {
    const el = (await fixture(
      html`<lr-graph with-edge-labels></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links; // no .label
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    // wait-reason: negative assertion, an unlabeled edge must not produce a link-label after real ticks have run onTick()
    await aTimeout(100); // let at least one real tick run onTick()'s edge-label loop
    expect(el.shadowRoot!.querySelector('[part="link-label"]') == null).to.be
      .true;
  });

  it('hides a drawn edge label once its measured width exceeds the length-declutter gate (visibility toggle)', async () => {
    const el = (await fixture(
      html`<lr-graph
        with-edge-labels
        edge-distance="10"
        width="200"
        height="200"
      ></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = [
      {
        source: 'a',
        target: 'b',
        label: 'a very long label that will not fit on a short edge',
      },
    ];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="link-label"]')?.getAttribute('visibility') === 'hidden',
      'link label rendered hidden',
      { timeout: NODE_COUNT_TIMEOUT }
    );
    const label = el.shadowRoot!.querySelector(
      '[part="link-label"]'
    ) as SVGTextElement;
    expect(label.getAttribute('visibility')).to.equal('hidden');
  });
});

describe('coverage: ownerWindow-unavailable fallbacks', () => {
  it("computedStyle/cameraTransitionMs fall back to the element's own inline style when ownerWindow is unavailable", async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    const restore = stubNoOwnerWindow(el);
    try {
      const cameraTransitionMs = (
        el as unknown as { cameraTransitionMs: () => number }
      ).cameraTransitionMs.bind(el);
      expect(cameraTransitionMs()).to.equal(180); // no --lr-transition-base on the bare inline style -> default
    } finally {
      restore();
    }
  });

  it('scheduleViewportChange/scheduleCanvasDraw/tweenCamera no-op instead of throwing when ownerWindow is unavailable', async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" width="200" height="200"></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    type Internals = {
      scheduleViewportChange: () => void;
      viewportChangeRafId?: number;
      markCanvasDirty: () => void;
      canvasDrawRafId?: number;
      simulation?: { stop: () => void };
      tweenCamera: (fn: () => unknown) => Promise<boolean>;
    };
    const internal = el as unknown as Internals;
    // Stop the settle animation and let any already-in-flight rAF (a real, pre-stub draw/viewport
    // frame) actually run to completion first -- both scheduleCanvasDraw() and
    // scheduleViewportChange() coalesce to at most one outstanding frame, so a frame already
    // pending from ordinary mount activity would otherwise make each call below return via that
    // "already scheduled" short-circuit before ever reaching the ownerWindow check this test targets.
    internal.simulation?.stop();
    await waitUntil(
      () => internal.viewportChangeRafId === undefined && internal.canvasDrawRafId === undefined,
      'in-flight canvas frames drained'
    );
    expect(
      internal.viewportChangeRafId,
      'precondition: no frame already pending'
    ).to.be.undefined;
    expect(internal.canvasDrawRafId, 'precondition: no frame already pending')
      .to.be.undefined;
    const restore = stubNoOwnerWindow(el);
    try {
      internal.scheduleViewportChange();
      expect(internal.viewportChangeRafId).to.be.undefined;
      internal.markCanvasDirty();
      expect(internal.canvasDrawRafId).to.be.undefined;
      expect(await internal.tweenCamera(() => ({ k: 1, x: 0, y: 0 }))).to.equal(
        false
      );
    } finally {
      restore();
    }
  });

  it('drawCanvas/redrawPickCanvas/hitTest default devicePixelRatio to 1 when ownerWindow is unavailable', async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" width="200" height="200"></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const restore = stubNoOwnerWindow(el);
    try {
      type Internals = {
        drawCanvas: () => void;
        redrawPickCanvas: () => void;
        hitTest: (x: number, y: number) => unknown;
      };
      const internal = el as unknown as Internals;
      expect(() => internal.drawCanvas()).to.not.throw();
      expect(() => internal.redrawPickCanvas()).to.not.throw();
      const rect = canvas.getBoundingClientRect();
      expect(() =>
        internal.hitTest(rect.left + 5, rect.top + 5)
      ).to.not.throw();
    } finally {
      restore();
    }
  });

  it('updateCanvasTooltip skips viewport clamping when ownerWindow is unavailable', async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" width="200" height="200"></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const a = el.simNodes.find((n) => n.id === 'a')!;
    const restore = stubNoOwnerWindow(el);
    try {
      const updateCanvasTooltip = (
        el as unknown as {
          updateCanvasTooltip: (hit: unknown, x: number, y: number) => void;
        }
      ).updateCanvasTooltip.bind(el);
      const rect = (
        el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement
      ).getBoundingClientRect();
      expect(() =>
        updateCanvasTooltip({ kind: 'node', node: a }, 12, 34)
      ).to.not.throw();
      const tooltip = el.shadowRoot!.querySelector(
        '[part="tooltip"]'
      ) as HTMLElement;
      // Unclamped -- the viewport-adjustment branch never ran, so this is exactly clientX/Y minus
      // the canvas's own rect offset, with no further boundary correction applied on top.
      expect(tooltip.style.left).to.equal(`${12 - rect.left}px`);
      expect(tooltip.style.top).to.equal(`${34 - rect.top}px`);
    } finally {
      restore();
    }
  });

  it("onGraphKeyDown's double-activate timer falls back to 0 instead of throwing when ownerWindow is unavailable", async () => {
    const el = await graphSupport.mountGraphPair();
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    const restore = stubNoOwnerWindow(el);
    try {
      expect(() =>
        nodeEl.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
        )
      ).to.not.throw();
    } finally {
      restore();
    }
  });

  it("scheduleViewportChange's/scheduleCanvasDraw's/tweenCamera's per-frame callbacks abort when ownerWindow changes mid-flight (no disconnect)", async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" width="200" height="200"></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    type Internals = {
      scheduleViewportChange: () => void;
      markCanvasDirty: () => void;
      simulation?: { stop: () => void };
    };
    const internal = el as unknown as Internals;
    internal.simulation?.stop();
    await twoFrames(); // flush any real frame already in flight from ordinary mount activity

    // scheduleViewportChange(): schedule with a REAL ownerWindow, then swap it out before the frame
    // fires -- the callback's own `this.ownerWindow !== frameOwner` guard must bail instead of
    // emitting against a stale/foreign realm.
    let viewportChangeFired = false;
    el.addEventListener(
      'lr-viewport-change',
      () => (viewportChangeFired = true)
    );
    internal.scheduleViewportChange();
    let restore = stubNoOwnerWindow(el);
    try {
      await twoFrames();
      expect(viewportChangeFired).to.equal(false);
    } finally {
      restore();
    }

    // scheduleCanvasDraw() (via markCanvasDirty()): same shape, for the canvas draw rAF.
    internal.markCanvasDirty();
    restore = stubNoOwnerWindow(el);
    try {
      await twoFrames(); // must not throw resolving the frame against the now-unavailable owner
    } finally {
      restore();
    }

    // tweenCamera() (via focusNode()): a real, multi-frame tween started against the real window,
    // then the realm changes mid-flight -- the step() callback's own guard must abort and resolve
    // false instead of continuing to animate against a stale frameOwner.
    const call = el.focusNode('a', { zoom: 2 });
    await nextFrame(); // let at least one real frame elapse so the tween is genuinely mid-flight
    restore = stubNoOwnerWindow(el);
    try {
      expect(await call).to.equal(false);
    } finally {
      restore();
    }
  });

  it('onCanvasPointerMove ignores a hover when ownerWindow is unavailable at dispatch time', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        seed="7"
        width="200"
        height="200"
      ></lr-graph>`
    )) as LyraGraph;
    await graphSupport.readyGraphPair(el, 'canvas');
    await waitForCanvasBackingStore(el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement);
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const target = el.simNodes[0]!;
    const rect = canvas.getBoundingClientRect();
    const restore = stubNoOwnerWindow(el);
    try {
      canvas.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientX: rect.left + target.x!,
          clientY: rect.top + target.y!,
          pointerId: 12,
        })
      );
      expect((el as unknown as { hoverRafId?: number }).hoverRafId).to.be
        .undefined;
    } finally {
      restore();
    }
  });
});

describe('coverage: canvas surface setup edge cases', () => {
  it('watchHostResize disconnects an existing observer and falls back gracefully when ResizeObserver is unavailable', async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" width="200" height="200"></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    type Internals = {
      watchHostResize: () => void;
      hostResizeObserver?: { disconnect: () => void };
    };
    const internal = el as unknown as Internals;
    expect(internal.hostResizeObserver).to.exist; // precondition: a real observer is already armed
    const original = window.ResizeObserver;
    (window as unknown as { ResizeObserver?: unknown }).ResizeObserver =
      undefined;
    try {
      expect(() => internal.watchHostResize()).to.not.throw();
      expect(internal.hostResizeObserver).to.be.undefined;
    } finally {
      window.ResizeObserver = original;
    }
  });

  it('watchCanvasDpr falls back gracefully when matchMedia is unavailable', async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" width="200" height="200"></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    type Internals = { watchCanvasDpr: () => void; canvasDprQuery?: unknown };
    const internal = el as unknown as Internals;
    expect(internal.canvasDprQuery).to.exist;
    const original = window.matchMedia;
    (window as unknown as { matchMedia?: unknown }).matchMedia = undefined;
    try {
      expect(() => internal.watchCanvasDpr()).to.not.throw();
      expect(internal.canvasDprQuery).to.be.undefined;
    } finally {
      window.matchMedia = original;
    }
  });

  it('setUpCanvasSurface tolerates a missing 2D context and a missing tooltip element; ensureCanvasOwnerRealm skips an unchanged realm', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        with-edge-labels
        width="200"
        height="200"
      ></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = [{ source: 'a', target: 'b', label: 'edge' }];
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    await waitUntil(
      () => (el as unknown as { edgeLabelMeasureCanvas?: HTMLCanvasElement }).edgeLabelMeasureCanvas != null,
      'a real tick called edgeLabelWidth() and created edgeLabelMeasureCanvas',
      { timeout: NODE_COUNT_TIMEOUT }
    );

    type Internals = {
      ensureCanvasOwnerRealm: () => void;
      edgeLabelMeasureCanvas?: HTMLCanvasElement;
      setUpCanvasSurface: () => void;
      canvasCtx?: CanvasRenderingContext2D;
      canvasTooltipEl?: HTMLDivElement;
    };
    const internal = el as unknown as Internals;
    const measureCanvasBefore = internal.edgeLabelMeasureCanvas;
    expect(measureCanvasBefore != null).to.equal(true);
    internal.ensureCanvasOwnerRealm(); // same document, same realm -- must NOT reset the cache
    expect(internal.edgeLabelMeasureCanvas === measureCanvasBefore).to.equal(
      true
    );

    el.shadowRoot!.querySelector('[part="tooltip"]')?.remove();
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    (
      HTMLCanvasElement.prototype as unknown as {
        getContext: (...args: unknown[]) => unknown;
      }
    ).getContext = function () {
      return null;
    };
    try {
      expect(() => internal.setUpCanvasSurface()).to.not.throw();
      expect(internal.canvasCtx).to.be.undefined;
      expect(internal.canvasTooltipEl).to.be.undefined;
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    }
  });

  it('drawCanvas falls back to safeWidth/safeHeight when the canvas has no rendered client box', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        width="333"
        height="222"
        style="width:0;height:0;overflow:hidden"
      ></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.clientWidth).to.equal(0); // precondition: the host itself is zero-sized
    expect(canvas.clientHeight).to.equal(0);
    (el as unknown as { drawCanvas: () => void }).drawCanvas();
    expect(canvas.width).to.equal(333); // dpr(1) * safeWidth fallback, not clientWidth(0)
    expect(canvas.height).to.equal(222);
  });

  it('edgeLabelWidth falls back to a sans-serif font family when --lr-font resolves empty (disconnected element, no cascade)', async () => {
    const el = asTestGraph(document.createElement('lr-graph'));
    const width = (
      el as unknown as { edgeLabelWidth: (t: string) => number }
    ).edgeLabelWidth('probe');
    expect(Number.isFinite(width)).to.be.true;
    const ctx = (
      el as unknown as { edgeLabelMeasureCtx?: CanvasRenderingContext2D }
    ).edgeLabelMeasureCtx;
    expect(ctx?.font).to.contain('sans-serif');
  });
});

describe('coverage: announcement-sink re-sync and camera/color-resolution edge cases', () => {
  it('announcement controller keeps active sinks in the current owner document (idempotent re-sync)', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    type Internals = {
      announcements: {
        announcePolite(message: string): void;
        announceAssertive(message: string): void;
        current(politeness: 'polite' | 'assertive'): unknown;
        adopted(): void;
      };
    };
    const { announcements } = el as unknown as Internals;
    announcements.announcePolite('Graph status probe');
    announcements.announceAssertive('Graph error probe');
    expect(announcementTexts(document, 'polite')).to.include('Graph status probe');
    expect(announcementTexts(document, 'assertive')).to.include('Graph error probe');
    const politeBefore = announcements.current('polite');
    const assertiveBefore = announcements.current('assertive');
    expect(politeBefore != null).to.equal(true);
    expect(assertiveBefore != null).to.equal(true);
    announcements.adopted(); // same document, with no intervening release
    expect(announcements.current('polite') === politeBefore).to.equal(true);
    expect(announcements.current('assertive') === assertiveBefore).to.equal(
      true
    );
  });

  it('fit() no-ops without throwing when every node is hidden (simNodes empty), and defaults its padding option', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodeTypes = [{ id: 'x', label: 'X' }];
    el.hiddenTypes = ['x'];
    el.nodes = [{ id: 'a', label: 'A', type: 'x' }];
    el.edges = [];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 0,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    expect(el.simNodes.length).to.equal(0);
    expect(() => el.fit()).to.not.throw(); // no options at all -- exercises the `options?.padding ?? 24` fallback too
  });

  it("fit()'s bounding-box reduction tolerates a node with still-undefined x/y (regression)", async () => {
    const el = (await fixture(
      html`<lr-graph seed="1" width="200" height="200"></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    const a = el.simNodes.find((n) => n.id === 'a')!;
    a.x = undefined;
    a.y = undefined;
    expect(() => el.fit()).to.not.throw();
  });

  it('resolves both plain colors and unset custom properties to concrete canvas colors', async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" width="200" height="200"></lr-graph>`
    )) as LyraGraph;
    el.nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ];
    el.edges = [
      { source: 'a', target: 'b', color: '#ff0000' },
      { source: 'a', target: 'c', color: 'var(--totally-unset-token-xyz)' },
    ];
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    (el as unknown as { simulation?: { stop: () => void } }).simulation?.stop();
    type Internals = { canvasScene?: { links: { color: string }[] } };
    await waitUntil(
      () => !!(el as unknown as Internals).canvasScene,
      undefined,
      { timeout: NODE_COUNT_TIMEOUT }
    );
    const scene = (el as unknown as Internals).canvasScene!;
    expect(scene.links[0]!.color).to.equal('rgb(255, 0, 0)');
    expect(scene.links[1]!.color).to.equal(getComputedStyle(el).color);
    expect(scene.links[1]!.color).to.not.include('var(');
  });
});

describe('coverage: canvas pointer and hover edge cases', () => {
  it('redrawPickCanvas/hitTest/nodeAtCanvasPoint/updateCanvasTooltip no-op when there is no canvas surface at all (svg renderer)', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    type Internals = {
      redrawPickCanvas: () => void;
      hitTest: (x: number, y: number) => unknown;
      nodeAtCanvasPoint: (x: number, y: number) => unknown;
      updateCanvasTooltip: (hit: unknown, x: number, y: number) => void;
      canvasTooltipEl?: unknown;
    };
    const internal = el as unknown as Internals;
    expect(() => internal.redrawPickCanvas()).to.not.throw();
    expect(internal.hitTest(10, 10)).to.be.undefined;
    expect(internal.nodeAtCanvasPoint(10, 10)).to.be.undefined;
    expect(internal.canvasTooltipEl).to.be.undefined;
    expect(() =>
      internal.updateCanvasTooltip({ kind: 'node', node: {} }, 10, 10)
    ).to.not.throw();
  });

  it('bindCanvasZoom no-ops when called before d3 has loaded (defensive guard, direct call)', async () => {
    const el = asTestGraph(document.createElement('lr-graph'));
    el.renderer = 'canvas';
    expect(() =>
      (el as unknown as { bindCanvasZoom: () => void }).bindCanvasZoom()
    ).to.not.throw();
  });

  it('hitTest returns undefined for coordinates far outside the canvas backing store (out-of-bounds guard)', async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" width="200" height="200"></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const hitTest = (
      el as unknown as { hitTest: (x: number, y: number) => unknown }
    ).hitTest.bind(el);
    expect(hitTest(-99999, -99999)).to.be.undefined;
  });

  it('onCanvasPointerDown ignores a non-primary button, and arms no node drag in layered layout', async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" width="200" height="200"></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    type Internals = {
      canvasPointerDownAt?: unknown;
      canvasDragNode?: unknown;
    };
    const internal = el as unknown as Internals;

    canvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        button: 2,
        clientX: rect.left + 5,
        clientY: rect.top + 5,
        pointerId: 90,
      })
    );
    expect(internal.canvasPointerDownAt).to.be.undefined; // secondary button -- entirely ignored

    el.layout = 'layered';
    await el.updateComplete;
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: rect.left + 5,
        clientY: rect.top + 5,
        pointerId: 91,
      })
    );
    expect(internal.canvasPointerDownAt).to.exist; // click-vs-drag tracking still recorded...
    expect(internal.canvasDragNode).to.be.undefined; // ...but no node drag armed in layered layout
  });

  it('takeCanvasPointerDown returns undefined for a pointerup whose id does not match the tracked pointerdown', async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" width="200" height="200"></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    let clicked = false;
    el.addEventListener('lr-node-activate', () => (clicked = true));
    el.addEventListener('lr-community-activate', () => (clicked = true));
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        clientX: rect.left + 5,
        clientY: rect.top + 5,
        pointerId: 1,
      })
    );
    canvas.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        clientX: rect.left + 5,
        clientY: rect.top + 5,
        pointerId: 2,
      })
    );
    expect(clicked).to.equal(false); // mismatched pointerId -- takeCanvasPointerDown() returns undefined, click dropped
  });

  it('finishCanvasNodeDrag swallows a releasePointerCapture that throws (capture already revoked by the browser)', async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" width="200" height="200"></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    (el as unknown as { simulation?: { stop: () => void } }).simulation?.stop();
    const target = el.simNodes.find((n) => n.id === 'a')!;
    target.x = 100;
    target.y = 100;
    (el as unknown as { pickDirty: boolean }).pickDirty = true;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    canvas.setPointerCapture = () => {};
    canvas.releasePointerCapture = () => {
      throw new DOMException('already released', 'InvalidStateError');
    };
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        clientX: rect.left + 100,
        clientY: rect.top + 100,
        pointerId: 55,
      })
    );
    expect(() =>
      canvas.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          clientX: rect.left + 100,
          clientY: rect.top + 100,
          pointerId: 55,
        })
      )
    ).to.not.throw();
  });

  it('a hover over a link shows its bounded tooltip text in the canvas tooltip', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        seed="7"
        width="400"
        height="300"
        style="width:400px;height:300px"
      ></lr-graph>`
    )) as LyraGraph;
    el.nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    el.edges = [{ source: 'a', target: 'b' }];
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    await waitForCanvasBackingStore(el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement);
    (el as unknown as { simulation?: { stop: () => void } }).simulation?.stop();
    const a = el.simNodes.find((n) => n.id === 'a')!;
    const b = el.simNodes.find((n) => n.id === 'b')!;
    a.x = 50;
    a.y = 150;
    b.x = 350;
    b.y = 150;
    (el as unknown as { pickDirty: boolean }).pickDirty = true;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: rect.left + 200,
        clientY: rect.top + 150,
        pointerId: 61,
      })
    );
    const tooltip = el.shadowRoot!.querySelector(
      '[part="tooltip"]'
    ) as HTMLElement;
    await waitUntil(
      () => !tooltip.hasAttribute('hidden'),
      'coalesced hover should resolve on the next frame'
    );
    const expectedLabel = (
      el as unknown as { linkTooltipText: (l: unknown) => string }
    ).linkTooltipText(el.simLinks[0]);
    expect(tooltip.textContent).to.equal(expectedLabel);
  });

  it('updateCanvasTooltip clamps against the left/top canvas edges when the tooltip would overflow them (direct call)', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        width="400"
        height="300"
        style="width:400px;height:300px"
      ></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const a = el.simNodes.find((n) => n.id === 'a')!;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const updateCanvasTooltip = (
      el as unknown as {
        updateCanvasTooltip: (hit: unknown, x: number, y: number) => void;
      }
    ).updateCanvasTooltip.bind(el);
    // Coordinates above/left of the canvas's own top-left corner -- the tooltip is anchored there
    // and would overflow past the canvas's left/top edge without the clamp.
    updateCanvasTooltip(
      { kind: 'node', node: a },
      rect.left - 50,
      rect.top - 50
    );
    const tooltip = el.shadowRoot!.querySelector(
      '[part="tooltip"]'
    ) as HTMLElement;
    // The naive, unclamped position would be exactly -50 -- proving the clamp branches actually ran
    // (rather than asserting an exact pixel value, which depends on the tooltip's own rendered box)
    // is enough: both clamps pull the position back up from that naive value.
    expect(parseFloat(tooltip.style.left)).to.be.greaterThan(-50);
    expect(parseFloat(tooltip.style.top)).to.be.greaterThan(-50);
  });

  it('a second pointermove within the same coalesced frame is a no-op (already-scheduled short-circuit)', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        seed="7"
        width="200"
        height="200"
      ></lr-graph>`
    )) as LyraGraph;
    await graphSupport.readyGraphPair(el, 'canvas');
    await waitForCanvasBackingStore(el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement);
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const target = el.simNodes[0]!;
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: rect.left + target.x!,
        clientY: rect.top + target.y!,
        pointerId: 71,
      })
    );
    const firstRafId = (el as unknown as { hoverRafId?: number }).hoverRafId;
    expect(firstRafId).to.exist;
    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: rect.left + target.x! + 1,
        clientY: rect.top + target.y!,
        pointerId: 71,
      })
    );
    // Still the SAME rAF id -- the second pointermove's own scheduling attempt short-circuited.
    expect((el as unknown as { hoverRafId?: number }).hoverRafId).to.equal(
      firstRafId
    );
    const tooltip = el.shadowRoot!.querySelector(
      '[part="tooltip"]'
    ) as HTMLElement;
    await waitUntil(() => !tooltip.hasAttribute('hidden'));
  });

  it('the coalesced hover callback no-ops if pendingHover was cleared before its frame fires (regression)', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        seed="7"
        width="200"
        height="200"
      ></lr-graph>`
    )) as LyraGraph;
    await graphSupport.readyGraphPair(el, 'canvas');
    await waitForCanvasBackingStore(el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement);
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const target = el.simNodes[0]!;
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: rect.left + target.x!,
        clientY: rect.top + target.y!,
        pointerId: 72,
      })
    );
    (el as unknown as { pendingHover?: unknown }).pendingHover = undefined; // cleared without canceling the raf
    await twoFrames();
    const tooltip = el.shadowRoot!.querySelector(
      '[part="tooltip"]'
    ) as HTMLElement;
    expect(tooltip.hasAttribute('hidden')).to.be.true; // never resolved -- the frame found nothing pending
  });

  it('the coalesced hover callback defers resolution while the simulation is still actively ticking (unsettled, non-seeded)', async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" width="200" height="200"></lr-graph>`
    )) as LyraGraph; // no seed -- a real, multi-hundred-tick settle animation
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: rect.left + 50,
        clientY: rect.top + 50,
        pointerId: 77,
      })
    );
    await nextFrame(); // one coalesced frame
    const tooltip = el.shadowRoot!.querySelector(
      '[part="tooltip"]'
    ) as HTMLElement;
    expect(tooltip.hasAttribute('hidden')).to.be.true; // hover deferred, never resolved this frame
  });
});
describe('coverage: render()/buildCanvasScene position fallbacks and shape-branch parity', () => {
  it("render() defaults a node's / dangling stub's still-undefined x/y to 0 across every svg template branch (regression, forced re-render)", async () => {
    const el = (await fixture(
      html`<lr-graph seed="1"></lr-graph>`
    )) as LyraGraph;
    el.nodeTypes = [{ id: 'sq', label: 'Square', shape: 'square' }];
    el.nodes = [
      { id: 'a', label: 'A', expandable: true },
      { id: 'b', label: 'B', type: 'sq' },
    ];
    el.edges = [{ source: 'a', target: 'ghost' }]; // dangling -- ghost has no matching node, stub hangs off 'a'
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );

    const a = el.simNodes.find((n) => n.id === 'a')!;
    const b = el.simNodes.find((n) => n.id === 'b')!;
    a.x = undefined;
    a.y = undefined;
    b.x = undefined;
    b.y = undefined;
    el.requestUpdate();
    await el.updateComplete;

    const circleA = el.shadowRoot!.querySelector(
      '[part="node"]'
    ) as SVGCircleElement;
    expect(circleA.getAttribute('cx')).to.equal('0');
    expect(circleA.getAttribute('cy')).to.equal('0');

    const hitA = el.shadowRoot!.querySelector(
      '[data-hit-area="node"]'
    ) as SVGLineElement;
    expect(hitA.getAttribute('x1')).to.equal('-0.5'); // (n.x??0) - NODE_HIT_SEGMENT_HALF(0.5)
    expect(hitA.getAttribute('x2')).to.equal('0.5');
    expect(hitA.getAttribute('y1')).to.equal('0');

    const nodeEls = el.shadowRoot!.querySelectorAll('[part="node"]');
    const pathB = nodeEls[1] as SVGPathElement; // shape="square" renders <path>, positioned via transform
    expect(pathB.getAttribute('transform')).to.equal('translate(0,0)');

    const labelA = el.shadowRoot!.querySelector(
      '[part="label"]'
    ) as SVGTextElement;
    expect(labelA.getAttribute('y')).to.equal('0');

    const expandIndicator = el.shadowRoot!.querySelector(
      '[part="expand-indicator"]'
    ) as SVGGElement;
    expect(expandIndicator.getAttribute('transform')).to.equal(
      'translate(0,0)'
    );

    const danglingLine = el.shadowRoot!.querySelector(
      '[part="link"][data-dangling]'
    ) as SVGLineElement;
    expect(danglingLine.getAttribute('x1')).to.equal('0');
    expect(danglingLine.getAttribute('y1')).to.equal('0');
  });

  it('a path-shaped (square) node supports click/dblclick and reflects aria-pressed identically to a circle node', async () => {
    const el = (await fixture(
      html`<lr-graph selection-mode="single"></lr-graph>`
    )) as LyraGraph;
    el.nodeTypes = [{ id: 'sq', label: 'Square', shape: 'square' }];
    el.nodes = [{ id: 'a', label: 'A', type: 'sq' }];
    el.edges = [];
    el.selectedNodeIds = ['a'];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 1,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    const pathEl = el.shadowRoot!.querySelector(
      '[part="node"]'
    ) as SVGPathElement;
    expect(pathEl.tagName).to.equal('path');
    expect(pathEl.getAttribute('aria-pressed')).to.equal('true');

    let clickDetail: { nodeId: string } | undefined;
    let expandDetail: { nodeId: string } | undefined;
    el.addEventListener(
      'lr-node-activate',
      (e) => (clickDetail = (e as CustomEvent).detail)
    );
    el.addEventListener(
      'lr-node-expand',
      (e) => (expandDetail = (e as CustomEvent).detail)
    );
    pathEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(clickDetail?.nodeId).to.equal('a');
    pathEl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(expandDetail?.nodeId).to.equal('a');

    pathEl.dispatchEvent(new MouseEvent('mouseenter'));
    expect(pathEl.hasAttribute('data-hovered')).to.be.true;
    pathEl.dispatchEvent(new MouseEvent('mouseleave'));
    expect(pathEl.hasAttribute('data-hovered')).to.be.false;
  });

  it('a path-shaped (square) node also activates via keyboard (Enter), same as a circle node', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodeTypes = [{ id: 'sq', label: 'Square', shape: 'square' }];
    el.nodes = [{ id: 'a', label: 'A', type: 'sq' }];
    el.edges = [];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 1,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    const pathEl = el.shadowRoot!.querySelector(
      '[part="node"]'
    ) as SVGPathElement;
    expect(pathEl.tagName).to.equal('path');

    let detail: { nodeId: string } | undefined;
    el.addEventListener(
      'lr-node-activate',
      (e) => (detail = (e as CustomEvent).detail)
    );
    pathEl.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    expect(detail?.nodeId).to.equal('a');
  });

  it('an SVG-rendered community hull applies its own sanitized color as a style override (fill true branch)', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.communities = [{ id: 'team', memberIds: [], color: '#3355ff' }];
    el.nodes = [
      { id: 'a', label: 'A', communityId: 'team' },
      { id: 'b', label: 'B', communityId: 'team' },
    ];
    el.edges = [];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    const hullEl = el.shadowRoot!.querySelector(
      '[part="hull"]'
    ) as SVGPathElement;
    expect(hullEl.getAttribute('style')).to.include(
      '--lr-graph-hull-fill:#3355ff'
    );
  });

  it('buildCanvasScene falls back dimmedOpacity/hullOpacity to their defaults when the token is set to a non-numeric value', async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" width="200" height="200"></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    el.style.setProperty('--lr-graph-dimmed-opacity', 'not-a-number');
    el.style.setProperty('--lr-graph-hull-opacity', 'not-a-number');
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const scene = (
      el as unknown as {
        buildCanvasScene: (cs: CSSStyleDeclaration) => {
          dimmedOpacity: number;
          hullOpacity: number;
        };
      }
    ).buildCanvasScene(getComputedStyle(el));
    expect(scene.dimmedOpacity).to.equal(0.35);
    expect(scene.hullOpacity).to.equal(0.12);
  });

  it('buildCanvasScene defaults undefined node/focusHalo/keyboardFocusRing positions to 0 (regression, canvas mode)', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        seed="1"
        focus-node-id="a"
        width="200"
        height="200"
      ></lr-graph>`
    )) as LyraGraph;
    el.nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    el.edges = [{ source: 'a', target: 'b' }];
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    type Internals = {
      simulation?: { stop: () => void };
      activeGraphItem: number;
    };
    (el as unknown as Internals).simulation?.stop();
    (el as unknown as Internals).activeGraphItem = 0; // node 'a' is also the keyboard-focus-ring item
    el.shadowRoot!.querySelector<HTMLButtonElement>(
      '[part="cursor-item"]'
    )!.focus();
    const a = el.simNodes.find((n) => n.id === 'a')!;
    a.x = undefined;
    a.y = undefined;

    const scene = (
      el as unknown as {
        buildCanvasScene: (cs: CSSStyleDeclaration) => {
          nodes: { x: number; y: number }[];
          focusHalo?: { x: number; y: number };
          keyboardFocusRing?: { x: number; y: number };
        };
      }
    ).buildCanvasScene(getComputedStyle(el));
    expect(scene.nodes[0]!.x).to.equal(0);
    expect(scene.nodes[0]!.y).to.equal(0);
    expect(scene.focusHalo!.x).to.equal(0);
    expect(scene.focusHalo!.y).to.equal(0);
    expect(scene.keyboardFocusRing!.x).to.equal(0);
    expect(scene.keyboardFocusRing!.y).to.equal(0);
  });
});

describe('coverage: selection and keyboard edge cases', () => {
  it('clicking a link in single selection mode emits a link-only selection intent (kind==="link" branch)', async () => {
    const el = (await fixture(
      html`<lr-graph selection-mode="single"></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links; // a -> b, no explicit id
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    const linkEl = el.shadowRoot!.querySelector('[part="link"]') as SVGElement;
    let detail: { selectedNodeIds: string[]; selectedEdgeIds: string[] } | undefined;
    el.addEventListener(
      'lr-selection-change',
      (e) => (detail = (e as CustomEvent).detail)
    );
    linkEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(detail).to.deep.equal({ selectedNodeIds: [], selectedEdgeIds: ['a->b'] });
  });

  it('background click is a no-op when selectionMode is none, and again in single mode once nothing is selected (clearSelection early returns)', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph; // selectionMode defaults to 'none'
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    let fired = false;
    el.addEventListener('lr-selection-change', () => (fired = true));
    const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
    svgEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(fired).to.equal(false); // selectionMode 'none' -- clearSelection's own early return

    el.selectionMode = 'single';
    await el.updateComplete;
    svgEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(fired).to.equal(false); // nothing was ever selected -- clearSelection's "already empty" early return
  });

  it('Escape on the canvas cursor-items container clears the selection (canvas mode)', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        selection-mode="single"
        width="200"
        height="200"
      ></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    el.selectedNodeIds = ['a'];
    await el.updateComplete;
    let detail: { selectedNodeIds: string[]; selectedEdgeIds: string[] } | undefined;
    el.addEventListener(
      'lr-selection-change',
      (e) => (detail = (e as CustomEvent).detail)
    );
    const cursorItems = el.shadowRoot!.querySelector(
      '[part="cursor-items"]'
    ) as HTMLElement;
    cursorItems.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    expect(detail).to.deep.equal({ selectedNodeIds: [], selectedEdgeIds: [] });
  });

  it('clearing every node while one is DOM-focused resolves the pending base-focus fallback without throwing (all items removed)', async () => {
    const el = await graphSupport.mountGraphPair();
    const nodeEl = el.shadowRoot!.querySelector(
      '[part="node"]'
    ) as unknown as HTMLElement;
    nodeEl.focus();
    expect(
      el.shadowRoot!.activeElement === (nodeEl as unknown as Element)
    ).to.equal(true);

    el.nodes = [];
    el.edges = [];
    await el.updateComplete; // must not throw resolving the 'base' pendingGraphItemFocus branch
    expect(el.shadowRoot!.querySelector('[part="empty"]')).to.exist;
  });
});

describe('coverage: remaining branch gaps', () => {
  it('tweenCamera jumps in a single frame (t=1) when --lr-transition-base resolves to a non-positive duration', async () => {
    const el = (await fixture(
      html`<lr-graph width="200" height="200"></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    el.style.setProperty('--lr-transition-base', '0');
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    expect(await el.focusNode('a', { zoom: 2 })).to.equal(true);
  });

  it('redrawPickCanvas tolerates a node with still-undefined x/y in its pick-scene mapping (regression)', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        seed="1"
        width="200"
        height="200"
      ></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    (el as unknown as { simulation?: { stop: () => void } }).simulation?.stop();
    const a = el.simNodes.find((n) => n.id === 'a')!;
    a.x = undefined;
    a.y = undefined;
    expect(() =>
      (el as unknown as { redrawPickCanvas: () => void }).redrawPickCanvas()
    ).to.not.throw();
  });

  it('onCanvasPointerMove ignores a hover whose frame finds the connection/realm has changed mid-flight (no disconnect)', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        seed="7"
        width="200"
        height="200"
      ></lr-graph>`
    )) as LyraGraph;
    await graphSupport.readyGraphPair(el, 'canvas');
    await waitForCanvasBackingStore(el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement);
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const target = el.simNodes[0]!;
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: rect.left + target.x!,
        clientY: rect.top + target.y!,
        pointerId: 81,
      })
    );
    expect((el as unknown as { hoverRafId?: number }).hoverRafId).to.exist; // a real frame is now pending
    const restore = stubNoOwnerWindow(el);
    try {
      await twoFrames();
      const tooltip = el.shadowRoot!.querySelector(
        '[part="tooltip"]'
      ) as HTMLElement;
      expect(tooltip.hasAttribute('hidden')).to.be.true; // the frame bailed instead of resolving the hover
    } finally {
      restore();
    }
  });

  it('onCanvasDblClick falls back to the geometric nearest-node search when the pick canvas misses, and no-ops off every node', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        seed="7"
        width="400"
        height="300"
        style="width:400px;height:300px"
      ></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    await waitForCanvasBackingStore(el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement);
    (el as unknown as { simulation?: { stop: () => void } }).simulation?.stop();
    const target = el.simNodes.find((n) => n.id === 'a')!;
    target.x = 100;
    target.y = 100;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    // Deliberately stale/dirty pick canvas so hitTest() at the dblclick's own coordinates misses,
    // forcing onCanvasDblClick() onto its geometric nodeAtCanvasPoint() fallback -- exactly the
    // real-world race its own doc comment describes (browser delivers dblclick before the offscreen
    // pick canvas has painted the latest frame).
    const originalHitTest = (
      el as unknown as { hitTest: (x: number, y: number) => unknown }
    ).hitTest;
    (el as unknown as { hitTest: (x: number, y: number) => unknown }).hitTest =
      () => undefined;
    try {
      let expandDetail: { nodeId: string } | undefined;
      el.addEventListener(
        'lr-node-expand',
        (e) => (expandDetail = (e as CustomEvent).detail)
      );
      canvas.dispatchEvent(
        new MouseEvent('dblclick', {
          bubbles: true,
          clientX: rect.left + 100,
          clientY: rect.top + 100,
        })
      );
      expect(expandDetail?.nodeId).to.equal('a'); // found geometrically despite the pick-canvas miss

      expandDetail = undefined;
      canvas.dispatchEvent(
        new MouseEvent('dblclick', {
          bubbles: true,
          clientX: rect.left + 399,
          clientY: rect.top + 299,
        })
      );
      expect(expandDetail).to.be.undefined; // far from every node -- no-op
    } finally {
      (
        el as unknown as { hitTest: (x: number, y: number) => unknown }
      ).hitTest = originalHitTest;
    }
  });

  it("nodeAtCanvasPoint's distance search tolerates a node with still-undefined x/y (regression)", async () => {
    const el = (await fixture(
      html`<lr-graph renderer="canvas" width="200" height="200"></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const a = el.simNodes.find((n) => n.id === 'a')!;
    a.x = undefined;
    a.y = undefined;
    const nodeAtCanvasPoint = (
      el as unknown as { nodeAtCanvasPoint: (x: number, y: number) => unknown }
    ).nodeAtCanvasPoint.bind(el);
    expect(() => nodeAtCanvasPoint(0, 0)).to.not.throw();
  });

  it('updateCanvasTooltip clamps against the right/bottom canvas edges when the tooltip would overflow them (direct call)', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        width="400"
        height="300"
        style="width:400px;height:300px"
      ></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const a = el.simNodes.find((n) => n.id === 'a')!;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const updateCanvasTooltip = (
      el as unknown as {
        updateCanvasTooltip: (hit: unknown, x: number, y: number) => void;
      }
    ).updateCanvasTooltip.bind(el);
    // Coordinates beyond the canvas's own bottom-right corner -- the tooltip is anchored there and
    // would overflow past the canvas's right/bottom edge without the clamp.
    updateCanvasTooltip(
      { kind: 'node', node: a },
      rect.right + 50,
      rect.bottom + 50
    );
    const tooltip = el.shadowRoot!.querySelector(
      '[part="tooltip"]'
    ) as HTMLElement;
    // The naive, unclamped position would be exactly rect.width+50 / rect.height+50 -- proving the
    // clamp branches ran is enough, without depending on the tooltip's own exact rendered box.
    expect(parseFloat(tooltip.style.left)).to.be.lessThan(rect.width + 50);
    expect(parseFloat(tooltip.style.top)).to.be.lessThan(rect.height + 50);
  });

  it("resolves a real DOM focus's pending 'base' fallback onto the still-rendered svg root when every item becomes hidden", async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodeTypes = [{ id: 'x', label: 'X' }];
    el.nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B', type: 'x' },
    ];
    el.edges = [];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    const nodeEl = el.shadowRoot!.querySelector(
      '[part="node"]'
    ) as unknown as HTMLElement;
    nodeEl.focus();
    expect(
      el.shadowRoot!.activeElement === (nodeEl as unknown as Element)
    ).to.equal(true);

    // Hides every node (nodes.length stays > 0, so the svg root itself keeps rendering) -- the
    // previously node-focused item vanishes entirely, landing pendingGraphItemFocus on 'base' while
    // an actual [part="svg"] element still exists to receive the fallback focus() call.
    el.hiddenTypes = ['x'];
    el.nodeTypes = [{ id: 'x', label: 'X' }];
    (el as unknown as { nodes: unknown }).nodes = [
      { id: 'a', label: 'A', type: 'x' },
      { id: 'b', label: 'B', type: 'x' },
    ];
    await el.updateComplete;
    expect(el.simNodes.length).to.equal(0);
    const svgEl = el.shadowRoot!.querySelector('svg');
    expect(el.shadowRoot!.activeElement === svgEl).to.equal(true);
  });

  it('removing the focused LINK/COMMUNITY entirely falls back activeGraphItem to a plain re-clamp (graphItemIndex -1 branch)', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.communities = [{ id: 'team', memberIds: ['a', 'b'] }];
    el.nodes = [
      { id: 'a', label: 'A', communityId: 'team' },
      { id: 'b', label: 'B', communityId: 'team' },
    ];
    el.edges = [{ source: 'a', target: 'b', id: 'ab' }];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    type Internals = {
      onGraphItemFocus: (i: number) => void;
      activeGraphItem: number;
    };
    const internal = el as unknown as Internals;

    internal.onGraphItemFocus(2); // simNodes.length(2) + linkIndex(0) -- the link is the active item
    expect(internal.activeGraphItem).to.equal(2);
    el.edges = []; // the focused link is now entirely gone
    await el.updateComplete;
    expect(internal.activeGraphItem).to.be.at.least(0); // re-clamped instead of throwing/going negative

    internal.onGraphItemFocus(2); // simNodes.length(2) + simLinks.length(0) -- the hull is the active item
    expect(internal.activeGraphItem).to.equal(2);
    el.communities = []; // the focused community is now entirely gone
    await el.updateComplete;
    expect(internal.activeGraphItem).to.be.at.least(0);
  });
});

describe('coverage: focus-node-identity retention across structural change', () => {
  it("retains a focused LINK's identity by id (not raw index) across a structural nodes change that shifts its index", async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    el.edges = [{ source: 'a', target: 'b', id: 'ab' }];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    type Internals = {
      onGraphItemFocus: (i: number) => void;
      activeGraphItem: number;
    };
    const internal = el as unknown as Internals;
    internal.onGraphItemFocus(2); // simNodes.length(2) + linkIndex(0) -- the link is the active item
    expect(internal.activeGraphItem).to.equal(2);

    el.nodes = [
      { id: 'z', label: 'Z' },
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    el.edges = [{ source: 'a', target: 'b', id: 'ab' }];
    await el.updateComplete;
    // simNodes.length is now 3 -- the SAME link ('ab') must be retained at its NEW computed index
    // (3 + 0), not left pointing at the stale raw index 2 (which would now land on a node).
    expect(internal.activeGraphItem).to.equal(3);
  });

  it("retains a focused COMMUNITY hull's identity by id across a structural change that shifts its index", async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.communities = [{ id: 'team', memberIds: ['a', 'b'] }];
    el.nodes = [
      { id: 'a', label: 'A', communityId: 'team' },
      { id: 'b', label: 'B', communityId: 'team' },
    ];
    el.edges = [];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    type Internals = {
      onGraphItemFocus: (i: number) => void;
      activeGraphItem: number;
    };
    const internal = el as unknown as Internals;
    internal.onGraphItemFocus(2); // simNodes.length(2) + simLinks.length(0) -- the hull is the active item
    expect(internal.activeGraphItem).to.equal(2);

    el.nodes = [
      { id: 'z', label: 'Z' },
      { id: 'a', label: 'A', communityId: 'team' },
      { id: 'b', label: 'B', communityId: 'team' },
    ];
    await el.updateComplete;
    expect(internal.activeGraphItem).to.equal(3); // simNodes.length(3) + simLinks.length(0)
  });
});

describe('coverage: dangling link DOM-cache shrink', () => {
  it('onTick skips a dangling stub whose cached DOM line is shorter than danglingLinks (data shrinking below the cache, regression)', async () => {
    const el = (await fixture(
      html`<lr-graph seed="3"></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes; // a, b
    el.edges = [{ source: 'a', target: 'ghost' }]; // dangling -- ghost has no matching node
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    type Internals = { danglingLinkEls: unknown[]; onTick: () => void };
    const internal = el as unknown as Internals;
    expect(internal.danglingLinkEls.length).to.equal(1); // precondition
    internal.danglingLinkEls = []; // simulate a DOM-cache older than the current danglingLinks array
    expect(() => internal.onTick()).to.not.throw();
  });
});

describe('coverage: connectedCallback lazy-load resolution edge case', () => {
  it('bails out of the post-load resolution when updateComplete rejects mid-flight (catch branch)', async () => {
    const el = asTestGraph(document.createElement('lr-graph'));
    let descriptor: PropertyDescriptor | undefined;
    for (
      let proto = Object.getPrototypeOf(el) as object | null;
      proto;
      proto = Object.getPrototypeOf(proto)
    ) {
      descriptor = Object.getOwnPropertyDescriptor(proto, 'updateComplete');
      if (descriptor) break;
    }
    Object.defineProperty(el, 'updateComplete', {
      configurable: true,
      get: () =>
        Promise.reject(new Error('synthetic updateComplete rejection')),
    });
    document.body.appendChild(el);
    try {
      await aTimeout(300); // let the real d3 dynamic import resolve and hit the rejecting updateComplete
      expect((el as unknown as { loading: boolean }).loading).to.equal(true); // catch{return;} bailed first
    } finally {
      el.remove();
      if (descriptor) Object.defineProperty(el, 'updateComplete', descriptor);
      else Reflect.deleteProperty(el, 'updateComplete');
    }
  });
});
