import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './button-group.js';
import '../../forms/button/button.js';

const meta: Meta = { title: 'Primitives/Button Group', component: 'lr-button-group' };
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-button-group label="Document actions">
    <lr-button variant="brand">Save</lr-button>
    <lr-button>Preview</lr-button>
    <lr-button>Share</lr-button>
  </lr-button-group>`,
};

export const Vertical: Story = {
  render: () => html`<lr-button-group orientation="vertical" label="Account actions">
    <lr-button>Profile</lr-button>
    <lr-button>Preferences</lr-button>
    <lr-button>Sign out</lr-button>
  </lr-button-group>`,
};

export const NarrowAllocation: Story = {
  name: 'Narrow allocation (320px)',
  parameters: {
    docs: {
      description: {
        story:
          "At an explicit 320px allocation, the group's own container query (not the viewport) drives the @container rule that stretches the button row to fill the width. :host is an inline-flex, shrink-to-fit box with container-type: inline-size always on, so -- unlike a block-level component -- a wrapping div's width alone would not reach it; the group needs its own explicit inline-size, or it settles at its non-collapse floor (--lr-icon-button-size) instead of the allocation.",
      },
    },
  },
  render: () => html`
    <div style="border:1px dashed var(--lr-color-border); padding:0.5rem; display:inline-block;">
      <lr-button-group label="Document actions" style="inline-size:320px">
        <lr-button variant="brand">Save</lr-button>
        <lr-button>Preview</lr-button>
        <lr-button>Share</lr-button>
      </lr-button-group>
    </div>
  `,
};
