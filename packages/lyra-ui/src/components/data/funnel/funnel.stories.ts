import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './funnel.js';

const meta: Meta = {
  title: 'Data Display/Funnel',
  component: 'lr-funnel',
  tags: ['autodocs'],
};

export default meta;

const SIGNUP = [
  { label: 'Visited pricing', value: 12_480 },
  { label: 'Started trial', value: 4310 },
  { label: 'Invited a teammate', value: 1620 },
  { label: 'Converted to paid', value: 512 },
];

export const Default: StoryObj = {
  render: () => html`
    <lr-funnel label="Self-serve signup" .stages=${SIGNUP} style="max-inline-size: 32rem"></lr-funnel>
  `,
};

/** The comparison cohort is normalized to its own first stage, so shapes compare even when the
 *  absolute volumes do not. */
export const AgainstAPeerGroup: StoryObj = {
  render: () => html`
    <lr-funnel
      label="Acme vs. all customers"
      comparison-label="All customers"
      style="max-inline-size: 32rem"
      .stages=${[
        { label: 'Visited pricing', value: 380 },
        { label: 'Started trial', value: 141 },
        { label: 'Invited a teammate', value: 44 },
        { label: 'Converted to paid', value: 12 },
      ]}
      .comparison=${SIGNUP}
    ></lr-funnel>
  `,
};

export const FractionalShares: StoryObj = {
  render: () => html`
    <lr-funnel
      label="Checkout"
      share-precision="1"
      style="max-inline-size: 32rem"
      .stages=${[
        { label: 'Cart', value: 9834 },
        { label: 'Shipping', value: 6127 },
        { label: 'Payment', value: 2418 },
        { label: 'Purchased', value: 1902 },
      ]}
    ></lr-funnel>
  `,
};

/** A stage can exceed its predecessor when users re-enter the funnel; the share is reported
 *  truthfully above 100% while the bar clamps to the track. */
export const ReEntry: StoryObj = {
  render: () => html`
    <lr-funnel
      label="Onboarding with re-entry"
      style="max-inline-size: 32rem"
      .stages=${[
        { label: 'Invited', value: 800 },
        { label: 'Accepted', value: 460 },
        { label: 'Re-invited and accepted', value: 910 },
      ]}
    ></lr-funnel>
  `,
};

export const WithoutDropoff: StoryObj = {
  render: () => html`
    <lr-funnel
      label="Self-serve signup"
      dropoff="false"
      .stages=${SIGNUP}
      style="max-inline-size: 32rem"
    ></lr-funnel>
  `,
};

export const Themed: StoryObj = {
  render: () => html`
    <lr-funnel
      label="Support deflection"
      style="max-inline-size: 32rem; --lr-funnel-bar-color: var(--lr-color-success); --lr-funnel-bar-size: 2rem"
      .stages=${[
        { label: 'Opened help', value: 5400 },
        { label: 'Read an article', value: 3100 },
        { label: 'Filed a ticket', value: 640, color: 'var(--lr-color-warning)' },
      ]}
    ></lr-funnel>
  `,
};

/** Values, shares and drop-off percentages all format through the effective locale. */
export const Localized: StoryObj = {
  render: () => html`
    <lr-funnel
      locale="de-DE"
      label="Registrierung"
      share-precision="1"
      style="max-inline-size: 32rem"
      .stages=${[
        { label: 'Preisseite besucht', value: 12_480 },
        { label: 'Test gestartet', value: 4310 },
        { label: 'Gekauft', value: 512 },
      ]}
    ></lr-funnel>
  `,
};

export const RightToLeft: StoryObj = {
  render: () => html`
    <lr-funnel
      dir="rtl"
      locale="ar"
      label="التسجيل"
      style="max-inline-size: 32rem"
      .stages=${[
        { label: 'زار صفحة الأسعار', value: 12_480 },
        { label: 'بدأ التجربة', value: 4310 },
        { label: 'اشترى', value: 512 },
      ]}
    ></lr-funnel>
  `,
};

/** Every degenerate input has a defined rendering rather than an empty box. */
export const EdgeCases: StoryObj = {
  render: () => html`
    <div style="display: grid; gap: 2rem; max-inline-size: 32rem">
      <lr-funnel label="No stages at all"></lr-funnel>
      <lr-funnel label="One stage" .stages=${[{ label: 'Visited', value: 940 }]}></lr-funnel>
      <lr-funnel
        label="Zero first stage"
        .stages=${[
          { label: 'Visited', value: 0 },
          { label: 'Signed up', value: 40 },
        ]}
      ></lr-funnel>
      <lr-funnel
        label="Shorter comparison series"
        .stages=${SIGNUP}
        .comparison=${[
          { label: 'Visited pricing', value: 900 },
          { label: 'Started trial', value: 260 },
        ]}
      ></lr-funnel>
    </div>
  `,
};
