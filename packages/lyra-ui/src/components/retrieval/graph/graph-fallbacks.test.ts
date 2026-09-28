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

describe('styling', () => {
  // A real browser :hover/:active pseudo-class can't be forced from a dispatched event (it tracks
  // the physical pointer), so each state rule's value is read off the shipped rule and then
  // *painted* on a probe inside the graph's own shadow root: every --lr-* in the expression resolves
  // exactly as it does in production and the assertion lands on the painted colour, not on
  // stylesheet text.
  function declaredValue(
    root: ShadowRoot,
    selector: string,
    property: string
  ): string {
    const normalize = (text: string) =>
      text.replace(/"/g, "'").replace(/\s+/g, ' ').trim();
    for (const sheet of root.adoptedStyleSheets ?? []) {
      for (const rule of sheet.cssRules) {
        if (
          rule instanceof CSSStyleRule &&
          normalize(rule.selectorText) === normalize(selector)
        ) {
          const value = rule.style.getPropertyValue(property);
          if (value) return value;
        }
      }
    }
    return '';
  }

  function paintProbe(root: ShadowRoot) {
    const measure = (
      apply: (probe: HTMLElement) => void,
      read: (style: CSSStyleDeclaration) => string
    ) => {
      const probe = document.createElement('span');
      apply(probe);
      root.appendChild(probe);
      const computed = read(getComputedStyle(probe));
      probe.remove();
      return computed;
    };
    return {
      // The zero-percent wrapper forces resting, hovered and pressed through one serialization, so
      // the channel distances below are apples-to-apples even though the resting value is a plain
      // custom property and the two state values are mixes.
      render: (value: string) =>
        measure(
          (probe) =>
            (probe.style.backgroundColor = `color-mix(in oklab, ${
              value || 'transparent'
            }, transparent 0%)`),
          (style) => style.backgroundColor
        ),
      renderFilter: (value: string) =>
        measure(
          (probe) => (probe.style.filter = value),
          (style) => style.filter
        ),
    };
  }

  function channelDistance(left: string, right: string): number {
    const channels = (color: string) =>
      (color.match(/-?\d*\.?\d+/g) ?? []).map(Number);
    const a = channels(left);
    const b = channels(right);
    return Math.hypot(...a.map((value, index) => value - (b[index] ?? 0)));
  }

  it('mixes node/link/hull toward the shared partner on hover and further again on press', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    await el.updateComplete;
    const root = el.shadowRoot!;
    const probes = paintProbe(root);

    const assertPressedIsStronger = (part: string, property: string) => {
      const resting = probes.render(
        declaredValue(root, `[part='${part}']`, property)
      );
      const hovered = probes.render(
        declaredValue(root, `[part='${part}']:hover`, property)
      );
      const pressed = probes.render(
        declaredValue(root, `[part='${part}']:active`, property)
      );
      expect(
        hovered,
        `${part} hover must move off its resting ${property}`
      ).to.not.equal(resting);
      // The defect this guards: a pressed rule byte-identical to the hover one.
      expect(pressed, `${part} pressed must differ from hovered`).to.not.equal(
        hovered
      );
      expect(channelDistance(pressed, resting)).to.be.greaterThan(
        channelDistance(hovered, resting)
      );
    };

    assertPressedIsStronger('node', 'fill');
    assertPressedIsStronger('link', 'stroke');
    assertPressedIsStronger('hull', 'fill');
  });

  it('tints the canvas box on hover rather than filtering the scene painted into it', async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    await el.updateComplete;
    const root = el.shadowRoot!;
    const probes = paintProbe(root);

    // The <canvas> is cleared to transparent wherever nothing is drawn, so a background tints only
    // the empty plot area; the drawn nodes, links and labels keep the colours the renderer computed.
    const resting = probes.render('transparent');
    const hovered = probes.render(
      declaredValue(root, "[part='canvas']:hover", 'background')
    );
    expect(hovered).to.not.equal(resting);

    // A filter applies to the element's own painted output, so any surviving one would re-tint the
    // whole scene. Rendering whatever each rule declares and reading it back proves none survives.
    for (const selector of [
      "[part='canvas']:hover",
      "[part='node']:hover",
      "[part='link']:hover",
      "[part='hull']:hover",
    ]) {
      expect(
        probes.renderFilter(declaredValue(root, selector, 'filter')),
        selector
      ).to.equal('none');
    }
  });
});

