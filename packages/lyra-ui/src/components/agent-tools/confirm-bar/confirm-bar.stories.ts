import { html } from 'lit';
import { ref } from 'lit/directives/ref.js';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import '../../forms/button/button.js';
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

/** The declarative async path: `lr-approve`/`lr-deny`'s detail carries `waitUntil(promise)`,
 *  ExtendableEvent-style. Calling it holds the bar pending for the promise's lifetime and the
 *  settlement finalizes the decision — no `preventDefault()`, no cast of `currentTarget`, no manual
 *  `pending` bookkeeping. Deny here rejects, so the bar bounces back for a retry. */
export const WaitUntil: Story = {
  name: 'waitUntil (declarative async decision)',
  render: () => html`
    <lr-confirm-bar
      tool-name="send_email"
      .args=${{ to: 'ops@example.com' }}
      @lr-approve=${(e: CustomEvent<{ waitUntil: (p: Promise<unknown>) => void }>) => {
        e.detail.waitUntil(new Promise((resolve) => setTimeout(resolve, 1500)));
      }}
      @lr-deny=${(e: CustomEvent<{ waitUntil: (p: Promise<unknown>) => void }>) => {
        e.detail.waitUntil(
          new Promise((_, reject) => setTimeout(() => reject(new Error('Mailbox locked')), 1500)),
        );
      }}
    ></lr-confirm-bar>
  `,
};

/** `returnFocusTo` names where focus belongs once the decision lands, instead of the bar's own
 *  `[part="status"]`. The motivating case: a host reveals an inline confirmation in response to a
 *  focused control, so after Approve or Deny focus goes back to that control rather than to a status
 *  line the host is about to hide. `lr-decision-settled` is the "the status has rendered and been
 *  announced" signal that makes hiding it again safe. */
export const ReturnFocus: Story = {
  name: 'returnFocusTo + lr-decision-settled',
  render: () => html`
    <div style="display:flex;align-items:center;gap:0.75rem;">
      <lr-button
        id="return-demo-trigger"
        variant="danger"
        @click=${(e: Event) => {
          const trigger = e.currentTarget as HTMLElement;
          const bar = trigger.parentElement!.querySelector('lr-confirm-bar') as HTMLElement & {
            decision: string | null;
            returnFocusTo: HTMLElement | null;
          };
          bar.decision = null;
          bar.returnFocusTo = trigger;
          bar.hidden = false;
        }}
        >Delete project</lr-button
      >
      <lr-confirm-bar
        hidden
        compact
        frame="plain"
        variant="danger"
        heading="Delete this project?"
        @lr-decision-settled=${(e: CustomEvent<{ decision: string }>) => {
          (e.currentTarget as HTMLElement).hidden = true;
        }}
      ></lr-confirm-bar>
    </div>
  `,
};

/** The motivating case as a genuine conditional swap rather than a `hidden` toggle: the trigger is
 *  removed outright (not just hidden) when the bar mounts, and the host re-creates a brand-new
 *  trigger element only after the decision has settled -- asynchronously, from `lr-decision-settled`.
 *  `returnFocusTo` names that not-yet-existing replacement by id; because the handoff retries once
 *  the host has had a chance to react, focus lands on the real, freshly-created button instead of
 *  falling back to `<body>`. */
export const ReturnFocusConditionalSwap: Story = {
  name: 'returnFocusTo across a full conditional swap',
  render: () => {
    function mountTrigger(root: HTMLElement): void {
      const trigger = document.createElement('lr-button');
      trigger.setAttribute('variant', 'danger');
      trigger.id = 'swap-trigger';
      trigger.textContent = 'Delete project';
      trigger.addEventListener('click', () => {
        root.textContent = '';
        const bar = document.createElement('lr-confirm-bar');
        bar.setAttribute('variant', 'danger');
        bar.setAttribute('heading', 'Delete this project?');
        // The element this names does not exist yet -- the host only re-creates it below, from
        // `lr-decision-settled`, which fires after the decision has already landed.
        bar.returnFocusTo = () => root.querySelector<HTMLElement>('#swap-trigger');
        bar.addEventListener('lr-decision-settled', () => {
          // A stand-in for a reactive host's own async re-render (Lit/React/Vue/Svelte all commit
          // this kind of state-driven swap on a later microtask/frame, never synchronously inside
          // the event that decided it).
          queueMicrotask(() => {
            root.textContent = '';
            mountTrigger(root);
          });
        });
        root.appendChild(bar);
      });
      root.textContent = '';
      root.appendChild(trigger);
    }
    return html`<div
      style="display:flex;align-items:center;gap:0.75rem;"
      ${ref((el) => {
        if (el instanceof HTMLElement) mountTrigger(el);
      })}
    ></div>`;
  },
};

export const RestingBackgroundToken: Story = {
  name: 'Retinting the resting bar',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-confirm-bar-bg` is the resting companion to the `compact` tier\'s existing padding/gap levers, so an embedded approval prompt can be retinted without a `::part(base)` rule or an app-wide `--lr-color-surface` change. `frame="plain"` still drops the fill entirely.',
      },
    },
  },
  render: () => html`
    <lr-confirm-bar
      tool-name="delete_row"
      heading="Delete this row?"
      style="--lr-confirm-bar-bg: var(--lr-color-brand-quiet)"
    ></lr-confirm-bar>
  `,
};
