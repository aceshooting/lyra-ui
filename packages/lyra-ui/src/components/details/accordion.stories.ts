import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './accordion.js';
import './accordion-item.js';

const meta: Meta = { title: 'Disclosure/Accordion', component: 'lr-accordion', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-accordion><lr-accordion-item summary="First">First panel</lr-accordion-item><lr-accordion-item summary="Second">Second panel</lr-accordion-item></lr-accordion>` };
