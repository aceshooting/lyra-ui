import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './dropdown-item.js';

const meta: Meta = { title: 'Components/Dropdown Item', component: 'lr-dropdown-item' };
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-dropdown-item value="archive">Archive</lr-dropdown-item>`,
};

export const Sizes: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The same six-step ladder `<lr-menu-item>` carries, inherited rather than reimplemented. `small`/`medium`/`large` are accepted as synonyms of `s`/`m`/`l`.',
      },
    },
  },
  render: () => html`
    <div role="menu" aria-label="Sizes" style="display: flex; flex-direction: column; inline-size: 18rem;">
      <lr-dropdown-item size="xs" value="a">Extra small</lr-dropdown-item>
      <lr-dropdown-item size="s" value="b">Small</lr-dropdown-item>
      <lr-dropdown-item size="m" value="c">Medium (default)</lr-dropdown-item>
      <lr-dropdown-item size="l" value="d">Large</lr-dropdown-item>
      <lr-dropdown-item size="xl" value="e">Extra large</lr-dropdown-item>
    </div>
  `,
};
