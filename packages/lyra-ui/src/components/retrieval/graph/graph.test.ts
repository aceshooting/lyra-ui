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

it('discloses both collection limits while the peer loads and after a load failure', async () => {
  const el = document.createElement('lr-graph') as unknown as LyraGraph;
  let finishLoading!: (value: null) => void;
  (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () =>
    new Promise<null>((resolve) => { finishLoading = resolve; });
  const previousWarn = console.warn;
  console.warn = () => undefined;
  try {
    el.nodes = Array.from({ length: 10_001 }, () => ({ id: '' }));
    el.edges = Array.from({ length: 10_002 }, () => ({ source: '', target: '' }));
  } finally {
    console.warn = previousWarn;
  }
  document.body.append(el);
  try {
    await el.updateComplete;
    const notices = () => [...el.shadowRoot!.querySelectorAll('[part="limit"]')].map((notice) => notice.textContent);
    expect(el.getAttribute('aria-busy')).to.equal('true');
    expect(notices()).to.deep.equal(['Showing 10,000 of 10,001 nodes.', 'Showing 10,000 of 10,002 links.']);
    finishLoading(null);
    await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
    expect(notices()).to.deep.equal(['Showing 10,000 of 10,001 nodes.', 'Showing 10,000 of 10,002 links.']);
    el.nodes = [];
    el.edges = [];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="limit"]') === null).to.equal(true);
  } finally {
    el.remove();
  }
});

it('uses the same canvas-height token as the pre-upgrade reservation', async () => {
  const el = (await fixture(html`
    <lr-graph style="--lr-canvas-reserved-height: 275px"></lr-graph>
  `)) as LyraGraph;
  expect(getComputedStyle(el).blockSize).to.equal('275px');
  expect(el.getBoundingClientRect().height).to.be.closeTo(275, 1);
});

it('sizes the rendered host from height when --lr-canvas-reserved-height is unset (regression: height used to only size the viewBox)', async () => {
  const el = (await fixture(
    html`<lr-graph height="450"></lr-graph>`
  )) as LyraGraph;
  expect(getComputedStyle(el).blockSize).to.equal('450px');
  expect(el.getBoundingClientRect().height).to.be.closeTo(450, 1);
});

it('updates the rendered host size when height changes after mount', async () => {
  const el = (await fixture(
    html`<lr-graph height="450"></lr-graph>`
  )) as LyraGraph;
  el.height = 320;
  await el.updateComplete;
  expect(getComputedStyle(el).blockSize).to.equal('320px');
});

it('lets an author-set --lr-canvas-reserved-height keep winning over height', async () => {
  const el = (await fixture(html`
    <lr-graph
      height="450"
      style="--lr-canvas-reserved-height: 275px"
    ></lr-graph>
  `)) as LyraGraph;
  expect(getComputedStyle(el).blockSize).to.equal('275px');
  expect(el.getBoundingClientRect().height).to.be.closeTo(275, 1);
});


it('invalidates the cached canvas scene after an out-of-band theme change', async () => {
  const el = (await fixture(
    html`<lr-graph renderer="canvas" width="200" height="200"></lr-graph>`
  )) as LyraGraph;
  await el.updateComplete;
  let invalidations = 0;
  const internals = el as unknown as { markCanvasDirty: () => void };
  const originalMarkCanvasDirty = internals.markCanvasDirty;
  internals.markCanvasDirty = () => {
    invalidations += 1;
  };
  try {
    invalidateLyraTheme(el);
    await aTimeout(0);
    expect(invalidations).to.equal(1);
  } finally {
    internals.markCanvasDirty = originalMarkCanvasDirty;
  }
});


// Each graph owns its measurement canvas in the same document realm as the host. Stubbing the
// canvas prototype before the first width read exercises the no-2D-context fallback without
// sharing or poisoning another document's cached context.
it('edgeLabelWidth falls back to a character-count heuristic when its owner-realm canvas has no 2D context', async () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  (
    HTMLCanvasElement.prototype as unknown as {
      getContext: (...args: unknown[]) => unknown;
    }
  ).getContext = function (this: HTMLCanvasElement) {
    return null;
  };
  try {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    const internal = el as unknown as {
      edgeLabelWidth: (t: string) => number;
      edgeLabelFontPx: () => number;
    };
    const text = 'no-ctx-fallback-probe';
    const width = internal.edgeLabelWidth(text);
    expect(width).to.equal(text.length * internal.edgeLabelFontPx() * 0.6);
  } finally {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  }
});

it('shows a loading skeleton and aria-busy while d3 loads, then swaps to the svg', async () => {
  const el = document.createElement('lr-graph') as unknown as LyraGraph;
  const internals = el as unknown as { loadLibrary: () => Promise<unknown> };
  const loadLibrary = internals.loadLibrary;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  internals.loadLibrary = () => pending.then(loadLibrary);
  el.strings = { loading: 'Loading graph data' };
  document.body.append(el);
  try {
    await el.updateComplete;
    expect(el.getAttribute('aria-busy')).to.equal('true');
    const skeleton = el.shadowRoot!.querySelector('lr-skeleton')!;
    expect(skeleton !== null).to.be.true;
    await (skeleton as HTMLElement & { updateComplete: Promise<unknown> })
      .updateComplete;
    expect(el.shadowRoot!.querySelector('.loading-label')!.textContent).to.equal(
      'Loading graph data'
    );
    expect(
      el.shadowRoot!.querySelector(
        '[role="alert"], [role="status"], [aria-live]'
      ) === null,
      'the controller-owned loading state must not create a second shadow live region'
    ).to.be.true;
    expect(el.shadowRoot!.querySelector('svg') == null).to.equal(true);

    el.nodes = nodes;
    el.edges = links;
    release();
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );

    expect(el.getAttribute('aria-busy')).to.equal('false');
    expect(el.shadowRoot!.querySelector('lr-skeleton') == null).to.be.true;
    expect(el.shadowRoot!.querySelector('svg') != null).to.equal(true);
  } finally {
    el.remove();
  }
});

