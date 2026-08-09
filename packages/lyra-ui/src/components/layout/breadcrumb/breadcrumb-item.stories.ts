import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './breadcrumb-item.js';
import './breadcrumb.js';
import { storyColor } from '../../../../../../.storybook/theme-contract.js';

const meta: Meta = { title: 'Navigation/Breadcrumb item', component: 'lr-breadcrumb-item', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-breadcrumb-item href="/docs">Documentation</lr-breadcrumb-item>` };

export const ProgrammaticActivation: StoryObj = {
  name: 'Programmatic click()',
  parameters: {
    docs: {
      description: {
        story:
          'Calling `click()` on a non-current item forwards to its native link or button. A current-page label remains inert.',
      },
    },
  },
  render: () => html`
    <div>
      <lr-breadcrumb>
        <lr-breadcrumb-item id="programmatic-breadcrumb-item">Open section</lr-breadcrumb-item>
      </lr-breadcrumb>
      <button
        type="button"
        @click=${() => document.getElementById('programmatic-breadcrumb-item')?.click()}
      >
        Call host click()
      </button>
    </div>
  `,
};

export const UndefinedHrefClears: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          'A mapped `undefined` property write clears `href` to the canonical empty string, so this item renders its native button form.',
      },
    },
  },
  render: () => html`
    <lr-breadcrumb>
      <lr-breadcrumb-item .href=${undefined}>Button after an undefined href write</lr-breadcrumb-item>
    </lr-breadcrumb>
  `,
};

export const AdornmentsAndTarget: StoryObj = {
  render: () => html`
    <lr-breadcrumb>
      <lr-breadcrumb-item href="https://example.com" target="_blank">
        <span slot="prefix" aria-hidden="true">◆</span>
        Documentation
        <span slot="end" aria-hidden="true">↗</span>
      </lr-breadcrumb-item>
    </lr-breadcrumb>
  `,
};

/** The current-page item's color is themeable through `--lr-breadcrumb-current-color`. It is not
 *  declared on `:host`, so setting it on an ancestor recolors only the current item — not
 *  everything else reading `--lr-color-text-quiet`. */
export const ThemedCurrent: StoryObj = {
  name: 'Themed current item (cssprop)',
  parameters: {
    docs: {
      description: {
        story:
          'Set `--lr-breadcrumb-current-color` and `--lr-breadcrumb-item-active-bg` on the element or any ancestor to theme current and pressed states independently.',
      },
    },
  },
  render: () => html`
    <lr-breadcrumb style="--lr-breadcrumb-current-color: ${storyColor(
      'brand',
    )}; --lr-breadcrumb-item-active-bg: ${storyColor('warningQuiet')};">
      <lr-breadcrumb-item href="/">Home</lr-breadcrumb-item>
      <lr-breadcrumb-item href="/reports">Reports</lr-breadcrumb-item>
      <lr-breadcrumb-item current>Q3 summary</lr-breadcrumb-item>
    </lr-breadcrumb>
  `,
};
