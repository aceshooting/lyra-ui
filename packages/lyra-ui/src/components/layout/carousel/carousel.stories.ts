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
