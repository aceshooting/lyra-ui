import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './flow-canvas.js';
import type { LyraFlowCanvas, FlowNode } from './flow-canvas.js';
import { FLOW_PALETTE_MIME_TYPE } from './flow-canvas.js';

const pair: FlowNode[] = [
  { id: 'a', position: { x: 0, y: 0 }, data: { label: 'Fetch' } },
  { id: 'b', position: { x: 200, y: 0 }, data: { label: 'Summarize' } },
];

function wrapper(el: LyraFlowCanvas, id: string): HTMLElement {
  return el.shadowRoot!.querySelector<HTMLElement>(`[part="node"][data-node-id="${id}"]`)!;
}

function nodeControl(el: LyraFlowCanvas, id: string): HTMLButtonElement {
  return wrapper(el, id).querySelector<HTMLButtonElement>('[part="node-control"]')!;
}

function key(target: Element, value: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

function connectTargets(el: LyraFlowCanvas): string[] {
  return [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="node"][data-connect-target]')]
    .map((node) => node.dataset['nodeId'] ?? '');
}

function countEvents(el: Element, type: string): { readonly count: number; details: unknown[] } {
  const details: unknown[] = [];
  el.addEventListener(type, (event) => details.push((event as CustomEvent).detail));
  return { get count() { return details.length; }, details };
}

describe('lr-flow-canvas keyboard connect boundaries', () => {
  // Each guard below is paired in this file with the ordinary path it short-circuits, so both
  // outcomes are exercised against the same canvas implementation.
  it('cycles eligible targets and commits the chosen one from the keyboard', async () => {
    const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas connectable style="width:800px;height:300px"
      .nodes=${[...pair, { id: 'c', position: { x: 400, y: 0 } }]}></lr-flow-canvas>`);
    const connects = countEvents(el, 'lr-connect');
    const control = nodeControl(el, 'a');
    key(control, 'c');
    await el.updateComplete;
    expect(connectTargets(el)).to.deep.equal(['b']);
    key(control, 'ArrowRight');
    await el.updateComplete;
    expect(connectTargets(el)).to.deep.equal(['c']);
    key(control, 'ArrowUp');
    key(control, 'ArrowDown');
    key(control, 'Enter');
    await el.updateComplete;
    expect(connects.details).to.deep.equal([{ source: 'a', target: 'c', sourceHandle: 'out', targetHandle: 'in' }]);
    expect(connectTargets(el)).to.deep.equal([]);
  });

  it('does not enter connect mode when every other node is already linked from the source', async () => {
    const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas connectable style="width:600px;height:300px"
      .nodes=${pair} .edges=${[{ id: 'a-b', source: 'a', target: 'b' }]}></lr-flow-canvas>`);
    const activations = countEvents(el, 'lr-node-activate');
    const press = key(nodeControl(el, 'a'), 'c');
    await el.updateComplete;
    expect(press.defaultPrevented, 'the connect shortcut is still claimed').to.equal(true);
    expect(connectTargets(el)).to.deep.equal([]);
    // Without a pending connect, Enter keeps its ordinary activation meaning.
    key(nodeControl(el, 'a'), 'Enter');
    expect(activations.details).to.deep.equal([{ nodeId: 'a' }]);
  });

  it('refuses a disabled node as a keyboard-connect source', async () => {
    const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas connectable style="width:600px;height:300px"
      .nodes=${[{ ...pair[0]!, disabled: true }, pair[1]!]}></lr-flow-canvas>`);
    key(nodeControl(el, 'a'), 'c');
    await el.updateComplete;
    expect(connectTargets(el)).to.deep.equal([]);
  });

  it('commits nothing when the pending target becomes linked before the model update renders', async () => {
    const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas connectable style="width:600px;height:300px"
      .nodes=${pair}></lr-flow-canvas>`);
    const connects = countEvents(el, 'lr-connect');
    const control = nodeControl(el, 'a');
    key(control, 'c');
    await el.updateComplete;
    expect(connectTargets(el)).to.deep.equal(['b']);

    // Same task: the host links the only target, then the user's next keystrokes arrive before
    // Lit's update has re-rendered (and cancelled) the pending gesture.
    el.edges = [{ id: 'a-b', source: 'a', target: 'b' }];
    key(control, 'ArrowRight');
    key(control, 'ArrowLeft');
    key(control, 'Enter');
    await el.updateComplete;
    expect(connects.count).to.equal(0);
    expect(connectTargets(el)).to.deep.equal([]);
  });

  it('commits nothing when the canvas turns readonly in the same task as Enter', async () => {
    const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas connectable style="width:600px;height:300px"
      .nodes=${pair}></lr-flow-canvas>`);
    const connects = countEvents(el, 'lr-connect');
    const control = nodeControl(el, 'a');
    key(control, 'c');
    await el.updateComplete;
    el.readonly = true;
    key(control, 'Enter');
    await el.updateComplete;
    expect(connects.count).to.equal(0);
    expect(connectTargets(el)).to.deep.equal([]);
  });

  it('Escape cancels a pending keyboard connect, and Escape with nothing selected changes nothing', async () => {
    const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas connectable style="width:600px;height:300px"
      .nodes=${pair}></lr-flow-canvas>`);
    const selections = countEvents(el, 'lr-selection-change');
    const control = nodeControl(el, 'a');
    key(control, 'c');
    await el.updateComplete;
    key(control, 'Escape');
    await el.updateComplete;
    expect(connectTargets(el)).to.deep.equal([]);
    key(control, 'Escape');
    expect(selections.count, 'an empty selection is not re-cleared').to.equal(0);
  });
});

