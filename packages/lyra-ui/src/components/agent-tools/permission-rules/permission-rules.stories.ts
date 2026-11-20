import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../../lr-permission-rules.js';
import type { PermissionRule } from './permission-rules.class.js';

const meta: Meta = {
  title: 'AgentTools/PermissionRules',
  component: 'lr-permission-rules',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A controlled presentation of host-defined permission rules. Decision changes are requests only; the host evaluates and applies policy.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const rules: PermissionRule[] = [
  {
    id: 'read-project',
    label: 'Read project files',
    description: 'Inspect files in the selected project.',
    scope: 'filesystem:project/read',
    decision: 'ask',
  },
  {
    id: 'write-project',
    label: 'Write project files',
    description: 'Create or update files in the selected project.',
    scope: 'filesystem:project/write',
    decision: 'deny',
  },
];

export const Controlled: Story = {
  render: () => html`<lr-permission-rules style="max-inline-size: 42rem" .rules=${rules}></lr-permission-rules>`,
};

export const Readonly: Story = {
  render: () => html`<lr-permission-rules style="max-inline-size: 42rem" readonly .rules=${rules}></lr-permission-rules>`,
};

export const Empty: Story = {
  render: () => html`<lr-permission-rules label="Workspace rules"></lr-permission-rules>`,
};

export const ControlledDecision: Story = {
  render: () => html`<lr-permission-rules .rules=${rules}
    @lr-permission-rule-change-request=${(event: Event) => event.preventDefault()}></lr-permission-rules>`,
};

export const PlainFrame: Story = {
  render: () => html`<div style="max-inline-size: 42rem; border: var(--lr-border-width-thin) solid var(--lr-color-border); border-radius: var(--lr-radius); padding: var(--lr-space-m)">
    <lr-permission-rules frame="plain" .rules=${rules}></lr-permission-rules>
  </div>`,
};

export const Narrow320: Story = {
  name: 'Narrow (320px, long content)',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-permission-rules
        .rules=${[
          ...rules,
          {
            id: 'network-production',
            label: 'Call production deployment and monitoring services',
            description: 'Send authenticated requests to the deployment pipeline and the monitoring dashboards of the production environment.',
            scope: 'network:https://deployments.example.com/production-environment/pipelines',
            decision: 'allow',
          },
        ]}
      ></lr-permission-rules>
    </div>
  `,
};
