import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './push-to-talk.js';

const meta: Meta = {
  title: 'Push To Talk',
  component: 'lyra-push-to-talk',
};
export default meta;
type Story = StoryObj;

export const Hold: Story = {
  render: () => html`<lyra-push-to-talk mode="hold"></lyra-push-to-talk>`,
};

export const Toggle: Story = {
  render: () => html`<lyra-push-to-talk mode="toggle"></lyra-push-to-talk>`,
};

export const WithLevelEventsAndMaxDuration: Story = {
  render: () => html`
    <lyra-push-to-talk mode="toggle" level-events max-duration-ms="30000"
      @lyra-level=${(e: CustomEvent<{ level: number }>) => console.log('level', e.detail.level)}
    ></lyra-push-to-talk>
  `,
};

export const Disabled: Story = {
  render: () => html`<lyra-push-to-talk disabled></lyra-push-to-talk>`,
};

export const Narrow320: Story = {
  render: () => html`
    <div style="max-inline-size: 320px; border: 1px dashed #ccc; padding: 8px;">
      <lyra-push-to-talk mode="toggle"></lyra-push-to-talk>
    </div>
  `,
};
