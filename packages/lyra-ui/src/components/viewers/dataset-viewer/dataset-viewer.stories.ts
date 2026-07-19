import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './dataset-viewer.js';

const meta: Meta = { title: 'DocumentViewer/DatasetViewer', component: 'lr-dataset-viewer', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;

const source = 'name\tstatus\nAda\tActive\nGrace\tActive';
const src = `data:text/tab-separated-values,${encodeURIComponent(source)}`;

export const Default: Story = { render: () => html`<lr-dataset-viewer src=${src} name="People"></lr-dataset-viewer>` };
export const Empty: Story = { render: () => html`<lr-dataset-viewer></lr-dataset-viewer>` };

/** A narrow host (320px), matching the library's baseline narrow-allocation check -- confirms the
 *  sticky header row stays visible and legible above the virtualized body at that width. */
export const Narrow320: Story = {
  render: () => html`<div style="max-width:320px"><lr-dataset-viewer src=${src} name="People"></lr-dataset-viewer></div>`,
};
