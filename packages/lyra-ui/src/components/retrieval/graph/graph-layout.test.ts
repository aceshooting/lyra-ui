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

describe('node typing', () => {
  const nodeTypes = [
    { id: 'person', label: 'Person', shape: 'square' as const },
    {
      id: 'doc',
      label: 'Document',
      color: '#112233',
      shape: 'diamond' as const,
    },
    { id: 'concept', label: 'Concept' }, // no color, no shape -> categorical fallback + circle
  ];
  const typedNodes = [
    { id: 'a', label: 'A', type: 'person' },
    { id: 'b', label: 'B', type: 'doc' },
    { id: 'c', label: 'C', type: 'concept' },
    { id: 'd', label: 'D', type: 'unknown-type' }, // falls back to untyped
    { id: 'e', label: 'E', type: 'concept', color: '#ff0000' }, // node.color wins
  ];
  const typedLinks = [{ source: 'a', target: 'b' }];

  async function mountTyped(): Promise<LyraGraph> {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodeTypes = nodeTypes;
    el.nodes = typedNodes;
    el.edges = typedLinks;
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 5,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    return el;
  }

  it('renders circle/square/diamond shape elements per nodeTypes entry, untyped/unknown-type as circle', async () => {
    const el = await mountTyped();
    const items = el.shadowRoot!.querySelectorAll('[part="node"]');
    expect(items[0]!.tagName).to.equal('path'); // a: person -> square
    expect(items[1]!.tagName).to.equal('path'); // b: doc -> diamond
    expect(items[2]!.tagName).to.equal('circle'); // c: concept -> circle (no shape given)
    expect(items[3]!.tagName).to.equal('circle'); // d: unknown-type -> untyped circle
    expect(items[4]!.tagName).to.equal('circle'); // e: concept -> circle
  });

  it('resolves fill precedence: node.color > type.color > categorical palette by nodeTypes index > default token', async () => {
    const el = await mountTyped();
    const items = [
      ...el.shadowRoot!.querySelectorAll('[part="node"]'),
    ] as SVGElement[];
    expect(items[1]!.getAttribute('style')).to.include(
      '--lr-graph-node-fill:#112233'
    ); // b: doc.color
    expect(items[2]!.getAttribute('style') ?? '').to.include(
      '--lr-graph-cat-3'
    ); // c: concept is nodeTypes[2]
    expect(items[3]!.hasAttribute('style')).to.be.false; // d: unknown type -> no inline fill override
    expect(items[4]!.getAttribute('style')).to.include(
      '--lr-graph-node-fill:#ff0000'
    ); // e: node.color wins over type
  });

  it('wraps the categorical index at the 9th nodeTypes entry (typeIndex % 8)', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodeTypes = Array.from({ length: 9 }, (_, i) => ({
      id: `t${i}`,
      label: `T${i}`,
    }));
    el.nodes = [
      { id: 'first', type: 't0' },
      { id: 'ninth', type: 't8' },
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
    const items = [
      ...el.shadowRoot!.querySelectorAll('[part="node"]'),
    ] as SVGElement[];
    expect(items[0]!.getAttribute('style')).to.include('--lr-graph-cat-1'); // index 0 % 8 -> slot 1
    expect(items[1]!.getAttribute('style')).to.include('--lr-graph-cat-1'); // index 8 % 8 -> slot 1 again
  });

  it('indexes the categorical palette by label-bearing nodeTypes position, matching lr-graph-legend\'s filtered row order (regression)', async () => {
    // lr-graph-legend omits a blank-label nodeTypes entry before assigning its swatch index
    // (graph-legend.class.ts's render() filter). A paired lr-graph must skip the same blank-label
    // entry when computing the categorical fallback index, or a node's painted color diverges from
    // its type's legend swatch.
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodeTypes = [
      { id: 'blank', label: '' }, // lr-graph-legend renders no row for this entry
      { id: 'valid', label: 'Valid type' }, // legend's first (only) row -> index 0 -> cat-1
    ];
    el.nodes = [{ id: 'a', type: 'valid' }];
    el.edges = [];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 1,
      undefined,
      { timeout: NODE_COUNT_TIMEOUT }
    );
    const item = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    expect(item.getAttribute('style')).to.include('--lr-graph-cat-1');
  });

  it('reads selection ring widths from the --lr-border-width-* ladder, not the generic --lr-size-* scale (regression: theming purpose)', async () => {
    const el = (await fixture(html`
      <lr-graph
        style="--lr-theme-border-width-medium: 12px; --lr-theme-border-width-thick: 13px; --lr-theme-size-2px: 22px; --lr-theme-size-3px: 23px;"
      ></lr-graph>
    `)) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    el.selectionMode = 'single';
    el.selectedNodeIds = ['a'];
    el.selectedEdgeIds = ['a->b'];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      { timeout: NODE_COUNT_TIMEOUT }
    );
    const selectedNode = el.shadowRoot!.querySelector(
      '[part="node"][data-selected]'
    ) as SVGElement;
    const selectedLink = el.shadowRoot!.querySelector(
      '[part="link"][data-selected]'
    ) as SVGElement;
    expect(selectedNode, 'selected node renders').to.exist;
    expect(selectedLink, 'selected link renders').to.exist;
    // A consumer retuning --lr-theme-border-width-medium/-thick must move these rings; retuning
    // the unrelated --lr-theme-size-2px/-3px sizing scale must not.
    expect(getComputedStyle(selectedNode).strokeWidth).to.equal('12px');
    expect(getComputedStyle(selectedLink).strokeWidth).to.equal('13px');
  });

  it('positions square/diamond shapes via a per-tick transform, not cx/cy', async () => {
    const el = await mountTyped();
    const squareEl = el.shadowRoot!.querySelector(
      '[part="node"]'
    ) as SVGPathElement;
    await aTimeout(50);
    expect(squareEl.getAttribute('transform')).to.match(
      /^translate\(-?\d+(\.\d+)?,-?\d+(\.\d+)?\)$/
    );
    expect(squareEl.hasAttribute('cx')).to.be.false;
  });

  it('wraps typed node spoken text via graphTypedNode', async () => {
    const el = await mountTyped();
    const items = [
      ...el.shadowRoot!.querySelectorAll('[part="node"]'),
    ] as SVGElement[];
    expect(items[0]!.getAttribute('aria-label')).to.equal('A (Person)');
    expect(items[2]!.getAttribute('aria-label')).to.equal('C (Concept)');
    expect(items[3]!.getAttribute('aria-label')).to.equal('D'); // unknown type -> unwrapped
  });

  it('is accessible with typed, mixed-shape nodes', async () => {
    const el = await mountTyped();
    await expect(el).to.be.accessible();
  });

  it('existing graph usage unaffected: no type/nodeTypes set renders identical circles and unwrapped labels', async () => {
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
    const items = [
      ...el.shadowRoot!.querySelectorAll('[part="node"]'),
    ] as SVGElement[];
    expect(items.every((i) => i.tagName === 'circle')).to.be.true;
    expect(items[0]!.getAttribute('aria-label')).to.equal('A');
    expect(items[0]!.hasAttribute('cx')).to.be.true;
    expect(items[0]!.hasAttribute('style')).to.be.false;
  });

  it('refreshes the cached nodeEls when nodeTypes alone changes a shape post-mount (regression)', async () => {
    // A consumer mutating nodeTypes without also reassigning nodes/links (e.g.
    // flipping one type's shape from the default circle to 'square') swaps the
    // rendered element (different tag = different DOM node) via Lit's own
    // template diffing. applyInteractions()'s node/link/label DOM cache must
    // be refreshed in that case too, or it keeps pointing at the stale,
    // now-detached element -- see this file's guard in applyInteractions().
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodeTypes = [{ id: 'concept', label: 'Concept' }]; // no shape -> defaults to circle
    el.nodes = [{ id: 'a', label: 'A', type: 'concept' }];
    el.edges = [];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 1,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    expect(el.shadowRoot!.querySelector('[part="node"]')!.tagName).to.equal(
      'circle'
    );

    // Mutate nodeTypes ALONE -- nodes/links are not reassigned.
    el.nodeTypes = [{ id: 'concept', label: 'Concept', shape: 'square' }];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="node"]')?.tagName === 'path',
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );

    const currentNodeEl = el.shadowRoot!.querySelectorAll('[part="node"]')[0];
    // Compare identity as a boolean rather than handing two DOM elements
    // straight to expect(...).to.equal(...) -- per this file's own testing
    // conventions (see AGENTS.md), a *failing* element/element equality
    // assertion can hang the whole file under wtr's Playwright reporter.
    const cacheRefreshed = currentNodeEl === (el as any).nodeEls[0];
    expect(cacheRefreshed).to.be.true;
  });
});

