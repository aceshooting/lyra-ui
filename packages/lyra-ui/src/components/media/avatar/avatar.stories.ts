import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './avatar.js';

const meta: Meta = {
  title: 'Components/Avatar',
  component: 'lr-avatar',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A small, fixed-size identity marker: default-slotted icon/glyph content, an image, or an initials fallback, in that priority order. Purely presentational — a consumer wraps it in their own `<button>`/`<lr-menu>` trigger for a user-menu affordance.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const InitialsOnly: Story = {
  name: 'Initials only (no image)',
  render: () => html`<lr-avatar initials="AB"></lr-avatar>`,
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
      <lr-avatar tone="brand" alt="AI assistant">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2l1.8 5.6L19 9l-5.2 1.4L12 16l-1.8-5.6L5 9l5.2-1.4L12 2z"></path>
        </svg>
      </lr-avatar>
      <lr-avatar tone="neutral" alt="You">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </lr-avatar>
    </div>
  `,
};

export const WithImage: Story = {
  name: 'With an image',
  render: () => html`
    <lr-avatar
      src="https://picsum.photos/id/64/128/128"
      alt="A. Bee"
      initials="AB"
    ></lr-avatar>
  `,
};

export const AccessibleNameOverride: Story = {
  name: 'Host aria-label overrides alt',
  parameters: {
    docs: {
      description: {
        story:
          'Use a host `aria-label` when the spoken identity should differ from the image `alt`; the override is forwarded to the internal element that owns the image semantics.',
      },
    },
  },
  render: () => html`
    <lr-avatar
      src="https://picsum.photos/id/64/128/128"
      alt="Profile photo"
      aria-label="Signed in as A. Bee"
      initials="AB"
    ></lr-avatar>
  `,
};

export const Sizes: Story = {
  render: () => html`
    <div style="display:flex; align-items:center; gap:0.75rem;">
      <lr-avatar initials="SM" size="sm"></lr-avatar>
      <lr-avatar initials="MD" size="md"></lr-avatar>
      <lr-avatar initials="LG" size="lg"></lr-avatar>
    </div>
  `,
};

export const Shapes: Story = {
  render: () => html`
    <div style="display:flex; align-items:center; gap:0.75rem;">
      <lr-avatar initials="AB" shape="circle"></lr-avatar>
      <lr-avatar initials="AB" shape="square"></lr-avatar>
    </div>
  `,
};

export const Tones: Story = {
  render: () => html`
    <div style="display:flex; align-items:center; gap:0.75rem;">
      <lr-avatar initials="NE" tone="neutral"></lr-avatar>
      <lr-avatar initials="BR" tone="brand"></lr-avatar>
      <lr-avatar initials="SU" tone="success"></lr-avatar>
      <lr-avatar initials="WA" tone="warning"></lr-avatar>
      <lr-avatar initials="DA" tone="danger"></lr-avatar>
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
    <lr-avatar
      src="https://example.invalid/nonexistent.png"
      alt="A. Bee"
      initials="AB"
      tone="brand"
    ></lr-avatar>
  `,
};

export const InitialsFontSize: Story = {
  name: 'Initials font size (--lr-avatar-font-size)',
  parameters: {
    docs: {
      description: {
        story:
          'The initials fallback scales with `size` through `--lr-avatar-font-size` (`sm` → `--lr-font-size-xs`, `md` → `--lr-font-size-sm`, `lg` → `--lr-font-size-md`). Set the property directly to override any tier — useful for single-character initials, which can carry a larger glyph than a two-character pair in the same circle.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; align-items:center; gap:0.75rem;">
      <lr-avatar initials="AB" size="sm"></lr-avatar>
      <lr-avatar initials="AB" size="md"></lr-avatar>
      <lr-avatar initials="AB" size="lg"></lr-avatar>
      <lr-avatar initials="A" tone="brand" style="--lr-avatar-font-size: 1.25rem;"></lr-avatar>
    </div>
  `,
};
