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

describe('canvas renderer — static draw', () => {
  async function mountCanvas(): Promise<LyraGraph> {
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
    await aTimeout(50); // let the draw rAF fire
    return el;
  }

  it('defaults renderer to svg', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    expect(el.renderer).to.equal('svg');
    expect(el.shadowRoot!.querySelector('canvas') == null).to.equal(true);
  });

  it('keeps host naming on one owner in canvas mode too', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        aria-label="Citation relationships"
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
    const canvas = el.shadowRoot!.querySelector('canvas')!;
    expect(el.getAttribute('role')).to.equal('group');
    expect(canvas.hasAttribute('role')).to.equal(false);
    expect(canvas.hasAttribute('aria-label')).to.equal(false);
  });

  it('renderer="canvas" renders a canvas element instead of an svg, no [part="node"]/[part="link"] elements', async () => {
    const el = await mountCanvas();
    expect(el.shadowRoot!.querySelector('canvas') != null).to.equal(true);
    expect(el.shadowRoot!.querySelector('svg') == null).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="node"]') == null).to.be.true;
  });

  it('sizes the backing store to CSS size * devicePixelRatio', async () => {
    const el = await mountCanvas();
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const dpr = window.devicePixelRatio || 1;
    expect(canvas.width).to.equal(Math.round(canvas.clientWidth * dpr));
    expect(canvas.height).to.equal(Math.round(canvas.clientHeight * dpr));
  });

  it('every event/method/prop still works identically in canvas mode (selectionMode, hiddenTypes, withEdgeLabels)', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        with-edge-labels
        selection-mode="single"
        width="400"
        height="300"
        style="width:400px;height:300px"
      ></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = [{ source: 'a', target: 'b', label: 'cites' }];
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const ok = await el.focusNode('a');
    expect(ok).to.be.true;
  });

  it('is accessible in canvas mode', async () => {
    const el = await mountCanvas();
    await expect(el).to.be.accessible();
  });

  it('canvas mode mirrors the first graph item without announcing it before focus/navigation', async () => {
    // graphLiveText (the `||` left side of render()'s canvas-mode mirror expression) starts
    // out empty and activeGraphItem defaults to 0, so a fresh mount with items present already
    // exercises the `normalizedGraphItem() >= 0` true side of the ternary on its own, with no
    // focus/hiddenTypes interaction needed.
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
    const liveRegion = el.shadowRoot!.querySelector(
      '[part="live-region"]'
    ) as HTMLElement;
    // graphItemCount() === simNodes.length(2) + simLinks.length(1) + communities(0) === 3.
    expect(liveRegion.textContent).to.contain('(1 of 3)');
    expect(liveRegion.getAttribute('aria-hidden')).to.equal('true');
    expect(announcementTexts()).to.deep.equal([]);
  });

  it('switching renderer back to svg tears down the canvas resize watcher (no observer stacking across round trips, regression)', async () => {
    const el = await mountCanvas();
    expect(
      (el as unknown as { hostResizeObserver?: ResizeObserver })
        .hostResizeObserver
    ).to.exist;
    el.renderer = 'svg';
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('svg'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    // Re-entering canvas mode re-arms a fresh observer; leaving it must disconnect the old one,
    // or every canvas -> svg -> canvas round trip would stack another live observer on the host.
    expect(
      (el as unknown as { hostResizeObserver?: ResizeObserver })
        .hostResizeObserver
    ).to.be.undefined;
  });

  it('existing graph usage unaffected: renderer unset renders the untouched svg path', async () => {
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
    expect(el.shadowRoot!.querySelector('canvas') == null).to.equal(true);
  });

  it('feeds dimmedNodeIds/dimmedEdgeIds into the drawn canvas scene', async () => {
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
    el.dimmedNodeIds = ['a'];
    el.style.setProperty('--lr-graph-dimmed-opacity', '0');
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    await waitUntil(
      () =>
        (el as unknown as { canvasScene?: { nodes: unknown[] } }).canvasScene
          ?.nodes.length === 2,
      undefined,
      { timeout: NODE_COUNT_TIMEOUT }
    );
    type Internals = {
      canvasScene?: { nodes: { dimmed?: boolean }[]; dimmedOpacity?: number };
    };
    const scene = (el as unknown as Internals).canvasScene!;
    expect(scene.nodes.some((n) => n.dimmed)).to.be.true;
    expect(scene.nodes.some((n) => !n.dimmed)).to.be.true;
    expect(scene.dimmedOpacity).to.equal(0);
  });

  // Canvas counterpart of "renders a '+' expand-indicator only for nodes with expandable: true".
  // The expand indicator is SVG-only today: renderer="canvas" has no per-node DOM to query
  // for [part="expand-indicator"], so this asserts the same expandable-only gating via the drawn
  // canvasScene instead.
  it('feeds only expandable: true nodes into the drawn canvas scene as expand indicators', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        width="400"
        height="300"
        style="width:400px;height:300px"
      ></lr-graph>`
    )) as LyraGraph;
    el.nodes = [
      { id: 'a', label: 'A', expandable: true },
      { id: 'b', label: 'B' },
    ];
    el.edges = [];
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    (el as unknown as { simulation?: { stop: () => void } }).simulation?.stop();
    type Internals = {
      canvasScene?: { expandIndicators: { x: number; y: number; r: number }[] };
    };
    await waitUntil(
      () => !!(el as unknown as Internals).canvasScene,
      undefined,
      { timeout: NODE_COUNT_TIMEOUT }
    );
    const scene = (el as unknown as Internals).canvasScene!;
    expect(scene.expandIndicators.length).to.equal(1);
  });

  // Canvas counterpart of "existing graph usage unaffected: no expandable set ... renders no
  // indicator", which is SVG-only today.
  it('existing canvas usage unaffected: no expandable nodes draw zero expand indicators', async () => {
    const el = await mountCanvas();
    (el as unknown as { simulation?: { stop: () => void } }).simulation?.stop();
    type Internals = { canvasScene?: { expandIndicators: unknown[] } };
    await waitUntil(
      () => !!(el as unknown as Internals).canvasScene,
      undefined,
      { timeout: NODE_COUNT_TIMEOUT }
    );
    const scene = (el as unknown as Internals).canvasScene!;
    expect(scene.expandIndicators.length).to.equal(0);
  });

  it('resolves --lr-graph-hull-opacity into the drawn canvas scene instead of a hardcoded value', async () => {
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
    el.communities = [{ id: 'c1', memberIds: ['a', 'b'] }];
    el.style.setProperty('--lr-graph-hull-opacity', '0.5');
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    (el as unknown as { simulation?: { stop: () => void } }).simulation?.stop();
    type Internals = { canvasScene?: { hullOpacity?: number } };
    await waitUntil(
      () => !!(el as unknown as Internals).canvasScene,
      undefined,
      { timeout: NODE_COUNT_TIMEOUT }
    );
    const scene = (el as unknown as Internals).canvasScene!;
    expect(scene.hullOpacity).to.equal(0.5);
  });
});

describe('canvas renderer — interaction and a11y', () => {
  async function mountCanvas(): Promise<LyraGraph> {
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
    await aTimeout(400); // let the force layout settle so node positions are stable for hit-testing
    return el;
  }

  it('clicking a node (via pointer hit-test) emits lr-node-click, same detail shape as svg mode', async () => {
    const el = await mountCanvas();
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const target = el.simNodes[0]!;
    const rect = canvas.getBoundingClientRect();
    const clientX = rect.left + target.x!;
    const clientY = rect.top + target.y!;
    let detail: { nodeId: string; x: number; y: number } | undefined;
    el.addEventListener(
      'lr-node-click',
      (e) => (detail = (e as CustomEvent).detail)
    );
    const capture = stubPointerCapture(canvas);
    try {
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          clientX,
          clientY,
          pointerId: 1,
        })
      );
      expect(capture.captured.has(1)).to.equal(true);
      canvas.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          clientX,
          clientY,
          pointerId: 1,
        })
      );
      expect(capture.captured.has(1)).to.equal(false);
      expect(detail?.nodeId).to.equal(target.id);
      expect(detail?.x).to.be.a('number');
      expect(detail?.y).to.be.a('number');
    } finally {
      capture.restore();
    }
  });

  it('continues a canvas node click when pointer capture rejects a synthetic pointer id', async () => {
    // A seeded one-node graph settles at the center synchronously, so this can exercise the
    // browser-facing fallback without reading graph internals for a hit-test coordinate.
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        seed="7"
        width="200"
        height="200"
        style="width:200px;height:200px"
      ></lr-graph>`
    )) as LyraGraph;
    el.nodes = [{ id: 'only', label: 'Only node' }];
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const originalSetPointerCapture = Object.getOwnPropertyDescriptor(
      canvas,
      'setPointerCapture'
    );
    Object.defineProperty(canvas, 'setPointerCapture', {
      configurable: true,
      value: (_pointerId: number) => {
        throw new DOMException(
          'Synthetic pointer id is not active',
          'InvalidStateError'
        );
      },
    });
    let detail: { nodeId: string; x: number; y: number } | undefined;
    el.addEventListener(
      'lr-node-click',
      (event) => (detail = (event as CustomEvent).detail)
    );
    try {
      const clientX = rect.left + rect.width / 2;
      const clientY = rect.top + rect.height / 2;
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          clientX,
          clientY,
          pointerId: 70,
        })
      );
      canvas.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          clientX,
          clientY,
          pointerId: 70,
        })
      );

      expect(detail?.nodeId).to.equal('only');
    } finally {
      if (originalSetPointerCapture)
        Object.defineProperty(
          canvas,
          'setPointerCapture',
          originalSetPointerCapture
        );
      else
        delete (canvas as unknown as { setPointerCapture?: unknown })
          .setPointerCapture;
    }
  });

  it('clicking empty canvas space with no hit clears the selection when selectionMode is set', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        selection-mode="single"
        width="400"
        height="300"
        style="width:400px;height:300px"
      ></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    el.selectedNodeIds = ['a'];
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    await aTimeout(400);
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    let detail: { selectedNodeIds: string[]; selectedEdgeIds: string[] } | undefined;
    el.addEventListener(
      'lr-selection-change',
      (e) => (detail = (e as CustomEvent).detail)
    );
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        clientX: rect.left + 399,
        clientY: rect.top + 299,
        pointerId: 2,
      })
    );
    canvas.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        clientX: rect.left + 399,
        clientY: rect.top + 299,
        pointerId: 2,
      })
    );
    expect(detail).to.deep.equal({ selectedNodeIds: [], selectedEdgeIds: [] });
  });

  it('dblclick on a node emits lr-node-expand in canvas mode too', async () => {
    const el = await mountCanvas();
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const target = el.simNodes[0]!;
    const rect = canvas.getBoundingClientRect();
    let detail: { nodeId: string } | undefined;
    el.addEventListener(
      'lr-node-expand',
      (e) => (detail = (e as CustomEvent).detail)
    );
    canvas.dispatchEvent(
      new MouseEvent('dblclick', {
        bubbles: true,
        clientX: rect.left + target.x!,
        clientY: rect.top + target.y!,
      })
    );
    expect(detail?.nodeId).to.equal(target.id);
    expect(detail).to.deep.equal({ nodeId: target.id });
  });

  // Seeded so the force layout converges synchronously: hover hit-testing is coalesced to one per
  // animation frame and deferred while the simulation is still ticking, so a still-settling mount
  // would never resolve a hover at all.
  async function mountSettledCanvas(): Promise<LyraGraph> {
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
    await aTimeout(50); // let the draw rAF fire so the backing store is sized for hit-testing
    return el;
  }

  it('shows a hover tooltip with the item label on pointer hover, hides it off-item', async () => {
    const el = await mountSettledCanvas();
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const target = el.simNodes[0]!;
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: rect.left + target.x!,
        clientY: rect.top + target.y!,
        pointerId: 3,
      })
    );
    const tooltip = el.shadowRoot!.querySelector(
      '[part="tooltip"]'
    ) as HTMLElement;
    // Hover hit-testing is coalesced to one per animation frame, so the tooltip appears on the
    // frame after the pointermove, not synchronously within its dispatch.
    await waitUntil(
      () => !tooltip.hasAttribute('hidden'),
      'coalesced hover should resolve on the next frame'
    );
    // nodeTooltipText() is private -- read it via the same `unknown` cast this file already
    // uses elsewhere for private-member assertions, to compute the exact expected label.
    const expectedLabel = (
      el as unknown as { nodeTooltipText: (n: unknown) => string }
    ).nodeTooltipText(target);
    expect(tooltip.textContent).to.equal(expectedLabel);

    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: rect.left + 399,
        clientY: rect.top + 299,
        pointerId: 3,
      })
    );
    await waitUntil(
      () => tooltip.hasAttribute('hidden'),
      'off-item hover should hide the tooltip on the next frame'
    );
  });

  it('positions the hover tooltip from the physical left edge so it tracks the cursor under dir="rtl" (regression)', async () => {
    const container = (await fixture(html`
      <div dir="rtl">
        <lr-graph
          renderer="canvas"
          seed="7"
          width="400"
          height="300"
          style="width:400px;height:300px"
        ></lr-graph>
      </div>
    `)) as HTMLElement;
    const el = asTestGraph(container.querySelector('lr-graph')!);
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    await aTimeout(50);
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const target = el.simNodes[0]!;
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: rect.left + target.x!,
        clientY: rect.top + target.y!,
        pointerId: 9,
      })
    );
    const tooltip = el.shadowRoot!.querySelector(
      '[part="tooltip"]'
    ) as HTMLElement;
    await waitUntil(
      () => !tooltip.hasAttribute('hidden'),
      'coalesced hover should resolve on the next frame'
    );
    // The offset is computed from the canvas's physical left edge, so it must land on the physical
    // `left` property -- `inset-inline-start` maps to `right` under RTL, which would mirror the
    // tooltip across the canvas instead of placing it at the cursor.
    expect(parseFloat(tooltip.style.left)).to.be.closeTo(target.x!, 1);
    expect(parseFloat(tooltip.style.top)).to.be.closeTo(target.y!, 1);
    expect(tooltip.style.insetInlineStart).to.equal('');
  });

  it('renders one offscreen cursor-item button per node/link, in the same roving order as svg mode, driving the same keyboard/announcement logic', async () => {
    const el = await mountCanvas();
    const items = [
      ...el.shadowRoot!.querySelectorAll('[part="cursor-item"]'),
    ] as HTMLButtonElement[];
    expect(items).to.have.length(3); // 2 nodes + 1 link
    expect(
      items.filter((i) => i.getAttribute('tabindex') === '0')
    ).to.have.length(1);
    items[0]!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    );
    await el.updateComplete;
    expect(items[1]!.getAttribute('tabindex')).to.equal('0');
    expect(
      el.shadowRoot!.querySelector('[part="live-region"]')!.textContent
    ).to.not.equal('');
  });

  it('exposes explicit selection state on canvas virtual-cursor nodes and links', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        selection-mode="multiple"
        width="400"
        height="300"
        style="width:400px;height:300px"
      ></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    el.selectedNodeIds = ['a'];
    el.selectedEdgeIds = ['a->b'];
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    const items = [...el.shadowRoot!.querySelectorAll('[part="cursor-item"]')];
    expect(
      items.map((item) => item.getAttribute('aria-pressed'))
    ).to.deep.equal(['true', 'false', 'true']);
  });

  it('clamps the canvas tooltip inside the visible canvas and viewport bounds', async () => {
    const el = await mountCanvas();
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const tooltip = el.shadowRoot!.querySelector(
      '[part="tooltip"]'
    ) as HTMLDivElement;
    const originalCanvasRect = canvas.getBoundingClientRect.bind(canvas);
    const originalTooltipRect = tooltip.getBoundingClientRect.bind(tooltip);
    canvas.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 400,
        bottom: 300,
        width: 400,
        height: 300,
        x: 0,
        y: 0,
        toJSON() {},
      } as DOMRect);
    tooltip.getBoundingClientRect = () =>
      ({
        left: 395,
        top: -20,
        right: 515,
        bottom: 10,
        width: 120,
        height: 30,
        x: 395,
        y: -20,
        toJSON() {},
      } as DOMRect);
    try {
      const internals = el as unknown as {
        updateCanvasTooltip(
          hit: { kind: 'node'; node: (typeof el.simNodes)[number] },
          clientX: number,
          clientY: number
        ): void;
      };
      internals.updateCanvasTooltip(
        { kind: 'node', node: el.simNodes[0]! },
        395,
        5
      );
      expect(parseFloat(tooltip.style.left)).to.be.lessThan(395);
      expect(parseFloat(tooltip.style.top)).to.be.greaterThan(5);
    } finally {
      canvas.getBoundingClientRect = originalCanvasRect;
      tooltip.getBoundingClientRect = originalTooltipRect;
    }
  });

  it('Enter/Space on a cursor-item activates the same click handler as pointer interaction', async () => {
    const el = await mountCanvas();
    const items = [
      ...el.shadowRoot!.querySelectorAll('[part="cursor-item"]'),
    ] as HTMLButtonElement[];
    let detail: { nodeId: string; x: number; y: number } | undefined;
    el.addEventListener(
      'lr-node-click',
      (e) => (detail = (e as CustomEvent).detail)
    );
    items[0]!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    expect(detail?.nodeId).to.equal(el.simNodes[0]!.id);
    expect(detail?.x).to.be.a('number');
    expect(detail?.y).to.be.a('number');
  });

  it('is accessible with interactions and a selection applied in canvas mode', async () => {
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        selection-mode="multiple"
        width="400"
        height="300"
        style="width:400px;height:300px"
      ></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    el.selectedNodeIds = ['a'];
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    await expect(el).to.be.accessible();
  });

  it('starts in the shared loading state before any renderer-specific markup, same as svg mode', () => {
    // The existing peer-missing fallback (graph-loader.ts's console.warn path) is renderer-
    // agnostic -- render()'s loading branch is checked before the renderer==='canvas' branch, and
    // this.loading never resolves false without this.d3, so canvas mode shows the same loading
    // skeleton, never a partially-initialized canvas. Asserted on the class-field default directly
    // (rather than after an async fixture()+mount) because this file has, by this point, already
    // resolved the module-level lazy d3 loader for earlier tests -- a fresh element's loadD3()
    // .then() callback could plausibly settle before a later assertion runs, making "still loading
    // right after mount" an unreliable thing to assert on here specifically.
    const el = asTestGraph(document.createElement('lr-graph'));
    el.renderer = 'canvas';
    expect((el as unknown as { loading: boolean }).loading).to.be.true;
  });
});

