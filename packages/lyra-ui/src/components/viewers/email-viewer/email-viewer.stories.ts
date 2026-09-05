import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './email-viewer.js';
import type { LyraEmailViewer } from './email-viewer.js';

const meta: Meta = {
  title: 'EmailViewer',
  component: 'lr-email-viewer',
  tags: ['autodocs'],
  parameters: { docs: { description: { component: 'A nonempty host `aria-label` is the sole named semantic owner. With an absent or explicitly empty host label, the shadow region owns the fallback or empty name.' } } },
};
export default meta;
type Story = StoryObj;

const SAMPLE_EML = ['From: Ada Lovelace <ada@example.test>', 'To: Grace Hopper <grace@example.test>', 'Subject: Quarterly report', 'Date: Tue, 14 Jul 2026 09:30:00 +0000', 'Content-Type: text/html; charset=utf-8', '', '<p>Totals are <strong>up 12%</strong>.</p>', ''].join('\r\n');
const source = `data:message/rfc822;charset=utf-8,${encodeURIComponent(SAMPLE_EML)}`;

export const Default: Story = { render: () => html`<lr-email-viewer style="max-inline-size: 36rem;" src=${source} name="report.eml"></lr-email-viewer>` };
export const NoSourceSet: Story = { render: () => html`<lr-email-viewer style="max-inline-size: 36rem;"></lr-email-viewer>` };
export const MaxHeight: Story = { render: () => html`<lr-email-viewer style="max-inline-size: 36rem;" max-height="8rem" src=${source} name="report.eml"></lr-email-viewer>` };

/** Baseline narrow-allocation coverage with long message metadata. */
export const Narrow320: Story = {
  render: () => html`<div style="max-width:320px"><lr-email-viewer src=${source} name="International quarterly analytical-engine correspondence.eml"></lr-email-viewer></div>`,
};


export const NormalizedQuoteSearch: Story = {
  parameters: { docs: { description: { story: 'With foldQuotes enabled, padded and normalized search queries reveal matching plain-text and HTML quotes before navigation. Try the search button, collapse the quote again, then repeat the search.' } } },
  render: () => html`${(['plain', 'html'] as const).map((format) => {
    const body = format === 'html'
      ? '<p>New reply.</p><blockquote type="cite">Quoted café message.</blockquote>'
      : 'New reply.\n\n> Quoted café message.\n> Older line two.\n> Older line three.';
    const message = `Subject: Quoted reply\r\nContent-Type: text/${format}; charset=utf-8\r\n\r\n${body}`;
    return html`<section style="max-inline-size: 36rem">
      <button @click=${(event: Event) => {
        const viewer = (event.currentTarget as HTMLElement).parentElement!.querySelector<LyraEmailViewer>('lr-email-viewer')!;
        void viewer.search('  cafe\u0301  ');
      }}>Find café in ${format} quote</button>
      <lr-email-viewer fold-quotes src=${`data:message/rfc822;charset=utf-8,${encodeURIComponent(message)}`} name=${`${format}.eml`}></lr-email-viewer>
    </section>`;
  })}`,
};
