import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './tool-call-chip.js';
// A sibling batch component that already exists on disk — used here purely
// to demonstrate the intended integration: this chip fires an event, the
// consumer decides what (if anything) opens in response.
import '../tool-result-dialog/tool-result-dialog.js';
import type { LyraToolResultDialog } from '../tool-result-dialog/tool-result-dialog.js';

const meta: Meta = {
  title: 'ToolCallChip',
  component: 'lyra-tool-call-chip',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A compact inline status pill for one tool/function call an agent made mid-conversation. It renders no detail surface of its own — clicking it fires `lyra-tool-chip-select`, and the consumer decides what to do (typically opening a `<lyra-tool-result-dialog>`).',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Statuses: Story = {
  render: () => html`
    <div style="display:flex; gap:0.5rem; flex-wrap:wrap; max-width:40rem;">
      <lyra-tool-call-chip name="search_web" category="research" status="pending" summary="Queued"></lyra-tool-call-chip>
      <lyra-tool-call-chip name="search_web" category="research" status="running" summary="Searching web…"></lyra-tool-call-chip>
      <lyra-tool-call-chip
        name="search_web"
        category="research"
        status="success"
        summary="Found 8 results"
        duration-ms="1450"
      ></lyra-tool-call-chip>
      <lyra-tool-call-chip
        name="run_python"
        status="error"
        summary="Request timed out"
        duration-ms="300"
      ></lyra-tool-call-chip>
      <lyra-tool-call-chip name="delete_file" status="denied" summary="Blocked by policy"></lyra-tool-call-chip>
    </div>
  `,
};

export const WithoutCategoryOrDuration: Story = {
  name: 'Without category or duration',
  render: () => html`<lyra-tool-call-chip name="web_search" status="running" summary="Searching web…"></lyra-tool-call-chip>`,
};

export const LongContentTruncates: Story = {
  name: 'Long name/summary truncate inside a constrained width',
  render: () => html`
    <div style="max-width:16rem;">
      <lyra-tool-call-chip
        name="query_customer_database_readonly"
        category="internal-tools"
        status="running"
        summary="Looking up account history for the last 90 days across every region"
      ></lyra-tool-call-chip>
    </div>
  `,
};

export const CustomIconViaProp: Story = {
  name: 'Custom icon hint (icon prop, no slot override)',
  render: () => html`<lyra-tool-call-chip name="web_search" icon="🔍" status="running" summary="Searching web…"></lyra-tool-call-chip>`,
};

export const CustomIconViaSlot: Story = {
  name: 'Custom icon override (icon slot wins over both)',
  render: () => html`
    <lyra-tool-call-chip name="send_email" icon="✉️" status="success" summary="Sent">
      <span slot="icon" style="font-size:1em;line-height:1;">✅</span>
    </lyra-tool-call-chip>
  `,
};

export const HoverDetailTooltip: Story = {
  name: 'Hover/focus detail tooltip (default slot)',
  render: () => html`
    <lyra-tool-call-chip name="search_web" category="research" status="success" summary="Found 8 results" duration-ms="1450">
      <div style="min-width:14rem;">
        <strong>Query</strong>
        <div style="margin-top:0.25rem;color:var(--lyra-color-text-quiet);">"solar panel efficiency 2026"</div>
      </div>
    </lyra-tool-call-chip>
  `,
};

function openResultDialog(e: CustomEvent<{ name: string; callId: string }>): void {
  const chip = e.currentTarget as HTMLElement;
  const dialog = chip.parentElement!.querySelector('lyra-tool-result-dialog') as LyraToolResultDialog;
  dialog.open = true;
}

export const IntegrationWithToolResultDialog: Story = {
  name: 'Integration: opens a lyra-tool-result-dialog on select',
  parameters: {
    docs: {
      description: {
        story:
          'The chip never imports or renders `<lyra-tool-result-dialog>` itself — this story shows the intended consumer wiring: listen for `lyra-tool-chip-select` and open whatever detail surface makes sense at the call site.',
      },
    },
  },
  render: () => html`
    <div>
      <lyra-tool-call-chip
        name="run_python"
        category="code"
        status="success"
        summary="Ran successfully"
        duration-ms="820"
        call-id="call-1"
        @lyra-tool-chip-select=${openResultDialog}
      ></lyra-tool-call-chip>
      <lyra-tool-result-dialog tool-name="run_python" status="success" duration-ms="820">
        <pre slot="body" style="margin:0;white-space:pre-wrap;">sum = 5050</pre>
      </lyra-tool-result-dialog>
    </div>
  `,
};

export const Events: Story = {
  render: () => html`
    <div>
      <lyra-tool-call-chip
        name="web_search"
        status="running"
        summary="Searching web…"
        call-id="call-9"
        @lyra-tool-chip-select=${(e: CustomEvent<{ name: string; callId: string }>) => {
          const out = document.getElementById('tool-call-chip-log');
          if (out) out.textContent = `lyra-tool-chip-select: ${JSON.stringify(e.detail)}`;
        }}
      ></lyra-tool-call-chip>
      <p id="tool-call-chip-log">No event fired yet.</p>
    </div>
  `,
};

export const ReducedMotion: Story = {
  name: 'Reduced motion (static)',
  parameters: {
    docs: {
      description: {
        story:
          'With `prefers-reduced-motion: reduce` set at the OS/browser level, the pending pulse and running spin both render their plain resting frame instead of animating.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; gap:0.5rem;">
      <lyra-tool-call-chip name="search_web" status="pending" summary="Queued"></lyra-tool-call-chip>
      <lyra-tool-call-chip name="search_web" status="running" summary="Searching web…"></lyra-tool-call-chip>
    </div>
  `,
};
