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

export const Narrow320: Story = {
  name: 'Narrow (320px, long content and validation state)',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-schema-viewer
        selected-path="/properties/long_customer_support_configuration_identifier"
        .issues=${[
          {
            path: '/properties/long_customer_support_configuration_identifier',
            message: 'This configuration needs a value before the tool can run.',
            severity: 'error',
          },
        ]}
        .schema=${{
          type: 'object',
          title: 'Customer support escalation configuration',
          required: ['long_customer_support_configuration_identifier'],
          properties: {
            long_customer_support_configuration_identifier: {
              type: 'string',
              description: 'An intentionally long description that proves the node stays within its allocation.',
            },
          },
        }}
      ></lr-schema-viewer>
    </div>
  `,
};
