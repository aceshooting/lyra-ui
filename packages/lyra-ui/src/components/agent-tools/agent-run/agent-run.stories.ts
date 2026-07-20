import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './agent-run.js';
import '../tool-call-chip/tool-call-chip.js';
import '../../conversation/markdown/markdown.js';
import type { AgentRun, AgentStep } from '../../../ai/types.js';

const meta: Meta = {
  title: 'AgentRun',
  component: 'lr-agent-run',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The top-level shell for one AgentRun: lifecycle-status badge, elapsed time, current step, model/cost summary, and built-in Cancel/Retry controls in a header, composing lr-generation-status, lr-usage-badge, and lr-task-list — plus four named slots (tasks/tools/reasoning/output) for the run\'s actual content.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const steps: AgentStep[] = [
  { id: 'step-1', kind: 'retriever', label: 'Read repository structure', status: { kind: 'done' } },
  { id: 'step-2', kind: 'tool', label: 'Search the web for recent changes', status: { kind: 'running' } },
  { id: 'step-3', kind: 'llm', label: 'Write summary', status: { kind: 'idle' } },
];

const runningRun: AgentRun = {
  id: 'run-1',
  status: { kind: 'running' },
  startedAt: Date.now() - 12_300,
  model: 'gpt-4o',
  costEstimate: 0.0123,
  steps,
};

export const Running: Story = {
  render: () => html`<lr-agent-run style="max-width: 40rem;" .run=${runningRun}></lr-agent-run>`,
};

export const WaitingForApproval: Story = {
  render: () => html`
    <lr-agent-run
      style="max-width: 40rem;"
      .run=${{
        ...runningRun,
        status: { kind: 'waiting-approval', message: 'Wants to run a shell command' },
      }}
    ></lr-agent-run>
  `,
};

export const QueuedAndCollecting: Story = {
  render: () => html`
    <div style="display:grid;gap:1rem;max-width:40rem;">
      <lr-agent-run
        .run=${{ ...runningRun, status: { kind: 'queued' } }}
        .statusLabels=${{ queued: 'Waiting for a worker' }}
        .statusVariants=${{ queued: 'warning' }}
      ></lr-agent-run>
      <lr-agent-run
        .run=${{ ...runningRun, status: { kind: 'collecting' } }}
        .metrics=${[
          { id: 'input', label: 'Input tokens', value: 1240 },
          { id: 'output', label: 'Output tokens', value: 0 },
        ]}
      ></lr-agent-run>
    </div>
  `,
};

export const ReplaceableChrome: Story = {
  render: () => html`
    <lr-agent-run style="max-width: 40rem;" .run=${runningRun}>
      <div slot="header">Custom lifecycle header</div>
      <div slot="summary">Custom metrics summary</div>
    </lr-agent-run>
  `,
};

export const Done: Story = {
  render: () => html`
    <lr-agent-run
      style="max-width: 40rem;"
      .run=${{
        ...runningRun,
        status: { kind: 'done' },
        startedAt: Date.now() - 45_000,
        endedAt: Date.now(),
        steps: steps.map((s) => ({ ...s, status: { kind: 'done' as const } })),
      }}
    ></lr-agent-run>
  `,
};

export const Failed: Story = {
  render: () => html`
    <lr-agent-run
      style="max-width: 40rem;"
      .run=${{
        ...runningRun,
        status: { kind: 'error', message: 'Rate limited by the model provider' },
        startedAt: Date.now() - 8_000,
        endedAt: Date.now(),
      }}
    ></lr-agent-run>
  `,
};

