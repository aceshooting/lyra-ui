import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './commit-card.js';
import type { CommitFileChange } from './commit-card.class.js';

const meta: Meta = {
  title: 'Commit Card',
  component: 'lyra-commit-card',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

const files: CommitFileChange[] = [
  { path: 'src/app.ts', additions: 12, deletions: 3, status: 'modified' },
  { path: 'src/new-feature.ts', additions: 40, deletions: 0, status: 'added' },
];

export const Default: Story = {
  render: () => html`
    <lyra-commit-card
      style="max-width:28rem"
      hash="abcdef1234567890"
      message="Add streaming support

Rewrites the fetch layer to use ReadableStream."
      author="Ada Lovelace"
      .timestamp=${Date.now()}
      .files=${files}
    ></lyra-commit-card>
  `,
};

export const FilesExpanded: Story = {
  render: () => html`
    <lyra-commit-card
      style="max-width:28rem"
      hash="abcdef1234567890"
      message="Add streaming support"
      author="Ada Lovelace"
      .timestamp=${Date.now()}
      .files=${files}
      .filesCollapsed=${false}
    ></lyra-commit-card>
  `,
};

export const Narrow320: Story = {
  render: () => html`
    <div style="max-width:320px">
      <lyra-commit-card hash="abcdef1" message="Fix bug" author="Ada" .files=${files}></lyra-commit-card>
    </div>
  `,
};
