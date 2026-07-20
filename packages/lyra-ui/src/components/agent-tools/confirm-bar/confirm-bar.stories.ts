import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './confirm-bar.js';

const meta: Meta = {
  title: 'ConfirmBar',
  component: 'lr-confirm-bar',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'An inline, non-modal approve/deny block for one proposed action — the in-flow sibling of lr-tool-approval-dialog for confirmations that should sit in the transcript instead of hijacking focus.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-confirm-bar tool-name="run_shell" .args=${{ command: 'rm -rf build/' }}></lr-confirm-bar>`,
};

export const DangerTone: Story = {
  render: () =>
    html`<lr-confirm-bar
      tone="danger"
      tool-name="delete_database"
      .args=${{ database: 'production' }}
    ></lr-confirm-bar>`,
};

export const FreeFormHeading: Story = {
  render: () => html`<lr-confirm-bar heading="Send this email to the customer?"></lr-confirm-bar>`,
};

export const NoArgs: Story = {
  render: () => html`<lr-confirm-bar tool-name="clear_cache"></lr-confirm-bar>`,
};

export const WithSupplementaryBody: Story = {
  render: () => html`
    <lr-confirm-bar tool-name="apply_patch" .args=${{ file: 'src/index.ts' }}>
      <p style="margin:0;">Adds a null check before the array access on line 42.</p>
    </lr-confirm-bar>
  `,
};

export const AlreadyDecided: Story = {
  render: () => html`<lr-confirm-bar tool-name="run_shell" decision="approved"></lr-confirm-bar>`,
};

/** `lr-approve`/`lr-deny` are cancelable: a listener that calls `preventDefault()` and keeps its
 *  own async work in flight sets `pending` to show a `loading` button and a `disabled` sibling,
 *  instead of the bar resolving synchronously. */
export const AsyncPending: Story = {
  name: 'Async pending decision',
  render: () => html`
    <lr-confirm-bar
      tool-name="send_email"
      .args=${{ to: 'ops@example.com' }}
      @lr-approve=${(e: CustomEvent) => {
        e.preventDefault();
        const bar = (e.currentTarget as HTMLElement).closest('lr-confirm-bar') as HTMLElement & {
          pending: string | null;
          decision: string | null;
        };
        setTimeout(() => {
          bar.decision = 'approved';
        }, 1500);
      }}
    ></lr-confirm-bar>
  `,
};

/** `compact` collapses the bar from a full card to a chrome-less inline row, for a confirmation
 *  that has to live inside an existing container. The narrow-allocation container query is switched
 *  off with it — a compact bar is *expected* to be narrow, so stretching the buttons to fill would
 *  be exactly wrong. */
export const Compact: Story = {
  render: () => html`
    <div style="display:flex;align-items:center;gap:0.75rem;max-inline-size:32rem;">
      <lr-confirm-bar compact tone="danger" heading="Delete row 42?"></lr-confirm-bar>
    </div>
  `,
};

/** The motivating case: a confirmation inside a table cell. Without `compact` the bar's own border,
 *  padding and `display: block` surface blow the row apart. */
export const CompactInTableCell: Story = {
  name: 'compact (inside a table cell)',
  render: () => html`
    <table style="border-collapse:collapse;font:inherit;">
      <thead>
        <tr>
          <th style="text-align:start;padding:0.4rem 0.75rem;">Tool call</th>
          <th style="text-align:start;padding:0.4rem 0.75rem;">Decision</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-block-start:1px solid var(--lr-color-border);">
          <td style="padding:0.4rem 0.75rem;"><code>run_shell</code></td>
          <td style="padding:0.4rem 0.75rem;">
            <lr-confirm-bar compact heading="Run?"></lr-confirm-bar>
          </td>
        </tr>
        <tr style="border-block-start:1px solid var(--lr-color-border);">
          <td style="padding:0.4rem 0.75rem;"><code>delete_database</code></td>
          <td style="padding:0.4rem 0.75rem;">
            <lr-confirm-bar compact tone="danger" heading="Delete?"></lr-confirm-bar>
          </td>
        </tr>
      </tbody>
    </table>
  `,
};

/** Compact still accepts chrome back through the `--lr-confirm-bar-compact-*` properties, e.g. to
 *  sit as a tinted pill inside a card's action row. */
export const CompactRechromed: Story = {
  name: 'compact (re-chromed via cssprops)',
  render: () => html`
    <lr-confirm-bar
      compact
      heading="Apply the suggested patch?"
      style="--lr-confirm-bar-compact-padding:0.35rem 0.6rem;--lr-confirm-bar-compact-background:var(--lr-color-brand-quiet);--lr-confirm-bar-compact-radius:var(--lr-radius);"
    ></lr-confirm-bar>
  `,
};

export const Narrow320px: Story = {
  render: () => html`
    <div style="max-width:320px;border:1px dashed var(--lr-color-border);padding:8px;">
      <lr-confirm-bar tool-name="run_shell" .args=${{ command: 'npm test' }}></lr-confirm-bar>
    </div>
  `,
};
