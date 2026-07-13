import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './tool-result-view.js';
import { registerToolRenderer } from './registry.js';

// Registered once, at module load -- every story below dispatches against
// this same module-level default registry, exactly like a real app would
// register its renderers once at startup rather than per-view.
registerToolRenderer('get_weather', {
  render: (result) => {
    const r = result as { location: string; tempC: number; conditions: string };
    return html`
      <div
        style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem 1rem;border:1px solid var(--lyra-color-border);border-radius:0.5rem;max-width:20rem;"
      >
        <span style="font-size:1.75rem;">${r.conditions === 'Rain' ? '🌧️' : '☀️'}</span>
        <div>
          <div style="font-weight:600;">${r.location}</div>
          <div style="color:var(--lyra-color-text-quiet);font-size:0.875rem;">${r.tempC}°C · ${r.conditions}</div>
        </div>
      </div>
    `;
  },
});

registerToolRenderer('search_result_renderer', {
  // Dispatches by result shape rather than by tool name -- useful when
  // several differently-named tools (web_search, doc_search, ...) all return
  // the same { results: [...] } envelope.
  matches: (payload) => typeof payload === 'object' && payload !== null && Array.isArray((payload as { results?: unknown }).results),
  render: (result) => {
    const r = result as { results: { title: string; url: string }[] };
    return html`
      <ul style="margin:0;padding-inline-start:1.25rem;max-width:24rem;">
        ${r.results.map((item) => html`<li><a href=${item.url} target="_blank" rel="noopener noreferrer">${item.title}</a></li>`)}
      </ul>
    `;
  },
});

registerToolRenderer('slow_dashboard_widget', {
  // Simulates a code-split renderer -- the real thing would be
  // `load: () => import('./my-heavy-renderer.js')`.
  load: () =>
    new Promise((resolve) =>
      setTimeout(
        () =>
          resolve({
            render: (result) =>
              html`<div style="padding:1rem;border:1px dashed var(--lyra-color-border);border-radius:0.5rem;max-width:20rem;">
                Loaded after a delay — ${JSON.stringify(result)}
              </div>`,
          }),
        1200,
      ),
    ),
});

registerToolRenderer('broken_renderer', {
  render: () => {
    throw new Error('this renderer always throws, to demonstrate the fallback path');
  },
});

const meta: Meta = {
  title: 'ToolResultView',
  component: 'lyra-tool-result-view',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Dispatches a tool call\'s result to a custom renderer registered via `registerToolRenderer()` (exact tool-name match, then facade/shape-based `matches()` dispatch), falling back to `<lyra-json-viewer>` whenever no renderer matches, a lazy `load()` rejects, or `render()` throws.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const NoRendererRegistered: Story = {
  name: 'Fallback: no renderer registered',
  render: () => html`
    <lyra-tool-result-view
      tool-name="unregistered_tool"
      .result=${{ status: 'ok', rows: 42 }}
      style="display:block;max-width:24rem;"
    ></lyra-tool-result-view>
  `,
};

export const ExactNameMatch: Story = {
  render: () => html`
    <lyra-tool-result-view
      tool-name="get_weather"
      .result=${{ location: 'Brussels, BE', tempC: 19, conditions: 'Cloudy' }}
    ></lyra-tool-result-view>
  `,
};

export const ShapeBasedDispatch: Story = {
  name: 'Facade/shape-based dispatch (no exact tool-name match)',
  render: () => html`
    <lyra-tool-result-view
      tool-name="web_search"
      .result=${{
        results: [
          { title: 'lyra-ui documentation', url: 'https://example.com/docs' },
          { title: 'Getting started guide', url: 'https://example.com/start' },
        ],
      }}
    ></lyra-tool-result-view>
  `,
};

export const LazyLoadedRenderer: Story = {
  render: () => html`
    <lyra-tool-result-view
      tool-name="slow_dashboard_widget"
      .result=${{ metric: 'active_users', value: 8213 }}
    ></lyra-tool-result-view>
  `,
};

export const RenderErrorFallsBackToJson: Story = {
  name: 'Renderer throws — falls back to lyra-json-viewer',
  render: () => html`
    <lyra-tool-result-view
      tool-name="broken_renderer"
      .result=${{ this: 'still renders, via the fallback' }}
      @lyra-render-error=${(e: CustomEvent<{ toolName: string; error: unknown }>) =>
        console.warn('lyra-render-error', e.detail)}
    ></lyra-tool-result-view>
  `,
};
