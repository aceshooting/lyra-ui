import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './graph-legend.js';
import type { LyraGraphLegendType } from './graph-legend.class.js';
import { storyColor } from '../../../../../.storybook/story-theme.js';

const meta: Meta = {
  title: 'Graph Legend',
  component: 'lyra-graph-legend',
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
    <lyra-graph-legend
      .types=${types}
      .counts=${{ person: 12, org: 4, place: 7 }}
      @lyra-visibility-change=${(e: CustomEvent<{ hiddenTypes: string[] }>) => console.log(e.detail)}
    ></lyra-graph-legend>
  `,
};

export const WithHiddenType: Story = {
  render: () => html`<lyra-graph-legend .types=${types} .hiddenTypes=${['org']}></lyra-graph-legend>`,
};

export const ReadOnly: Story = {
  render: () => html`<lyra-graph-legend .types=${types} .counts=${{ person: 12 }} ?interactive=${false}></lyra-graph-legend>`,
};

export const Narrow: Story = {
  render: () => html`<div style="max-width: 320px; border: 1px dashed var(--lyra-color-border); padding: 8px;">
    <lyra-graph-legend .types=${types} .counts=${{ person: 12, org: 4, place: 7 }}></lyra-graph-legend>
  </div>`,
};
