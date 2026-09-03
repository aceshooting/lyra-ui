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

/** `firstDayOfWeek` defaults to `'auto'`, deriving the week start from the effective locale (a
 * French locale is Monday-first) -- and still accepts an explicit override, either a bare `0`-`6`
 * index or one of the shared weekday-name tokens (`'auto'`, then `'sun'` through `'sat'`) that
 * `lr-date-picker`/`lr-date-input` already accept, to pin the week start independent of locale. */
export const LocalizedWeekStart: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`firstDayOfWeek` defaults to `\'auto\'` and derives the week start from `locale` (French is Monday-first); an explicit `first-day-of-week="sun"` overrides that regardless of locale.',
      },
    },
  },
  render: () => html`
    <div style="display: flex; gap: 1.5rem; flex-wrap: wrap;">
      <div>
        <p>Auto (locale-derived, French = Monday-first)</p>
        <lr-calendar locale="fr-FR" view-date="2026-07-01"></lr-calendar>
      </div>
      <div>
        <p>Explicit override: Sunday-first regardless of locale</p>
        <lr-calendar locale="fr-FR" first-day-of-week="sun" view-date="2026-07-01"></lr-calendar>
      </div>
    </div>
  `,
};

/** Navigation, day, and agenda state paint hooks inherit from an application theme ancestor and remain independently adjustable. */
export const StateThemeHooks: Story = {
  render: () => html`
    <div
      style="
        --lr-calendar-nav-hover-bg: var(--lr-color-warning-quiet);
        --lr-calendar-nav-active-bg: var(--lr-color-warning);
        --lr-calendar-day-hover-bg: var(--lr-color-success-quiet);
        --lr-calendar-day-active-bg: var(--lr-color-success);
        --lr-calendar-agenda-event-hover-bg: var(--lr-color-danger-quiet);
        --lr-calendar-agenda-event-active-bg: var(--lr-color-danger);
        --lr-calendar-day-selected-bg: var(--lr-color-success-quiet);
        --lr-calendar-day-outside-color: var(--lr-color-warning);
        --lr-calendar-day-outside-bg: var(--lr-color-warning-quiet);
        --lr-calendar-day-today-outline-color: var(--lr-color-danger);
      "
    >
      <lr-calendar view-date="2026-07-01" value="2026-07-15"></lr-calendar>
      <lr-calendar
        view="agenda"
        view-date="2026-07-01"
        .events=${[{ date: '2026-07-15', title: 'Agenda state hook' }]}
      ></lr-calendar>
    </div>
  `,
};
