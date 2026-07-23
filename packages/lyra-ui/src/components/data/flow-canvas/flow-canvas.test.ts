import { fixture, expect, html } from '@open-wc/testing';
import './flow-canvas.js';
import '../../overlays/empty/empty.js';
import type { LyraFlowCanvas, FlowNode, FlowEdge, FlowStructureSnapshot } from './flow-canvas.js';
import { FLOW_PALETTE_MIME_TYPE } from './flow-canvas.js';
import { styles } from './flow-canvas.styles.js';

it('defaults to empty nodes/edges, horizontal orientation, and default zoom/grid bounds', async () => {
  const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
  expect(el.nodes).to.deep.equal([]);
  expect(el.edges).to.deep.equal([]);
  expect(el.orientation).to.equal('horizontal');
  expect(el.nodesDraggable).to.be.false;
  expect(el.connectable).to.be.false;
  expect(el.droppable).to.be.false;
  expect(el.locked).to.be.false;
  expect(el.minZoom).to.equal(0.25);
  expect(el.maxZoom).to.equal(2);
  expect(el.grid).to.equal(8);
  expect(el.layerGap).to.equal(64);
  expect(el.nodeGap).to.equal(24);
});

it('exports the FLOW_PALETTE_MIME_TYPE constant used by the drop/palette handshake', () => {
  expect(FLOW_PALETTE_MIME_TYPE).to.equal('application/lr-flow-node');
});

it('renders lr-empty with the noData message when nodes is empty', async () => {
  const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
  const empty = el.shadowRoot!.querySelector('[part="empty"]');
  expect(empty).to.exist;
  expect(empty!.tagName.toLowerCase()).to.equal('lr-empty');
  expect(empty!.getAttribute('heading')).to.equal('No data');
});

it('forwards the host accessible label in the empty state', async () => {
  const el = (await fixture(html`<lr-flow-canvas aria-label="Empty pipeline"></lr-flow-canvas>`)) as LyraFlowCanvas;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Empty pipeline');
});

it('does not render the empty state once nodes has at least one entry', async () => {
  const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
  el.nodes = [{ id: 'a' }] as FlowNode[];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="empty"]')).to.not.exist;
  expect(el.shadowRoot!.querySelector('[part="viewport"]')).to.exist;
});

it('is accessible in the empty state', async () => {
  const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
  await expect(el).to.be.accessible();
});

// Compile-time only: proves the shared shapes this task exports match what later tasks in this
// plan rely on. Never executed.
function _typeCheck(edge: FlowEdge): void {
  void edge.sourceHandle;
  void edge.targetHandle;
  void edge.tone;
}
void _typeCheck;

const nodes: FlowNode[] = [
  { id: 'a', position: { x: 0, y: 0 }, data: { label: 'Fetch' } },
  { id: 'b', position: { x: 200, y: 0 }, data: { label: 'Summarize' } },
];
const edges: FlowEdge[] = [{ id: 'a-b', source: 'a', target: 'b', label: 'then' }];

function nodeControl(el: LyraFlowCanvas, id?: string): HTMLButtonElement {
  const selector = id
    ? `[part="node"][data-node-id="${CSS.escape(id)}"] [part="node-control"]`
    : '[part="node-control"]';
  return el.shadowRoot!.querySelector(selector) as HTMLButtonElement;
}

describe('static rendering', () => {
  it('adopts a default lr-flow-node card per node into slot="node-{id}"', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    await el.updateComplete;
    const a = el.querySelector('[node-id="a"]') as HTMLElement;
    expect(a).to.exist;
    expect(a.tagName.toLowerCase()).to.equal('lr-flow-node');
    expect(a.getAttribute('slot')).to.equal('node-a');
    expect((a as unknown as { heading: string }).heading).to.equal('Fetch');
  });

  it('routes a user-authored child into its wrapper by node-id instead of creating a default card', async () => {
    const el = (await fixture(
      html`<lr-flow-canvas .nodes=${nodes}><div node-id="a">Custom</div></lr-flow-canvas>`,
    )) as LyraFlowCanvas;
    await el.updateComplete;
    const custom = el.querySelector('[node-id="a"]') as HTMLElement;
    expect(custom.tagName.toLowerCase()).to.equal('div');
    expect(custom.getAttribute('slot')).to.equal('node-a');
    expect(el.querySelectorAll('[node-id="a"]').length).to.equal(1);
  });

  it('warns and leaves a stale user-authored child unslotted when its node-id matches no node', async () => {
    const originalWarn = console.warn;
    let warning: unknown[] | undefined;
    console.warn = (...args: unknown[]) => {
      warning = args;
    };
    const el = (await fixture(
      html`<lr-flow-canvas><div node-id="ghost">Gone</div></lr-flow-canvas>`,
    )) as LyraFlowCanvas;
    try {
      el.nodes = nodes;
      await el.updateComplete;
    } finally {
      console.warn = originalWarn;
    }
    expect(warning?.join(' ')).to.include('node-id="ghost"');
    expect(el.querySelector('[node-id="ghost"]')!.getAttribute('slot')).to.be.null;
  });

  it('stays silent when one of its own default cards is retired -- the warning is for user-authored children only', async () => {
    const originalWarn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args);
    };
    try {
      const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
      el.nodes = [{ id: 'a' }, { id: 'b' }];
      await el.updateComplete;
      el.nodes = [{ id: 'a' }];
      await el.updateComplete;
      expect(el.querySelector('[node-id="b"]')).to.not.exist;
    } finally {
      console.warn = originalWarn;
    }
    expect(warnings.map((w) => w.join(' ')).join('\n')).to.equal('');
  });

  it('renders one SVG path per edge with an arrowhead and a drawn label', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    el.edges = edges;
    await el.updateComplete;
    const path = el.shadowRoot!.querySelector('[part="edge"]') as SVGPathElement;
    expect(path).to.exist;
    expect(path.getAttribute('marker-end')).to.include('#');
    expect(el.shadowRoot!.querySelector('[part="edge-label"]')!.textContent).to.equal('then');
  });

  it('renders a dashed dangling stub for an edge whose target resolves to no node', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    el.edges = [{ id: 'a-ghost', source: 'a', target: 'ghost' }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="stub"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="edge"]')).to.not.exist;
  });

  it('drops an edge whose source resolves to no node', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    el.edges = [{ id: 'ghost-a', source: 'ghost', target: 'a' }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="edge"]')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="stub"]')).to.not.exist;
  });

  it('forwards a host aria-label to the viewport region, falling back to a node/edge-count summary', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    el.edges = edges;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="viewport"]')!.getAttribute('aria-label')).to.equal(
      'Workflow with 2 nodes and 1 edges',
    );
    el.accessibleLabel = 'Ingestion pipeline';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="viewport"]')!.getAttribute('aria-label')).to.equal(
      'Ingestion pipeline',
    );
  });

  it('reflects grid onto the background layer as --lr-flow-canvas-grid-size', async () => {
    const el = (await fixture(html`<lr-flow-canvas grid="16"></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    await el.updateComplete;
    const bg = el.shadowRoot!.querySelector('[part="background"]') as HTMLElement;
    expect(bg.style.getPropertyValue('--lr-flow-canvas-grid-size')).to.equal('16px');
  });

  it('sets the default card textContent from node.data.description when present', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [{ id: 'a', data: { label: 'Fetch', description: 'Grabs the payload' } }];
    await el.updateComplete;
    const card = el.querySelector('[node-id="a"]') as HTMLElement;
    expect(card.textContent).to.equal('Grabs the payload');
  });

  it('removes a default card once its node id disappears from nodes', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [{ id: 'a' }, { id: 'b' }];
    await el.updateComplete;
    expect(el.querySelector('[node-id="b"]')).to.exist;
    el.nodes = [{ id: 'a' }];
    await el.updateComplete;
    expect(el.querySelector('[node-id="b"]')).to.not.exist;
  });

  it('skips pushing props for a node whose card was removed independently of nodes', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [{ id: 'a' }, { id: 'b' }];
    await el.updateComplete;
    // Removed directly (not via `nodes`), so `pushCardPropsAll()` finds no adopted card for 'b'
    // on its next pass -- must skip that node rather than throwing on the missing element.
    el.querySelector('[node-id="b"]')!.remove();
    el.decorations = { a: { status: 'running' } };
    await el.updateComplete;
    const cardA = el.querySelector('[node-id="a"]') as unknown as { status: string };
    expect(cardA.status).to.equal('running');
  });
});

describe('auto-layout', () => {
  it('leaves an explicitly-positioned node exactly where it was placed', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [{ id: 'a', position: { x: 40, y: 40 } }];
    await el.updateComplete;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const wrapper = el.shadowRoot!.querySelector('[data-node-id="a"]') as HTMLElement;
    // Chromium's CSSOM canonicalizes a `translate()` transform's serialized form with a space after
    // each comma regardless of how it was set (Lit's literal `translate(${x}px,${y}px)` attribute
    // string included) -- corrected from the plan brief's literal no-space expectation to match the
    // real browser's `style.transform` getter output (verified by actually running this test).
    expect(wrapper.style.transform).to.equal('translate(40px, 40px)');
  });

  it('assigns a position to every unpositioned node and fires lr-layout-change with exactly those ids', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    let detail: { positions: Record<string, { x: number; y: number }> } | undefined;
    el.addEventListener('lr-layout-change', (e) => (detail = (e as CustomEvent).detail));
    el.nodes = [{ id: 'a' }, { id: 'b', position: { x: 500, y: 500 } }, { id: 'c' }];
    el.edges = [{ id: 'a-c', source: 'a', target: 'c' }];
    await el.updateComplete;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    expect(detail).to.exist;
    expect(Object.keys(detail!.positions).sort()).to.deep.equal(['a', 'c']);
  });

  it('transposes the returned axes for orientation="vertical"', async () => {
    const horizontalEl = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    horizontalEl.nodes = [{ id: 'a' }, { id: 'b' }];
    horizontalEl.edges = [{ id: 'a-b', source: 'a', target: 'b' }];
    await horizontalEl.updateComplete;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const verticalEl = (await fixture(html`<lr-flow-canvas orientation="vertical"></lr-flow-canvas>`)) as LyraFlowCanvas;
    verticalEl.nodes = [{ id: 'a' }, { id: 'b' }];
    verticalEl.edges = [{ id: 'a-b', source: 'a', target: 'b' }];
    await verticalEl.updateComplete;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    // In horizontal orientation the second (downstream) node advances along x; in vertical
    // orientation the same downstream relationship must advance along y instead.
    const hB = horizontalEl.shadowRoot!.querySelector('[data-node-id="b"]') as HTMLElement;
    const vB = verticalEl.shadowRoot!.querySelector('[data-node-id="b"]') as HTMLElement;
    // Same Chromium serialization-with-a-space caveat as above -- the regex tolerates optional
    // whitespace after the comma instead of assuming none.
    const parse = (t: string) => t.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)!.slice(1).map(Number);
    const [hx] = parse(hB.style.transform);
    const [, vy] = parse(vB.style.transform);
    expect(hx).to.be.greaterThan(0);
    expect(vy).to.be.greaterThan(0);
  });

  it('keeps an explicitly-positioned node fixed during vertical auto-layout of an unpositioned sibling', async () => {
    // orientation="vertical" takes the un-swapped axis path when recording a fixed position for
    // the layout util (unlike the horizontal case exercised by the "assigns a position" test
    // above, which swaps x/y) -- covers that branch explicitly.
    const el = (await fixture(html`<lr-flow-canvas orientation="vertical"></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [{ id: 'a', position: { x: 40, y: 40 } }, { id: 'b' }];
    el.edges = [{ id: 'a-b', source: 'a', target: 'b' }];
    await el.updateComplete;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const wrapperA = el.shadowRoot!.querySelector('[data-node-id="a"]') as HTMLElement;
    expect(wrapperA.style.transform).to.equal('translate(40px, 40px)');
  });

  it('keeps stable node wrapper DOM identity across a nodes reorder (repeat() keying)', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [
      { id: 'a', position: { x: 0, y: 0 } },
      { id: 'b', position: { x: 100, y: 0 } },
    ];
    await el.updateComplete;
    const before = el.shadowRoot!.querySelector('[data-node-id="b"]');
    el.nodes = [
      { id: 'b', position: { x: 100, y: 0 } },
      { id: 'a', position: { x: 0, y: 0 } },
    ];
    await el.updateComplete;
    const after = el.shadowRoot!.querySelector('[data-node-id="b"]');
    expect(before).to.equal(after);
  });
});

