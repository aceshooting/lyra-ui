import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './research-progress.js';
import type { ResearchStep } from './research-progress.class.js';

const meta: Meta = {
  title: 'Retrieval/Research Progress',
  component: 'lr-research-progress',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'A read-only, provider-neutral view of host-owned research steps and their aggregate completion. The host supplies every status and source count.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const steps: ResearchStep[] = [
  { id: 'search', label: 'Search the knowledge library', description: 'Find material relevant to the question.', status: 'completed', sources: 8 },
  { id: 'read', label: 'Review selected sources', description: 'Compare claims and evidence.', status: 'running', sources: 3 },
  { id: 'synthesize', label: 'Synthesize findings', status: 'pending' },
  { id: 'verify', label: 'Verify citations', status: 'pending' },
];

export const Running: Story = {
  render: () => html`<lr-research-progress style="max-inline-size: 42rem" .steps=${steps}></lr-research-progress>`,
};

export const Incomplete: Story = {
  render: () => html`<lr-research-progress
    style="max-inline-size: 42rem"
    .steps=${steps.map((step) => (step.status === 'running' ? { ...step, status: 'incomplete' as const } : step))}
  ></lr-research-progress>`,
};

export const UnknownStatus: Story = {
  render: () => html`<lr-research-progress style="max-inline-size: 42rem"
    .steps=${[{ id: 'review', label: 'Review provider result', status: 'awaiting-review' }] as unknown as ResearchStep[]}
  ></lr-research-progress>`,
};

export const Empty: Story = {
  render: () => html`<lr-research-progress style="max-inline-size: 42rem"></lr-research-progress>`,
};

export const NarrowRtl: Story = {
  render: () => html`
    <lr-research-progress dir="rtl" style="inline-size: 320px" .steps=${[
      { id: 'review', label: 'مراجعة المصادر والأدلة المتاحة '.repeat(5), description: 'تحليل ومقارنة '.repeat(12), status: 'running' as const, sources: 24 },
    ]}></lr-research-progress>
  `,
};
