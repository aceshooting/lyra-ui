import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { nothing, render } from 'lit';
import './flow-canvas.js';
import '../flow-node/flow-node.js';
import '../flow-run-status/flow-run-status.js';
import '../flow-minimap/flow-minimap.js';
import '../flow-controls/flow-controls.js';
import type { LyraFlowCanvas } from './flow-canvas.js';
import type {
  FlowEdge,
  FlowHandle,
  FlowNode,
  FlowRunDecoration,
  FlowRunDecorations,
  FlowStructureSnapshot,
} from './flow-types.js';
import type { LyraFlowNode } from '../flow-node/flow-node.js';
import type { LyraFlowRunStatus } from '../flow-run-status/flow-run-status.js';

for (const group of ['inputs', 'outputs'] as const) {
  for (const owner of ['canvas', 'node']) {
    it(`retains the first valid ${group} handle through the public ${owner} setter`, async () => {
      const malformed = Object.defineProperty({ id: 'same' }, 'label', {
        get() { throw new TypeError('Unavailable handle label'); },
      }) as FlowHandle;
      const handles: FlowHandle[] = [malformed, { id: 'same', label: 'First valid' }, { id: 'same', label: 'Duplicate' }, { id: 'neighbor' }];
      let card: LyraFlowNode;
      if (owner === 'canvas') {
        const canvas = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas></lr-flow-canvas>`);
        canvas.nodes = [{ id: 'node', [group]: handles }];
        await canvas.updateComplete;
        expect(canvas.nodes[0]![group]!.map((handle) => handle.id)).to.deep.equal(['same', 'neighbor']);
        card = canvas.shadowRoot!.querySelector<LyraFlowNode>('lr-flow-node')!;
      } else {
        card = await fixture<LyraFlowNode>(html`<lr-flow-node heading="Node"></lr-flow-node>`);
        card[group] = handles;
      }
      await card.updateComplete;
      expect(card[group].map((handle) => handle.id)).to.deep.equal(['same', 'neighbor']);
      expect(card[group][0]!.label).to.equal('First valid');
      expect(Object.isFrozen(card[group][0])).to.equal(true);
      const kind = group === 'inputs' ? 'input' : 'output';
      expect(card.shadowRoot!.querySelectorAll(`[data-handle-kind="${kind}"]`).length).to.equal(2);
    });
  }
}

for (const field of ['status', 'progress', 'durationMs', 'detail']) {
  for (const owner of ['canvas', 'run-status']) {
    it(`omits a throwing decoration ${field} without losing its ${owner} neighbors`, async () => {
      const malformed = Object.defineProperty({ status: 'running' }, field, {
        enumerable: true,
        get() { throw new TypeError('Unavailable decoration metadata'); },
      }) as FlowRunDecoration;
      const decorations: FlowRunDecorations = {
        before: { status: 'success', progress: 1, durationMs: 20, detail: 'Complete' },
        rejected: malformed,
        invalid: { status: 'unsupported' as never },
        after: { status: 'running', progress: 0.5, durationMs: 10, detail: 'Working' },
      };
      const el = owner === 'canvas'
        ? await fixture<LyraFlowCanvas>(html`<lr-flow-canvas></lr-flow-canvas>`)
        : await fixture<LyraFlowRunStatus>(html`<lr-flow-run-status></lr-flow-run-status>`);
      expect(() => { el.decorations = decorations; }).not.to.throw();
      await el.updateComplete;
      expect(Object.keys(el.decorations!)).to.deep.equal(['before', 'after']);
      expect(el.decorations!['after']).to.deep.equal(decorations['after']);
      expect(Object.isFrozen(el.decorations!['after'])).to.equal(true);
    });
  }
}

function screenMatrix(element: Element): DOMMatrixReadOnly {
  let matrix = new DOMMatrixReadOnly();
  for (let current: Element | null = element; current;) {
    const transform = getComputedStyle(current).transform;
    if (transform !== 'none') matrix = new DOMMatrixReadOnly(transform).multiply(matrix);
    const root = current.getRootNode();
    current = current.assignedSlot ?? current.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
  }
  return matrix;
}

for (const route of ['generated', 'portable', 'authored']) {
  it(`keeps ${route} flow-card text readable while horizontal RTL reflects its coordinate plane`, async () => {
    const registry = window.customElements;
    const descriptor = Object.getOwnPropertyDescriptor(registry, 'get');
    const originalGet = registry.get.bind(registry);
    if (route === 'portable') {
      registry.get = (name: string) => name === 'lr-flow-node' ? undefined : originalGet(name);
    }
    try {
      const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas orientation="horizontal" style="width:600px;height:300px"
        .nodes=${[
          { id: 'a', position: { x: 20, y: 10 }, data: { label: 'Readable ABC' } },
          { id: 'b', position: { x: 250, y: 10 }, data: { label: 'Target' } },
        ]}
        .edges=${[{ id: 'edge', source: 'a', target: 'b', label: 'Readable edge' }]}
      >${route === 'authored' ? html`<lr-flow-node node-id="a" heading="Readable ABC"></lr-flow-node>` : ''}</lr-flow-canvas>`);
      const card = route === 'authored'
        ? el.querySelector<LyraFlowNode>('lr-flow-node')!
        : el.shadowRoot!.querySelector<HTMLElement>('[data-node-id="a"] [data-flow-canvas-default-card]')!;
      if ('updateComplete' in card) await (card as LyraFlowNode).updateComplete;
      const heading = route === 'portable'
        ? card.querySelector<HTMLElement>('[part="node-card-heading"]')!
        : card.shadowRoot!.querySelector<HTMLElement>('[part="heading"]')!;
      expect(heading.textContent).to.equal('Readable ABC');
      expect(screenMatrix(heading).a, 'LTR content orientation').to.be.greaterThan(0);
      const wrapper = el.shadowRoot!.querySelector<HTMLElement>('[data-node-id="a"]')!;
      const position = wrapper.style.transform;
      el.dir = 'rtl';
      await el.updateComplete;
      const viewport = el.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
      await waitUntil(() => new DOMMatrixReadOnly(getComputedStyle(viewport).transform).a < 0);
      expect(screenMatrix(heading).a, 'net RTL text orientation').to.be.greaterThan(0);
      expect(wrapper.style.transform, 'physical model position remains unchanged').to.equal(position);
      const edgeLabel = el.shadowRoot!.querySelector<SVGTextElement>('[part="edge-label"]')!;
      const edgeMatrix = edgeLabel.getScreenCTM()!;
      expect(edgeMatrix.a * edgeMatrix.d - edgeMatrix.b * edgeMatrix.c, 'SVG edge text remains readable').to.be.greaterThan(0);
      el.orientation = 'vertical';
      await el.updateComplete;
      expect(screenMatrix(heading).a, 'vertical RTL content orientation').to.be.greaterThan(0);
    } finally {
      if (descriptor) Object.defineProperty(registry, 'get', descriptor);
      else Reflect.deleteProperty(registry, 'get');
    }
  });
}

