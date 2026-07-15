import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './intersection-observer.js';

const meta: Meta = { title: 'Utilities/Intersection Observer', component: 'lyra-intersection-observer' };
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lyra-intersection-observer @lyra-intersection=${(event: CustomEvent) => console.log(event.detail.entries)}>
    <div style="min-block-size: 8rem; border: var(--lyra-border-width-thin) solid var(--lyra-color-border);">Observed element</div>
  </lyra-intersection-observer>`,
};