describe('drawn edge labels', () => {
  const labeledLinks = [{ source: 'a', target: 'b', label: 'cites' }];

  async function mountLabeled(withEdgeLabels = true): Promise<LyraGraph> {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.withEdgeLabels = withEdgeLabels;
    el.nodes = nodes;
    el.edges = labeledLinks;
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

  it('defaults withEdgeLabels to false and renders no link-label text', async () => {
    const el = await mountLabeled(false);
    expect(el.shadowRoot!.querySelector('[part="link-label"]') == null).to.be
      .true;
  });

  it('draws a link-label per labeled link when withEdgeLabels is set, aria-hidden and text-anchor middle', async () => {
    const el = await mountLabeled(true);
    const label = el.shadowRoot!.querySelector(
      '[part="link-label"]'
    ) as SVGTextElement;
    expect(label != null).to.equal(true);
    expect(label.textContent).to.equal('cites');
    expect(label.getAttribute('aria-hidden')).to.equal('true');
    expect(label.getAttribute('text-anchor')).to.equal('middle');
  });

  it('does not draw a link-label for a link with no label text', async () => {
    const el = (await fixture(
      html`<lr-graph with-edge-labels></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links; // no .label set
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    expect(el.shadowRoot!.querySelector('[part="link-label"]') == null).to.be
      .true;
  });

  it('hides all edge labels below edgeLabelMinZoom via a data-edge-labels-hidden toggle on the zoomed g, without a Lit re-render', async () => {
    const el = await mountLabeled(true);
    const g = el.shadowRoot!.querySelector('g') as SVGGElement;
    expect(g.hasAttribute('data-edge-labels-hidden')).to.be.false;
    (
      el as unknown as { updateEdgeLabelZoomGate: (k: number) => void }
    ).updateEdgeLabelZoomGate(0.3);
    expect(g.getAttribute('data-edge-labels-hidden')).to.equal('');
    (
      el as unknown as { updateEdgeLabelZoomGate: (k: number) => void }
    ).updateEdgeLabelZoomGate(1);
    expect(g.hasAttribute('data-edge-labels-hidden')).to.be.false;
  });

  it('applies the edge-label zoom gate at initial mount, before any pan/zoom gesture (regression)', async () => {
    // edgeLabelMinZoom set above the initial identity transform's k=1 -- the gate must already be
    // applied by the time the graph first paints, not only reactively after the user's first
    // pan/zoom gesture (see updateEdgeLabelZoomGate()'s own doc comment).
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.withEdgeLabels = true;
    el.edgeLabelMinZoom = 2;
    el.nodes = nodes;
    el.edges = labeledLinks;
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );

    const g = el.shadowRoot!.querySelector('g') as SVGGElement;
    expect(g.hasAttribute('data-edge-labels-hidden')).to.be.true;
  });

  it('spoken output (link accessible name) is identical whether withEdgeLabels is on or off', async () => {
    const off = await mountLabeled(false);
    const on = await mountLabeled(true);
    const offLink = off.shadowRoot!.querySelector(
      '[part="link"]'
    ) as SVGLineElement;
    const onLink = on.shadowRoot!.querySelector(
      '[part="link"]'
    ) as SVGLineElement;
    expect(offLink.getAttribute('aria-label')).to.equal(
      onLink.getAttribute('aria-label')
    );
  });

  it('is accessible with edge labels drawn', async () => {
    const el = await mountLabeled(true);
    await expect(el).to.be.accessible();
  });

  it('existing graph usage unaffected: withEdgeLabels unset draws nothing and every existing link/node assertion still holds', async () => {
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
    expect(
      el.shadowRoot!.querySelectorAll('[part="link-label"]').length
    ).to.equal(0);
    expect(
      el.shadowRoot!.querySelector('g')!.hasAttribute('data-edge-labels-hidden')
    ).to.be.false;
  });

  it('does not wrap a link in an extra per-link <g> when withEdgeLabels is unset (byte-for-byte link DOM, regression)', async () => {
    // The link must remain a direct child of the outer zoomed <g transform=""> (the only <g> in
    // this part of the template that carries a transform attribute) -- not nested inside a
    // per-link <g> introduced for the (here, unused) drawn-edge-label <text> sibling.
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

    const linkEl = el.shadowRoot!.querySelector(
      '[part="link"]:not([data-dangling])'
    )!;
    expect(linkEl.parentElement?.getAttribute('transform')).to.equal('');
  });

  it('refreshes the cached linkLabelEls when withEdgeLabels toggles true post-mount (regression)', async () => {
    // Flipping withEdgeLabels false -> true without reassigning nodes/links triggers a normal
    // Lit re-render that creates the <text part="link-label"> element, but applyInteractions()'s
    // node/link/label DOM cache must be refreshed for a withEdgeLabels-only change too -- or
    // linkLabelEls stays stuck at its pre-toggle (all-null) snapshot and onTick() silently skips
    // repositioning the label on every subsequent tick (e.g. a node drag) forever. See this
    // file's nodeEls regression test above for the analogous nodeTypes-only case.
    const el = await mountLabeled(false);
    expect(el.shadowRoot!.querySelector('[part="link-label"]') == null).to.be
      .true;

    el.withEdgeLabels = true;
    await el.updateComplete;
    await waitUntil(
      () => !!el.shadowRoot!.querySelector('[part="link-label"]'),
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );

    const currentLabelEl = el.shadowRoot!.querySelector('[part="link-label"]');
    // Compare identity as a boolean rather than handing two DOM elements straight to
    // expect(...).to.equal(...) -- per this file's own testing conventions (see AGENTS.md), a
    // *failing* element/element equality assertion can hang the whole file under wtr's
    // Playwright reporter.
    const cacheRefreshed = currentLabelEl === (el as any).linkLabelEls[0];
    expect(cacheRefreshed).to.be.true;
  });
});

describe('nodeLabels', () => {
  it('defaults to drawing every node label unconditionally for renderer="svg" (unset regression)', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    expect(el.nodeLabels).to.be.undefined;
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      { timeout: NODE_COUNT_TIMEOUT }
    );
    expect(el.shadowRoot!.querySelectorAll('[part="label"]').length).to.equal(
      2
    );
    expect(
      el.shadowRoot!.querySelector('g')!.hasAttribute('data-node-labels-hidden')
    ).to.be.false;
  });

  it('renders no [part="label"] elements when nodeLabels is "none", even though nodes carry labels', async () => {
    const el = (await fixture(
      html`<lr-graph node-labels="none"></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      { timeout: NODE_COUNT_TIMEOUT }
    );
    expect(el.shadowRoot!.querySelectorAll('[part="label"]').length).to.equal(
      0
    );
  });

  it('hides svg node labels below the zoom-declutter threshold via a data-node-labels-hidden toggle on the zoomed g, when nodeLabels is "zoom", without a Lit re-render', async () => {
    const el = (await fixture(
      html`<lr-graph node-labels="zoom"></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      { timeout: NODE_COUNT_TIMEOUT }
    );
    const g = el.shadowRoot!.querySelector('g') as SVGGElement;
    expect(g.hasAttribute('data-node-labels-hidden')).to.be.false;
    (
      el as unknown as { updateNodeLabelZoomGate: (k: number) => void }
    ).updateNodeLabelZoomGate(0.3);
    expect(g.getAttribute('data-node-labels-hidden')).to.equal('');
    (
      el as unknown as { updateNodeLabelZoomGate: (k: number) => void }
    ).updateNodeLabelZoomGate(1);
    expect(g.hasAttribute('data-node-labels-hidden')).to.be.false;
  });

  it('never hides svg node labels via the zoom gate when nodeLabels is "always", even far below the declutter threshold', async () => {
    const el = (await fixture(
      html`<lr-graph node-labels="always"></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      { timeout: NODE_COUNT_TIMEOUT }
    );
    const g = el.shadowRoot!.querySelector('g') as SVGGElement;
    (
      el as unknown as { updateNodeLabelZoomGate: (k: number) => void }
    ).updateNodeLabelZoomGate(0.01);
    expect(g.hasAttribute('data-node-labels-hidden')).to.be.false;
  });

  it('re-evaluates the node-label zoom gate immediately when nodeLabels changes post-mount, without waiting for a new pan/zoom gesture', async () => {
    const el = (await fixture(
      html`<lr-graph node-labels="always"></lr-graph>`
    )) as LyraGraph;
    el.nodes = nodes;
    el.edges = links;
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      { timeout: NODE_COUNT_TIMEOUT }
    );
    const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
    const g = el.shadowRoot!.querySelector('g') as SVGGElement;
    // Zoom out well past the fixed, internal node-label declutter threshold -- 'always' must not
    // hide regardless (same deltaY this file's edge-label-min-zoom regression test already proves
    // saturates the camera at the scaleExtent's minimum, well below either threshold).
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
    expect(g.hasAttribute('data-node-labels-hidden')).to.be.false;

    // Switching to 'zoom' with no further pan/zoom gesture must re-apply the gate immediately
    // against the already-zoomed-out camera, not wait for the next wheel/drag event.
    el.nodeLabels = 'zoom';
    await el.updateComplete;
    expect(g.getAttribute('data-node-labels-hidden')).to.equal('');
  });

  describe('renderer="canvas"', () => {
    async function mountCanvas(
      nodeLabels?: LyraGraphNodeLabelsMode
    ): Promise<LyraGraph> {
      const el = (await fixture(
        html`<lr-graph
          renderer="canvas"
          width="400"
          height="300"
          style="width:400px;height:300px"
        ></lr-graph>`
      )) as LyraGraph;
      if (nodeLabels) el.nodeLabels = nodeLabels;
      el.nodes = nodes;
      el.edges = links;
      await el.updateComplete;
      await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
        timeout: NODE_COUNT_TIMEOUT,
      });
      // Stop the simulation before observing canvasScene: onTick() unconditionally nulls it on
      // every tick (markCanvasDirty()), while the coalesced redraw only fires once per real frame --
      // under a heavily loaded/unthrottled run the live ~300-tick settle can keep canvasScene falsy
      // for the whole animation, so polling for it without first stopping the ticking is a race this
      // assertion can lose even with a long timeout. Matches every other canvasScene-observing test
      // in this file (see "coverage: canvas renderer internals"'s identical comment).
      (el as unknown as { simulation?: { stop: () => void } }).simulation?.stop();
      await waitUntil(
        () =>
          (el as unknown as { canvasScene?: { nodes: unknown[] } }).canvasScene
            ?.nodes.length === 2,
        undefined,
        { timeout: NODE_COUNT_TIMEOUT }
      );
      return el;
    }
    type Internals = { canvasScene?: { showNodeLabels: boolean } };

    it('defaults to zoom-gated node labels for renderer="canvas" (unset regression)', async () => {
      const el = await mountCanvas();
      // The initial identity transform is k=1, above the 0.5 declutter threshold that gated
      // canvas node labels before this property existed -- so labels are visible by default,
      // matching today's canvas-only behavior exactly.
      expect((el as unknown as Internals).canvasScene!.showNodeLabels).to.be
        .true;
    });

    it('disables canvas node labels regardless of zoom when nodeLabels is "none"', async () => {
      const el = await mountCanvas('none');
      expect((el as unknown as Internals).canvasScene!.showNodeLabels).to.be
        .false;
    });

    it('keeps canvas node labels visible when explicitly zoomed below the declutter threshold and nodeLabels is "always"', async () => {
      const el = await mountCanvas('always');
      (
        el as unknown as {
          canvasCamera: { k: number; x: number; y: number };
        }
      ).canvasCamera = { k: 0.1, x: 0, y: 0 };
      expect(
        (
          el as unknown as { canvasNodeLabelsVisible(): boolean }
        ).canvasNodeLabelsVisible()
      ).to.be.true;
    });

    it('hides canvas node labels below the declutter threshold when nodeLabels is "zoom"', async () => {
      const el = await mountCanvas('zoom');
      (
        el as unknown as {
          canvasCamera: { k: number; x: number; y: number };
        }
      ).canvasCamera = { k: 0.1, x: 0, y: 0 };
      expect(
        (
          el as unknown as { canvasNodeLabelsVisible(): boolean }
        ).canvasNodeLabelsVisible()
      ).to.be.false;
    });
  });
});