it('derives the roving order and keyboard-connect target once per render', async () => {
  const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas connectable style="width:600px;height:300px"></lr-flow-canvas>`);
  el.nodes = Array.from({ length: 30 }, (_, i) => ({ id: `n${i}`, position: { x: (i % 6) * 200, y: Math.floor(i / 6) * 100 } }));
  el.edges = Array.from({ length: 29 }, (_, i) => ({ id: `e${i}`, source: `n${i}`, target: `n${i + 1}` }));
  await el.updateComplete;
  const control = el.shadowRoot!.querySelector<HTMLElement>('[data-node-id="n0"] [part="node-control"]')!;
  control.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));
  await el.updateComplete;
  const internal = el as unknown as Record<'resolvedNode' | 'eligibleConnectTargets', (arg: unknown) => unknown>;
  const counts = { resolvedNode: 0, eligibleConnectTargets: 0 };
  for (const name of ['resolvedNode', 'eligibleConnectTargets'] as const) {
    const original = internal[name];
    internal[name] = function (this: unknown, arg: unknown) {
      counts[name] += 1;
      return original.call(this, arg);
    };
  }
  try {
    el.decorations = { n1: { status: 'running' } };
    await el.updateComplete;
  } finally {
    delete (internal as Partial<typeof internal>).resolvedNode;
    delete (internal as Partial<typeof internal>).eligibleConnectTargets;
  }
  expect(el.shadowRoot!.querySelectorAll('[data-connect-target]').length).to.equal(1);
  expect(counts.resolvedNode).to.be.below(30 * 4);
  expect(counts.eligibleConnectTargets).to.be.at.most(1);
});

it('keeps default cards untouched by a canvas render that changes nothing they show', async () => {
  const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas></lr-flow-canvas>`);
  el.nodes = [
    { id: 'a', position: { x: 0, y: 0 } },
    { id: 'b', position: { x: 200, y: 0 }, inputs: [{ id: 'x' }] },
  ];
  await el.updateComplete;
  const cards = [...el.shadowRoot!.querySelectorAll<LyraFlowNode>('lr-flow-node')];
  const handles = cards.map((card) => [card.inputs, card.outputs]);
  el.decorations = { b: { status: 'running' } };
  await el.updateComplete;
  expect(cards.map((card, i) => card.inputs === handles[i]![0] && card.outputs === handles[i]![1])).to.deep.equal([true, true]);
});

