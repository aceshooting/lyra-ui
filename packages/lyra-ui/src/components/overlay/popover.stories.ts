import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './popover.js';

const meta: Meta = { title: 'Overlay/Popover', component: 'lyra-popover', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lyra-popover><button slot="trigger">Open details</button><p>Floating content.</p></lyra-popover>` };