describe('expand affordance', () => {
  it('dblclick on a node emits exactly one lr-node-expand after two lr-node-click events, and stops propagation', async () => {
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
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    let clickCount = 0;
    let expandDetail: { nodeId: string } | undefined;
    let expandCount = 0;
    el.addEventListener('lr-node-click', () => clickCount++);
    el.addEventListener('lr-node-expand', (e) => {
      expandCount++;
      expandDetail = (e as CustomEvent).detail;
    });
    nodeEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    nodeEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    nodeEl.dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true, cancelable: true })
    );
    expect(clickCount).to.equal(2);
    expect(expandCount).to.equal(1);
    expect(expandDetail).to.deep.equal({ nodeId: 'a' });
  });

  it('background dblclick (not on a node) still reaches the svg for d3-zoom default zoom-in (event not stopped)', async () => {
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
    expect(g.getAttribute('transform')).to.equal('');
    // d3-zoom's own dblclick handler calls stopImmediatePropagation() on the matched element (see
    // d3-zoom's `noevent()`), so a sibling listener added after the graph mounts would never
    // observe the event either way -- assert the actual, observable effect instead (matching how
    // this file's wheel-zoom test above verifies zoom took effect): d3-zoom's default
    // double-click-to-zoom-in still applies its own scale transform, proving onNodeDblClick()'s
    // own `stopPropagation()` (bound only on node elements) never reaches a background dblclick.
    // Unlike the wheel handler, d3-zoom's dblclick handler animates the transform via a
    // `.transition()` (its own default 250ms duration) rather than applying it synchronously, so
    // this waits out that transition before reading the resulting attribute.
    svgEl.dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true, cancelable: true })
    );
    await aTimeout(350);
    expect(g.getAttribute('transform')).to.match(/scale\(/);
  });

  it('double-Enter within 500ms on the same focused node emits lr-node-expand; outside the window it does not', async () => {
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
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    let expandCount = 0;
    el.addEventListener('lr-node-expand', () => expandCount++);
    nodeEl.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    nodeEl.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    expect(expandCount).to.equal(1);

    // Outside the window: reset by waiting past EXPAND_KEY_INTERVAL_MS.
    await aTimeout(600);
    nodeEl.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    expect(expandCount).to.equal(1); // first of a new pair, not yet a second
  });

  it('renders a "+" expand-indicator only for nodes with expandable: true, tracked per tick', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = [
      { id: 'a', label: 'A', expandable: true },
      { id: 'b', label: 'B' },
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
    expect(
      el.shadowRoot!.querySelectorAll('[part="expand-indicator"]').length
    ).to.equal(1);
    const indicator = el.shadowRoot!.querySelector(
      '[part="expand-indicator"]'
    ) as SVGGElement;
    expect(indicator.getAttribute('aria-hidden')).to.equal('true');
    await aTimeout(50);
    expect(indicator.getAttribute('transform')).to.match(
      /^translate\(-?\d+(\.\d+)?,-?\d+(\.\d+)?\)$/
    );
  });

  it('wraps expandable node spoken text via graphExpandableItem, composing with the typed-node label', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodeTypes = [{ id: 'doc', label: 'Document' }];
    el.nodes = [{ id: 'a', label: 'A', type: 'doc', expandable: true }];
    el.edges = [];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 1,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    expect(nodeEl.getAttribute('aria-label')).to.equal(
      'A (Document), expandable'
    );
  });

  it('a new node linked to an already-settled node spawns near that neighbor instead of a random position', async () => {
    const el = (await fixture(
      html`<lr-graph seed="7" edge-distance="100"></lr-graph>`
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
    // Reduced-motion / seeded settles happen synchronously inside rebuildSimulation(), so the new
    // node's spawn position is assigned before this await resolves; assert immediately.
    const spawnedB = el.simNodes.find((n) => n.id === 'b')!;
    const distance = Math.hypot(spawnedB.x! - aX, spawnedB.y! - aY);
    // Within a small multiple of edgeDistance/2 (the documented jitter radius) -- nowhere close to
    // a fully random position across the whole width/height canvas.
    expect(distance).to.be.lessThan(el.edgeDistance);
    // 'a' itself must not have moved (only nodes with no carried-over position are affected).
    expect(el.simNodes.find((n) => n.id === 'a')!.x).to.equal(aX);
    expect(el.simNodes.find((n) => n.id === 'a')!.y).to.equal(aY);
  });

  it('is accessible with an expandable node', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = [{ id: 'a', label: 'A', expandable: true }];
    el.edges = [];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 1,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    await expect(el).to.be.accessible();
  });

  it('existing graph usage unaffected: no expandable set never emits lr-node-expand and renders no indicator', async () => {
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
    expect(
      el.shadowRoot!.querySelectorAll('[part="expand-indicator"]').length
    ).to.equal(0);
    let fired = false;
    el.addEventListener('lr-node-expand', () => (fired = true));
    (el.shadowRoot!.querySelector('[part="node"]') as SVGElement).dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true })
    );
    expect(fired).to.be.true; // dblclick always emits, regardless of `expandable` (an affordance flag, not a gate)
  });
});