it('keeps a node drag, layout and model identity across a parent re-render with the same inputs', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const nodes: FlowNode[] = [{ id: 'a', position: { x: 0, y: 0 } }, { id: 'b' }];
  const edges: FlowEdge[] = [{ id: 'a-b', source: 'a', target: 'b' }];
  const decorations: FlowRunDecorations = { a: { status: 'running' } };
  const selected = ['a'];
  let layouts = 0;
  const view = () => html`<lr-flow-canvas nodes-draggable style="width:600px;height:300px"
    .nodes=${nodes} .edges=${edges} .decorations=${decorations} .selectedNodeIds=${selected}
    @lr-layout-change=${() => layouts++}></lr-flow-canvas>`;
  try {
    render(view(), host);
    const el = host.querySelector('lr-flow-canvas') as LyraFlowCanvas;
    await waitUntil(() => layouts === 1, 'the first layout pass', { timeout: 5000 });
    const before = [el.nodes, el.edges, el.decorations, el.selectedNodeIds];
    const wrapper = el.shadowRoot!.querySelector<HTMLElement>('[data-node-id="a"]')!;
    wrapper.setPointerCapture = () => {};
    wrapper.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, clientX: 0, clientY: 0, bubbles: true }));
    render(view(), host);
    await el.updateComplete;
    let moved: unknown;
    el.addEventListener('lr-node-move', (e) => (moved = (e as CustomEvent).detail.position));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, clientX: 40, clientY: 0 }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, clientX: 40, clientY: 0 }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    expect([el.nodes, el.edges, el.decorations, el.selectedNodeIds].map((value, i) => value === before[i])).to.deep.equal([true, true, true, true]);
    expect(moved, 'the drag survives the re-render').to.not.equal(undefined);
    expect(layouts).to.equal(1);
  } finally {
    render(nothing, host);
    host.remove();
  }
});

