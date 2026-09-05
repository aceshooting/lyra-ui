import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './chip-group.js';
import './chip.js';

const meta: Meta = {
  parameters: { docs: { description: { component: 'Collapsed groups reapply max-visible when assigned children are replaced or reordered at the same count, preserving authored hidden/inert state and releasing departed visibility leases.' } } }, title: 'Data display/Chip group', component: 'lr-chip-group', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-chip-group><lr-chip>Lit</lr-chip><lr-chip>Web components</lr-chip></lr-chip-group>` };

/** Exact 320px RTL allocation with long removable labels. It starts collapsed; activate the
 * native +N button to inspect the matching expanded state and its scoped border-style token. */
export const NarrowRtlLongContent: StoryObj = {
  name: 'Narrow RTL overflow (320px)',
  parameters: {
    docs: {
      description: {
        story:
          'Long removable chips remain inside a 320px RTL allocation. The group starts collapsed; activate +N to reveal the expanded state, whose border can be retuned without changing the resting dashed marker.',
      },
    },
  },
  render: () => {
    const longLabel = 'مرشح بحث دولي مطول جداً بدون مسافات للتأكد من بقاء الترتيب المنطقي داخل المساحة';
    return html`
      <div dir="rtl" style="inline-size: 320px; max-inline-size: 100%;">
        <lr-chip-group
          max-visible="2"
          style="--lr-chip-group-overflow-expanded-border-style: dotted;"
        >
          <lr-chip removable>${longLabel}</lr-chip>
          <lr-chip removable>${longLabel}</lr-chip>
          <lr-chip removable>${longLabel}</lr-chip>
          <lr-chip removable>${longLabel}</lr-chip>
        </lr-chip-group>
      </div>
    `;
  },
};
