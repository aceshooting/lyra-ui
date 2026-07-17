import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './button.js';

const meta: Meta = {
  title: 'Button',
  component: 'lyra-button',
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
  render: () => html`<lyra-button>Save</lyra-button>`,
};

export const Variants: Story = {
  render: () => html`
    <div style="display: flex; gap: 0.5rem;">
      <lyra-button variant="neutral">Neutral</lyra-button>
      <lyra-button variant="brand">Brand</lyra-button>
      <lyra-button variant="success">Success</lyra-button>
      <lyra-button variant="warning">Warning</lyra-button>
      <lyra-button variant="danger">Danger</lyra-button>
    </div>
  `,
};

export const Appearances: Story = {
  render: () => html`
    <div style="display: flex; align-items: center; gap: 0.5rem;">
      <lyra-button variant="brand" appearance="accent">Accent</lyra-button>
      <lyra-button variant="brand" appearance="filled">Filled</lyra-button>
      <lyra-button variant="brand" appearance="outlined">Outlined</lyra-button>
      <lyra-button variant="brand" appearance="plain">Plain</lyra-button>
      <lyra-button variant="brand" appearance="link">Link</lyra-button>
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
      <lyra-button appearance="link" variant="brand">Retry</lyra-button>
      or
      <lyra-button appearance="link" variant="danger">cancel</lyra-button>
      the request — both flow inline with this paragraph's font.
    </p>
  `,
};

export const NeutralAccentVsFilled: Story = {
  name: 'Neutral: accent vs. filled',
  render: () => html`
    <div style="display: flex; gap: 0.5rem;">
      <lyra-button variant="neutral" appearance="accent">Accent (loud fill)</lyra-button>
      <lyra-button variant="neutral" appearance="filled">Filled (ambient surface)</lyra-button>
    </div>
  `,
};

export const Sizes: Story = {
  render: () => html`
    <div style="display: flex; align-items: center; gap: 0.5rem;">
      <lyra-button size="xs">XS</lyra-button>
      <lyra-button size="s">S</lyra-button>
      <lyra-button size="m">M</lyra-button>
      <lyra-button size="l">L</lyra-button>
      <lyra-button size="xl">XL</lyra-button>
    </div>
  `,
};

export const Loading: Story = {
  render: () => html`<lyra-button variant="brand" .loading=${true}>Saving…</lyra-button>`,
};

export const Disabled: Story = {
  render: () => html`<lyra-button disabled>Save</lyra-button>`,
};

export const IconOnly: Story = {
  name: 'Icon-only (aria-label)',
  render: () => html`
    <lyra-button appearance="plain" aria-label="Close dialog">
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
    </lyra-button>
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
      <lyra-button type="submit" variant="brand">Save</lyra-button>
    </form>
  `,
};
