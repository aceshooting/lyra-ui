import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './ebook-viewer.js';
import { MINIMAL_EPUB_BASE64 } from './fixtures/minimal-epub-fixture.js';

const meta: Meta = { title: 'Viewers/Ebook viewer', component: 'lr-ebook-viewer', tags: ['autodocs'] };
export default meta;
export const Empty: StoryObj = { render: () => html`<lr-ebook-viewer aria-label="Ebook preview"></lr-ebook-viewer>` };

const source = `data:application/epub+zip;base64,${MINIMAL_EPUB_BASE64}`;

/** Baseline narrow-allocation coverage with long accessible metadata. */
export const Narrow320: StoryObj = {
  render: () => html`<div style="max-width:320px"><lr-ebook-viewer src=${source} name="Collected correspondence on the analytical engine"></lr-ebook-viewer></div>`,
};
