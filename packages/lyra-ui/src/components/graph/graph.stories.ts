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
