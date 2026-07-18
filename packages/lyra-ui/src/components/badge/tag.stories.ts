import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './tag.js';

const meta: Meta = { title: 'Display/Tag', component: 'lr-tag', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-tag variant="brand">Example tag</lr-tag>` };