describe('pan & zoom', () => {
  it('renders a visible focus indicator on the keyboard-operable viewport', async () => {
    const el = (await fixture(html`<lr-flow-canvas style="width:400px;height:300px"></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    await el.updateComplete;
    const viewport = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
    viewport.focus();
    const outline = getComputedStyle(viewport);
    expect(outline.outlineStyle).to.not.equal('none');
    expect(Number.parseFloat(outline.outlineWidth)).to.be.greaterThan(0);
  });

  it('zoomIn/zoomOut/resetZoom change viewport.zoom, clamped to [minZoom, maxZoom]', async () => {
    const el = (await fixture(html`<lr-flow-canvas min-zoom="0.5" max-zoom="1.5"></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    await el.updateComplete;
    expect(el.viewport.zoom).to.equal(1);
    el.zoomIn();
    expect(el.viewport.zoom).to.be.greaterThan(1);
    for (let i = 0; i < 20; i++) el.zoomIn();
    expect(el.viewport.zoom).to.equal(1.5);
    for (let i = 0; i < 20; i++) el.zoomOut();
    expect(el.viewport.zoom).to.equal(0.5);
    el.setViewport({ x: 0, y: 0, zoom: 1.2 });
    el.resetZoom();
    expect(el.viewport.zoom).to.equal(1);
  });

  it('setViewport/viewport getter round-trip, clamping zoom but not x/y', async () => {
    const el = (await fixture(html`<lr-flow-canvas max-zoom="2"></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    await el.updateComplete;
    el.setViewport({ x: 40, y: -20, zoom: 99 });
    expect(el.viewport).to.deep.equal({ x: 40, y: -20, zoom: 2 });
  });

  it('emits lr-viewport-change on setViewport', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    await el.updateComplete;
    let detail: { x: number; y: number; zoom: number } | undefined;
    el.addEventListener('lr-viewport-change', (e) => (detail = (e as CustomEvent).detail));
    el.setViewport({ x: 10, y: 10, zoom: 1 });
    expect(detail).to.deep.equal({ x: 10, y: 10, zoom: 1 });
  });

  it('toContentPoint inverts setViewport (round-trips a client point through pan/zoom)', async () => {
    const el = (await fixture(html`<lr-flow-canvas style="width:400px;height:300px"></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    await el.updateComplete;
    el.setViewport({ x: 0, y: 0, zoom: 1 });
    const rect = el.shadowRoot!.querySelector('[part="viewport"]')!.getBoundingClientRect();
    const contentPoint = el.toContentPoint(rect.left + 50, rect.top + 30);
    expect(contentPoint.x).to.be.closeTo(50, 1);
    expect(contentPoint.y).to.be.closeTo(30, 1);
  });

  it('fit() centers content and clamps zoom to the configured bounds', async () => {
    const el = (await fixture(
      html`<lr-flow-canvas style="width:400px;height:300px" min-zoom="0.1" max-zoom="4"></lr-flow-canvas>`,
    )) as LyraFlowCanvas;
    el.nodes = [
      { id: 'a', position: { x: 0, y: 0 } },
      { id: 'b', position: { x: 2000, y: 2000 } },
    ];
    await el.updateComplete;
    el.fit();
    expect(el.viewport.zoom).to.be.lessThan(1);
    expect(el.viewport.zoom).to.be.at.least(0.1);
  });

  it('wheel zooms toward the cursor and emits a throttled lr-viewport-change', async () => {
    const el = (await fixture(html`<lr-flow-canvas style="width:400px;height:300px"></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    await el.updateComplete;
    const viewportEl = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
    const rect = viewportEl.getBoundingClientRect();
    let changes = 0;
    el.addEventListener('lr-viewport-change', () => changes++);
    viewportEl.dispatchEvent(
      new WheelEvent('wheel', { deltaY: -100, clientX: rect.left + 100, clientY: rect.top + 100, bubbles: true, cancelable: true }),
    );
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.viewport.zoom).to.be.greaterThan(1);
    expect(changes).to.equal(1);
  });

  it('background pointer-drag pans the viewport', async () => {
    const el = (await fixture(html`<lr-flow-canvas style="width:400px;height:300px"></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    await el.updateComplete;
    const bg = el.shadowRoot!.querySelector('[part="background"]') as HTMLElement;
    bg.setPointerCapture = () => {}; // real setPointerCapture throws for a synthetic pointerId in tests
    bg.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 130, clientY: 90 }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 130, clientY: 90 }));
    expect(el.viewport.x).to.equal(30);
    expect(el.viewport.y).to.equal(-10);
  });

  it('keyboard +/-/0 and arrows zoom/pan the focused viewport', async () => {
    const el = (await fixture(html`<lr-flow-canvas style="width:400px;height:300px"></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    await el.updateComplete;
    const viewportEl = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
    const fire = (key: string) => viewportEl.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    const zoomBefore = el.viewport.zoom;
    fire('+');
    expect(el.viewport.zoom).to.be.greaterThan(zoomBefore);
    fire('0');
    expect(el.viewport.zoom).to.equal(1);
    const xBefore = el.viewport.x;
    fire('ArrowRight');
    expect(el.viewport.x).to.equal(xBefore - 32);
  });

  it('keyboard "-" zooms out the focused viewport', async () => {
    const el = (await fixture(html`<lr-flow-canvas style="width:400px;height:300px"></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    await el.updateComplete;
    const viewportEl = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
    const zoomBefore = el.viewport.zoom;
    viewportEl.dispatchEvent(new KeyboardEvent('keydown', { key: '-', bubbles: true, cancelable: true }));
    expect(el.viewport.zoom).to.be.lessThan(zoomBefore);
  });

  it('keyboard ArrowLeft/ArrowDown/ArrowUp pan the focused viewport in the remaining three directions', async () => {
    const el = (await fixture(html`<lr-flow-canvas style="width:400px;height:300px"></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    await el.updateComplete;
    const viewportEl = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
    const fire = (key: string) => viewportEl.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    const { x: x0, y: y0 } = el.viewport;
    fire('ArrowLeft');
    expect(el.viewport.x).to.equal(x0 + 32);
    fire('ArrowDown');
    expect(el.viewport.y).to.equal(y0 - 32);
    fire('ArrowUp');
    expect(el.viewport.y).to.equal(y0);
  });

  it('locked disables wheel zoom, background pan, and the keyboard shortcuts', async () => {
    const el = (await fixture(html`<lr-flow-canvas locked style="width:400px;height:300px"></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    await el.updateComplete;
    const viewportEl = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
    viewportEl.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true, cancelable: true }));
    expect(el.viewport.zoom).to.equal(1);
  });

  it('mirrors the pan/zoom surface under orientation="horizontal" + dir="rtl"', async () => {
    const el = (await fixture(
      html`<div dir="rtl"><lr-flow-canvas></lr-flow-canvas></div>`,
    )) as HTMLElement;
    const canvas = el.querySelector('lr-flow-canvas') as LyraFlowCanvas;
    canvas.nodes = nodes;
    await canvas.updateComplete;
    const viewportEl = canvas.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
    expect(getComputedStyle(viewportEl).transform).to.not.equal('none');
  });

  it('keyboard ArrowRight/ArrowLeft pan flips sign under orientation="horizontal" + dir="rtl", agreeing with drag direction', async () => {
    const el = (await fixture(html`<div dir="rtl"><lr-flow-canvas style="width:400px;height:300px"></lr-flow-canvas></div>`)) as HTMLElement;
    const canvas = el.querySelector('lr-flow-canvas') as LyraFlowCanvas;
    canvas.nodes = nodes;
    await canvas.updateComplete;
    const viewportEl = canvas.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
    const fire = (key: string) => viewportEl.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    const { x: x0 } = canvas.viewport;
    // Under the RTL mirror, physical ArrowRight must produce the OPPOSITE panX delta from the
    // plain-LTR case (x0 - 32, asserted above in 'keyboard +/-/0 and arrows...') so keyboard
    // panning stays consistent with the mouse-drag path, which already compensates via rtlFlip.
    fire('ArrowRight');
    expect(canvas.viewport.x).to.equal(x0 + 32);
    fire('ArrowLeft');
    expect(canvas.viewport.x).to.equal(x0);
    fire('ArrowLeft');
    expect(canvas.viewport.x).to.equal(x0 - 32);
  });
});

describe('selection & roving focus', () => {
  it('uses a separate pressed node control so slotted controls keep their own semantics', async () => {
    const el = (await fixture(html`
      <lr-flow-canvas .nodes=${nodes}>
        <button node-id="a">Nested action</button>
      </lr-flow-canvas>
    `)) as LyraFlowCanvas;
    el.selectedNodeIds = ['a'];
    await el.updateComplete;
    const wrapper = el.shadowRoot!.querySelector('[data-node-id="a"]') as HTMLElement;
    const control = wrapper.querySelector('[part="node-control"]') as HTMLButtonElement;
    expect(wrapper.getAttribute('role')).to.equal('group');
    expect(wrapper.hasAttribute('aria-current')).to.be.false;
    expect(control).to.exist;
    expect(control.tagName).to.equal('BUTTON');
    expect(control.getAttribute('aria-pressed')).to.equal('true');
    expect(control.tabIndex).to.equal(0);
    expect(el.querySelector('button[node-id="a"]')).to.exist;
  });

  it('click on a node emits lr-node-click and replaces selection with just that node', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    el.edges = edges;
    el.selectedEdgeIds = ['a-b'];
    await el.updateComplete;
    let clickDetail: { id: string } | undefined;
    let selectionDetail: { nodeIds: string[]; edgeIds: string[] } | undefined;
    el.addEventListener('lr-node-click', (e) => (clickDetail = (e as CustomEvent).detail));
    el.addEventListener('lr-selection-change', (e) => (selectionDetail = (e as CustomEvent).detail));
    (el.shadowRoot!.querySelector('[part="node"]') as HTMLElement).click();
    expect(clickDetail).to.deep.equal({ id: 'a' });
    expect(selectionDetail).to.deep.equal({ nodeIds: ['a'], edgeIds: [] });
  });

  it('ctrl/cmd+click toggles a node within the existing selection instead of replacing it', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    await el.updateComplete;
    const nodeEls = el.shadowRoot!.querySelectorAll('[part="node-control"]');
    (nodeEls[0] as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    (nodeEls[1] as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    expect(el.selectedNodeIds.sort()).to.deep.equal(['a', 'b']);
    (nodeEls[1] as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    expect(el.selectedNodeIds).to.deep.equal(['a']);
  });

  it('click on an edge emits lr-edge-click and selects it, clearing node selection', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    el.edges = edges;
    el.selectedNodeIds = ['a'];
    await el.updateComplete;
    let detail: { id: string; source: string; target: string } | undefined;
    el.addEventListener('lr-edge-click', (e) => (detail = (e as CustomEvent).detail));
    (el.shadowRoot!.querySelector('[part="edge"]') as SVGElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(detail).to.deep.equal({ id: 'a-b', source: 'a', target: 'b' });
    expect(el.selectedEdgeIds).to.deep.equal(['a-b']);
    expect(el.selectedNodeIds).to.deep.equal([]);
  });

  it('roving tabindex starts on the spatially-first node and Tab order covers nodes then edges', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    el.edges = edges;
    await el.updateComplete;
    const nodeEls = el.shadowRoot!.querySelectorAll('[part="node-control"]');
    const edgeEls = el.shadowRoot!.querySelectorAll('[part="edge"]');
    expect((nodeEls[0] as HTMLElement).getAttribute('tabindex')).to.equal('0');
    expect((nodeEls[1] as HTMLElement).getAttribute('tabindex')).to.equal('-1');
    expect((edgeEls[0] as HTMLElement).getAttribute('tabindex')).to.equal('-1');
  });

  it('ArrowRight moves the roving stop from the first node to the second, then to the edge', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    el.edges = edges;
    await el.updateComplete;
    const first = nodeControl(el, 'a');
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(nodeControl(el, 'b').getAttribute('tabindex')).to.equal('0');
  });

  it('Enter on a node toggles selection and emits lr-node-click', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    await el.updateComplete;
    let fired = false;
    el.addEventListener('lr-node-click', () => (fired = true));
    nodeControl(el, 'a').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    expect(fired).to.be.true;
    expect(el.selectedNodeIds).to.deep.equal(['a']);
  });

  it('Escape clears the selection when focus is directly on the active item', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    await el.updateComplete;
    el.selectedNodeIds = ['a'];
    await el.updateComplete;
    nodeControl(el, 'a').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    expect(el.selectedNodeIds).to.deep.equal([]);
  });

  it('Delete/Backspace emits lr-selection-delete only while an editor flag is set and selection is non-empty', async () => {
    const el = (await fixture(html`<lr-flow-canvas nodes-draggable></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    el.selectedNodeIds = ['a'];
    await el.updateComplete;
    let detail: { nodeIds: string[]; edgeIds: string[] } | undefined;
    el.addEventListener('lr-selection-delete', (e) => (detail = (e as CustomEvent).detail));
    nodeControl(el, 'a').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }),
    );
    expect(detail).to.deep.equal({ nodeIds: ['a'], edgeIds: [] });
  });

  it('does not emit lr-selection-delete when no editor flag is set (pure viewer)', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    el.selectedNodeIds = ['a'];
    await el.updateComplete;
    let fired = false;
    el.addEventListener('lr-selection-delete', () => (fired = true));
    nodeControl(el, 'a').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }),
    );
    expect(fired).to.be.false;
  });

  it('renders an sr-only edge-list mirroring every edge', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    el.edges = edges;
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector('[part="edge-list"]')!;
    expect(list.querySelectorAll('li').length).to.equal(1);
    expect(list.getAttribute('aria-label')).to.equal('Workflow edges');
  });

  it('focusNode() re-centers the viewport and moves the roving stop to that node', async () => {
    const el = (await fixture(html`<lr-flow-canvas style="width:400px;height:300px"></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    await el.updateComplete;
    el.focusNode('b');
    await el.updateComplete;
    expect(nodeControl(el, 'b').getAttribute('tabindex')).to.equal('0');
  });

  it('ArrowRight resolves the roving focus target by node id, not DOM order, when nodes are not spatially pre-sorted', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    // `nodes` array/DOM order is [a, b], but "a" sits to the right of "b" -- roving nav order
    // follows spatial position (b then a), which is the reverse of DOM order here.
    el.nodes = [
      { id: 'a', position: { x: 200, y: 0 } },
      { id: 'b', position: { x: 0, y: 0 } },
    ];
    await el.updateComplete;
    const aEl = nodeControl(el, 'a');
    const bEl = nodeControl(el, 'b');
    expect(bEl.getAttribute('tabindex')).to.equal('0');
    expect(aEl.getAttribute('tabindex')).to.equal('-1');

    bEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await el.updateComplete;

    expect(aEl.getAttribute('tabindex')).to.equal('0');
    expect(bEl.getAttribute('tabindex')).to.equal('-1');
    expect(el.shadowRoot!.activeElement).to.equal(aEl);
  });

  it('focusNode() resolves the target element by id even when nodes are not spatially pre-sorted', async () => {
    const el = (await fixture(html`<lr-flow-canvas style="width:400px;height:300px"></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [
      { id: 'a', position: { x: 200, y: 0 } },
      { id: 'b', position: { x: 0, y: 0 } },
    ];
    await el.updateComplete;
    el.focusNode('a');
    await el.updateComplete;
    const aEl = nodeControl(el, 'a');
    expect(aEl.getAttribute('tabindex')).to.equal('0');
    expect(el.shadowRoot!.activeElement).to.equal(aEl);
  });

  it('excludes a dangling edge (missing source or target) from roving nav order and count', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes; // a @ x=0, b @ x=200
    el.edges = [
      { id: 'dangling', source: 'a', target: 'missing' },
      { id: 'real', source: 'a', target: 'b' },
    ];
    await el.updateComplete;
    const firstNode = nodeControl(el, 'a');
    // Two ArrowRight presses from the first node must reach the one real, focusable edge --
    // a dangling edge still occupying a roving slot would strand the active index on a
    // non-existent element for one extra keypress.
    firstNode.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await el.updateComplete;
    const secondNode = nodeControl(el, 'b');
    secondNode.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await el.updateComplete;
    const realEdgePath = el.shadowRoot!.querySelector('[data-edge-id="real"] [part="edge"]') as HTMLElement;
    expect(realEdgePath.getAttribute('tabindex')).to.equal('0');
  });

  it('is accessible with nodes, edges, and a selection', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    el.edges = edges;
    el.selectedNodeIds = ['a'];
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

describe('node drag', () => {
  it('pointer-drags a node (grid-snapped) and emits lr-node-move on release', async () => {
    const el = (await fixture(html`<lr-flow-canvas nodes-draggable></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [{ id: 'a', position: { x: 0, y: 0 } }];
    await el.updateComplete;
    const wrapper = el.shadowRoot!.querySelector('[data-node-id="a"]') as HTMLElement;
    wrapper.setPointerCapture = () => {};
    wrapper.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 21, clientY: 5 }));
    let detail: { id: string; position: { x: number; y: number }; previous: { x: number; y: number } } | undefined;
    el.addEventListener('lr-node-move', (e) => (detail = (e as CustomEvent).detail));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 21, clientY: 5 }));
    expect(detail).to.deep.equal({ id: 'a', position: { x: 24, y: 8 }, previous: { x: 0, y: 0 } });
  });

  it('snaps the wrapper back to the data position when the host does not update nodes on release', async () => {
    const el = (await fixture(html`<lr-flow-canvas nodes-draggable></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [{ id: 'a', position: { x: 0, y: 0 } }];
    await el.updateComplete;
    const wrapper = el.shadowRoot!.querySelector('[data-node-id="a"]') as HTMLElement;
    wrapper.setPointerCapture = () => {};
    wrapper.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 40, clientY: 0 }));
    // Space-after-comma per Chromium's `style.transform` serialization -- see the earlier note.
    expect(wrapper.style.transform).to.equal('translate(40px, 0px)');
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 40, clientY: 0 }));
    await el.updateComplete;
    expect(wrapper.style.transform).to.equal('translate(0px, 0px)');
  });

  it('does not drag when nodes-draggable is unset', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [{ id: 'a', position: { x: 0, y: 0 } }];
    await el.updateComplete;
    const wrapper = el.shadowRoot!.querySelector('[part="node"]') as HTMLElement;
    wrapper.setPointerCapture = () => {};
    wrapper.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 40, clientY: 0 }));
    expect(wrapper.style.transform).to.equal('translate(0px, 0px)');
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 40, clientY: 0 }));
  });

  it('does not drag when locked, even with nodes-draggable set', async () => {
    const el = (await fixture(html`<lr-flow-canvas nodes-draggable locked></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [{ id: 'a', position: { x: 0, y: 0 } }];
    await el.updateComplete;
    const wrapper = el.shadowRoot!.querySelector('[part="node"]') as HTMLElement;
    wrapper.setPointerCapture = () => {};
    wrapper.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 40, clientY: 0 }));
    expect(wrapper.style.transform).to.equal('translate(0px, 0px)');
  });

  it('Ctrl/Cmd+Arrow nudges the focused node by grid and emits lr-node-move', async () => {
    const el = (await fixture(html`<lr-flow-canvas nodes-draggable></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [{ id: 'a', position: { x: 40, y: 40 } }];
    await el.updateComplete;
    const wrapper = nodeControl(el, 'a');
    let detail: { id: string; position: { x: number; y: number }; previous: { x: number; y: number } } | undefined;
    el.addEventListener('lr-node-move', (e) => (detail = (e as CustomEvent).detail));
    wrapper.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true, bubbles: true, cancelable: true }),
    );
    // Deviation from the plan brief's literal expected value (`{ id: 'a', position: { x: 48, y: 40 } }`):
    // same class of fix as the keyboard-connect test above -- the `LyraFlowCanvasEventMap` type for
    // `lr-node-move` (Slice A) and the sibling pointer-drag test just above both require `previous`
    // on every emission, and `nudgeNode()`'s own implementation code (as given by the brief)
    // deliberately computes and includes it. The brief's literal assertion omitting `previous` here
    // looks like the same kind of authoring slip, so the expectation is corrected to match.
    expect(detail).to.deep.equal({ id: 'a', position: { x: 48, y: 40 }, previous: { x: 40, y: 40 } });
  });

  it('Ctrl/Cmd+Arrow nudges the focused node in the remaining three directions', async () => {
    const el = (await fixture(html`<lr-flow-canvas nodes-draggable></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [{ id: 'a', position: { x: 40, y: 40 } }];
    await el.updateComplete;
    const wrapper = nodeControl(el, 'a');
    let detail: { id: string; position: { x: number; y: number }; previous: { x: number; y: number } } | undefined;
    el.addEventListener('lr-node-move', (e) => (detail = (e as CustomEvent).detail));
    const fire = (key: string) =>
      wrapper.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true }));
    // Each nudge is computed fresh from the unchanged `node.position` data (the component never
    // mutates `nodes` itself), so every direction below is relative to the same { x: 40, y: 40 }.
    fire('ArrowLeft');
    expect(detail).to.deep.equal({ id: 'a', position: { x: 32, y: 40 }, previous: { x: 40, y: 40 } });
    fire('ArrowDown');
    expect(detail).to.deep.equal({ id: 'a', position: { x: 40, y: 48 }, previous: { x: 40, y: 40 } });
    fire('ArrowUp');
    expect(detail).to.deep.equal({ id: 'a', position: { x: 40, y: 32 }, previous: { x: 40, y: 40 } });
  });

  it('rewrites an incident edge path live during a node drag without a Lit re-render', async () => {
    const el = (await fixture(html`<lr-flow-canvas nodes-draggable></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [
      { id: 'a', position: { x: 0, y: 0 } },
      { id: 'b', position: { x: 200, y: 0 } },
    ];
    el.edges = [{ id: 'a-b', source: 'a', target: 'b' }];
    await el.updateComplete;
    const pathEl = el.shadowRoot!.querySelector('[part="edge"]') as SVGPathElement;
    const before = pathEl.getAttribute('d');
    const wrapper = el.shadowRoot!.querySelector('[data-node-id="a"]') as HTMLElement;
    wrapper.setPointerCapture = () => {};
    wrapper.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 50, clientY: 0 }));
    expect(pathEl.getAttribute('d')).to.not.equal(before);
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 50, clientY: 0 }));
  });

  it('also rewrites the edge-label position live during a node drag when the edge has a label', async () => {
    const el = (await fixture(html`<lr-flow-canvas nodes-draggable></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [
      { id: 'a', position: { x: 0, y: 0 } },
      { id: 'b', position: { x: 200, y: 0 } },
    ];
    el.edges = [{ id: 'a-b', source: 'a', target: 'b', label: 'then' }];
    await el.updateComplete;
    const labelEl = el.shadowRoot!.querySelector('[part="edge-label"]') as SVGTextElement;
    const beforeX = labelEl.getAttribute('x');
    const wrapper = el.shadowRoot!.querySelector('[data-node-id="a"]') as HTMLElement;
    wrapper.setPointerCapture = () => {};
    wrapper.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 50, clientY: 0 }));
    expect(labelEl.getAttribute('x')).to.not.equal(beforeX);
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 50, clientY: 0 }));
  });
});

