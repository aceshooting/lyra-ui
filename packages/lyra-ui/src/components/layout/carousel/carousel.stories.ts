import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { storyColor } from '../../../../../../.storybook/theme-contract.js';

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

export const EditableSlides: Story = {
  name: 'Editors keep their navigation keys',
  parameters: {
    docs: { description: { story: 'Arrow, Home, and End keys edit the focused field. Focus the carousel viewport to navigate slides with those keys.' } },
  },
  render: () => html`
    <lr-carousel navigation pagination aria-label="Editable project previews">
      <div style="padding: var(--lr-space-l);">
        <label>Caption <input value="Project preview"></label>
      </div>
      <div style="padding: var(--lr-space-l);">
        <label>Notes <textarea>Review the project details.</textarea></label>
      </div>
      <div style="padding: var(--lr-space-l);" contenteditable="true" role="textbox" aria-label="Project description">An editable project description.</div>
    </lr-carousel>
  `,
};

/** The hover preview's width, style, color, and inward offset can be themed separately without
 *  changing the focus ring or adding a pressed state to the scroll container. */
export const ThemedHoverOutline: Story = {
  name: 'Themed hover outline (cssprops)',
  parameters: {
    docs: {
      description: {
        story:
          'Hover the scroll-snap viewport to see `--lr-carousel-scroll-container-hover-outline-width`, `--lr-carousel-scroll-container-hover-outline-style`, `--lr-carousel-scroll-container-hover-outline-color`, and `--lr-carousel-scroll-container-hover-outline-offset` inherited from its ancestor. Pressing the viewport intentionally keeps the same hover preview: it is a scroll region, not an action.',
      },
    },
  },
  render: () => html`
    <div
      style="--lr-carousel-scroll-container-hover-outline-width: var(--lr-border-width-thick); --lr-carousel-scroll-container-hover-outline-style: dashed; --lr-carousel-scroll-container-hover-outline-color: ${storyColor(
        'warning',
      )}; --lr-carousel-scroll-container-hover-outline-offset: calc(-1 * var(--lr-border-width-thick));"
    >
      <lr-carousel navigation pagination aria-label="Themed hover outline">
        <div style="padding: var(--lr-space-2xl); background: var(--lr-color-brand-quiet);">First panel</div>
        <div style="padding: var(--lr-space-2xl); background: var(--lr-color-success-quiet);">Second panel</div>
        <div style="padding: var(--lr-space-2xl); background: var(--lr-color-warning-quiet);">Third panel</div>
      </lr-carousel>
    </div>
  `,
};

/** The opt-in theme-level scrollbar hooks retheme this scroll-container, plus every other internal
 *  scroll container in the library, from one declaration on an ancestor. */
export const ThemedScrollbar: Story = {
  name: 'Themed scrollbar (theme-level cssprops)',
  parameters: {
    docs: {
      description: {
        story:
          'Setting `--lr-theme-scrollbar-width` and `--lr-theme-scrollbar-gutter` on an ancestor retunes this scroll-container -- and, set on `:root`, every other internal scroll container in the library (`lr-table`, `lr-virtual-list`, `lr-scroller`, `lr-time-input`, `lr-emoji-picker`, `lr-code-block`, `lr-code-editor`) at once. Chromium and Safari still force-hide this particular scrollbar through the legacy `::-webkit-scrollbar` pseudo-element, so the width/gutter change is only visible in Firefox.',
      },
    },
  },
  render: () => html`
    <div style="--lr-theme-scrollbar-width: thin; --lr-theme-scrollbar-gutter: stable;">
      <lr-carousel navigation pagination aria-label="Themed scrollbar">
        <div style="padding: var(--lr-space-2xl); background: var(--lr-color-brand-quiet);">First panel</div>
        <div style="padding: var(--lr-space-2xl); background: var(--lr-color-success-quiet);">Second panel</div>
        <div style="padding: var(--lr-space-2xl); background: var(--lr-color-warning-quiet);">Third panel</div>
      </lr-carousel>
    </div>
  `,
};

/** Web Awesome's published mixed-case `currentSlide` attribute is accepted after HTML normalizes
 * it to `currentslide`; Lyra's `current-slide` spelling remains the reflected canonical form. */
