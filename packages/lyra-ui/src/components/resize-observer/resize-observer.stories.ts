import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './resize-observer.js';

const meta: Meta = { title: 'Utilities/Resize Observer', component: 'lyra-resize-observer' };
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lyra-resize-observer @lyra-resize=${(event: CustomEvent) => console.log(event.detail.entries)}>
    <div style="padding: var(--lyra-space-l); border: var(--lyra-border-width-thin) solid var(--lyra-color-border);">Resize the parent or this element</div>
  </lyra-resize-observer>`,
};