// A missing optional D3 peer must fail closed during lifecycle-driven initialization. When the
// optional `d3` peers fail to load, <lr-graph> must render a visible, accessible error state plus
// a light-DOM assertive announcement instead of leaving a permanently blank surface.
describe('optional d3 peer failure', () => {
  it('renders a visible, accessible error state instead of a blank surface when the d3 peers fail to load', async () => {
    // Deliberately not using fixture(): loadLibrary must be overridden *before* the element ever
    // connects, since connectedCallback() calls it unconditionally on connect.
    const el = document.createElement('lr-graph') as unknown as LyraGraph;
    (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary =
      () => Promise.resolve(null);
    el.nodes = nodes;
    el.edges = links;
    document.body.appendChild(el);
    try {
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="error"]') != null,
        'error state never rendered',
        {
          timeout: 2000,
        }
      );
      const errorEl = el.shadowRoot!.querySelector(
        '[part="error"]'
      ) as HTMLElement;
      expect(
        errorEl.hasAttribute('aria-hidden'),
        'the visible error must remain discoverable'
      ).to.be.false;
      expect(
        errorEl.hasAttribute('role'),
        'the shadow mirror must not be a second alert'
      ).to.be.false;
      expect(errorEl.textContent!.trim().length).to.be.greaterThan(0);
      expect(announcementTexts(document, 'assertive')).to.deep.equal([
        errorEl.textContent!.trim(),
      ]);
      expect(el.getAttribute('aria-busy')).to.equal('false');
      expect(el.shadowRoot!.querySelectorAll('svg, canvas').length).to.equal(0);
      expect(el.shadowRoot!.querySelectorAll('lr-skeleton').length).to.equal(0);
    } finally {
      el.remove();
    }
  });

  it('routes the d3 peer-missing error through a .strings override', async () => {
    const el = document.createElement('lr-graph') as unknown as LyraGraph;
    (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary =
      () => Promise.resolve(null);
    (el as unknown as { strings: Record<string, string> }).strings = {
      graphMissingLibrary: 'Bibliothèque de graphe absente',
    };
    el.nodes = nodes;
    document.body.appendChild(el);
    try {
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="error"]') != null,
        'error state never rendered',
        {
          timeout: 2000,
        }
      );
      expect(
        el.shadowRoot!.querySelector('[part="error"]')!.textContent!.trim()
      ).to.equal('Bibliothèque de graphe absente');
      expect(announcementTexts(document, 'assertive')).to.deep.equal([
        'Bibliothèque de graphe absente',
      ]);
    } finally {
      el.remove();
    }
  });
});

