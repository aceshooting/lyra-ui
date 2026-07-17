import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './confirm-bar.js';

const meta: Meta = {
  title: 'ConfirmBar',
  component: 'lyra-confirm-bar',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'An inline, non-modal approve/deny block for one proposed action — the in-flow sibling of lyra-tool-approval-dialog for confirmations that should sit in the transcript instead of hijacking focus.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lyra-confirm-bar tool-name="run_shell" .args=${{ command: 'rm -rf build/' }}></lyra-confirm-bar>`,
};

export const DangerTone: Story = {
  render: () =>
    html`<lyra-confirm-bar
      tone="danger"
      tool-name="delete_database"
      .args=${{ database: 'production' }}
    ></lyra-confirm-bar>`,
};

export const FreeFormHeading: Story = {
  render: () => html`<lyra-confirm-bar heading="Send this email to the customer?"></lyra-confirm-bar>`,
};

export const NoArgs: Story = {
  render: () => html`<lyra-confirm-bar tool-name="clear_cache"></lyra-confirm-bar>`,
};

export const WithSupplementaryBody: Story = {
  render: () => html`
    <lyra-confirm-bar tool-name="apply_patch" .args=${{ file: 'src/index.ts' }}>
      <p style="margin:0;">Adds a null check before the array access on line 42.</p>
    </lyra-confirm-bar>
  `,
};

export const AlreadyDecided: Story = {
  render: () => html`<lyra-confirm-bar tool-name="run_shell" decision="approved"></lyra-confirm-bar>`,
};

export const Narrow320px: Story = {
  render: () => html`
    <div style="max-width:320px;border:1px dashed #ccc;padding:8px;">
      <lyra-confirm-bar tool-name="run_shell" .args=${{ command: 'npm test' }}></lyra-confirm-bar>
    </div>
  `,
};
