import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './contact-viewer.js';

const meta: Meta = { title: 'DocumentViewer/ContactViewer', component: 'lr-contact-viewer', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;

const source = ['BEGIN:VCARD', 'VERSION:4.0', 'FN:Ada Lovelace', 'ORG:Analytical Engines', 'EMAIL;TYPE=work:ada@example.com', 'TEL;TYPE=work:+352 555 0100', 'END:VCARD'].join('\r\n');
const src = `data:text/vcard,${encodeURIComponent(source)}`;

export const Default: Story = { render: () => html`<lr-contact-viewer src=${src} name="Contacts"></lr-contact-viewer>` };
export const Empty: Story = { render: () => html`<lr-contact-viewer></lr-contact-viewer>` };
