import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './flow-canvas.js';
import '../flow-controls/flow-controls.js';
import '../flow-minimap/flow-minimap.js';
import type { FlowNode, FlowEdge, LyraFlowCanvas } from './flow-canvas.js';

const nodes: readonly FlowNode[] = [
  { id: 'fetch', type: 'source', position: { x: 0, y: 0 }, data: { label: 'Fetch data' } },
  { id: 'summarize', type: 'transform', position: { x: 240, y: 0 }, data: { label: 'Summarize' } },
  { id: 'notify', type: 'sink', position: { x: 480, y: 0 }, data: { label: 'Notify' } },
];

const edges: readonly FlowEdge[] = [
  { id: 'fetch-summarize', source: 'fetch', target: 'summarize', label: 'then' },
  { id: 'summarize-notify', source: 'summarize', target: 'notify' },
];

const meta: Meta = {
  title: 'Flow Canvas',
  component: 'lr-flow-canvas',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Nodes, edges, selected ids, and decoration records are detached, deeply frozen, and bounded at assignment (10,000 outer entries plus finite nested-data budgets); reassign a collection after changes. Node and edge collections use unique nonempty first-wins ids before layout or interaction, and controlled selections retain only unique nonblank identities in the current canonical model. Explicit positions remain caller-controlled; negative or larger-than-safe-integer centers render but are not passed to bounded auto-layout as fixed anchors. Activation and move events expose domain-named nodeId/edgeId fields.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-flow-canvas style="width:100%;height:24rem" .nodes=${nodes} .edges=${edges}></lr-flow-canvas>
  `,
};

export const ReadableRtlCards: Story = {
  render: () => html`
    <div dir="rtl">
      <lr-flow-canvas orientation="horizontal" style="width:100%;height:24rem" .nodes=${nodes} .edges=${edges}>
        <lr-flow-node node-id="summarize" heading="Summarize"></lr-flow-node>
      </lr-flow-canvas>
    </div>
  `,
};

export const DynamicAuthoredCardLease: Story = {
  name: 'Dynamic authored-card matching',
  parameters: {
    docs: {
      description: {
        story:
          'A direct child with `node-id` is projected into that node’s named slot. Changing its id live retargets the card; an unmatched id restores the child’s authored slot and leaves it undisplayed without affecting named companions.',
      },
    },
  },
  render: () => {
    const retargetCard = (event: Event): void => {
      const control = event.currentTarget as HTMLButtonElement;
      const targetNodeId = control.dataset['nodeId'];
      const scope = control.closest<HTMLElement>('[data-authored-card-story]');
      const card = scope?.querySelector<HTMLElement>('[data-authored-card]');
      const output = scope?.querySelector<HTMLOutputElement>('output');
      if (!targetNodeId || !card || !output) return;
      card.setAttribute('node-id', targetNodeId);
      output.textContent = targetNodeId === 'missing'
        ? 'The unmatched card is not rendered.'
        : `The card now renders in ${targetNodeId}.`;
    };
    return html`
      <div data-authored-card-story style="display:grid;gap:var(--lr-space-s)">
        <div style="display:flex;flex-wrap:wrap;gap:var(--lr-space-xs)">
          <button type="button" data-node-id="fetch" @click=${retargetCard}>Match Fetch</button>
          <button type="button" data-node-id="summarize" @click=${retargetCard}>Match Summarize</button>
          <button type="button" data-node-id="missing" @click=${retargetCard}>Make unmatched</button>
        </div>
        <lr-flow-canvas style="width:100%;height:24rem" .nodes=${nodes} .edges=${edges}>
          <div node-id="fetch" slot="consumer-card-slot" data-authored-card>
            Consumer-authored card
          </div>
          <lr-flow-controls slot="bottom-end" orientation="horizontal"></lr-flow-controls>
        </lr-flow-canvas>
        <output aria-live="polite">The card renders in fetch.</output>
      </div>
    `;
  },
};

export const Editable: Story = {
  render: () => html`
    <lr-flow-canvas
      style="width:100%;height:24rem"
      nodes-draggable
      connectable
      .nodes=${nodes}
      .edges=${edges}
    ></lr-flow-canvas>
  `,
};

/** A node can be marked `disabled`, rendering it as a genuinely non-actionable card: no selection
 *  by click or keyboard, roving-tabindex navigation steps past it, it cannot be dragged, and it
 *  cannot start or receive a new connection while `connectable`. */
export const DisabledNode: Story = {
  render: () => {
    const disabledNodes: readonly FlowNode[] = [
      nodes[0]!,
      { ...nodes[1]!, disabled: true, data: { label: 'Summarize (unavailable)' } },
      nodes[2]!,
    ];
    return html`
      <lr-flow-canvas
        style="width:100%;height:24rem"
        nodes-draggable
        connectable
        .nodes=${disabledNodes}
        .edges=${edges}
      ></lr-flow-canvas>
    `;
  },
};

export const RunningEdgeMotion: Story = {
  name: 'Running-edge motion duration',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-flow-canvas-march-duration` accepts a time value and falls back to the time-only `--lr-duration-ambient` token. It does not use the `--lr-transition-ambient` shorthand, because the animation supplies its own linear timing function.',
      },
    },
  },
  render: () => html`
    <lr-flow-canvas
      style="width:100%;height:24rem;--lr-flow-canvas-march-duration:750ms"
      .nodes=${nodes}
      .edges=${edges}
      .decorations=${{ 'fetch-summarize': { status: 'running' } }}
    ></lr-flow-canvas>
  `,
};