describe('lr-flow-canvas pointer and drop boundaries', () => {
  it('ignores a second pointer while a background pan is in progress', async () => {
    const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas style="width:400px;height:300px" .nodes=${pair}></lr-flow-canvas>`);
    const bg = el.shadowRoot!.querySelector<HTMLElement>('[part="background"]')!;
    bg.setPointerCapture = () => {};
    bg.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 61, clientX: 100, clientY: 100, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 62, clientX: 300, clientY: 300 }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 62, clientX: 300, clientY: 300 }));
    expect(el.viewport.x).to.equal(0);
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 61, clientX: 130, clientY: 110 }));
    expect([el.viewport.x, el.viewport.y]).to.deep.equal([30, 10]);
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 61, clientX: 130, clientY: 110 }));
    expect(el.shadowRoot!.querySelector('[part="viewport"]')!.hasAttribute('data-panning')).to.equal(false);
  });

  it('ignores a second pointer while a node drag is in progress', async () => {
    const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas nodes-draggable style="width:400px;height:300px"
      .nodes=${[pair[0]!]}></lr-flow-canvas>`);
    const moves = countEvents(el, 'lr-node-move');
    const node = wrapper(el, 'a');
    node.setPointerCapture = () => {};
    node.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 71, clientX: 0, clientY: 0, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 72, clientX: 80, clientY: 80 }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 72, clientX: 80, clientY: 80 }));
    expect(moves.count).to.equal(0);
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 71, clientX: 40, clientY: 0 }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 71, clientX: 40, clientY: 0 }));
    expect(moves.details).to.deep.equal([{ nodeId: 'a', position: { x: 40, y: 0 }, previous: { x: 0, y: 0 } }]);
  });

  it('pans along the physical pointer direction under horizontal RTL', async () => {
    const host = await fixture<HTMLElement>(html`<div dir="rtl"><lr-flow-canvas orientation="horizontal"
      style="width:400px;height:300px" .nodes=${pair}></lr-flow-canvas></div>`);
    const el = host.querySelector<LyraFlowCanvas>('lr-flow-canvas')!;
    await el.updateComplete;
    const bg = el.shadowRoot!.querySelector<HTMLElement>('[part="background"]')!;
    bg.setPointerCapture = () => {};
    bg.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 81, clientX: 100, clientY: 100, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 81, clientX: 140, clientY: 100 }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 81, clientX: 140, clientY: 100 }));
    expect(el.viewport.x, 'the mirrored surface stores the negated delta').to.equal(-40);
  });

  it('ignores drags and drops that carry no palette payload', async () => {
    const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas droppable style="width:400px;height:300px"
      .nodes=${pair}></lr-flow-canvas>`);
    const adds = countEvents(el, 'lr-node-add');
    const viewportEl = el.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
    const foreign = new DataTransfer();
    foreign.setData('text/plain', 'hello');
    const over = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: foreign });
    viewportEl.dispatchEvent(over);
    expect(over.defaultPrevented).to.equal(false);
    expect(viewportEl.hasAttribute('data-drop-active')).to.equal(false);
    const drop = new DragEvent('drop', { bubbles: true, cancelable: true, clientX: 10, clientY: 10, dataTransfer: foreign });
    viewportEl.dispatchEvent(drop);
    expect(drop.defaultPrevented).to.equal(false);
    const empty = new DataTransfer();
    empty.setData(FLOW_PALETTE_MIME_TYPE, '');
    viewportEl.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: empty }));
    expect(adds.count).to.equal(0);
  });
});

describe('lr-flow-canvas rendering boundaries', () => {
  it('shows a node description on the portable card when lr-flow-node is unregistered in the owner realm', async () => {
    const registry = window.customElements;
    const originalGet = registry.get;
    const boundGet = originalGet.bind(registry);
    registry.get = ((name: string) => (name === 'lr-flow-node' ? undefined : boundGet(name))) as typeof registry.get;
    try {
      const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas .nodes=${[
        { id: 'a', position: { x: 0, y: 0 }, data: { label: 'Fetch', description: 'Loads the page' } },
        { id: 'b', position: { x: 200, y: 0 }, data: { label: 'Plain' } },
      ]}></lr-flow-canvas>`);
      const text = (id: string) =>
        wrapper(el, id).querySelector('.portable-node-content span')?.textContent ?? null;
      expect(text('a')).to.equal('Loads the page');
      expect(text('b')).to.equal(null);
    } finally {
      registry.get = originalGet;
    }
  });

  it('re-observes node cards after a reparenting move so later card growth re-routes edges', async () => {
    const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas style="width:600px;height:400px"
      .nodes=${[{ id: 'a', position: { x: 0, y: 0 } }, { id: 'b', position: { x: 0, y: 300 } }]}
      .edges=${[{ id: 'a-b', source: 'a', target: 'b' }]}></lr-flow-canvas>`);
    const path = () => el.shadowRoot!.querySelector('[part="edge"]')?.getAttribute('d') ?? '';
    await waitUntil(() => path() !== '', 'edge rendered');
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const before = path();
    const parent = el.parentNode!;
    const next = document.createElement('div');
    parent.appendChild(next);
    next.appendChild(el);
    await el.updateComplete;
    wrapper(el, 'a').style.minHeight = '220px';
    await waitUntil(() => path() !== before, 'the grown source card moves the edge start');
    next.remove();
  });
});

function addHandle(el: LyraFlowCanvas, nodeId: string, kind: 'input' | 'output', id?: string): HTMLElement {
  const handle = document.createElement('div');
  handle.dataset['handleKind'] = kind;
  if (id !== undefined) handle.dataset['handleId'] = id;
  wrapper(el, nodeId).appendChild(handle);
  return handle;
}

describe('lr-flow-canvas gesture outcomes', () => {
  it('emits no lr-node-move when a drag snaps back onto its starting cell', async () => {
    const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas nodes-draggable style="width:400px;height:300px"
      .nodes=${[pair[0]!]}></lr-flow-canvas>`);
    const moves = countEvents(el, 'lr-node-move');
    const node = wrapper(el, 'a');
    node.setPointerCapture = () => {};
    node.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 91, clientX: 0, clientY: 0, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 91, clientX: 3, clientY: 2 }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 91, clientX: 3, clientY: 2 }));
    expect(moves.count).to.equal(0);
  });

  it('keeps dragging a node whose incident edge dangles at a missing target', async () => {
    const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas nodes-draggable style="width:400px;height:300px"
      .nodes=${[pair[0]!]} .edges=${[{ id: 'a-ghost', source: 'a', target: 'ghost' }]}></lr-flow-canvas>`);
    const moves = countEvents(el, 'lr-node-move');
    const node = wrapper(el, 'a');
    node.setPointerCapture = () => {};
    node.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 92, clientX: 0, clientY: 0, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 92, clientX: 48, clientY: 16 }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 92, clientX: 48, clientY: 16 }));
    expect(moves.details).to.deep.equal([{ nodeId: 'a', position: { x: 48, y: 16 }, previous: { x: 0, y: 0 } }]);
  });

  it('targets the default input handle when a connection is dropped on a node body', async () => {
    const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas connectable style="width:600px;height:300px"
      .nodes=${pair}></lr-flow-canvas>`);
    const connects = countEvents(el, 'lr-connect');
    const output = addHandle(el, 'a', 'output', 'out');
    output.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 93, clientX: 0, clientY: 0, bubbles: true, composed: true }));
    wrapper(el, 'b').dispatchEvent(new PointerEvent('pointerup', { pointerId: 93, clientX: 200, clientY: 0, bubbles: true, composed: true }));
    expect(connects.details).to.deep.equal([{ source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in' }]);
  });

  it('starts no connection from an output handle that carries no handle id', async () => {
    const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas connectable style="width:600px;height:300px"
      .nodes=${pair}></lr-flow-canvas>`);
    const output = addHandle(el, 'a', 'output');
    output.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 94, clientX: 0, clientY: 0, bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="connection-line"]') === null).to.equal(true);
  });

  it('clears the hovered-invalid marker once the pointer moves to a valid target', async () => {
    const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas connectable style="width:600px;height:300px"
      .nodes=${[...pair, { id: 'c', position: { x: 400, y: 0 } }]}
      .edges=${[{ id: 'a-b', source: 'a', target: 'b' }]}></lr-flow-canvas>`);
    const output = addHandle(el, 'a', 'output', 'out');
    output.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 95, clientX: 0, clientY: 0, bubbles: true, composed: true }));
    wrapper(el, 'b').dispatchEvent(new PointerEvent('pointermove', { pointerId: 95, clientX: 200, clientY: 0, bubbles: true, composed: true }));
    expect(wrapper(el, 'b').hasAttribute('data-connect-invalid'), 'duplicate edge target').to.equal(true);
    wrapper(el, 'c').dispatchEvent(new PointerEvent('pointermove', { pointerId: 95, clientX: 400, clientY: 0, bubbles: true, composed: true }));
    expect(wrapper(el, 'b').hasAttribute('data-connect-invalid')).to.equal(false);
    expect(wrapper(el, 'c').hasAttribute('data-connect-invalid')).to.equal(false);
    window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 95 }));
  });

  it('anchors an edge that names an unknown handle at the middle of the node side', async () => {
    const outputs = [{ id: 'left' }, { id: 'right' }];
    const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas orientation="vertical" style="width:600px;height:400px"
      .nodes=${[{ id: 'a', position: { x: 0, y: 0 }, outputs }, { id: 'b', position: { x: 0, y: 300 } }]}
      .edges=${[
        { id: 'known', source: 'a', target: 'b', sourceHandle: 'left' },
        { id: 'unknown', source: 'a', target: 'b', sourceHandle: 'missing' },
      ]}></lr-flow-canvas>`);
    const start = (id: string) => {
      const d = el.shadowRoot!.querySelector(`[data-edge-id="${id}"] [part="edge"]`)?.getAttribute('d') ?? '';
      return Number(/^M\s*([-\d.]+)/.exec(d)?.[1]);
    };
    const width = wrapper(el, 'a').offsetWidth;
    await waitUntil(() => Math.abs(start('unknown') - width / 2) < 1, 'centered anchor');
    expect(Math.abs(start('known') - width / 4)).to.be.lessThan(1);
  });

  it('Escape clears an edge-only selection', async () => {
    const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas style="width:600px;height:300px"
      .nodes=${pair} .edges=${[{ id: 'a-b', source: 'a', target: 'b' }]}></lr-flow-canvas>`);
    const edge = el.shadowRoot!.querySelector<SVGElement>('[part="edge"]')!;
    key(edge, 'Enter');
    expect(el.selectedEdgeIds).to.deep.equal(['a-b']);
    const selections = countEvents(el, 'lr-selection-change');
    key(edge, 'Escape');
    expect(selections.details).to.deep.equal([{ selectedNodeIds: [], selectedEdgeIds: [] }]);
  });

  it('accepts a palette drop next to the rejected ones', async () => {
    const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas droppable style="width:400px;height:300px"
      .nodes=${pair}></lr-flow-canvas>`);
    const adds = countEvents(el, 'lr-node-add');
    const viewportEl = el.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
    const palette = new DataTransfer();
    palette.setData(FLOW_PALETTE_MIME_TYPE, JSON.stringify({ type: ' llm ' }));
    const over = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: palette });
    viewportEl.dispatchEvent(over);
    expect(over.defaultPrevented).to.equal(true);
    viewportEl.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientX: 0, clientY: 0, dataTransfer: palette }));
    expect(adds.details.map((detail) => (detail as { type: string }).type)).to.deep.equal(['llm']);
  });

  it('ignores drag events that carry no data transfer at all', async () => {
    const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas droppable style="width:400px;height:300px"
      .nodes=${pair}></lr-flow-canvas>`);
    const adds = countEvents(el, 'lr-node-add');
    const viewportEl = el.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
    viewportEl.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true }));
    expect(viewportEl.hasAttribute('data-drop-active')).to.equal(false);
    viewportEl.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true }));
    expect(adds.count).to.equal(0);
  });
});

