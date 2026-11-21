import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../../lr-help.js';
import '../../lr-stat.js';
import '../../lr-card.js';

const meta: Meta = {
  title: 'Overlays & Feedback/Help',
  component: 'lr-help',
  tags: ['autodocs'],
};

export default meta;

export const Default: StoryObj = {
  render: () => html`<p>
    Monthly active users
    <lr-help label="About monthly active users">Distinct accounts that signed in during the last 30 days.</lr-help>
  </p>`,
};

export const InStatAndCard: StoryObj = {
  render: () => html`<div style="display: grid; gap: var(--lr-space-m); max-inline-size: var(--lr-size-20rem)">
    <lr-stat label="Uptime" value="99.95" unit="%">
      <lr-help slot="actions" label="How uptime is measured">Share of one-minute probes that succeeded this month.</lr-help>
    </lr-stat>
    <lr-card>
      <span slot="header">Error budget</span>
      <lr-help slot="header-actions" placement="bottom">The downtime still allowed before the monthly target is missed.</lr-help>
      42 minutes remaining.
    </lr-card>
  </div>`,
};
