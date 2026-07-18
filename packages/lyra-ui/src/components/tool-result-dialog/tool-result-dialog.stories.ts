import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './tool-result-dialog.js';
import type { LyraToolResultDialog } from './tool-result-dialog.js';
import '../tabs/tabs.js';
import '../json-viewer/json-viewer.js';

const meta: Meta = {
  title: 'ToolResultDialog',
  component: 'lr-tool-result-dialog',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A full tool-call detail overlay: a status/duration header plus a `body` slot where a consumer typically places a `<lr-tabs>` with Input/Preview/JSON/Raw panels. The component knows nothing about what is inside that slot -- it only supplies the modal chrome (focus trap, Escape/backdrop dismiss, scroll lock, a maximize toggle) around it.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

function openDialog(e: Event): void {
  const trigger = e.currentTarget as HTMLElement;
  const dialog = trigger.parentElement!.querySelector('lr-tool-result-dialog') as LyraToolResultDialog;
  dialog.open = true;
}

const runPythonOutput = { stdout: 'sum = 5050\n', stderr: '', exit_code: 0 };

function toolCallPanels() {
  return html`
    <lr-tabs slot="body">
      <pre slot="input" label="Input" style="margin:0;padding:0.75rem 0;white-space:pre-wrap;">
print(sum(range(1, 101)))</pre
      >
      <div slot="preview" label="Preview" style="padding:0.75rem 0;">
        <code>sum = 5050</code>
      </div>
      <lr-json-viewer slot="json" label="JSON" .data=${runPythonOutput} style="display:block;padding:0.75rem 0;">
      </lr-json-viewer>
      <pre slot="raw" label="Raw" style="margin:0;padding:0.75rem 0;white-space:pre-wrap;">
${JSON.stringify(runPythonOutput, null, 2)}</pre
      >
    </lr-tabs>
  `;
}

export const Default: Story = {
  render: () => html`
    <div>
      <button @click=${openDialog}>Open tool result</button>
      <lr-tool-result-dialog tool-name="run_python" status="success" duration-ms="820">
        ${toolCallPanels()}
      </lr-tool-result-dialog>
    </div>
  `,
};

export const OpenInitially: Story = {
  render: () => html`
    <lr-tool-result-dialog open tool-name="run_python" status="success" duration-ms="820">
      ${toolCallPanels()}
    </lr-tool-result-dialog>
  `,
};

export const Statuses: Story = {
  render: () => html`
    <div style="display:flex; gap:0.75rem; flex-wrap:wrap;">
      <div>
        <button @click=${openDialog}>Pending</button>
        <lr-tool-result-dialog tool-name="search_web" status="pending">
          <p slot="body" style="margin:0;">Waiting to run…</p>
        </lr-tool-result-dialog>
      </div>
      <div>
        <button @click=${openDialog}>Running</button>
        <lr-tool-result-dialog tool-name="search_web" status="running">
          <p slot="body" style="margin:0;">Fetching results…</p>
        </lr-tool-result-dialog>
      </div>
      <div>
        <button @click=${openDialog}>Success</button>
        <lr-tool-result-dialog tool-name="search_web" status="success" duration-ms="1450">
          <p slot="body" style="margin:0;">Found 8 results.</p>
        </lr-tool-result-dialog>
      </div>
      <div>
        <button @click=${openDialog}>Error</button>
        <lr-tool-result-dialog tool-name="search_web" status="error" duration-ms="300">
          <p slot="body" style="margin:0;">Request timed out after 300ms.</p>
        </lr-tool-result-dialog>
      </div>
      <div>
        <button @click=${openDialog}>Denied</button>
        <lr-tool-result-dialog tool-name="delete_file" status="denied">
          <p slot="body" style="margin:0;">Blocked by workspace policy: destructive file operations require approval.</p>
        </lr-tool-result-dialog>
      </div>
    </div>
  `,
};

export const MaximizedInitially: Story = {
  render: () => html`
    <lr-tool-result-dialog open maximized tool-name="run_python" status="success" duration-ms="2300">
      ${toolCallPanels()}
    </lr-tool-result-dialog>
  `,
};

export const WithFooterActions: Story = {
  render: () => html`
    <div>
      <button @click=${openDialog}>Open tool result</button>
      <lr-tool-result-dialog tool-name="run_python" status="success" duration-ms="820">
        ${toolCallPanels()}
        <div slot="footer">
          <button
            @click=${(e: Event) =>
              ((e.target as HTMLElement).closest('lr-tool-result-dialog') as LyraToolResultDialog).close('rerun')}
          >
            Re-run
          </button>
          <button
            @click=${(e: Event) =>
              ((e.target as HTMLElement).closest('lr-tool-result-dialog') as LyraToolResultDialog).close(
                'close-button',
              )}
          >
            Done
          </button>
        </div>
      </lr-tool-result-dialog>
    </div>
  `,
};

export const Events: Story = {
  render: () => html`
    <div>
      <button @click=${openDialog}>Open tool result</button>
      <lr-tool-result-dialog
        tool-name="run_python"
        status="success"
        duration-ms="820"
        @lr-close=${(e: CustomEvent<string>) => {
          const out = document.getElementById('tool-result-dialog-log');
          if (out) out.textContent = `lr-close: ${e.detail}`;
        }}
        @lr-maximize-change=${(e: CustomEvent<boolean>) => {
          const out = document.getElementById('tool-result-dialog-log');
          if (out) out.textContent = `lr-maximize-change: ${e.detail}`;
        }}
      >
        ${toolCallPanels()}
      </lr-tool-result-dialog>
      <p id="tool-result-dialog-log">No event fired yet.</p>
    </div>
  `,
};

export const NamedAndRetimed: Story = {
  render: () => html`
    <lr-tool-result-dialog
      open
      tool-name="search_web"
      status="running"
      aria-label="Web search execution details"
      style="--lr-tool-result-dialog-spin: 2.5s linear"
    >
      <p slot="body">Searching across configured sources…</p>
    </lr-tool-result-dialog>
  `,
};
