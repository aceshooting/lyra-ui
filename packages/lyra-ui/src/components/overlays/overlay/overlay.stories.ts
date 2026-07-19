import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './popover.js';
import './tooltip.js';
import './dropdown.js';
const meta: Meta = { title: 'Overlay/Positioned surfaces', component: 'lr-popover', tags: ['autodocs'] };
export default meta;
export const Popover: StoryObj = { render: () => html`<lr-popover><button slot="trigger">Open details</button><p>Floating content.</p></lr-popover>` };
export const Tooltip: StoryObj = { render: () => html`<lr-tooltip delay="0">Helpful context<button slot="trigger">Hover or focus</button></lr-tooltip>` };
