import type { Meta, StoryObj } from '@storybook/web-components-vite'; import { html } from 'lit'; import './calendar.js';
const meta: Meta = { title: 'Calendar', component: 'lr-calendar', tags: ['autodocs'] }; export default meta; type Story = StoryObj;
export const Month: Story = { render: () => html`<lr-calendar view-date="2026-07-01" .events=${[{ date: '2026-07-15', title: 'Planning review' }, { date: '2026-07-22', title: 'Release' }]}></lr-calendar>` };

/** Agenda is a closed display mode; invalid values normalize back to the month view. */
export const Agenda: Story = {
  render: () => html`
    <lr-calendar
      view="agenda"
      view-date="2026-07-01"
      .events=${[
        { date: '2026-07-15', title: 'Planning review' },
        { date: '2026-07-22', title: 'Release' },
      ]}
    ></lr-calendar>
  `,
};

/** The two navigation controls have symmetric, purpose-specific styling hooks. */
export const NavigationParts: Story = {
  render: () => html`
    <style>
      .navigation-parts::part(previous-button),
      .navigation-parts::part(next-button) {
        border-style: dashed;
      }
    </style>
    <lr-calendar class="navigation-parts" view-date="2026-07-01"></lr-calendar>
  `,
};
// Exact narrow RTL allocation with long localized and unbroken event content. This is below the
// 28rem @container threshold, so it also exercises the calendar host's own containment context.
export const NarrowAllocation: Story = {
  name: 'Narrow RTL (320px) with long content',
  render: () => html`
    <div dir="rtl" style="inline-size: 320px; max-inline-size: 100%;">
      <lr-calendar
        aria-label="جدول الإصدارات والمراجعات الشهرية"
        view-date="2026-07-01"
        .events=${[
          { date: '2026-07-15', title: 'مراجعة تخطيط الإصدار لجميع مناطق النشر والإنتاج' },
          { date: '2026-07-22', title: 'release-approval-with-an-intentionally-unbroken-identifier' },
        ]}
      ></lr-calendar>
    </div>
  `,
};

/** State paint hooks inherit from an application theme ancestor and remain independently adjustable. */
export const StateThemeHooks: Story = {
  render: () => html`
    <div
      style="
        --lr-calendar-day-selected-bg: var(--lr-color-success-quiet);
        --lr-calendar-day-outside-color: var(--lr-color-warning);
        --lr-calendar-day-outside-bg: var(--lr-color-warning-quiet);
        --lr-calendar-day-today-outline-color: var(--lr-color-danger);
      "
    >
      <lr-calendar view-date="2026-07-01" value="2026-07-15"></lr-calendar>
    </div>
  `,
};