it('does not invalidate a canvas scene that has not been rendered yet (regression: the host observer arms from the first update, before the lazily imported d3 has resolved)', async () => {
  const owner = window as unknown as { ResizeObserver: typeof ResizeObserver };
  const originalCtor = owner.ResizeObserver;
  let hostCallback: ResizeObserverCallback | undefined;
  class CapturingResizeObserver extends originalCtor {
    constructor(callback: ResizeObserverCallback) {
      super(callback);
      hostCallback = callback;
    }
  }
  owner.ResizeObserver = CapturingResizeObserver;
  // Deliberately not using fixture(): loadLibrary must be overridden *before* the element ever
  // connects. A promise that never settles pins the component in its loading state, so the
  // <canvas> is deterministically absent while the host observer is already armed.
  const el = document.createElement('lr-graph') as unknown as LyraGraph;
  (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () =>
    new Promise<unknown>(() => {});
  el.renderer = 'canvas';
  el.nodes = nodes;
  el.edges = links;
  document.body.appendChild(el);
  try {
    await el.updateComplete;
    let invalidations = 0;
    (el as unknown as { markCanvasDirty: () => void }).markCanvasDirty = () => {
      invalidations += 1;
    };
    expect(
      el.shadowRoot!.querySelectorAll('canvas').length,
      'the loading state should not have rendered a canvas'
    ).to.equal(0);
    expect(
      hostCallback === undefined,
      'canvas mode never armed the host resize observer'
    ).to.be.false;
    hostCallback!(
      [{ contentRect: { width: 200, height: 200 } } as ResizeObserverEntry],
      {} as ResizeObserver
    );
    expect(
      invalidations,
      'a canvas that has not been rendered yet was invalidated'
    ).to.equal(0);
  } finally {
    el.remove();
    owner.ResizeObserver = originalCtor;
  }
});

it('observes the host exactly once for a canvas mount (regression: the surface setup re-armed the observer updated() had already armed, re-paying its initial callback as a second scene invalidation)', async () => {
  const owner = window as unknown as { ResizeObserver: typeof ResizeObserver };
  const original = owner.ResizeObserver;
  let hostObservations = 0;
  class CountingResizeObserver extends original {
    override observe(target: Element, options?: ResizeObserverOptions): void {
      if (target.localName === 'lr-graph') hostObservations += 1;
      super.observe(target, options);
    }
  }
  owner.ResizeObserver = CountingResizeObserver;
  try {
    const el = (await fixture(html`
      <lr-graph
        renderer="canvas"
        width="200"
        height="200"
        .nodes=${nodes}
        .edges=${links}
      ></lr-graph>
    `)) as LyraGraph;
    await waitUntil(
      () => el.shadowRoot!.querySelector('canvas') != null,
      'canvas renderer never mounted',
      { timeout: NODE_COUNT_TIMEOUT }
    );
    expect(hostObservations).to.equal(1);
  } finally {
    owner.ResizeObserver = original;
  }
});

describe('fit-to="container"', () => {
  /** The d3 peer loads lazily, so the svg renderer replaces the skeleton a few frames after mount. */
  async function svgViewBox(el: LyraGraph): Promise<string> {
    await waitUntil(
      () => el.shadowRoot!.querySelector('svg') != null,
      'svg renderer never replaced the loading skeleton',
      { timeout: NODE_COUNT_TIMEOUT }
    );
    return el.shadowRoot!.querySelector('svg')!.getAttribute('viewBox') ?? '';
  }

  async function waitForViewBox(el: LyraGraph, expected: string): Promise<void> {
    await waitUntil(
      () =>
        el.shadowRoot!.querySelector('svg')?.getAttribute('viewBox') ===
        expected,
      `viewBox never became ${expected}`,
      { timeout: NODE_COUNT_TIMEOUT }
    );
  }

  it('keeps the numeric width/height as the drawing space by default (unset regression)', async () => {
    const holder = (await fixture(html`
      <div style="inline-size: 300px">
        <lr-graph
          .nodes=${nodes}
          .edges=${links}
          style="--lr-canvas-reserved-height: 200px"
        ></lr-graph>
      </div>
    `)) as HTMLDivElement;
    const el = holder.querySelector('lr-graph') as unknown as LyraGraph;
    expect(el.fitTo).to.equal('none');
    expect(await svgViewBox(el)).to.equal('0 0 800 600');
  });

  it('derives the drawing space from the host content box when fit-to="container"', async () => {
    const holder = (await fixture(html`
      <div style="inline-size: 300px">
        <lr-graph
          fit-to="container"
          .nodes=${nodes}
          .edges=${links}
          style="--lr-canvas-reserved-height: 200px"
        ></lr-graph>
      </div>
    `)) as HTMLDivElement;
    const el = holder.querySelector('lr-graph') as unknown as LyraGraph;
    await waitForViewBox(el, '0 0 300 200');
  });

  it('measures the height the host really has when no --lr-canvas-reserved-height is set (regression: the connect-time measurement read the 24rem cascade fallback)', async () => {
    // No ResizeObserver, so the ONLY box on record is the synchronous measurement -- nothing can
    // quietly correct a wrong first reading a frame later, which is exactly what a realm without
    // one does to a consumer. 24rem (the last fallback in :host's block-size cascade) is 384px, so
    // a height of 420 makes a mis-measured frame unmistakable.
    const owner = window as unknown as {
      ResizeObserver?: typeof ResizeObserver;
    };
    const original = owner.ResizeObserver;
    owner.ResizeObserver = undefined;
    try {
      const holder = (await fixture(html`
        <div style="inline-size: 360px">
          <lr-graph
            fit-to="container"
            height="420"
            .nodes=${nodes}
            .edges=${links}
          ></lr-graph>
        </div>
      `)) as HTMLDivElement;
      const el = holder.querySelector('lr-graph') as unknown as LyraGraph;
      expect(
        (el as unknown as HTMLElement).clientHeight,
        'host was not sized from height, so the drawing space cannot be judged'
      ).to.equal(420);
      expect(await svgViewBox(el)).to.equal('0 0 360 420');
    } finally {
      owner.ResizeObserver = original;
    }
  });

  it('keeps the measured container box winning over a numeric width assigned later', async () => {
    const holder = (await fixture(html`
      <div style="inline-size: 300px">
        <lr-graph
          fit-to="container"
          .nodes=${nodes}
          .edges=${links}
          style="--lr-canvas-reserved-height: 200px"
        ></lr-graph>
      </div>
    `)) as HTMLDivElement;
    const el = holder.querySelector('lr-graph') as unknown as LyraGraph;
    await waitForViewBox(el, '0 0 300 200');
    el.width = 900;
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('svg')!.getAttribute('viewBox')
    ).to.equal('0 0 300 200');
  });

  it('re-centres the same running simulation on a container resize instead of rebuilding it', async () => {
    const holder = (await fixture(html`
      <div style="inline-size: 300px">
        <lr-graph
          fit-to="container"
          seed="7"
          .nodes=${nodes}
          .edges=${links}
          style="--lr-canvas-reserved-height: 200px"
        ></lr-graph>
      </div>
    `)) as HTMLDivElement;
    const el = holder.querySelector('lr-graph') as unknown as LyraGraph;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      'nodes never rendered',
      { timeout: NODE_COUNT_TIMEOUT }
    );
    await waitForViewBox(el, '0 0 300 200');
    const privates = el as unknown as {
      simulation?: {
        force(name: string): { x(): number; y(): number } | undefined;
        alpha(): number;
        alphaMin(): number;
      };
    };
    const before = privates.simulation;
    expect(before !== undefined, 'simulation was never created').to.be.true;
    expect(before!.force('center')!.x()).to.equal(150);
    holder.style.inlineSize = '500px';
    await waitUntil(
      () => privates.simulation?.force('center')?.x() === 250,
      'forceCenter never followed the resized container',
      { timeout: NODE_COUNT_TIMEOUT }
    );
    expect(
      privates.simulation === before,
      'resize rebuilt the simulation instead of re-centring it'
    ).to.be.true;
    expect(
      privates.simulation!.alpha() > privates.simulation!.alphaMin(),
      'resize did not restart the settled simulation at a low alpha'
    ).to.be.true;
    await waitForViewBox(el, '0 0 500 200');
  });

  it('follows the host content box under dir="rtl" exactly as under ltr', async () => {
    const holder = (await fixture(html`
      <div dir="rtl" style="inline-size: 320px">
        <lr-graph
          fit-to="container"
          .nodes=${nodes}
          .edges=${links}
          style="--lr-canvas-reserved-height: 180px"
        ></lr-graph>
      </div>
    `)) as HTMLDivElement;
    const el = holder.querySelector('lr-graph') as unknown as LyraGraph;
    await waitForViewBox(el, '0 0 320 180');
  });

  it('re-measures after a reparent into a differently sized container (reconnect)', async () => {
    const holder = (await fixture(html`
      <div>
        <div id="narrow" style="inline-size: 300px">
          <lr-graph
            fit-to="container"
            .nodes=${nodes}
            .edges=${links}
            style="--lr-canvas-reserved-height: 200px"
          ></lr-graph>
        </div>
        <div id="wide" style="inline-size: 520px"></div>
      </div>
    `)) as HTMLDivElement;
    const el = holder.querySelector('lr-graph') as unknown as LyraGraph;
    await waitForViewBox(el, '0 0 300 200');
    holder
      .querySelector('#wide')!
      .appendChild(el as unknown as HTMLElement);
    await waitForViewBox(el, '0 0 520 200');
  });

  it('still measures the host box once when the realm has no ResizeObserver', async () => {
    const owner = window as unknown as {
      ResizeObserver?: typeof ResizeObserver;
    };
    const original = owner.ResizeObserver;
    owner.ResizeObserver = undefined;
    try {
      const holder = (await fixture(html`
        <div style="inline-size: 240px">
          <lr-graph
            fit-to="container"
            .nodes=${nodes}
            .edges=${links}
            style="--lr-canvas-reserved-height: 160px"
          ></lr-graph>
        </div>
      `)) as HTMLDivElement;
      const el = holder.querySelector('lr-graph') as unknown as LyraGraph;
      expect(await svgViewBox(el)).to.equal('0 0 240 160');
      expect(
        (el as unknown as { hostResizeObserver?: ResizeObserver })
          .hostResizeObserver,
        'no observer should exist, so the box can only have come from the synchronous measurement'
      ).to.be.undefined;
    } finally {
      owner.ResizeObserver = original;
    }
  });

  it('fits the canvas renderer to the container and follows a resize there too', async () => {
    const holder = (await fixture(html`
      <div style="inline-size: 300px">
        <lr-graph
          renderer="canvas"
          fit-to="container"
          seed="7"
          .nodes=${nodes}
          .edges=${links}
          style="--lr-canvas-reserved-height: 200px"
        ></lr-graph>
      </div>
    `)) as HTMLDivElement;
    const el = holder.querySelector('lr-graph') as unknown as LyraGraph;
    await waitUntil(
      () => el.shadowRoot!.querySelector('canvas') != null,
      'canvas renderer never mounted',
      { timeout: NODE_COUNT_TIMEOUT }
    );
    const privates = el as unknown as {
      simulation?: { force(name: string): { x(): number } | undefined };
    };
    await waitUntil(
      () => privates.simulation?.force('center')?.x() === 150,
      'canvas layout never centred on the measured container',
      { timeout: NODE_COUNT_TIMEOUT }
    );
    holder.style.inlineSize = '500px';
    await waitUntil(
      () => privates.simulation?.force('center')?.x() === 250,
      'canvas layout never followed the resized container',
      { timeout: NODE_COUNT_TIMEOUT }
    );
  });

  it('keeps measuring across a canvas -> svg renderer switch (the resize watcher used to be torn down on entering svg mode)', async () => {
    const holder = (await fixture(html`
      <div style="inline-size: 300px">
        <lr-graph
          renderer="canvas"
          fit-to="container"
          .nodes=${nodes}
          .edges=${links}
          style="--lr-canvas-reserved-height: 200px"
        ></lr-graph>
      </div>
    `)) as HTMLDivElement;
    const el = holder.querySelector('lr-graph') as unknown as LyraGraph;
    await waitUntil(
      () => el.shadowRoot!.querySelector('canvas') != null,
      'canvas renderer never mounted',
      { timeout: NODE_COUNT_TIMEOUT }
    );
    el.renderer = 'svg';
    await el.updateComplete;
    await waitForViewBox(el, '0 0 300 200');
    holder.style.inlineSize = '460px';
    await waitForViewBox(el, '0 0 460 200');
  });

  it('stops watching the host again when fit-to leaves "container" in svg mode', async () => {
    const el = (await fixture(html`
      <lr-graph
        fit-to="container"
        .nodes=${nodes}
        .edges=${links}
      ></lr-graph>
    `)) as LyraGraph;
    const privates = el as unknown as {
      hostResizeObserver?: ResizeObserver;
    };
    await waitUntil(
      () => privates.hostResizeObserver != null,
      'container mode never armed the host observer',
      { timeout: NODE_COUNT_TIMEOUT }
    );
    el.fitTo = 'none';
    await el.updateComplete;
    expect(privates.hostResizeObserver).to.be.undefined;
    // ...and the drawing space falls back to the numeric width/height it was ignoring.
    await waitForViewBox(el, '0 0 800 600');
  });
});
