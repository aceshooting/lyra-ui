import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import type { AgentRun, ChatMessage } from '../../../ai/types.js';
import './agent-workspace.js';
import '../../forms/button/button.js';

const messages: ChatMessage[] = [
  { id: 'm-1', role: 'user', text: 'What changed in the latest release?' },
  { id: 'm-2', role: 'assistant', text: 'I found the relevant release notes and summarized the changes.' },
];

const narrowLongContent = 'LocalizedAgentWorkspaceContentWithoutNaturalBreaks'.repeat(4);
const narrowLongMessages: ChatMessage[] = [
  { id: 'narrow-long', role: 'assistant', text: narrowLongContent },
];

const structuredMessages: ChatMessage[] = [
  {
    id: 'm-structured',
    role: 'assistant',
    text: 'This legacy text is superseded by the ordered parts below.',
    parts: [
      { id: 'reasoning', type: 'reasoning', text: 'Checking the release notes', state: 'complete' },
      { id: 'answer', type: 'text', text: 'The structured answer appears after the reasoning step.', state: 'complete' },
    ],
    metadata: { model: 'lyra-reasoner', source: 'release-notes' },
  },
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

/** A nonempty `parts` array takes precedence over the legacy `text` shortcut. */
export const StructuredParts: Story = {
  render: () => html`
    <div style="height: 480px; padding: var(--lr-space-m);">
      <lr-agent-workspace label="Structured response" .messages=${structuredMessages}></lr-agent-workspace>
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

/** 320px allocation with long localized chrome, an action, unbroken transcript content, and the built-in composer. */
export const NarrowLongContent: Story = {
  name: 'Narrow long content (320px)',
  render: () => html`
    <div style="inline-size:320px; max-inline-size:100%; block-size:640px;">
      <lr-agent-workspace
        .messages=${narrowLongMessages}
        .strings=${{
          agentWorkspaceLabel: narrowLongContent,
          composerPlaceholder: narrowLongContent,
        }}
      >
        <lr-button slot="header-actions" size="s" variant="neutral">${narrowLongContent}</lr-button>
      </lr-agent-workspace>
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
