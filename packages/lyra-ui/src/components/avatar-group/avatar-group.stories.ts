import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './avatar-group.js';
import '../avatar/avatar.js';

const meta: Meta = {
  title: 'Data display/Avatar group',
  component: 'lyra-avatar-group',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Stacks a set of slotted `<lyra-avatar>` children into a single overlapping row and, past a configurable `max` count, collapses the excess into a "+N" overflow badge. `size`/`shape`/`tone` drive the ring/overlap/badge only -- set a matching `size`/`shape` on each `<lyra-avatar>` child too for a visually coherent stack.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-avatar-group label="Team members">
      <lyra-avatar initials="AB"></lyra-avatar>
      <lyra-avatar initials="CD"></lyra-avatar>
      <lyra-avatar initials="EF"></lyra-avatar>
    </lyra-avatar-group>
  `,
};

export const Overflow: Story = {
  name: 'Overflow past max',
  parameters: {
    docs: {
      description: {
        story:
          'When there are more `<lyra-avatar>` children than `max`, the excess collapse behind a "+N" badge. Clicking the badge fires `lyra-overflow-click` with the hidden count/avatars -- it does not itself reveal the hidden avatars (see the class doc for why this deliberately diverges from `<lyra-chip-group>`\'s toggle behavior).',
      },
    },
  },
  render: () => html`
    <lyra-avatar-group max="3" label="Team members" @lyra-overflow-click=${(e: CustomEvent) =>
      console.log('lyra-overflow-click', e.detail)}>
      <lyra-avatar initials="AB"></lyra-avatar>
      <lyra-avatar initials="CD"></lyra-avatar>
      <lyra-avatar initials="EF"></lyra-avatar>
      <lyra-avatar initials="GH"></lyra-avatar>
      <lyra-avatar initials="IJ"></lyra-avatar>
    </lyra-avatar-group>
  `,
};

export const Sizes: Story = {
  render: () => html`
    <div style="display:flex; align-items:center; gap:1.5rem;">
      <lyra-avatar-group size="sm" max="3">
        <lyra-avatar initials="AB" size="sm"></lyra-avatar>
        <lyra-avatar initials="CD" size="sm"></lyra-avatar>
        <lyra-avatar initials="EF" size="sm"></lyra-avatar>
        <lyra-avatar initials="GH" size="sm"></lyra-avatar>
      </lyra-avatar-group>
      <lyra-avatar-group size="md" max="3">
        <lyra-avatar initials="AB" size="md"></lyra-avatar>
        <lyra-avatar initials="CD" size="md"></lyra-avatar>
        <lyra-avatar initials="EF" size="md"></lyra-avatar>
        <lyra-avatar initials="GH" size="md"></lyra-avatar>
      </lyra-avatar-group>
      <lyra-avatar-group size="lg" max="3">
        <lyra-avatar initials="AB" size="lg"></lyra-avatar>
        <lyra-avatar initials="CD" size="lg"></lyra-avatar>
        <lyra-avatar initials="EF" size="lg"></lyra-avatar>
        <lyra-avatar initials="GH" size="lg"></lyra-avatar>
      </lyra-avatar-group>
    </div>
  `,
};

export const Tones: Story = {
  name: 'Overflow badge tones',
  render: () => html`
    <div style="display:flex; align-items:center; gap:1.5rem;">
      <lyra-avatar-group max="2" tone="neutral">
        <lyra-avatar initials="AB"></lyra-avatar>
        <lyra-avatar initials="CD"></lyra-avatar>
        <lyra-avatar initials="EF"></lyra-avatar>
      </lyra-avatar-group>
      <lyra-avatar-group max="2" tone="brand">
        <lyra-avatar initials="AB" tone="brand"></lyra-avatar>
        <lyra-avatar initials="CD" tone="brand"></lyra-avatar>
        <lyra-avatar initials="EF" tone="brand"></lyra-avatar>
      </lyra-avatar-group>
      <lyra-avatar-group max="2" tone="success">
        <lyra-avatar initials="AB" tone="success"></lyra-avatar>
        <lyra-avatar initials="CD" tone="success"></lyra-avatar>
        <lyra-avatar initials="EF" tone="success"></lyra-avatar>
      </lyra-avatar-group>
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
    <div style="inline-size:320px; max-inline-size:100%; border:1px dashed var(--lyra-color-border); padding:0.5rem;">
      <lyra-avatar-group max="4" label="Team members">
        <lyra-avatar initials="AB"></lyra-avatar>
        <lyra-avatar initials="CD"></lyra-avatar>
        <lyra-avatar initials="EF"></lyra-avatar>
        <lyra-avatar initials="GH"></lyra-avatar>
        <lyra-avatar initials="IJ"></lyra-avatar>
        <lyra-avatar initials="KL"></lyra-avatar>
        <lyra-avatar initials="MN"></lyra-avatar>
      </lyra-avatar-group>
    </div>
  `,
};