it('reuses the frozen structure and skips companion work on viewport-only frames', async () => {
  const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas style="width:600px;height:300px">
    <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
    <lr-flow-controls slot="bottom-start"></lr-flow-controls>
  </lr-flow-canvas>`);
  el.nodes = [{ id: 'a', position: { x: 0, y: 0 } }, { id: 'b', position: { x: 300, y: 0 } }];
  el.edges = [{ id: 'a-b', source: 'a', target: 'b' }];
  const frames: FlowStructureSnapshot[] = [];
  el.registerCompanion((snapshot) => frames.push(snapshot));
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  await waitUntil(() => frames.at(-1)?.nodes.length === 2);
  await frame();
  await frame();
  const minimap = el.querySelector('lr-flow-minimap')!;
  const controls = el.querySelector('lr-flow-controls')! as unknown as { render(): unknown };
  const getComputedStyle = window.getComputedStyle;
  const counts = { minimapStyleReads: 0, controlsRenders: 0 };
  window.getComputedStyle = (element, pseudo) => {
    if (element === minimap) counts.minimapStyleReads += 1;
    return getComputedStyle.call(window, element, pseudo);
  };
  const render = controls.render;
  controls.render = function (this: unknown) {
    counts.controlsRenders += 1;
    return render.call(this);
  };
  const start = frames.length;
  try {
    for (const x of [10, 20, 30]) {
      el.setViewport({ x, y: 0, zoom: 1 });
      await frame();
      await minimap.updateComplete;
    }
  } finally {
    window.getComputedStyle = getComputedStyle;
    delete (controls as Partial<typeof controls>).render;
  }
  const base = frames[start - 1]!;
  expect(frames.slice(start).map((s) => s.nodes === base.nodes && s.edges === base.edges)).to.deep.equal([true, true, true]);
  expect(counts).to.deep.equal({ minimapStyleReads: 0, controlsRenders: 0 });
});

it('does not start a node drag from a control inside an authored card', async () => {
  const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas nodes-draggable .nodes=${[{ id: 'a', position: { x: 0, y: 0 } }]}>
    <div node-id="a"><button>Run</button></div>
  </lr-flow-canvas>`);
  const wrapper = el.shadowRoot!.querySelector<HTMLElement>('[data-node-id="a"]')!;
  let captured = false;
  wrapper.setPointerCapture = () => {
    captured = true;
  };
  const before = wrapper.style.transform;
  el.querySelector('button')!.dispatchEvent(
    new PointerEvent('pointerdown', { pointerId: 3, clientX: 0, clientY: 0, bubbles: true, composed: true }),
  );
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 3, clientX: 40, clientY: 0 }));
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 3, clientX: 40, clientY: 0 }));
  expect([captured, wrapper.style.transform === before]).to.deep.equal([false, true]);
});

for (const route of ['readonly', 'revealed']) {
  it(`frames the graph initially when the canvas is ${route}`, async () => {
    const parent = await fixture<HTMLElement>(html`<div ?hidden=${route === 'revealed'}>
      <lr-flow-canvas ?readonly=${route === 'readonly'} style="width:600px;height:300px"></lr-flow-canvas>
    </div>`);
    const el = parent.querySelector('lr-flow-canvas') as LyraFlowCanvas;
    el.nodes = [{ id: 'a', position: { x: 1000, y: 500 } }];
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    await frame();
    await frame();
    parent.hidden = false;
    const node = el.shadowRoot!.querySelector<HTMLElement>('[data-node-id="a"]')!;
    const viewport = el.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
    const offset = () => {
      const a = node.getBoundingClientRect();
      const b = viewport.getBoundingClientRect();
      return Math.round(Math.abs(a.left + a.width / 2 - (b.left + b.width / 2)));
    };
    await waitUntil(() => offset() <= 1, `node centre is ${offset()}px from the viewport centre`);
  });
}

it('paints one selection ring, the canvas one, around a selected card', async () => {
  const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas
    style="--lr-flow-canvas-node-selected-outline-color: rgb(255, 0, 0)"
    .nodes=${[{ id: 'a', position: { x: 0, y: 0 } }, { id: 'b', position: { x: 300, y: 0 } }]}
  ><lr-flow-node node-id="b" heading="Authored"></lr-flow-node></lr-flow-canvas>`);
  el.selectedNodeIds = ['a', 'b'];
  await el.updateComplete;
  const cards = [
    el.shadowRoot!.querySelector<LyraFlowNode>('[data-node-id="a"] lr-flow-node')!,
    el.querySelector<LyraFlowNode>('lr-flow-node')!,
  ];
  await Promise.all(cards.map((card) => card.updateComplete));
  const rings = cards.map((card) => getComputedStyle(card.shadowRoot!.querySelector('.card')!).outlineColor);
  const wrapper = getComputedStyle(el.shadowRoot!.querySelector('[data-node-id="a"]')!).outlineColor;
  expect([...rings, wrapper]).to.deep.equal(['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)', 'rgb(255, 0, 0)']);
});
