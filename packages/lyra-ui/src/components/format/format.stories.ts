import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './format-number.js';
import './format-date.js';
import './format-bytes.js';
import './relative-time.js';
const meta: Meta = { title: 'Utilities/Formatting', component: 'lyra-format-number', tags: ['autodocs'] };
export default meta;
export const Examples: StoryObj = { render: () => html`<div style="display:grid;gap:0.5rem"><lyra-format-number value="12345.67"></lyra-format-number><lyra-format-date date="2024-01-01"></lyra-format-date><lyra-format-bytes value="1048576"></lyra-format-bytes><lyra-relative-time date="2030-01-01"></lyra-relative-time></div>` };
