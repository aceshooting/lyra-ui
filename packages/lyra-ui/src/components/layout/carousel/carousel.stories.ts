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
  render: () => html`<lr-carousel navigation pagination aria-label="Product previews">
    <div style="padding: var(--lr-space-2xl); background: var(--lr-color-brand-quiet);">First panel</div>
    <div style="padding: var(--lr-space-2xl); background: var(--lr-color-success-quiet);">Second panel</div>
    <div style="padding: var(--lr-space-2xl); background: var(--lr-color-warning-quiet);">Third panel</div>
  </lr-carousel>`,
};

/** Slides live in a native scroll-snap track: swipe on a touch device, pan with a trackpad, or use
 *  the buttons and arrow keys. However the scroller comes to rest, the resting slide becomes the
 *  active one and `lr-slide-change` fires. `mouse-dragging` adds the equivalent desktop gesture. */
export const TouchScrolling: Story = {
  name: 'Touch scrolling (scroll-snap)',
  parameters: {
    docs: {
      description: {
        story:
          'Drag with a mouse, swipe on touch, or pan with a trackpad. The active slide is adopted from wherever the scroller settles, so pagination stays in sync with a gesture exactly as it does with the buttons.',
      },
    },
  },
  render: () => html`<div style="inline-size: 22rem">
    <lr-carousel mouse-dragging navigation pagination aria-label="Swipeable panels">
      <div style="padding: var(--lr-space-2xl); background: var(--lr-color-brand-quiet);">Swipe me</div>
      <div style="padding: var(--lr-space-2xl); background: var(--lr-color-success-quiet);">Second panel</div>
      <div style="padding: var(--lr-space-2xl); background: var(--lr-color-warning-quiet);">Third panel</div>
    </lr-carousel>
  </div>`,
};

/** `slides-per-page` controls the visible allocation and `slides-per-move` controls navigation. */
export const MultipleSlidesPerView: Story = {
  name: 'Multiple slides per view',
  render: () => html`<lr-carousel
    navigation
    pagination
    slides-per-page="2"
    slides-per-move="2"
    aria-label="Product previews"
  >
    <div style="padding: var(--lr-space-2xl); background: var(--lr-color-brand-quiet);">First panel</div>
    <div style="padding: var(--lr-space-2xl); background: var(--lr-color-success-quiet);">Second panel</div>
    <div style="padding: var(--lr-space-2xl); background: var(--lr-color-warning-quiet);">Third panel</div>
    <div style="padding: var(--lr-space-2xl); background: var(--lr-color-danger-quiet);">Fourth panel</div>
  </lr-carousel>`,
};

export const LoopingAutoplay: Story = {
  render: () => html`<lr-carousel
    loop
    autoplay
    navigation
    pagination
    autoplay-interval="3000"
    aria-label="Announcements"
  >
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
    pagination
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

/** Vertical carousels move on the block axis and use Up/Down for keyboard navigation. */
export const Vertical: Story = {
  render: () => html`<lr-carousel
    orientation="vertical"
    navigation
    pagination
    aria-label="Release highlights"
    style="block-size: var(--lr-size-22rem)"
  >
    <div style="padding: var(--lr-space-2xl); background: var(--lr-color-brand-quiet);">First panel</div>
    <div style="padding: var(--lr-space-2xl); background: var(--lr-color-success-quiet);">Second panel</div>
    <div style="padding: var(--lr-space-2xl); background: var(--lr-color-warning-quiet);">Third panel</div>
  </lr-carousel>`,
};

/** Both navigation glyphs can be replaced without rebuilding the buttons or their labels. */
export const CustomNavigationIcons: Story = {
  render: () => html`<lr-carousel navigation pagination aria-label="Product previews">
    <span slot="previous-icon" aria-hidden="true">←</span>
    <span slot="next-icon" aria-hidden="true">→</span>
    <div style="padding: var(--lr-space-2xl); background: var(--lr-color-brand-quiet);">First panel</div>
    <div style="padding: var(--lr-space-2xl); background: var(--lr-color-success-quiet);">Second panel</div>
  </lr-carousel>`,
};
