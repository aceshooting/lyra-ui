import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './contact-viewer.js';

const meta: Meta = {
  title: 'DocumentViewer/ContactViewer',
  component: 'lr-contact-viewer',
  tags: ['autodocs'],
  parameters: { docs: { description: { component: 'A host `aria-label` names the contact region by attribute presence, including an explicitly empty value; `name` and the localized label are fallbacks.' } } },
};
export default meta;
type Story = StoryObj;

const source = ['BEGIN:VCARD', 'VERSION:4.0', 'FN:Ada Lovelace', 'ORG:Analytical Engines', 'EMAIL;TYPE=work:ada@example.com', 'TEL;TYPE=work:+352 555 0100', 'END:VCARD'].join('\r\n');
const src = `data:text/vcard,${encodeURIComponent(source)}`;
const narrowSource = ['BEGIN:VCARD', 'VERSION:4.0', 'FN:Ada Augusta King, Countess of Lovelace', 'ORG:International Society for Analytical Engine Research;Mathematical Correspondence Division', 'EMAIL;TYPE=work,preferred:ada.lovelace@example.com', 'TEL;TYPE=work,voice:+352 555 0100', 'END:VCARD'].join('\r\n');
const narrowSrc = `data:text/vcard,${encodeURIComponent(narrowSource)}`;

export const Default: Story = {
  render: () => html`<lr-contact-viewer heading-level="2" src=${src} name="Contacts"></lr-contact-viewer>`,
};
export const Empty: Story = { render: () => html`<lr-contact-viewer></lr-contact-viewer>` };

/** Baseline narrow-allocation coverage with long contact metadata. */
export const Narrow320: Story = {
  render: () => html`<div style="max-width:320px"><lr-contact-viewer src=${narrowSrc} name="International analytical-engine research contacts.vcf"></lr-contact-viewer></div>`,
};