it('announces graph navigation through one light-DOM sink without speaking the initial item', async () => {
  const el = (await fixture(html`<lr-graph seed="7"></lr-graph>`)) as LyraGraph;
  el.strings = { graphItemAnnouncement: '{item}, position {index} of {total}' };
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

  const sink = announcementSink();
  expect(
    sink !== null,
    'a connected graph must acquire its sink before announcing'
  ).to.be.true;
  expect(
    sink!.getRootNode() === document,
    'the live region must be in document light DOM'
  ).to.be.true;
  expect(
    announcementTexts(),
    'mounting a graph must not announce its initial graph item'
  ).to.deep.equal([]);

  const mirror = el.shadowRoot!.querySelector(
    '[part="live-region"]'
  ) as HTMLElement;
  expect(mirror.getAttribute('aria-hidden')).to.equal('true');
  expect(
    mirror.hasAttribute('aria-live'),
    'the mirror must not be a second live region'
  ).to.be.false;
  expect(mirror.hasAttribute('role')).to.be.false;
  expect(mirror.textContent).to.contain('position 1 of 3');

  const firstNode = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;
  firstNode.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
  );
  await el.updateComplete;
  expect(announcementTexts()).to.have.length(1);
  expect(announcementTexts()[0]).to.contain('position 2 of 3');
});

it('releases and reacquires its announcement sink when adopted into another document', async () => {
  const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const foreignDocument = frame.contentDocument!;
  const el = asTestGraph(document.createElement('lr-graph'));
  el.seed = 7;
  el.selectionMode = 'single';
  el.nodes = nodes;
  el.edges = links;
  document.body.appendChild(el);

  try {
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    const originalSink = announcementSink();
    const originalAssertiveSink = announcementSink(document, 'assertive');
    expect(
      originalSink !== null,
      'the original document must own the connected graph sink'
    ).to.be.true;
    expect(originalAssertiveSink !== null).to.be.true;

    foreignDocument.adoptNode(el);
    expect(
      originalSink!.isConnected,
      'adoption must release the old document sink'
    ).to.be.false;
    expect(originalAssertiveSink!.isConnected).to.be.false;
    foreignDocument.body.appendChild(el);
    await el.updateComplete;

    const adoptedSink = announcementSink(foreignDocument);
    const adoptedAssertiveSink = announcementSink(foreignDocument, 'assertive');
    expect(
      adoptedSink !== null,
      'reconnect must acquire a sink in the adopted document'
    ).to.be.true;
    expect(adoptedAssertiveSink !== null).to.be.true;
    expect(adoptedSink!.ownerDocument === foreignDocument).to.be.true;
    expect(
      announcementTexts(foreignDocument),
      'reconnect must not re-announce stale state'
    ).to.deep.equal([]);

    el.selectedNodeIds = ['a'];
    await el.updateComplete;
    expect(announcementTexts(foreignDocument)).to.have.length(1);
    expect(announcementTexts(foreignDocument)[0]).to.contain('1 selected');
    expect(
      announcementTexts(),
      'nothing may be announced into the old document'
    ).to.deep.equal([]);

    el.remove();
    expect(
      adoptedSink!.isConnected,
      'disconnect must release the adopted document sink'
    ).to.be.false;
    expect(adoptedAssertiveSink!.isConnected).to.be.false;
  } finally {
    el.remove();
    frame.remove();
  }
});

