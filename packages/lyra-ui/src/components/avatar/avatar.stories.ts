import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './avatar.js';

const meta: Meta = {
  title: 'Components/Avatar',
  component: 'lyra-avatar',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A small, fixed-size identity marker: an image, or an initials fallback when no image is set (or the image fails to load). Purely presentational — a consumer wraps it in their own `<button>`/`<lyra-menu>` trigger for a user-menu affordance.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const InitialsOnly: Story = {
  name: 'Initials only (no image)',
  render: () => html`<lyra-avatar initials="AB"></lyra-avatar>`,
};

export const WithImage: Story = {
  name: 'With an image',
  render: () => html`
    <lyra-avatar
      src="https://picsum.photos/id/64/128/128"
      alt="A. Bee"
      initials="AB"
    ></lyra-avatar>
  `,
};

export const Sizes: Story = {
  render: () => html`
    <div style="display:flex; align-items:center; gap:0.75rem;">
      <lyra-avatar initials="SM" size="sm"></lyra-avatar>
      <lyra-avatar initials="MD" size="md"></lyra-avatar>
      <lyra-avatar initials="LG" size="lg"></lyra-avatar>
    </div>
  `,
};

export const Shapes: Story = {
  render: () => html`
    <div style="display:flex; align-items:center; gap:0.75rem;">
      <lyra-avatar initials="AB" shape="circle"></lyra-avatar>
      <lyra-avatar initials="AB" shape="square"></lyra-avatar>
    </div>
  `,
};

export const Tones: Story = {
  render: () => html`
    <div style="display:flex; align-items:center; gap:0.75rem;">
      <lyra-avatar initials="NE" tone="neutral"></lyra-avatar>
      <lyra-avatar initials="BR" tone="brand"></lyra-avatar>
      <lyra-avatar initials="SU" tone="success"></lyra-avatar>
      <lyra-avatar initials="WA" tone="warning"></lyra-avatar>
      <lyra-avatar initials="DA" tone="danger"></lyra-avatar>
    </div>
  `,
};

export const ImageFallback: Story = {
  name: 'Falls back to initials on image error',
  parameters: {
    docs: {
      description: {
        story:
          'A broken/unreachable `src` falls back to the `initials` text instead of showing a broken-image icon.',
      },
    },
  },
  render: () => html`
    <lyra-avatar
      src="https://example.invalid/nonexistent.png"
      alt="A. Bee"
      initials="AB"
      tone="brand"
    ></lyra-avatar>
  `,
};
