import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './tool-approval-dialog.js';
import type { LyraToolApprovalDialog } from './tool-approval-dialog.js';

const meta: Meta = {
  title: 'ToolApprovalDialog',
  component: 'lyra-tool-approval-dialog',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A human-in-the-loop gate for a single proposed tool call: approve, deny, or edit its arguments first. Initial focus lands on Deny (not Approve) since approving is the consequential action here — see the component source for the full rationale.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const SEARCH_ARGS = {
  query: 'latest solar inverter efficiency benchmarks 2026',
  max_results: 5,
  region: 'us',
};

function openDialog(e: Event): void {
  const trigger = e.currentTarget as HTMLElement;
  const dialog = trigger.parentElement!.querySelector('lyra-tool-approval-dialog') as LyraToolApprovalDialog;
  dialog.open = true;
}

export const Default: Story = {
  render: () => html`
    <div>
      <button @click=${openDialog}>Propose web_search call</button>
      <lyra-tool-approval-dialog tool-name="web_search" .args=${SEARCH_ARGS}></lyra-tool-approval-dialog>
    </div>
  `,
};

export const OpenInitially: Story = {
  render: () => html`
    <lyra-tool-approval-dialog open tool-name="web_search" .args=${SEARCH_ARGS}></lyra-tool-approval-dialog>
  `,
};

export const NotEditable: Story = {
  name: 'Not editable',
  render: () => html`
    <lyra-tool-approval-dialog
      open
      tool-name="delete_file"
      .args=${{ path: '/workspace/report-draft.md' }}
      .editable=${false}
    ></lyra-tool-approval-dialog>
  `,
};

export const NestedArguments: Story = {
  render: () => html`
    <lyra-tool-approval-dialog
      open
      tool-name="run_python"
      .args=${{
        code: 'print("hello")',
        env: { PYTHONPATH: '/workspace', TIMEOUT_S: 30 },
        allow_network: false,
        packages: ['numpy', 'pandas'],
      }}
    ></lyra-tool-approval-dialog>
  `,
};

export const WithFooterContent: Story = {
  name: 'With supplementary footer content',
  render: () => html`
    <div>
      <button @click=${openDialog}>Propose send_email call</button>
      <lyra-tool-approval-dialog
        tool-name="send_email"
        .args=${{ to: 'ops@example.com', subject: 'Nightly build failed', body: 'See attached log.' }}
      >
        <label slot="footer" style="display:flex;align-items:center;gap:0.375rem;font-size:0.8125rem;">
          <input type="checkbox" />
          Remember for this tool
        </label>
      </lyra-tool-approval-dialog>
    </div>
  `,
};

export const Events: Story = {
  render: () => html`
    <div>
      <button @click=${openDialog}>Propose web_search call</button>
      <lyra-tool-approval-dialog
        tool-name="web_search"
        .args=${SEARCH_ARGS}
        @lyra-approve=${(e: CustomEvent<{ args: unknown }>) => {
          const out = document.getElementById('tool-approval-dialog-log');
          if (out) out.textContent = `lyra-approve: args=${JSON.stringify(e.detail.args)}`;
        }}
        @lyra-deny=${() => {
          const out = document.getElementById('tool-approval-dialog-log');
          if (out) out.textContent = 'lyra-deny';
        }}
        @lyra-close=${(e: CustomEvent<string>) => {
          const out = document.getElementById('tool-approval-dialog-close-log');
          if (out) out.textContent = `lyra-close: ${e.detail}`;
        }}
      ></lyra-tool-approval-dialog>
      <p id="tool-approval-dialog-log">No decision yet.</p>
      <p id="tool-approval-dialog-close-log">No close yet.</p>
    </div>
  `,
};
