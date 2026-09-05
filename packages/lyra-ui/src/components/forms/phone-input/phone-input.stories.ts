import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../../media/flag/flag-peer.js';
import type { LyraPhoneInput, LyraPhoneNumberAdapter } from './phone-input.class.js';
import type { LyraSizeStep } from '../../../internal/variants.js';

const demoAdapter: LyraPhoneNumberAdapter = {
  countries: [
    { code: 'LU', callingCode: '352' },
    { code: 'FR', callingCode: '33' },
    { code: 'DE', callingCode: '49' },
    { code: 'BE', callingCode: '32' },
  ],
  parse(input, country) {
    const raw = input.trim();
    if (!raw) return { status: 'empty' };
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 6) return { status: 'incomplete', formatted: raw };
    const callingCode = this.countries?.find((row) => row.code === country)?.callingCode;
    if (!callingCode) return { status: 'invalid', formatted: raw };
    const national = digits.replace(new RegExp(`^${callingCode}`), '').replace(/^0/, '');
    return {
      status: 'valid',
      country,
      e164: `+${callingCode}${national}`,
      formatted: national.replace(/(\d{3})(?=\d)/g, '$1 '),
    };
  },
};

const meta: Meta = {
  title: 'Forms/PhoneInput',
  component: 'lr-phone-input',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Text edits relay native input then lr-input; commits relay native change then lr-change, and a country pick emits both pairs. Focus/blur preserve native FocusEvent payload before their lr-* aliases.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-phone-input
      label="Mobile number"
      hint="Used only for account security"
      placeholder="621 123 456"
      default-country="LU"
      .adapter=${demoAdapter}
      style="max-width: 24rem"
    ></lr-phone-input>
  `,
};

/** Host naming and public focus/selection methods target the native telephone input. */
export const AccessibleEditingSurface: Story = {
  render: () => html`
    <div style="display: grid; gap: 0.75rem; max-width: 24rem;">
      <lr-phone-input
        aria-label="Account mobile number"
        value="+352621123456"
        default-country="LU"
        .adapter=${demoAdapter}
      ></lr-phone-input>
      <button
        type="button"
        style="justify-self: start;"
        @click=${(event: Event) => {
          const phoneInput = (event.currentTarget as HTMLElement).parentElement!.querySelector(
            'lr-phone-input',
          ) as LyraPhoneInput;
          phoneInput.focus();
          phoneInput.select();
        }}
      >Focus and select the number</button>
    </div>
  `,
};

/**
 * `flags` renders the selected country's `<lr-flag>` inside the compact country trigger. Flag
 * artwork comes from the optional `@aceshooting/lyra-flags` peer, registered here exactly as for
 * a standalone `<lr-flag>` (the `flag-peer.js` import); without it the trigger just omits the
 * image. The native dropdown list itself stays text-only — an `<option>` cannot contain elements.
 */
export const WithFlags: Story = {
  render: () => html`
    <lr-phone-input
      label="Mobile number"
      flags
      default-country="LU"
      .adapter=${demoAdapter}
      style="max-width: 24rem"
    ></lr-phone-input>
  `,
};

/** Country-selector rows use the shared hit-floor-aware control ladder at every size. */
export const Sizes: Story = {
  render: () => {
    const sizes: LyraSizeStep[] = ['2xs', 'xs', 's', 'm', 'l', 'xl'];
    return html`
      <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 20rem">
        ${sizes.map(
          (size) => html`
            <lr-phone-input
              size=${size}
              label=${`Size "${size}"`}
              default-country="LU"
              .adapter=${demoAdapter}
            ></lr-phone-input>
          `,
        )}
      </div>
    `;
  },
};

/**
 * `size` also accepts the Web Awesome / Shoelace spellings — `small`, `medium` and `large` render
 * exactly as `s`, `m` and `l` — and `pill` rounds the field (and the country trigger's leading
 * corners) to a full pill.
 */
export const AliasSizesAndPill: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 20rem">
      <lr-phone-input size="small" label='size="small"' default-country="LU" .adapter=${demoAdapter}></lr-phone-input>
      <lr-phone-input size="medium" label='size="medium"' default-country="LU" .adapter=${demoAdapter}></lr-phone-input>
      <lr-phone-input size="large" label='size="large"' default-country="LU" .adapter=${demoAdapter}></lr-phone-input>
      <lr-phone-input pill label="pill" default-country="LU" .adapter=${demoAdapter}></lr-phone-input>
    </div>
  `,
};

