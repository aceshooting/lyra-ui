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