export const UpstreamCurrentSlideSpelling: Story = {
  render: () => html`<lr-carousel currentSlide="1" navigation pagination aria-label="Product previews">
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

export const NarrowRtlLongContent: Story = {
  name: 'Narrow RTL long content (320px)',
  parameters: {
    docs: {
      description: {
        story:
          'An exact 320px RTL allocation keeps long localized slides inside the native scroll-snap viewport while navigation and pagination remain fully visible.',
      },
    },
  },
  render: () => html`
    <div dir="rtl" style="inline-size: 320px; max-inline-size: 100%;">
      <lr-carousel navigation pagination aria-label="أبرز المنتجات" style="inline-size: 100%;">
        <lr-carousel-item style="padding: var(--lr-space-l); background: var(--lr-color-brand-quiet);">
          لوحة-منتج-أولى-ذات-عنوان-طويل-جداً-غير-قابل-للفصل
        </lr-carousel-item>
        <lr-carousel-item style="padding: var(--lr-space-l); background: var(--lr-color-success-quiet);">
          لوحة-منتج-ثانية-ذات-عنوان-طويل-جداً-غير-قابل-للفصل
        </lr-carousel-item>
        <lr-carousel-item style="padding: var(--lr-space-l); background: var(--lr-color-warning-quiet);">
          لوحة-منتج-ثالثة-ذات-عنوان-طويل-جداً-غير-قابل-للفصل
        </lr-carousel-item>
      </lr-carousel>
    </div>
  `,
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

export const LiveLoopSnapshots: Story = {
  name: 'Live loop content synchronization',
  parameters: {
    docs: {
      description: {
        story:
          'Safe plain-HTML loop snapshots follow live light-DOM mutations. Slide role, name, and visibility metadata remains author-owned after live changes. Slides containing custom elements, media/resources, or stateful form content are never cloned; wrapping falls back to their original element.',
      },
    },
  },
  render: () => html`
    <div>
      <button
        type="button"
        @click=${() => {
          const slide = document.querySelector<HTMLElement>(
            '#live-loop-carousel [data-live-slide]',
          );
          if (slide) {
            slide.textContent = `Updated ${new Date().toLocaleTimeString()}`;
            slide.setAttribute('aria-label', 'Updated live slide');
          }
        }}
      >
        Update first slide
      </button>
      <lr-carousel id="live-loop-carousel" loop navigation pagination aria-label="Live announcements">
        <div data-live-slide>Original first slide</div>
        <div>Second slide</div>
      </lr-carousel>
    </div>
  `,
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
          'Set the scoped current-indicator, navigation hover/active, and pagination hover/active hooks on the element or any ancestor to recolor each state independently.',
      },
    },
  },
  render: () => html`<lr-carousel
    navigation
    pagination
    aria-label="Product previews"
    style="--lr-carousel-indicator-current-bg: ${storyColor(
      'successQuiet',
    )}; --lr-carousel-indicator-current-border-color: ${storyColor(
      'success',
    )}; --lr-carousel-navigation-hover-bg: ${storyColor(
      'warningQuiet',
    )}; --lr-carousel-navigation-hover-border-color: ${storyColor(
      'warning',
    )}; --lr-carousel-navigation-active-bg: ${storyColor(
      'dangerQuiet',
    )}; --lr-carousel-navigation-active-border-color: ${storyColor(
      'danger',
    )}; --lr-carousel-pagination-hover-bg: ${storyColor(
      'warningQuiet',
    )}; --lr-carousel-pagination-hover-border-color: ${storyColor(
      'warning',
    )}; --lr-carousel-pagination-active-bg: ${storyColor(
      'dangerQuiet',
    )}; --lr-carousel-pagination-active-border-color: ${storyColor('danger')};"
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

/** Both navigation glyphs can be replaced without rebuilding the buttons or their labels. Their
 * flattened content remains visible but inert and aria-hidden beneath the native actions. */
export const CustomNavigationIcons: Story = {
  render: () => html`<lr-carousel navigation pagination aria-label="Product previews">
    <span slot="previous-icon" aria-hidden="true">←</span>
    <span slot="next-icon" aria-hidden="true">→</span>
    <div style="padding: var(--lr-space-2xl); background: var(--lr-color-brand-quiet);">First panel</div>
    <div style="padding: var(--lr-space-2xl); background: var(--lr-color-success-quiet);">Second panel</div>
  </lr-carousel>`,
};