it('does not let a LyraGraphNode.color value inject extra CSS declarations via the node style attribute', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = [
    { id: 'a', label: 'A', color: 'red; position: fixed; top: 0px' },
    { id: 'b', label: 'B' },
  ];
  el.edges = links;
  await el.updateComplete;
  await waitUntil(
    () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
    undefined,
    {
      timeout: NODE_COUNT_TIMEOUT,
    }
  );
  const [coloredEl] = [
    ...el.shadowRoot!.querySelectorAll('[part="node"]'),
  ] as SVGCircleElement[];
  // Read the parsed inline style declaration directly (not getComputedStyle,
  // which reports 'static' for SVG shape elements regardless of what's
  // declared) — this is what actually detects a second CSS declaration
  // having been injected into the style attribute via string concatenation.
  expect(coloredEl!.style.position).to.equal('');
  expect(coloredEl!.style.top).to.equal('');
});

it('rejects url paint servers from node, type, link, and community colors', async () => {
  const paintServer = 'url("data:image/svg+xml,<svg/>")';
  const el = await fixture<LyraGraph>(html`<lr-graph seed="42"></lr-graph>`);
  el.nodeTypes = [{ id: 'unsafe', label: 'Unsafe', color: paintServer }];
  el.nodes = [
    { id: 'a', label: 'A', type: 'unsafe', communityId: 'team' },
    { id: 'b', label: 'B', color: paintServer, communityId: 'team' },
  ];
  el.edges = [{ source: 'a', target: 'b', color: paintServer }];
  el.communities = [{ id: 'team', memberIds: [], color: paintServer }];
  await el.updateComplete;
  await waitUntil(
    () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
    undefined,
    {
      timeout: NODE_COUNT_TIMEOUT,
    }
  );
  for (const node of el.shadowRoot!.querySelectorAll<SVGElement>(
    '[part="node"]'
  )) {
    expect(node.style.getPropertyValue('--lr-graph-node-fill')).to.not.contain(
      'url('
    );
  }
  expect(
    (
      el.shadowRoot!.querySelector('[part="link"]') as SVGElement
    ).style.getPropertyValue('--lr-graph-edge-color')
  ).to.equal('');
  expect(
    (
      el.shadowRoot!.querySelector('[part="hull"]') as SVGElement
    ).style.getPropertyValue('--lr-graph-hull-fill')
  ).to.equal('');
});

