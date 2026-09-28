import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './connector-manager.js';
import type { AgentConnector } from './connector-manager.class.js';

const meta: Meta = {
  title: 'AgentTools/ConnectorManager',
  component: 'lr-connector-manager',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A controlled connector list that emits connect, disconnect, and retry requests. The host owns connector execution, credentials, and network access.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const connectors: AgentConnector[] = [
  {
    id: 'project-files',
    name: 'Project files',
    description: 'Read files from the selected project.',
    kind: 'mcp',
    status: 'connected',
  },
  {
    id: 'calendar',
    name: 'Calendar',
    description: 'Access the team calendar after host authorization.',
    kind: 'connector',
    status: 'disconnected',
  },
  {
    id: 'issue-tracker',
    name: 'Issue tracker',
    kind: 'mcp',
    status: 'error',
    error: 'The host needs to renew its authorization.',
  },
  { id: 'mail', name: 'Mail', kind: 'connector', status: 'connecting' },
];

export const MixedStates: Story = {
  render: () => html`<lr-connector-manager style="max-inline-size: 42rem" .connectors=${connectors}></lr-connector-manager>`,
};

export const Disabled: Story = {
  render: () => html`<lr-connector-manager style="max-inline-size: 42rem" disabled .connectors=${connectors}></lr-connector-manager>`,
};

export const Empty: Story = {
  render: () => html`<lr-connector-manager label="Workspace integrations"></lr-connector-manager>`,
};
