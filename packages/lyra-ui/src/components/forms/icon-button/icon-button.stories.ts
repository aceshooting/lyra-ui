import type { Meta, StoryObj } from '@storybook/web-components-vite'; import { html } from 'lit'; import './icon-button.js'; import '../button/button.js'; import '../../media/flag/flag-peer.js';
const meta: Meta = { title: 'Icon Button', component: 'lr-icon-button', tags: ['autodocs'] }; export default meta; type Story = StoryObj;
export const Actions: Story = { render: () => html`<div style="display:flex;gap:0.5rem"><lr-icon-button icon="search" aria-label="Search"></lr-icon-button><lr-icon-button icon="close" aria-label="Close"></lr-icon-button></div>` };
export const LiveDescription: Story = {
  parameters: {
    docs: { description: { story: 'External description targets stay current when their source element is replaced, removed or reinserted, including native link mode.' } },
  },
  render: () => html`
    <div>
      <p id="icon-button-live-guidance">Searches the current collection.</p>
      <lr-icon-button icon="search" label="Search" aria-describedby="icon-button-live-guidance"></lr-icon-button>
      <button type="button" @click=${(event: Event) => {
        const source = (event.currentTarget as HTMLElement).parentElement?.querySelector('#icon-button-live-guidance');
        if (source) {
          const replacement = source.ownerDocument.createElement('p');
          replacement.id = source.id;
          replacement.textContent = 'Searches the updated collection.';
          source.replaceWith(replacement);
        }
      }}>Replace description</button>
    </div>
  `,
};

export const BorderedTinted: Story = {
  name: 'Bordered and tinted',
  render: () => html`
    <lr-icon-button
      icon="search"
      aria-label="Search"
      style="
        --lr-icon-button-border: var(--lr-border-width-thin) solid var(--lr-color-border);
        --lr-icon-button-border-hover: var(--lr-border-width-thin) solid var(--lr-color-brand);
        --lr-icon-button-background: var(--lr-color-brand-quiet);
        --lr-icon-button-background-hover: var(--lr-color-brand);
        --lr-icon-button-color: var(--lr-color-brand);
        --lr-icon-button-color-hover: var(--lr-color-surface);
      "
    ></lr-icon-button>
  `,
};
export const SlottedContent: Story = {
  name: 'Slotted content (natural aspect ratio)',
  render: () => html`
    <p style="max-inline-size:44ch">
      <code>--lr-icon-button-size</code> is a tappable-target floor, not a fixed size. The glyph
      button pads out to it; the flag button keeps the flag's own 4:3 ratio.
    </p>
    <div style="display:flex;gap:0.5rem;align-items:center">
      <lr-icon-button icon="chevron-down" aria-label="Choose a language"></lr-icon-button>
      <lr-icon-button aria-label="Français">
        <lr-flag language="fr" label="" style="block-size:1.5rem"></lr-flag>
      </lr-icon-button>
    </div>
  `,
};

export const ShoelaceAliasesAndLink: Story = {
  name: 'Shoelace name and link surface',
  parameters: {
    docs: {
      description: {
        story:
          '`name`, `library`, `href`, `target`, and `download` can be retained when migrating a ' +
          'Shoelace icon button. Link mode renders a native anchor and derives the safe `rel` value.',
      },
    },
  },
  render: () => html`
    <div style="display:flex;gap:var(--lr-space-s);align-items:center">
      <lr-icon-button name="search" library="default" label="Search"></lr-icon-button>
      <lr-icon-button
        name="chevron-right"
        label="Open documentation"
        href="https://example.com/docs"
        target="_blank"
      ></lr-icon-button>
    </div>
  `,
};

export const FormActionsUseButton: Story = {
  name: 'Form actions use lr-button',
  parameters: {
    docs: {
      description: {
        story:
          'Icon button is a pure icon action/link. A circular lr-button owns the complete submitter contract for icon-only form actions.',
      },
    },
  },
  render: () => html`
    <form @submit=${(event: SubmitEvent) => event.preventDefault()}>
      <lr-button circle type="submit" aria-label="Save"><lr-icon name="check"></lr-icon></lr-button>
    </form>
  `,
};

/** A component hook inherited from a theme wrapper overrides the built-in radius fallback. */
export const AncestorTheme: Story = {
  render: () => html`
    <div style="--lr-icon-button-radius: var(--lr-radius-pill)">
      <lr-icon-button icon="search" aria-label="Search"></lr-icon-button>
    </div>
  `,
};
