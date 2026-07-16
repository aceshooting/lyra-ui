import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './accordion-item.js';

const meta: Meta = { title: 'Disclosure/Accordion item', component: 'lyra-accordion-item', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lyra-accordion-item summary="Details" open>Content</lyra-accordion-item>` };
