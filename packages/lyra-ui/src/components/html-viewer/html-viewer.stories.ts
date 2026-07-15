import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './html-viewer.js';

const meta: Meta = { title: 'DocumentViewer/HtmlViewer', component: 'lyra-html-viewer', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;

const source = '<article><h2>Rendered report</h2><p>This content is sanitized before it reaches the DOM.</p></article>';
const src = `data:text/html,${encodeURIComponent(source)}`;

export const Default: Story = { render: () => html`<lyra-html-viewer src=${src} name="Rendered report"></lyra-html-viewer>` };
export const Empty: Story = { render: () => html`<lyra-html-viewer></lyra-html-viewer>` };
