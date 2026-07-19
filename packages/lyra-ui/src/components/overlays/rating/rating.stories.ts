import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './rating.js';
const meta: Meta = { title: 'Form/Rating', component: 'lr-rating', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-rating value="3" aria-label="Satisfaction"></lr-rating>` };
export const HalfStarPrecision: StoryObj = {
  render: () => html`<lr-rating value="3.5" precision="0.5" max="5" aria-label="Satisfaction"></lr-rating>`,
};
export const CustomTheming: StoryObj = {
  render: () => html`<lr-rating
    value="4"
    aria-label="Satisfaction"
    style="--lr-rating-fill: seagreen; --lr-rating-empty-color: gainsboro; --lr-rating-size: 2rem;"
  ></lr-rating>`,
};