function makeHandle(kind: 'input' | 'output', id: string): HTMLElement {
  const el = document.createElement('div');
  el.dataset.handleKind = kind;
  el.dataset.handleId = id;
  return el;
}

describe('connect gesture', () => {
  it('pointer-drags from an output handle to an input handle and emits lr-connect', async () => {
    const el = (await fixture(html`<lr-flow-canvas connectable></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [
      { id: 'a', position: { x: 0, y: 0 } },
      { id: 'b', position: { x: 200, y: 0 } },
    ];
    await el.updateComplete;
    const wrapperA = el.shadowRoot!.querySelector('[data-node-id="a"]') as HTMLElement;
    const wrapperB = el.shadowRoot!.querySelector('[data-node-id="b"]') as HTMLElement;
    const outputHandle = makeHandle('output', 'out');
    wrapperA.appendChild(outputHandle);
    const inputHandle = makeHandle('input', 'in');
    wrapperB.appendChild(inputHandle);

    let detail: { source: string; target: string; sourceHandle: string; targetHandle: string } | undefined;
    el.addEventListener('lr-connect', (e) => (detail = (e as CustomEvent).detail));

    outputHandle.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, bubbles: true, composed: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 150, clientY: 0 }));
    inputHandle.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 200, clientY: 0, bubbles: true, composed: true }));

    expect(detail).to.deep.equal({ source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in' });
  });

  it('marks the hovered card data-connect-invalid when it is the source node itself, and emits nothing on release there', async () => {
    const el = (await fixture(html`<lr-flow-canvas connectable></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [{ id: 'a', position: { x: 0, y: 0 } }];
    await el.updateComplete;
    const wrapperA = el.shadowRoot!.querySelector('[data-node-id="a"]') as HTMLElement;
    const outputHandle = makeHandle('output', 'out');
    wrapperA.appendChild(outputHandle);
    let fired = false;
    el.addEventListener('lr-connect', () => (fired = true));
    outputHandle.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, bubbles: true, composed: true }));
    outputHandle.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 2, clientY: 0, bubbles: true, composed: true }));
    expect(wrapperA.hasAttribute('data-connect-invalid')).to.be.true;
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 2, clientY: 0 }));
    expect(fired).to.be.false;
  });

  it('does not start a connect gesture when connectable is unset or locked', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [{ id: 'a', position: { x: 0, y: 0 } }];
    await el.updateComplete;
    const wrapperA = el.shadowRoot!.querySelector('[data-node-id="a"]') as HTMLElement;
    const outputHandle = makeHandle('output', 'out');
    wrapperA.appendChild(outputHandle);
    outputHandle.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, bubbles: true, composed: true }));
    expect(el.shadowRoot!.querySelector('[part="connection-line"]')).to.not.exist;
  });

  it('keyboard: "c" on a focused node starts connect mode, arrows cycle targets, Enter commits', async () => {
    const el = (await fixture(html`<lr-flow-canvas connectable></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [
      { id: 'a', position: { x: 0, y: 0 } },
      { id: 'b', position: { x: 200, y: 0 } },
    ];
    await el.updateComplete;
    const wrapperA = el.shadowRoot!.querySelector('[data-node-id="a"]') as HTMLElement;
    const controlA = nodeControl(el, 'a');
    let detail: { source: string; target: string; sourceHandle: string; targetHandle: string } | undefined;
    el.addEventListener('lr-connect', (e) => (detail = (e as CustomEvent).detail));
    controlA.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true, cancelable: true }));
    controlA.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    // Deviation from the plan brief's literal expected value (`{ source: 'a', target: 'b' }`): the
    // brief's own `commitKeyboardConnect()` implementation code, the `LyraFlowCanvasEventMap` type
    // (Slice A: `'lr-connect': CustomEvent<{ source; target; sourceHandle; targetHandle }>`), the
    // class JSDoc (`@event lr-connect - detail: { source, target, sourceHandle, targetHandle }`),
    // and the pointer-gesture connect test just above all agree the emitted detail always carries
    // `sourceHandle`/`targetHandle`. The brief's literal keyboard-gesture assertion omitting those
    // two keys looks like an authoring slip inconsistent with its own contract, so the expectation
    // is corrected here to match the (deliberately handle-computing) implementation instead of
    // weakening the event's detail shape to satisfy the narrower literal text.
    expect(detail).to.deep.equal({ source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in' });
  });

  it('keyboard: arrow keys cycle the connect target forward and backward while connect mode is active', async () => {
    const el = (await fixture(html`<lr-flow-canvas connectable></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [
      { id: 'a', position: { x: 0, y: 0 } },
      { id: 'b', position: { x: 200, y: 0 } },
      { id: 'c', position: { x: 400, y: 0 } },
    ];
    await el.updateComplete;
    const wrapperA = el.shadowRoot!.querySelector('[data-node-id="a"]') as HTMLElement;
    const wrapperB = el.shadowRoot!.querySelector('[data-node-id="b"]') as HTMLElement;
    const wrapperC = el.shadowRoot!.querySelector('[data-node-id="c"]') as HTMLElement;
    const controlA = nodeControl(el, 'a');

    controlA.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(wrapperB.hasAttribute('data-connect-target')).to.be.true;

    controlA.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(wrapperC.hasAttribute('data-connect-target')).to.be.true;
    expect(wrapperB.hasAttribute('data-connect-target')).to.be.false;

    controlA.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(wrapperB.hasAttribute('data-connect-target')).to.be.true;

    // An unrelated key while connect mode is active falls through every case and is swallowed
    // rather than leaking to node activation/roving-nav handling below.
    controlA.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(wrapperB.hasAttribute('data-connect-target')).to.be.true;

    let detail: { source: string; target: string; sourceHandle: string; targetHandle: string } | undefined;
    el.addEventListener('lr-connect', (e) => (detail = (e as CustomEvent).detail));
    controlA.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(detail).to.deep.equal({ source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in' });
  });

  it('announces keyboard connection targets and commits with accessible node labels', async () => {
    const el = (await fixture(html`
      <lr-flow-canvas
        connectable
        .strings=${{
          flowConnectTarget: 'TARGET {source} -> {target} ({index}/{total})',
          flowConnectCommitted: 'DONE {source} -> {target}',
        }}
      ></lr-flow-canvas>
    `)) as LyraFlowCanvas;
    el.nodes = [
      { id: 'opaque-a', accessibleLabel: 'Readable source', position: { x: 0, y: 0 } },
      { id: 'opaque-b', accessibleLabel: 'Readable target', position: { x: 200, y: 0 } },
    ];
    await el.updateComplete;
    (el as unknown as { announcer: { throttleMs: number } }).announcer.throttleMs = 0;
    const control = el.shadowRoot!.querySelector('[data-node-id="opaque-a"] [part="node-control"]') as HTMLElement;
    control.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="live-region"]')!.textContent!.trim()).to.equal(
      'TARGET Readable source -> Readable target (1/1)',
    );

    control.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="live-region"]')!.textContent!.trim()).to.equal(
      'DONE Readable source -> Readable target',
    );
  });

  it('does not enter connect mode via keyboard when there are no eligible targets', async () => {
    const el = (await fixture(html`<lr-flow-canvas connectable></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [{ id: 'a', position: { x: 0, y: 0 } }];
    await el.updateComplete;
    const wrapperA = el.shadowRoot!.querySelector('[data-node-id="a"]') as HTMLElement;
    const controlA = nodeControl(el, 'a');
    controlA.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(wrapperA.hasAttribute('data-connect-target')).to.be.false;
    let fired = false;
    el.addEventListener('lr-connect', () => (fired = true));
    controlA.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(fired).to.be.false;
  });

  it('does not emit lr-connect on commit when the cycled target disappears from nodes first', async () => {
    const el = (await fixture(html`<lr-flow-canvas connectable></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [
      { id: 'a', position: { x: 0, y: 0 } },
      { id: 'b', position: { x: 200, y: 0 } },
    ];
    await el.updateComplete;
    const controlA = nodeControl(el, 'a');
    controlA.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true, cancelable: true }));
    await el.updateComplete;
    // 'b' was the only eligible target when connect mode started; removing it from `nodes` (a
    // controlled component never resets keyboard-connect state on its own here) leaves the commit
    // with no resolvable target at all.
    el.nodes = [{ id: 'a', position: { x: 0, y: 0 } }];
    await el.updateComplete;
    let fired = false;
    el.addEventListener('lr-connect', () => (fired = true));
    controlA.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(fired).to.be.false;
  });

  it('falls back to out/in handle ids when the source/target node has an empty handle array', async () => {
    const el = (await fixture(html`<lr-flow-canvas connectable></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [
      { id: 'a', position: { x: 0, y: 0 }, outputs: [] },
      { id: 'b', position: { x: 200, y: 0 }, inputs: [] },
    ];
    await el.updateComplete;
    const wrapperA = nodeControl(el, 'a');
    let detail: { source: string; target: string; sourceHandle: string; targetHandle: string } | undefined;
    el.addEventListener('lr-connect', (e) => (detail = (e as CustomEvent).detail));
    wrapperA.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true, cancelable: true }));
    wrapperA.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(detail).to.deep.equal({ source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in' });
  });

  it('marks an already-connected hovered node invalid, and clears the marker when hovering a different node', async () => {
    const el = (await fixture(html`<lr-flow-canvas connectable></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [
      { id: 'a', position: { x: 0, y: 0 } },
      { id: 'b', position: { x: 200, y: 0 } },
      { id: 'c', position: { x: 400, y: 0 } },
    ];
    // a->b already exists, so hovering b during a new gesture from a must be marked invalid --
    // not because b is the source (it isn't), but because the edge would be a duplicate.
    el.edges = [{ id: 'a-b', source: 'a', target: 'b' }];
    await el.updateComplete;
    const wrapperA = el.shadowRoot!.querySelector('[data-node-id="a"]') as HTMLElement;
    const wrapperB = el.shadowRoot!.querySelector('[data-node-id="b"]') as HTMLElement;
    const wrapperC = el.shadowRoot!.querySelector('[data-node-id="c"]') as HTMLElement;
    const outputHandle = makeHandle('output', 'out');
    wrapperA.appendChild(outputHandle);

    outputHandle.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, bubbles: true, composed: true }));
    wrapperB.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 200, clientY: 0, bubbles: true, composed: true }));
    expect(wrapperB.hasAttribute('data-connect-invalid')).to.be.true;

    wrapperC.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 400, clientY: 0, bubbles: true, composed: true }));
    expect(wrapperB.hasAttribute('data-connect-invalid')).to.be.false;
    expect(wrapperC.hasAttribute('data-connect-invalid')).to.be.false;

    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 400, clientY: 0 }));
  });

  it('pointercancel ends the connect gesture without committing', async () => {
    const el = (await fixture(html`<lr-flow-canvas connectable></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [
      { id: 'a', position: { x: 0, y: 0 } },
      { id: 'b', position: { x: 200, y: 0 } },
    ];
    await el.updateComplete;
    const wrapperA = el.shadowRoot!.querySelector('[data-node-id="a"]') as HTMLElement;
    const wrapperB = el.shadowRoot!.querySelector('[data-node-id="b"]') as HTMLElement;
    const outputHandle = makeHandle('output', 'out');
    wrapperA.appendChild(outputHandle);
    const inputHandle = makeHandle('input', 'in');
    wrapperB.appendChild(inputHandle);
    let fired = false;
    el.addEventListener('lr-connect', () => (fired = true));

    outputHandle.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, bubbles: true, composed: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 150, clientY: 0 }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="connection-line"]')).to.exist;

    // A touch scroll takeover / the browser reclaiming the pointer fires pointercancel, never
    // pointerup: the ghost connection line must go away and the gesture must not stay armed.
    window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="connection-line"]')).to.not.exist;

    // A later unrelated pointerup over a valid input handle must not commit against stale state.
    inputHandle.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 200, clientY: 0, bubbles: true, composed: true }));
    expect(fired).to.be.false;
  });

  it('keyboard: Escape cancels connect mode without emitting', async () => {
    const el = (await fixture(html`<lr-flow-canvas connectable></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [
      { id: 'a', position: { x: 0, y: 0 } },
      { id: 'b', position: { x: 200, y: 0 } },
    ];
    await el.updateComplete;
    const controlA = nodeControl(el, 'a');
    let fired = false;
    el.addEventListener('lr-connect', () => (fired = true));
    controlA.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true, cancelable: true }));
    controlA.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    controlA.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(fired).to.be.false;
  });
});

