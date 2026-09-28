import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './change-review.js';
import type { ChangeReviewFile, LyraChangeReview } from './change-review.class.js';
const meta: Meta = { title: 'ChangeReview', component: 'lr-change-review', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;
const files: readonly ChangeReviewFile[] = [
  { id: 'config', path: 'src/config.ts', hunks: [{ id: 'timeout', label: 'Increase request timeout', before: 'export const timeout = 1000;', after: 'export const timeout = 3000;' }] },
  { id: 'readme', path: 'docs/setup.md', previousPath: 'SETUP.md', hunks: [{ id: 'command', before: 'Run npm install.', after: 'Run pnpm install.', decision: 'keep' }] },
];
function acknowledge(event: CustomEvent<{ fileId: string; hunkId: string; decision: 'keep' | 'discard' }>): void {
  const review = event.currentTarget as LyraChangeReview;
  review.files = review.files.map((file) => file.id === event.detail.fileId
    ? { ...file, hunks: file.hunks.map((hunk) => hunk.id === event.detail.hunkId ? { ...hunk, decision: event.detail.decision } : hunk) }
    : file);
}
export const Default: Story = { render: () => html`<lr-change-review .files=${files} @lr-change-decision=${acknowledge}></lr-change-review>` };
export const Readonly: Story = { render: () => html`<lr-change-review readonly .files=${files}></lr-change-review>` };
export const NarrowRTL: Story = { render: () => html`<div dir="rtl" style="inline-size: 320px; max-inline-size: 100%;"><lr-change-review .files=${files} @lr-change-decision=${acknowledge}></lr-change-review></div>` };
