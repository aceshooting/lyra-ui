import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './breadcrumb.js';
import './breadcrumb-item.js';
const meta: Meta = { title: 'Navigation/Breadcrumb', component: 'lyra-breadcrumb', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lyra-breadcrumb><lyra-breadcrumb-item href="/">Home</lyra-breadcrumb-item><lyra-breadcrumb-item href="/reports">Reports</lyra-breadcrumb-item><lyra-breadcrumb-item current>Current</lyra-breadcrumb-item></lyra-breadcrumb>` };
