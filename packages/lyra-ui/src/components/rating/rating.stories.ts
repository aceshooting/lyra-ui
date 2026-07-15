import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './rating.js';
const meta: Meta = { title: 'Form/Rating', component: 'lyra-rating', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lyra-rating value="3" aria-label="Satisfaction"></lyra-rating>` };
