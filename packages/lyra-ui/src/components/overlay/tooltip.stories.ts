import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './tooltip.js';

const meta: Meta = { title: 'Overlay/Tooltip', component: 'lyra-tooltip', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lyra-tooltip delay="0">Helpful context<button slot="trigger">Hover or focus</button></lyra-tooltip>` };
