import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './policy-summary.js';
import type { PolicyDecision } from './policy-summary.class.js';

const meta: Meta = {
  title: 'PolicySummary',
  component: 'lr-policy-summary',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A read-only list of guardrail, permission, privacy, and tool-policy decisions, each with an allow/deny/needs-review state and an always-visible, accessible explanation.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const mixedDecisions: PolicyDecision[] = [
  {
    id: 'd1',
    category: 'guardrail',
    label: 'Self-harm content',
    state: 'allow',
    explanation: 'No self-harm content was detected in this response.',
  },
  {
    id: 'd2',
    category: 'permission',
    label: 'Read customer records',
    state: 'deny',
    explanation: 'This agent is not permitted to read customer PII in this workspace.',
    detail: 'Matched rule "no-pii-read" (policy v3). Evidence: field "ssn" requested on table "customers".',
  },
  {
    id: 'd3',
    category: 'privacy',
    label: 'Share precise location',
    state: 'needs-review',
    explanation: 'Sharing precise location requires a human reviewer before this can proceed.',
    detail: 'Rule "location-precision-gate" triggers above 10m accuracy; requested accuracy was 2m.',
  },
  {
    id: 'd4',
    category: 'tool',
    label: 'run_shell',
    state: 'deny',
    explanation: 'Shell execution is disabled for this session.',
  },
];

export const Default: Story = {
  render: () => html`<lr-policy-summary style="max-width:32rem" .decisions=${mixedDecisions}></lr-policy-summary>`,
};

export const AllAllowed: Story = {
  render: () =>
    html`<lr-policy-summary
      style="max-width:32rem"
      .decisions=${[
        { id: 'a1', category: 'guardrail', label: 'Hate speech', state: 'allow', explanation: 'No violations found.' },
        { id: 'a2', category: 'permission', label: 'Read public docs', state: 'allow', explanation: 'Within granted scope.' },
      ] satisfies PolicyDecision[]}
    ></lr-policy-summary>`,
};

export const Empty: Story = {
  render: () => html`<lr-policy-summary></lr-policy-summary>`,
};

export const Narrow320: Story = {
  name: 'Narrow (320px)',
  render: () =>
    html`<div style="max-width:320px"><lr-policy-summary .decisions=${mixedDecisions}></lr-policy-summary></div>`,
};

export const RightToLeft: Story = {
  name: 'RTL',
  render: () =>
    html`<div dir="rtl" style="max-width:32rem"><lr-policy-summary .decisions=${mixedDecisions}></lr-policy-summary></div>`,
};
