import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './svg-viewer.js';

const meta: Meta = { title: 'DocumentViewer/SvgViewer', component: 'lyra-svg-viewer', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;

const source = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 80"><rect width="160" height="80" rx="12" fill="LinkText"/><circle cx="45" cy="40" r="20" fill="Canvas"/><path d="M85 25h45v10H85zm0 20h30v10H85z" fill="Canvas"/></svg>';
const src = `data:image/svg+xml,${encodeURIComponent(source)}`;

export const Default: Story = { render: () => html`<lyra-svg-viewer src=${src} name="Example illustration"></lyra-svg-viewer>` };
export const Empty: Story = { render: () => html`<lyra-svg-viewer></lyra-svg-viewer>` };
