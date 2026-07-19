import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './sequence-strip.js';
import type { SequenceStripCategory, SequenceStripItem } from './sequence-strip.class.js';
import { storyColor } from '../../../../../../.storybook/story-theme.js';

const meta: Meta = {
  title: 'Sequence Strip',
  component: 'lr-sequence-strip',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

const categories: SequenceStripCategory[] = [
  { key: 'text', color: storyColor('chart1'), label: 'Text' },
  { key: 'tool', color: storyColor('chart2'), label: 'Tool' },
  { key: 'mixed', color: storyColor('chart3'), label: 'Mixed' },
];

const items: SequenceStripItem[] = [
  { id: '1', category: 'text', label: 'Turn 1: plain response' },
  { id: '2', category: 'tool', marker: true, label: 'Turn 2: tool call (subagent)' },
  { id: '3', category: 'tool', label: 'Turn 3: tool call' },
  { id: '4', category: 'mixed', label: 'Turn 4: mixed' },
  { id: '5', category: 'text', label: 'Turn 5: plain response' },
];

export const Default: Story = {
  render: () => html`<lr-sequence-strip .items=${items} .categories=${categories}></lr-sequence-strip>`,
};

export const Empty: Story = {
  render: () => html`<lr-sequence-strip></lr-sequence-strip>`,
};

/** A per-turn conversation timeline with a persistent key of the category colors, so the mapping
 *  stays readable without hovering each cell. The legend is static: it lists every entry of
 *  `categories` (whether or not any item uses it) and toggles nothing. */
export const WithLegend: Story = {
  render: () => html`<lr-sequence-strip show-legend .items=${items} .categories=${categories}></lr-sequence-strip>`,
};

/** The same legend in a 320px allocation with long, translation-length labels — it wraps onto
 *  further rows instead of overflowing the strip's own width. */
export const LegendNarrowAllocation: Story = {
  render: () => html`
    <div style="inline-size: 320px">
      <lr-sequence-strip
        show-legend
        .items=${items}
        .categories=${[
          ...categories,
          { key: 'sub', color: storyColor('chart4'), label: 'Dispatched to a subagent' },
          { key: 'err', color: storyColor('danger'), label: 'Errored tool invocation' },
        ] as SequenceStripCategory[]}
      ></lr-sequence-strip>
    </div>
  `,
};

export const CustomAccessibleLabel: Story = {
  render: () =>
    html`<lr-sequence-strip
      .items=${items}
      .categories=${categories}
      accessible-label="Conversation turn history: 2 text, 2 tool, 1 mixed"
    ></lr-sequence-strip>`,
};
