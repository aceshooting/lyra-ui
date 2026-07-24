import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './email-viewer.js';

const meta: Meta = { title: 'EmailViewer', component: 'lr-email-viewer', tags: ['autodocs'] };
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
