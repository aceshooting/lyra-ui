import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { storyColor } from '../../../../../../.storybook/story-theme.js';

const meta: Meta = {
  title: 'Carousel',
  component: 'lr-carousel',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-carousel aria-label="Product previews">
    <div style="padding: var(--lr-space-2xl); background: var(--lr-color-brand-quiet);">First panel</div>
    <div style="padding: var(--lr-space-2xl); background: var(--lr-color-success-quiet);">Second panel</div>
    <div style="padding: var(--lr-space-2xl); background: var(--lr-color-warning-quiet);">Third panel</div>
  </lr-carousel>`,
};

/** Slides live in a native scroll-snap track: swipe on a touch device, pan with a trackpad, or use
 *  the buttons and arrow keys. However the scroller comes to rest, the resting slide becomes the
 *  active one and `lr-slide-change` fires. */
export const TouchScrolling: Story = {
  name: 'Touch scrolling (scroll-snap)',
  parameters: {
    docs: {
      description: {
        story:
          'Drag or swipe the slides directly. The active slide is adopted from wherever the scroller settles, so the indicators stay in sync with a gesture exactly as they do with the buttons.',
      },
    },
  },
  render: () => html`<div style="inline-size: 22rem">
    <lr-carousel aria-label="Swipeable panels">
      <div style="padding: var(--lr-space-2xl); background: var(--lr-color-brand-quiet);">Swipe me</div>
      <div style="padding: var(--lr-space-2xl); background: var(--lr-color-success-quiet);">Second panel</div>
      <div style="padding: var(--lr-space-2xl); background: var(--lr-color-warning-quiet);">Third panel</div>
    </lr-carousel>
  </div>`,
};

/** `--lr-carousel-slide-basis` sets each slide's share of the track, so several can share the view
 *  while every slide still snaps to the viewport's inline start. */
export const MultipleSlidesPerView: Story = {
  name: 'Multiple slides per view (--lr-carousel-slide-basis)',
  render: () => html`<lr-carousel
    aria-label="Product previews"
    style="--lr-carousel-slide-basis: 50%"
  >
    <div style="padding: var(--lr-space-2xl); background: var(--lr-color-brand-quiet);">First panel</div>
    <div style="padding: var(--lr-space-2xl); background: var(--lr-color-success-quiet);">Second panel</div>
    <div style="padding: var(--lr-space-2xl); background: var(--lr-color-warning-quiet);">Third panel</div>
    <div style="padding: var(--lr-space-2xl); background: var(--lr-color-danger-quiet);">Fourth panel</div>
  </lr-carousel>`,
};

export const LoopingAutoplay: Story = {
  render: () => html`<lr-carousel loop autoplay autoplay-interval="3000" aria-label="Announcements">
    <p>Announcement one</p>
    <p>Announcement two</p>
  </lr-carousel>`,
};

/** The current slide's indicator dot is themeable through `--lr-carousel-indicator-current-bg` and
 *  `--lr-carousel-indicator-current-border-color`. Neither is declared on `:host`, so setting them
 *  on an ancestor recolors only the active dot — not everything reading the brand tokens. */
export const ThemedIndicator: Story = {
  name: 'Themed indicator (cssprops)',
  parameters: {
    docs: {
      description: {
        story:
          'Set `--lr-carousel-indicator-current-bg` and `--lr-carousel-indicator-current-border-color` on the element or any ancestor to recolor the active indicator without hijacking the library-wide brand tokens.',
      },
    },
  },
  render: () => html`<lr-carousel
    aria-label="Product previews"
    style="--lr-carousel-indicator-current-bg: ${storyColor(
      'successQuiet',
    )}; --lr-carousel-indicator-current-border-color: ${storyColor('success')};"
  >
    <div style="padding: var(--lr-space-2xl); background: var(--lr-color-brand-quiet);">First panel</div>
    <div style="padding: var(--lr-space-2xl); background: var(--lr-color-success-quiet);">Second panel</div>
    <div style="padding: var(--lr-space-2xl); background: var(--lr-color-warning-quiet);">Third panel</div>
  </lr-carousel>`,
};