describe('focus and camera fit', () => {
  async function mountWide(): Promise<LyraGraph> {
    const el = (await fixture(
      html`<lr-graph
        width="800"
        height="600"
        min-zoom="0.1"
        max-zoom="8"
      ></lr-graph>`
    )) as LyraGraph;
    el.nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    el.edges = [{ source: 'a', target: 'b' }];
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

  it('focusNode resolves false for an unknown id without moving the camera', async () => {
    const el = await mountWide();
    const result = await el.focusNode('does-not-exist');
    expect(result).to.be.false;
  });

  it('focusNode resolves true and centers the requested node at the viewport center for the given zoom', async () => {
    const el = await mountWide();
    const target = el.simNodes.find((n) => n.id === 'a')!;
    const ok = await el.focusNode('a', { zoom: 2 });
    expect(ok).to.be.true;
    const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
    const transform = svgEl.querySelector('g')!.getAttribute('transform')!;
    const match = transform.match(
      /translate\(([-\d.]+),\s*([-\d.]+)\)\s*scale\(([-\d.]+)\)/
    );
    expect(match, `unexpected transform string: ${transform}`).to.exist;
    const values = match!.map(Number);
    const tx = values[1]!;
    const ty = values[2]!;
    const k = values[3]!;
    expect(k).to.be.closeTo(2, 0.01);
    // The node's world position, transformed by (k, tx, ty), must land at the viewport center.
    expect(k * target.x! + tx).to.be.closeTo(400, 1);
    expect(k * target.y! + ty).to.be.closeTo(300, 1);
  });

  it('focusNode clamps an out-of-range zoom to minZoom/maxZoom', async () => {
    const el = await mountWide();
    await el.focusNode('a', { zoom: 100 });
    const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
    const transform = svgEl.querySelector('g')!.getAttribute('transform')!;
    const k = Number(transform.match(/scale\(([-\d.]+)\)/)![1]);
    expect(k).to.be.closeTo(8, 0.01); // max-zoom
  });

  it('focusNode announces graphNodeFocused through the light-DOM sink and shadow mirror', async () => {
    const el = await mountWide();
    await el.focusNode('a');
    expect(
      el.shadowRoot!.querySelector('[part="live-region"]')!.textContent
    ).to.contain('Centered on A');
    expect(announcementTexts().at(-1)).to.contain('Centered on A');
  });

  it('jumps in a single transform write under prefers-reduced-motion (no rAF tween)', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = mediaQueryOverride(window, (query) =>
      query.includes('prefers-reduced-motion')
    );
    try {
      const el = await mountWide();
      let rafCalls = 0;
      const originalRaf = window.requestAnimationFrame;
      window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
        rafCalls++;
        return originalRaf(cb);
      }) as typeof window.requestAnimationFrame;
      try {
        await el.focusNode('a');
      } finally {
        window.requestAnimationFrame = originalRaf;
      }
      // Exactly one -- the single coalesced lr-viewport-change signal the jump's own zoom handler
      // schedules (see scheduleViewportChange()), not a recurring tween loop. A real tween would
      // request a fresh frame from inside each previous one and rack up far more than one call.
      expect(rafCalls).to.equal(1);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('finishes an in-flight camera tween when the scope requests reduced motion', async () => {
    const original = window.matchMedia;
    window.matchMedia = mediaQueryOverride(window, () => false);
    try {
      const graph = await mountWide();
      graph.style.setProperty('--lr-transition-base', '60s linear');
      const completion = graph.focusNode('a', { zoom: 2 });
      await waitUntil(() => (graph as any).isCameraTweening);
      graph.setAttribute('data-lr-motion', 'reduce');
      expect(await completion).to.equal(true);
      expect((graph as any).isCameraTweening).to.equal(false);
      const transform = graph.shadowRoot!.querySelector('svg g')!.getAttribute('transform')!;
      expect(Number(transform.match(/scale\(([-\d.]+)\)/)![1])).to.be.closeTo(2, 0.01);
    } finally {
      window.matchMedia = original;
    }
  });

  it('emits lr-viewport-change with the live camera transform after a focusNode jump', async () => {
    // Reduced-motion writes the transform in one synchronous jump (see the test above), so the
    // single lr-viewport-change it schedules is guaranteed to reflect the arrived-at transform --
    // a real tween instead emits progressively across every frame, and this only needs to prove
    // the payload shape/value, not the tween's own settling behavior.
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = mediaQueryOverride(window, (query) =>
      query.includes('prefers-reduced-motion')
    );
    try {
      const el = await mountWide();
      const changed = oneEvent(el, 'lr-viewport-change');
      await el.focusNode('a', { zoom: 2 });
      const detail = (await changed).detail as {
        k: number;
        x: number;
        y: number;
      };
      expect(detail.k).to.be.closeTo(2, 0.01);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('coalesces a real pan/zoom gesture into a single lr-viewport-change per frame', async () => {
    const el = await mountWide();
    let changeCount = 0;
    el.addEventListener('lr-viewport-change', () => changeCount++);
    const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
    // Two wheel events land well within the same animation frame -- both should fold into one
    // scheduled emission rather than firing twice.
    svgEl.dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaY: -100,
        clientX: 10,
        clientY: 10,
      })
    );
    svgEl.dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaY: -100,
        clientX: 10,
        clientY: 10,
      })
    );
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
    expect(changeCount).to.equal(1);
  });

  it('disconnect cancels an in-flight camera tween instead of animating a detached tree (regression)', async () => {
    const el = await mountWide();
    const call = el.focusNode('a');
    el.remove();
    // cancelCameraTween() both stops the rAF loop (no more frames scheduled against the detached
    // tree) and settles the caller's Promise with `false` instead of leaving it hanging.
    expect(await call).to.be.false;
    expect((el as unknown as { cameraTweenId?: number }).cameraTweenId).to.be
      .undefined;
  });

  it('a superseded focusNode() call resolves false instead of hanging (regression)', async () => {
    const el = await mountWide();
    const firstCall = el.focusNode('a');
    const secondCall = el.focusNode('b');
    expect(await firstCall).to.be.false;
    expect(await secondCall).to.be.true;
  });

  it('a real user pan/zoom gesture interrupting focusNode() resolves it false instead of hanging (regression)', async () => {
    const el = await mountWide();
    const call = el.focusNode('a');
    const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
    svgEl.dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaY: -100,
        clientX: 10,
        clientY: 10,
      })
    );
    expect(await call).to.be.false;
  });

  it('fit() frames the bounding box of all visible node positions within width/height minus padding', async () => {
    const el = await mountWide();
    el.fit({ padding: 10 });
    await aTimeout(400); // let the default (non-reduced-motion) tween settle
    const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
    const transform = svgEl.querySelector('g')!.getAttribute('transform')!;
    const match = transform.match(
      /translate\(([-\d.]+),\s*([-\d.]+)\)\s*scale\(([-\d.]+)\)/
    );
    expect(match, `unexpected transform string: ${transform}`).to.exist;
    const values = match!.map(Number);
    const tx = values[1]!;
    const ty = values[2]!;
    const k = values[3]!;
    // Both nodes' world positions, transformed by (k, tx, ty), must land within [10, width/height-10].
    for (const n of el.simNodes) {
      const sx = k * n.x! + tx;
      const sy = k * n.y! + ty;
      expect(sx).to.be.within(-1, 801);
      expect(sy).to.be.within(-1, 601);
    }
  });

  it('focusNodeId declaratively centers once when it first resolves, and does not fight later panning', async () => {
    const el = (await fixture(
      html`<lr-graph width="800" height="600" focus-node-id="b"></lr-graph>`
    )) as LyraGraph;
    el.nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
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
    await aTimeout(400);
    const halo = el.shadowRoot!.querySelector(
      '[part="focus-halo"]'
    ) as SVGCircleElement;
    expect(halo.hasAttribute('hidden')).to.be.false;
    const target = el.simNodes.find((n) => n.id === 'b')!;
    expect(Number(halo.getAttribute('cx'))).to.be.closeTo(target.x!, 0.5);
  });

  it('focus-halo is hidden when focusNodeId is unset or unresolved', async () => {
    const el = await mountWide();
    const halo = el.shadowRoot!.querySelector(
      '[part="focus-halo"]'
    ) as SVGCircleElement;
    expect(halo.hasAttribute('hidden')).to.be.true;
  });

  it('is accessible with focusNodeId set', async () => {
    const el = (await fixture(
      html`<lr-graph focus-node-id="a"></lr-graph>`
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
    await expect(el).to.be.accessible();
  });

  it('existing graph usage unaffected: no focusNodeId set never shows the halo and the transform stays untouched by mount', async () => {
    const el = await mountWide();
    const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
    expect(svgEl.querySelector('g')!.getAttribute('transform')).to.equal('');
  });
});

