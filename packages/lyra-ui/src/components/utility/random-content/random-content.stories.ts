import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './random-content.js';

const meta: Meta = {
  title: 'Random Content',
  component: 'lr-random-content',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-random-content aria-label="Rotating testimonial">
    <blockquote style="padding: var(--lr-space-l); background: var(--lr-color-brand-quiet);">
      "Lyra UI shipped our redesign in half the time." — Alex
    </blockquote>
    <blockquote style="padding: var(--lr-space-l); background: var(--lr-color-success-quiet);">
      "The accessibility work alone paid for itself." — Priya
    </blockquote>
    <blockquote style="padding: var(--lr-space-l); background: var(--lr-color-warning-quiet);">
      "Theming the whole app took one CSS file." — Jordan
    </blockquote>
  </lr-random-content>`,
};

export const MultipleItemsWithAnimation: Story = {
  name: 'Two items with fade-up animation',
  render: () => html`<lr-random-content
    items="2"
    animation="fade-up"
    aria-label="Featured tips"
    style="--lr-random-content-item-gap: var(--lr-space-m); --lr-random-content-item-alignment: stretch;"
  >
    <div style="padding: var(--lr-space-l); border: 1px solid var(--lr-color-border);">Tip one</div>
    <div style="padding: var(--lr-space-l); border: 1px solid var(--lr-color-border);">Tip two</div>
    <div style="padding: var(--lr-space-l); border: 1px solid var(--lr-color-border);">Tip three</div>
    <div style="padding: var(--lr-space-l); border: 1px solid var(--lr-color-border);">Tip four</div>
  </lr-random-content>`,
};

export const SvgCandidate: Story = {
  name: 'SVG and HTML candidates',
  render: () => html`
    <lr-random-content mode="sequence" aria-label="Rotating artwork">
      <svg viewBox="0 0 64 64" role="img" aria-label="A circle" style="inline-size: 4rem;">
        <circle cx="32" cy="32" r="24" fill="currentColor"></circle>
      </svg>
      <span>Ordinary inline content remains eligible too.</span>
    </lr-random-content>
  `,
};

export const SequenceAutoplay: Story = {
  name: 'Sequential autoplay with a manual randomize() button',
  render: () => html`
    <lr-random-content
      id="story-sequence"
      mode="sequence"
      autoplay
      autoplay-interval="4000"
      animation="fade"
      aria-label="Announcement rotator"
    >
      <p>Announcement one</p>
      <p>Announcement two</p>
      <p>Announcement three</p>
    </lr-random-content>
    <button
      type="button"
      @click=${() =>
        (
          document.getElementById('story-sequence') as HTMLElement & {
            randomize: () => void;
          }
        )?.randomize()}
    >
      Show next
    </button>
  `,
};

export const PausedAutoplay: Story = {
  render: () => html`
    <lr-random-content autoplay paused mode="sequence" aria-label="Paused announcement rotator">
      <p>Announcement one</p>
      <p>Announcement two</p>
      <p>Announcement three</p>
    </lr-random-content>
  `,
};
