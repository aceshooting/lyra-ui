import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './tool-select-dialog.js';
import type { LyraToolSelectDialog, ToolSelectDialogTool } from './tool-select-dialog.js';

const meta: Meta = {
  title: 'ToolSelectDialog',
  component: 'lr-tool-select-dialog',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A category-grouped, filterable dialog for picking which agent tools are enabled for a conversation. `useDefaults` is a single top-level switch — while on, every per-tool checkbox renders disabled (reflecting whatever `selected` holds); turning it off is the "customize" action that unlocks per-tool editing.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const TOOLS: ToolSelectDialogTool[] = [
  {
    id: 'web_search',
    name: 'Web search',
    description: 'Search the public web for up-to-date information.',
    category: 'Research',
    icon: '🔎',
  },
  {
    id: 'fetch_url',
    name: 'Fetch URL',
    description: 'Download and read the contents of a specific web page.',
    category: 'Research',
    icon: '🌐',
  },
  {
    id: 'run_python',
    name: 'Run Python',
    description: 'Execute Python code in a sandboxed environment.',
    category: 'Code execution',
    icon: '🐍',
  },
  {
    id: 'run_shell',
    name: 'Run shell command',
    description: 'Execute an arbitrary shell command on the host.',
    category: 'Code execution',
    icon: '💻',
    disabled: true,
    disabledReason: 'Requires admin approval for this workspace.',
  },
  {
    id: 'read_file',
    name: 'Read file',
    description: 'Read a file from the connected workspace.',
    category: 'Files',
    icon: '📄',
  },
  {
    id: 'write_file',
    name: 'Write file',
    description: 'Create or overwrite a file in the connected workspace.',
    category: 'Files',
    icon: '✏️',
  },
  {
    id: 'delete_file',
    name: 'Delete file',
    description: 'Permanently remove a file from the connected workspace.',
    category: 'Files',
    icon: '🗑️',
    disabled: true,
    disabledReason: 'Destructive file operations are disabled for this workspace.',
  },
  {
    id: 'send_email',
    name: 'Send email',
  },
];

function openDialog(e: Event): void {
  const trigger = e.currentTarget as HTMLElement;
  const dialog = trigger.parentElement!.querySelector('lr-tool-select-dialog') as LyraToolSelectDialog;
  dialog.open = true;
}

export const Default: Story = {
  render: () => html`
    <div>
      <button @click=${openDialog}>Select tools</button>
      <lr-tool-select-dialog
        .tools=${TOOLS}
        .selected=${['web_search', 'fetch_url', 'run_python']}
      ></lr-tool-select-dialog>
    </div>
  `,
};

export const OpenInitially: Story = {
  render: (_args, context) => html`
    <lr-tool-select-dialog
      .open=${context.viewMode !== 'docs'}
      .tools=${TOOLS}
      .selected=${['web_search', 'fetch_url', 'run_python', 'read_file']}
    ></lr-tool-select-dialog>
  `,
};

export const UsingDefaults: Story = {
  name: 'Using default tools (locked)',
  render: (_args, context) => html`
    <lr-tool-select-dialog
      .open=${context.viewMode !== 'docs'}
      use-defaults
      .tools=${TOOLS}
      .selected=${['web_search', 'fetch_url', 'run_python', 'read_file', 'write_file']}
    ></lr-tool-select-dialog>
  `,
};

export const NoCategories: Story = {
  render: (_args, context) => html`
    <lr-tool-select-dialog
      .open=${context.viewMode !== 'docs'}
      .tools=${[
        { id: 'a', name: 'Tool A', description: 'An uncategorized tool.' },
        { id: 'b', name: 'Tool B', description: 'Another uncategorized tool.' },
      ]}
      .selected=${['a']}
    ></lr-tool-select-dialog>
  `,
};

export const Empty: Story = {
  render: (_args, context) => html`<lr-tool-select-dialog .open=${context.viewMode !== 'docs'} .tools=${[]} .selected=${[]}></lr-tool-select-dialog>`,
};

export const WithFooterActions: Story = {
  render: () => html`
    <div>
      <button @click=${openDialog}>Select tools</button>
      <lr-tool-select-dialog .tools=${TOOLS} .selected=${['web_search', 'run_python']}>
        <div slot="footer">
          <button
            @click=${(e: Event) =>
              ((e.target as HTMLElement).closest('lr-tool-select-dialog') as LyraToolSelectDialog).close('done')}
          >
            Done
          </button>
        </div>
      </lr-tool-select-dialog>
    </div>
  `,
};

export const Events: Story = {
  render: () => html`
    <div>
      <button @click=${openDialog}>Select tools</button>
      <lr-tool-select-dialog
        .tools=${TOOLS}
        .selected=${['web_search']}
        @lr-change=${(e: CustomEvent<{ selected: string[]; useDefaults: boolean }>) => {
          const out = document.getElementById('tool-select-dialog-log');
          if (out) {
            out.textContent = `lr-change: selected=[${e.detail.selected.join(', ')}] useDefaults=${e.detail.useDefaults}`;
          }
        }}
        @lr-close=${(e: CustomEvent<string>) => {
          const out = document.getElementById('tool-select-dialog-close-log');
          if (out) out.textContent = `lr-close: ${e.detail}`;
        }}
      ></lr-tool-select-dialog>
      <p id="tool-select-dialog-log">No change yet.</p>
      <p id="tool-select-dialog-close-log">No close yet.</p>
    </div>
  `,
};
