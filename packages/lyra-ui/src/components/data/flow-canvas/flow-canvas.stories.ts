import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './flow-canvas.js';
import '../flow-controls/flow-controls.js';
import '../flow-minimap/flow-minimap.js';
import type { FlowNode, FlowEdge, LyraFlowCanvas } from './flow-canvas.js';

const nodes: FlowNode[] = [
  { id: 'fetch', position: { x: 0, y: 0 }, data: { label: 'Fetch data' } },
  { id: 'summarize', position: { x: 240, y: 0 }, data: { label: 'Summarize' } },
  { id: 'notify', position: { x: 480, y: 0 }, data: { label: 'Notify' } },
];

const edges: FlowEdge[] = [
  { id: 'fetch-summarize', source: 'fetch', target: 'summarize', label: 'then' },
  { id: 'summarize-notify', source: 'summarize', target: 'notify' },
];

const meta: Meta = {
  title: 'Flow Canvas',
  component: 'lr-flow-canvas',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-flow-canvas style="width:100%;height:24rem" .nodes=${nodes} .edges=${edges}></lr-flow-canvas>
  `,
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

/** Enabling `locked` during a pan rolls the preview back and retires the pointer stream. */
export const LiveLockCancelsGesture: Story = {
  render: () => {
    const lockMidPan = async (event: Event): Promise<void> => {
      const wrapper = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-live-lock]');
      const canvas = wrapper?.querySelector<LyraFlowCanvas>('lr-flow-canvas');
      const output = wrapper?.querySelector('output');
      const background = canvas?.shadowRoot?.querySelector<HTMLElement>('[part="background"]');
      if (!canvas || !background || !output) return;
      canvas.locked = false;
      await canvas.updateComplete;
      background.setPointerCapture = () => {};
      background.dispatchEvent(new PointerEvent('pointerdown', {
        pointerId: 61, clientX: 100, clientY: 100, bubbles: true,
      }));
      window.dispatchEvent(new PointerEvent('pointermove', {
        pointerId: 61, clientX: 150, clientY: 80,
      }));
      canvas.locked = true;
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

export const RetintedCurrentNode: Story = {
  name: 'Retinted current node outline',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-flow-canvas-node-current-outline-color` recolors the current (`aria-current`) node outline on its own. `::part(node)[aria-current]` is invalid CSS, so without this property the outline could only be restyled by overriding the library-wide `--lr-color-brand` token. Unset, it renders exactly as before.',
      },
    },
  },
  render: () => html`
    <lr-flow-canvas
      style="width:100%;height:24rem;--lr-flow-canvas-node-current-outline-color: var(--lr-color-success)"
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
        ] satisfies FlowEdge[]}
      ></lr-flow-canvas>
    </div>
  `,
};
