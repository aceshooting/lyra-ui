import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './visually-hidden.js';

const meta: Meta = { title: 'Utility/Visually hidden', component: 'lr-visually-hidden', tags: ['autodocs'] };
export default meta;

export const Default: StoryObj = {
  render: () => html`
    <p>
      Fruit total: 12
      <lr-visually-hidden>items currently in the shopping basket</lr-visually-hidden>
    </p>
  `,
};

export const SkipLink: StoryObj = {
  name: 'Skip link (Tab to reveal)',
  render: () => html`
    <lr-visually-hidden><a href="#main-content">Skip to main content</a></lr-visually-hidden>
    <p id="main-content">Press Tab from the top of this frame to reveal the skip link.</p>
  `,
};
