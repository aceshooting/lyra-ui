import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Random Content',
  component: 'lyra-random-content',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lyra-random-content aria-label="Rotating testimonial">
    <blockquote style="padding: var(--lyra-space-l); background: var(--lyra-color-brand-quiet);">
      "Lyra UI shipped our redesign in half the time." — Alex
    </blockquote>
    <blockquote style="padding: var(--lyra-space-l); background: var(--lyra-color-success-quiet);">
      "The accessibility work alone paid for itself." — Priya
    </blockquote>
    <blockquote style="padding: var(--lyra-space-l); background: var(--lyra-color-warning-quiet);">
      "Theming the whole app took one CSS file." — Jordan
    </blockquote>
  </lyra-random-content>`,
};

export const MultipleItemsWithAnimation: Story = {
  name: 'Two items with fade-up animation',
  render: () => html`<lyra-random-content items="2" animation="fade-up" aria-label="Featured tips">
    <div style="padding: var(--lyra-space-l); border: 1px solid var(--lyra-color-border);">Tip one</div>
    <div style="padding: var(--lyra-space-l); border: 1px solid var(--lyra-color-border);">Tip two</div>
    <div style="padding: var(--lyra-space-l); border: 1px solid var(--lyra-color-border);">Tip three</div>
    <div style="padding: var(--lyra-space-l); border: 1px solid var(--lyra-color-border);">Tip four</div>
  </lyra-random-content>`,
};

export const SequenceAutoplay: Story = {
  name: 'Sequential autoplay with a manual randomize() button',
  render: () => html`
    <lyra-random-content
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
    </lyra-random-content>
    <button
      type="button"
      @click=${() => (document.getElementById('story-sequence') as HTMLElement & { randomize: () => void })?.randomize()}
    >
      Show next
    </button>
  `,
};
