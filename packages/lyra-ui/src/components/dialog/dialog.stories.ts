import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './dialog.js';
import type { LyraDialog } from './dialog.js';
import { confirm } from './confirm.js';

const meta: Meta = {
  title: 'Dialog',
  component: 'lr-dialog',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A general-purpose modal. Chrome stays minimal -- slot a heading (drives the accessible name automatically) and body content into the default slot, and action buttons into `footer`.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

function openDialog(e: Event): void {
  const trigger = e.currentTarget as HTMLElement;
  const dialog = trigger.parentElement!.querySelector('lr-dialog') as LyraDialog;
  dialog.open = true;
}

export const Default: Story = {
  render: () => html`
    <div>
      <button @click=${openDialog}>Open dialog</button>
      <lr-dialog>
        <h2 style="margin: 0 0 0.5rem;">Project settings</h2>
        <p style="margin: 0;">Body content -- a form, a summary, anything a consumer slots in.</p>
        <div slot="footer">
          <button @click=${(e: Event) => ((e.target as HTMLElement).closest('lr-dialog') as LyraDialog).close('cancel')}>
            Cancel
          </button>
          <button @click=${(e: Event) => ((e.target as HTMLElement).closest('lr-dialog') as LyraDialog).close('save')}>
            Save
          </button>
        </div>
      </lr-dialog>
    </div>
  `,
};

export const OpenInitially: Story = {
  render: (_args, context) => html`
    <lr-dialog .open=${context.viewMode !== 'docs'}>
      <h2 style="margin: 0 0 0.5rem;">Rendered already open</h2>
      <p style="margin: 0;">Backdrop, centered panel, and dialog semantics -- no trigger needed for this story.</p>
      <div slot="footer">
        <button @click=${(e: Event) => ((e.target as HTMLElement).closest('lr-dialog') as LyraDialog).close('ok')}>
          Got it
        </button>
      </div>
    </lr-dialog>
  `,
};

export const LabelPropNoHeading: Story = {
  render: () => html`
    <div>
      <button @click=${openDialog}>Open dialog</button>
      <lr-dialog label="Delete this item?">
        <p style="margin: 0;">
          No visible heading is slotted here -- the <code>label</code> prop instead renders an
          invisible element (the <code>label</code> csspart) that <code>aria-labelledby</code>
          points at, so the dialog still has an accessible name.
        </p>
        <div slot="footer">
          <button @click=${(e: Event) => ((e.target as HTMLElement).closest('lr-dialog') as LyraDialog).close('cancel')}>
            Cancel
          </button>
        </div>
      </lr-dialog>
    </div>
  `,
};

export const NestedDialogs: Story = {
  render: () => html`
    <div>
      <button @click=${openDialog}>Open settings</button>
      <lr-dialog>
        <h2 style="margin: 0 0 0.5rem;">Settings</h2>
        <p style="margin: 0;">
          Escape and Tab only ever act on the topmost open dialog -- confirming discard below
          leaves this settings dialog untouched underneath it until the confirm is answered.
        </p>
        <div slot="footer">
          <button
            @click=${async (e: Event) => {
              const ok = await confirm({ title: 'Discard unsaved changes?', tone: 'danger' });
              if (ok) ((e.target as HTMLElement).closest('lr-dialog') as LyraDialog).close('discard');
            }}
          >
            Close without saving
          </button>
        </div>
      </lr-dialog>
    </div>
  `,
};

export const ConfirmHelper: Story = {
  render: () => html`
    <div style="display:flex; gap:1rem;">
      <button
        @click=${async () => {
          const ok = await confirm({ title: 'Discard changes?', description: 'Unsaved edits will be lost.' });
          alert(ok ? 'Confirmed' : 'Cancelled');
        }}
      >
        Neutral confirm()
      </button>
      <button
        @click=${async () => {
          const ok = await confirm({
            title: 'Delete conversation?',
            description: 'This cannot be undone.',
            confirmLabel: 'Delete',
            tone: 'danger',
          });
          alert(ok ? 'Deleted' : 'Cancelled');
        }}
      >
        Danger confirm()
      </button>
    </div>
  `,
};
