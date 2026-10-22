import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type {
  LyraGraphCommunity,
  LyraGraphEdge,
  LyraGraphNode,
  LyraGraph,
  GraphSource,
} from './graph.js';
import type { LyraNodeTypeStyle } from '../../../internal/node-type-style.js';

const nodes: LyraGraphNode[] = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
  { id: 'c', label: 'C' },
  { id: 'd', label: 'D' },
];

const links: LyraGraphEdge[] = [
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

const relationshipLinks: LyraGraphEdge[] = [
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
      .edges=${links}
    ></lr-graph>
  `,
};

export const DeclarativeFocus: Story = {
  render: () => html`
    <lr-graph
      .nodes=${nodes}
      .edges=${links}
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
        with-edge-labels
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
        .edges=${[
          {
            source:
              'unbroken-source-identifier-that-must-not-expand-the-allocation',
            target: 'target',
            label: 'a-very-long-relationship-label-without-natural-breaks',
            directed: true,
          },
        ] satisfies LyraGraphEdge[]}
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
          .edges=${[
            { source: 'a', target: 'd', width: 0, directed: true },
            { source: 'a', target: 'b', width: Number.NaN },
            { source: 'a', target: 'c', width: -4 },
            { source: 'b', target: 'd', width: 2.5 },
          ] satisfies LyraGraphEdge[]}
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
          'dimmedNodeIds/dimmedEdgeIds are controlled -- the host computes the complement of a ' +
          "hovered node's neighbor set (e.g. from lr-node-enter) and assigns it back. This story " +
          'holds a static example: node "a" and its incident links stay at full opacity; everything ' +
          'else is dimmed via --lr-graph-dimmed-opacity.',
      },
    },
  },
  render: () => html`
    <lr-graph
      .nodes=${nodes}
      .edges=${links}
      .dimmedNodeIds=${['c', 'd']}
      .dimmedEdgeIds=${['b->d', 'c->d']}
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
          .edges=${links}
          @lr-node-activate=${report}
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
      edge-distance="200"
      .nodes=${nodes}
      .edges=${links}
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
            .edges=${links}
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
        .edges=${links}
      ></lr-graph>
      <lr-graph
        width="320"
        height="240"
        style="height: 15rem"
        seed="42"
        .nodes=${nodes}
        .edges=${links}
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
        edgeId?: string;
      }>
    ) => {
      const output = (
        event.currentTarget as HTMLElement
      ).parentElement?.querySelector('output');
      if (output) {
        output.textContent = `Activated ${
          event.detail.edgeId ?? 'unidentified link'
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
          .edges=${relationshipLinks}
          @lr-edge-activate=${reportLink}
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

const typedLinks: LyraGraphEdge[] = [
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
      event: CustomEvent<{ nodeId?: string; edgeId?: string }>
    ) => {
      const output = (event.currentTarget as HTMLElement)
        .closest('.graph-canvas-demo')
        ?.querySelector('output');
      if (output)
        output.textContent = event.type.endsWith('-leave')
          ? 'Hover a node or link'
          : `Hovered ${event.detail.nodeId ? 'node' : 'link'}: ${
              event.detail.nodeId ?? event.detail.edgeId
            }`;
    };
    const applySelection = (
      event: CustomEvent<{ selectedNodeIds: string[]; selectedEdgeIds: string[] }>
    ) => {
      const graph = event.currentTarget as LyraGraph;
      graph.selectedNodeIds = event.detail.selectedNodeIds;
      graph.selectedEdgeIds = event.detail.selectedEdgeIds;
    };
    const togglePalette = (event: Event) => {
      const graph = (event.currentTarget as HTMLElement)
        .closest('.graph-canvas-demo')
        ?.querySelector('lr-graph') as LyraGraph | null;
      if (!graph) return;
      const alternate = graph.dataset['palette'] !== 'alternate';
      graph.dataset['palette'] = alternate ? 'alternate' : 'default';
      graph.style.setProperty(
        '--lr-graph-node-fill',
        alternate ? 'var(--lr-color-warning)' : 'var(--lr-color-brand)'
      );
      graph.style.setProperty(
        '--lr-graph-edge-color',
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
          label="Layered retrieval pipeline"
          renderer="canvas"
          layout="layered"
          selection-mode="multiple"
          with-edge-labels
          width="520"
          height="320"
          style="height:20rem"
          .nodes=${typedNodes}
          .edges=${typedLinks}
          .nodeTypes=${nodeTypes}
          .communities=${communities}
          .selectedNodeIds=${['rank']}
          @lr-selection-change=${applySelection}
          @lr-node-enter=${showHover}
          @lr-node-leave=${showHover}
          @lr-edge-enter=${showHover}
          @lr-edge-leave=${showHover}
        ></lr-graph>
      </div>
    `;
  },
};

export const ContainerFit: Story = {
  name: 'Fits its container (fit-to="container")',
  parameters: {
    docs: {
      description: {
        story:
          'With `fit-to="container"` the drawing space is the graph\'s own rendered content box ' +
          'rather than the numeric `width`/`height`, so the layout fills a responsive pane and ' +
          're-centres as that pane changes size. Drag the resizable wrapper to watch the drawing ' +
          'follow it; the settled node positions are kept across the resize.',
      },
    },
  },
  render: () => html`
    <div
      style="inline-size: 32rem; max-inline-size: 100%; block-size: 18rem; resize: both; overflow: hidden; border: var(--lr-border-width-thin) solid var(--lr-color-border);"
    >
      <lr-graph
        aria-label="Retrieval relationships filling their allocation"
        fit-to="container"
        seed="42"
        style="block-size: 100%"
        .nodes=${nodes}
        .edges=${links}
      ></lr-graph>
    </div>
  `,
};

export const CanvasKeyboardNavigation: Story = {
  parameters: { docs: { description: { story: 'The screen-reader data list shows 200 entries. Tab to the single virtual cursor, then use arrows, Home or End to reach any of the 300 nodes and 299 links.' } } },
  render: () => html`<lr-graph
    renderer="canvas" layout="layered" label="Document relationships"
    width="520" height="320" style="height:20rem"
    .nodes=${Array.from({ length: 300 }, (_, index) => ({ id: `n${index}`, label: `Document ${index + 1}` }))}
    .edges=${Array.from({ length: 299 }, (_, index) => ({ source: `n${index}`, target: `n${index + 1}` }))}
  ></lr-graph>`,
};

export const SpatialPerspective: Story = {
  parameters: { docs: { description: { story: 'True x/y/z positions with perspective, depth picking and an orbit camera. Drag to orbit; Shift-drag pans. Keyboard controls and the visible List view expose every item. No optional peer is needed.' } } },
  render: () => html`<lr-graph view="3d" label="Spatial relationships" height="520"
    .nodes=${[
      { id: 'core', label: 'Core', position: { x: 0, y: 0, z: 0 }, expandable: true },
      { id: 'near', label: 'Near', position: { x: 80, y: -30, z: 100 } },
      { id: 'far', label: 'Far', position: { x: -80, y: 30, z: -100 } },
      { id: 'above', label: 'Above', position: { x: 0, y: -120, z: -40 } },
    ]}
    .edges=${[
      { source: 'core', target: 'near', directed: true },
      { source: 'core', target: 'far', directed: true },
      { source: 'core', target: 'above', directed: true },
    ]}
  ></lr-graph>`,
};

export const SpatialNarrow: Story = {
  render: () => html`<div style="inline-size:20rem;max-inline-size:100%"><lr-graph
    view="3d" height="600" aria-label="Graph in a narrow panel"
    .nodes=${nodes.map((node, index) => ({ ...node, label: `Relationship with a long descriptive label ${index + 1}` }))}
    .edges=${links}
  ></lr-graph></div>`,
};

export const VisibleGraphList: Story = {
  render: () => html`<lr-graph view="list" label="All relationships"
    .nodes=${Array.from({ length: 205 }, (_, index) => ({ id: `n${index}`, label: `Document ${index + 1}` }))}
    .edges=${[{ source: 'n0', target: 'n204', label: 'References the final document' }]}
  ></lr-graph>`,
};

/** A host can page a complete catalog while supplying only the current diagram neighborhood. */
export const SourceNavigator: Story = {
  render: () => {
    const count = 10_000;
    const node = (index: number) => ({ id: String(index), label: `Entity ${index + 1}` });
    const row = (index: number) => ({ key: `node:${index}`, order: index, value: { kind: 'node' as const, value: node(index) } });
    const source: GraphSource = {
      revision: 1,
      records: {
        revision: 1,
        query: async ({ query, page, pageSize }) => {
          const search = query.search.trim().replace(/^entity\s+/i, '');
          const target = Number(search) - 1;
          const filtered = search.length > 0;
          const total = query.kind === 'edges' ? 0 : filtered ? Number.isInteger(target) && target >= 0 && target < count ? 1 : 0 : count;
          const start = page * pageSize;
          const rows = Array.from({ length: Math.max(0, Math.min(pageSize, total - start)) }, (_, offset) => row(filtered ? target : start + offset));
          return { rows, total, summary: { nodes: count, edges: 0 } };
        },
        lookup: async keys => keys.flatMap(key => {
          const index = Number(key.slice(5));
          return key === `node:${index}` && index >= 0 && index < count ? [row(index)] : [];
        }),
        locate: async key => {
          const index = Number(key.slice(5));
          return key === `node:${index}` && index >= 0 && index < count ? index : null;
        },
      },
      scene: async ({ centerKey }) => {
        const index = centerKey ? Number(centerKey.slice(5)) : 0;
        return { nodes: [{ key: `node:${index}`, value: node(index) }], edges: [], total: { nodes: count, edges: 0 }, coverage: 'neighborhood', worldBounds: null };
      },
    };
    return html`<lr-graph view="list" style="height: 30rem" .graphSource=${source}></lr-graph>`;
  },
};


/** The optional companion is downloaded only for this explicit 3D preference. */
export const WebglSpatial: Story = {
  render: () => html`<lr-graph view="3d" engine="webgl" style="height:30rem"
    .nodes=${[{ id: 'a', label: 'First', position: { x: -80, y: 0, z: 40 } }, { id: 'b', label: 'Second', position: { x: 80, y: 0, z: -40 } }]}
    .edges=${[{ id: 'a-b', source: 'a', target: 'b', directed: true, label: 'Connects' }]} with-edge-labels></lr-graph>`,
};

export const WebglTypedColumns: Story = {
  render: () => {
    const count = 12000;
    const ids = Array.from({ length: count }, (_, row) => `node-${row}`);
    const x = new Float32Array(count), y = new Float32Array(count), z = new Float32Array(count), category = new Uint16Array(count);
    for (let row = 0; row < count; row++) { const angle = row * 2.399963229728653; x[row] = Math.cos(angle) * Math.sqrt(row) * 3; y[row] = Math.sin(angle) * Math.sqrt(row) * 3; z[row] = row % 101 - 50; category[row] = row % 3; }
    const source = Uint32Array.from({ length: count - 1 }, (_, row) => row), target = Uint32Array.from(source, (row) => row + 1);
    return html`<lr-graph view="3d" engine="webgl" style="height:30rem" .graphColumns=${{ ids, x, y, z, source, target, category, categories: ['First', 'Second', 'Third'] }}></lr-graph>`;
  },
};
