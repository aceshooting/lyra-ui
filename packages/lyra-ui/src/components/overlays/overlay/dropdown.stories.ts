import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './dropdown.js';

const meta: Meta = { title: 'Overlay/Dropdown', component: 'lr-dropdown', tags: ['autodocs'] };
export default meta;
// Forced open in the story canvas (but not in autodocs, viewMode === 'docs') so the visual-
// regression harness and anyone opening the story lands on the actual dropdown surface rather than
// a bare closed trigger -- the same `.open` pattern lr-dialog and lr-drawer use.
export const Default: StoryObj = {
  render: (_args, context) =>
    html`<lr-dropdown .open=${context.viewMode !== 'docs'}
      ><button slot="trigger">Open menu</button><button role="menuitem" type="button">Menu action</button></lr-dropdown
    >`,
};
