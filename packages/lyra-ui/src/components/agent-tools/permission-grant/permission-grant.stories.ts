import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../../lr-permission-grant.js';

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
      status="approved"
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

export const PlainFrame: Story = {
  render: () => html`<div style="max-inline-size: 36rem; border: var(--lr-border-width-thin) solid var(--lr-color-border); border-radius: var(--lr-radius); padding: var(--lr-space-m)">
    <lr-permission-grant
      frame="plain"
      .requestId=${request.requestId}
      .label=${request.label}
      .description=${request.description}
      .scope=${request.scope}
      status="pending"
    ></lr-permission-grant>
  </div>`,
};

export const Narrow320: Story = {
  name: 'Narrow (320px, long content)',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-permission-grant
        .requestId=${request.requestId}
        .label=${'Read and summarize every file in the selected production project'}
        .description=${'The assistant requests read access to inspect the selected project, including generated build output and its long nested configuration directories.'}
        .scope=${'filesystem:workspace/production-project/configuration/deeply-nested-directory/read'}
        status="pending"
      ></lr-permission-grant>
    </div>
  `,
};
