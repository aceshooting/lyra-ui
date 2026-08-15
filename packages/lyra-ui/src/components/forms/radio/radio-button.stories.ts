import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './radio-button.js';
import './radio-group.js';

const meta: Meta = {
  title: 'Forms/Radio button',
  component: 'lr-radio-button',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A button-chrome radio. Host `aria-label` is forwarded to the internal radio by attribute presence, including an explicitly empty override. Every size tier retains a 24px target in both axes, even with an empty label.',
      },
    },
  },
};
export default meta;

export const Default: StoryObj = {
  render: () => html`
    <lr-radio-group name="view" label="View" orientation="horizontal">
      <lr-radio-button value="day" checked>Day</lr-radio-button>
      <lr-radio-button value="week">Week</lr-radio-button>
      <lr-radio-button value="month">Month</lr-radio-button>
    </lr-radio-group>
  `,
};

export const AdornmentAliases: StoryObj = {
  name: 'Start/end and prefix/suffix adornments',
  parameters: {
    docs: {
      description: {
        story:
          'Canonical and Shoelace slot spellings share the same edge wrappers. The label-only option shows that empty start/end wrappers collapse and contribute no extra gap; the aria-labelled empty option collapses all three content wrappers.',
      },
    },
  },
  render: () => html`
    <lr-radio-group name="adornment-aliases" label="Adornment aliases" orientation="horizontal">
      <lr-radio-button value="canonical" checked>
        <span slot="start">Start</span>
        Canonical
        <span slot="end">End</span>
      </lr-radio-button>
      <lr-radio-button value="shoelace">
        <span slot="prefix">Prefix</span>
        Shoelace
        <span slot="suffix">Suffix</span>
      </lr-radio-button>
      <lr-radio-button value="label-only">Label only</lr-radio-button>
      <lr-radio-button value="empty" aria-label="Empty visual button"></lr-radio-button>
    </lr-radio-group>
  `,
};

export const IndependentStateTheme: StoryObj = {
  name: 'Independent checked and pointer theme',
  render: () => html`
    <lr-radio-group name="button-state-theme" label="State hooks" orientation="horizontal">
      <lr-radio-button
        value="checked"
        checked
        style="--lr-radio-button-gap: var(--lr-space-s); --lr-radio-button-checked-bg: var(--lr-color-success); --lr-radio-button-checked-border-color: var(--lr-color-success); --lr-radio-button-checked-color: var(--lr-color-on-success); --lr-radio-button-checked-hover-bg: var(--lr-color-warning); --lr-radio-button-checked-active-bg: var(--lr-color-danger);"
      >Checked</lr-radio-button>
      <lr-radio-button
        value="rest"
        style="--lr-radio-button-gap: var(--lr-space-s); --lr-radio-button-hover-bg: var(--lr-color-success-quiet); --lr-radio-button-active-bg: var(--lr-color-warning-quiet);"
      >Unchecked</lr-radio-button>
    </lr-radio-group>
  `,
};

export const Disabled: StoryObj = {
  render: () => html`
    <lr-radio-group name="tier" label="Tier" orientation="horizontal">
      <lr-radio-button value="free" checked>Free</lr-radio-button>
      <lr-radio-button value="pro" disabled>Pro</lr-radio-button>
    </lr-radio-group>
  `,
};

export const RightToLeft: StoryObj = {
  name: 'RTL',
  render: () => html`
    <div dir="rtl">
      <lr-radio-group name="view-rtl" label="عرض" orientation="horizontal">
        <lr-radio-button value="day" checked>يوم</lr-radio-button>
        <lr-radio-button value="week">أسبوع</lr-radio-button>
      </lr-radio-group>
    </div>
  `,
};

