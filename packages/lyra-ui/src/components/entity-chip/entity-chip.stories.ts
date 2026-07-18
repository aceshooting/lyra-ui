import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './entity-chip.js';
import '../entity-card/entity-card.js';

const meta: Meta = {
  title: 'Entity Chip',
  component: 'lyra-entity-chip',
};
export default meta;
type Story = StoryObj;

export const InProse: Story = {
  render: () => html`
    <p>
      In 1903, mentions of
      <lyra-entity-chip entity-id="e17" label="Marie Curie" type="person" type-label="Person"
        >Physicist and chemist, 1867-1934.</lyra-entity-chip
      >
      appear alongside the discovery of polonium.
    </p>
  `,
};

export const NoPreview: Story = {
  render: () => html`<p>Founded by <lyra-entity-chip entity-id="e2" label="Acme Corp" type="org"></lyra-entity-chip>.</p>`,
};

export const Narrow: Story = {
  render: () => html`<div style="max-width: 320px;">
    <p>A long paragraph wraps <lyra-entity-chip entity-id="e17" label="Marie Curie" type="person"></lyra-entity-chip> normally in flow text at narrow widths, same as any inline element.</p>
  </div>`,
};
