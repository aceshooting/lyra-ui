import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './mutation-observer.js';

const meta: Meta = { title: 'Utilities/Mutation Observer', component: 'lr-mutation-observer' };
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-mutation-observer attributes child-list @lr-mutation=${(event: CustomEvent) => console.log(event.detail.records)}>
    <div contenteditable="true" style="padding: var(--lr-space-l); border: var(--lr-border-width-thin) solid var(--lr-color-border);">Edit this content</div>
  </lr-mutation-observer>`,
};
