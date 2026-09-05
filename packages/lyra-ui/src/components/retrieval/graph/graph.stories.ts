import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type {
  LyraGraphCommunity,
  LyraGraphLink,
  LyraGraphNode,
  LyraGraph,
} from './graph.js';
import type { LyraNodeTypeStyle } from '../../../internal/node-type-style.js';

const nodes: LyraGraphNode[] = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
  { id: 'c', label: 'C' },
  { id: 'd', label: 'D' },
];

const links: LyraGraphLink[] = [
  { source: 'a', target: 'b' },
  { source: 'a', target: 'c' },
  { source: 'b', target: 'd' },
  { source: 'c', target: 'd' },
];

const relationshipNodes: LyraGraphNode[] = [
  {
    id: 'judgment',
    label: 'Judgment',
    accessibleLabel: 'Judgment, the source document',
    description: 'The decision whose citations are shown.',
    color: 'var(--lr-color-brand)',
  },
  {
    id: 'opinion',
    label: 'Opinion',
    accessibleLabel: 'Advocate General opinion, cited by the judgment',
    description: 'A related legal opinion.',
    color: 'var(--lr-color-success)',
  },
  {
    id: 'regulation',
    label: 'Regulation',
    description: 'The governing regulation.',
  },
];

const relationshipLinks: LyraGraphLink[] = [
  {
    id: 'judgment-cites-opinion',
    source: 'judgment',
    target: 'opinion',
    label: 'cites',
    accessibleLabel: 'Judgment cites the Advocate General opinion',
    description: 'A directed citation relationship.',
    directed: true,
    color: 'var(--lr-color-brand)',
    width: 2.5,
  },
  {
    id: 'judgment-applies-regulation',
    source: 'judgment',
    target: 'regulation',
    label: 'applies',
    description: 'A dashed directed relationship.',
    directed: true,
    color: 'var(--lr-color-success)',
    dash: [7, 4],
    width: 2,
  },
];

const meta: Meta = {
  title: 'Graph',
  component: 'lr-graph',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-graph
      width="480"
      height="320"
      style="height: 20rem"
      .nodes=${nodes}
      .links=${links}
    ></lr-graph>
  `,
};

export const DeclarativeFocus: Story = {
  render: () => html`
    <lr-graph
      .nodes=${nodes}
      .links=${links}
      focus-node-id="b"
      width="480"
      height="320"
      style="height: 20rem"
      seed="42"
    ></lr-graph>
  `,
};

export const NarrowLongContent: Story = {
  name: 'Narrow long content (320px)',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-graph
        aria-label="Long legal and scientific relationship labels in a narrow graph allocation"
        width="320"
        height="320"
        seed="42"
        show-edge-labels
        style="block-size: 20rem"
        .nodes=${[
          {
            id: 'unbroken-source-identifier-that-must-not-expand-the-allocation',
            label:
              'unbroken-source-identifier-that-must-not-expand-the-allocation',
            description:
              'A deliberately long source description used to exercise tooltip wrapping.',
          },
          {
            id: 'target',
            label: 'A target node with a long human-readable label',
            description:
              'A second deliberately long description for narrow tooltip containment.',
          },
        ] satisfies LyraGraphNode[]}
        .links=${[
          {
            source:
              'unbroken-source-identifier-that-must-not-expand-the-allocation',
            target: 'target',
            label: 'a-very-long-relationship-label-without-natural-breaks',
            directed: true,
          },
        ] satisfies LyraGraphLink[]}
      ></lr-graph>
    </div>
  `,
};

export const NormalizedLinkWidths: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Link widths are normalized consistently in SVG, canvas paint, and canvas picking: ' +
          'negative values clamp to zero and non-finite values use the 1.5 default. Zero-width ' +
          'links paint no stroke or arrowhead and stay outside keyboard navigation while their ' +
          'topology remains in the accessible summary. Use the arrow keys to move past them.',
      },
    },
  },
  render: () =>
    html`${(['svg', 'canvas'] as const).map(
      (renderer) => html`
        <lr-graph
          renderer=${renderer}
          width="480"
          height="320"
          seed="42"
          style="height: 20rem"
          .nodes=${nodes}
          .links=${[
            { source: 'a', target: 'd', width: 0, directed: true },
            { source: 'a', target: 'b', width: Number.NaN },
            { source: 'a', target: 'c', width: -4 },
            { source: 'b', target: 'd', width: 2.5 },
          ] satisfies LyraGraphLink[]}
        ></lr-graph>
      `
    )}`,
};

