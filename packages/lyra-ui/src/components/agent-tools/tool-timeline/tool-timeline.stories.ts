import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import './tool-timeline.js';
import type { ToolTimelineEntry, ToolTimelineApprovalDetail } from './tool-timeline.js';

const meta: Meta = {
  title: 'ToolTimeline',
  component: 'lr-tool-timeline',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A chronological list of an agent run\'s tool calls, composing `<lr-tool-call-chip>` and `<lr-tool-result-view>` per entry plus one shared `<lr-tool-approval-dialog>` for entries gated behind a human decision. `entries` is sorted by `startedAt`; per-entry `redactedFields` mask sensitive `args`/`result`/`error` values in the detail view only — the approval dialog always sees the real, unmasked arguments.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

function mixedEntries(): ToolTimelineEntry[] {
  return [
    {
      id: 'call-1',
      name: 'search_web',
      category: 'research',
      args: { query: 'solar inverter efficiency 2026' },
      result: { resultCount: 8 },
      status: 'success',
      startedAt: Date.now() - 60_000,
      endedAt: Date.now() - 58_550,
    },
    {
      id: 'call-2',
      name: 'run_python',
      args: { code: 'sum(range(101))' },
      status: 'error',
      error: 'Sandbox timed out after 30s',
      startedAt: Date.now() - 45_000,
      endedAt: Date.now() - 15_000,
      retryCount: 2,
    },
    {
      id: 'call-3',
      name: 'send_email',
      args: { to: 'ops@example.com', subject: 'Nightly build failed' },
      status: 'pending',
      startedAt: Date.now() - 5_000,
      needsApproval: true,
    },
  ] satisfies ToolTimelineEntry[];
}

export const Default: Story = {
  render: () => html`<lr-tool-timeline .entries=${mixedEntries()} style="max-width:36rem;"></lr-tool-timeline>`,
};

export const RedactedFields: Story = {
  name: 'Redacted sensitive fields',
  parameters: {
    docs: {
      description: {
        story:
          'Fields named in `redactedFields` (dotted paths, or the bare `"args"`/`"result"`/`"error"` for a whole branch) render as "Value hidden" inside the entry\'s detail view once expanded.',
      },
    },
  },
  render: () => html`
    <lr-tool-timeline
      style="max-width:36rem;"
      .entries=${[
        {
          id: 'call-1',
          name: 'authenticate',
          args: { username: 'ops@example.com', apiKey: 'sk-live-abc123' },
          result: { token: 'eyJhbGciOi...', expiresIn: 3600 },
          status: 'success',
          startedAt: Date.now() - 10_000,
          endedAt: Date.now() - 9_700,
          redactedFields: ['args.apiKey', 'result.token'],
        },
      ] satisfies ToolTimelineEntry[]}
    ></lr-tool-timeline>
  `,
};

export const PendingApproval: Story = {
  name: 'Pending human approval',
  parameters: {
    docs: {
      description: {
        story:
          'An entry with `needsApproval: true` and no `approved` yet opens the shared approval dialog when its chip is clicked. Approving/denying fires this component\'s own `lr-tool-approval-decide`; the entry itself is left unchanged until the host re-assigns `entries` with the decision applied.',
      },
    },
  },
  render: () => html`
    <lr-tool-timeline
      style="max-width:36rem;"
      .entries=${[
        {
          id: 'call-1',
          name: 'delete_file',
          args: { path: '/workspace/report-draft.md' },
          status: 'pending',
          startedAt: Date.now() - 2_000,
          needsApproval: true,
        },
      ] satisfies ToolTimelineEntry[]}
      @lr-tool-approval-decide=${(e: CustomEvent<ToolTimelineApprovalDetail>) => {
        const out = document.getElementById('tool-timeline-approval-log');
        if (out) out.textContent = `lr-tool-approval-decide: ${JSON.stringify(e.detail)}`;
      }}
    ></lr-tool-timeline>
    <p id="tool-timeline-approval-log">No decision yet — click the chip above to review.</p>
  `,
};

export const AlreadyDecided: Story = {
  name: 'Already-decided entries',
  render: () => html`
    <lr-tool-timeline
      style="max-width:36rem;"
      .entries=${[
        {
          id: 'call-1',
          name: 'delete_file',
          args: { path: '/workspace/old-notes.md' },
          status: 'success',
          startedAt: Date.now() - 10_000,
          endedAt: Date.now() - 9_800,
          needsApproval: true,
          approved: true,
        },
        {
          id: 'call-2',
          name: 'drop_table',
          args: { table: 'sessions' },
          status: 'denied',
          startedAt: Date.now() - 5_000,
          endedAt: Date.now() - 4_900,
          needsApproval: true,
          approved: false,
        },
      ] satisfies ToolTimelineEntry[]}
    ></lr-tool-timeline>
  `,
};

export const EmptyState: Story = {
  name: 'No entries',
  render: () => html`<lr-tool-timeline style="max-width:36rem;"></lr-tool-timeline>`,
};

export const Narrow320: Story = {
  name: 'Narrow (320px, long expanded error)',
  render: () => {
    const timelineRef = createRef<HTMLElement>();
    setTimeout(() => {
      const details = timelineRef.value?.shadowRoot?.querySelector('lr-details') as
        | (HTMLElement & { open: boolean })
        | null;
      if (!details?.open) details?.shadowRoot?.querySelector<HTMLElement>('summary')?.click();
    });
    return html`
      <div style="inline-size:320px;max-inline-size:100%">
        <lr-tool-timeline
          ${ref(timelineRef)}
          .entries=${[
            {
              id: 'long-error',
              name: 'query_customer_database_readonly_with_a_long_identifier',
              args: { customer: 'enterprise-customer-with-a-long-correlation-identifier' },
              status: 'error',
              error:
                'The production customer database request exceeded the configured deadline while querying every regional source.',
              startedAt: Date.now() - 30_000,
              endedAt: Date.now(),
            },
          ] satisfies ToolTimelineEntry[]}
        ></lr-tool-timeline>
      </div>
    `;
  },
};
