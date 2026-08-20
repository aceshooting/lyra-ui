import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './funnel.js';

const meta: Meta = {
  title: 'Data Display/Funnel',
  component: 'lr-funnel',
  tags: ['autodocs'],
};

export default meta;

export const Default: StoryObj = {
  render: () => html`<lr-funnel>Populated Funnel content</lr-funnel>`,
};
