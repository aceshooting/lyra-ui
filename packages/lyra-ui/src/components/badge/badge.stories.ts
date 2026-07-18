import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './badge.js';
import './tag.js';
const meta: Meta = { title: 'Display/Badge', component: 'lr-badge', tags: ['autodocs'] };
export default meta;
export const Variants: StoryObj = { render: () => html`<div style="display:flex;gap:0.5rem;flex-wrap:wrap"><lr-badge>Neutral</lr-badge><lr-badge variant="success">Ready</lr-badge><lr-tag variant="brand">Tag</lr-tag></div>` };
