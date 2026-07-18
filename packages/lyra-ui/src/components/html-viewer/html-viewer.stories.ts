import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './html-viewer.js';

const meta: Meta = { title: 'DocumentViewer/HtmlViewer', component: 'lr-html-viewer', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;

const source = '<article><h2>Rendered report</h2><p>This content is sanitized before it reaches the DOM.</p></article>';
const src = `data:text/html,${encodeURIComponent(source)}`;

export const Default: Story = { render: () => html`<lr-html-viewer src=${src} name="Rendered report"></lr-html-viewer>` };
export const Empty: Story = { render: () => html`<lr-html-viewer></lr-html-viewer>` };
