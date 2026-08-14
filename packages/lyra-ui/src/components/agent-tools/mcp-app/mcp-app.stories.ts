import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './mcp-app.js';
import type { LyraMcpApp, McpAppToolCallDetail } from './mcp-app.class.js';

const meta: Meta = {
  title: 'MCP App',
  component: 'lr-mcp-app',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Inline app HTML is uniquely sandboxed and receives its CSP before any app-controlled token is parsed.',
      },
    },
  },
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

export const CorrelatedToolReply: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Replies include the requesting frame generation, so replacing or reconnecting the app cannot deliver stale tool output into a different document.',
      },
    },
  },
  render: () => html`
    <lr-mcp-app
      style="display: block; max-width: 48rem;"
      @lr-mcp-tool-call=${(event: CustomEvent<McpAppToolCallDetail>) => {
        const host = event.currentTarget as LyraMcpApp;
        if (!event.detail.requestId) return;
        host.postToolResult(event.detail.requestId, {
          frameGeneration: event.detail.frameGeneration,
          result: { temperature: 21, unit: 'celsius' },
        });
      }}
      .resource=${{
        uri: 'ui://weather/correlated-tool-reply',
        html: `<!doctype html><html><body>
          <p id="status">Requesting the current weather…</p>
          <script>
            addEventListener('message', (event) => {
              if (event.data?.type !== 'tool-result') return;
              document.querySelector('#status').textContent =
                'Weather result received for this frame generation.';
            });
            parent.postMessage({
              channel: 'lyra-mcp-app',
              version: 1,
              type: 'tool-call',
              requestId: 'weather-story',
              name: 'get_weather',
              args: { city: 'Luxembourg' }
            }, '*');
          </script>
        </body></html>`,
      }}
    ></lr-mcp-app>
  `,
};