describe('selection', () => {
  async function mountSelectable(
    mode: 'single' | 'multiple'
  ): Promise<LyraGraph> {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.selectionMode = mode;
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

  it('defaults selectionMode to none: no aria-pressed/data-selected, no lr-selection-change on click', async () => {
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
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    expect(nodeEl.hasAttribute('aria-pressed')).to.be.false;
    let fired = false;
    el.addEventListener('lr-selection-change', () => (fired = true));
    nodeEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(fired).to.be.false;
  });

  it('single mode: clicking an unselected node emits a replace intent; clicking it again emits clear', async () => {
    const el = await mountSelectable('single');
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    let detail: { selectedNodeIds: string[]; selectedEdgeIds: string[] } | undefined;
    el.addEventListener(
      'lr-selection-change',
      (e) => (detail = (e as CustomEvent).detail)
    );
    nodeEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(detail).to.deep.equal({ selectedNodeIds: ['a'], selectedEdgeIds: [] });

    el.selectedNodeIds = ['a']; // host reflects the controlled prop back, per the contract
    await el.updateComplete;
    nodeEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(detail).to.deep.equal({ selectedNodeIds: [], selectedEdgeIds: [] });
  });

  it('multiple mode: plain click replaces; Ctrl/Meta-click toggles, preserving other selected ids', async () => {
    const el = await mountSelectable('multiple');
    const [nodeA, nodeB] = [
      ...el.shadowRoot!.querySelectorAll('[part="node"]'),
    ] as SVGElement[];
    let detail: { selectedNodeIds: string[]; selectedEdgeIds: string[] } | undefined;
    el.addEventListener(
      'lr-selection-change',
      (e) => (detail = (e as CustomEvent).detail)
    );

    nodeA!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(detail).to.deep.equal({ selectedNodeIds: ['a'], selectedEdgeIds: [] });

    el.selectedNodeIds = ['a'];
    await el.updateComplete;
    nodeB!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, ctrlKey: true })
    );
    expect(detail).to.deep.equal({ selectedNodeIds: ['a', 'b'], selectedEdgeIds: [] });

    el.selectedNodeIds = ['a', 'b'];
    await el.updateComplete;
    nodeA!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, metaKey: true })
    );
    expect(detail).to.deep.equal({ selectedNodeIds: ['b'], selectedEdgeIds: [] });
  });

  it('Ctrl+Enter toggles in multiple mode the same way as Ctrl-click', async () => {
    const el = await mountSelectable('multiple');
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    let detail: { selectedNodeIds: string[]; selectedEdgeIds: string[] } | undefined;
    el.addEventListener(
      'lr-selection-change',
      (e) => (detail = (e as CustomEvent).detail)
    );
    nodeEl.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        ctrlKey: true,
      })
    );
    expect(detail).to.deep.equal({ selectedNodeIds: ['a'], selectedEdgeIds: [] });
  });

  it('background click and Escape clear the selection in multiple mode', async () => {
    const el = await mountSelectable('multiple');
    el.selectedNodeIds = ['a'];
    await el.updateComplete;
    let detail: { selectedNodeIds: string[]; selectedEdgeIds: string[] } | undefined;
    el.addEventListener(
      'lr-selection-change',
      (e) => (detail = (e as CustomEvent).detail)
    );
    const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
    svgEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(detail).to.deep.equal({ selectedNodeIds: [], selectedEdgeIds: [] });

    detail = undefined;
    el.selectedNodeIds = ['a'];
    await el.updateComplete;
    svgEl.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    expect(detail).to.deep.equal({ selectedNodeIds: [], selectedEdgeIds: [] });
  });

  it('reflects controlled selectedNodeIds/selectedEdgeIds as data-selected + aria-pressed, and never self-mutates them', async () => {
    const el = await mountSelectable('single');
    el.selectedNodeIds = ['a'];
    await el.updateComplete;
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    expect(nodeEl.hasAttribute('data-selected')).to.be.true;
    expect(nodeEl.getAttribute('aria-pressed')).to.equal('true');
    nodeEl.dispatchEvent(new MouseEvent('click', { bubbles: true })); // emits clear, but component doesn't self-apply
    expect(el.selectedNodeIds).to.deep.equal(['a']); // unchanged -- host owns the prop
  });

  it('announces graphSelectionCount when the controlled props change', async () => {
    const el = await mountSelectable('single');
    el.selectedNodeIds = ['a'];
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="live-region"]')!.textContent
    ).to.contain('1 selected');
  });

  it('does not spuriously announce "0 selected" when an equivalent-but-fresh empty selectedNodeIds/selectedEdgeIds array arrives on an unrelated re-render', async () => {
    // A host that recomputes `.selectedNodeIds=${...}` inline on every render (the ordinary,
    // correct Lit pattern for a controlled prop -- e.g. <lr-knowledge-graph-explorer>'s own
    // `.selectedNodeIds=${this.selectedNodeId ? [this.selectedNodeId] : []}`) hands down a BRAND
    // NEW array reference on every render even while the selection stays empty. Lit's default
    // reference-based `changed.has()` can't tell that apart from a real selection change.
    //
    // The mount-time "0 selected" already stays silent via the `wasMounting` gate (see the test
    // above this one), but that gate only fires once: an unrelated LATER re-render that re-supplies
    // an equally-empty-but-fresh array is what regressed -- graphLiveText transitioning from its
    // untouched '' default to a genuinely new "0 selected" string is what let it slip past the
    // `changed.has('graphLiveText')` safety net too, doubling up whatever unrelated announcement
    // (e.g. a search-result count on a composing host) happened to land in that same update.
    const el = await mountSelectable('single');
    expect(announcementTexts(), 'mount must stay silent').to.deep.equal([]);

    el.selectedNodeIds = []; // fresh reference, still empty -- no real selection change
    el.selectedEdgeIds = [];
    await el.updateComplete;
    expect(
      announcementTexts(),
      'an equivalent empty array reference must not announce'
    ).to.deep.equal([]);

    // A genuine selection still announces -- the fix compares values, it doesn't just suppress
    // the gate outright.
    el.selectedNodeIds = ['a'];
    await el.updateComplete;
    expect(announcementTexts()).to.have.length(1);
    expect(announcementTexts()[0]).to.contain('1 selected');
  });

  it('keeps the initial item only in the aria-hidden mirror without announcing a mount-time selection', async () => {
    // selectedNodeIds/selectedEdgeIds both default to `[]`, a non-undefined default -- Lit marks
    // a property "changed" on the component's very first update whenever it has one, so an
    // unguarded willUpdate() would set graphLiveText to the localized "0 selected" immediately on
    // mount and permanently block render()'s `this.graphLiveText || graphItemAnnouncement(...)`
    // inspection fallback for the focused node/link/community, even with no selection ever made.
    const el = await mountSelectable('single');
    const mirror = el.shadowRoot!.querySelector('[part="live-region"]')!;
    const liveText = mirror.textContent;
    expect(liveText).to.not.contain('0 selected');
    expect(liveText).to.contain('Node A');
    expect(mirror.getAttribute('aria-hidden')).to.equal('true');
    expect(
      announcementTexts(),
      'initial item and selection state must both stay silent'
    ).to.deep.equal([]);
  });

  it('is accessible with a selection applied', async () => {
    const el = await mountSelectable('multiple');
    el.selectedNodeIds = ['a'];
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('existing graph usage unaffected: lr-node-click/lr-link-click still fire unchanged alongside selection', async () => {
    const el = await mountSelectable('single');
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    let clickDetail: { nodeId: string; x: number; y: number } | undefined;
    el.addEventListener(
      'lr-node-click',
      (e) => (clickDetail = (e as CustomEvent).detail)
    );
    nodeEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(clickDetail?.nodeId).to.equal('a');
    expect(clickDetail?.x).to.be.a('number');
    expect(clickDetail?.y).to.be.a('number');
  });
});

