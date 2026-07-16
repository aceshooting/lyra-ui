import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './tree-node.js';

const meta: Meta = { title: 'Navigation/Tree node', component: 'lyra-tree-node', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lyra-tree-node .item=${{ id: 'root', label: 'Root', children: [] }}></lyra-tree-node>` };
