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
          'A general-purpose modal. `label` renders as a visible title and the close button is present by default; slot body content into the default slot and actions into `footer`.',
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
      <lr-dialog label="Project settings">
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
    <lr-dialog .open=${context.viewMode !== 'docs'} label="Rendered already open">
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
  name: 'Visible mapped label',
  render: () => html`
    <div>
      <button @click=${openDialog}>Open dialog</button>
      <lr-dialog label="Delete this item?">
        <p style="margin: 0;">
          The <code>label</code> property visibly renders in the mapped title row and names the
          dialog. Use <code>accessible-label</code> for an accessible-only override.
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

export const AccessibleNameWithVisibleHeading: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A host `aria-label` overrides the panel’s announced name without suppressing the visible `heading` property.',
      },
    },
  },
  render: (_args, context) => html`
    <lr-dialog
      .open=${context.viewMode !== 'docs'}
      heading="Visible account settings"
      aria-label="Account settings dialog"
      closable
    >
      <p>The visible heading remains present while assistive technology receives the explicit host name.</p>
    </lr-dialog>
  `,
};

export const NestedDialogs: Story = {
  render: () => html`
    <div>
      <button @click=${openDialog}>Open settings</button>
      <lr-dialog label="Settings">
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

export const NarrowLongContent: Story = {
  render: (_args, context) => html`<div style="inline-size: 20rem; min-block-size: 34rem;">
    <lr-dialog .open=${context.viewMode !== 'docs'} heading="A deliberately long dialog heading that wraps at 320px" closable>
      <p>Long content remains readable when the allocation is narrow. This paragraph is intentionally verbose so the dialog must scroll rather than overflow its panel.</p>
      <p>Repeatable details, validation messages, and action labels should remain usable at the smallest supported allocation.</p>
      <div slot="footer"><button type="button">Cancel changes</button><button type="button">Save and continue</button></div>
    </lr-dialog>
  </div>`,
};

export const HeaderSlots: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The `label` slot supplies rich header content (and the accessible name) where the plain-string `heading` property is not enough; `header-actions` adds controls beside the built-in close button. `--lr-dialog-spacing` retunes the padding of all three regions and `--lr-dialog-backdrop-filter` frosts the scrim.',
      },
    },
  },
  render: (_args, context) => html`
    <lr-dialog
      .open=${context.viewMode !== 'docs'}
      closable
      style="--lr-dialog-spacing: 1.25rem; --lr-dialog-backdrop-filter: blur(3px);"
    >
      <span slot="label">Project <strong>settings</strong></span>
      <button slot="header-actions" type="button">Help</button>
      <p style="margin: 0;">Rich header content, an extra header action, and a frosted backdrop.</p>
    </lr-dialog>
  `,
};

export const WithoutHeader: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`no-header` (and the Web Awesome/legacy `without-header` alias) drops the header row entirely. Pair custom chrome with `accessible-label`, a host `aria-label`, or a direct heading.',
      },
    },
  },
  render: (_args, context) => html`
    <lr-dialog
      .open=${context.viewMode !== 'docs'}
      heading="Never rendered"
      no-header
      accessible-label="Custom chrome"
    >
      <p style="margin: 0;">No header row is rendered even though heading and closable are both set.</p>
    </lr-dialog>
  `,
};

export const InitialFocusVeto: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`lr-initial-focus` fires once immediately before automatic focus movement. Cancel it when application state has already placed focus deliberately; the trap and eventual focus return remain active.',
      },
    },
  },
  render: () => html`
    <div>
      <button @click=${openDialog}>Open without moving focus</button>
      <lr-dialog label="Focus stays outside" @lr-initial-focus=${(event: Event) => event.preventDefault()}>
        <button type="button">First dialog action</button>
      </lr-dialog>
    </div>
  `,
};

export const AutofocusAndLifecycle: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`[autofocus]` on slotted content wins over the default "first focusable element" rule. `lr-show`/`lr-hide` are cancelable, and `lr-after-show`/`lr-after-hide` fire once the enter/exit animation has finished.',
      },
    },
  },
  render: () => html`
    <div>
      <button @click=${openDialog}>Open dialog</button>
      <lr-dialog
        heading="Rename project"
        closable
        @lr-after-show=${() => console.info('lr-after-show')}
        @lr-after-hide=${() => console.info('lr-after-hide')}
      >
        <label>Cancel first, but the field takes focus: <input autofocus /></label>
        <div slot="footer">
          <button @click=${(e: Event) => ((e.target as HTMLElement).closest('lr-dialog') as LyraDialog).hide()}>
            Cancel
          </button>
        </div>
      </lr-dialog>
    </div>
  `,
};
