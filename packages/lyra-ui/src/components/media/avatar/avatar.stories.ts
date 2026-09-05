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
          'Removing label safely restores the unnamed fallback while preserving host accessible naming and later label updates. A small, fixed-size identity marker: an image, an `icon`-slotted fallback glyph, or initials, in that priority order. Purely presentational — wrap it in a button or menu trigger when interaction is required.',
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
          'The named `icon` slot replaces initials when no image is usable. Set `label` alongside the decorative glyph for an accessible name.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; align-items:center; gap:0.75rem;">
      <lr-avatar variant="brand" label="AI assistant">
        <svg slot="icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2l1.8 5.6L19 9l-5.2 1.4L12 16l-1.8-5.6L5 9l5.2-1.4L12 2z"></path>
        </svg>
      </lr-avatar>
      <lr-avatar variant="neutral" label="You">
        <svg slot="icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
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
      label="A. Bee"
      initials="AB"
    ></lr-avatar>
  `,
};

export const MappedLabelAndSize: Story = {
  name: 'Mapped label and --size hook',
  render: () => html`
    <lr-avatar initials="AB" label="Account owner" style="--size:var(--lr-size-3rem)"></lr-avatar>
  `,
};

export const AccessibleNameOverride: Story = {
  name: 'Host aria-label overrides label',
  parameters: {
    docs: {
      description: {
        story:
          'Use a host `aria-label` when the spoken identity should differ from `label`; the override is forwarded to the internal semantic owner.',
      },
    },
  },
  render: () => html`
    <lr-avatar
      image=${IMAGE_SRC}
      label="Profile photo"
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
          '`size` runs the library-wide six-step ladder, `2xs` through `xl`. `small`/`medium`/`large` are the mirrored spellings of `s`/`m`/`l`.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; align-items:center; gap:0.75rem;">
      <lr-avatar initials="XS" size="2xs"></lr-avatar>
      <lr-avatar initials="XS" size="xs"></lr-avatar>
      <lr-avatar initials="SM" size="s"></lr-avatar>
      <lr-avatar initials="MD" size="m"></lr-avatar>
      <lr-avatar initials="LG" size="l"></lr-avatar>
      <lr-avatar initials="XL" size="xl"></lr-avatar>
    </div>
    <div style="display:flex; align-items:center; gap:0.75rem; margin-block-start:0.75rem;">
      <lr-avatar initials="SM" size="small"></lr-avatar>
      <lr-avatar initials="MD" size="medium"></lr-avatar>
      <lr-avatar initials="LG" size="large"></lr-avatar>
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
          'Content in the `icon` slot stands in for initials when no image is usable. The left avatar has no image; the right one demonstrates image-error fallback.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; align-items:center; gap:0.75rem;">
      <lr-avatar label="Unassigned">
        <svg slot="icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </lr-avatar>
      <lr-avatar label="Unassigned" variant="brand" image="https://example.invalid/nonexistent.png">
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
  render: () => html`<lr-avatar image=${IMAGE_SRC} label="A. Bee" initials="AB" loading="lazy"></lr-avatar>`,
};

export const Variants: Story = {
  render: () => html`
    <div style="display:flex; align-items:center; gap:0.75rem;">
      <lr-avatar initials="NE" variant="neutral"></lr-avatar>
      <lr-avatar initials="BR" variant="brand"></lr-avatar>
      <lr-avatar initials="SU" variant="success"></lr-avatar>
      <lr-avatar initials="WA" variant="warning"></lr-avatar>
      <lr-avatar initials="DA" variant="danger"></lr-avatar>
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
      label="A. Bee"
      initials="AB"
      variant="brand"
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
          'The initials fallback scales with `size` through `--lr-avatar-font-size`: `2xs` → `--lr-font-size-xs`, `xs` → `--lr-font-size-sm`, `s`/`small` → `--lr-font-size-md-sm`, `m`/`medium` → `--lr-font-size-m`, `l`/`large` → `--lr-font-size-lg`, and `xl` → `--lr-font-size-xl`. Set the property directly to override any tier — useful for single-character initials, which can carry a larger glyph than a two-character pair in the same circle.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; align-items:center; gap:0.75rem;">
      <lr-avatar initials="AB" size="small"></lr-avatar>
      <lr-avatar initials="AB" size="medium"></lr-avatar>
      <lr-avatar initials="AB" size="large"></lr-avatar>
      <lr-avatar initials="A" variant="brand" style="--lr-avatar-font-size: 1.25rem;"></lr-avatar>
    </div>
  `,
};
