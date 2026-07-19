import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './checkpoint.js';

const meta: Meta = {
  title: 'Checkpoint',
  component: 'lr-checkpoint',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'An inline conversation restore point: a labeled marker whose Restore affordance confirms inline, then hands the host a lr-restore event.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-checkpoint
      style="max-width: 32rem;"
      checkpoint-id="ck_18"
      label="Before refactor"
      .timestamp=${new Date()}
    ></lr-checkpoint>
  `,
};

export const NoConfirm: Story = {
  name: 'confirmRestore="false" (fires immediately)',
  render: () => html`
    <lr-checkpoint
      style="max-width: 32rem;"
      checkpoint-id="ck_19"
      label="Snapshot before deploy"
      confirm-restore="false"
    ></lr-checkpoint>
  `,
};

export const Restoring: Story = {
  render: () => html`
    <lr-checkpoint style="max-width: 32rem;" checkpoint-id="ck_18" label="Before refactor" restoring></lr-checkpoint>
  `,
};

export const ReadOnlyMarker: Story = {
  name: 'restorable="false" (read-only marker)',
  render: () => html`
    <lr-checkpoint style="max-width: 32rem;" label="Currently restored point" restorable="false"></lr-checkpoint>
  `,
};

export const WithSupplementalContent: Story = {
  render: () => html`
    <lr-checkpoint style="max-width: 32rem;" checkpoint-id="ck_18" label="Before refactor">
      Two files changed since this point: src/auth.ts, src/session.ts
    </lr-checkpoint>
  `,
};

export const Narrow320: Story = {
  name: 'Narrow (320px)',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-checkpoint checkpoint-id="ck_18" label="Before a long-named refactor of the auth module"></lr-checkpoint>
    </div>
  `,
};
