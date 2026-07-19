import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import type { AgentRun, ChatMessage } from '../../ai/types.js';
import './agent-workspace.js';
import '../button/button.js';

const messages: ChatMessage[] = [
  { id: 'm-1', role: 'user', text: 'What changed in the latest release?' },
  { id: 'm-2', role: 'assistant', text: 'I found the relevant release notes and summarized the changes.' },
];

const run: AgentRun = {
  id: 'run-1',
  status: { kind: 'collecting', message: 'Collecting context' },
  model: 'lyra-reasoner',
  startedAt: Date.now() - 12_000,
  steps: [
    { id: 'retrieve', kind: 'retrieval', label: 'Retrieve release notes', status: { kind: 'done' } },
    { id: 'summarize', kind: 'generation', label: 'Summarize changes', status: { kind: 'running' } },
  ],
};

const meta: Meta = {
  title: 'AI/Agent Workspace',
  component: 'lr-agent-workspace',
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <div style="height: 720px; padding: var(--lr-space-m);">
      <lr-agent-workspace
        label="Release assistant"
        .messages=${messages}
        .run=${run}
        .metrics=${[
          { id: 'input-tokens', label: 'Input tokens', value: 1_240 },
          { id: 'output-tokens', label: 'Output tokens', value: 286 },
        ]}
        .tools=${[{ id: 'tool-1', name: 'release-search', args: { version: 'latest' }, status: 'success' }]}
        .retrievalChunks=${[
          { id: 'chunk-1', text: 'Release notes passage', score: 0.94, source: { id: 'doc-1', name: 'CHANGELOG.md' } },
        ]}
        .groundingAssessment=${{ supportedClaims: 3, unsupportedClaims: 0, coverage: 1, confidence: 0.96 }}
      ></lr-agent-workspace>
    </div>
  `,
};

export const NarrowAllocation: Story = {
  render: () => html`
    <div style="inline-size: 360px; height: 640px;">
      <lr-agent-workspace label="Narrow assistant" .messages=${messages} .run=${run}></lr-agent-workspace>
    </div>
  `,
};

export const CustomSlots: Story = {
  render: () => html`
    <div style="height: 560px;">
      <lr-agent-workspace .messages=${messages} .run=${run}>
        <div slot="header-actions">
          <lr-button size="s" variant="neutral">Export</lr-button>
        </div>
        <div slot="details" style="padding: var(--lr-space-m);">Application-specific run inspector</div>
        <div slot="composer">Application-specific composer</div>
      </lr-agent-workspace>
    </div>
  `,
};
