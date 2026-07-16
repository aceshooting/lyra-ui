import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './breadcrumb-item.js';

const meta: Meta = { title: 'Navigation/Breadcrumb item', component: 'lyra-breadcrumb-item', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lyra-breadcrumb-item href="/docs">Documentation</lyra-breadcrumb-item>` };
