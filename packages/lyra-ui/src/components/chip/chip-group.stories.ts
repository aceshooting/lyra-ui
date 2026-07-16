import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './chip-group.js';
import './chip.js';

const meta: Meta = { title: 'Data display/Chip group', component: 'lyra-chip-group', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lyra-chip-group><lyra-chip>Lit</lyra-chip><lyra-chip>Web components</lyra-chip></lyra-chip-group>` };