export const DimmedNeighborhood: Story = {
  name: 'Dimmed non-neighbors (controlled)',
  parameters: {
    docs: {
      description: {
        story:
          'dimmedNodeIds/dimmedLinkIds are controlled -- the host computes the complement of a ' +
          "hovered node's neighbor set (e.g. from lr-node-enter) and assigns it back. This story " +
          'holds a static example: node "a" and its incident links stay at full opacity; everything ' +
          'else is dimmed via --lr-graph-dimmed-opacity.',
      },
    },
  },
  render: () => html`
    <lr-graph
      .nodes=${nodes}
      .links=${links}
      .dimmedNodeIds=${['c', 'd']}
      .dimmedLinkIds=${['b->d', 'c->d']}
      style="--lr-graph-dimmed-opacity: 0.15; width: 100%; height: 400px;"
    ></lr-graph>
  `,
};

export const ClickPosition: Story = {
  render: () => {
    const report = (
      event: CustomEvent<{ nodeId: string; x: number; y: number }>
    ) => {
      const output = (
        event.currentTarget as HTMLElement
      ).parentElement?.querySelector('output');
      if (output)
        output.textContent = `${event.detail.nodeId}: (${event.detail.x.toFixed(
          1
        )}, ${event.detail.y.toFixed(1)})`;
    };
    return html`
      <div>
        <lr-graph
          width="480"
          height="320"
          style="height: 20rem"
          seed="42"
          .nodes=${nodes}
          .links=${links}
          @lr-node-click=${report}
        ></lr-graph>
        <output>Click a node to inspect its local position.</output>
      </div>
    `;
  },
};

export const TunedForces: Story = {
  render: () => html`
    <lr-graph
      width="480"
      height="320"
      style="height: 20rem"
      charge-strength="-900"
      link-distance="200"
      .nodes=${nodes}
      .links=${links}
    ></lr-graph>
  `,
};

export const BoundedZoom: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Change the mounted graph bounds, then use the wheel to reach the new limits. SVG and canvas both apply the latest minimum and maximum.',
      },
    },
  },
  render: () =>
    html`${(['svg', 'canvas'] as const).map(
      (renderer) => html`
        <div>
          <button
            type="button"
            @click=${(event: Event) => {
              const graph = (
                event.currentTarget as HTMLElement
              ).parentElement!.querySelector<LyraGraph>('lr-graph')!;
              const constrained = graph.maxZoom !== 2;
              graph.minZoom = constrained ? 1 : 0.1;
              graph.maxZoom = constrained ? 2 : 8;
            }}
          >
            Toggle ${renderer} zoom bounds between 1–2 and 0.1–8
          </button>
          <lr-graph
            renderer=${renderer}
            width="480"
            height="320"
            style="height: 20rem"
            min-zoom="1"
            max-zoom="2"
            .nodes=${nodes}
            .links=${links}
          ></lr-graph>
        </div>
      `
    )}`,
};

export const SeededLayout: Story = {
  render: () => html`
    <p>
      Both graphs below share <code>seed="42"</code> — reload the page or diff a
      screenshot across builds and their node positions are bit-identical,
      unlike the non-seeded <code>Default</code> story above.
    </p>
    <div style="display: flex; gap: 1rem; flex-wrap: wrap">
      <lr-graph
        width="320"
        height="240"
        style="height: 15rem"
        seed="42"
        .nodes=${nodes}
        .links=${links}
      ></lr-graph>
      <lr-graph
        width="320"
        height="240"
        style="height: 15rem"
        seed="42"
        .nodes=${nodes}
        .links=${links}
      ></lr-graph>
    </div>
  `,
};