export const Required: Story = {
  render: () => html`
    <lr-phone-input
      label="Contact number"
      required
      default-country="FR"
      .adapter=${demoAdapter}
      style="max-width: 24rem"
    ></lr-phone-input>
  `,
};

/** Readonly keeps the telephone value focusable, selectable, and submittable while locking both
 * the text surface and the country selector; autofocus is forwarded to that real native input. */
export const ReadonlyAutofocus: Story = {
  name: 'Readonly with native autofocus',
  render: () => html`
    <form>
      <lr-phone-input
        name="mobile"
        label="Readonly contact number"
        value="+352621123456"
        default-country="LU"
        readonly
        autofocus
        .adapter=${demoAdapter}
      ></lr-phone-input>
    </form>
  `,
};

/** Any supplied catalog is authoritative. An explicit empty array deliberately removes country
 * selection even when the adapter carries automatic metadata. */
export const AuthoritativeEmptyCountries: Story = {
  name: 'Authoritative empty country catalog',
  render: () => html`
    <lr-phone-input
      label="International number without country selector"
      .countries=${[]}
      .adapter=${demoAdapter}
    ></lr-phone-input>
  `,
};

export const OptionalCountryAdornment: Story = {
  render: () => html`
    <lr-phone-input
      label="Mobile number"
      default-country="LU"
      .adapter=${demoAdapter}
      style="max-width: 24rem"
    >
      <span slot="country-prefix" aria-hidden="true">🌍</span>
    </lr-phone-input>
  `,
};

export const E164WithoutMetadata: Story = {
  render: () => html`
    <lr-phone-input
      label="International number"
      hint="Already-international E.164 input works without a numbering-plan adapter."
      value="+352621123456"
      style="max-width: 24rem"
    ></lr-phone-input>
  `,
};

export const Narrow: Story = {
  render: () => html`
    <div style="inline-size: 20rem; max-inline-size: 100%">
      <lr-phone-input
        label="A deliberately long translated telephone-field label"
        hint="Long supporting text wraps within the component's own narrow allocation."
        default-country="DE"
        .adapter=${demoAdapter}
      ></lr-phone-input>
    </div>
  `,
};

export const RightToLeft: Story = {
  render: () => html`
    <div dir="rtl" lang="ar" style="max-width: 24rem">
      <lr-phone-input
        label="رقم الهاتف"
        country-label="البلد"
        default-country="LU"
        .adapter=${demoAdapter}
      ></lr-phone-input>
    </div>
  `,
};

/** Ancestor theme values override size and pill fallbacks. */
export const AncestorTheme: Story = {
  render: () => html`
    <div
      style="
        --lr-phone-input-padding-block: var(--lr-space-s);
        --lr-phone-input-font-size: var(--lr-font-size-lg);
        --lr-phone-input-flag-size: var(--lr-size-1-5rem);
        --lr-phone-input-glyph-size: var(--lr-size-1-5rem);
        --lr-phone-input-gap: var(--lr-space-m);
        --lr-phone-input-radius: var(--lr-radius-xs);
        --lr-phone-input-control-min-height: var(--lr-size-3rem);
      "
    >
      <lr-phone-input
        size="2xs"
        pill
        flags
        default-country="LU"
        label="Telephone"
        .adapter=${demoAdapter}
      ></lr-phone-input>
    </div>
  `,
};

export const ExternalDescription: StoryObj = {
  parameters: { docs: { description: { story: 'External guidance is resolved onto the value control before its local hint; changing the referenced content keeps the relationship current.' } } },
  render: () => html`
    <div>
      <p id="lr-phone-input-external-guidance">Use the details associated with your account.</p>
      <lr-phone-input label="Phone number" hint="Include the local area code" aria-describedby="lr-phone-input-external-guidance"></lr-phone-input>
    </div>
  `,
};

export const AuthoredCopy: StoryObj = {
  parameters: { docs: { description: { story: 'Explicit copy wins over locale strings, including the English default and an empty country label. Removing copy attributes restores default property readback and localized copy. An empty validation override still uses a localized native error reason.' } } },
  render: () => html`
    <lr-phone-input
      label="Phone number"
      default-country="LU"
      country-label="Select"
      incomplete-text="Enter the complete contact number."
      invalid-text="Check the contact number."
      .adapter=${demoAdapter}
      .strings=${{ select: 'Choisir', phoneInputIncomplete: 'Numéro incomplet.', valueInvalid: 'Numéro invalide.' }}
    ></lr-phone-input>
  `,
};