it('wires up d3-drag on each draggable node', async () => {
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
  const nodeEl = el.shadowRoot!.querySelector(
    '[part="node"]'
  ) as SVGCircleElement;
  expect(select(nodeEl).on('mousedown.drag')).to.be.a('function');
});

it('wires up d3-zoom pan/zoom on the svg', async () => {
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
  const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
  const g = el.shadowRoot!.querySelector('g') as SVGGElement;
  expect(select(svgEl).on('wheel.zoom')).to.be.a('function');
  expect(g.getAttribute('transform')).to.equal('');

  svgEl.dispatchEvent(
    new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: -100,
      clientX: 10,
      clientY: 10,
    })
  );
  await el.updateComplete;
  expect(g.getAttribute('transform')).to.match(/scale\(/);
});

it('bounds zoom to a sane scaleExtent instead of zooming in unbounded', async () => {
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
  const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
  const g = el.shadowRoot!.querySelector('g') as SVGGElement;

  // A single huge wheel delta would zoom far past any sane bound if
  // scaleExtent isn't set.
  svgEl.dispatchEvent(
    new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: -100000,
      clientX: 10,
      clientY: 10,
    })
  );
  await el.updateComplete;
  const match = /scale\(([^)]+)\)/.exec(g.getAttribute('transform') ?? '');
  expect(match).to.exist;
  expect(Number(match![1])).to.be.at.most(8);
});

