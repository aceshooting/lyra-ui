import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './graph-legend.js';
import type { LyraNodeTypeStyle } from '../../../internal/node-type-style.js';
import { storyColor } from '../../../../../../.storybook/theme-contract.js';

const meta: Meta = {
  title: 'Graph Legend',
  component: 'lr-graph-legend',
};
export default meta;
type Story = StoryObj;

const types = (): LyraNodeTypeStyle[] => [
  { id: 'person', label: 'Person' },
  {
    id: 'org',
    label: 'Organization',
    color: storyColor('chart1'),
    shape: 'square',
  },
  { id: 'place', label: 'Place', shape: 'diamond' },
];

export const Default: Story = {
  render: () => {
    const reportVisibility = (
      event: CustomEvent<{ hiddenTypes: string[] }>
    ) => {
      const feedback = (
        event.currentTarget as HTMLElement
      ).parentElement?.querySelector('[data-visibility-feedback]');
      if (!feedback) return;
      feedback.textContent = event.detail.hiddenTypes.length
        ? `Hidden types: ${event.detail.hiddenTypes.join(', ')}`
        : 'All types are visible.';
    };
    return html`
      <div>
        <lr-graph-legend
          .types=${types()}
          .counts=${{ person: 12, org: 4, place: 7 }}
          @lr-visibility-change=${reportVisibility}
        ></lr-graph-legend>
        <!-- The component already announces each toggle through its shared live-region sink. This
             separate text is visible state feedback, deliberately not a second live region. -->
        <p data-visibility-feedback>All types are visible.</p>
      </div>
    `;
  },
};

export const WithHiddenType: Story = {
  render: () =>
    html`<lr-graph-legend
      style="--lr-graph-legend-hidden-swatch-opacity: 0.22"
      .types=${types()}
      .hiddenTypes=${['org']}
    ></lr-graph-legend>`,
};

export const ReadOnly: Story = {
  render: () =>
    html`<lr-graph-legend
      .types=${types()}
      .counts=${{ person: 12 }}
      .interactive=${false}
    ></lr-graph-legend>`,
};

export const Narrow: Story = {
  render: () => html`<div
    style="max-width: 320px; border: 1px dashed var(--lr-color-border); padding: 8px;"
  >
    <lr-graph-legend
      .types=${[
        ...types(),
        { id: 'long', label: `entity-${'classification'.repeat(16)}` },
      ]}
      .counts=${{ person: 12, org: 4, place: 7 }}
    ></lr-graph-legend>
  </div>`,
};
