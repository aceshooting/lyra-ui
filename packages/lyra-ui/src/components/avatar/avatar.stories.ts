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
          'A small, fixed-size identity marker: default-slotted icon/glyph content, an image, or an initials fallback, in that priority order. Purely presentational — a consumer wraps it in their own `<button>`/`<lyra-menu>` trigger for a user-menu affordance.',
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

export const IconOnly: Story = {
  name: 'Icon/glyph content (e.g. a chat role marker)',
  parameters: {
    docs: {
      description: {
        story:
          'Default-slotted content (an inline SVG here) takes priority over both `src` and `initials` — useful for a chat UI distinguishing an "AI" avatar from a "user" avatar by role glyph rather than a photo or initials. Set `alt` alongside the icon for an accessible name, since the glyph itself is treated as decorative.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; align-items:center; gap:0.75rem;">
      <lyra-avatar tone="brand" alt="AI assistant">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2l1.8 5.6L19 9l-5.2 1.4L12 16l-1.8-5.6L5 9l5.2-1.4L12 2z"></path>
        </svg>
      </lyra-avatar>
      <lyra-avatar tone="neutral" alt="You">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </lyra-avatar>
    </div>
  `,
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
