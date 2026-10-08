import { nextFrame, twoFrames } from '../../../../test/frames.js';
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

describe('data-list aria-label localization', () => {
  it('defaults the data-list aria-label to the built-in English "Graph data"', async () => {
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
    const list = el.shadowRoot!.querySelector(
      '[part="data-list"]'
    ) as HTMLElement;
    expect(list.getAttribute('aria-label')).to.equal('Graph data');
  });

  it('localizes the data-list aria-label via .strings (graphDataList)', async () => {
    const el = (await fixture(
      html`<lr-graph
        .strings=${{ graphDataList: 'Données du graphe' }}
      ></lr-graph>`
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
    const list = el.shadowRoot!.querySelector(
      '[part="data-list"]'
    ) as HTMLElement;
    expect(list.getAttribute('aria-label')).to.equal('Données du graphe');
  });
});

describe('RTL keyboard navigation', () => {
  // Matches the `forwardKey`/`backwardKey` swap this library's other
  // "physical arrow key drives sequential previous/next" components
  // (lr-tab-group, lr-slider, lr-segmented) apply under dir="rtl": the
  // physical ArrowLeft becomes "next" and ArrowRight becomes "previous".
  it('swaps ArrowLeft/ArrowRight roving-tabindex navigation under dir="rtl"', async () => {
    const wrapper = (await fixture(
      html`<div dir="rtl"><lr-graph></lr-graph></div>`
    )) as HTMLDivElement;
    const el = asTestGraph(wrapper.querySelector('lr-graph')!);
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

    const items = () =>
      [
        ...el.shadowRoot!.querySelectorAll('[part="node"]'),
        ...el.shadowRoot!.querySelectorAll('[part="link"]'),
      ] as SVGElement[];

    // ArrowRight is the "backward" physical key under RTL -- from index 0
    // it stays clamped at the first item instead of advancing.
    items()[0]!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    );
    await el.updateComplete;
    expect(items()[0]!.getAttribute('tabindex')).to.equal('0');

    // ArrowLeft is the "forward" physical key under RTL -- advances to the next item.
    items()[0]!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })
    );
    await el.updateComplete;
    expect(items()[1]!.getAttribute('tabindex')).to.equal('0');

    // ArrowRight then moves back to the previous item.
    items()[1]!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    );
    await el.updateComplete;
    expect(items()[0]!.getAttribute('tabindex')).to.equal('0');
  });
});

