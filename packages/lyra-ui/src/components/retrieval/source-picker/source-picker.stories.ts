import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './source-picker.js';
import type { LyraSourceEntry } from './source-picker.class.js';

const meta: Meta = {
  title: 'Source Picker',
  component: 'lr-source-picker',
};
export default meta;
type Story = StoryObj;

const sources: LyraSourceEntry[] = [
  {
    id: 'folder1',
    label: 'Research papers',
    children: [
      { id: 'doc1', label: 'curie-bio.pdf', mimeType: 'application/pdf' },
      { id: 'doc2', label: 'nobel-list.csv', mimeType: 'text/csv' },
    ],
  },
  { id: 'doc3', label: 'notes.txt', mimeType: 'text/plain' },
];

export const Default: Story = {
  render: () => html`<lr-source-picker .sources=${sources} @lr-sources-change=${(e: CustomEvent) => console.log(e.detail)}></lr-source-picker>`,
};

export const WithSelection: Story = {
  render: () => html`<lr-source-picker .sources=${sources} .selectedIds=${['doc1']}></lr-source-picker>`,
};

export const NoSelectAllNoSearch: Story = {
  render: () => html`<lr-source-picker .sources=${sources} ?show-select-all=${false} ?searchable=${false}></lr-source-picker>`,
};

export const Empty: Story = {
  render: () => html`<lr-source-picker></lr-source-picker>`,
};

export const Narrow: Story = {
  render: () => html`<div style="max-width: 320px;"><lr-source-picker .sources=${sources}></lr-source-picker></div>`,
};
