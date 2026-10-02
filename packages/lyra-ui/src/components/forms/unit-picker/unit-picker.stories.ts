import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './unit-picker.js';
import '../button/button.js';

const meta: Meta = {
  title: 'Forms & Inputs/Unit Picker',
  component: 'lr-unit-picker',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Choose a measurement-unit identifier with localized names and symbols. Supply ordered subsets, groups, compound units or custom units. Search is optional; selecting a unit does not convert a measurement.',
      },
    },
  },
};

export default meta;

export const Default: StoryObj = {
  render: () => html`<lr-unit-picker label="Measurement unit" value="meter"></lr-unit-picker>`,
};

export const SearchableGroups: StoryObj = {
  render: () => html`<lr-unit-picker searchable clearable label="Measurement unit" value="meter"
    hint="Search by name, identifier or symbol." .units=${[
      { code: 'meter', group: 'Length' }, { code: 'kilometer', group: 'Length' },
      { code: 'foot', group: 'Length' }, { code: 'gram', group: 'Mass' },
      { code: 'kilogram', group: 'Mass' }, { code: 'celsius', group: 'Temperature' },
      { code: 'fahrenheit', group: 'Temperature' },
    ]}></lr-unit-picker>`,
};

export const CustomUnits: StoryObj = {
  render: () => html`<lr-unit-picker label="Energy unit" value="kWh" .units=${[
    { code: 'kWh', label: 'Kilowatt-hour', symbol: 'kWh' },
    { code: 'MWh', label: 'Megawatt-hour', symbol: 'MWh' },
    { code: 'GWh', label: 'Gigawatt-hour — unavailable', symbol: 'GWh', disabled: true },
  ]}></lr-unit-picker>`,
};

export const CompoundUnits: StoryObj = {
  render: () => html`<lr-unit-picker searchable label="Speed unit" value="kilometer-per-hour"
    .units=${['kilometer-per-hour', 'mile-per-hour', 'meter-per-second']}></lr-unit-picker>`,
};

export const LocalizedNames: StoryObj = {
  render: () => html`<lr-unit-picker lang="fr" searchable label="Unité de longueur" value="kilometer"
    .units=${['millimeter', 'centimeter', 'meter', 'kilometer']}></lr-unit-picker>`,
};

export const RequiredForm: StoryObj = {
  render: () => html`<form style="display:grid;gap:var(--lr-space-m);max-inline-size:var(--lr-size-20rem)"
    @submit=${(event: SubmitEvent) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const output = form.querySelector('output');
      if (output) output.value = String(new FormData(form).get('unit') ?? '');
    }}>
    <lr-unit-picker name="unit" label="Measurement unit" required clearable
      .units=${['meter', 'kilometer', 'foot', 'mile']}></lr-unit-picker>
    <div style="display:flex;gap:var(--lr-space-s)">
      <lr-button type="submit">Submit</lr-button>
      <lr-button type="reset" appearance="outlined">Reset</lr-button>
    </div>
    <output aria-label="Submitted unit"></output>
  </form>`,
};

export const UnavailableSelection: StoryObj = {
  render: () => html`<lr-unit-picker label="Saved unit" value="mile" clearable
    hint="Choose an available unit or clear the saved value." .units=${['meter', 'kilometer']}></lr-unit-picker>`,
};

export const EmptyCatalog: StoryObj = {
  render: () => html`<lr-unit-picker label="Measurement unit" hint="No units are available." .units=${[]}></lr-unit-picker>`,
};

export const RightToLeft: StoryObj = {
  render: () => html`<div dir="rtl" style="max-inline-size:var(--lr-size-20rem)">
    <lr-unit-picker lang="ar" searchable label="وحدة القياس" value="meter"
      .units=${['meter', 'kilometer', 'foot', 'mile']}></lr-unit-picker>
  </div>`,
};
