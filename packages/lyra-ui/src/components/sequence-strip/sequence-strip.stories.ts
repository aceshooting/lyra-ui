import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './sequence-strip.js';
import type { SequenceStripCategory, SequenceStripItem } from './sequence-strip.class.js';
import { storyColor } from '../../../../../.storybook/story-theme.js';

const meta: Meta = {
  title: 'Sequence Strip',
  component: 'lyra-sequence-strip',
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
  render: () => html`<lyra-sequence-strip .items=${items} .categories=${categories}></lyra-sequence-strip>`,
};

export const Empty: Story = {
  render: () => html`<lyra-sequence-strip></lyra-sequence-strip>`,
};

export const CustomAccessibleLabel: Story = {
  render: () =>
    html`<lyra-sequence-strip
      .items=${items}
      .categories=${categories}
      accessible-label="Conversation turn history: 2 text, 2 tool, 1 mixed"
    ></lyra-sequence-strip>`,
};
