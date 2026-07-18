import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './tree-node.js';

const meta: Meta = { title: 'Navigation/Tree node', component: 'lr-tree-node', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-tree-node .item=${{ id: 'root', label: 'Root', children: [] }}></lr-tree-node>` };
