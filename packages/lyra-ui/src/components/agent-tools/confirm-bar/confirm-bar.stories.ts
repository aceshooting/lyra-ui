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

export const DangerVariant: Story = {
  render: () =>
    html`<lr-confirm-bar
      variant="danger"
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

/** `compact` collapses the bar into a single dense inline row, for a confirmation that has to live
 *  inside an existing container. It is density only — the card border, radius and background stay.
 *  The narrow-allocation container query is switched off with it: a compact bar is *expected* to be
 *  narrow, so stretching the buttons to fill would be exactly wrong. */
export const Compact: Story = {
  render: () => html`
    <div style="display:flex;align-items:center;gap:0.75rem;max-inline-size:32rem;">
      <lr-confirm-bar compact variant="danger" heading="Delete row 42?"></lr-confirm-bar>
    </div>
  `,
};

/** `frame="plain"` is the separate chrome knob: border, radius, background and padding all go, so a
 *  bar nested inside a container that already draws a border doesn't double it. */
export const FramePlain: Story = {
  name: 'frame="plain"',
  render: () => html`
    <div style="border:1px solid var(--lr-color-border);border-radius:var(--lr-radius);padding:0.75rem;max-inline-size:32rem;">
      <lr-confirm-bar frame="plain" heading="Apply the suggested patch?"></lr-confirm-bar>
    </div>
  `,
};

/** The motivating case: a confirmation inside a table cell, where both knobs are wanted at once.
 *  Without `compact` the bar's stacked `display: block` surface blows the row apart, and without
 *  `frame="plain"` its own border and background double the cell's. */
export const CompactInTableCell: Story = {
  name: 'compact + frame="plain" (inside a table cell)',
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
            <lr-confirm-bar compact frame="plain" heading="Run?"></lr-confirm-bar>
          </td>
        </tr>
        <tr style="border-block-start:1px solid var(--lr-color-border);">
          <td style="padding:0.4rem 0.75rem;"><code>delete_database</code></td>
          <td style="padding:0.4rem 0.75rem;">
            <lr-confirm-bar compact frame="plain" variant="danger" heading="Delete?"></lr-confirm-bar>
          </td>
        </tr>
      </tbody>
    </table>
  `,
};

/** The compact density itself is retunable through `--lr-confirm-bar-compact-padding`/`-gap`, e.g.
 *  to sit as a tighter pill inside a card's action row. */
export const CompactRetuned: Story = {
  name: 'compact (retuned density)',
  render: () => html`
    <lr-confirm-bar
      compact
      heading="Apply the suggested patch?"
      style="--lr-confirm-bar-compact-padding:0.35rem 0.6rem;--lr-confirm-bar-compact-gap:0.4rem;"
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