/** Enabling `readonly` during a pan rolls the preview back and retires the pointer stream. */
export const LiveLockCancelsGesture: Story = {
  render: () => {
    const lockMidPan = async (event: Event): Promise<void> => {
      const wrapper = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-live-lock]');
      const canvas = wrapper?.querySelector<LyraFlowCanvas>('lr-flow-canvas');
      const output = wrapper?.querySelector('output');
      const background = canvas?.shadowRoot?.querySelector<HTMLElement>('[part="background"]');
      if (!canvas || !background || !output) return;
      canvas.readonly = false;
      await canvas.updateComplete;
      background.setPointerCapture = () => {};
      background.dispatchEvent(new PointerEvent('pointerdown', {
        pointerId: 61, clientX: 100, clientY: 100, bubbles: true,
      }));
      window.dispatchEvent(new PointerEvent('pointermove', {
        pointerId: 61, clientX: 150, clientY: 80,
      }));
      canvas.readonly = true;
      await canvas.updateComplete;
      output.textContent = `Locked viewport: ${JSON.stringify(canvas.viewport)}`;
    };
    return html`
      <div data-live-lock style="display:grid;gap:var(--lr-space-s)">
        <button type="button" @click=${lockMidPan}>Pan, then lock</button>
        <lr-flow-canvas
          style="width:100%;height:24rem"
          nodes-draggable
          connectable
          .nodes=${nodes}
          .edges=${edges}
        ></lr-flow-canvas>
        <output aria-live="polite">The canvas is unlocked</output>
      </div>
    `;
  },
};

