import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './env-list.js';
import type { EnvEntry } from './env-list.class.js';

const meta: Meta = {
  title: 'Env List',
  component: 'lr-env-list',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

const entries: EnvEntry[] = [
  { name: 'NODE_ENV', value: 'production', secret: false },
  { name: 'API_KEY', value: 'sk-live-1234567890abcdef' },
  { name: 'DATABASE_URL', value: 'postgres://user:pass@host:5432/db' },
];

export const Default: Story = {
  render: () => html`<lr-env-list style="max-width:32rem" .entries=${entries}></lr-env-list>`,
};

export const ScreenShareSafe: Story = {
  name: 'Screen-share safe (revealable=false)',
  parameters: {
    docs: {
      description: {
        story:
          'Every secret entry stays masked with no reveal toggle at all -- for hosts like a screen ' +
          'share or a recorded demo where a value should never be one click away from showing.',
      },
    },
  },
  render: () =>
    html`<lr-env-list style="max-width:32rem" .entries=${entries} .revealable=${false}></lr-env-list>`,
};

export const AllSecretsMasked: Story = {
  name: 'All entries masked',
  parameters: {
    docs: {
      description: {
        story:
          'Every entry defaults to `secret: true` when the `secret` field is omitted, so a plain ' +
          'name/value list still masks by default -- the eight-bullet mask reveals nothing about ' +
          'the real value\'s length.',
      },
    },
  },
  render: () =>
    html`<lr-env-list
      style="max-width:32rem"
      .entries=${[
        { name: 'API_KEY', value: 'sk-live-1234567890abcdef' },
        { name: 'DATABASE_URL', value: 'postgres://user:pass@host:5432/db' },
        { name: 'JWT_SECRET', value: 'x' },
      ]}
    ></lr-env-list>`,
};

export const Empty: Story = {
  render: () => html`<lr-env-list></lr-env-list>`,
};

export const Narrow320: Story = {
  name: 'Narrow (320px)',
  render: () => html`<div style="max-width:320px"><lr-env-list .entries=${entries}></lr-env-list></div>`,
};
