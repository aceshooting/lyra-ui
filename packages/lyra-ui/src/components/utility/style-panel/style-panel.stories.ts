import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../../lr-style-panel.js';

const meta: Meta = {
  title: 'Utility/Style Panel',
  component: 'lr-style-panel',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Ready-made appearance controls bound to `setLyraStyle()`: colour mode, look, surface, glass opacity, density, accent and reset. Every change is persisted and applied to the whole page, and the panel follows changes made elsewhere.',
      },
    },
  },
};

export default meta;

export const Default: StoryObj = {
  render: () => html`<lr-style-panel style="max-inline-size: 24rem;"></lr-style-panel>`,
};

export const SelectedAxes: StoryObj = {
  name: 'axes="mode accent" without reset',
  parameters: {
    docs: {
      description: {
        story: '`axes` picks which controls render and in what order; `without-reset` drops the reset button.',
      },
    },
  },
  render: () => html`<lr-style-panel axes="mode accent" without-reset style="max-inline-size: 24rem;"></lr-style-panel>`,
};