it('rebinds canvas observers, DPR/media state, frames, styles, and offscreen surfaces after adoption', async () => {
  const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const foreignDocument = frame.contentDocument!;
  const foreignWindow = frame.contentWindow!;
  const el = asTestGraph(document.createElement('lr-graph'));
  el.renderer = 'canvas';
  el.seed = 7;
  el.nodes = nodes;
  el.edges = links;
  document.body.appendChild(el);
  await el.updateComplete;
  await waitUntil(
    () => el.shadowRoot!.querySelectorAll('canvas').length === 1,
    undefined,
    {
      timeout: NODE_COUNT_TIMEOUT,
    }
  );
  await waitUntil(
    () => (el as unknown as { d3?: unknown }).d3 !== undefined,
    undefined,
    {
      timeout: NODE_COUNT_TIMEOUT,
    }
  );

  const OriginalResizeObserver = foreignWindow.ResizeObserver;
  const OriginalIntersectionObserver = foreignWindow.IntersectionObserver;
  const originalRequestAnimationFrame = foreignWindow.requestAnimationFrame;
  const originalCancelAnimationFrame = foreignWindow.cancelAnimationFrame;
  const originalMatchMedia = foreignWindow.matchMedia;
  const originalGetComputedStyle = foreignWindow.getComputedStyle;
  const originalCreateElement = foreignDocument.createElement;
  let resizeObservers = 0;
  let intersectionObservers = 0;
  let nextFrame = 80;
  const requestedFrames: number[] = [];
  const canceledFrames: number[] = [];
  const mediaQueries: string[] = [];
  let styleReads = 0;
  const createdNames: string[] = [];

  class RealmResizeObserver {
    constructor(_callback: ResizeObserverCallback) {
      resizeObservers += 1;
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  class RealmIntersectionObserver {
    readonly root = null;
    readonly rootMargin = '0px';
    readonly thresholds = [0];
    constructor(_callback: IntersectionObserverCallback) {
      intersectionObservers += 1;
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  (
    foreignWindow as unknown as { ResizeObserver: typeof ResizeObserver }
  ).ResizeObserver = RealmResizeObserver as unknown as typeof ResizeObserver;
  (
    foreignWindow as unknown as {
      IntersectionObserver: typeof IntersectionObserver;
    }
  ).IntersectionObserver =
    RealmIntersectionObserver as unknown as typeof IntersectionObserver;
  foreignWindow.requestAnimationFrame = ((_callback: FrameRequestCallback) => {
    const id = nextFrame++;
    requestedFrames.push(id);
    return id;
  }) as typeof requestAnimationFrame;
  foreignWindow.cancelAnimationFrame = ((id: number) => {
    canceledFrames.push(id);
  }) as typeof cancelAnimationFrame;
  foreignWindow.matchMedia = ((query: string) => {
    mediaQueries.push(query);
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener(): void {},
      removeListener(): void {},
      addEventListener(): void {},
      removeEventListener(): void {},
      dispatchEvent(): boolean {
        return true;
      },
    };
  }) as typeof matchMedia;
  foreignWindow.getComputedStyle = ((
    element: Element,
    pseudo?: string | null
  ) => {
    styleReads += 1;
    return originalGetComputedStyle.call(foreignWindow, element, pseudo);
  }) as typeof getComputedStyle;
  foreignDocument.createElement = ((
    name: string,
    options?: ElementCreationOptions
  ) => {
    createdNames.push(name);
    return originalCreateElement.call(foreignDocument, name, options);
  }) as typeof foreignDocument.createElement;

  try {
    foreignDocument.adoptNode(el);
    foreignDocument.body.appendChild(el);
    await el.updateComplete;

    expect(resizeObservers).to.equal(1);
    expect(intersectionObservers).to.equal(1);
    expect(mediaQueries.some((query) => query.startsWith('(resolution: '))).to
      .be.true;
    const internals = el as unknown as {
      pickCanvas?: HTMLCanvasElement;
      drawCanvas(): void;
      scheduleViewportChange(): void;
      onCanvasPointerMove(event: PointerEvent): void;
    };
    expect(internals.pickCanvas?.ownerDocument === foreignDocument).to.be.true;
    expect(createdNames).to.include('canvas');
    internals.drawCanvas();
    expect(styleReads).to.be.greaterThan(0);
    internals.scheduleViewportChange();
    internals.onCanvasPointerMove({ clientX: 1, clientY: 1 } as PointerEvent);
    const focusResult = el.focusNode('a');
    expect(requestedFrames.length).to.be.greaterThan(3);

    const pendingFrames = [...requestedFrames];
    el.remove();
    expect(await focusResult).to.be.false;
    expect(pendingFrames.every((id) => canceledFrames.includes(id))).to.be.true;
  } finally {
    el.remove();
    (
      foreignWindow as unknown as { ResizeObserver: typeof ResizeObserver }
    ).ResizeObserver = OriginalResizeObserver;
    (
      foreignWindow as unknown as {
        IntersectionObserver: typeof IntersectionObserver;
      }
    ).IntersectionObserver = OriginalIntersectionObserver;
    foreignWindow.requestAnimationFrame = originalRequestAnimationFrame;
    foreignWindow.cancelAnimationFrame = originalCancelAnimationFrame;
    foreignWindow.matchMedia = originalMatchMedia;
    foreignWindow.getComputedStyle = originalGetComputedStyle;
    foreignDocument.createElement = originalCreateElement;
    frame.remove();
  }
});

it('renders an svg with a circle per node once d3 loads', async () => {
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
  expect(el.shadowRoot!.querySelectorAll('[part="link"]').length).to.equal(1);
});

it('keeps SVG node, link, and conditional-hull pointer geometry at least 24px under scale', async () => {
  const el = (await fixture(
    html`<lr-graph
      seed="7"
      width="400"
      height="300"
      style="inline-size:400px;block-size:300px"
    ></lr-graph>`
  )) as LyraGraph;
  el.communities = [{ id: 'team', memberIds: ['a', 'b'] }];
  el.nodes = [
    { id: 'a', label: 'A', communityId: 'team', radius: 6 },
    { id: 'b', label: 'B', communityId: 'team', radius: 6 },
  ];
  el.edges = [{ id: 'ab', source: 'a', target: 'b', width: 1 }];
  await el.updateComplete;
  await waitUntil(
    () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
    undefined,
    {
      timeout: NODE_COUNT_TIMEOUT,
    }
  );

  const hits = {
    node: [
      ...el.shadowRoot!.querySelectorAll<SVGElement>('[data-hit-area="node"]'),
    ],
    link: [
      ...el.shadowRoot!.querySelectorAll<SVGElement>('[data-hit-area="link"]'),
    ],
    hull: [
      ...el.shadowRoot!.querySelectorAll<SVGElement>('[data-hit-area="hull"]'),
    ],
  };
  expect(hits.node).to.have.length(2);
  expect(hits.link).to.have.length(1);
  expect(hits.hull).to.have.length(1);
  for (const [kind, elements] of Object.entries(hits)) {
    for (const hit of elements) {
      expect(hit.hasAttribute('part'), `${kind} hit is internal`).to.be.false;
      expect(
        hit.getAttribute('aria-hidden'),
        `${kind} hit is not duplicated for AT`
      ).to.equal('true');
      expect(
        Number.parseFloat(getComputedStyle(hit).strokeWidth),
        `${kind} stroke`
      ).to.be.at.least(24);
    }
  }
  expect(await el.focusNode('a', { zoom: 0.25 })).to.equal(true);
  el.scrollIntoView({ block: 'center', inline: 'center' });
  await aTimeout(0);
  const renderedNode =
    el.shadowRoot!.querySelector<SVGGraphicsElement>('[part="node"]')!;
  const renderedNodeRect = renderedNode.getBoundingClientRect();
  const nodeCenter = {
    x: renderedNodeRect.left + renderedNodeRect.width / 2,
    y: renderedNodeRect.top + renderedNodeRect.height / 2,
  };
  // Probe the browser's real pointer dispatch. WebKit's ShadowRoot.elementFromPoint() returns the
  // outer SVG for this coordinate even though native hit testing correctly reaches the line; a
  // failed DOM-node equality assertion also makes WTR recursively serialize the SVG tree.
  let pointerActivations = 0;
  el.addEventListener('lr-node-activate', () => pointerActivations++);
  try {
    await resetMouse();
    await sendMouse({
      type: 'click',
      position: [Math.round(nodeCenter.x + 11), Math.round(nodeCenter.y)],
    });
    expect(pointerActivations, 'scaled node pointer edge').to.equal(1);
  } finally {
    await resetMouse();
  }
  expect(select(hits.node[0]!).on('mousedown.drag')).to.be.a('function');

  const activations: string[] = [];
  el.addEventListener('lr-node-activate', () => activations.push('node'));
  el.addEventListener('lr-edge-activate', () => activations.push('link'));
  el.addEventListener('lr-community-activate', () => activations.push('hull'));
  hits.node[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  hits.link[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  hits.hull[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(activations).to.deep.equal(['node', 'link', 'hull']);
});

it('uses the named host as the sole graph owner and restores the inner owner when removed', async () => {
  const el = (await fixture(html`
    <lr-graph aria-label="Citation relationships"></lr-graph>
  `)) as LyraGraph;
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

  const svg = el.shadowRoot!.querySelector('svg')!;
  expect(el.getAttribute('role')).to.equal('group');
  expect(el.getAttribute('aria-label')).to.equal('Citation relationships');
  expect(svg.hasAttribute('role')).to.equal(false);
  expect(svg.hasAttribute('aria-label')).to.equal(false);

  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(el.getAttribute('role')).to.equal('group');
  expect(svg.hasAttribute('aria-label')).to.equal(false);

  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(el.hasAttribute('role')).to.equal(false);
  expect(svg.getAttribute('role')).to.equal('group');
  expect(svg.getAttribute('aria-label')).to.match(/2 nodes/);
});

it('remembers an author-set role and never overwrites it with the default group/aria-label-driven sync', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = nodes;
  el.edges = links;
  await el.updateComplete;
  expect(el.hasAttribute('role')).to.equal(false);

  el.setAttribute('role', 'presentation');
  await el.updateComplete;
  expect(el.getAttribute('role')).to.equal('presentation');

  // Giving the host an aria-label would normally flip the default sync to role="group" -- but an
  // author-set role must never be overwritten by it.
  el.setAttribute('aria-label', 'Citation relationships');
  await el.updateComplete;
  expect(el.getAttribute('role')).to.equal('presentation');

  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(el.getAttribute('role')).to.equal('presentation');
});

it('shares one bounded description-first tooltip model across SVG titles and the data summary', async () => {
  const nodeDescription = `  Node   description ${'n'.repeat(700)}  `;
  const linkDescription = `  Link   description ${'l'.repeat(700)}  `;
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = [
    {
      id: 'a',
      label: 'A',
      accessibleLabel: 'Spoken A',
      description: nodeDescription,
    },
    { id: 'b', label: 'B' },
  ];
  el.edges = [
    {
      id: 'ab',
      source: 'a',
      target: 'b',
      label: 'Visible link label',
      accessibleLabel: 'Spoken link label',
      description: linkDescription,
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

  const nodeTitle = el.shadowRoot!.querySelector('[part="node"] title')!
    .textContent!;
  const linkTitle = el.shadowRoot!.querySelector('[part="link"] title')!
    .textContent!;
  expect(nodeTitle.startsWith('Node description ')).to.equal(true);
  expect(linkTitle.startsWith('Link description ')).to.equal(true);
  expect(nodeTitle.length).to.be.at.most(513);
  expect(linkTitle.length).to.be.at.most(513);
  expect(nodeTitle.endsWith('…')).to.equal(true);
  expect(linkTitle.endsWith('…')).to.equal(true);
  const summaries = [
    ...el.shadowRoot!.querySelectorAll('[part="data-list"] li'),
  ].map((item) => item.textContent ?? '');
  expect(summaries.some((summary) => summary.includes(nodeTitle))).to.equal(
    true
  );
  expect(summaries.some((summary) => summary.includes(linkTitle))).to.equal(
    true
  );
});

it('fails closed on malformed node and link text without coercion while retaining valid siblings', async () => {
  let coercionCalls = 0;
  const nonStringText = {
    toString() {
      coercionCalls += 1;
      throw new Error('graph text must not be coerced');
    },
    valueOf() {
      coercionCalls += 1;
      throw new Error('graph text must not be coerced');
    },
  };
  const el = (await fixture(
    html`<lr-graph seed="7" with-edge-labels></lr-graph>`
  )) as LyraGraph;
  (el as unknown as { nodes: unknown }).nodes = [
    {
      id: 'numeric',
      label: 42,
      accessibleLabel: nonStringText,
      description: nonStringText,
    },
    {
      id: 'valid',
      label: 'Visible node',
      accessibleLabel: 'Spoken valid node',
      description: 'Valid node detail',
    },
  ];
  (el as unknown as { edges: unknown }).edges = [
    {
      id: 'malformed',
      source: 'numeric',
      target: 'valid',
      label: nonStringText,
      accessibleLabel: 42,
      description: nonStringText,
    },
    {
      id: 'valid-link',
      source: 'valid',
      target: 'numeric',
      label: 'Visible link',
      accessibleLabel: 'Spoken valid link',
      description: 'Valid link detail',
    },
  ];
  await el.updateComplete;
  await waitUntil(
    () =>
      el.shadowRoot!.querySelectorAll('[part="node"]').length === 2 &&
      el.shadowRoot!.querySelectorAll('[part="link"]').length === 2,
    undefined,
    { timeout: NODE_COUNT_TIMEOUT }
  );

  const nodeEls = Array.from(
    el.shadowRoot!.querySelectorAll<SVGElement>('[part="node"]')
  );
  const linkEls = Array.from(
    el.shadowRoot!.querySelectorAll<SVGElement>('[part="link"]')
  );
  expect(nodeEls[0]!.getAttribute('aria-label')).to.equal('numeric');
  expect(nodeEls[0]!.querySelector('title')?.textContent).to.equal('numeric');
  expect(nodeEls[1]!.getAttribute('aria-label')).to.equal('Spoken valid node');
  expect(nodeEls[1]!.querySelector('title')?.textContent).to.equal(
    'Valid node detail'
  );
  expect(linkEls[0]!.getAttribute('aria-label')?.includes('numeric')).to.equal(
    true
  );
  expect(linkEls[0]!.querySelector('title')?.textContent).to.equal(
    linkEls[0]!.getAttribute('aria-label')
  );
  expect(linkEls[1]!.getAttribute('aria-label')).to.equal('Spoken valid link');
  expect(linkEls[1]!.querySelector('title')?.textContent).to.equal(
    'Valid link detail'
  );
  expect(
    Array.from(
      el.shadowRoot!.querySelectorAll<SVGTextElement>('[part="link-label"]')
    ).map((label) => label.textContent)
  ).to.deep.equal(['Visible link']);
  const summaries = Array.from(
    el.shadowRoot!.querySelectorAll('[part="data-list"] li')
  ).map((item) => item.textContent ?? '');
  expect(summaries.some((summary) => summary.includes('numeric'))).to.equal(
    true
  );
  expect(
    summaries.some((summary) => summary.includes('[object Object]'))
  ).to.equal(false);

  nodeEls[0]!.focus();
  const liveRegion = el.shadowRoot!.querySelector('[part="live-region"]')!;
  await waitUntil(() => liveRegion.textContent?.includes('numeric') ?? false);
  expect(coercionCalls).to.equal(0);
});

it('keeps zero-width and fully transparent links non-operable while retaining topology summaries', async () => {
  const el = (await fixture(
    html`<lr-graph style="--transparent-link: transparent"></lr-graph>`
  )) as LyraGraph;
  el.nodes = nodes;
  el.edges = [
    { id: 'zero', source: 'a', target: 'b', width: 0, label: 'Zero width' },
    {
      id: 'clear',
      source: 'a',
      target: 'b',
      color: 'rgba(1, 2, 3, 0)',
      label: 'Transparent',
    },
    {
      id: 'clear-hex',
      source: 'a',
      target: 'b',
      color: '#1230',
      label: 'Transparent hex',
    },
    {
      id: 'clear-hsl',
      source: 'a',
      target: 'b',
      color: 'hsl(120 50% 50% / 0)',
      label: 'Transparent HSL',
    },
    {
      id: 'clear-token',
      source: 'a',
      target: 'b',
      color: 'var(--transparent-link)',
      label: 'Transparent token',
    },
    {
      id: 'clear-mix',
      source: 'a',
      target: 'b',
      color: 'color-mix(in srgb, red 0%, transparent)',
      label: 'Transparent mix',
    },
    { id: 'visible', source: 'a', target: 'b', label: 'Visible' },
  ];
  await el.updateComplete;
  await waitUntil(
    () => el.shadowRoot!.querySelectorAll('[part="link"]').length === 7,
    undefined,
    {
      timeout: NODE_COUNT_TIMEOUT,
    }
  );
  const rendered = [
    ...el.shadowRoot!.querySelectorAll<SVGLineElement>('[part="link"]'),
  ];
  expect(
    rendered
      .slice(0, 6)
      .map((link) => [link.getAttribute('role'), link.getAttribute('tabindex')])
  ).to.deep.equal(Array.from({ length: 6 }, () => [null, null]));
  expect(
    rendered
      .slice(0, 6)
      .every((link) => link.getAttribute('aria-hidden') === 'true')
  ).to.equal(true);
  expect(rendered[6]!.getAttribute('role')).to.equal('button');
  expect(
    [...el.shadowRoot!.querySelectorAll('[part="data-list"] li')].filter(
      (item) => /Zero width|Transparent|Visible/.test(item.textContent ?? '')
    ).length
  ).to.equal(7);
  let activations = 0;
  el.addEventListener('lr-edge-activate', () => activations++);
  for (const link of rendered.slice(0, 6))
    link.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(activations).to.equal(0);

  el.renderer = 'canvas';
  await el.updateComplete;
  await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'), undefined, {
    timeout: NODE_COUNT_TIMEOUT,
  });
  expect(
    el.shadowRoot!.querySelectorAll('[part="cursor-item"]').length
  ).to.equal(1);
  expect(
    (el as unknown as { navigableLinks: () => unknown[] }).navigableLinks()
      .length
  ).to.equal(1);
});

it('treats a link as visible when the canvas-based paint-visibility probe itself throws', async () => {
  // Stubbing CanvasRenderingContext2D.prototype.getImageData directly (rather than relying on
  // how any engine happens to react to a specific color) deterministically forces the
  // opacity-probe's own try/catch fallback -- an unreadable probe must not silently misclassify
  // an otherwise-normal link as invisible/non-operable.
  const proto = CanvasRenderingContext2D.prototype;
  const originalGetImageData = proto.getImageData;
  proto.getImageData = (() => {
    throw new Error('readback unavailable');
  }) as typeof proto.getImageData;
  try {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.edges = [{ id: 'probe-throws', source: 'a', target: 'b' }];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      { timeout: NODE_COUNT_TIMEOUT }
    );
    const link = el.shadowRoot!.querySelector('[part="link"]')!;
    expect(link.getAttribute('role')).to.equal('button');
    expect(
      (el as unknown as { navigableLinks: () => unknown[] }).navigableLinks()
        .length
    ).to.equal(1);
  } finally {
    proto.getImageData = originalGetImageData;
  }
});

it('uses the effective default link paint when deciding whether a link is operable', async () => {
  const el = (await fixture(
    html`<lr-graph style="--lr-graph-edge-color: transparent"></lr-graph>`
  )) as LyraGraph;
  el.nodes = nodes;
  el.edges = [{ id: 'default-paint', source: 'a', target: 'b' }];
  await el.updateComplete;
  await waitUntil(
    () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
    undefined,
    { timeout: NODE_COUNT_TIMEOUT }
  );
  const link = el.shadowRoot!.querySelector('[part="link"]')!;
  expect(link.getAttribute('role')).to.equal(null);
  expect(link.getAttribute('tabindex')).to.equal(null);
  expect(link.getAttribute('aria-hidden')).to.equal('true');

  el.style.setProperty('--lr-graph-edge-color', 'rgb(1, 2, 3)');
  el.requestUpdate();
  await el.updateComplete;
  expect(link.getAttribute('role')).to.equal('button');
  expect(link.getAttribute('tabindex')).to.equal('-1');
  expect(link.getAttribute('aria-hidden')).to.equal(null);
});

it('emits lr-node-activate when a node is activated', async () => {
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
  let detail: { nodeId: string; x: number; y: number } | undefined;
  el.addEventListener(
    'lr-node-activate',
    (e) => (detail = (e as CustomEvent).detail)
  );
  (el.shadowRoot!.querySelector('[part="node"]') as HTMLElement).dispatchEvent(
    new MouseEvent('click', { bubbles: true })
  );
  expect(detail).to.exist;
  expect(detail!.nodeId).to.equal('a');
  expect(detail!.x).to.be.a('number');
  expect(detail!.y).to.be.a('number');
});

it('emits lr-edge-activate with the source/target ids when a link is activated', async () => {
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
  let detail: { sourceNodeId: string; targetNodeId: string } | undefined;
  el.addEventListener(
    'lr-edge-activate',
    (e) => (detail = (e as CustomEvent).detail)
  );
  (el.shadowRoot!.querySelector('[part="link"]') as HTMLElement).dispatchEvent(
    new MouseEvent('click', { bubbles: true })
  );
  expect(detail).to.deep.equal({ sourceNodeId: 'a', targetNodeId: 'b' });
});

it('exposes resolved node coordinates for click-anchored overlays', async () => {
  const el = await graphSupport.mountGraphPair(7);

  const position = el.getNodePosition('a');
  expect(position).to.exist;
  expect(position!.x).to.be.a('number');
  expect(position!.y).to.be.a('number');
  expect(el.getNodePosition('missing')).to.be.undefined;
});

describe('hover events', () => {
  it('emits lr-node-enter/lr-node-leave and toggles data-hovered on the node element', async () => {
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

    let enterDetail: { nodeId: string } | undefined;
    let leaveDetail: { nodeId: string } | undefined;
    el.addEventListener(
      'lr-node-enter',
      (e) => (enterDetail = (e as CustomEvent).detail)
    );
    el.addEventListener(
      'lr-node-leave',
      (e) => (leaveDetail = (e as CustomEvent).detail)
    );

    nodeEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(enterDetail).to.deep.equal({ nodeId: 'a' });
    expect(nodeEl.hasAttribute('data-hovered')).to.be.true;

    nodeEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(leaveDetail).to.deep.equal({ nodeId: 'a' });
    expect(nodeEl.hasAttribute('data-hovered')).to.be.false;
  });

  it('emits lr-edge-enter/lr-edge-leave with source/target ids and toggles data-hovered on the link element', async () => {
    const el = await graphSupport.mountGraphPair();
    const linkEl = el.shadowRoot!.querySelector('[part="link"]') as SVGElement;

    let enterDetail: { sourceNodeId: string; targetNodeId: string } | undefined;
    el.addEventListener(
      'lr-edge-enter',
      (e) => (enterDetail = (e as CustomEvent).detail)
    );

    linkEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(enterDetail).to.deep.equal({ sourceNodeId: 'a', targetNodeId: 'b' });
    expect(linkEl.hasAttribute('data-hovered')).to.be.true;

    linkEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(linkEl.hasAttribute('data-hovered')).to.be.false;
  });

  it('suppresses hover events and the data-hovered attribute while a drag is in progress', async () => {
    const el = await graphSupport.mountGraphPair();
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;

    (el as unknown as { isDragging: boolean }).isDragging = true;
    let fired = false;
    el.addEventListener('lr-node-enter', () => (fired = true));
    nodeEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(fired).to.be.false;
    expect(nodeEl.hasAttribute('data-hovered')).to.be.false;
  });

  it('suppresses hover events while panning', async () => {
    const el = await graphSupport.mountGraphPair();
    const nodeEl = el.shadowRoot!.querySelector('[part="node"]') as SVGElement;

    (el as unknown as { isPanning: boolean }).isPanning = true;
    let fired = false;
    el.addEventListener('lr-node-enter', () => (fired = true));
    nodeEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(fired).to.be.false;
  });

  it('suppresses hover events during a programmatic camera tween (regression)', async () => {
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

    (el as unknown as { isCameraTweening: boolean }).isCameraTweening = true;
    let fired = false;
    el.addEventListener('lr-node-enter', () => (fired = true));
    nodeEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(fired).to.be.false;
  });

  it('does not fire lr-edge-enter/lr-edge-leave or set data-hovered for a dangling-stub link', async () => {
    // A dangling stub's `target` is a synthetic stand-in that never resolves to a real node (see
    // SimLink.dangling) -- emitting a link-identity hover event for it would hand a consumer an id
    // guaranteed to never match anything in `nodes`, so the stub is deliberately excluded from
    // hover wiring the same way it's excluded from click/focus/keydown/tooltip/accessible-list.
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
    const stub = el.shadowRoot!.querySelector(
      '[part="link"][data-dangling]'
    ) as SVGLineElement;
    expect(stub != null).to.equal(true);

    let fired = false;
    el.addEventListener('lr-edge-enter', () => (fired = true));
    el.addEventListener('lr-edge-leave', () => (fired = true));

    stub.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(fired).to.be.false;
    expect(stub.hasAttribute('data-hovered')).to.be.false;

    stub.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(fired).to.be.false;
    expect(stub.hasAttribute('data-hovered')).to.be.false;
  });

  it('suppresses lr-edge-enter/lr-edge-leave and data-hovered while dragging (onLinkEnter/onLinkLeave twin of the node guard)', async () => {
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
    const linkEl = el.shadowRoot!.querySelector('[part="link"]') as SVGElement;

    (el as unknown as { isDragging: boolean }).isDragging = true;
    let fired = false;
    el.addEventListener('lr-edge-enter', () => (fired = true));
    el.addEventListener('lr-edge-leave', () => (fired = true));

    linkEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(fired).to.be.false;
    expect(linkEl.hasAttribute('data-hovered')).to.be.false;

    linkEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(fired).to.be.false;
    expect(linkEl.hasAttribute('data-hovered')).to.be.false;
  });

  it("includes the link's explicit id in lr-edge-enter/lr-edge-leave detail when the link has one", async () => {
    const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
    el.nodes = nodes;
    el.edges = [{ id: 'e1', source: 'a', target: 'b' }];
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
      undefined,
      {
        timeout: NODE_COUNT_TIMEOUT,
      }
    );
    const linkEl = el.shadowRoot!.querySelector('[part="link"]') as SVGElement;

    let enterDetail:
      | { sourceNodeId: string; targetNodeId: string; edgeId?: string }
      | undefined;
    let leaveDetail:
      | { sourceNodeId: string; targetNodeId: string; edgeId?: string }
      | undefined;
    el.addEventListener(
      'lr-edge-enter',
      (e) => (enterDetail = (e as CustomEvent).detail)
    );
    el.addEventListener(
      'lr-edge-leave',
      (e) => (leaveDetail = (e as CustomEvent).detail)
    );

    linkEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(enterDetail).to.deep.equal({
      sourceNodeId: 'a',
      targetNodeId: 'b',
      edgeId: 'e1',
    });

    linkEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(leaveDetail).to.deep.equal({
      sourceNodeId: 'a',
      targetNodeId: 'b',
      edgeId: 'e1',
    });
  });
});

it('renders directed links with arrowheads shortened to the target radius', async () => {
  const el = (await fixture(
    html`<lr-graph seed="42"></lr-graph>`
  )) as LyraGraph;
  el.nodes = nodes;
  el.edges = [{ source: 'a', target: 'b', directed: true }];
  await el.updateComplete;
  await waitUntil(
    () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
    undefined,
    {
      timeout: NODE_COUNT_TIMEOUT,
    }
  );
  const link = el.shadowRoot!.querySelector('[part="link"]') as SVGLineElement;
  const target = el.shadowRoot!.querySelectorAll(
    '[part="node"]'
  )[1] as SVGCircleElement;
  expect(link.getAttribute('marker-end')).to.match(/^url\(#lr-graph-arrow-/);
  expect(link.getAttribute('x2')).to.not.equal(target.getAttribute('cx'));
  expect(el.shadowRoot!.querySelector('[part="arrowhead"]')).to.exist;
});

it('uses rich accessible labels/descriptions and carries a stable link id through activation', async () => {
  const el = (await fixture(
    html`<lr-graph seed="42"></lr-graph>`
  )) as LyraGraph;
  el.nodes = [
    {
      id: 'a',
      label: 'A',
      accessibleLabel: 'Document A, 12 citations',
      description: 'Primary authority',
    },
    { id: 'b', label: 'B' },
  ];
  el.edges = [
    {
      id: 'citation-7',
      source: 'a',
      target: 'b',
      label: 'cites',
      accessibleLabel: 'Document A cites document B seven times',
      description: 'Seven citations',
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
  const firstNode = el.shadowRoot!.querySelector(
    '[part="node"]'
  ) as SVGCircleElement;
  const link = el.shadowRoot!.querySelector('[part="link"]') as SVGLineElement;
  expect(firstNode.getAttribute('aria-label')).to.equal(
    'Document A, 12 citations'
  );
  expect(firstNode.querySelector('title')?.textContent).to.equal(
    'Primary authority'
  );
  expect(link.getAttribute('aria-label')).to.equal(
    'Document A cites document B seven times'
  );
  expect(link.querySelector('title')?.textContent).to.equal('Seven citations');
  let detail:
    | { sourceNodeId: string; targetNodeId: string; edgeId?: string }
    | undefined;
  el.addEventListener(
    'lr-edge-activate',
    (e) => (detail = (e as CustomEvent).detail)
  );
  link.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(detail).to.deep.equal({
    sourceNodeId: 'a',
    targetNodeId: 'b',
    edgeId: 'citation-7',
  });
});

it('applies sanitized per-link color and numeric dash styling', async () => {
  const el = (await fixture(
    html`<lr-graph seed="42"></lr-graph>`
  )) as LyraGraph;
  el.nodes = nodes;
  el.edges = [{ source: 'a', target: 'b', color: '#ff0000', dash: [4, 2] }];
  await el.updateComplete;
  await waitUntil(
    () => el.shadowRoot!.querySelectorAll('[part="node"]').length === 2,
    undefined,
    {
      timeout: NODE_COUNT_TIMEOUT,
    }
  );
  const link = el.shadowRoot!.querySelector('[part="link"]') as SVGLineElement;
  expect(getComputedStyle(link).stroke).to.equal('rgb(255, 0, 0)');
  expect(link.getAttribute('stroke-dasharray')).to.equal('4 2');

  el.edges = [
    {
      source: 'a',
      target: 'b',
      color: 'red; position: fixed',
      dash: [4, -2, Number.NaN],
    },
  ];
  await el.updateComplete;
  expect(
    (el.shadowRoot!.querySelector('[part="link"]') as SVGLineElement).style
      .position
  ).to.equal('');
  expect(
    (
      el.shadowRoot!.querySelector('[part="link"]') as SVGLineElement
    ).hasAttribute('stroke-dasharray')
  ).to.be.false;
});

it('emits lr-node-activate when a node is activated via keyboard (Enter/Space)', async () => {
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
  let detail: { nodeId: string; x: number; y: number } | undefined;
  el.addEventListener(
    'lr-node-activate',
    (e) => (detail = (e as CustomEvent).detail)
  );
  (el.shadowRoot!.querySelector('[part="node"]') as HTMLElement).dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
  );
  expect(detail?.nodeId).to.equal('a');
  expect(detail?.x).to.be.a('number');
  expect(detail?.y).to.be.a('number');
});

it('emits lr-edge-activate when a link is activated via keyboard (Enter/Space)', async () => {
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
  let detail: { sourceNodeId: string; targetNodeId: string } | undefined;
  el.addEventListener(
    'lr-edge-activate',
    (e) => (detail = (e as CustomEvent).detail)
  );
  (el.shadowRoot!.querySelector('[part="link"]') as HTMLElement).dispatchEvent(
    new KeyboardEvent('keydown', { key: ' ', bubbles: true })
  );
  expect(detail).to.deep.equal({ sourceNodeId: 'a', targetNodeId: 'b' });
});

it('gives the svg an accessible name summarizing the diagram, and hides duplicate node labels from assistive tech', async () => {
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
  expect(svgEl.getAttribute('aria-label')).to.match(/2 nodes/);
  const label = el.shadowRoot!.querySelector(
    '[part="label"]'
  ) as SVGTextElement;
  expect(label.getAttribute('aria-hidden')).to.equal('true');
});

it('uses one roving tab stop with arrow/Home/End navigation and a data-list alternative', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.strings = {
    graphItemAnnouncement: '{item}, position {index} sur {total}',
  };
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
  expect(
    items().filter((item) => item.getAttribute('tabindex') === '0')
  ).to.have.length(1);
  expect(
    items().filter((item) => item.getAttribute('tabindex') === '-1')
  ).to.have.length(2);

  items()[0]!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
  );
  await el.updateComplete;
  expect(items()[1]!.getAttribute('tabindex')).to.equal('0');
  expect(
    el.shadowRoot!.querySelector('[part="live-region"]')!.textContent
  ).to.contain('position 2 sur 3');

  items()[1]!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'End', bubbles: true })
  );
  await el.updateComplete;
  expect(items()[2]!.getAttribute('tabindex')).to.equal('0');
  items()[2]!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Home', bubbles: true })
  );
  await el.updateComplete;
  expect(items()[0]!.getAttribute('tabindex')).to.equal('0');

  expect(
    el.shadowRoot!.querySelectorAll('[part="data-list"] li')
  ).to.have.length(3);
});

