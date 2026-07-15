import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './mutation-observer.js';

const meta: Meta = { title: 'Utilities/Mutation Observer', component: 'lyra-mutation-observer' };
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lyra-mutation-observer attributes child-list @lyra-mutation=${(event: CustomEvent) => console.log(event.detail.records)}>
    <div contenteditable="true" style="padding: var(--lyra-space-l); border: var(--lyra-border-width-thin) solid var(--lyra-color-border);">Edit this content</div>
  </lyra-mutation-observer>`,
};