describe('lr-flow-canvas imperative API boundaries', () => {
  it('focusNode() ignores an unknown id and clamps an explicit zoom to the bounds', async () => {
    const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas max-zoom="1.5" style="width:600px;height:400px"
      .nodes=${pair}></lr-flow-canvas>`);
    el.setViewport({ x: 10, y: 20, zoom: 1 });
    el.focusNode('missing');
    expect(el.viewport).to.deep.equal({ x: 10, y: 20, zoom: 1 });
    el.focusNode('b', { zoom: 40 });
    expect(el.viewport.zoom).to.equal(1.5);
  });

  it('publishes edge decoration status in companion snapshots', async () => {
    const el = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas style="width:600px;height:300px"
      .nodes=${pair} .edges=${[{ id: 'a-b', source: 'a', target: 'b' }]}
      .decorations=${{ 'a-b': { status: 'running' }, a: { status: 'success' } }}></lr-flow-canvas>`);
    const snapshot = await new Promise<{ nodes: readonly { id: string; status?: string }[]; edges: readonly { id: string; status?: string }[] }>((resolve) => {
      const release = el.registerCompanion((value) => { release(); resolve(value); });
    });
    expect(snapshot.edges.map((edge) => [edge.id, edge.status])).to.deep.equal([['a-b', 'running']]);
    expect(snapshot.nodes.map((node) => [node.id, node.status])).to.deep.equal([['a', 'success'], ['b', undefined]]);
  });
});
