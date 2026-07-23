import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './schema-viewer.js';

const meta: Meta = { title: 'Agent Tools/Schema Viewer', component: 'lr-schema-viewer' };
export default meta;
type Story = StoryObj;

export const ToolSchema: Story = {
  render: () => html`<lr-schema-viewer
    .schema=${{
      type: 'object',
      title: 'search',
      required: ['query'],
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'integer', minimum: 1, maximum: 50 },
      },
    }}
  ></lr-schema-viewer>`,
};