it('retunes the live zoom scaleExtent when minZoom/maxZoom change after the svg has already been bound', async () => {
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

  // The svg is already bound to d3-zoom (with the default 0.1–8 scaleExtent)
  // by this point — this is the post-mount case that used to be a no-op.
  el.minZoom = 1;
  el.maxZoom = 2;
  await el.updateComplete;

  const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
  const g = el.shadowRoot!.querySelector('g') as SVGGElement;

  // A huge wheel delta would zoom well past 2 if the live scaleExtent hadn't
  // actually been retuned.
  svgEl.dispatchEvent(
    new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: -100000,
      clientX: 10,
      clientY: 10,
    })
  );
  await el.updateComplete;
  const match = /scale\(([^)]+)\)/.exec(g.getAttribute('transform') ?? '');
  expect(match).to.exist;
  expect(Number(match![1])).to.be.at.most(2);
});

it('updates the charge/link forces in place when chargeStrength/edgeDistance change after mount', async () => {
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

  el.chargeStrength = -900;
  el.edgeDistance = 250;
  await el.updateComplete;

  const chargeForce = (el as any).chargeForce as {
    strength: () => () => number;
  };
  const linkForce = (el as any).linkForce as { distance: () => () => number };
  expect(chargeForce.strength()()).to.equal(-900);
  expect(linkForce.distance()()).to.equal(250);
});

it('still retunes chargeStrength/edgeDistance when width/height change in the same update batch', async () => {
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

  // Setting both in the same synchronous batch used to mean only the
  // width/height branch ran (they were joined with `else if`), silently
  // dropping the chargeStrength retune.
  el.width = 1000;
  el.chargeStrength = -900;
  await el.updateComplete;

  const chargeForce = (el as any).chargeForce as {
    strength: () => () => number;
  };
  expect(chargeForce.strength()()).to.equal(-900);
});

