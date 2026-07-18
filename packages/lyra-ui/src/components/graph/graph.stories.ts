import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { GraphNode, GraphLink } from './graph.js';

const nodes: GraphNode[] = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
  { id: 'c', label: 'C' },
  { id: 'd', label: 'D' },
];

const links: GraphLink[] = [
  { source: 'a', target: 'b' },
  { source: 'a', target: 'c' },
  { source: 'b', target: 'd' },
  { source: 'c', target: 'd' },
];

const relationshipNodes: GraphNode[] = [
  {
    id: 'judgment',
    label: 'Judgment',
    accessibleLabel: 'Judgment, the source document',
    description: 'The decision whose citations are shown.',
    color: 'var(--lyra-color-brand)',
  },
  {
    id: 'opinion',
    label: 'Opinion',
    accessibleLabel: 'Advocate General opinion, cited by the judgment',
    description: 'A related legal opinion.',
    color: 'var(--lyra-color-success)',
  },
  { id: 'regulation', label: 'Regulation', description: 'The governing regulation.' },
];

const relationshipLinks: GraphLink[] = [
  {
    id: 'judgment-cites-opinion',
    source: 'judgment',
    target: 'opinion',
    label: 'cites',
    accessibleLabel: 'Judgment cites the Advocate General opinion',
    description: 'A directed citation relationship.',
    directed: true,
    color: 'var(--lyra-color-brand)',
    width: 2.5,
  },
  {
    id: 'judgment-applies-regulation',
    source: 'judgment',
    target: 'regulation',
    label: 'applies',
    description: 'A dashed directed relationship.',
    directed: true,
    color: 'var(--lyra-color-success)',
    dash: [7, 4],
    width: 2,
  },
];

const meta: Meta = {
  title: 'Graph',
  component: 'lyra-graph',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-graph
      width="480"
      height="320"
      style="height: 20rem"
      .nodes=${nodes}
      .links=${links}
    ></lyra-graph>
  `,
};

export const DimmedNeighborhood: Story = {
  name: 'Dimmed non-neighbors (controlled)',
  parameters: {
    docs: {
      description: {
        story:
          'dimmedNodeIds/dimmedLinkIds are controlled -- the host computes the complement of a ' +
          'hovered node\'s neighbor set (e.g. from lyra-node-enter) and assigns it back. This story ' +
          'holds a static example: node "a" and its incident links stay at full opacity; everything ' +
          'else is dimmed via --lyra-graph-dimmed-opacity.',
      },
    },
  },
  render: () => html`
    <lyra-graph
      .nodes=${nodes}
      .links=${links}
      .dimmedNodeIds=${['c', 'd']}
      .dimmedLinkIds=${['b->d', 'c->d']}
      style="--lyra-graph-dimmed-opacity: 0.15; width: 100%; height: 400px;"
    ></lyra-graph>
  `,
};

export const ClickPosition: Story = {
  render: () => {
    const report = (event: CustomEvent<{ id: string; x: number; y: number }>) => {
      const output = (event.currentTarget as HTMLElement).parentElement?.querySelector('output');
      if (output) output.textContent = `${event.detail.id}: (${event.detail.x.toFixed(1)}, ${event.detail.y.toFixed(1)})`;
    };
    return html`
      <div>
        <lyra-graph
          width="480"
          height="320"
          style="height: 20rem"
          seed="42"
          .nodes=${nodes}
          .links=${links}
          @lyra-node-click=${report}
        ></lyra-graph>
        <output>Click a node to inspect its local position.</output>
      </div>
    `;
  },
};

export const TunedForces: Story = {
  render: () => html`
    <lyra-graph
      width="480"
      height="320"
      style="height: 20rem"
      charge-strength="-900"
      link-distance="200"
      .nodes=${nodes}
      .links=${links}
    ></lyra-graph>
  `,
};

export const BoundedZoom: Story = {
  render: () => html`
    <lyra-graph
      width="480"
      height="320"
      style="height: 20rem"
      min-zoom="1"
      max-zoom="2"
      .nodes=${nodes}
      .links=${links}
    ></lyra-graph>
  `,
};

export const SeededLayout: Story = {
  render: () => html`
    <p>
      Both graphs below share <code>seed="42"</code> — reload the page or diff a screenshot across builds and their
      node positions are bit-identical, unlike the non-seeded <code>Default</code> story above.
    </p>
    <div style="display: flex; gap: 1rem; flex-wrap: wrap">
      <lyra-graph width="320" height="240" style="height: 15rem" seed="42" .nodes=${nodes} .links=${links}></lyra-graph>
      <lyra-graph width="320" height="240" style="height: 15rem" seed="42" .nodes=${nodes} .links=${links}></lyra-graph>
    </div>
  `,
};

export const DirectedRelationships: Story = {
  render: () => {
    const reportLink = (event: CustomEvent<{ source: string; target: string; id?: string }>) => {
      const output = (event.currentTarget as HTMLElement).parentElement?.querySelector('output');
      if (output) {
        output.textContent = `Activated ${event.detail.id ?? 'unidentified link'}: ${event.detail.source} → ${event.detail.target}`;
      }
    };

    return html`
      <div>
        <lyra-graph
          aria-label="Legal citation relationships"
          width="520"
          height="320"
          seed="42"
          style="height: 20rem"
          .nodes=${relationshipNodes}
          .links=${relationshipLinks}
          @lyra-link-click=${reportLink}
        ></lyra-graph>
        <output aria-live="polite">Activate a link to inspect its stable id.</output>
      </div>
    `;
  },
};