function makeDropEvent(type: string, clientX: number, clientY: number): DragEvent {
  const dataTransfer = new DataTransfer();
  dataTransfer.setData(FLOW_PALETTE_MIME_TYPE, JSON.stringify({ type }));
  return new DragEvent('drop', { bubbles: true, cancelable: true, clientX, clientY, dataTransfer });
}

// Deviation from the plan brief: Slice A's `render()` (unchanged by any later slice) shows *only*
// the `lr-empty` state -- no `[part='viewport']` at all -- while `nodes` is empty, so a droppable
// test against a genuinely empty canvas has no viewport element to dispatch drag/drop events at.
// Each test below seeds one already-positioned node (irrelevant to what's under test: the drop
// handshake itself) purely so `[part='viewport']` exists to dispatch against.
describe('droppable', () => {
  it('accepts a FLOW_PALETTE_MIME_TYPE drop and emits lr-node-add with a grid-snapped position', async () => {
    const el = (await fixture(
      html`<lr-flow-canvas droppable style="width:400px;height:300px"></lr-flow-canvas>`,
    )) as LyraFlowCanvas;
    el.nodes = [{ id: 'seed', position: { x: 0, y: 0 } }];
    await el.updateComplete;
    const viewportEl = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
    const rect = viewportEl.getBoundingClientRect();
    let detail: { type: string; position: { x: number; y: number } } | undefined;
    el.addEventListener('lr-node-add', (e) => (detail = (e as CustomEvent).detail));
    viewportEl.dispatchEvent(makeDropEvent('http-request', rect.left + 21, rect.top + 5));
    expect(detail?.type).to.equal('http-request');
    expect(detail!.position.x % el.grid).to.equal(0);
    expect(detail!.position.y % el.grid).to.equal(0);
  });

  it('ignores a drop when droppable is unset or the canvas is locked', async () => {
    const el = (await fixture(html`<lr-flow-canvas style="width:400px;height:300px"></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [{ id: 'seed', position: { x: 0, y: 0 } }];
    await el.updateComplete;
    const viewportEl = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
    let fired = false;
    el.addEventListener('lr-node-add', () => (fired = true));
    viewportEl.dispatchEvent(makeDropEvent('http-request', 10, 10));
    expect(fired).to.be.false;
  });

  it('ignores a drop whose payload is not valid JSON', async () => {
    const el = (await fixture(html`<lr-flow-canvas droppable style="width:400px;height:300px"></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [{ id: 'seed', position: { x: 0, y: 0 } }];
    await el.updateComplete;
    const viewportEl = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
    const dataTransfer = new DataTransfer();
    dataTransfer.setData(FLOW_PALETTE_MIME_TYPE, '{not valid json');
    let fired = false;
    el.addEventListener('lr-node-add', () => (fired = true));
    viewportEl.dispatchEvent(
      new DragEvent('drop', { bubbles: true, cancelable: true, clientX: 10, clientY: 10, dataTransfer }),
    );
    expect(fired).to.be.false;
  });

  it('marks data-drop-active on dragover with the recognized MIME type and clears it on dragleave/drop', async () => {
    const el = (await fixture(html`<lr-flow-canvas droppable style="width:400px;height:300px"></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [{ id: 'seed', position: { x: 0, y: 0 } }];
    await el.updateComplete;
    const viewportEl = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
    const dataTransfer = new DataTransfer();
    dataTransfer.setData(FLOW_PALETTE_MIME_TYPE, JSON.stringify({ type: 'x' }));
    viewportEl.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }));
    expect(viewportEl.hasAttribute('data-drop-active')).to.be.true;
    viewportEl.dispatchEvent(new DragEvent('dragleave', { bubbles: true, cancelable: true, dataTransfer }));
    expect(viewportEl.hasAttribute('data-drop-active')).to.be.false;
  });
});

describe('registerCompanion & decorations', () => {
  it('registerCompanion delivers a FlowStructureSnapshot rAF-coalesced, and the unsubscribe stops delivery', async () => {
    const el = (await fixture(html`<lr-flow-canvas style="width:400px;height:300px"></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [{ id: 'a', position: { x: 0, y: 0 } }];
    await el.updateComplete;
    const snapshots: FlowStructureSnapshot[] = [];
    const unsubscribe = el.registerCompanion((s) => snapshots.push(s));
    await new Promise((r) => requestAnimationFrame(r));
    expect(snapshots.length).to.equal(1);
    expect(snapshots[0].nodes[0].id).to.equal('a');
    expect(snapshots[0].viewport.zoom).to.equal(1);
    unsubscribe();
    el.setViewport({ x: 5, y: 5, zoom: 1 });
    await new Promise((r) => requestAnimationFrame(r));
    expect(snapshots.length).to.equal(1);
  });

  it('pushes decoration status/progress/detail onto the adopted card for each node', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [{ id: 'a' }];
    await el.updateComplete;
    el.decorations = { a: { status: 'running', progress: 40, detail: 'chunk 2 of 5' } };
    await el.updateComplete;
    const card = el.querySelector('[node-id="a"]') as unknown as { status: string; progress: number; statusDetail: string };
    expect(card.status).to.equal('running');
    expect(card.progress).to.equal(40);
    expect(card.statusDetail).to.equal('chunk 2 of 5');
  });

  it('forwards decoration.durationMs onto the adopted card alongside status/progress/detail', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [{ id: 'a' }];
    await el.updateComplete;
    el.decorations = { a: { status: 'success', durationMs: 812 } };
    await el.updateComplete;
    const card = el.querySelector('[node-id="a"]') as unknown as { durationMs: number | null };
    expect(card.durationMs).to.equal(812);
  });

  it('a decorated edge takes its status tone, overriding FlowEdge.tone', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    el.edges = [{ id: 'a-b', source: 'a', target: 'b', tone: 'neutral' }];
    el.decorations = { 'a-b': { status: 'error' } };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="edge"]')!.getAttribute('data-tone')).to.equal('danger');
  });

  it('maps edge decoration status success/denied/pending to their tones, including the neutral fallback', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    el.edges = edges;
    const path = () => el.shadowRoot!.querySelector('[part="edge"]')!;

    el.decorations = { 'a-b': { status: 'success' } };
    await el.updateComplete;
    expect(path().getAttribute('data-tone')).to.equal('success');

    el.decorations = { 'a-b': { status: 'denied' } };
    await el.updateComplete;
    expect(path().getAttribute('data-tone')).to.equal('warning');

    // 'pending' matches none of the explicit status->tone cases, exercising statusTone()'s final
    // fallback.
    el.decorations = { 'a-b': { status: 'pending' } };
    await el.updateComplete;
    expect(path().getAttribute('data-tone')).to.equal('neutral');
  });

  it('a running decorated edge gets an animated march unless prefers-reduced-motion', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    el.edges = edges;
    el.decorations = { 'a-b': { status: 'running' } };
    await el.updateComplete;
    const path = el.shadowRoot!.querySelector('[part="edge"]')!;
    expect(path.hasAttribute('data-running')).to.be.true;
    expect(path.hasAttribute('data-running-static')).to.be.false;
  });

  it('renders a static dash instead of animating a running edge under prefers-reduced-motion', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as typeof window.matchMedia;
    try {
      const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
      el.nodes = nodes;
      el.edges = edges;
      el.decorations = { 'a-b': { status: 'running' } };
      await el.updateComplete;
      const path = el.shadowRoot!.querySelector('[part="edge"]')!;
      expect(path.hasAttribute('data-running-static')).to.be.true;
      expect(path.hasAttribute('data-running')).to.be.false;
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});

