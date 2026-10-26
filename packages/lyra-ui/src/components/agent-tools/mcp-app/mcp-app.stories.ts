import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './mcp-app.js';
import type { LyraMcpApp, McpAppToolCallDetail, McpAppRequestDetail } from './mcp-app.class.js';

const meta: Meta = {
  title: 'MCP App',
  component: 'lr-mcp-app',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Resource records and nested CSP/metadata collections are bounded clone-owned frozen snapshots; create and reassign a new resource after changes.',
      },
    },
  },
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
              if (event.data?.type !== 'host-context' || !event.ports[0]) return;
              const port = event.ports[0];
              port.addEventListener('message', (portEvent) => {
                if (portEvent.data?.type !== 'tool-result') return;
                document.querySelector('#status').textContent =
                  'Weather result received for this frame generation.';
              });
              port.start();
              port.postMessage({
                channel: 'lyra-mcp-app',
                version: 1,
                type: 'tool-call',
                requestId: 'weather-story',
                name: 'get_weather',
                args: { city: 'Luxembourg' },
                nonce: event.data.nonce
              });
            });
          </script>
        </body></html>`,
      }}
    ></lr-mcp-app>
  `,
};

export const McpAppsProtocol: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Opt-in MCP Apps 2026-01-26 lifecycle. The app uses standard JSON-RPC; the host grants tool access and returns a correlated response. This wire-level example uses inline assets. Official mode also permits external scripts and styles from host-approved resource.csp.resourceDomains; legacy mode keeps them inline-only. The supported host subset is qualified separately with the pinned SDK fixture.',
      },
    },
  },
  render: () => html`
    <lr-mcp-app
      protocol="mcp-apps"
      .hostCapabilities=${{ serverTools: {} }}
      @lr-mcp-request=${(event: CustomEvent<McpAppRequestDetail>) => {
        const host = event.currentTarget as LyraMcpApp;
        host.postMcpResponse(event.detail.requestId, {
          requestToken: event.detail.requestToken,
          frameGeneration: event.detail.frameGeneration,
          result: { content: [{ type: 'text', text: '21 °C in Luxembourg' }] },
        });
      }}
      .resource=${{
        uri: 'ui://weather/mcp-apps',
        title: 'MCP Apps weather',
        html: `<!doctype html><html><body>
          <p id="status">Connecting…</p>
          <script>
            const send = message => parent.postMessage({ jsonrpc: '2.0', ...message }, '*');
            addEventListener('message', event => {
              if (event.source !== parent || event.data?.jsonrpc !== '2.0') return;
              if (event.data.id === 'initialize') {
                send({ method: 'ui/notifications/initialized' });
                send({ id: 'weather', method: 'tools/call', params: { name: 'get_weather', arguments: { city: 'Luxembourg' } } });
              }
              if (event.data.id === 'weather') {
                document.querySelector('#status').textContent = event.data.result?.content[0]?.text || 'Weather unavailable';
              }
              if (event.data.method === 'ui/resource-teardown') send({ id: event.data.id, result: {} });
            });
            send({ id: 'initialize', method: 'ui/initialize', params: {
              protocolVersion: '2026-01-26', appInfo: { name: 'Weather', version: '1' }, appCapabilities: {}
            } });
          </script>
        </body></html>`,
      }}
    ></lr-mcp-app>
  `,
};
