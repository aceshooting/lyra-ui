import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './tree-item.js';

const meta: Meta = { title: 'Navigation/Tree node', component: 'lr-tree-item', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-tree-item .item=${{ id: 'root', label: 'Root', children: [] }}></lr-tree-item>` };
