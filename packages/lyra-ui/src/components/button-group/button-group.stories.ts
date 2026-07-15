import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './button-group.js';
import '../button/button.js';

const meta: Meta = { title: 'Primitives/Button Group', component: 'lyra-button-group' };
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lyra-button-group label="Document actions">
    <lyra-button variant="brand">Save</lyra-button>
    <lyra-button>Preview</lyra-button>
    <lyra-button>Share</lyra-button>
  </lyra-button-group>`,
};

export const Vertical: Story = {
  render: () => html`<lyra-button-group orientation="vertical" label="Account actions">
    <lyra-button>Profile</lyra-button>
    <lyra-button>Preferences</lyra-button>
    <lyra-button>Sign out</lyra-button>
  </lyra-button-group>`,
};
