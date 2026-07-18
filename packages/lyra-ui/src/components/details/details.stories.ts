import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './details.js';

const meta: Meta = { title: 'Disclosure/Details', component: 'lr-details', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-details summary="More information">Additional details.</lr-details>` };
