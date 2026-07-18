import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './checkbox-group.js'; import '../checkbox/checkbox.js';
const meta: Meta = { title: 'Checkbox Group', component: 'lr-checkbox-group', tags: ['autodocs'] }; export default meta; type Story = StoryObj;
export const Default: Story = { render: () => html`<lr-checkbox-group label="Topics" name="topics"><lr-checkbox value="news">News</lr-checkbox><lr-checkbox value="product">Product updates</lr-checkbox></lr-checkbox-group>` };
