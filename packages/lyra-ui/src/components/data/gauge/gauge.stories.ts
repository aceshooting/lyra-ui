import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Gauge',
  component: 'lr-gauge',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Radial: Story = {
  render: () => html`<lr-gauge value="72" max="100" label="CPU"></lr-gauge>`,
};

export const Linear: Story = {
  render: () => html`<lr-gauge shape="linear" value="40" max="100" label="Disk"></lr-gauge>`,
};

export const Ring: Story = {
  render: () => html`
    <div style="display: flex; gap: 2rem; align-items: center; flex-wrap: wrap">
      <lr-gauge shape="ring" value="72" max="100" label="Score"></lr-gauge>
      <lr-gauge
        shape="ring"
        value="84"
        max="100"
        label="Coverage"
        style="--lr-gauge-fill: var(--lr-color-success)"
      ></lr-gauge>
    </div>
  `,
};

export const WithValueText: Story = {
  render: () => html`<lr-gauge value="72" max="100" label="Temp" .valueText=${'72°F'}></lr-gauge>`,
};

export const AuthoredRoleAndLongText: Story = {
  render: () => html`
    <lr-gauge
      role="progressbar"
      value="72"
      max="100"
      label="Deployment readiness across every production region"
      value-text="Seventy-two percent and improving"
    ></lr-gauge>
  `,
};

export const NonzeroMin: Story = {
  render: () => html`<lr-gauge value="18" min="-20" max="40" label="Outdoor Temp"></lr-gauge>`,
};

export const LabelRemoval: Story = {
  render: () => html`
    <div>
      <button type="button" @click=${(event: Event) => (event.currentTarget as HTMLElement).parentElement!.querySelectorAll('lr-gauge').forEach((gauge) => gauge.removeAttribute('label'))}>Remove labels</button>
      ${['radial', 'linear', 'ring'].map((shape) => html`<lr-gauge shape=${shape} label="CPU" value="42"></lr-gauge>`)}
    </div>
  `,
};
