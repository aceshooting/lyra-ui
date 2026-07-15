import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './card.js';

const meta: Meta = {
  title: 'Card',
  component: 'lyra-card',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A generic, styled bordered content container — the "small bordered surface with padding" idiom common to hero highlights, clickable grid tiles, and management-list items. A direct `<lyra-*>` counterpart to `<wa-card>`\'s contract. `appearance` picks the visual treatment, `interactive` opts into a hover/focus-visible affordance for a card used as a clickable tile, and `href` renders the card\'s root as a real `<a>` for a whole-card link.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Outlined: Story = {
  render: () => html`
    <lyra-card style="max-inline-size:20rem;">
      A bordered surface with padding — the default <code>appearance="outlined"</code>.
    </lyra-card>
  `,
};

export const Filled: Story = {
  render: () => html`
    <lyra-card appearance="filled" style="max-inline-size:20rem;"> A quiet-brand filled surface, no border. </lyra-card>
  `,
};

export const FilledOutlined: Story = {
  name: 'Filled + outlined',
  render: () => html`
    <lyra-card appearance="filled-outlined" style="max-inline-size:20rem;">
      A quiet-brand filled surface that keeps its border.
    </lyra-card>
  `,
};

export const Accent: Story = {
  render: () => html`
    <lyra-card appearance="accent" style="max-inline-size:20rem;">
      A brand-colored accent stripe on the leading edge instead of a full border.
    </lyra-card>
  `,
};

export const Plain: Story = {
  render: () => html`
    <lyra-card appearance="plain" style="max-inline-size:20rem;"> No border, no background — layout only. </lyra-card>
  `,
};

export const Interactive: Story = {
  render: () => html`
    <lyra-card interactive style="max-inline-size:20rem;">
      Hover or focus this card to see the border-color and cursor affordance for a clickable tile.
    </lyra-card>
  `,
};

export const AsLink: Story = {
  name: 'href (renders as <a>)',
  render: () => html`
    <lyra-card href="https://example.com" interactive style="max-inline-size:20rem;">
      The whole card is a real link — inspect the shadow root to see the <code>&lt;a part="base"&gt;</code> root.
    </lyra-card>
  `,
};

export const WithAllSlots: Story = {
  name: 'header / media / footer / actions slots',
  render: () => html`
    <lyra-card style="max-inline-size:20rem;">
      <img
        slot="media"
        src="https://picsum.photos/seed/lyra-card/400/200"
        alt=""
        style="inline-size:100%; display:block;"
      />
      <span slot="header" style="font-weight:600;">Rooftop install No. 4021</span>
      <button
        slot="actions"
        type="button"
        style="border:none;background:none;color:var(--lyra-color-brand);font:inherit;font-size:0.75rem;font-weight:600;cursor:pointer;padding:0;"
        @click=${() => alert('Edit (demo only)')}
      >
        Edit
      </button>
      Body content describing the card in more detail — any content is accepted here.
      <span slot="footer" style="font-size:0.75rem; color:var(--lyra-color-text-quiet);">Updated 2 days ago</span>
    </lyra-card>
  `,
};

export const HeaderOnly: Story = {
  name: 'header slot only (no media/footer)',
  render: () => html`
    <lyra-card style="max-inline-size:20rem;">
      <span slot="header" style="font-weight:600;">Untitled document</span>
      Body content with just a header row above it — media and footer stay hidden since nothing is
      slotted into them.
    </lyra-card>
  `,
};

export const NarrowHeaderActions: Story = {
  name: 'Narrow header with long content and actions',
  parameters: {
    docs: {
      description: {
        story:
          'At a 320px allocation, long or translated header content wraps and the actions group can move to another line without overflowing the card.',
      },
    },
  },
  render: () => html`
    <lyra-card style="inline-size:320px; max-inline-size:100%;">
      <span slot="header" style="font-weight:600;">
        Vierteljährliche Energieerzeugungsprognose für die Dachanlage
      </span>
      <span slot="actions">
        <button type="button">Review</button>
        <button type="button">Share</button>
      </span>
      Body content remains within the same narrow allocation.
    </lyra-card>
  `,
};
