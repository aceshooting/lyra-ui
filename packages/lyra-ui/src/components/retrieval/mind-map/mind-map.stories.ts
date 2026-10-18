import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './mind-map.js';
import type { LyraTopic, MindMapSource } from './mind-map.class.js';

const meta: Meta = {
  title: 'Mind Map',
  component: 'lr-mind-map',
};
export default meta;
type Story = StoryObj;

const topics: LyraTopic[] = [
  {
    id: 'root',
    label: 'Knowledge Graph RAG',
    children: [
      { id: 'kg', label: 'Knowledge graphs', children: [{ id: 'entities', label: 'Entities' }, { id: 'communities', label: 'Communities' }] },
      { id: 'rag', label: 'Retrieval', children: [{ id: 'chunking', label: 'Chunking' }, { id: 'ranking', label: 'Ranking' }] },
      { id: 'viz', label: 'Visualization' },
    ],
  },
];

export const Default: Story = {
  render: () => html`<div style="height: 480px;"><lr-mind-map .topics=${topics}></lr-mind-map></div>`,
};

export const MultiRoot: Story = {
  render: () => html`<div style="height: 480px;">
    <lr-mind-map label="Session topics" .topics=${[{ id: 'a', label: 'Chunking strategies' }, { id: 'b', label: 'Graph layouts' }]}></lr-mind-map>
  </div>`,
};

export const DeeplyExpanded: Story = {
  render: () => html`<div style="height: 480px;"><lr-mind-map .topics=${topics} expand-depth="3"></lr-mind-map></div>`,
};

export const Empty: Story = {
  render: () => html`<lr-mind-map></lr-mind-map>`,
};

export const Narrow: Story = {
  render: () => html`<div style="max-width: 320px; height: 400px;"><lr-mind-map .topics=${topics}></lr-mind-map></div>`,
};

/** Above the 500-node render cap, the visible node count stays bounded via a deterministic,
 * connectivity-preserving, subtree-size-weighted sample of the currently-expanded topics, with a
 * localized "showing N of M" notice via `[part="limit"]`. */
export const AboveRenderCap: Story = {
  name: 'Above render cap (800 topics)',
  render: () => html`<div style="height: 480px;">
    <lr-mind-map
      .topics=${[
        {
          id: 'root',
          label: 'Large corpus outline',
          children: Array.from({ length: 800 }, (_unused, index) => ({
            id: `topic-${index}`,
            label: `Topic ${index}`,
          })),
        },
      ]}
    ></lr-mind-map>
  </div>`,
};

/** Input loss stays visible even when the retained hierarchy is collapsed. */
export const InputLimit: Story = {
  render: () => {
    let root: LyraTopic = { id: 'leaf', label: 'Leaf' };
    for (let level = 80; level >= 0; level--)
      root = { id: `level-${level}`, label: `Level ${level}`, children: [root] };
    return html`<lr-mind-map .topics=${[root]} expand-depth="0"></lr-mind-map>`;
  },
};

/** The navigator reaches the complete preorder; the diagram uses its current bounded subtree. */
export const SourceNavigation: Story = {
  render: () => {
    const count = 1_000_000;
    let state = 0;
    let expanded = true;
    let selected = '';
    const source: MindMapSource = { revision: 1, project: async request => {
      if (request.action.type === 'toggle') expanded = request.action.expanded;
      if (request.action.type === 'select') selected = request.action.key;
      if (request.action.type === 'reveal') expanded = true;
      return { state: String(++state), total: count, rows: {
        count: expanded ? count : 1, keyAt: index => `topic-${index}`,
        indexOfKey: (key: string | number) => Number(String(key).slice(6)),
        itemAt: index => ({ key: `topic-${index}`, value: { id: `topic-${index}`, label: index ? `Topic ${index}` : 'All topics' },
          parentKey: index ? 'topic-0' : null, level: index ? 2 : 1, position: index || 1, setSize: index ? count - 1 : 1,
          childCount: index ? 0 : count - 1, expanded: index ? false : expanded, selected: selected === `topic-${index}` }),
      }, ...(request.action.type === 'reveal' ? { focusIndex: Number(request.action.key.slice(6)) } : {}) };
    } };
    return html`<lr-mind-map .treeSource=${source}></lr-mind-map>`;
  },
};