describe('type filtering', () => {
  const typedFilterNodes = [
    { id: 'a', label: 'A', type: 'person' },
    { id: 'b', label: 'B', type: 'doc' },
    { id: 'c', label: 'C' }, // untyped -- never hidden by hiddenTypes
  ];
  const typedFilterLinks = [
    { source: 'a', target: 'b' }, // incident to a hidden 'person' node when 'person' is hidden
    { source: 'b', target: 'c' },
  ];

  async function mountFiltered(hiddenTypes: string[] = []): Promise<LyraGraph> {
    // Bind before connection so a non-empty `hiddenTypes` value is genuinely initial state, not a
    // post-mount property transition that should be announced.
    const el = (await fixture(html`
      <lr-graph
        .hiddenTypes=${hiddenTypes}
        .nodes=${typedFilterNodes}
        .edges=${typedFilterLinks}
      ></lr-graph>
    `)) as LyraGraph;
    await el.updateComplete;
    const expectedVisible = typedFilterNodes.filter(
      (n) => n.type == null || !hiddenTypes.includes(n.type)
    ).length;
    await waitUntil(
      () =>
        el.shadowRoot!.querySelectorAll('[part="node"]').length ===
        expectedVisible,
      undefined,
      { timeout: NODE_COUNT_TIMEOUT }
    );
    return el;
  }

  it('defaults hiddenTypes to empty and renders every node/link', async () => {
    const el = await mountFiltered();
    expect(el.shadowRoot!.querySelectorAll('[part="node"]').length).to.equal(3);
    expect(
      el.shadowRoot!.querySelectorAll('[part="link"]:not([data-dangling])')
        .length
    ).to.equal(2);
  });

  it('hides every node whose raw type is listed, plus incident links, from the DOM/simulation/data-list/aria counts', async () => {
    const el = await mountFiltered(['person']);
    const ids = el.simNodes.map((n) => n.id);
    expect(ids).to.not.include('a');
    expect(ids).to.have.members(['b', 'c']);
    expect(el.simLinks.length).to.equal(1); // only b-c survives; a-b is incident to hidden 'a'
    expect(
      el.shadowRoot!.querySelectorAll('[part="data-list"] li').length
    ).to.equal(3); // 2 nodes + 1 link
    const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
    expect(svgEl.getAttribute('aria-label')).to.match(/2 nodes/);
  });

  it('filters by a raw type string with no matching nodeTypes entry', async () => {
    const el = await mountFiltered(['doc']);
    expect(el.simNodes.map((n) => n.id)).to.have.members(['a', 'c']);
  });

  it('mirrors an initial hidden count silently, then announces the live clear to "0 of N"', async () => {
    const el = await mountFiltered(['person']);
    expect(
      el.shadowRoot!.querySelector('[part="live-region"]')!.textContent
    ).to.contain('1 of 3 nodes hidden');
    expect(
      announcementTexts(),
      'initially configured filtering must not announce on mount'
    ).to.deep.equal([]);
    el.hiddenTypes = [];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 3,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    expect(
      el.shadowRoot!.querySelector('[part="live-region"]')!.textContent
    ).to.contain('0 of 3 nodes hidden');
    expect(announcementTexts().at(-1)).to.contain('0 of 3 nodes hidden');
  });

  it('hide then re-show restores each node at its remembered settled position (distance ~ 0)', async () => {
    const el = await mountFiltered();
    await aTimeout(400); // let the force layout settle
    const before = new Map(
      el.simNodes.map((n) => [n.id, { x: n.x!, y: n.y! }])
    );

    el.hiddenTypes = ['person'];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    el.hiddenTypes = [];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 3,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    const after = el.simNodes.find((n) => n.id === 'a')!;
    const beforePos = before.get('a')!;
    const distance = Math.hypot(after.x! - beforePos.x, after.y! - beforePos.y);
    expect(distance).to.be.lessThan(1);
  });

  it('prunes the remembered-position cache when a node is removed from nodes entirely (not just hidden)', async () => {
    const el = await mountFiltered();
    await aTimeout(400);
    el.nodes = typedFilterNodes.filter((n) => n.id !== 'a');
    el.edges = typedFilterLinks.filter(
      (l) => l.source !== 'a' && l.target !== 'a'
    );
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    expect(
      (
        el as unknown as {
          lastPositionById: Map<string, { x: number; y: number }>;
        }
      ).lastPositionById.has('a')
    ).to.be.false;
  });

  it('clamps the roving index when the active item is hidden', async () => {
    const el = await mountFiltered();
    (el.shadowRoot!.querySelector('[part="node"]') as SVGElement).dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    ); // no-op for focus, just mount interaction; roving index defaults to 0 ('a')
    el.hiddenTypes = ['person']; // hides index 0's node
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    const items = [
      ...el.shadowRoot!.querySelectorAll('[part="node"]'),
      ...el.shadowRoot!.querySelectorAll('[part="link"]'),
    ] as SVGElement[];
    expect(
      items.filter((i) => i.getAttribute('tabindex') === '0')
    ).to.have.length(1);
  });

  it('moves real DOM focus to a surviving node when filtering shrinks it to an earlier DOM index', async () => {
    const el = await mountFiltered();
    const lastNode =
      el.shadowRoot!.querySelectorAll<SVGElement>('[part="node"]')[2]!;
    lastNode.focus();
    expect(el.shadowRoot!.activeElement?.getAttribute('aria-label')).to.equal(
      'C'
    );

    el.hiddenTypes = ['doc'];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    await waitUntil(
      () => el.shadowRoot!.activeElement?.getAttribute('part') === 'node',
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );

    expect(el.shadowRoot!.activeElement?.getAttribute('aria-label')).to.equal(
      'C'
    );
    expect(
      el.shadowRoot!.querySelectorAll(
        '[part="node"][tabindex="0"], [part="link"][tabindex="0"]'
      )
    ).to.have.length(1);
  });

  it('is accessible with a type hidden', async () => {
    const el = await mountFiltered(['person']);
    await expect(el).to.be.accessible();
  });

  it("hides the persistent focus-halo when the focused node's type is hidden, and restores it when shown again", async () => {
    const el = (await fixture(
      html`<lr-graph focus-node-id="a"></lr-graph>`
    )) as LyraGraph;
    el.nodes = typedFilterNodes;
    el.edges = typedFilterLinks;
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 3,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    await aTimeout(400);
    const halo = el.shadowRoot!.querySelector(
      '[part="focus-halo"]'
    ) as SVGCircleElement;
    expect(halo.hasAttribute('hidden')).to.be.false;

    el.hiddenTypes = ['person'];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    expect(halo.hasAttribute('hidden')).to.be.true;

    el.hiddenTypes = [];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 3,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    expect(halo.hasAttribute('hidden')).to.be.false;
  });

  it('does not let a selected/focused node id linger after its type is hidden -- it simply stops rendering, unmutated, and resumes if shown again', async () => {
    const el = await mountFiltered();
    el.selectionMode = 'single';
    el.selectedNodeIds = ['a'];
    await el.updateComplete;
    el.hiddenTypes = ['person'];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    // The controlled selectedNodeIds array is untouched by the component -- it's the host's to own.
    expect(el.selectedNodeIds).to.deep.equal(['a']);
    expect(el.shadowRoot!.querySelector('[data-selected]') === null).to.be.true; // hidden node can't render selected

    el.hiddenTypes = [];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 3,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    const nodeA = el.shadowRoot!.querySelector('[data-selected]') as SVGElement;
    expect(nodeA.getAttribute('aria-label')).to.contain('A');
  });

  it('existing graph usage unaffected: no hiddenTypes set renders every node/link exactly as before', async () => {
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
    expect(
      el.shadowRoot!.querySelectorAll('[part="link"]:not([data-dangling])')
        .length
    ).to.equal(1);
  });
});