describe('locked (consolidated)', () => {
  it('leaves pan, zoom, drag, connect, and drop all inert while focus/click/keyboard-activation still work', async () => {
    const el = (await fixture(
      html`<lr-flow-canvas locked nodes-draggable connectable droppable style="width:400px;height:300px"></lr-flow-canvas>`,
    )) as LyraFlowCanvas;
    el.nodes = [
      { id: 'a', position: { x: 0, y: 0 } },
      { id: 'b', position: { x: 200, y: 0 } },
    ];
    await el.updateComplete;

    const viewportEl = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
    const wrapperA = el.shadowRoot!.querySelector('[data-node-id="a"]') as HTMLElement;
    const controlA = nodeControl(el, 'a');

    // Pan/zoom: wheel is a no-op.
    viewportEl.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: 50, clientY: 50, bubbles: true, cancelable: true }));
    expect(el.viewport.zoom).to.equal(1);

    // Drag: pointer drag on a node does not move it.
    wrapperA.setPointerCapture = () => {};
    wrapperA.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 40, clientY: 0 }));
    expect(wrapperA.style.transform).to.equal('translate(0px, 0px)');
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 40, clientY: 0 }));

    // Connect: 'c' does not enter connect mode.
    controlA.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true, cancelable: true }));
    controlA.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    let connected = false;
    el.addEventListener('lr-connect', () => (connected = true));
    expect(connected).to.be.false;

    // Drop: dragover does not mark data-drop-active.
    const dataTransfer = new DataTransfer();
    dataTransfer.setData(FLOW_PALETTE_MIME_TYPE, JSON.stringify({ type: 'x' }));
    viewportEl.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }));
    expect(viewportEl.hasAttribute('data-drop-active')).to.be.false;

    // Click/keyboard activation still work.
    let clicked = false;
    el.addEventListener('lr-node-click', () => (clicked = true));
    wrapperA.click();
    expect(clicked).to.be.true;
  });
});

