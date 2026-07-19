import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './intersection-observer.js';

const meta: Meta = { title: 'Utilities/Intersection Observer', component: 'lr-intersection-observer' };
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-intersection-observer @lr-intersection=${(event: CustomEvent) => console.log(event.detail.entries)}>
    <div style="min-block-size: 8rem; border: var(--lr-border-width-thin) solid var(--lr-color-border);">Observed element</div>
  </lr-intersection-observer>`,
};