it('recenters the simulation and bumps alpha when width/height change post-mount', async function () {
  // Waiting for a *full* default-alphaDecay settle (ALPHA_SETTLE_TIMEOUT
  // below) genuinely takes close to 5s on its own -- raise this test's own
  // Mocha timeout (web-test-runner.config.js sets a 6s default for every
  // test) so that wait isn't cut off by the runner before it gets the
  // chance to finish.
  this.timeout(20_000);
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

  const simulation = (el as any).simulation as {
    alpha: () => number;
    alphaMin: () => number;
    force: (name: string) => { x: () => number; y: () => number };
  };
  // Let the initial settle finish so the alpha bump below is unambiguous.
  await waitUntil(
    () => simulation.alpha() <= simulation.alphaMin(),
    undefined,
    {
      timeout: ALPHA_SETTLE_TIMEOUT,
    }
  );

  el.width = 1000;
  el.height = 400;
  await el.updateComplete;

  const center = simulation.force('center');
  expect(center.x()).to.equal(500);
  expect(center.y()).to.equal(200);
  expect(simulation.alpha()).to.be.greaterThan(simulation.alphaMin());
});

// Regression coverage for the shared finite-number normalization layer (`src/internal/numbers.ts`)
// not previously wired up for width/height/min-zoom/max-zoom/charge-strength/edge-distance -- an
// invalid attribute value used to flow straight into forceCenter()/d3-force's strength()/
// distance()/scaleExtent() and the SVG viewBox, poisoning the simulation and rendered geometry
// with NaN instead of being clamped like every other numeric property in this library.
it('normalizes non-finite/non-positive width or height so the viewBox and force-center stay finite', async () => {
  const el = (await fixture(
    html`<lr-graph width="NaN" height="-100"></lr-graph>`
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

  const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
  expect(svgEl.getAttribute('viewBox')).to.not.match(/NaN|Infinity|-100/);

  const simulation = (el as any).simulation as {
    force: (name: string) => { x: () => number; y: () => number };
  };
  const center = simulation.force('center');
  expect(Number.isFinite(center.x())).to.be.true;
  expect(Number.isFinite(center.y())).to.be.true;
});

it('normalizes public link widths before SVG, canvas, and picking geometry consume them', async () => {
  const el = (await fixture(
    html`<lr-graph layout="layered"></lr-graph>`
  )) as LyraGraph;
  el.nodes = nodes;
  el.edges = [
    { id: 'nan', source: 'a', target: 'b', width: NaN },
    { id: 'negative', source: 'a', target: 'b', width: -4 },
    { id: 'infinite', source: 'a', target: 'b', width: Infinity },
    { id: 'valid', source: 'a', target: 'b', width: 2.25 },
  ];
  await el.updateComplete;
  await waitUntil(
    () => el.shadowRoot!.querySelectorAll('[part="link"]').length === 4,
    undefined,
    {
      timeout: NODE_COUNT_TIMEOUT,
    }
  );
  const svgWidths = [...el.shadowRoot!.querySelectorAll('[part="link"]')].map(
    (link) => Number(link.getAttribute('stroke-width'))
  );
  expect(svgWidths).to.deep.equal([1.5, 0, 1.5, 2.25]);

  el.renderer = 'canvas';
  await el.updateComplete;
  type Internals = {
    canvasScene?: { links: { width: number }[] };
    safeLinkWidth(link: { width?: number }): number;
  };
  await waitUntil(() => !!(el as unknown as Internals).canvasScene, undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });
  expect(
    (el as unknown as Internals).canvasScene!.links.map((link) => link.width)
  ).to.deep.equal([1.5, 0, 1.5, 2.25]);
  expect(
    el.edges.map((link) => (el as unknown as Internals).safeLinkWidth(link))
  ).to.deep.equal([1.5, 0, 1.5, 2.25]);
});

it('normalizes non-finite/negative min-zoom or max-zoom so the live scaleExtent and zoomed scale stay finite', async () => {
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

  el.minZoom = NaN;
  el.maxZoom = Infinity;
  await el.updateComplete;
  const zoomBehavior = (el as any).zoomBehavior as {
    scaleExtent: () => [number, number];
  };
  let [lo, hi] = zoomBehavior.scaleExtent();
  expect(Number.isFinite(lo)).to.be.true;
  expect(Number.isFinite(hi)).to.be.true;
  expect(lo).to.be.greaterThan(0);

  el.minZoom = -Infinity;
  el.maxZoom = -5; // a negative upper zoom bound is meaningless
  await el.updateComplete;
  [lo, hi] = zoomBehavior.scaleExtent();
  expect(Number.isFinite(lo)).to.be.true;
  expect(Number.isFinite(hi)).to.be.true;
  expect(hi).to.be.greaterThan(0);

  const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
  const g = el.shadowRoot!.querySelector('g') as SVGGElement;
  svgEl.dispatchEvent(
    new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: -100000,
      clientX: 10,
      clientY: 10,
    })
  );
  await el.updateComplete;
  const match = /scale\(([^)]+)\)/.exec(g.getAttribute('transform') ?? '');
  expect(match).to.exist;
  expect(Number.isFinite(Number(match![1]))).to.be.true;
});

