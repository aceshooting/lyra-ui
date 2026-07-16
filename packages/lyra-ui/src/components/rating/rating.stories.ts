import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './rating.js';
const meta: Meta = { title: 'Form/Rating', component: 'lyra-rating', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lyra-rating value="3" aria-label="Satisfaction"></lyra-rating>` };
export const HalfStarPrecision: StoryObj = {
  render: () => html`<lyra-rating value="3.5" precision="0.5" max="5" aria-label="Satisfaction"></lyra-rating>`,
};
export const CustomTheming: StoryObj = {
  render: () => html`<lyra-rating
    value="4"
    aria-label="Satisfaction"
    style="--lyra-rating-fill: seagreen; --lyra-rating-empty-color: gainsboro; --lyra-rating-size: 2rem;"
  ></lyra-rating>`,
};
