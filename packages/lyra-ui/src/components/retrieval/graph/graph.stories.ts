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
    color: 'var(--lr-color-brand)',
  },
  {
    id: 'opinion',
    label: 'Opinion',
    accessibleLabel: 'Advocate General opinion, cited by the judgment',
    description: 'A related legal opinion.',
    color: 'var(--lr-color-success)',
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
            label: 'unbroken-source-identifier-that-must-not-expand-the-allocation',
            description: 'A deliberately long source description used to exercise tooltip wrapping.',
          },
          {
            id: 'target',
            label: 'A target node with a long human-readable label',
            description: 'A second deliberately long description for narrow tooltip containment.',
          },
        ] satisfies GraphNode[]}
        .links=${[
          {
            source: 'unbroken-source-identifier-that-must-not-expand-the-allocation',
            target: 'target',
            label: 'a-very-long-relationship-label-without-natural-breaks',
            directed: true,
          },
        ] satisfies GraphLink[]}
      ></lr-graph>
    </div>
  `,
};

export const DimmedNeighborhood: Story = {
  name: 'Dimmed non-neighbors (controlled)',
  parameters: {
    docs: {
      description: {
        story:
          'dimmedNodeIds/dimmedLinkIds are controlled -- the host computes the complement of a ' +
          'hovered node\'s neighbor set (e.g. from lr-node-enter) and assigns it back. This story ' +
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
    const report = (event: CustomEvent<{ id: string; x: number; y: number }>) => {
      const output = (event.currentTarget as HTMLElement).parentElement?.querySelector('output');
      if (output) output.textContent = `${event.detail.id}: (${event.detail.x.toFixed(1)}, ${event.detail.y.toFixed(1)})`;
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
  render: () => html`
    <lr-graph
      width="480"
      height="320"
      style="height: 20rem"
      min-zoom="1"
      max-zoom="2"
      .nodes=${nodes}
      .links=${links}
    ></lr-graph>
  `,
};

export const SeededLayout: Story = {
  render: () => html`
    <p>
      Both graphs below share <code>seed="42"</code> — reload the page or diff a screenshot across builds and their
      node positions are bit-identical, unlike the non-seeded <code>Default</code> story above.
    </p>
    <div style="display: flex; gap: 1rem; flex-wrap: wrap">
      <lr-graph width="320" height="240" style="height: 15rem" seed="42" .nodes=${nodes} .links=${links}></lr-graph>
      <lr-graph width="320" height="240" style="height: 15rem" seed="42" .nodes=${nodes} .links=${links}></lr-graph>
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
        <output aria-live="polite">Activate a link to inspect its stable id.</output>
      </div>
    `;
  },
};