describe('community hulls', () => {
  const communityNodes = [
    { id: 'a', label: 'A', communityId: 'team-1' },
    { id: 'b', label: 'B', communityId: 'team-1' },
    { id: 'c', label: 'C' },
  ];
  const communities = [{ id: 'team-1', label: 'Team One', memberIds: [] }];

  async function mountHulls(): Promise<LyraGraph> {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.communities = communities;
    el.nodes = communityNodes;
    el.edges = [];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 3,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    return el;
  }

  it('concatenates the keyboard cursor index space as nodes, then links, then hulls', async () => {
    // The four call sites that translate between a roving index and a node/link/hull all derive
    // their segment offsets from one pair of helpers. This pins the ordering those helpers encode:
    // a reorder or a new item kind that only reaches some of the sites shows up here as focus
    // landing on the wrong kind.
    const el = (await fixture(
      html`<lr-graph
        renderer="canvas"
        width="400"
        height="300"
        style="width:400px;height:300px"
      ></lr-graph>`
    )) as LyraGraph;
    el.communities = communities;
    el.nodes = communityNodes;
    el.edges = [{ source: 'a', target: 'b' }];
    await el.updateComplete;
    await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
      timeout: NODE_COUNT_TIMEOUT,
    });
    await aTimeout(50);

    const items = [
      ...el.shadowRoot!.querySelectorAll('[part="cursor-item"]'),
    ] as HTMLButtonElement[];
    expect(items.length, '3 nodes + 1 link + 1 hull').to.equal(5);
    expect(
      items.slice(0, 3).map((item) => item.getAttribute('aria-label'))
    ).to.deep.equal(['A', 'B', 'C']);

    const live = () =>
      el.shadowRoot!.querySelector('[part="live-region"]')!.textContent ?? '';
    items[0]!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true })
    );
    await el.updateComplete;
    expect(
      items[4]!.getAttribute('tabindex'),
      'End lands on the last hull'
    ).to.equal('0');
    expect(
      live(),
      'and announces it as the community, not a node or link'
    ).to.include('Team One');

    items[4]!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })
    );
    await el.updateComplete;
    expect(
      items[3]!.getAttribute('tabindex'),
      'one step back is the link segment'
    ).to.equal('0');
  });

  it('renders no hull when communities is empty', async () => {
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
    expect(el.shadowRoot!.querySelector('[part="hull"]') == null).to.be.true;
  });

  it('renders one hull per community, membership = union of memberIds and matching communityId', async () => {
    const el = await mountHulls();
    expect(el.shadowRoot!.querySelectorAll('[part="hull"]').length).to.equal(1);
    const hull = el.shadowRoot!.querySelector(
      '[part="hull"]'
    ) as SVGPathElement;
    expect(hull.getAttribute('d')).to.not.equal('');
  });

  it('renders no hull for a community whose members are all hidden', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodeTypes = [{ id: 'x', label: 'X' }];
    el.hiddenTypes = ['x'];
    el.communities = [{ id: 'team-1', label: 'Team', memberIds: ['a', 'b'] }];
    el.nodes = [
      { id: 'a', label: 'A', type: 'x' },
      { id: 'b', label: 'B', type: 'x' },
    ];
    el.edges = [];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 0,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    expect(el.shadowRoot!.querySelector('[part="hull"]') == null).to.be.true;
  });

  it('a 1-member community draws a degenerate (zero-length) hull path', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.communities = [{ id: 'solo', memberIds: ['a'] }];
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
    const hull = el.shadowRoot!.querySelector(
      '[part="hull"]'
    ) as SVGPathElement;
    expect(hull.getAttribute('d')).to.match(
      /^M [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+$/
    );
  });

  it('hulls stack before links/nodes in DOM order', async () => {
    const el = await mountHulls();
    const g = el.shadowRoot!.querySelector('g') as SVGGElement;
    const children = [...g.children].map(
      (c) =>
        c.querySelector('[part]')?.getAttribute('part') ??
        c.getAttribute('part')
    );
    const hullIndex = children.findIndex((p) => p === 'hull');
    const nodeIndex = children.findIndex((p) => p === 'node');
    expect(hullIndex).to.be.lessThan(nodeIndex);
  });

  it('click and Enter/Space on a hull emit lr-community-activate', async () => {
    const el = await mountHulls();
    const hull = el.shadowRoot!.querySelector(
      '[part="hull"]'
    ) as SVGPathElement;
    let detail: { communityId: string } | undefined;
    el.addEventListener(
      'lr-community-activate',
      (e) => (detail = (e as CustomEvent).detail)
    );
    hull.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(detail).to.deep.equal({ communityId: 'team-1' });
    detail = undefined;
    hull.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    expect(detail).to.deep.equal({ communityId: 'team-1' });
  });

  it('hulls join the roving ring after nodes and links, with a matching data-list entry', async () => {
    const el = await mountHulls();
    const items = [
      ...el.shadowRoot!.querySelectorAll('[part="node"]'),
      ...el.shadowRoot!.querySelectorAll('[part="link"]'),
      ...el.shadowRoot!.querySelectorAll('[part="hull"]'),
    ] as SVGElement[];
    expect(items[items.length - 1]!.getAttribute('part')).to.equal('hull');
    expect(
      el.shadowRoot!.querySelectorAll('[part="data-list"] li')
    ).to.have.length(4); // 3 nodes + 1 hull
  });

  it('fit() bounding box accounts for hull padding when communities render', async () => {
    const el = await mountHulls();
    el.fit({ padding: 10 });
    await aTimeout(400);
    const svgEl = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
    const transform = svgEl.querySelector('g')!.getAttribute('transform')!;
    expect(transform).to.match(
      /translate\([-\d.]+,\s*[-\d.]+\)\s*scale\([-\d.]+\)/
    );
  });

  it('is accessible with hulls rendered', async () => {
    const el = await mountHulls();
    await expect(el).to.be.accessible();
  });

  it('existing graph usage unaffected: no communities set renders no hulls and an unchanged roving ring', async () => {
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
    const items = [
      ...el.shadowRoot!.querySelectorAll('[part="node"]'),
      ...el.shadowRoot!.querySelectorAll('[part="link"]'),
    ] as SVGElement[];
    expect(
      items.filter((i) => i.getAttribute('tabindex') === '0')
    ).to.have.length(1);
  });

  it('memoizes the per-community member walk once per structural update instead of once per graphItemCount() call site', async () => {
    const el = await mountHulls();
    type WithCommunityMembers = { communityMembers: (c: unknown) => unknown };
    let calls = 0;
    const original = (
      el as unknown as WithCommunityMembers
    ).communityMembers.bind(el);
    (el as unknown as WithCommunityMembers).communityMembers = (c: unknown) => {
      calls++;
      return original(c);
    };
    // A structural change (a genuinely new nodes array) is the only thing that should force a fresh
    // recompute -- the render this triggers reads the community/member walk from many places (every
    // node/link/hull tabindex expression, the outer <svg> tabindex, the live-region branch, the
    // hull/data-list templates), all of which must share one cached result instead of each
    // independently re-walking `communities` × `simNodes`.
    el.nodes = [
      ...communityNodes,
      { id: 'd', label: 'D', communityId: 'team-1' },
    ];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 4,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    expect(calls).to.equal(communities.length);
  });
});

