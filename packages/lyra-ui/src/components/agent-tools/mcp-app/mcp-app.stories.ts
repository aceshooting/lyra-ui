import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './mcp-app.js';

const meta: Meta = { title: 'Agent Tools/MCP App', component: 'lr-mcp-app' };
export default meta;
type Story = StoryObj;

export const SandboxedResource: Story = {
  render: () => html`<lr-mcp-app
    .resource=${{
      uri: 'ui://demo/weather',
      title: 'Weather tool',
      html: '<!doctype html><html><body><p>Sandboxed MCP App resource</p></body></html>',
    }}
  ></lr-mcp-app>`,
};