export const WithToolsReasoningAndOutput: Story = {
  name: 'Composed with tools/reasoning/output slots',
  render: () => html`
    <lr-agent-run style="max-width: 40rem;" .run=${runningRun}>
      <lr-tool-call-chip
        slot="tools"
        name="web_search"
        status="running"
        summary="Searching for recent changes…"
      ></lr-tool-call-chip>
      <p slot="reasoning" style="margin: 0; font-size: 0.875rem; color: var(--lr-color-text-quiet);">
        The user wants a summary of recent changes, so I should search first, then read the
        repository structure before writing anything.
      </p>
      <lr-markdown slot="output" content="Here is a draft summary of the recent changes."></lr-markdown>
    </lr-agent-run>
  `,
};

export const CustomTasksSlot: Story = {
  name: 'Host-overridden tasks slot',
  render: () => html`
    <lr-agent-run style="max-width: 40rem;" .run=${runningRun}>
      <div slot="tasks" style="font-size: 0.875rem; color: var(--lr-color-text-quiet);">
        Custom plan rendering supplied by the host application.
      </div>
    </lr-agent-run>
  `,
};

export const ReadOnly: Story = {
  name: 'Read-only (no Cancel/Retry)',
  render: () => html`
    <lr-agent-run
      style="max-width: 40rem;"
      .run=${{ ...runningRun, status: { kind: 'error' } }}
      show-cancel="false"
      show-retry="false"
    ></lr-agent-run>
  `,
};

export const RightToLeft: Story = {
  name: 'Right-to-left',
  render: () => html`
    <lr-agent-run
      dir="rtl"
      style="max-width: 40rem;"
      .run=${{
        ...runningRun,
        model: 'نموذج-4',
        steps: [{ id: 'step-1', kind: 'tool', label: 'البحث في الويب عن التغييرات الأخيرة', status: { kind: 'running' } }],
      }}
    ></lr-agent-run>
  `,
};

export const Narrow320: Story = {
  name: 'Narrow (320px)',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-agent-run .run=${runningRun}></lr-agent-run>
    </div>
  `,
};

export const Empty: Story = {
  name: 'No run (empty state)',
  render: () => html`<lr-agent-run style="max-width: 40rem;"></lr-agent-run>`,
};

export const Live: Story = {
  name: 'Live demo — cancel/retry wired up',
  render: () => {
    function wire(root: HTMLElement): void {
      const el = root.querySelector('lr-agent-run')!;
      if (el.hasAttribute('data-wired')) return;
      el.setAttribute('data-wired', '');
      const log = root.querySelector('[data-log]')!;
      el.addEventListener('lr-cancel', () => {
        log.textContent = 'lr-cancel fired';
      });
      el.addEventListener('lr-retry', (e) => {
        log.textContent = `lr-retry fired, attempt ${(e as CustomEvent).detail.attempt}`;
      });
    }
    return html`
      <div
        style="display:flex; flex-direction:column; gap:0.75rem; align-items:flex-start; max-width: 40rem;"
        @click=${(e: Event) => wire(e.currentTarget as HTMLElement)}
      >
        <lr-agent-run .run=${{ ...runningRun, status: { kind: 'error' } }} style="width: 100%;"></lr-agent-run>
        <p data-log style="margin: 0; font-size: 0.8125rem; color: var(--lr-color-text-quiet);">
          Click Retry to see the emitted event detail here.
        </p>
      </div>
    `;
  },
};

export const DensityAndChrome: Story = {
  name: 'compact + appearance="plain"',
  render: () => html`
    <div style="display:grid; gap:1rem; max-width:40rem;">
      <lr-agent-run .run=${runningRun}></lr-agent-run>
      <lr-agent-run compact .run=${runningRun}></lr-agent-run>
      <div style="border:1px solid var(--lr-color-border); border-radius:var(--lr-radius); padding:0.75rem;">
        <lr-agent-run appearance="plain" .run=${runningRun}></lr-agent-run>
      </div>
    </div>
  `,
  parameters: {
    docs: {
      description: {
        story:
          'Top to bottom: the default card, `compact` (tighter padding and gap, chrome intact), and `appearance="plain"` nested inside a container that already draws its own border — without `plain` the two frames would double up.',
      },
    },
  },
};
