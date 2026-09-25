import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './tool-call-block.js';

const meta: Meta = {
  title: 'Agent Tools & Observability/Tool Call Block',
  component: 'lr-tool-call-block',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'One tool call shown inline as a collapsed-by-default disclosure. The header reads a status-aware verb with a status glyph and an optional duration; expanding it reveals the arguments, then the error, then the result. `redactedFields` masks dotted payload paths. `<lr-message-parts tool-display="block">` renders paired tool-call/tool-result parts through this element.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const Default: StoryObj = {
  render: () => html`<lr-tool-call-block
    name="web_search"
    call-id="call-1"
    status="success"
    duration-ms="1450"
    .args=${{ query: 'lyra web components', limit: 5 }}
    .result=${{ hits: [{ title: 'Lyra UI', url: 'https://example.com' }] }}
  ></lr-tool-call-block>`,
};

export const Statuses: Story = {
  render: () => html`
    <div style="display: grid; gap: 0.5rem; max-inline-size: 36rem;">
      <lr-tool-call-block name="web_search" status="pending"></lr-tool-call-block>
      <lr-tool-call-block name="web_search" status="running" .args=${{ query: 'lyra' }}></lr-tool-call-block>
      <lr-tool-call-block name="web_search" status="success" duration-ms="820" .result=${{ hits: 3 }}></lr-tool-call-block>
      <lr-tool-call-block name="run_python" status="error" duration-ms="300" error="Request timed out"></lr-tool-call-block>
      <lr-tool-call-block name="delete_file" status="denied"></lr-tool-call-block>
    </div>
  `,
};

export const ExpandedWithError: Story = {
  name: 'Expanded with arguments, error and partial result',
  render: () => html`<lr-tool-call-block
    name="fetch_rows"
    status="error"
    expanded
    .args=${{ table: 'orders', limit: 100 }}
    error="Upstream closed the connection after 40 rows"
    .result=${{ rows: 40 }}
  ></lr-tool-call-block>`,
};

export const Redacted: Story = {
  name: 'Redacted fields',
  render: () => html`<lr-tool-call-block
    name="lookup_customer"
    status="success"
    expanded
    .args=${{ customerId: 'c-42', apiKey: 'sk-live-secret' }}
    .result=${{ rows: [{ name: 'Ada', ssn: '123-45-6789' }] }}
    .redactedFields=${['args.apiKey', 'result.rows.0.ssn']}
  ></lr-tool-call-block>`,
};

export const LabelOverride: Story = {
  name: 'Label override',
  render: () => html`<lr-tool-call-block
    name="web_search"
    status="running"
    label="Searching the documentation"
  ></lr-tool-call-block>`,
};

export const Narrow: Story = {
  name: 'Narrow container with a long tool name',
  render: () => html`<div style="max-inline-size: 18rem;">
    <lr-tool-call-block
      name="query_customer_database_readonly_with_a_very_long_identifier"
      status="success"
      duration-ms="2400"
      expanded
      .args=${{ filter: 'status = active AND region = emea AND created_at > 2026-01-01' }}
    ></lr-tool-call-block>
  </div>`,
};

export const RightToLeft: Story = {
  name: 'Right-to-left',
  render: () => html`<div dir="rtl" lang="ar" style="max-inline-size: 30rem;">
    <lr-tool-call-block name="web_search" status="success" duration-ms="1500" .args=${{ q: 'lyra' }}></lr-tool-call-block>
  </div>`,
};