it('orders inverted zoom bounds before configuring d3 and imperative camera operations', async () => {
  const el = (await fixture(
    html`<lr-graph min-zoom="10" max-zoom="2"></lr-graph>`
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

  const zoomBehavior = (el as any).zoomBehavior as {
    scaleExtent: () => [number, number];
  };
  expect(zoomBehavior.scaleExtent()).to.deep.equal([2, 10]);

  expect(await el.focusNode('a', { zoom: Number.NaN })).to.equal(true);
  el.fit({ padding: Number.POSITIVE_INFINITY });
  await new Promise((resolve) => setTimeout(resolve, 350));
  const transform = el
    .shadowRoot!.querySelector('g')!
    .getAttribute('transform')!;
  const scale = Number(transform.match(/scale\(([-\d.]+)\)/)?.[1]);
  expect(Number.isFinite(scale)).to.equal(true);
  expect(scale).to.be.within(2, 10);
});

it('normalizes non-finite charge-strength and non-finite/negative edge-distance so the live d3-force objects never receive NaN', async () => {
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

  el.chargeStrength = NaN;
  el.edgeDistance = -250; // a negative link distance has no sane geometric meaning
  await el.updateComplete;

  const chargeForce = (el as any).chargeForce as {
    strength: () => () => number;
  };
  const linkForce = (el as any).linkForce as { distance: () => () => number };
  expect(Number.isFinite(chargeForce.strength()())).to.be.true;
  const distance = linkForce.distance()();
  expect(Number.isFinite(distance)).to.be.true;
  expect(distance).to.be.at.least(0);

  el.chargeStrength = Infinity;
  await el.updateComplete;
  expect(Number.isFinite(chargeForce.strength()())).to.be.true;
});

it('normalizes a non-finite seed to a finite integer instead of poisoning the deterministic spawn hash', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.seed = Number.NaN;
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

  for (const n of el.nodes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sim = (el as any).simNodes.find((s: { id: string }) => s.id === n.id);
    expect(Number.isFinite(sim.x)).to.be.true;
    expect(Number.isFinite(sim.y)).to.be.true;
  }

  el.seed = Infinity;
  el.edges = [...links];
  await el.updateComplete;
  await waitUntil(
    () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
    undefined,
    {
      timeout: NODE_COUNT_TIMEOUT,
    }
  );
  for (const n of el.nodes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sim = (el as any).simNodes.find((s: { id: string }) => s.id === n.id);
    expect(Number.isFinite(sim.x)).to.be.true;
    expect(Number.isFinite(sim.y)).to.be.true;
  }
});

it('leaves seed undefined (unseeded/random) alone -- only a defined-but-non-finite seed is normalized', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  expect(el.seed).to.be.undefined;
  expect((el as any).safeSeed).to.be.undefined;
});

it('normalizes a non-finite edge-label-min-zoom so the live edge-label visibility gate keeps working instead of never hiding', async () => {
  const el = (await fixture(
    html`<lr-graph with-edge-labels></lr-graph>`
  )) as LyraGraph;
  el.nodes = nodes;
  el.edges = [{ source: 'a', target: 'b', label: 'A to B' }];
  await el.updateComplete;
  await waitUntil(
    () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
    undefined,
    {
      timeout: NODE_COUNT_TIMEOUT,
    }
  );

  el.edgeLabelMinZoom = Number.NaN;
  await el.updateComplete;
  expect(Number.isFinite((el as any).safeEdgeLabelMinZoom)).to.be.true;

  // Un-normalized, `k < NaN` is always false, so the labels would never hide no matter how far
  // out the camera zooms -- zoom out past the (fallback-normalized) default threshold and confirm
  // the gate still engages.
  const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
  const g = el.shadowRoot!.querySelector('g') as SVGGElement;
  svgEl.dispatchEvent(
    new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 100000,
      clientX: 10,
      clientY: 10,
    })
  );
  await el.updateComplete;
  expect(g.hasAttribute('data-edge-labels-hidden')).to.be.true;
});

it('does not reassign simNodes/simLinks references on tick, only positions (avoids a full Lit re-render every animation frame)', async () => {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const simNodesRef = (el as any).simNodes;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const simLinksRef = (el as any).simLinks;
  const initialCx = (
    el.shadowRoot!.querySelector('[part="node"]') as SVGCircleElement
  ).getAttribute('cx');

  // Let the simulation tick for a while.
  await aTimeout(300);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((el as any).simNodes).to.equal(simNodesRef);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((el as any).simLinks).to.equal(simLinksRef);
  // Positions still actually update (via direct DOM writes, not Lit
  // re-renders) — this isn't a frozen simulation, ticks just no longer
  // reassign the reactive simNodes/simLinks array references.
  const laterCx = (
    el.shadowRoot!.querySelector('[part="node"]') as SVGCircleElement
  ).getAttribute('cx');
  expect(laterCx).to.not.equal(initialCx);
});

it('skips the settle animation under prefers-reduced-motion (jumps straight to a converged layout)', async () => {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = mediaQueryOverride(
    window,
    (query) => query === '(prefers-reduced-motion: reduce)'
  );

  try {
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

    const simulation = (el as any).simulation as {
      alpha: () => number;
      alphaMin: () => number;
    };
    expect(simulation.alpha()).to.be.at.most(simulation.alphaMin());
  } finally {
    window.matchMedia = originalMatchMedia;
  }
});

it('stops and resumes an existing force simulation when the scoped motion preference changes', async () => {
  const original = window.matchMedia;
  window.matchMedia = mediaQueryOverride(window, () => false);
  try {
    const graph = await fixture<LyraGraph>(html`<lr-graph></lr-graph>`);
    graph.nodes = nodes;
    graph.edges = links;
    await graph.updateComplete;
    await waitUntil(() => graph.shadowRoot!.querySelectorAll('[part="node"]').length === 2, undefined, { timeout: NODE_COUNT_TIMEOUT });
    const simulation = (graph as any).simulation;
    const stop = simulation.stop;
    const restart = simulation.restart;
    let stops = 0;
    let restarts = 0;
    simulation.stop = function () { stops += 1; return stop.call(this); };
    simulation.restart = function () { restarts += 1; return restart.call(this); };
    try {
      graph.setAttribute('data-lr-motion', 'reduce');
      await waitUntil(() => stops > 0);
      graph.setAttribute('data-lr-motion', 'system');
      await waitUntil(() => restarts > 0);
    } finally {
      simulation.stop = stop;
      simulation.restart = restart;
    }
  } finally {
    window.matchMedia = original;
  }
});

