import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './avatar-group.js';
import '../avatar/avatar.js';

const meta: Meta = {
  title: 'Data display/Avatar group',
  component: 'lr-avatar-group',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Stacks a set of slotted `<lr-avatar>` children into a single overlapping row and, past a configurable `max` count, collapses the excess into a "+N" overflow badge. `size`/`shape`/`tone` drive the ring/overlap/badge only -- set a matching `size`/`shape` on each `<lr-avatar>` child too for a visually coherent stack.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-avatar-group label="Team members">
      <lr-avatar initials="AB"></lr-avatar>
      <lr-avatar initials="CD"></lr-avatar>
      <lr-avatar initials="EF"></lr-avatar>
    </lr-avatar-group>
  `,
};

export const Overflow: Story = {
  name: 'Overflow past max',
  parameters: {
    docs: {
      description: {
        story:
          'When there are more `<lr-avatar>` children than `max`, the excess collapse behind a "+N" badge. Clicking the badge fires `lr-overflow-click` with the hidden count/avatars -- it does not itself reveal the hidden avatars (see the class doc for why this deliberately diverges from `<lr-chip-group>`\'s toggle behavior).',
      },
    },
  },
  render: () => html`
    <lr-avatar-group max="3" label="Team members" @lr-overflow-click=${(e: CustomEvent) =>
      console.log('lr-overflow-click', e.detail)}>
      <lr-avatar initials="AB"></lr-avatar>
      <lr-avatar initials="CD"></lr-avatar>
      <lr-avatar initials="EF"></lr-avatar>
      <lr-avatar initials="GH"></lr-avatar>
      <lr-avatar initials="IJ"></lr-avatar>
    </lr-avatar-group>
  `,
};

export const Sizes: Story = {
  render: () => html`
    <div style="display:flex; align-items:center; gap:1.5rem;">
      <lr-avatar-group size="sm" max="3">
        <lr-avatar initials="AB" size="sm"></lr-avatar>
        <lr-avatar initials="CD" size="sm"></lr-avatar>
        <lr-avatar initials="EF" size="sm"></lr-avatar>
        <lr-avatar initials="GH" size="sm"></lr-avatar>
      </lr-avatar-group>
      <lr-avatar-group size="md" max="3">
        <lr-avatar initials="AB" size="md"></lr-avatar>
        <lr-avatar initials="CD" size="md"></lr-avatar>
        <lr-avatar initials="EF" size="md"></lr-avatar>
        <lr-avatar initials="GH" size="md"></lr-avatar>
      </lr-avatar-group>
      <lr-avatar-group size="lg" max="3">
        <lr-avatar initials="AB" size="lg"></lr-avatar>
        <lr-avatar initials="CD" size="lg"></lr-avatar>
        <lr-avatar initials="EF" size="lg"></lr-avatar>
        <lr-avatar initials="GH" size="lg"></lr-avatar>
      </lr-avatar-group>
    </div>
  `,
};

export const Tones: Story = {
  name: 'Overflow badge tones',
  render: () => html`
    <div style="display:flex; align-items:center; gap:1.5rem;">
      <lr-avatar-group max="2" tone="neutral">
        <lr-avatar initials="AB"></lr-avatar>
        <lr-avatar initials="CD"></lr-avatar>
        <lr-avatar initials="EF"></lr-avatar>
      </lr-avatar-group>
      <lr-avatar-group max="2" tone="brand">
        <lr-avatar initials="AB" tone="brand"></lr-avatar>
        <lr-avatar initials="CD" tone="brand"></lr-avatar>
        <lr-avatar initials="EF" tone="brand"></lr-avatar>
      </lr-avatar-group>
      <lr-avatar-group max="2" tone="success">
        <lr-avatar initials="AB" tone="success"></lr-avatar>
        <lr-avatar initials="CD" tone="success"></lr-avatar>
        <lr-avatar initials="EF" tone="success"></lr-avatar>
      </lr-avatar-group>
    </div>
  `,
};

export const NarrowAllocation: Story = {
  name: 'Narrow allocation (320px)',
  parameters: {
    docs: {
      description: {
        story:
          'At a 320px allocation the compact "+N" overflow badge keeps the whole stack within a narrow toolbar-shaped allocation instead of wrapping or overflowing.',
      },
    },
  },
  render: () => html`
    <div style="inline-size:320px; max-inline-size:100%; border:1px dashed var(--lr-color-border); padding:0.5rem;">
      <lr-avatar-group max="4" label="Team members">
        <lr-avatar initials="AB"></lr-avatar>
        <lr-avatar initials="CD"></lr-avatar>
        <lr-avatar initials="EF"></lr-avatar>
        <lr-avatar initials="GH"></lr-avatar>
        <lr-avatar initials="IJ"></lr-avatar>
        <lr-avatar initials="KL"></lr-avatar>
        <lr-avatar initials="MN"></lr-avatar>
      </lr-avatar-group>
    </div>
  `,
};
