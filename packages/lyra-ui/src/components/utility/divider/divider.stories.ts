import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './divider.js';
const meta: Meta = { title: 'Layout/Divider', component: 'lr-divider', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<p>Above</p><lr-divider></lr-divider><p>Below</p>` };

export const VerticalAliasAndThemeHooks: StoryObj = {
  render: () => html`
    <div style="display:flex;align-items:stretch;block-size:var(--lr-size-3rem);gap:var(--lr-space-m)">
      <span>Start</span>
      <lr-divider
        vertical
        style="--width:var(--lr-border-width-medium);--color:var(--lr-color-brand);--spacing:var(--lr-space-xs)"
      ></lr-divider>
      <span>End</span>
    </div>
  `,
};
