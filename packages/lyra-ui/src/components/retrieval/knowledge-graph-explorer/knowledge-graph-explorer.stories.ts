import { html } from "lit";
import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "./knowledge-graph-explorer.js";
import type { LyraGraphLink, LyraGraphNode } from "../graph/graph.class.js";
import type { LyraNodeTypeStyle } from "../../../internal/node-type-style.js";

const meta: Meta = {
  title: "Knowledge Graph Explorer",
  component: "lr-knowledge-graph-explorer",
};
export default meta;
type Story = StoryObj;

const nodeTypes: LyraNodeTypeStyle[] = [
  { id: "person", label: "Person" },
  { id: "org", label: "Organization" },
  { id: "element", label: "Chemical element" },
];

const nodes: LyraGraphNode[] = [
  { id: "marie", label: "Marie Curie", type: "person" },
  { id: "pierre", label: "Pierre Curie", type: "person" },
  { id: "sorbonne", label: "Sorbonne", type: "org" },
  { id: "polonium", label: "Polonium", type: "element" },
  { id: "radium", label: "Radium", type: "element" },
];

const links: LyraGraphLink[] = [
  { source: "marie", target: "pierre", label: "married_to" },
  { source: "marie", target: "sorbonne", label: "worked_at" },
  { source: "marie", target: "polonium", label: "discovered" },
  { source: "marie", target: "radium", label: "discovered" },
  { source: "pierre", target: "radium", label: "discovered" },
];

export const Default: Story = {
  render: () => html`
    <lr-knowledge-graph-explorer
      .nodes=${nodes}
      .links=${links}
      .nodeTypes=${nodeTypes}
      .entityDetails=${{
        marie: {
          description: "Physicist and chemist.",
          properties: { born: 1867 },
        },
      }}
      style="height: 32rem;"
    ></lr-knowledge-graph-explorer>
  `,
};

/** Every user-driven selection and clear reports the explorer's new selected node id. */
export const SelectionChanges: Story = {
  render: () => {
    const handleSelectionChange = (
      event: CustomEvent<{ selectedNodeId: string | null }>
    ) => {
      const explorer = event.currentTarget as HTMLElement;
      const output = explorer.nextElementSibling?.querySelector("output");
      if (output) output.textContent = event.detail.selectedNodeId ?? "None";
    };
    return html`
      <lr-knowledge-graph-explorer
        .nodes=${nodes}
        .links=${links}
        .nodeTypes=${nodeTypes}
        style="height: 32rem;"
        @lr-selection-change=${handleSelectionChange}
      ></lr-knowledge-graph-explorer>
      <p>Selected node: <output>None</output></p>
    `;
  },
};

export const WithPinsAndPath: Story = {
  render: () => html`
    <lr-knowledge-graph-explorer
      .nodes=${nodes}
      .links=${links}
      .nodeTypes=${nodeTypes}
      .pinnedNodeIds=${["marie", "radium"]}
      .path=${[
        { kind: "node", node: { id: "marie", label: "Marie Curie" } },
        { kind: "edge", relation: "discovered", directed: true },
        { kind: "node", node: { id: "radium", label: "Radium" } },
      ]}
      style="height: 32rem;"
    ></lr-knowledge-graph-explorer>
  `,
};

export const CanvasRenderer: Story = {
  render: () => html`
    <lr-knowledge-graph-explorer
      .nodes=${nodes}
      .links=${links}
      .nodeTypes=${nodeTypes}
      renderer="canvas"
      style="height: 32rem;"
    ></lr-knowledge-graph-explorer>
  `,
};

export const Empty: Story = {
  render: () =>
    html`<lr-knowledge-graph-explorer
      style="height: 24rem;"
    ></lr-knowledge-graph-explorer>`,
};

/**
 * `search-query` is presettable, so a host can deep-link straight into a filtered view (restoring a
 * query from a URL, say). `lr-search-change` reports every later edit the user makes in the toolbar
 * search box, so the same host can write it back out.
 */
export const PresetSearchQuery: Story = {
  render: () => {
    const handleSearchChange = (
      event: CustomEvent<{ searchQuery: string }>
    ) => {
      const explorer = event.currentTarget as HTMLElement;
      const output = explorer.nextElementSibling?.querySelector("output");
      if (output) output.textContent = event.detail.searchQuery || "(empty)";
    };
    return html`
      <lr-knowledge-graph-explorer
        search-query="curie"
        .nodes=${nodes}
        .links=${links}
        .nodeTypes=${nodeTypes}
        style="height: 32rem;"
        @lr-search-change=${handleSearchChange}
      ></lr-knowledge-graph-explorer>
      <p>Search query: <output>curie</output></p>
    `;
  },
};

export const Narrow: Story = {
  render: () => html`
    <div style="max-width: 320px;">
      <lr-knowledge-graph-explorer
        .nodes=${nodes}
        .links=${links}
        .nodeTypes=${nodeTypes}
        style="height: 28rem;"
      ></lr-knowledge-graph-explorer>
    </div>
  `,
};

export const HoverHighlight: Story = {
  render: () => html`
    <lr-knowledge-graph-explorer
      .nodes=${nodes}
      .links=${links}
      .nodeTypes=${nodeTypes}
      highlight="hover"
      style="height: 32rem;"
    ></lr-knowledge-graph-explorer>
  `,
  parameters: {
    docs: {
      description: {
        story:
          '`highlight="hover"` dims both unrelated nodes and unrelated edges by whichever node is currently pointer-hovered, on top of the always-active search-match dimming -- falls back to the selected node\'s neighborhood while nothing is hovered.',
      },
    },
  },
};
