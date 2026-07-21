import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './lightbox.js';
import type { LyraLightbox } from './lightbox.js';

const meta: Meta = {
  title: 'Lightbox',
  component: 'lr-lightbox',
  tags: ['autodocs'],
  // CSS custom properties are documented in the API table, but they are not story args.
  // Keeping them out of the Controls panel avoids Storybook inferring a color control with
  // no runtime value while still leaving the CSS contract visible in the generated docs.
  argTypes: {
    '--lr-lightbox-overlay-color': { control: false },
    '--lr-lightbox-control-bg': { control: false },
    '--lr-lightbox-control-color': { control: false },
  },
};
export default meta;
type Story = StoryObj;

const images = [
  {
    src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="640" height="360"%3E%3Crect width="640" height="360" fill="%230969da"/%3E%3C/svg%3E',
    alt: 'Blue illustration',
    caption: 'Blue illustration',
  },
  {
    src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="640" height="360"%3E%3Crect width="640" height="360" fill="%23cf222e"/%3E%3C/svg%3E',
    alt: 'Red illustration',
    caption: 'Red illustration',
  },
];

export const Default: Story = {
  render: () => html`
    <button @click=${(event: Event) => {
      const lightbox = (event.currentTarget as HTMLElement).nextElementSibling as LyraLightbox;
      lightbox.open = true;
    }}>Open lightbox</button>
    <lr-lightbox .images=${images}></lr-lightbox>
  `,
};

export const OpenInitially: Story = {
  render: (_args, context) => html`<lr-lightbox .images=${images} .open=${context.viewMode !== 'docs'}></lr-lightbox>`,
};

/** The 320px narrow-allocation baseline for the toolbar row (counter + actions slot +
 *  close-button) -- exercises lightbox.styles.ts's own documented `@container (max-inline-size:
 *  20rem)` rule, which shrinks `[part="counter"]`. `:host` is normally `position: fixed; inset:
 *  0`, filling the viewport regardless of any wrapping container, so its `position`/`inset` are
 *  overridden inline here (an inline `style=""` attribute always wins over the component's own
 *  `:host` rule) to confine it to a narrow, in-flow box for this story only -- mirrors
 *  pagination.stories.ts's `NarrowAllocation` story, adapted for a fixed-position host. */
export const NarrowAllocation: Story = {
  render: (_args, context) => html`<lr-lightbox
    .images=${images}
    .open=${context.viewMode !== 'docs'}
    style="position: static; inset: auto; display: flex; inline-size: 20rem; block-size: 24rem;"
  ></lr-lightbox>`,
};
