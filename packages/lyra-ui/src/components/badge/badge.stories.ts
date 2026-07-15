import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './badge.js';
import './tag.js';
const meta: Meta = { title: 'Display/Badge', component: 'lyra-badge', tags: ['autodocs'] };
export default meta;
export const Variants: StoryObj = { render: () => html`<div style="display:flex;gap:0.5rem;flex-wrap:wrap"><lyra-badge>Neutral</lyra-badge><lyra-badge variant="success">Ready</lyra-badge><lyra-tag variant="brand">Tag</lyra-tag></div>` };
