import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './badge.js';
import './tag.js';

const meta: Meta = { title: 'Display/Badge', component: 'lr-badge', tags: ['autodocs'] };
export default meta;

const row = 'display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center';

export const Variants: StoryObj = {
  render: () => html`<div style=${row}>
    <lr-badge>Neutral</lr-badge>
    <lr-badge variant="brand">Brand</lr-badge>
    <lr-badge variant="success">Ready</lr-badge>
    <lr-badge variant="warning">Warning</lr-badge>
    <lr-badge variant="danger">Danger</lr-badge>
    <lr-tag variant="brand">Tag</lr-tag>
  </div>`,
};

export const Appearance: StoryObj = {
  name: 'Appearance',
  render: () => html`<div style="display:grid;gap:0.5rem">
    ${(['accent', 'filled', 'outlined', 'filled-outlined', 'plain'] as const).map(
      (appearance) => html`<div style=${row}>
        <span style="inline-size:9rem;font-size:0.8125rem">${appearance}</span>
        <lr-badge appearance=${appearance}>Neutral</lr-badge>
        <lr-badge appearance=${appearance} variant="brand">Brand</lr-badge>
        <lr-badge appearance=${appearance} variant="success">Ready</lr-badge>
        <lr-badge appearance=${appearance} variant="danger">Danger</lr-badge>
      </div>`,
    )}
  </div>`,
};

export const Pill: StoryObj = {
  name: 'Pill vs rounded rectangle',
  render: () => html`<div style=${row}>
    <lr-badge variant="brand">Rounded rectangle (default)</lr-badge>
    <lr-badge variant="brand" pill>Pill</lr-badge>
    <lr-badge variant="brand" pill appearance="accent">9</lr-badge>
  </div>`,
};

export const StartAndEnd: StoryObj = {
  name: 'Start and end slots',
  render: () => html`<div style=${row}>
    <lr-badge variant="success"><span slot="start" aria-hidden="true">&#10003;</span>Passing</lr-badge>
    <lr-badge variant="warning">3 warnings<span slot="end" aria-hidden="true">&#9888;</span></lr-badge>
  </div>`,
};

export const Attention: StoryObj = {
  name: 'Attention (stops under reduced motion)',
  render: () => html`<div style=${row}>
    <lr-badge variant="danger" appearance="accent" pill attention="pulse">Live</lr-badge>
    <lr-badge variant="brand" appearance="accent" pill attention="bounce">New</lr-badge>
    <lr-badge variant="neutral" attention="none">Calm</lr-badge>
  </div>`,
};

export const PulseAlias: StoryObj = {
  name: 'pulse shorthand and --pulse-color',
  render: () => html`
    <lr-badge pulse appearance="accent" variant="danger" style="--pulse-color:var(--lr-color-warning)">
      Live
    </lr-badge>
  `,
};

export const UpstreamWriteAliases: StoryObj = {
  name: 'Upstream variant and size aliases',
  parameters: {
    docs: {
      description: {
        story:
          '`primary` normalizes to the canonical `brand` variant. `small`, `medium`, and `large` normalize to `s`, `m`, and `l`; `lr-tag` also maps `text` to its neutral plain treatment.',
      },
    },
  },
  render: () => html`<div style=${row}>
    <lr-badge variant="primary" size="small">Primary / small</lr-badge>
    <lr-badge variant="primary" size="large">Primary / large</lr-badge>
    <lr-tag variant="primary" size="medium">Primary tag</lr-tag>
    <lr-tag variant="text" size="medium">Text tag</lr-tag>
  </div>`,
};

export const NarrowAllocation: StoryObj = {
  name: 'Narrow allocation and long content',
  render: () => html`<div style="inline-size:320px;display:grid;gap:0.5rem;justify-items:start">
    <lr-badge variant="brand">A deliberately very long badge label that has to truncate</lr-badge>
    <lr-tag variant="brand" with-remove>A deliberately very long tag label that has to truncate</lr-tag>
  </div>`,
};
