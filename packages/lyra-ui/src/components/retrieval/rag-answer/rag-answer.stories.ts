import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './rag-answer.js';
const meta: Meta = { title: 'RagAnswer', component: 'lr-rag-answer', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;
export const Default: Story = { render: () => html`<lr-rag-answer answer="The retrieval pipeline found a grounded answer." .citations=${[{ id: 'c1', sourceId: 'd1' }]} .sources=${[{ id: 'd1', name: 'runbook.md', mimeType: 'text/markdown' }]} .assessment=${{ supportedClaims: 1, unsupportedClaims: 0, coverage: 1 }}></lr-rag-answer>` };
export const Loading: Story = { render: () => html`<lr-rag-answer loading></lr-rag-answer>` };
