import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './button.js';

const meta: Meta = {
  title: 'Button',
  component: 'lr-button',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'A generic action-button primitive with tokenized tones, appearances, sizes, and loading feedback.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-button>Save</lr-button>`,
};

export const Variants: Story = {
  render: () => html`
    <div style="display: flex; gap: 0.5rem;">
      <lr-button variant="neutral">Neutral</lr-button>
      <lr-button variant="brand">Brand</lr-button>
      <lr-button variant="success">Success</lr-button>
      <lr-button variant="warning">Warning</lr-button>
      <lr-button variant="danger">Danger</lr-button>
    </div>
  `,
};

export const Appearances: Story = {
  render: () => html`
    <div style="display: flex; align-items: center; gap: 0.5rem;">
      <lr-button variant="brand" appearance="accent">Accent</lr-button>
      <lr-button variant="brand" appearance="filled">Filled</lr-button>
      <lr-button variant="brand" appearance="outlined">Outlined</lr-button>
      <lr-button variant="brand" appearance="plain">Plain</lr-button>
      <lr-button variant="brand" appearance="link">Link</lr-button>
    </div>
  `,
};

export const Link: Story = {
  name: 'Link (inline text)',
  parameters: {
    docs: {
      description: {
        story:
          'A zero-chrome, underlined inline-text appearance: no padding, border, or min-height, ' +
          'colored from the same accent token `plain` uses and inheriting the surrounding font, so ' +
          'it flows within a sentence rather than rendering as a button-shaped control.',
      },
    },
  },
  render: () => html`
    <p style="max-inline-size: 32rem;">
      The message failed to send.
      <lr-button appearance="link" variant="brand">Retry</lr-button>
      or
      <lr-button appearance="link" variant="danger">cancel</lr-button>
      the request — both flow inline with this paragraph's font.
    </p>
  `,
};

export const NeutralAccentVsFilled: Story = {
  name: 'Neutral: accent vs. filled',
  render: () => html`
    <div style="display: flex; gap: 0.5rem;">
      <lr-button variant="neutral" appearance="accent">Accent (loud fill)</lr-button>
      <lr-button variant="neutral" appearance="filled">Filled (ambient surface)</lr-button>
    </div>
  `,
};

export const Sizes: Story = {
  render: () => html`
    <div style="display: flex; align-items: center; gap: 0.5rem;">
      <lr-button size="xs">XS</lr-button>
      <lr-button size="s">S</lr-button>
      <lr-button size="m">M</lr-button>
      <lr-button size="l">L</lr-button>
      <lr-button size="xl">XL</lr-button>
    </div>
  `,
};

export const CompactToolbarTier: Story = {
  name: 'Retuned tier (padding / font-size / height)',
  parameters: {
    docs: {
      description: {
        story:
          'Each `size` tier is expressed as `--lr-button-padding-block`, `--lr-button-padding-inline`, ' +
          '`--lr-button-font-size` and `--lr-button-min-height`, so a toolbar can retune a tier — or pin ' +
          'an exact row height with `--lr-button-height` — without a `::part(base)` rule. ' +
          '`--lr-button-height` is undeclared by default, which is what keeps each tier’s min-height ' +
          'floor working when it is unset.',
      },
    },
  },
  render: () => html`
    <div
      style="display: flex; align-items: center; gap: 0.25rem; padding: 0.25rem; border: 1px solid var(--lr-color-border); border-radius: var(--lr-radius); --lr-button-height: 28px; --lr-button-padding-inline: 0.5rem; --lr-button-padding-block: 0; --lr-button-font-size: 0.75rem;"
    >
      <lr-button size="s" appearance="quiet">Bold</lr-button>
      <lr-button size="s" appearance="quiet">Italic</lr-button>
      <lr-button size="s" appearance="outlined">Preview</lr-button>
      <lr-button size="s" appearance="accent" variant="brand">Publish</lr-button>
    </div>
  `,
};

export const OutlinedFill: Story = {
  name: 'Outlined fill (--lr-button-outlined-fill)',
  parameters: {
    docs: {
      description: {
        story:
          '`appearance="outlined"` is transparent by default; `--lr-button-outlined-fill` tints it ' +
          'without a `::part(base)` rule. It is not swapped per `variant` (same stance as ' +
          '`--lr-button-quiet-*`), and the hover `filter: brightness()` visibly affects a tinted fill.',
      },
    },
  },
  render: () => html`
    <div style="display: flex; align-items: center; gap: 0.5rem;">
      <lr-button appearance="outlined" variant="brand">Default (transparent)</lr-button>
      <lr-button
        appearance="outlined"
        variant="brand"
        style="--lr-button-outlined-fill: var(--lr-color-surface);"
        >Tinted fill</lr-button
      >
    </div>
  `,
};

export const GapAndRadiusTokens: Story = {
  name: 'Gap / radius tokens (--lr-button-gap, --lr-button-radius)',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-button-gap` (icon/label gap) and `--lr-button-radius` (corner radius) are retunable ' +
          'without a `::part(base)` rule, matching `--lr-button-padding-block/-inline`/' +
          '`--lr-button-font-size`. Neither varies by `size` tier — each is declared once on `:host`.',
      },
    },
  },
  render: () => html`
    <div style="display: flex; align-items: center; gap: 0.5rem;">
      <lr-button variant="brand">Default</lr-button>
      <lr-button variant="brand" style="--lr-button-gap: 0.75rem; --lr-button-radius: 999px;">
        Pill, wide gap
      </lr-button>
      <lr-button variant="brand" style="--lr-button-radius: 0;">Square corners</lr-button>
    </div>
  `,
};

export const Loading: Story = {
  render: () => html`<lr-button variant="brand" .loading=${true}>Saving…</lr-button>`,
};

export const Disabled: Story = {
  render: () => html`<lr-button disabled>Save</lr-button>`,
};

export const IconOnly: Story = {
  name: 'Icon-only (aria-label)',
  render: () => html`
    <lr-button appearance="plain" aria-label="Close dialog">
      <svg
        slot="start"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
      >
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </lr-button>
  `,
};

export const SubmitInAForm: Story = {
  name: 'Submit in a form',
  render: () => html`
    <form
      @submit=${(e: Event) => {
        e.preventDefault();
        alert('submitted');
      }}
    >
      <lr-button type="submit" variant="brand">Save</lr-button>
    </form>
  `,
};
