import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './resize-observer.js';

const meta: Meta = { title: 'Utilities/Resize Observer', component: 'lr-resize-observer' };
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-resize-observer @lr-resize=${(event: CustomEvent) => console.log(event.detail.entries)}>
    <div style="padding: var(--lr-space-l); border: var(--lr-border-width-thin) solid var(--lr-color-border);">Resize the parent or this element</div>
  </lr-resize-observer>`,
};
