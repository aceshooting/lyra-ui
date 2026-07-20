import type { Meta, StoryObj } from '@storybook/web-components-vite'; import { html } from 'lit'; import './icon-button.js'; import '../../media/flag/flag-peer.js';
const meta: Meta = { title: 'Icon Button', component: 'lr-icon-button', tags: ['autodocs'] }; export default meta; type Story = StoryObj;
export const Actions: Story = { render: () => html`<div style="display:flex;gap:0.5rem"><lr-icon-button icon="search" aria-label="Search"></lr-icon-button><lr-icon-button icon="close" aria-label="Close"></lr-icon-button></div>` };
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
