import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './source-picker.js';
import type { LyraSourceEntry } from './source-picker.class.js';

const meta: Meta = {
  title: 'Source Picker',
  component: 'lyra-source-picker',
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
  render: () => html`<lyra-source-picker .sources=${sources} @lyra-sources-change=${(e: CustomEvent) => console.log(e.detail)}></lyra-source-picker>`,
};

export const WithSelection: Story = {
  render: () => html`<lyra-source-picker .sources=${sources} .selectedIds=${['doc1']}></lyra-source-picker>`,
};

export const NoSelectAllNoSearch: Story = {
  render: () => html`<lyra-source-picker .sources=${sources} ?show-select-all=${false} ?searchable=${false}></lyra-source-picker>`,
};

export const Empty: Story = {
  render: () => html`<lyra-source-picker></lyra-source-picker>`,
};

export const Narrow: Story = {
  render: () => html`<div style="max-width: 320px;"><lyra-source-picker .sources=${sources}></lyra-source-picker></div>`,
};
