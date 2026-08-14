import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { narrowStoryFrames } from '../../../../../../.storybook/narrow-story.js';

const longLtrBefore = 'VorherVergleichsflächeOhneNatürlicheUmbruchmöglichkeit'.repeat(4);
const longLtrAfter = 'NachherVergleichsflächeOhneNatürlicheUmbruchmöglichkeit'.repeat(4);
const longArabicBefore = 'سطحقبلمقارنةدونفاصلطبيعي'.repeat(8);
const longArabicAfter = 'سطحبعدمقارنةدونفاصلطبيعي'.repeat(8);

const meta: Meta = {
  title: 'Image Comparer',
  component: 'lr-image-comparer',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Before/after comparison with a native range input. It emits exactly one bubbling/composed native `input` (`Event`) while moving and one native `change` (`Event`) when a gesture commits. Arrow behavior is explicit and cross-browser: horizontal Left/Right follows the mirrored inline axis, while vertical Up/Down follows the physical top-to-bottom divider. The `handle` slot customizes its visible affordance; its flattened subtree is always inert and hidden from assistive technology so the range stays the only interaction target. `--divider-width` and `--handle-size` tune the geometry, and the `dragging` CSS state follows one admitted primary-pointer gesture. Host `focus()`, `blur()`, and `click()` forward to the range input; focus transitions are relayed exactly once as native `FocusEvent`s.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-image-comparer aria-label="Before and after comparison">
    <div slot="before" style="padding: var(--lr-space-2xl); background: var(--lr-color-surface-raised);">Before</div>
    <div slot="after" style="padding: var(--lr-space-2xl); background: var(--lr-color-brand-quiet);">After</div>
  </lr-image-comparer>`,
};

export const Vertical: Story = {
  render: () => html`<lr-image-comparer
    orientation="vertical"
    position="65"
    aria-label="Vertical comparison"
    style="--divider-width: var(--lr-border-width-medium); --handle-size: var(--lr-size-2rem)"
  >
    <div slot="before" style="padding: var(--lr-space-2xl); background: var(--lr-color-surface-raised);">Top</div>
    <div slot="after" style="padding: var(--lr-space-2xl); background: var(--lr-color-brand-quiet);">Bottom</div>
    <span slot="handle" aria-hidden="true">↕</span>
  </lr-image-comparer>`,
};

export const NarrowLongContent: Story = {
  name: '320px long content — LTR and Arabic RTL',
  parameters: {
    docs: {
      description: {
        story:
          'Both 320px examples intentionally use long, unbroken slotted content. The horizontal divider and custom handle stay contained, and position 35 mirrors from the physical left edge in LTR to the physical right edge in RTL.',
      },
    },
  },
  render: () =>
    narrowStoryFrames((direction) => {
      const rtl = direction === 'rtl';
      return html`
        <lr-image-comparer
          position="35"
          aria-label=${rtl ? 'مقارنة قبل وبعد' : 'Vorher-Nachher-Vergleich'}
          style="block-size: var(--lr-size-10rem)"
        >
          <div
            slot="before"
            style="display: grid; min-block-size: var(--lr-size-10rem); padding: var(--lr-space-m); place-items: center; background: var(--lr-color-surface-raised);"
          >${rtl ? longArabicBefore : longLtrBefore}</div>
          <div
            slot="after"
            style="display: grid; min-block-size: var(--lr-size-10rem); padding: var(--lr-space-m); place-items: center; background: var(--lr-color-brand-quiet);"
          >${rtl ? longArabicAfter : longLtrAfter}</div>
          <span slot="handle" aria-hidden="true">⇆</span>
        </lr-image-comparer>
      `;
    }),
};
