import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './details.js';
import './accordion.js';
import './accordion-item.js';
const meta: Meta = { title: 'Disclosure/Accordion', component: 'lyra-accordion', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lyra-accordion><lyra-accordion-item summary="First">First panel</lyra-accordion-item><lyra-accordion-item summary="Second">Second panel</lyra-accordion-item></lyra-accordion>` };
export const StandaloneDetails: StoryObj = { render: () => html`<lyra-details summary="More information">Additional details.</lyra-details>` };
