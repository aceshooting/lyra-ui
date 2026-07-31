import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './popup.js';

const meta: Meta = { title: 'Overlays/Popup', component: 'lr-popup', tags: ['autodocs'] };
export default meta;

const panel = (text: string) => html`
  <div style="padding: 0.5rem 0.75rem; border: 1px solid var(--lr-color-border); border-radius: var(--lr-radius); background: var(--lr-color-surface-raised);">
    ${text}
  </div>
`;

export const Default: StoryObj = {
  render: () => html`
    <div style="padding: 4rem;">
      <lr-popup active placement="bottom-start">
        <button slot="anchor">Anchor</button>
        ${panel('Positioned content')}
      </lr-popup>
    </div>
  `,
};

export const WithArrow: StoryObj = {
  render: () => html`
    <div style="padding: 4rem;">
      <lr-popup active arrow placement="top" distance="8">
        <button slot="anchor">Anchor</button>
        ${panel('Points at its anchor')}
      </lr-popup>
    </div>
  `,
};

export const ExternalAnchor: StoryObj = {
  name: 'Anchored by id (for)',
  render: () => html`
    <div style="padding: 4rem;">
      <button id="popup-external-anchor">Elsewhere in the tree</button>
      <lr-popup active for="popup-external-anchor" placement="right">${panel('Anchored by id')}</lr-popup>
    </div>
  `,
};