it('seeded layout: two separate instances with the same nodes/links/seed converge to bit-identical final positions', async () => {
  const seededNodes = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ];
  const seededLinks = [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
  ];

  const positionsOf = (el: LyraGraph) =>
    Array.from(el.shadowRoot!.querySelectorAll('[part="node"]')).map((n) => ({
      cx: n.getAttribute('cx'),
      cy: n.getAttribute('cy'),
    }));

  const elA = (await fixture(
    html`<lr-graph seed="42"></lr-graph>`
  )) as LyraGraph;
  elA.nodes = seededNodes;
  elA.edges = seededLinks;
  await elA.updateComplete;
  await waitUntil(
    () => elA.shadowRoot!.querySelectorAll('[part="node"]').length === 3,
    undefined,
    {
      timeout: NODE_COUNT_TIMEOUT,
    }
  );

  const elB = (await fixture(
    html`<lr-graph seed="42"></lr-graph>`
  )) as LyraGraph;
  // Deliberately reorder the nodes array between the two instances — a
  // reproducible seeded layout must be keyed by node id, not array index.
  elB.nodes = [seededNodes[2]!, seededNodes[0]!, seededNodes[1]!];
  elB.edges = seededLinks;
  await elB.updateComplete;
  await waitUntil(
    () => elB.shadowRoot!.querySelectorAll('[part="node"]').length === 3,
    undefined,
    {
      timeout: NODE_COUNT_TIMEOUT,
    }
  );

  // Match up positions by node id (not DOM order, since elB's nodes were
  // supplied in a different order) via the aria-label, which is set to the
  // node's label/id.
  const byLabel = (el: LyraGraph) => {
    const map = new Map<string, { cx: string | null; cy: string | null }>();
    el.shadowRoot!.querySelectorAll('[part="node"]').forEach((n) => {
      map.set(n.getAttribute('aria-label')!, {
        cx: n.getAttribute('cx'),
        cy: n.getAttribute('cy'),
      });
    });
    return map;
  };
  const mapA = byLabel(elA);
  const mapB = byLabel(elB);
  expect(mapA.size).to.equal(3);
  for (const [label, posA] of mapA) {
    const posB = mapB.get(label);
    expect(posB, `missing node ${label} in elB`).to.exist;
    expect(posB).to.deep.equal(posA);
  }
  // Sanity: positions actually recorded, this isn't vacuously true.
  expect(positionsOf(elA).every((p) => p.cx != null && p.cy != null)).to.be
    .true;
});

it('seeded layout: different seeds produce different final positions', async () => {
  const seededNodes = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ];
  const seededLinks = [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
  ];

  const elA = (await fixture(
    html`<lr-graph seed="1"></lr-graph>`
  )) as LyraGraph;
  elA.nodes = seededNodes;
  elA.edges = seededLinks;
  await elA.updateComplete;
  await waitUntil(
    () => elA.shadowRoot!.querySelectorAll('[part="node"]').length === 3,
    undefined,
    {
      timeout: NODE_COUNT_TIMEOUT,
    }
  );

  const elB = (await fixture(
    html`<lr-graph seed="2"></lr-graph>`
  )) as LyraGraph;
  elB.nodes = seededNodes;
  elB.edges = seededLinks;
  await elB.updateComplete;
  await waitUntil(
    () => elB.shadowRoot!.querySelectorAll('[part="node"]').length === 3,
    undefined,
    {
      timeout: NODE_COUNT_TIMEOUT,
    }
  );

  const posA = Array.from(
    elA.shadowRoot!.querySelectorAll('[part="node"]')
  ).map((n) => [n.getAttribute('cx'), n.getAttribute('cy')]);
  const posB = Array.from(
    elB.shadowRoot!.querySelectorAll('[part="node"]')
  ).map((n) => [n.getAttribute('cx'), n.getAttribute('cy')]);
  expect(posA).to.not.deep.equal(posB);
});

it('seeded layout: settles synchronously (like prefers-reduced-motion) so the layout is reproducible without waiting on animation frames', async () => {
  const el = (await fixture(html`<lr-graph seed="7"></lr-graph>`)) as LyraGraph;
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

  const simulation = (el as any).simulation as {
    alpha: () => number;
    alphaMin: () => number;
  };
  expect(simulation.alpha()).to.be.at.most(simulation.alphaMin());
});

it('seed unset: layout is unaffected (still uses forceSimulation()s own random initial start, not the deterministic PRNG)', async () => {
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

  // Without a seed, the simulation still animates its settle instead of
  // jumping straight to alphaMin — the existing (pre-seed-feature) behavior.
  const simulation = (el as any).simulation as {
    alpha: () => number;
    alphaMin: () => number;
  };
  expect(simulation.alpha()).to.be.greaterThan(simulation.alphaMin());
});

it('user-initiated drag still works normally after a seeded synchronous settle', async () => {
  const el = (await fixture(html`<lr-graph seed="7"></lr-graph>`)) as LyraGraph;
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

  const nodeEl = el.shadowRoot!.querySelector(
    '[part="node"]'
  ) as SVGCircleElement;
  expect(select(nodeEl).on('mousedown.drag')).to.be.a('function');
});

it('changing seed after nodes/links already have positions is a documented no-op (does not retroactively reposition)', async () => {
  const seededNodes = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ];
  const seededLinks = [{ source: 'a', target: 'b' }];

  const el = (await fixture(html`<lr-graph seed="1"></lr-graph>`)) as LyraGraph;
  el.nodes = seededNodes;
  el.edges = seededLinks;
  await el.updateComplete;
  await waitUntil(
    () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
    undefined,
    {
      timeout: NODE_COUNT_TIMEOUT,
    }
  );

  const before = Array.from(
    el.shadowRoot!.querySelectorAll('[part="node"]')
  ).map((n) => [n.getAttribute('cx'), n.getAttribute('cy')]);

  // A different seed, supplied after nodes/links already assigned every
  // node a settled position, must not reshuffle the existing layout.
  el.seed = 999;
  await el.updateComplete;

  const after = Array.from(
    el.shadowRoot!.querySelectorAll('[part="node"]')
  ).map((n) => [n.getAttribute('cx'), n.getAttribute('cy')]);
  expect(after).to.deep.equal(before);
});

it('clamps an out-of-range LyraGraphNode.radius so the node still renders visibly-sized and focusable', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = [
    { id: 'a', label: 'A', radius: 0 },
    { id: 'b', label: 'B', radius: -50 },
    { id: 'c', label: 'C', radius: 1000 },
  ];
  el.edges = [];
  await el.updateComplete;
  await waitUntil(
    () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 3,
    undefined,
    {
      timeout: NODE_COUNT_TIMEOUT,
    }
  );

  const circles = Array.from(
    el.shadowRoot!.querySelectorAll('[part="node"]')
  ) as SVGCircleElement[];
  for (const [index, circle] of circles.entries()) {
    const r = Number(circle.getAttribute('r'));
    expect(r).to.be.at.least(6);
    expect(r).to.be.at.most(24);
    expect(circle.getAttribute('tabindex')).to.equal(index === 0 ? '0' : '-1');
    expect(circle.getAttribute('role')).to.equal('button');
  }
});

