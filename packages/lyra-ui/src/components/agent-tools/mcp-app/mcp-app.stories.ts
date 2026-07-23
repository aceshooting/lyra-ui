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