describe('dimming (adjacency highlight)', () => {
  async function mountDimmable(): Promise<LyraGraph> {
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
    return el;
  }

  it('defaults dimmedNodeIds/dimmedEdgeIds to empty arrays: no data-dimmed anywhere', async () => {
    const el = await mountDimmable();
    expect(el.dimmedNodeIds).to.deep.equal([]);
    expect(el.dimmedEdgeIds).to.deep.equal([]);
    expect(el.shadowRoot!.querySelector('[data-dimmed]') === null).to.be.true;
  });

  it('applies data-dimmed to a matching node, not to an unmatched one', async () => {
    const el = await mountDimmable();
    el.dimmedNodeIds = ['b'];
    await el.updateComplete;
    const [nodeA, nodeB] = [
      ...el.shadowRoot!.querySelectorAll('[part="node"]'),
    ] as SVGElement[];
    expect(nodeA!.hasAttribute('data-dimmed')).to.be.false;
    expect(nodeB!.hasAttribute('data-dimmed')).to.be.true;
  });

  it('is visibly dimmed by default -- no host styling required to see the effect', async () => {
    const el = await mountDimmable();
    el.dimmedNodeIds = ['b'];
    await el.updateComplete;
    const nodeB = el.shadowRoot!.querySelectorAll(
      '[part="node"]'
    )[1] as SVGElement;
    const opacity = Number(getComputedStyle(nodeB).opacity);
    expect(opacity).to.be.greaterThan(0);
    expect(opacity).to.be.lessThan(1);
  });

  it('applies data-dimmed to a matching link via its linkKey (id, else source->target)', async () => {
    const el = await mountDimmable();
    el.dimmedEdgeIds = ['a->b'];
    await el.updateComplete;
    const linkEl = el.shadowRoot!.querySelector(
      '[part="link"]:not([data-dangling])'
    ) as SVGElement;
    expect(linkEl.hasAttribute('data-dimmed')).to.be.true;
  });

  it('never self-mutates dimmedNodeIds/dimmedEdgeIds -- purely controlled, like selectedNodeIds', async () => {
    const el = await mountDimmable();
    el.dimmedNodeIds = ['a'];
    el.dimmedEdgeIds = ['a->b'];
    await el.updateComplete;
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    nodeEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(el.dimmedNodeIds).to.deep.equal(['a']);
    expect(el.dimmedEdgeIds).to.deep.equal(['a->b']);
  });

  it('data-dimmed and data-selected can coexist on the same element independently', async () => {
    const el = await mountDimmable();
    el.selectionMode = 'multiple';
    el.selectedNodeIds = ['a'];
    el.dimmedNodeIds = ['a'];
    await el.updateComplete;
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    expect(nodeEl.hasAttribute('data-selected')).to.be.true;
    expect(nodeEl.hasAttribute('data-dimmed')).to.be.true;
  });

  it('existing rendering is byte-identical when dimmedNodeIds/dimmedEdgeIds are left unset', async () => {
    const el = await mountDimmable();
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    expect(nodeEl.hasAttribute('data-dimmed')).to.be.false;
    expect(nodeEl.getAttribute('style') || '').to.not.include('dimmed');
  });

  it('is accessible with dimming applied', async () => {
    const el = await mountDimmable();
    el.dimmedNodeIds = ['a'];
    el.dimmedEdgeIds = ['a->b'];
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

// ---------------------------------------------------------------------------------------------
// Targeted edge-case tests for graph.class.ts and graph-canvas.ts. Grouped
// by area; each test exercises real, reachable behavior (a genuine event/gesture, or -- matching
// this file's own established convention for private internals, see e.g. the nodeEls-cache
// regression test above -- a direct call to a private helper when there's no reasonable way to
// reach it purely through public DOM events).

describe('coverage: canvas lifecycle (reconnect/disconnect edge cases)', () => {
  it('reconnecting a canvas-mode instance (e.g. a drag-and-drop reparent) re-arms the resize watcher and marks the canvas dirty', async () => {
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
    await graphSupport.waitForCanvasBackingStore(el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement);
    await nextFrame();
    type Internals = {
      hostResizeObserver?: ResizeObserver;
      canvasScene?: unknown;
    };
    const observerBefore = (el as unknown as Internals).hostResizeObserver;
    expect(observerBefore).to.exist;

    const otherContainer = document.createElement('div');
    document.body.appendChild(otherContainer);
    otherContainer.appendChild(el); // fires disconnectedCallback then connectedCallback synchronously

    expect((el as unknown as Internals).hostResizeObserver).to.exist;
    // Re-armed, not merely reused -- watchHostResize() always builds a fresh observer.
    expect((el as unknown as Internals).hostResizeObserver).to.not.equal(
      observerBefore
    );
    expect((el as unknown as Internals).canvasScene).to.be.undefined; // markCanvasDirty() cleared the cache

    otherContainer.remove();
  });

  it('removing a canvas-mode instance while a hover is still coalesced (pending rAF) cancels the frame instead of leaking it', async () => {
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
    await graphSupport.waitForCanvasBackingStore(el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement);
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const target = el.simNodes[0]!;
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: rect.left + target.x!,
        clientY: rect.top + target.y!,
        pointerId: 30,
      })
    );
    expect((el as unknown as { hoverRafId?: number }).hoverRafId).to.be.a(
      'number'
    );
    el.remove();
    expect((el as unknown as { hoverRafId?: number }).hoverRafId).to.be
      .undefined;
    // The canceled frame must never fire and resurrect state on a now-detached instance.
    // wait-reason: negative assertion, the canceled hover frame must never fire on the detached instance
    await aTimeout(50);
  });
});

describe('canvas visibility gating (perf)', () => {
  it('gates canvas redraw behind IntersectionObserver visibility -- no draws while off-screen, catches up once visible again', async () => {
    const io = stubIntersectionObserver();
    try {
      // `seed` converges the settle synchronously (see rebuildSimulation()'s own doc comment) --
      // with no ongoing async tick-driven rAF loop after mount, the draw count from the initial
      // settle is stable by the time the `aTimeout` below returns, with no background-tick race
      // against the off-screen assertion window that follows.
      const el = (await fixture(
        html`<lr-graph
          renderer="canvas"
          seed="7"
          width="200"
          height="200"
          style="width:200px;height:200px"
        ></lr-graph>`
      )) as LyraGraph;
      el.nodes = nodes;
      el.edges = links;
      await el.updateComplete;
      await waitUntil(
        () => !!el.shadowRoot!.querySelector('canvas'),
        undefined,
        { timeout: NODE_COUNT_TIMEOUT }
      );

      expect(io.observedTargets).to.include(el);
      const latest = io.instances[io.instances.length - 1]!;

      type Internals = { drawCanvas(): void; markCanvasDirty(): void; canvasDrawRafId?: number; viewportChangeRafId?: number };
      const internals = el as unknown as Internals;
      const originalDraw = internals.drawCanvas.bind(internals);
      let drawCalls = 0;
      internals.drawCanvas = () => {
        drawCalls++;
        originalDraw();
      };
      await twoFrames();
      // Let every in-flight frame (the settle's deferred draw, a viewport change) run to completion.
      await waitUntil(
        () => internals.canvasDrawRafId === undefined && internals.viewportChangeRafId === undefined,
        'in-flight canvas frames drained'
      );
      await twoFrames();
      drawCalls = 0;

      // Report off-screen, then request a redraw the way a drag/resize would.
      latest.callback(
        [{ isIntersecting: false } as unknown as IntersectionObserverEntry],
        latest as unknown as IntersectionObserver
      );
      internals.markCanvasDirty();
      // wait-reason: negative assertion, no redraw may happen while off-screen across several animation frames
      await aTimeout(100); // several animation frames' worth of headroom
      expect(drawCalls, 'no redraw should happen while off-screen').to.equal(0);

      // Report back on-screen -- the deferred draw request must be honored, not silently dropped.
      latest.callback(
        [{ isIntersecting: true } as unknown as IntersectionObserverEntry],
        latest as unknown as IntersectionObserver
      );
      await waitUntil(() => drawCalls > 0, 'deferred draw issued once visible again');
      expect(
        drawCalls,
        'becoming visible again must issue the deferred draw'
      ).to.be.greaterThan(0);
    } finally {
      io.restore();
    }
  });

  it('disconnects the IntersectionObserver on disconnectedCallback', async () => {
    const io = stubIntersectionObserver();
    try {
      const el = (await fixture(
        html`<lr-graph renderer="canvas"></lr-graph>`
      )) as LyraGraph;
      await el.updateComplete;
      const latest = io.instances[io.instances.length - 1]!;
      expect(latest.disconnected).to.be.false;
      el.remove();
      expect(latest.disconnected).to.be.true;
    } finally {
      io.restore();
    }
  });

  it('treats an empty IntersectionObserver entries array as visible (entries[0]?.isIntersecting ?? true fallback)', async () => {
    const io = stubIntersectionObserver();
    try {
      const el = (await fixture(
        html`<lr-graph renderer="canvas"></lr-graph>`
      )) as LyraGraph;
      await el.updateComplete;
      const latest = io.instances[io.instances.length - 1]!;
      const internal = el as unknown as { visible: boolean };

      // Force it false first so the `?? true` fallback's result is actually observable as a flip,
      // not indistinguishable from the field's own `true` initial default.
      latest.callback(
        [{ isIntersecting: false } as unknown as IntersectionObserverEntry],
        latest as unknown as IntersectionObserver
      );
      expect(internal.visible).to.be.false;

      // A real IntersectionObserver never invokes its callback with an empty entries array for an
      // observed target, so this can only be exercised by driving the fake observer directly.
      latest.callback([], latest as unknown as IntersectionObserver);
      expect(internal.visible).to.be.true;
    } finally {
      io.restore();
    }
  });
});

describe('lifecycle: super calls', () => {
  it('calls super.willUpdate()/super.updated() so a future shared mixin layered under LyraElement keeps running', async () => {
    // Neither LyraElement nor LitElement override willUpdate/updated today (both are true no-ops
    // on ReactiveElement.prototype), so this can only be proven by spying on the inherited method
    // itself and confirming lr-graph's own override still reaches it via `super.<method>()` --
    // mirrors csv-viewer/docx-viewer/pdf-viewer's identical super.willUpdate() call reaching
    // DocumentAnchorTarget's mixin logic.
    const proto = Object.getPrototypeOf(LyraGraphElement.prototype) as {
      willUpdate?: (changed: unknown) => void;
      updated?: (changed: unknown) => void;
    };
    const hadOwnWillUpdate = Object.prototype.hasOwnProperty.call(
      proto,
      'willUpdate'
    );
    const hadOwnUpdated = Object.prototype.hasOwnProperty.call(
      proto,
      'updated'
    );
    const originalWillUpdate = proto.willUpdate;
    const originalUpdated = proto.updated;
    let willUpdateCalls = 0;
    let updatedCalls = 0;
    proto.willUpdate = function (this: unknown, changed: unknown) {
      willUpdateCalls++;
      originalWillUpdate?.call(this, changed);
    };
    proto.updated = function (this: unknown, changed: unknown) {
      updatedCalls++;
      originalUpdated?.call(this, changed);
    };
    try {
      const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
      await el.updateComplete;
      expect(willUpdateCalls).to.be.greaterThan(0);
      expect(updatedCalls).to.be.greaterThan(0);
    } finally {
      if (hadOwnWillUpdate) proto.willUpdate = originalWillUpdate;
      else delete proto.willUpdate;
      if (hadOwnUpdated) proto.updated = originalUpdated;
      else delete proto.updated;
    }
  });
});

describe('coverage: private-helper direct branches', () => {
  it('falls back nodeRadius to the clamped default average when radius is non-finite (NaN)', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = [{ id: 'a', label: 'A', radius: Number.NaN }];
    el.edges = [];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 1,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    const r = Number(
      (
        el.shadowRoot!.querySelector('[part="node"]') as SVGCircleElement
      ).getAttribute('r')
    );
    expect(r).to.be.at.least(6);
    expect(r).to.be.at.most(24);
  });

  it('tweenCamera resolves false without animating when d3/zoomedEl/zoomBehavior are unavailable', async () => {
    // A fresh, never-connected element: this.d3 is still undefined, so tweenCamera()'s own internal
    // guard (the same shape as focusNode()/fit()'s public-facing guards, but exercised directly here
    // since both public callers already gate on the identical condition before ever reaching it).
    const el = asTestGraph(document.createElement('lr-graph'));
    const resolved = await (
      el as unknown as { tweenCamera: (fn: () => unknown) => Promise<boolean> }
    ).tweenCamera(() => ({ k: 1, x: 0, y: 0 }));
    expect(resolved).to.be.false;
  });

  it('linkKey/linkAccessibleText/onLinkClick fall back to String(source/target) for a raw (unresolved) id pair', async () => {
    // Every SimLink this component itself ever constructs (resolveLinksAgainst()) has object
    // source/target -- but the type (SimulationLinkDatum<SimNode>) also allows a bare string id, and
    // these methods' own typeof branch handles it. Exercised directly since there's no public path
    // that ever hands them anything but an already-resolved SimLink.
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    const raw = { source: 'raw-a', target: 'raw-b' };
    const key = (el as unknown as { linkKey: (l: unknown) => string }).linkKey(
      raw
    );
    expect(key).to.equal('raw-a->raw-b');
    const text = (
      el as unknown as { linkAccessibleText: (l: unknown) => string }
    ).linkAccessibleText(raw);
    expect(text).to.equal('Link from raw-a to raw-b');

    let detail: { sourceNodeId: string; targetNodeId: string } | undefined;
    el.addEventListener(
      'lr-edge-activate',
      (e) => (detail = (e as CustomEvent).detail)
    );
    (el as unknown as { onLinkClick: (l: unknown) => void }).onLinkClick(raw);
    expect(detail).to.deep.equal({
      sourceNodeId: 'raw-a',
      targetNodeId: 'raw-b',
    });
  });

  it('onLinkEnter/onLinkLeave resolve raw string source/target ids the same way', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    const raw = { source: 'raw-a', target: 'raw-b' };
    const fakeEl = document.createElement('div');

    let enterDetail: { sourceNodeId: string; targetNodeId: string } | undefined;
    el.addEventListener(
      'lr-edge-enter',
      (e) => (enterDetail = (e as CustomEvent).detail)
    );
    (
      el as unknown as { onLinkEnter: (l: unknown, e: unknown) => void }
    ).onLinkEnter(raw, { currentTarget: fakeEl });
    expect(enterDetail).to.deep.equal({
      sourceNodeId: 'raw-a',
      targetNodeId: 'raw-b',
    });
    expect(fakeEl.hasAttribute('data-hovered')).to.be.true;

    let leaveDetail: { sourceNodeId: string; targetNodeId: string } | undefined;
    el.addEventListener(
      'lr-edge-leave',
      (e) => (leaveDetail = (e as CustomEvent).detail)
    );
    (
      el as unknown as { onLinkLeave: (l: unknown, e: unknown) => void }
    ).onLinkLeave(raw, { currentTarget: fakeEl });
    expect(leaveDetail).to.deep.equal({
      sourceNodeId: 'raw-a',
      targetNodeId: 'raw-b',
    });
    expect(fakeEl.hasAttribute('data-hovered')).to.be.false;
  });

  it('linkCoordinates/edgeLabelPosition handle a zero-length link (coincident source/target) without dividing by zero', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    const coincident = {
      source: { x: 5, y: 5 },
      target: { x: 5, y: 5 },
      directed: true,
    };
    const coords = (
      el as unknown as {
        linkCoordinates: (l: unknown) => {
          x1: number;
          y1: number;
          x2: number;
          y2: number;
        };
      }
    ).linkCoordinates(coincident);
    expect(coords).to.deep.equal({ x1: 5, y1: 5, x2: 5, y2: 5 });

    const pos = (
      el as unknown as {
        edgeLabelPosition: (l: unknown) => { x: number; y: number };
      }
    ).edgeLabelPosition(coincident);
    expect(pos).to.deep.equal({ x: 5, y: 5 });
  });

  it('evicts the oldest edgeLabelWidth cache entry once EDGE_LABEL_WIDTH_CACHE_MAX distinct labels have been measured', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    const measure = (
      el as unknown as { edgeLabelWidth: (t: string) => number }
    ).edgeLabelWidth.bind(el);
    const cache = (
      el as unknown as { edgeLabelWidthCache: Map<string, number> }
    ).edgeLabelWidthCache;
    for (let i = 0; i < 513; i++) measure(`label-${i}`);
    expect(cache.size).to.equal(512);
    expect(cache.has('label-0')).to.be.false; // oldest evicted
    expect(cache.has('label-512')).to.be.true;
  });

  it('edgeLabelFontPx resolves px, rem, and em tokens against their live font sizes', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    const fontPx = (
      el as unknown as { edgeLabelFontPx: () => number }
    ).edgeLabelFontPx.bind(el);
    el.style.setProperty('--lr-font-size-2xs', '12px');
    expect(fontPx()).to.equal(12);
    const previousRootFontSize = document.documentElement.style.fontSize;
    const previousOwnFontSize = el.style.fontSize;
    try {
      document.documentElement.style.fontSize = '20px';
      el.style.setProperty('--lr-font-size-2xs', '0.5rem');
      expect(fontPx()).to.equal(10);
      el.style.fontSize = '24px';
      el.style.setProperty('--lr-font-size-2xs', '0.5em');
      expect(fontPx()).to.equal(12);
    } finally {
      document.documentElement.style.fontSize = previousRootFontSize;
      el.style.fontSize = previousOwnFontSize;
    }
    el.style.setProperty('--lr-font-size-2xs', 'not-a-number');
    expect(fontPx()).to.equal(10);
  });

  it('falls back to the default edge-label size for a unit with no resolvable pixel length, instead of measuring it as pixels', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    const fontPx = (
      el as unknown as { edgeLabelFontPx: () => number }
    ).edgeLabelFontPx.bind(el);
    // A number-plus-unrecognized-unit token must not collapse to its bare number, which would
    // measure and draw edge labels at 8px; the documented default applies instead.
    el.style.setProperty('--lr-font-size-2xs', '8pt');
    expect(fontPx()).to.equal(10);
    el.style.setProperty('--lr-font-size-2xs', '3ch');
    expect(fontPx()).to.equal(10);
  });

  it('resolves an em-unit token against the root font size when the own font-size cannot be parsed', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    const fontPx = (
      el as unknown as { edgeLabelFontPx: () => number }
    ).edgeLabelFontPx.bind(el);
    const originalGetComputedStyle = window.getComputedStyle;
    const previousRootFontSize = document.documentElement.style.fontSize;
    document.documentElement.style.fontSize = '32px';
    window.getComputedStyle = ((element: Element) => {
      if (element === el) {
        return {
          fontSize: '',
          getPropertyValue: (name: string) =>
            name === '--lr-font-size-2xs' ? '2em' : '',
        } as CSSStyleDeclaration;
      }
      return originalGetComputedStyle(element);
    }) as typeof window.getComputedStyle;
    try {
      // An element with no computed font-size of its own inherits the document root's, so an `em`
      // token tracks the live (non-default, 32px) root rather than an assumed 16px -- the shared
      // resolveCssLength() contract every unit-resolving component in the library now follows.
      expect(fontPx()).to.equal(64);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
      document.documentElement.style.fontSize = previousRootFontSize;
    }
  });

  it('graphItemText returns an empty string for an out-of-range index (past every node/link/hull)', async () => {
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
    const text = (
      el as unknown as { graphItemText: (i: number) => string }
    ).graphItemText(999);
    expect(text).to.equal('');
  });

  it('onGraphItemFocus/focusGraphItem no-op when graphItemCount() is 0 (every node hidden)', async () => {
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
    type Internals = {
      activeGraphItem: number;
      onGraphItemFocus: (i: number) => void;
      focusGraphItem: (i: number) => void;
      onGraphKeyDown: (
        e: KeyboardEvent,
        i: number,
        activate: (e: KeyboardEvent) => void
      ) => void;
    };
    (el as unknown as Internals).activeGraphItem = 5; // sentinel to detect "left unchanged"
    (el as unknown as Internals).onGraphItemFocus(0);
    expect((el as unknown as Internals).activeGraphItem).to.equal(5);
    (el as unknown as Internals).focusGraphItem(0);
    expect((el as unknown as Internals).activeGraphItem).to.equal(5);

    let fired = false;
    (el as unknown as Internals).onGraphKeyDown(
      new KeyboardEvent('keydown', { key: 'ArrowRight' }),
      0,
      () => (fired = true)
    );
    expect(fired).to.be.false;
  });

  it('an unhandled key on a node/link falls through onGraphKeyDown without moving the roving tab stop', async () => {
    const el = await graphSupport.mountGraphPair();
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    nodeEl.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true })
    );
    await el.updateComplete;
    expect(nodeEl.getAttribute('tabindex')).to.equal('0'); // unchanged -- no branch matched, so onGraphKeyDown just returns
  });

  it('updateEdgeLabelZoomGate no-ops when gEl is unset (canvas mode has no bound <g>)', async () => {
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
    expect(() =>
      (
        el as unknown as { updateEdgeLabelZoomGate: (k: number) => void }
      ).updateEdgeLabelZoomGate(5)
    ).to.not.throw();
  });

  it('graphItemText returns an empty string for a negative index (simNodes[-1] is undefined despite -1 < simNodes.length)', async () => {
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
    const text = (
      el as unknown as { graphItemText: (i: number) => string }
    ).graphItemText(-1);
    expect(text).to.equal('');
  });

  it('graphItemText returns an empty string for a fractional index landing past simNodes but short of simLinks.length', async () => {
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
    // simNodes.length === 2, simLinks.length === 1 -- index 2.5 skips the node branch (2.5 is not
    // < 2) but its linkIndex (0.5) is still < simLinks.length(1), so `this.simLinks[0.5]` (a
    // non-integer array index, always undefined) is what's actually exercised here.
    const text = (
      el as unknown as { graphItemText: (i: number) => string }
    ).graphItemText(2.5);
    expect(text).to.equal('');
  });

  it('onNodeClick emits a fallback (0,0) position for a node with no settled x/y yet', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    let detail: { nodeId: string; x: number; y: number } | undefined;
    el.addEventListener(
      'lr-node-activate',
      (e) => (detail = (e as CustomEvent).detail)
    );
    (el as unknown as { onNodeClick: (n: { id: string }) => void }).onNodeClick(
      { id: 'unsettled' }
    );
    expect(detail).to.deep.equal({ nodeId: 'unsettled', x: 0, y: 0 });
  });

  it('applyInteractions skips (re)binding a stale node element with no matching simNodes entry (data shrinking ahead of a re-render)', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
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

    type Internals = {
      simNodes: { id: string }[];
      boundNodeEls: WeakSet<Element>;
      applyInteractions: (changed: Map<string, unknown>) => void;
    };
    const internal = el as unknown as Internals;
    const fullSimNodes = internal.simNodes;
    // Reset first, the same way rebuildSimulation() itself does, then spy on `.add` to count the
    // visible shape + expanded hit geometry that actually get (re)bound.
    internal.boundNodeEls = new WeakSet();
    const originalAdd = internal.boundNodeEls.add.bind(internal.boundNodeEls);
    let addCalls = 0;
    internal.boundNodeEls.add = (value: Element) => {
      addCalls++;
      return originalAdd(value);
    };
    try {
      // The DOM still has 3 <circle> elements (this direct assignment bypasses Lit's own
      // re-render) while `simNodes` has been shrunk to 1 -- the exact "data shrinking below an
      // index" scenario applyInteractions()'s `if (!n) return;` guards against.
      internal.simNodes = fullSimNodes.slice(0, 1);
      internal.applyInteractions(new Map([['simNodes', fullSimNodes]]));
      expect(addCalls).to.equal(2);
    } finally {
      internal.simNodes = fullSimNodes;
      delete (internal.boundNodeEls as unknown as { add?: unknown }).add;
    }
  });

  it("rebuildSimulation defaults a neighbor-jitter spawn anchor's missing y to 0 (x is guarded by the search predicate, y is not)", async () => {
    const el = (await fixture(
      html`<lr-graph edge-distance="100"></lr-graph>`
    )) as LyraGraph;
    el.nodes = [{ id: 'existing', label: 'Existing' }];
    el.edges = [];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 1,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );

    // Corrupt the settled neighbor's y (keep x) -- the neighbor-jitter spawn path for a brand-new
    // linked node only guards `neighbor.x ?? 0` from a genuinely undefined x, which is structurally
    // impossible here (the search predicate that finds `neighbor` already requires `x != null`);
    // `neighbor.y` has no equivalent guarantee, so corrupting only y is the one way to exercise its
    // `?? 0` twin.
    const existing = el.simNodes.find((n) => n.id === 'existing')!;
    existing.y = undefined;

    el.nodes = [
      { id: 'existing', label: 'Existing' },
      { id: 'newbie', label: 'Newbie' },
    ];
    el.edges = [{ source: 'existing', target: 'newbie' }];
    await el.updateComplete;

    const newbie = el.simNodes.find((n) => n.id === 'newbie')!;
    expect(Number.isFinite(newbie.y)).to.be.true;
  });

  it("onTick/linkCoordinates/updateFocusHalo default a node's still-undefined x/y to 0 (seeded settle, then corrupted mid-flight state)", async () => {
    const el = (await fixture(
      html`<lr-graph seed="7" focus-node-id="a"></lr-graph>`
    )) as LyraGraph;
    el.nodeTypes = [{ id: 'sq', label: 'Square', shape: 'square' }];
    el.nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B', type: 'sq' },
    ];
    el.edges = [
      { source: 'a', target: 'b' },
      { source: 'a', target: 'ghost' }, // dangling -- "ghost" has no matching node
    ];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );

    // `seed` converges the settle synchronously and stops the simulation (see this file's own
    // "gates canvas redraw..." precedent comment) -- corrupting positions here is safe from a real
    // background tick racing in and overwriting them before the manual onTick() call below runs.
    const nodeA = el.simNodes.find((n) => n.id === 'a')!;
    const nodeB = el.simNodes.find((n) => n.id === 'b')!;
    nodeA.x = undefined;
    nodeA.y = undefined;
    nodeB.x = undefined;
    nodeB.y = undefined;
    (el as unknown as { onTick: () => void }).onTick();

    const circleA = el.shadowRoot!.querySelector(
      '[part="node"]'
    ) as SVGCircleElement;
    expect(circleA.getAttribute('cx')).to.equal('0');
    expect(circleA.getAttribute('cy')).to.equal('0');

    const nodeEls = Array.from(
      el.shadowRoot!.querySelectorAll('[part="node"]')
    );
    const pathB = nodeEls[1] as SVGPathElement; // shape="square" renders <path>, positioned via transform
    expect(pathB.getAttribute('transform')).to.equal('translate(0,0)');

    const labelA = el.shadowRoot!.querySelector(
      '[part="label"]'
    ) as SVGTextElement;
    const radiusA = (
      el as unknown as { nodeRadius: (n: unknown) => number }
    ).nodeRadius(nodeA);
    expect(labelA.getAttribute('x')).to.equal(String(radiusA + 2));
    expect(labelA.getAttribute('y')).to.equal('0');

    const realLink = el.shadowRoot!.querySelector(
      '[part="link"]:not([data-dangling])'
    ) as SVGLineElement;
    expect(realLink.getAttribute('x1')).to.equal('0');
    expect(realLink.getAttribute('y1')).to.equal('0');
    expect(realLink.getAttribute('x2')).to.equal('0');
    expect(realLink.getAttribute('y2')).to.equal('0');

    const danglingLine = el.shadowRoot!.querySelector(
      '[part="link"][data-dangling]'
    ) as SVGLineElement;
    expect(danglingLine.getAttribute('x1')).to.equal('0');
    expect(danglingLine.getAttribute('y1')).to.equal('0');
    expect(danglingLine.getAttribute('x2')).to.equal('14'); // source.x??0 (0) + STUB_OFFSET_PX (14)
    expect(danglingLine.getAttribute('y2')).to.equal('14');

    const halo = el.shadowRoot!.querySelector(
      '[part="focus-halo"]'
    ) as SVGCircleElement;
    expect(halo.getAttribute('cx')).to.equal('0');
    expect(halo.getAttribute('cy')).to.equal('0');
  });
});
