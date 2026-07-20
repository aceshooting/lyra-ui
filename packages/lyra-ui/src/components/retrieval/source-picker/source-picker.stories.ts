import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './source-picker.js';
import type { LyraSourceEntry } from './source-picker.class.js';
import { storyColor } from '../../../../../../.storybook/story-theme.js';

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
  // `.showSelectAll`/`.searchable` (property bindings), not `?show-select-all=`/`?searchable=` --
  // both default to `true`, and a boolean-attribute binding that evaluates to `false` on a
  // freshly-created element never actually removes an attribute that was never present, so
  // `attributeChangedCallback` never fires and the constructor-time default would silently win.
  render: () => html`<lr-source-picker .sources=${sources} .showSelectAll=${false} .searchable=${false}></lr-source-picker>`,
};

export const Empty: Story = {
  render: () => html`<lr-source-picker></lr-source-picker>`,
};

export const Narrow: Story = {
  render: () => html`<div style="max-width: 320px;"><lr-source-picker .sources=${sources}></lr-source-picker></div>`,
};

export const ThemedCheckedState: Story = {
  name: 'Themed checked/mixed state (cssprops)',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-source-picker-checked-bg`, `--lr-source-picker-checked-border` and `--lr-source-picker-mixed-bg` retint the selection controls without hijacking library-wide `--lr-color-brand`/`--lr-color-brand-quiet`. None is declared on `:host`, so a value set on any ancestor is never shadowed. The select-all pill carries its own label text in `--lr-color-text`, so keep 4.5:1 against whatever background you choose.',
      },
    },
  },
  render: () => html`
    <lr-source-picker
      style="--lr-source-picker-checked-bg: ${storyColor('warningQuiet')}; --lr-source-picker-checked-border: ${storyColor('warning')}; --lr-source-picker-mixed-bg: ${storyColor('successQuiet')};"
      .sources=${sources}
      .selectedIds=${['doc1']}
    ></lr-source-picker>
  `,
};