/** Standalone exact-320px buttons contain unbroken label and adornment content in both directions. */
export const StandaloneNarrow: StoryObj = {
  name: 'Standalone narrow LTR/RTL (320px)',
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-m)">
      ${(['ltr', 'rtl'] as const).map(
        (direction) => html`
          <div dir=${direction} style="inline-size: 320px; max-inline-size: 100%">
            <lr-radio-button value=${direction}>
              <span slot="prefix">UnbrokenPrefixAdornmentWithoutNaturalBreaks</span>
              InternationalizedStandaloneRadioButtonLabelWithoutAnyNaturalBreakOpportunity
              <span slot="suffix">UnbrokenSuffixAdornmentWithoutNaturalBreaks</span>
            </lr-radio-button>
          </div>
        `,
      )}
    </div>
  `,
};

export const Sizes: StoryObj = {
  name: 'Size ladder',
  parameters: {
    docs: {
      description: {
        story:
          "`size` is the library's shared ladder, inherited from `<lr-radio>`, so a row of buttons at one `size` lines up with an `<lr-input>`, `<lr-select>` or `<lr-button>` of the same `size`. Both spellings of every tier are accepted — `s`/`m`/`l` and Web Awesome's `small`/`medium`/`large`.",
      },
    },
  },
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-m); justify-items: start;">
      ${(['2xs', 'xs', 's', 'm', 'l', 'xl'] as const).map(
        (size) => html`<lr-radio-group name="view-${size}" label="Size ${size}" size=${size} orientation="horizontal">
          <lr-radio-button value="day" checked>Day</lr-radio-button>
          <lr-radio-button value="week">Week</lr-radio-button>
        </lr-radio-group>`,
      )}
    </div>
  `,
};

export const NonDestructiveGroupProjection: StoryObj = {
  name: 'Non-destructive group name/size projection',
  parameters: {
    docs: {
      description: {
        story:
          'The group visually projects `size="l"` and owns the submitted name while each child retains its authored `name`/`size`. Read `effectiveName` and `effectiveSize` for the active aggregate values; removing a child immediately restores its own tier.',
      },
    },
  },
  render: () => html`
    <lr-radio-group name="aggregate-plan" size="l" label="Projected large tier" orientation="horizontal">
      <lr-radio-button name="author-free" size="xs" value="free" checked>Free</lr-radio-button>
      <lr-radio-button name="author-pro" size="s" value="pro">Pro</lr-radio-button>
    </lr-radio-group>
  `,
};

export const Pill: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          '`pill` rounds the outer edges of the button row into a pill. It is declared on `<lr-radio>` so both tags carry one property with one meaning; a plain `<lr-radio>`\'s indicator is already a circle, so the setting is visible here.',
      },
    },
  },
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-m); justify-items: start;">
      <lr-radio-group name="pill-off" label="Default corners" orientation="horizontal">
        <lr-radio-button value="day" checked>Day</lr-radio-button>
        <lr-radio-button value="week">Week</lr-radio-button>
        <lr-radio-button value="month">Month</lr-radio-button>
      </lr-radio-group>
      <lr-radio-group name="pill-on" label="Pill" orientation="horizontal">
        <lr-radio-button value="day" pill checked>Day</lr-radio-button>
        <lr-radio-button value="week" pill>Week</lr-radio-button>
        <lr-radio-button value="month" pill>Month</lr-radio-button>
      </lr-radio-group>
    </div>
  `,
};

/** Run geometry follows rendered adjacency rather than DOM first/last position. */
export const ActualRunGeometry: StoryObj = {
  name: 'Adjacent, separated, mixed, and wrapped runs',
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-l); max-inline-size: var(--lr-size-28rem)">
      <lr-radio-group
        name="adjacent"
        label="Actually adjacent"
        orientation="horizontal"
        style="--lr-radio-group-row-gap: 0"
      >
        <lr-radio-button value="day" checked>Day</lr-radio-button>
        <lr-radio-button value="week">Week</lr-radio-button>
        <lr-radio-button value="month">Month</lr-radio-button>
      </lr-radio-group>
      <lr-radio-group name="mixed" label="Separated and mixed" orientation="horizontal">
        <lr-radio-button value="day" checked>Day</lr-radio-button>
        <lr-radio value="automatic">Automatic</lr-radio>
        <lr-radio-button value="month">Month</lr-radio-button>
      </lr-radio-group>
      <lr-radio-group
        name="wrapped"
        label="Wrapped"
        orientation="horizontal"
        style="--lr-radio-group-row-gap: 0; inline-size: var(--lr-size-8rem)"
      >
        <lr-radio-button value="alpha" checked>Alpha</lr-radio-button>
        <lr-radio-button value="beta">Beta</lr-radio-button>
        <lr-radio-button value="gamma">Gamma</lr-radio-button>
      </lr-radio-group>
    </div>
  `,
};
