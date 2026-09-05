import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './flow-canvas.js';
import '../flow-node/flow-node.js';
import '../flow-run-status/flow-run-status.js';
import type { LyraFlowCanvas } from './flow-canvas.js';
import type { FlowHandle, FlowRunDecoration, FlowRunDecorations } from './flow-types.js';
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
