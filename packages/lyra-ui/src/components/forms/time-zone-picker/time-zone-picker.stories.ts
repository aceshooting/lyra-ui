import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './time-zone-picker.js';
import '../button/button.js';

const meta: Meta = {
  title: 'Forms & Inputs/Time Zone Picker',
  component: 'lr-time-zone-picker',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Choose a time-zone identifier from UTC and this runtime’s IANA catalog, or provide an ordered subset. Search is optional. Selecting a zone does not change clocks or application settings automatically.',
      },
    },
  },
};

export default meta;

export const Default: StoryObj = {
  render: () => html`<lr-time-zone-picker label="Time zone" value="UTC"></lr-time-zone-picker>`,
};

export const SearchableGroups: StoryObj = {
  render: () => html`<lr-time-zone-picker searchable clearable label="Meeting time zone" value="Europe/Luxembourg"
    hint="Search by identifier or office name." .timeZones=${[
      { code: 'UTC', group: 'Common' },
      { code: 'Europe/Luxembourg', label: 'Luxembourg office', group: 'Europe' },
      { code: 'Europe/London', label: 'London office', group: 'Europe' },
      { code: 'America/New_York', group: 'Americas' },
      { code: 'Asia/Tokyo', group: 'Asia' },
    ]}></lr-time-zone-picker>`,
};

export const RestrictedCatalog: StoryObj = {
  render: () => html`<lr-time-zone-picker label="Report time zone" value="UTC" .timeZones=${[
    { code: 'UTC', label: 'Coordinated Universal Time' },
    { code: 'Europe/Paris', label: 'Paris' },
    { code: 'Asia/Tokyo', label: 'Tokyo — unavailable', disabled: true },
  ]}></lr-time-zone-picker>`,
};

export const RequiredForm: StoryObj = {
  render: () => html`<form style="display:grid;gap:var(--lr-space-m);max-inline-size:var(--lr-size-20rem)"
    @submit=${(event: SubmitEvent) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const output = form.querySelector('output');
      if (output) output.value = String(new FormData(form).get('zone') ?? '');
    }}>
    <lr-time-zone-picker name="zone" label="Time zone" searchable required clearable
      .timeZones=${['UTC', 'Europe/Paris', 'America/New_York', 'Asia/Beirut']}></lr-time-zone-picker>
    <div style="display:flex;gap:var(--lr-space-s)">
      <lr-button type="submit">Submit</lr-button>
      <lr-button type="reset" appearance="outlined">Reset</lr-button>
    </div>
    <output aria-label="Submitted time zone"></output>
  </form>`,
};

export const UnavailableSelection: StoryObj = {
  render: () => html`<lr-time-zone-picker label="Saved time zone" value="Asia/Tokyo" clearable
    hint="Choose an available time zone or clear the saved value."
    .timeZones=${['UTC', 'Europe/Paris']}></lr-time-zone-picker>`,
};

export const EmptyCatalog: StoryObj = {
  render: () => html`<lr-time-zone-picker label="Time zone" hint="No time zones are available."
    .timeZones=${[]}></lr-time-zone-picker>`,
};

export const RightToLeft: StoryObj = {
  render: () => html`<div dir="rtl" style="max-inline-size:var(--lr-size-20rem)">
    <lr-time-zone-picker lang="ar" searchable label="المنطقة الزمنية" value="Asia/Beirut"
      .timeZones=${['UTC', 'Asia/Beirut', 'Asia/Dubai', 'Europe/Paris']}></lr-time-zone-picker>
  </div>`,
};
