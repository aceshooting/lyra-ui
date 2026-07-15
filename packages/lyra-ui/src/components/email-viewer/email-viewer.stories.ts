import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './email-viewer.js';

const meta: Meta = { title: 'EmailViewer', component: 'lyra-email-viewer', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;

const SAMPLE_EML = ['From: Ada Lovelace <ada@example.test>', 'To: Grace Hopper <grace@example.test>', 'Subject: Quarterly report', 'Date: Tue, 14 Jul 2026 09:30:00 +0000', 'Content-Type: text/html; charset=utf-8', '', '<p>Totals are <strong>up 12%</strong>.</p>', ''].join('\r\n');
const source = `data:message/rfc822;charset=utf-8,${encodeURIComponent(SAMPLE_EML)}`;

export const Default: Story = { render: () => html`<lyra-email-viewer style="max-inline-size: 36rem;" src=${source} name="report.eml"></lyra-email-viewer>` };
export const NoSourceSet: Story = { render: () => html`<lyra-email-viewer style="max-inline-size: 36rem;"></lyra-email-viewer>` };
export const MaxHeight: Story = { render: () => html`<lyra-email-viewer style="max-inline-size: 36rem;" max-height="8rem" src=${source} name="report.eml"></lyra-email-viewer>` };
