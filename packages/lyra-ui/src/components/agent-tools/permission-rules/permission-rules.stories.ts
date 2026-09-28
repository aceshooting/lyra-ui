import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './permission-rules.js';
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
