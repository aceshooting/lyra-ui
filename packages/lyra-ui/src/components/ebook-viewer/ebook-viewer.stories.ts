import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './ebook-viewer.js';

const meta: Meta = { title: 'Viewers/Ebook viewer', component: 'lyra-ebook-viewer', tags: ['autodocs'] };
export default meta;
export const Empty: StoryObj = { render: () => html`<lyra-ebook-viewer aria-label="Ebook preview"></lyra-ebook-viewer>` };
