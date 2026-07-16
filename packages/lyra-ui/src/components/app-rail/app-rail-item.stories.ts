import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './app-rail-item.js';

const meta: Meta = { title: 'Navigation/App rail item', component: 'lyra-app-rail-item', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lyra-app-rail-item href="/home">Home</lyra-app-rail-item>` };
