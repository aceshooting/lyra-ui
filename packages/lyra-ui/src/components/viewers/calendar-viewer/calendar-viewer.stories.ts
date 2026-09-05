import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './calendar-viewer.js';

const meta: Meta = {
  title: 'CalendarViewer',
  component: 'lr-calendar-viewer',
  tags: ['autodocs'],
  parameters: { docs: { description: { component: 'A host `aria-label` names the calendar region by attribute presence, including an explicitly empty value; `name` and the localized label are fallbacks.' } } },
};
export default meta;
type Story = StoryObj;
const SAMPLE_ICS = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//lyra-ui//storybook//EN', 'BEGIN:VEVENT', 'UID:event-1@example.test', 'DTSTAMP:20260701T090000Z', 'DTSTART:20260714T140000Z', 'DTEND:20260714T150000Z', 'SUMMARY:Quarterly planning', 'LOCATION:Room 204', 'DESCRIPTION:Review roadmap and budget.', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
const source = `data:text/calendar;charset=utf-8,${encodeURIComponent(SAMPLE_ICS)}`;
export const Default: Story = { render: () => html`<lr-calendar-viewer style="max-inline-size: 30rem;" src=${source} name="meeting.ics"></lr-calendar-viewer>` };
export const NoSourceSet: Story = { render: () => html`<lr-calendar-viewer style="max-inline-size: 30rem;"></lr-calendar-viewer>` };
export const MaxHeight: Story = { render: () => html`<lr-calendar-viewer style="max-inline-size: 30rem;" max-height="8rem" src=${source} name="meeting.ics"></lr-calendar-viewer>` };

/** Baseline narrow-allocation coverage with deliberately long event content. */
export const Narrow320: Story = {
  render: () => html`<div style="max-width:320px"><lr-calendar-viewer src=${source} name="Long quarterly planning calendar.ics"></lr-calendar-viewer></div>`,
};


/** All-day early dates retain UTC calendar semantics and an exclusive DTEND. */
export const EarlyAllDayDates: Story = {
  render: () => {
    const calendar = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:early-all-day',
      'DTSTART;VALUE=DATE:00990714', 'DTEND;VALUE=DATE:00990717',
      'SUMMARY:Historical gathering', 'END:VEVENT', 'END:VCALENDAR', '',
    ].join('\r\n');
    return html`<lr-calendar-viewer name="Historical calendar" src=${`data:text/calendar;charset=utf-8,${encodeURIComponent(calendar)}`}></lr-calendar-viewer>`;
  },
};
