import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './chip-group.js';
import './chip.js';

const meta: Meta = { title: 'Data display/Chip group', component: 'lr-chip-group', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-chip-group><lr-chip>Lit</lr-chip><lr-chip>Web components</lr-chip></lr-chip-group>` };