/** Replacing the controlled node model during a drag retires the stale id without an edit event. */
export const ModelRefreshCancelsGesture: Story = {
  render: () => {
    const refreshMidDrag = async (event: Event): Promise<void> => {
      const wrapper = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-model-refresh]');
      const canvas = wrapper?.querySelector<LyraFlowCanvas>('lr-flow-canvas');
      const output = wrapper?.querySelector('output');
      if (!canvas || !output) return;
      canvas.nodes = nodes;
      await canvas.updateComplete;
      const dragged = canvas.shadowRoot?.querySelector<HTMLElement>('[data-node-id="fetch"]');
      if (!dragged) return;
      dragged.setPointerCapture = () => {};
      dragged.dispatchEvent(new PointerEvent('pointerdown', {
        pointerId: 62, clientX: 0, clientY: 0, bubbles: true,
      }));
      window.dispatchEvent(new PointerEvent('pointermove', {
        pointerId: 62, clientX: 48, clientY: 0,
      }));
      canvas.nodes = nodes.filter((node) => node.id !== 'fetch');
      await canvas.updateComplete;
      window.dispatchEvent(new PointerEvent('pointerup', {
        pointerId: 62, clientX: 48, clientY: 0,
      }));
      output.textContent = 'Model refreshed; stale drag retired';
    };
    return html`
      <div data-model-refresh style="display:grid;gap:var(--lr-space-s)">
        <button type="button" @click=${refreshMidDrag}>Drag, then replace nodes</button>
        <lr-flow-canvas
          style="width:100%;height:24rem"
          nodes-draggable
          connectable
          .nodes=${nodes}
          .edges=${edges}
          @lr-node-move=${(event: Event) => {
            const output = (event.currentTarget as HTMLElement).nextElementSibling;
            if (output instanceof HTMLOutputElement) output.textContent = 'Unexpected stale move';
          }}
        ></lr-flow-canvas>
        <output aria-live="polite">The original model is active</output>
      </div>
    `;
  },
};

export const Empty: Story = {
  render: () => html`<lr-flow-canvas style="width:100%;height:16rem"></lr-flow-canvas>`,
};

export const NarrowAllocation: Story = {
  name: 'Narrow allocation (320px)',
  parameters: {
    docs: {
      description: {
        story: 'At a 320px allocation the canvas stays a functional pan/zoom viewer; the shared wrapping rail prevents horizontal controls and the minimap from overlapping.',
      },
    },
  },
  render: () => html`
    <div style="inline-size:320px; max-inline-size:100%; block-size:16rem; border:1px dashed var(--lr-color-border);">
      <lr-flow-canvas style="width:100%;height:100%" .nodes=${nodes} .edges=${edges}>
        <lr-flow-controls slot="bottom-start" orientation="horizontal"></lr-flow-controls>
        <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
      </lr-flow-canvas>
    </div>
  `,
};

