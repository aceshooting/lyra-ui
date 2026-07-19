import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './graph-legend.js';
import type { LyraGraphLegendType } from './graph-legend.class.js';
import { storyColor } from '../../../../../../.storybook/story-theme.js';

const meta: Meta = {
  title: 'Graph Legend',
  component: 'lr-graph-legend',
};
export default meta;
type Story = StoryObj;

const types: LyraGraphLegendType[] = [
  { id: 'person', label: 'Person' },
  { id: 'org', label: 'Organization', color: storyColor('chart1'), shape: 'square' },
  { id: 'place', label: 'Place', shape: 'diamond' },
];

export const Default: Story = {
  render: () => html`
    <lr-graph-legend
      .types=${types}
      .counts=${{ person: 12, org: 4, place: 7 }}
      @lr-visibility-change=${(e: CustomEvent<{ hiddenTypes: string[] }>) => console.log(e.detail)}
    ></lr-graph-legend>
  `,
};

export const WithHiddenType: Story = {
  render: () => html`<lr-graph-legend .types=${types} .hiddenTypes=${['org']}></lr-graph-legend>`,
};

export const ReadOnly: Story = {
  render: () => html`<lr-graph-legend .types=${types} .counts=${{ person: 12 }} ?interactive=${false}></lr-graph-legend>`,
};

export const Narrow: Story = {
  render: () => html`<div style="max-width: 320px; border: 1px dashed var(--lr-color-border); padding: 8px;">
    <lr-graph-legend .types=${types} .counts=${{ person: 12, org: 4, place: 7 }}></lr-graph-legend>
  </div>`,
};
