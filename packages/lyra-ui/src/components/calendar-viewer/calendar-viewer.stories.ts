import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './calendar-viewer.js';

const meta: Meta = { title: 'CalendarViewer', component: 'lyra-calendar-viewer', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;
const SAMPLE_ICS = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//lyra-ui//storybook//EN', 'BEGIN:VEVENT', 'UID:event-1@example.test', 'DTSTAMP:20260701T090000Z', 'DTSTART:20260714T140000Z', 'DTEND:20260714T150000Z', 'SUMMARY:Quarterly planning', 'LOCATION:Room 204', 'DESCRIPTION:Review roadmap and budget.', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
const source = `data:text/calendar;charset=utf-8,${encodeURIComponent(SAMPLE_ICS)}`;
export const Default: Story = { render: () => html`<lyra-calendar-viewer style="max-inline-size: 30rem;" src=${source} name="meeting.ics"></lyra-calendar-viewer>` };
export const NoSourceSet: Story = { render: () => html`<lyra-calendar-viewer style="max-inline-size: 30rem;"></lyra-calendar-viewer>` };
export const MaxHeight: Story = { render: () => html`<lyra-calendar-viewer style="max-inline-size: 30rem;" max-height="8rem" src=${source} name="meeting.ics"></lyra-calendar-viewer>` };
