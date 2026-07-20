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

export const RetintedRevealToggle: Story = {
  name: 'Retinted reveal toggle',
  parameters: {
    docs: {
      description: {
        story:
          "Click a secret entry's reveal toggle to see it: `--lr-env-list-reveal-active-bg` and `--lr-env-list-reveal-active-border` retint the pressed (revealed) toggle. `::part(reveal-button)[aria-pressed]` is invalid CSS, so without these props the pressed state could only be restyled by overriding the library-wide brand tokens. Unset, it renders exactly as before.",
      },
    },
  },
  render: () =>
    html`<lr-env-list
      style="max-width:32rem; --lr-env-list-reveal-active-bg: var(--lr-color-success-quiet); --lr-env-list-reveal-active-border: var(--lr-color-success)"
      .entries=${entries}
    ></lr-env-list>`,
};
