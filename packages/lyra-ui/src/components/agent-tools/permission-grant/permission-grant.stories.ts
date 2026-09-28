import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './permission-grant.js';

const meta: Meta = {
  title: 'AgentTools/PermissionGrant',
  component: 'lr-permission-grant',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A provider-neutral permission request with explicit decision events. The host validates the displayed scope, authorizes the request, and persists decisions.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const request = {
  requestId: 'permission-42',
  label: 'Read project files',
  description: 'The assistant requests read access to inspect the selected project.',
  scope: 'filesystem:project/read',
};

export const Pending: Story = {
  render: () => html`
    <lr-permission-grant
      style="max-inline-size: 36rem"
      .requestId=${request.requestId}
      .label=${request.label}
      .description=${request.description}
      .scope=${request.scope}
      status="pending"
    ></lr-permission-grant>
  `,
};

export const Granted: Story = {
  render: () => html`
    <lr-permission-grant
      style="max-inline-size: 36rem"
      .requestId=${request.requestId}
      .label=${request.label}
      .description=${request.description}
      .scope=${request.scope}
      status="granted"
    ></lr-permission-grant>
  `,
};

export const Disabled: Story = {
  render: () => html`
    <lr-permission-grant
      style="max-inline-size: 36rem"
      disabled
      .requestId=${request.requestId}
      .label=${request.label}
      .description=${request.description}
      .scope=${request.scope}
      status="pending"
    ></lr-permission-grant>
  `,
};
