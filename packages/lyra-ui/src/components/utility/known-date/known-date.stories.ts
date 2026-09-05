import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { LyraKnownDate } from './known-date.js';

const meta: Meta = {
  title: 'Forms/KnownDate',
  component: 'lr-known-date',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html` <lr-known-date label="Birth date" hint="For example, 27 3 2007"></lr-known-date> `,
};

export const PrefilledValue: Story = {
  render: () => html` <lr-known-date label="Birth date" value="2007-03-27"></lr-known-date> `,
};

export const AppearancesAndPill: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 1rem; align-items: flex-start;">
      <lr-known-date appearance="outlined" label="Outlined" value="2007-03-27"></lr-known-date>
      <lr-known-date appearance="filled" label="Filled" value="2007-03-27"></lr-known-date>
      <lr-known-date appearance="filled-outlined" label="Filled and outlined" value="2007-03-27"></lr-known-date>
      <lr-known-date pill label="Pill fields" value="2007-03-27"></lr-known-date>
    </div>
  `,
};

export const RequiredWithValidation: Story = {
  render: () => html` <lr-known-date label="Birth date" hint="For example, 27 3 2007" required></lr-known-date> `,
};

export const StaticValidators: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The mirrored constructor exposes a fresh callable `validators` catalog for tooling that projects the control\'s live intrinsic and custom validity.',
      },
    },
  },
  render: () => {
    const validate = (event: Event) => {
      const wrapper = (event.currentTarget as HTMLElement).parentElement!;
      const control = wrapper.querySelector<LyraKnownDate>('lr-known-date')!;
      const result = LyraKnownDate.validators[0]!.checkValidity(control);
      wrapper.querySelector('output')!.textContent = result.isValid
        ? 'Valid date'
        : `${result.invalidKeys.join(', ')}: ${result.message}`;
    };
    return html`
      <div style="display: grid; gap: var(--lr-space-s); justify-items: start;">
        <lr-known-date required label="Birth date"></lr-known-date>
        <button type="button" @click=${validate}>Run static validator</button>
        <output aria-live="polite"></output>
      </div>
    `;
  },
};

export const PassportDateRange: Story = {
  render: () => html`
    <lr-known-date
      label="Passport issue date"
      hint="Must be within the last 10 years"
      min="2016-01-01"
      max="2026-07-16"
    ></lr-known-date>
  `,
};

export const LocaleFieldOrder: Story = {
  render: () => html`
    <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
      <lr-known-date label="Date of birth" locale="en-US" value="2007-03-27"></lr-known-date>
      <lr-known-date label="生年月日" locale="ja-JP" value="2007-03-27"></lr-known-date>
    </div>
  `,
};

export const Sizes: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The shared six-step ladder. `small`/`medium`/`large` are accepted as synonyms of `s`/`m`/`l`, so markup migrated from an upstream that spells them that way needs no attribute rewrite. The two smallest tiers floor at the 24px pointer-target minimum rather than shrinking below it.',
      },
    },
  },
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 1rem; align-items: flex-start;">
      <lr-known-date size="2xs" label="2x extra small" value="2007-03-27"></lr-known-date>
      <lr-known-date size="xs" label="Extra small" value="2007-03-27"></lr-known-date>
      <lr-known-date size="s" label="Small" value="2007-03-27"></lr-known-date>
      <lr-known-date size="m" label="Medium (default)" value="2007-03-27"></lr-known-date>
      <lr-known-date size="l" label="Large" value="2007-03-27"></lr-known-date>
      <lr-known-date size="xl" label="Extra large" value="2007-03-27"></lr-known-date>
      <lr-known-date size="large" label='size="large" — same tier as "l"' value="2007-03-27"></lr-known-date>
    </div>
  `,
};

export const RightToLeft: Story = {
  render: () => html`
    <div dir="rtl">
      <lr-known-date
        label="تاريخ الميلاد"
        day-label="اليوم"
        month-label="الشهر"
        year-label="السنة"
        value="2007-03-27"
      ></lr-known-date>
    </div>
  `,
};

export const NarrowLongContent: Story = {
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-known-date
        label="Extremely long localized birth date label that wraps inside a narrow form column"
        day-label="Localized day"
        month-label="Localized month"
        year-label="Localized year"
        hint="A long translated hint remains readable without creating horizontal page scrolling."
      ></lr-known-date>
    </div>
  `,
};

export const PinnedFieldHeight: Story = {
  name: 'Pinned field height (--lr-known-date-field-height)',
  parameters: {
    docs: {
      description: {
        story:
          'Each field input grows to fit its content by default, floored by the per-tier `--lr-known-date-field-min-height`. Set `--lr-known-date-field-height` to pin an exact height so the three inputs line up with a neighbouring control of a known height.',
      },
    },
  },
  render: () => html`
    <lr-known-date label="Birth date" value="2007-03-27" style="--lr-known-date-field-height: 44px;"></lr-known-date>
  `,
};


export const ExternalGuidance: Story = {
  parameters: { docs: { description: { story: 'External guidance describes the date group. The hint remains attached to each field. Removing an optional day/month/year label restores its localized default; an explicitly empty label stays empty.' } } },
  render: () => html`
    <div>
      <p id="known-date-passport-guide">Use the date printed on your passport.</p>
      <lr-known-date label="Passport date" aria-describedby="known-date-passport-guide"
        hint="Enter the complete day, month and year." day-label="Custom day"></lr-known-date>
      <button @click=${(event: Event) => (event.currentTarget as HTMLElement).parentElement!
        .querySelector('lr-known-date')!.removeAttribute('day-label')}>Restore localized day label</button>
      <lr-known-date label="Disabled date" value="2007-03-27" disabled></lr-known-date>
    </div>
  `,
};
