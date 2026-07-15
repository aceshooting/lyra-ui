import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './popover.js';
import './tooltip.js';
import './dropdown.js';
const meta: Meta = { title: 'Overlay/Positioned surfaces', component: 'lyra-popover', tags: ['autodocs'] };
export default meta;
export const Popover: StoryObj = { render: () => html`<lyra-popover><button slot="trigger">Open details</button><p>Floating content.</p></lyra-popover>` };
export const Tooltip: StoryObj = { render: () => html`<lyra-tooltip delay="0">Helpful context<button slot="trigger">Hover or focus</button></lyra-tooltip>` };
