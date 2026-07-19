import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './breadcrumb.js';
import './breadcrumb-item.js';
const meta: Meta = { title: 'Navigation/Breadcrumb', component: 'lr-breadcrumb', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-breadcrumb><lr-breadcrumb-item href="/">Home</lr-breadcrumb-item><lr-breadcrumb-item href="/reports">Reports</lr-breadcrumb-item><lr-breadcrumb-item current>Current</lr-breadcrumb-item></lr-breadcrumb>` };