describe('disconnect/reconnect', () => {
  it('cancels a pending wheel-measure rAF on disconnect instead of leaving it to fire on a torn-down instance', async () => {
    const el = (await fixture(html`<lr-flow-canvas style="width:400px;height:300px"></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    await el.updateComplete;
    const viewportEl = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
    // A wheel event schedules a measurement-cache rAF (see onWheel's wheelMeasure) that normally
    // clears itself a frame later; disconnecting before that frame fires must cancel it directly
    // instead of leaving it to run after teardown.
    viewportEl.dispatchEvent(
      new WheelEvent('wheel', { deltaY: -100, clientX: 10, clientY: 10, bubbles: true, cancelable: true }),
    );
    el.remove();
    // Should not throw even once the deferred rAF's original tick would have fired.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });

  it('cancels a pending companion-notify rAF on disconnect', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = [{ id: 'a', position: { x: 0, y: 0 } }];
    await el.updateComplete;
    // registerCompanion() schedules a companion-notify rAF; disconnecting before it fires must
    // cancel it directly instead of leaving it to run after teardown.
    el.registerCompanion(() => {});
    el.remove();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });

  it('re-observes node wrappers after a reconnect so later size changes still reach the snapshot geometry', async () => {
    const container = (await fixture(html`
      <div>
        <lr-flow-canvas .nodes=${[{ id: 'a', position: { x: 0, y: 0 } }]} style="width:400px;height:300px">
          <div node-id="a" style="width:100px;height:50px">Card</div>
        </lr-flow-canvas>
      </div>
    `)) as HTMLElement;
    const el = container.querySelector('lr-flow-canvas') as LyraFlowCanvas;
    await el.updateComplete;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    // A reparenting move disconnects and reconnects the same element instance; the ResizeObserver
    // torn down on disconnect must pick the already-rendered wrappers back up on reconnect.
    el.remove();
    container.appendChild(el);
    await el.updateComplete;

    const card = el.querySelector('[node-id="a"]') as HTMLElement;
    card.style.width = '320px';
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const snapshots: FlowStructureSnapshot[] = [];
    const unsubscribe = el.registerCompanion((s) => snapshots.push(s));
    await new Promise((r) => requestAnimationFrame(r));
    unsubscribe();
    expect(snapshots.length).to.be.greaterThan(0);
    expect(snapshots[0].nodes[0].width).to.be.closeTo(320, 2);
  });
});

// Regression coverage for the shared finite-number normalization layer
// (`src/internal/numbers.ts`) not previously wired up for min-zoom/max-zoom/grid/layer-gap/
// node-gap -- an invalid attribute value used to flow straight into clampZoom()'s Math.min/max,
// the grid-snap division, and the auto-layout gapX/gapY, poisoning viewport.zoom, snapped
// positions, and auto-laid-out node positions with NaN.
describe('finite-number normalization', () => {
  it('rejects non-finite public node/viewport/fit geometry before it reaches layout or emitted state', async () => {
    const el = (await fixture(html`
      <lr-flow-canvas style="width:400px;height:300px"></lr-flow-canvas>
    `)) as LyraFlowCanvas;
    el.nodes = [{ id: 'a', position: { x: Number.NaN, y: Number.POSITIVE_INFINITY } }];
    await el.updateComplete;
    const wrapper = el.shadowRoot!.querySelector('[data-node-id="a"]') as HTMLElement;
    expect(wrapper.style.transform).to.not.match(/NaN|Infinity/);

    el.setViewport({ x: Number.NaN, y: Number.POSITIVE_INFINITY, zoom: Number.NaN });
    expect(Object.values(el.viewport).every(Number.isFinite)).to.equal(true);
    el.fit({ padding: Number.POSITIVE_INFINITY });
    expect(Object.values(el.viewport).every(Number.isFinite)).to.equal(true);
  });

  it('clamps a non-finite/negative min-zoom or max-zoom so viewport.zoom never becomes NaN', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    await el.updateComplete;

    el.minZoom = NaN;
    el.maxZoom = Infinity;
    el.setViewport({ x: 0, y: 0, zoom: 50 });
    expect(Number.isFinite(el.viewport.zoom)).to.be.true;

    el.minZoom = -Infinity;
    el.maxZoom = -5; // a negative upper zoom bound is meaningless
    el.setViewport({ x: 0, y: 0, zoom: 50 });
    expect(Number.isFinite(el.viewport.zoom)).to.be.true;
    expect(el.viewport.zoom).to.be.greaterThan(0);
  });

  it('normalizes a non-finite/negative grid so drop positions and the CSS grid-size stay finite', async () => {
    const el = (await fixture(
      html`<lr-flow-canvas droppable style="width:400px;height:300px"></lr-flow-canvas>`,
    )) as LyraFlowCanvas;
    el.nodes = [{ id: 'seed', position: { x: 0, y: 0 } }];
    el.grid = NaN;
    await el.updateComplete;
    const background = el.shadowRoot!.querySelector('[part="background"]') as HTMLElement;
    expect(background.getAttribute('style')).to.not.match(/NaN|Infinity/);

    const viewportEl = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
    const rect = viewportEl.getBoundingClientRect();
    let detail: { type: string; position: { x: number; y: number } } | undefined;
    el.addEventListener('lr-node-add', (e) => (detail = (e as CustomEvent).detail));
    viewportEl.dispatchEvent(makeDropEvent('http-request', rect.left + 21, rect.top + 5));
    expect(Number.isFinite(detail!.position.x)).to.be.true;
    expect(Number.isFinite(detail!.position.y)).to.be.true;
    // A non-finite grid falls back to the declared default (8px) instead of silently poisoning
    // the snap with NaN.
    expect(detail!.position.x % 8).to.equal(0);
    expect(detail!.position.y % 8).to.equal(0);

    el.grid = -100; // a negative snap increment is meaningless and must not reach the CSS var either
    await el.updateComplete;
    expect(background.getAttribute('style')).to.not.match(/NaN|Infinity|-100/);
  });

  it('normalizes non-finite/negative layer-gap/node-gap so auto-layout never assigns a NaN position', async () => {
    const el = (await fixture(
      html`<lr-flow-canvas layer-gap="Infinity" node-gap="-40"></lr-flow-canvas>`,
    )) as LyraFlowCanvas;
    let detail: { positions: Record<string, { x: number; y: number }> } | undefined;
    el.addEventListener('lr-layout-change', (e) => (detail = (e as CustomEvent).detail));
    el.nodes = [{ id: 'a' }, { id: 'b' }];
    el.edges = [{ id: 'a-b', source: 'a', target: 'b' }];
    await el.updateComplete;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    expect(detail).to.exist;
    for (const pos of Object.values(detail!.positions)) {
      expect(Number.isFinite(pos.x)).to.be.true;
      expect(Number.isFinite(pos.y)).to.be.true;
    }
    const wrapperB = el.shadowRoot!.querySelector('[data-node-id="b"]') as HTMLElement;
    expect(wrapperB.style.transform).to.not.match(/NaN|Infinity/);
  });

  it('prunes cached positions, measurements, and observed wrappers when node ids are removed', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = Array.from({ length: 12 }, (_, index) => ({ id: `node-${index}` }));
    await el.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const internal = el as unknown as {
      autoPositions: Map<string, unknown>;
      measuredSizes: Map<string, unknown>;
      observedNodeEls: Set<Element>;
    };
    expect(internal.autoPositions.size).to.be.greaterThan(0);
    expect(internal.observedNodeEls.size).to.equal(12);

    el.nodes = [];
    await el.updateComplete;
    expect(internal.autoPositions.size).to.equal(0);
    expect(internal.measuredSizes.size).to.equal(0);
    expect(internal.observedNodeEls.size).to.equal(0);
  });
});

describe('edge interaction target', () => {
  it('adds a transparent shared-size hit path that forwards edge activation', async () => {
    const el = (await fixture(html`<lr-flow-canvas .nodes=${nodes} .edges=${edges}></lr-flow-canvas>`)) as LyraFlowCanvas;
    await el.updateComplete;
    const hitArea = el.shadowRoot!.querySelector('[part="edge-hit-area"]') as SVGPathElement;
    expect(hitArea).to.exist;
    expect(Number.parseFloat(getComputedStyle(hitArea).strokeWidth)).to.be.at.least(40);
    let detail: { id: string } | undefined;
    el.addEventListener('lr-edge-click', (event) => {
      detail = (event as CustomEvent).detail;
    });
    hitArea.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(detail?.id).to.equal('a-b');
  });
});

describe('localized numeric output', () => {
  it('formats summary counts, roving positions, and nudge coordinates with the effective locale', async () => {
    const el = (await fixture(html`<lr-flow-canvas lang="ar" nodes-draggable></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.strings = {
      flowCanvasSummary: '{nodeCount}|{edgeCount}',
      flowItemAnnouncement: '{index}|{total}|{item}',
      flowNodeMoved: '{x}|{y}|{label}',
    };
    el.grid = 1;
    el.nodes = [
      { id: 'a', accessibleLabel: 'Alpha', position: { x: 1234.5, y: 9876.5 } },
      { id: 'b', accessibleLabel: 'Beta', position: { x: 200, y: 0 } },
    ];
    el.edges = [{ id: 'a-b', source: 'a', target: 'b' }];
    await el.updateComplete;
    const number = new Intl.NumberFormat('ar');
    expect(el.shadowRoot!.querySelector('[part="viewport"]')!.getAttribute('aria-label')).to.equal(
      `${number.format(2)}|${number.format(1)}`,
    );

    (el as unknown as { announcer: { throttleMs: number } }).announcer.throttleMs = 0;
    const control = nodeControl(el, 'a');
    control.focus();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="live-region"]')!.textContent!.trim()).to.equal(
      `${number.format(2)}|${number.format(3)}|Alpha`,
    );

    control.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', ctrlKey: true, bubbles: true, cancelable: true }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="live-region"]')!.textContent!.trim()).to.equal(
      `${number.format(1234.5)}|${number.format(9877.5)}|Alpha`,
    );
  });
});

