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

const longAction = 'Download-the-original-image-with-an-intentionally-unbroken-action-label';

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

/** A finite fractional `goTo()` request is truncated toward zero before it selects the destination
 * image. The constrained in-flow layout keeps the trigger usable in Canvas. */
export const FractionalProgrammaticNavigation: Story = {
  render: (_args, context) => html`
    <button @click=${(event: Event) => {
      const lightbox = (event.currentTarget as HTMLElement).nextElementSibling as LyraLightbox;
      lightbox.goTo(1.9);
      lightbox.open = true;
    }}>Go to index 1.9</button>
    <lr-lightbox
      .images=${images}
      .open=${context.viewMode !== 'docs'}
      style="position: static; inset: auto; display: flex; inline-size: 32rem; block-size: 24rem;"
    ></lr-lightbox>
  `,
};

/** Hides only the visible numeric counter. The polite live region remains active so assistive
 * technology still receives the current image position as navigation occurs. */
export const CounterHidden: Story = {
  render: (_args, context) => html`
    <lr-lightbox
      .images=${images}
      .open=${context.viewMode !== 'docs'}
      .showCounter=${false}
    ></lr-lightbox>
  `,
};

/** An in-flow 320px allocation exercises the toolbar with a long unbroken slotted action while
 * the built-in close control remains available. */
export const NarrowAllocation: Story = {
  name: 'Narrow long action (320px)',
  parameters: {
    docs: {
      description: {
        story: 'An exact 320px LTR allocation wraps a long unbroken slotted action without hiding or shrinking the close control.',
      },
    },
  },
  render: (_args, context) => html`<lr-lightbox
    .images=${images}
    .open=${context.viewMode !== 'docs'}
    style="position: static; inset: auto; display: flex; inline-size: 320px; block-size: 24rem;"
  >
    <button slot="actions">${longAction}</button>
  </lr-lightbox>`,
};

export const NarrowRtlLongActions: Story = {
  name: 'Narrow RTL long action (320px)',
  parameters: {
    docs: {
      description: {
        story: 'An exact 320px RTL allocation keeps a long unbroken slotted action contained while the close control remains reachable.',
      },
    },
  },
  render: (_args, context) => html`<lr-lightbox
    dir="rtl"
    .images=${images}
    .open=${context.viewMode !== 'docs'}
    style="position: static; inset: auto; display: flex; inline-size: 320px; block-size: 24rem;"
  >
    <button slot="actions">${longAction}</button>
  </lr-lightbox>`,
};

export const NarrowLongCaptions: Story = {
  render: (_args, context) => html`<lr-lightbox
    .images=${images.map((image) => ({ ...image, caption: 'A deliberately long caption that wraps at the narrow 320px allocation.' }))}
    .open=${context.viewMode !== 'docs'}
    style="position: static; inset: auto; display: flex; inline-size: 20rem; block-size: 30rem;"
  ></lr-lightbox>`,
};