export const DirectedRelationships: Story = {
  render: () => {
    const reportLink = (
      event: CustomEvent<{
        sourceNodeId: string;
        targetNodeId: string;
        linkId?: string;
      }>
    ) => {
      const output = (
        event.currentTarget as HTMLElement
      ).parentElement?.querySelector('output');
      if (output) {
        output.textContent = `Activated ${
          event.detail.linkId ?? 'unidentified link'
        }: ${event.detail.sourceNodeId} → ${event.detail.targetNodeId}`;
      }
    };

    return html`
      <div>
        <lr-graph
          aria-label="Legal citation relationships"
          width="520"
          height="320"
          seed="42"
          style="height: 20rem"
          .nodes=${relationshipNodes}
          .links=${relationshipLinks}
          @lr-link-click=${reportLink}
        ></lr-graph>
        <output aria-live="polite"
          >Activate a link to inspect its stable id.</output
        >
      </div>
    `;
  },
};

const typedNodes: LyraGraphNode[] = [
  { id: 'collect', label: 'Collect', type: 'input', communityId: 'pipeline' },
  { id: 'rank', label: 'Rank', type: 'process', communityId: 'pipeline' },
  { id: 'answer', label: 'Answer', type: 'output', communityId: 'response' },
];

const typedLinks: LyraGraphLink[] = [
  {
    id: 'collect-rank',
    source: 'collect',
    target: 'rank',
    label: 'feeds',
    directed: true,
  },
  {
    id: 'rank-answer',
    source: 'rank',
    target: 'answer',
    label: 'grounds',
    directed: true,
  },
];

const nodeTypes: LyraNodeTypeStyle[] = [
  { id: 'input', label: 'Input', shape: 'circle' },
  { id: 'process', label: 'Processing', shape: 'diamond' },
  { id: 'output', label: 'Output', shape: 'square' },
];

const communities: LyraGraphCommunity[] = [
  {
    id: 'pipeline',
    label: 'Retrieval pipeline',
    memberIds: ['collect', 'rank'],
  },
  { id: 'response', label: 'Response', memberIds: ['answer'] },
];

export const CanvasLayeredCommunities: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Canvas rendering, deterministic layered layout, node types, community hulls, and controlled multiple selection. The palette button changes inherited graph tokens; the canvas repaints without reassigning its data.',
      },
    },
  },
  render: () => {
    const showHover = (
      event: CustomEvent<{ nodeId?: string; linkId?: string }>
    ) => {
      const output = (event.currentTarget as HTMLElement)
        .closest('.graph-canvas-demo')
        ?.querySelector('output');
      if (output)
        output.textContent = event.type.endsWith('-leave')
          ? 'Hover a node or link'
          : `Hovered ${event.detail.nodeId ? 'node' : 'link'}: ${
              event.detail.nodeId ?? event.detail.linkId
            }`;
    };
    const applySelection = (
      event: CustomEvent<{ nodeIds: string[]; linkIds: string[] }>
    ) => {
      const graph = event.currentTarget as LyraGraph;
      graph.selectedNodeIds = event.detail.nodeIds;
      graph.selectedLinkIds = event.detail.linkIds;
    };
    const togglePalette = (event: Event) => {
      const graph = (event.currentTarget as HTMLElement)
        .closest('.graph-canvas-demo')
        ?.querySelector('lr-graph') as LyraGraph | null;
      if (!graph) return;
      const alternate = graph.dataset['palette'] !== 'alternate';
      graph.dataset['palette'] = alternate ? 'alternate' : 'default';
      graph.style.setProperty(
        '--lr-node-fill',
        alternate ? 'var(--lr-color-warning)' : 'var(--lr-color-brand)'
      );
      graph.style.setProperty(
        '--lr-link-color',
        alternate ? 'var(--lr-color-success)' : 'var(--lr-color-border)'
      );
    };

    return html`
      <div class="graph-canvas-demo" style="display:grid;gap:0.75rem">
        <button
          type="button"
          style="justify-self:start"
          @click=${togglePalette}
        >
          Toggle canvas palette
        </button>
        <output>Hover a node or link</output>
        <lr-graph
          aria-label="Layered retrieval pipeline"
          renderer="canvas"
          layout="layered"
          selection-mode="multiple"
          show-edge-labels
          width="520"
          height="320"
          style="height:20rem"
          .nodes=${typedNodes}
          .links=${typedLinks}
          .nodeTypes=${nodeTypes}
          .communities=${communities}
          .selectedNodeIds=${['rank']}
          @lr-selection-change=${applySelection}
          @lr-node-enter=${showHover}
          @lr-node-leave=${showHover}
          @lr-link-enter=${showHover}
          @lr-link-leave=${showHover}
        ></lr-graph>
      </div>
    `;
  },
};