export const RetintedSelectedNode: Story = {
  name: 'Retinted selected node outline',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-flow-canvas-node-selected-outline-color` recolors the selected node outline on its own. Selection is exposed by each hidden node control\'s `aria-pressed` state and by the wrapper\'s `data-selected` marker. Unset, it renders exactly as before.',
      },
    },
  },
  render: () => html`
    <lr-flow-canvas
      style="width:100%;height:24rem;--lr-flow-canvas-node-selected-outline-color: var(--lr-color-success)"
      .nodes=${nodes}
      .edges=${edges}
      .selectedNodeIds=${['summarize']}
    ></lr-flow-canvas>
  `,
};

/** An application theme's public grid hook wins over the numeric `grid` property's fallback. */
export const GridThemeOverride: Story = {
  render: () => html`
    <div style="--lr-flow-canvas-grid-size: var(--lr-size-2rem);">
      <lr-flow-canvas
        grid="16"
        style="width:100%;height:24rem"
        .nodes=${nodes}
        .edges=${edges}
      ></lr-flow-canvas>
    </div>
  `,
};

/** Edge tone hooks color both each stroke and the arrowhead marker that edge references. */
export const RetintedEdgeTones: Story = {
  render: () => html`
    <div
      style="
        --lr-flow-canvas-edge-success-color: var(--lr-color-brand);
        --lr-flow-canvas-edge-danger-color: var(--lr-color-warning);
      "
    >
      <lr-flow-canvas
        style="width:100%;height:24rem"
        .nodes=${nodes}
        .edges=${[
          { id: 'fetch-summarize', source: 'fetch', target: 'summarize', label: 'success', tone: 'success' },
          { id: 'summarize-notify', source: 'summarize', target: 'notify', label: 'danger', tone: 'danger' },
        ] satisfies readonly FlowEdge[]}
      ></lr-flow-canvas>
    </div>
  `,
};

/** `--lr-flow-canvas-connection-line-color` retints `[part="connection-line"]`, the ghost path
 *  drawn while dragging a new connection from a node's output handle (drag from a handle to see
 *  it), independent of a finished edge's own `--lr-flow-canvas-edge-*-color` tone hooks. */
export const RetintedConnectionLine: Story = {
  render: () => html`
    <div style="--lr-flow-canvas-connection-line-color: var(--lr-color-danger);">
      <lr-flow-canvas
        connectable
        style="width:100%;height:24rem"
        .nodes=${nodes}
        .edges=${edges}
      ></lr-flow-canvas>
    </div>
  `,
};

export const LargeWorkflow: Story = {
  parameters: { docs: { description: { story:
    'Pan or use keyboard navigation across 1,000 nodes. The canvas renders visible cards and keeps selected and active items available; the minimap retains the complete overview.' } } },
  render: () => {
    const workflow = Array.from({ length: 1000 }, (_, index) => ({
      id: `step-${index}`, position: { x: (index % 50) * 320, y: Math.floor(index / 50) * 200 },
      data: { label: `Step ${index + 1}` },
    }));
    return html`<lr-flow-canvas style="width:100%;height:32rem" .nodes=${workflow}>
      <lr-flow-controls slot="bottom-start"></lr-flow-controls>
      <lr-flow-minimap slot="bottom-end"></lr-flow-minimap>
    </lr-flow-canvas>`;
  },
};

/** Input metadata admission and graph layout have independent notices. */
export const InputLimit: Story = {
  render: () => html`<lr-flow-canvas .nodes=${[{
    id: 'source', position: { x: 0, y: 0 },
    data: Object.fromEntries(Array.from({ length: 10_001 }, (_, index) => [`field-${index}`, index])),
  }]}></lr-flow-canvas>`,
};

/** The provider owns the complete graph; the positioned scene and records page stay bounded. */
export const SourceViewport: Story = {
  render: () => {
    const rows = [
      ...nodes.map((value, order) => ({ key: `node:${value.id}`, order, value: { kind: 'node' as const, value } })),
      ...edges.map((value, order) => ({ key: `edge:${value.id}`, order, value: { kind: 'edge' as const, value } })),
    ];
    const matches = (query: import('../../../data-sources.js').LyraGraphSourceQuery) => rows.filter(row => {
      if (row.value.kind !== (query.kind === 'nodes' ? 'node' : 'edge')) return false;
      if (query.search && !row.key.toLowerCase().includes(query.search.toLowerCase())) return false;
      if (!query.centerKey || row.value.kind !== 'edge') return true;
      const id = query.centerKey.slice(5), edge = row.value.value;
      return query.direction === 'in' ? edge.target === id : query.direction === 'out' ? edge.source === id : edge.source === id || edge.target === id;
    });
    const worldBounds = { x: -100, y: -100, width: 1000, height: 400 };
    const source: import('./flow-canvas.class.js').FlowCanvasSource = {
      revision: 1,
      records: {
        revision: 1,
        query: async ({ query, page, pageSize }) => {
          const all = matches(query), start = page * pageSize;
          return { rows: all.slice(start, start + pageSize).map((row, index) => ({ ...row, order: start + index })),
            total: all.length, summary: { nodes: nodes.length, edges: edges.length } };
        },
        lookup: async keys => rows.filter(row => keys.includes(row.key)),
        locate: async (key, query) => { const index = matches(query).findIndex(row => row.key === key); return index < 0 ? null : index; },
      },
      scene: async () => ({
        nodes: nodes.map(value => ({ key: `node:${value.id}`, value, position: value.position! })),
        edges: edges.map(value => ({ key: `edge:${value.id}`, value, source: `node:${value.source}`, target: `node:${value.target}` })),
        coverage: 'complete', total: { nodes: nodes.length, edges: edges.length }, worldBounds,
      }),
      overview: async () => ({ bounds: worldBounds, bins: [{ bounds: worldBounds, count: nodes.length }] }),
    };
    return html`<lr-flow-canvas style="height:32rem" .graphSource=${source}>
      <lr-flow-controls slot="controls"></lr-flow-controls><lr-flow-minimap slot="minimap"></lr-flow-minimap>
    </lr-flow-canvas>`;
  },
};