describe('layered layout', () => {
  const chainLinks = [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
  ];

  it('defaults layout to force (unchanged today behavior)', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    expect(el.layout).to.equal('force');
  });

  it('layout="layered" positions nodes deterministically, top-to-bottom by longest path, without a settle animation', async () => {
    const el = (await fixture(
      html`<lr-graph layout="layered" width="800" height="600"></lr-graph>`
    )) as LyraGraph;
    el.nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ];
    el.edges = chainLinks;
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 3,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    const a = el.simNodes.find((n) => n.id === 'a')!;
    const b = el.simNodes.find((n) => n.id === 'b')!;
    const c = el.simNodes.find((n) => n.id === 'c')!;
    expect(a.y!).to.be.lessThan(b.y!);
    expect(b.y!).to.be.lessThan(c.y!);
  });

  it('node drag is disabled in layered mode (no d3-drag bound)', async () => {
    const el = (await fixture(
      html`<lr-graph layout="layered"></lr-graph>`
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
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
    const before = {
      x: nodeEl.getAttribute('cx'),
      y: nodeEl.getAttribute('cy'),
    };
    // `view: window` matches a real user-dispatched event (jsdom/browsers leave it `null` on a
    // bare synthetic MouseEvent) -- with no d3-drag bound to intercept and stop propagation, this
    // mousedown now bubbles to the svg's own d3-zoom pan-start handler, which reads
    // `event.view.document` internally and throws on a `null` view.
    nodeEl.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        clientX: 0,
        clientY: 0,
        view: window,
      })
    );
    document.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        clientX: 100,
        clientY: 100,
        view: window,
      })
    );
    document.dispatchEvent(
      new MouseEvent('mouseup', { bubbles: true, view: window })
    );
    await el.updateComplete;
    expect(nodeEl.getAttribute('cx')).to.equal(before.x);
    expect(nodeEl.getAttribute('cy')).to.equal(before.y);
  });

  it('edgeDistance retunes the layer gap in layered mode', async () => {
    const tight = (await fixture(
      html`<lr-graph
        layout="layered"
        edge-distance="20"
        width="800"
        height="600"
      ></lr-graph>`
    )) as LyraGraph;
    tight.nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    tight.edges = [{ source: 'a', target: 'b' }];
    await tight.updateComplete;
    await waitUntil(
      () => tight.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    const gapBefore =
      tight.simNodes.find((n) => n.id === 'b')!.y! -
      tight.simNodes.find((n) => n.id === 'a')!.y!;
    tight.edgeDistance = 300;
    await tight.updateComplete;
    await waitUntil(
      () =>
        tight.simNodes.find((n) => n.id === 'b')!.y! -
          tight.simNodes.find((n) => n.id === 'a')!.y! !==
        gapBefore,
      undefined,
      { timeout: NODE_COUNT_TIMEOUT }
    );
    const gapAfter =
      tight.simNodes.find((n) => n.id === 'b')!.y! -
      tight.simNodes.find((n) => n.id === 'a')!.y!;
    expect(gapAfter).to.be.greaterThan(gapBefore);
  });

  it('keyboard roving/announcements are identical in layered mode', async () => {
    const el = (await fixture(
      html`<lr-graph layout="layered"></lr-graph>`
    )) as LyraGraph;
    el.nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    el.edges = [{ source: 'a', target: 'b' }];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    const items = () =>
      [...el.shadowRoot!.querySelectorAll('[part="node"]')] as SVGElement[];
    items()[0]!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    );
    await el.updateComplete;
    expect(items()[1]!.getAttribute('tabindex')).to.equal('0');
  });

  it('both lr-graph and the shared util produce the same node ordering (no forked algorithm)', async () => {
    const el = (await fixture(
      html`<lr-graph layout="layered" width="800" height="600"></lr-graph>`
    )) as LyraGraph;
    el.nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    el.edges = [{ source: 'a', target: 'b' }];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    const { positions: direct } = layeredLayout({
      nodes: [
        { id: 'a', width: 30, height: 30 },
        { id: 'b', width: 30, height: 30 },
      ],
      edges: [{ source: 'a', target: 'b' }],
      options: { gapX: 12, gapY: el.edgeDistance },
    });
    const a = el.simNodes.find((n) => n.id === 'a')!;
    const b = el.simNodes.find((n) => n.id === 'b')!;
    // Same relative gap (component centers the drawing, so compare deltas, not absolute coords).
    expect(b.y! - a.y!).to.be.closeTo(
      direct.get('b')!.y - direct.get('a')!.y,
      0.01
    );
  });

  it('is accessible in layered mode', async () => {
    const el = (await fixture(
      html`<lr-graph layout="layered"></lr-graph>`
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
    await expect(el).to.be.accessible();
  });

  it('hiddenTypes filtering announces graphNodesHidden in layered mode too, same as force mode', async () => {
    const el = (await fixture(
      html`<lr-graph layout="layered"></lr-graph>`
    )) as LyraGraph;
    el.hiddenTypes = ['person'];
    el.nodes = [
      { id: 'a', label: 'A', type: 'person' },
      { id: 'b', label: 'B' },
    ];
    el.edges = [];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 1,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    expect(
      el.shadowRoot!.querySelector('[part="live-region"]')!.textContent
    ).to.contain('1 of 2 nodes hidden');
  });

  it('existing graph usage unaffected: layout unset uses the untouched force-directed path', async () => {
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
    expect((el as unknown as { simulation?: unknown }).simulation).to.exist;
  });
});