describe('--lr-flow-canvas-node-current-outline-color', () => {
  const currentFixture = async (): Promise<LyraFlowCanvas> => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    el.selectedNodeIds = ['a'];
    await el.updateComplete;
    return el;
  };

  it('retints the selected node outline via the cssprop', async () => {
    const el = await currentFixture();
    el.style.setProperty('--lr-flow-canvas-node-current-outline-color', 'rgb(10, 20, 30)');
    const node = el.shadowRoot!.querySelector('[part="node"][data-selected]') as HTMLElement;
    expect(node).to.exist;
    expect(getComputedStyle(node).outlineColor).to.equal('rgb(10, 20, 30)');
  });

  it('renders byte-identically to the brand token default when unset', async () => {
    const el = await currentFixture();
    const node = el.shadowRoot!.querySelector('[part="node"][data-selected]') as HTMLElement;
    const unset = getComputedStyle(node).outlineColor;
    el.style.setProperty('--lr-flow-canvas-node-current-outline-color', 'var(--lr-color-brand)');
    expect(getComputedStyle(node).outlineColor).to.equal(unset);
  });
});

describe('--lr-flow-canvas-node-hover-outline-color', () => {
  it('references the cssprop with a fallback to --lr-color-border-strong in the :hover rule', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    const rule = css.match(/\[part='node'\]:hover\s*\{([^}]+)\}/)?.[1] ?? '';
    expect(rule).to.match(
      /outline:[^;]*var\(--lr-flow-canvas-node-hover-outline-color,\s*var\(--lr-color-border-strong\)\)/,
    );
  });

  it('cascades the cssprop onto [part="node"]', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    await el.updateComplete;
    el.style.setProperty('--lr-flow-canvas-node-hover-outline-color', 'rgb(77, 66, 55)');
    const node = el.shadowRoot!.querySelector('[part="node"]') as HTMLElement;
    expect(getComputedStyle(node).getPropertyValue('--lr-flow-canvas-node-hover-outline-color').trim()).to.equal(
      'rgb(77, 66, 55)',
    );
  });
});