it('preserves existing node positions across an incremental nodes/links update instead of restarting the whole layout', async () => {
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

  // Let a few ticks run so node 'a' settles away from its initial random start.
  await aTimeout(200);
  const beforeA = (
    el.shadowRoot!.querySelectorAll('[part="node"]')[0] as SVGCircleElement
  ).getAttribute('cx');

  // Append a new node — e.g. a live/streaming data feed pushing one incremental update.
  el.nodes = [...nodes, { id: 'c', label: 'C' }];
  el.edges = [...links, { source: 'a', target: 'c' }];
  await el.updateComplete;

  const afterA = (
    el.shadowRoot!.querySelectorAll('[part="node"]')[0] as SVGCircleElement
  ).getAttribute('cx');
  expect(afterA).to.equal(beforeA);
});

it('applies a per-node LyraGraphNode.color as the actual rendered fill', async () => {
  const el = (await fixture(html`<lr-graph></lr-graph>`)) as LyraGraph;
  el.nodes = [
    { id: 'a', label: 'A', color: '#ff0000' },
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
  const [coloredEl, defaultEl] = [
    ...el.shadowRoot!.querySelectorAll('[part="node"]'),
  ];
  // A stylesheet rule always beats a bare presentation attribute in the SVG/CSS
  // cascade, so this must actually change the computed fill (not just the
  // attribute) to prove the per-node color isn't silently overridden.
  expect(getComputedStyle(coloredEl!).fill).to.equal('rgb(255, 0, 0)');
  expect(getComputedStyle(coloredEl!).fill).to.not.equal(
    getComputedStyle(defaultEl!).fill
  );
});
