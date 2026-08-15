import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './entity-chip.js';
import '../entity-card/entity-card.js';

const meta: Meta = {
  title: 'Entity Chip',
  component: 'lr-entity-chip',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'An inline entity mention whose button always receives a localized text/type name. An authored host aria-label intentionally names only the custom-element boundary and is not copied onto the shadow button.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const InProse: Story = {
  render: () => html`
    <p>
      In 1903, mentions of
      <lr-entity-chip
        entity-id="e17"
        text="Marie Curie"
        type="person"
        type-label="Person"
        >Physicist and chemist, 1867-1934.</lr-entity-chip
      >
      appear alongside the discovery of polonium.
    </p>
  `,
};

export const NoPreview: Story = {
  render: () =>
    html`<p>
      Founded by
      <lr-entity-chip
        entity-id="e2"
        text="Acme Corp"
        type="org"
      ></lr-entity-chip
      >.
    </p>`,
};

export const Narrow: Story = {
  render: () => html`<div style="max-width: 320px;">
    <p>
      A long paragraph wraps
      <lr-entity-chip
        entity-id="e17"
        text="Marie Curie"
        type="person"
      ></lr-entity-chip>
      normally in flow text at narrow widths, same as any inline element.
    </p>
  </div>`,
};