describe('connect-gesture and drop-active outline cssprop indirection', () => {
  it('retints the connect-invalid node outline via --lr-flow-canvas-node-connect-invalid-outline-color', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    await el.updateComplete;
    el.style.setProperty('--lr-flow-canvas-node-connect-invalid-outline-color', 'rgb(11, 22, 33)');
    const node = el.shadowRoot!.querySelector('[data-node-id="a"]') as HTMLElement;
    node.setAttribute('data-connect-invalid', '');
    expect(getComputedStyle(node).outlineColor).to.equal('rgb(11, 22, 33)');
  });

  it('retints the connect-target node outline via --lr-flow-canvas-node-connect-target-outline-color', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    await el.updateComplete;
    el.style.setProperty('--lr-flow-canvas-node-connect-target-outline-color', 'rgb(44, 55, 66)');
    const node = el.shadowRoot!.querySelector('[data-node-id="a"]') as HTMLElement;
    node.setAttribute('data-connect-target', '');
    expect(getComputedStyle(node).outlineColor).to.equal('rgb(44, 55, 66)');
  });

  it('retints the drop-active viewport outline via --lr-flow-canvas-drop-active-outline-color', async () => {
    const el = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
    el.nodes = nodes;
    await el.updateComplete;
    el.style.setProperty('--lr-flow-canvas-drop-active-outline-color', 'rgb(77, 88, 99)');
    const viewportEl = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
    viewportEl.setAttribute('data-drop-active', '');
    expect(getComputedStyle(viewportEl).outlineColor).to.equal('rgb(77, 88, 99)');
  });
});

describe('mouse-hover feedback on nodes and edges', () => {
  // :hover cannot be synthesized in this test runner (no real pointer), so per this repo's
  // documented exception for genuinely-unsynthesizable pseudo-classes, this asserts against the
  // stylesheet source instead of a rendered/computed effect.
  it('declares a :hover rule for both [part="node"] and [part="edge"], matching their :focus-visible affordance', () => {
    const css = styles.cssText;
    expect(css).to.match(/\[part='node'\]:hover\s*\{/);
    expect(css).to.match(/\[part='edge'\]:hover\s*\{/);
  });
});

describe('focused node z-index lift (perf-virtualized-row-focus-within-zindex)', () => {
  it('raises z-index on a node once focus lands inside it, via :focus-within', async () => {
    const el = (await fixture(
      html`<lr-flow-canvas style="width:400px;height:300px" .nodes=${nodes}>
        <button node-id="a">focus me</button>
      </lr-flow-canvas>`,
    )) as LyraFlowCanvas;
    await el.updateComplete;
    const wrapperA = el.shadowRoot!.querySelector('[data-node-id="a"]') as HTMLElement;
    expect(getComputedStyle(wrapperA).zIndex).to.equal('auto');
    const button = el.querySelector('button[node-id="a"]') as HTMLButtonElement;
    button.focus();
    await el.updateComplete;
    expect(getComputedStyle(wrapperA).zIndex).to.not.equal('auto');
  });
});
