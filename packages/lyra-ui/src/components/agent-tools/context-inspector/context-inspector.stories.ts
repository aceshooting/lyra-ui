import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './context-inspector.js';
import type { ContextInspectorSegment } from './context-inspector.js';

const meta: Meta = {
  title: 'ContextInspector',
  component: 'lr-context-inspector',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

const SEGMENTS: ContextInspectorSegment[] = [
  {
    id: 'system',
    label: 'System prompt',
    text: 'You are a helpful assistant. Answer using only the retrieved sources below, and cite them.',
    tokens: 28,
    tone: 'neutral',
  },
  {
    id: 'chunk-1',
    label: 'Retrieved chunk 1',
    text: 'Marie and Pierre Curie discovered radium and polonium in 1898 while investigating pitchblende ore.',
    tokens: 22,
    tone: 'success',
    citation: { id: 'c1', sourceId: 'doc-1', label: 'curie-bio.pdf, p. 3' },
  },
  {
    id: 'chunk-2',
    label: 'Retrieved chunk 2',
    text: 'The Curies’ laboratory notebooks remain radioactive to this day and are stored in lead-lined boxes...',
    tokens: 96,
    tone: 'warning',
    citation: { id: 'c2', sourceId: 'doc-2', label: 'archive-notes.pdf' },
    truncated: true,
    omittedTokens: 340,
  },
  {
    id: 'history',
    label: 'Conversation history',
    text: 'User previously asked: "who discovered radium?" — key=sk-REDACTED-1234 was mentioned by mistake.',
    tokens: 24,
    tone: 'brand',
    redactions: [{ start: 61, end: 82, reason: 'API key' }],
  },
];

export const Default: Story = {
  render: () => html`
    <lr-context-inspector
      label="8K context window"
      total="8000"
      .segments=${SEGMENTS}
    ></lr-context-inspector>
  `,
};

export const EmptyState: Story = {
  name: 'Empty (no segments)',
  render: () => html`<lr-context-inspector label="8K context window" total="8000"></lr-context-inspector>`,
};

export const ExportFormatMenu: Story = {
  name: 'Multiple export formats (menu)',
  render: () => html`
    <lr-context-inspector
      label="8K context window"
      total="8000"
      .segments=${SEGMENTS}
      .formats=${['json', 'csv']}
    ></lr-context-inspector>
  `,
};

/** Narrow-allocation evidence for the inspector embedded in a side panel or dialog. */
export const Narrow: Story = {
  name: 'Narrow (320px)',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-context-inspector
        label="8K context window"
        total="8000"
        .segments=${SEGMENTS}
      ></lr-context-inspector>
    </div>
  `,
};
