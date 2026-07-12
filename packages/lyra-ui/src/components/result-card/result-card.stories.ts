import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './result-card.js';
import './result-field.js';
import '../chip/chip.js';
import '../tool-result-view/tool-result-view.js';
import { registerToolRenderer } from '../tool-result-view/registry.js';

const meta: Meta = {
  title: 'ResultCard',
  component: 'lyra-result-card',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A small bordered card + label/value row shell for per-tool renderer bodies. Meant to be used inside a custom renderer registered via `<lyra-tool-result-view>`\'s `registerToolRenderer()`, so every custom tool result reads with the same dense, small-card visual language instead of each renderer hand-rolling its own bordered box.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-result-card title="HTTP request" style="max-inline-size:20rem;">
      <lyra-result-field label="Status" value="200 OK"></lyra-result-field>
      <lyra-result-field label="Duration" value="340ms"></lyra-result-field>
      <lyra-result-field label="Size" value="12.4 KB"></lyra-result-field>
    </lyra-result-card>
  `,
};

export const Untitled: Story = {
  name: 'Untitled (no header)',
  render: () => html`
    <lyra-result-card style="max-inline-size:20rem;">
      <lyra-result-field label="Rows affected" value="1,204"></lyra-result-field>
      <lyra-result-field label="Query time" value="88ms"></lyra-result-field>
    </lyra-result-card>
  `,
};

export const WithHeaderActions: Story = {
  render: () => html`
    <lyra-result-card title="run_query" style="max-inline-size:20rem;">
      <button
        slot="actions"
        type="button"
        style="border:none;background:none;color:var(--lyra-color-brand);font:inherit;font-size:0.75rem;font-weight:600;cursor:pointer;padding:0;"
        @click=${() => alert('Copied (demo only)')}
      >
        Copy
      </button>
      <lyra-result-field label="Status" value="Success"></lyra-result-field>
      <lyra-result-field label="Rows" value="42"></lyra-result-field>
    </lyra-result-card>
  `,
};

/** `<lyra-result-field>`'s default slot overrides the plain `value` prop
 *  once it carries real content -- here a `<lyra-chip>` status badge stands
 *  in for the plain "Status: 200 OK" text row. */
export const RichSlottedValue: Story = {
  render: () => html`
    <lyra-result-card title="Deployment" style="max-inline-size:20rem;">
      <lyra-result-field label="Status">
        <lyra-chip tone="success">Live</lyra-chip>
      </lyra-result-field>
      <lyra-result-field label="Environment" value="production"></lyra-result-field>
      <lyra-result-field label="Version" value="v2.4.1"></lyra-result-field>
    </lyra-result-card>
  `,
};

/** `<lyra-result-field>` also works outside a `<lyra-result-card>`, e.g. a
 *  compact metadata strip. */
export const FieldStandalone: Story = {
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:0.25rem; max-inline-size:16rem;">
      <lyra-result-field label="Model" value="gpt-5.4"></lyra-result-field>
      <lyra-result-field label="Tokens" value="1,024 / 8,192"></lyra-result-field>
      <lyra-result-field value="No label, value only"></lyra-result-field>
    </div>
  `,
};

// Registered once at module load, like a real app registering its tool
// renderers at startup -- this is the family's canonical example of the
// "consistent small-card visual language for a custom renderer" use case
// result-card/result-field exist for.
registerToolRenderer('run_http_request', {
  render: (result) => {
    const r = result as { status: number; statusText: string; durationMs: number; sizeKb: number };
    return html`
      <lyra-result-card title="HTTP request">
        <lyra-result-field label="Status" value="${r.status} ${r.statusText}"></lyra-result-field>
        <lyra-result-field label="Duration" value="${r.durationMs}ms"></lyra-result-field>
        <lyra-result-field label="Size" value="${r.sizeKb} KB"></lyra-result-field>
      </lyra-result-card>
    `;
  },
});

export const AsToolResultViewRenderer: Story = {
  name: 'As a <lyra-tool-result-view> renderer',
  render: () => html`
    <lyra-tool-result-view
      tool-name="run_http_request"
      .result=${{ status: 200, statusText: 'OK', durationMs: 340, sizeKb: 12.4 }}
      style="max-inline-size:20rem;"
    ></lyra-tool-result-view>
  `,
};
