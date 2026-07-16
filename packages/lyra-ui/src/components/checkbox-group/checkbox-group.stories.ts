import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './checkbox-group.js'; import '../checkbox/checkbox.js';
const meta: Meta = { title: 'Checkbox Group', component: 'lyra-checkbox-group', tags: ['autodocs'] }; export default meta; type Story = StoryObj;
export const Default: Story = { render: () => html`<lyra-checkbox-group label="Topics" name="topics"><lyra-checkbox value="news">News</lyra-checkbox><lyra-checkbox value="product">Product updates</lyra-checkbox></lyra-checkbox-group>` };
