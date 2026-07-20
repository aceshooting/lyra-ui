import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './tool-approval-dialog.js';
import type { LyraToolApprovalDialog } from './tool-approval-dialog.js';

const meta: Meta = {
  title: 'ToolApprovalDialog',
  component: 'lr-tool-approval-dialog',
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
  const dialog = trigger.parentElement!.querySelector('lr-tool-approval-dialog') as LyraToolApprovalDialog;
  dialog.open = true;
}

export const Default: Story = {
  render: () => html`
    <div>
      <button @click=${openDialog}>Propose web_search call</button>
      <lr-tool-approval-dialog tool-name="web_search" .args=${SEARCH_ARGS}></lr-tool-approval-dialog>
    </div>
  `,
};

export const OpenInitially: Story = {
  render: (_args, context) => html`
    <lr-tool-approval-dialog .open=${context.viewMode !== 'docs'} tool-name="web_search" .args=${SEARCH_ARGS}></lr-tool-approval-dialog>
  `,
};

export const NotEditable: Story = {
  name: 'Not editable',
  render: (_args, context) => html`
    <lr-tool-approval-dialog
      .open=${context.viewMode !== 'docs'}
      tool-name="delete_file"
      .args=${{ path: '/workspace/report-draft.md' }}
      .editable=${false}
    ></lr-tool-approval-dialog>
  `,
};

export const NestedArguments: Story = {
  render: (_args, context) => html`
    <lr-tool-approval-dialog
      .open=${context.viewMode !== 'docs'}
      tool-name="run_python"
      .args=${{
        code: 'print("hello")',
        env: { PYTHONPATH: '/workspace', TIMEOUT_S: 30 },
        allow_network: false,
        packages: ['numpy', 'pandas'],
      }}
    ></lr-tool-approval-dialog>
  `,
};

export const WithFooterContent: Story = {
  name: 'With supplementary footer content',
  render: () => html`
    <div>
      <button @click=${openDialog}>Propose send_email call</button>
      <lr-tool-approval-dialog
        tool-name="send_email"
        .args=${{ to: 'ops@example.com', subject: 'Nightly build failed', body: 'See attached log.' }}
      >
        <label slot="footer" style="display:flex;align-items:center;gap:0.375rem;font-size:0.8125rem;">
          <input type="checkbox" />
          Remember for this tool
        </label>
      </lr-tool-approval-dialog>
    </div>
  `,
};

export const Narrow320px: Story = {
  name: 'Narrow (320px)',
  render: (_args, context) => html`
    <div style="max-width:320px;border:1px dashed var(--lr-color-border);padding:8px;">
      <lr-tool-approval-dialog
        .open=${context.viewMode !== 'docs'}
        tool-name="web_search"
        .args=${SEARCH_ARGS}
        style="position:relative;inset:auto;display:flex;"
      ></lr-tool-approval-dialog>
    </div>
  `,
};

export const NarrowWithLongLabels: Story = {
  name: 'Narrow (320px) with long translated action labels',
  render: (_args, context) => html`
    <div style="max-width:320px;border:1px dashed var(--lr-color-border);padding:8px;">
      <lr-tool-approval-dialog
        .open=${context.viewMode !== 'docs'}
        tool-name="web_search"
        .args=${SEARCH_ARGS}
        .strings=${{
          deny: 'Refuser cette action',
          edit: "Modifier les arguments",
          approve: 'Approuver cette action',
        }}
        style="position:relative;inset:auto;display:flex;"
      ></lr-tool-approval-dialog>
    </div>
  `,
};

export const Events: Story = {
  render: () => html`
    <div>
      <button @click=${openDialog}>Propose web_search call</button>
      <lr-tool-approval-dialog
        tool-name="web_search"
        .args=${SEARCH_ARGS}
        @lr-approve=${(e: CustomEvent<{ args: unknown }>) => {
          const out = document.getElementById('tool-approval-dialog-log');
          if (out) out.textContent = `lr-approve: args=${JSON.stringify(e.detail.args)}`;
        }}
        @lr-deny=${() => {
          const out = document.getElementById('tool-approval-dialog-log');
          if (out) out.textContent = 'lr-deny';
        }}
        @lr-close=${(e: CustomEvent<string>) => {
          const out = document.getElementById('tool-approval-dialog-close-log');
          if (out) out.textContent = `lr-close: ${e.detail}`;
        }}
      ></lr-tool-approval-dialog>
      <p id="tool-approval-dialog-log">No decision yet.</p>
      <p id="tool-approval-dialog-close-log">No close yet.</p>
    </div>
  `,
};
