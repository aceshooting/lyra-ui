import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './mcp-app.js';

const meta: Meta = {
  title: 'MCP App',
  component: 'lr-mcp-app',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-mcp-app
      style="display: block; max-width: 48rem;"
      .resource=${{
        uri: 'ui://weather/current',
        title: 'Weather dashboard',
        html: `<!doctype html>
          <html>
            <body>
              <main>
                <h1>Luxembourg</h1>
                <p>21 °C · Partly cloudy</p>
                <button type="button">Refresh forecast</button>
              </main>
            </body>
          </html>`,
      }}
    ></lr-mcp-app>
  `,
};

export const Narrow320: Story = {
  name: 'Narrow (320px, long content)',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-mcp-app
        label="Customer-support weather and incident-response application"
        .resource=${{
          uri: 'ui://operations/a-very-long-resource-identifier',
          title: 'Customer-support weather and incident-response application',
          html: '<!doctype html><html><body><p style="overflow-wrap:anywhere">Long embedded application content remains inside its sandbox.</p></body></html>',
        }}
      ></lr-mcp-app>
    </div>
  `,
};
