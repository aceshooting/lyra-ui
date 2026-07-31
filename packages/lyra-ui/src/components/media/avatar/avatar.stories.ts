import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './avatar.js';

const IMAGE_SRC = '/fixtures/story-image.svg';

const meta: Meta = {
  title: 'Components/Avatar',
  component: 'lr-avatar',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A small, fixed-size identity marker: default-slotted icon/glyph content, an image, an `icon`-slotted fallback glyph, or an initials fallback, in that priority order. Purely presentational — a consumer wraps it in their own `<button>`/`<lr-menu>` trigger for a user-menu affordance.',
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
          'Default-slotted content (an inline SVG here) takes priority over `image`, the `icon` slot, and `initials` — useful for a chat UI distinguishing an "AI" avatar from a "user" avatar by role glyph rather than a photo or initials. Set `alt` alongside the icon for an accessible name, since the glyph itself is treated as decorative.',
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
      image=${IMAGE_SRC}
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
      image=${IMAGE_SRC}
      alt="Profile photo"
      aria-label="Signed in as A. Bee"
      initials="AB"
    ></lr-avatar>
  `,
};

export const Sizes: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The canonical spellings are `small`/`medium`/`large`. The shorthand `sm`/`md`/`lg` remains accepted as an alias of the same three tiers (bottom row), so existing markup and markup migrated from a shorthand-sized library keep their sizing.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; align-items:center; gap:0.75rem;">
      <lr-avatar initials="SM" size="small"></lr-avatar>
      <lr-avatar initials="MD" size="medium"></lr-avatar>
      <lr-avatar initials="LG" size="large"></lr-avatar>
    </div>
    <div style="display:flex; align-items:center; gap:0.75rem; margin-top:0.75rem;">
      <lr-avatar initials="SM" size="sm"></lr-avatar>
      <lr-avatar initials="MD" size="md"></lr-avatar>
      <lr-avatar initials="LG" size="lg"></lr-avatar>
    </div>
  `,
};

export const Shapes: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`circle` (the default) uses the pill radius, `rounded` the shared `--lr-radius`, and `square` no corner radius at all.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; align-items:center; gap:0.75rem;">
      <lr-avatar initials="AB" shape="circle"></lr-avatar>
      <lr-avatar initials="AB" shape="rounded"></lr-avatar>
      <lr-avatar initials="AB" shape="square"></lr-avatar>
    </div>
  `,
};

export const IconSlotFallback: Story = {
  name: 'Fallback glyph (slot="icon")',
  parameters: {
    docs: {
      description: {
        story:
          'Content in the `icon` slot stands in for the `initials` text: it renders only when no default-slot glyph is present and no image loads. The left avatar has no image at all; the right one has an unreachable image URL and falls through to the same glyph.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; align-items:center; gap:0.75rem;">
      <lr-avatar alt="Unassigned">
        <svg slot="icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </lr-avatar>
      <lr-avatar alt="Unassigned" tone="brand" image="https://example.invalid/nonexistent.png">
        <svg slot="icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </lr-avatar>
    </div>
  `,
};

export const LazyLoading: Story = {
  name: 'Deferred image request (loading="lazy")',
  parameters: {
    docs: {
      description: {
        story:
          'The native `<img loading>` attribute is forwarded verbatim. `lazy` defers the request until the avatar approaches the viewport — worth setting for avatars far down a long list, never for one above the fold.',
      },
    },
  },
  render: () => html`<lr-avatar image=${IMAGE_SRC} alt="A. Bee" initials="AB" loading="lazy"></lr-avatar>`,
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
          'A broken/unreachable `image` falls back to the `icon` slot, or to the `initials` text, instead of showing a broken-image icon — and fires `lr-error` with the URL that failed.',
      },
    },
  },
  render: () => html`
    <lr-avatar
      image="https://example.invalid/nonexistent.png"
      alt="A. Bee"
      initials="AB"
      tone="brand"
      @lr-error=${(e: CustomEvent<{ image: string }>) => {
        const out = document.getElementById('avatar-error-log');
        if (out) out.textContent = `lr-error: ${e.detail.image}`;
      }}
    ></lr-avatar>
    <p id="avatar-error-log" style="font-family: monospace; margin-top: 0.5rem;">(no event yet)</p>
  `,
};

export const InitialsFontSize: Story = {
  name: 'Initials font size (--lr-avatar-font-size)',
  parameters: {
    docs: {
      description: {
        story:
          'The initials fallback scales with `size` through `--lr-avatar-font-size` (`small` → `--lr-font-size-xs`, `medium` → `--lr-font-size-sm`, `large` → `--lr-font-size-md`). Set the property directly to override any tier — useful for single-character initials, which can carry a larger glyph than a two-character pair in the same circle.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; align-items:center; gap:0.75rem;">
      <lr-avatar initials="AB" size="small"></lr-avatar>
      <lr-avatar initials="AB" size="medium"></lr-avatar>
      <lr-avatar initials="AB" size="large"></lr-avatar>
      <lr-avatar initials="A" tone="brand" style="--lr-avatar-font-size: 1.25rem;"></lr-avatar>
    </div>
  `,
};