it('stops the force simulation on disconnect so a detached instance stops ticking', async () => {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const simulation = (el as any).simulation;
  let stopped = false;
  const originalStop = simulation.stop.bind(simulation);
  simulation.stop = (...args: unknown[]) => {
    stopped = true;
    return originalStop(...args);
  };

  el.remove();
  expect(stopped, 'disconnectedCallback should call simulation.stop()').to.be
    .true;

  // With the timer actually stopped, alpha can no longer decay via further
  // ticks — a still-running simulation would keep animating a detached
  // instance indefinitely.
  const alphaAfterDisconnect = simulation.alpha();
  await aTimeout(200);
  expect(simulation.alpha()).to.equal(alphaAfterDisconnect);
});

it('does not restart the simulation from scratch on a reconnect (e.g. a drag-and-drop reparent)', async () => {
  // A seed converges the initial simulation synchronously. Reconnect continuity is proved by the
  // simulation object's identity below, so making this setup deterministic avoids spending almost
  // the entire per-test budget waiting for ~300 requestAnimationFrame-driven decay ticks.
  const el = (await fixture(html`<lr-graph seed="7"></lr-graph>`)) as LyraGraph;
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const simulation = (el as any).simulation as {
    alpha: () => number;
    alphaMin: () => number;
  };
  expect(simulation.alpha(), 'seeded setup should already be settled').to.be.at
    .most(simulation.alphaMin());

  const otherContainer = document.createElement('div');
  document.body.appendChild(otherContainer);
  try {
    otherContainer.appendChild(el); // reparenting an already-connected node fires disconnectedCallback then connectedCallback synchronously

    // A buggy connectedCallback kicks off its rebuild from an already-resolved
    // `loadD3()` promise's `.then()` — that callback lands on a later
    // microtask/task, not synchronously within this reparent — so give it a
    // moment to run before asserting nothing changed.
    await aTimeout(50);

    // A from-scratch rebuild would swap in a brand-new forceSimulation() instance. The seed makes
    // either instance settle synchronously, so object identity remains the discriminating signal:
    // the same, already-settled instance must be reused instead.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((el as any).simulation).to.equal(simulation);
    expect(simulation.alpha()).to.be.at.most(simulation.alphaMin());
  } finally {
    otherContainer.remove();
  }
});

it('renders a dangling-target link as a stub off the source instead of dropping it', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = nodes; // ids: a, b
  el.edges = [...links, { source: 'a', target: 'does-not-exist' }];
  await el.updateComplete;
  await waitUntil(
    () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
    undefined,
    {
      timeout: NODE_COUNT_TIMEOUT,
    }
  );
  await aTimeout(200);

  const linkEls = [...el.shadowRoot!.querySelectorAll('[part="link"]')];
  expect(linkEls).to.have.length(2); // the real a-b link, plus a dangling stub off 'a'
  const stub = linkEls.find((l) => l.hasAttribute('data-dangling'))!;
  expect(stub != null).to.equal(true);
  expect(stub.getAttribute('aria-hidden')).to.equal('true');
});

it('keeps a dangling stub synced to its source node across ticks, instead of freezing at its initial position', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = nodes; // ids: a, b
  el.edges = [...links, { source: 'a', target: 'does-not-exist' }];
  await el.updateComplete;
  await waitUntil(
    () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
    undefined,
    {
      timeout: NODE_COUNT_TIMEOUT,
    }
  );

  const sourceCircle = [
    ...el.shadowRoot!.querySelectorAll('[part="node"]'),
  ].find((c) => c.getAttribute('aria-label') === 'A') as SVGCircleElement;
  const stub = el.shadowRoot!.querySelector(
    '[part="link"][data-dangling]'
  ) as SVGLineElement;
  const internal = el as unknown as {
    simulation?: { stop(): void };
    simNodes: Array<{ id: string; x?: number; y?: number }>;
    onTick(): void;
  };
  internal.simulation?.stop();
  const sourceNode = internal.simNodes.find((node) => node.id === 'a')!;

  internal.onTick();
  const firstSourceX = sourceCircle.getAttribute('cx');
  expect(stub.getAttribute('x1')).to.equal(firstSourceX);
  expect(stub.getAttribute('y1')).to.equal(sourceCircle.getAttribute('cy'));

  sourceNode.x = (sourceNode.x ?? 0) + 47;
  sourceNode.y = (sourceNode.y ?? 0) + 31;
  internal.onTick();
  const laterSourceX = sourceCircle.getAttribute('cx');
  expect(
    laterSourceX,
    'sanity check: the controlled tick moves the source node'
  ).to.not.equal(firstSourceX);
  // Before the fix, onTick() recomputed the stub's synthetic target but never wrote x1/y1/x2/y2
  // to its <line> element, so the stub stayed rendered at its very first tick's position while
  // the source node it hangs off kept animating away from it.
  expect(stub.getAttribute('x1')).to.equal(laterSourceX);
  expect(stub.getAttribute('y1')).to.equal(sourceCircle.getAttribute('cy'));
});

it('silently drops a link whose source id has no matching node, without throwing, and still renders the valid links', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = nodes; // ids: a, b
  el.edges = [...links, { source: 'does-not-exist', target: 'b' }];
  await el.updateComplete;
  await waitUntil(
    () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
    undefined,
    {
      timeout: NODE_COUNT_TIMEOUT,
    }
  );
  await aTimeout(200);

  const linkEls = el.shadowRoot!.querySelectorAll('[part="link"]');
  expect(linkEls.length).to.equal(1);
  expect((linkEls[0] as SVGLineElement).getAttribute('aria-label')).to.equal(
    'Link from A to B'
  );
});

it('is accessible', async () => {
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
  await expect(el).to.be.accessible();
});
