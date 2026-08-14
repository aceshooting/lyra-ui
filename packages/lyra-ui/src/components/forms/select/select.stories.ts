import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraSelect, LyraSelectAppearance, LyraSelectSize } from './select.js';
import type { LyraOption } from '../combobox/option.class.js';

const meta: Meta = {
  title: 'Select',
  component: 'lr-select',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A select-only combobox. Host `aria-label` wins on the trigger by attribute presence, including an explicitly empty override.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;
type PlacementStory = StoryObj<{
  placement: LyraSelect['placement'];
  hoist: boolean;
  direction: 'ltr' | 'rtl';
}>;

export const Default: Story = {
  render: () => html`
    <lr-select label="Fruit" placeholder="Pick one…" style="max-width: 20rem">
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b">Banana</lr-option>
      <lr-option value="c">Cherry</lr-option>
      <lr-option value="d">Date</lr-option>
    </lr-select>
  `,
};

/**
 * Open the list and move the keyboard-active row before using these controls. Reordering preserves
 * the active option by identity; removing or disabling it rehomes activity to the nearest enabled
 * survivor so the next Enter still commits a real row.
 */
export const DynamicOptions: Story = {
  render: () => html`
    <div style="display: grid; gap: 0.75rem; max-width: 20rem;">
      <lr-select open label="Dynamic fruit options">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
        <lr-option value="c">Cherry</lr-option>
      </lr-select>
      <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
        <button
          type="button"
          @mousedown=${(event: MouseEvent) => event.preventDefault()}
          @click=${(event: Event) => {
            const select = (event.currentTarget as HTMLElement).closest('div')!.previousElementSibling as LyraSelect;
            const banana = select.querySelector<LyraOption>('lr-option[value="b"]');
            if (banana) select.append(banana);
          }}
        >Move Banana last</button>
        <button
          type="button"
          @mousedown=${(event: MouseEvent) => event.preventDefault()}
          @click=${(event: Event) => {
            const select = (event.currentTarget as HTMLElement).closest('div')!.previousElementSibling as LyraSelect;
            const cherry = select.querySelector<LyraOption>('lr-option[value="c"]');
            if (cherry) cherry.disabled = true;
          }}
        >Disable Cherry</button>
        <button
          type="button"
          @mousedown=${(event: MouseEvent) => event.preventDefault()}
          @click=${(event: Event) => {
            const select = (event.currentTarget as HTMLElement).closest('div')!.previousElementSibling as LyraSelect;
            select.querySelector('lr-option[value="c"]')?.remove();
          }}
        >Remove Cherry</button>
      </div>
    </div>
  `,
};

/** `selectedOptions` accepts exact live option occurrences and updates the value without events. */
export const WritableSelectedOptions: Story = {
  render: () => html`
    <div style="display: grid; gap: 0.75rem; max-width: 20rem;">
      <lr-select label="Fruit" multiple>
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
        <lr-option value="c">Cherry</lr-option>
      </lr-select>
      <button
        type="button"
        style="justify-self: start;"
        @click=${(event: Event) => {
          const root = (event.currentTarget as HTMLElement).parentElement!;
          const select = root.querySelector('lr-select') as LyraSelect;
          const options = [...select.querySelectorAll('lr-option')] as LyraOption[];
          select.selectedOptions = [options[1]!, options[2]!];
        }}
      >Select Banana and Cherry by option reference</button>
    </div>
  `,
};

/** `focus()` and `blur()` target the internal combobox trigger and surface host events. */
export const ProgrammaticFocus: Story = {
  render: () => html`
    <div style="display: grid; gap: 0.75rem; max-width: 20rem;">
      <lr-select label="Fruit" placeholder="Pick one…">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
      <button
        type="button"
        style="justify-self: start;"
        @click=${(event: Event) => {
          const select = (event.currentTarget as HTMLElement).parentElement!.querySelector(
            'lr-select',
          ) as LyraSelect;
          select.focus();
        }}
      >Focus the select</button>
    </div>
  `,
};

/**
 * `<lr-option selected>` sets `defaultSelected` and seeds the initial value. Live selection stays
 * property-only, while form reset returns to this attribute-backed default.
 */
export const PreSelectedValue: Story = {
  render: () => html`
    <lr-select label="Fruit" style="max-width: 20rem">
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b" selected>Banana</lr-option>
      <lr-option value="c">Cherry</lr-option>
      <lr-option value="d">Date</lr-option>
    </lr-select>
  `,
};

/**
 * Rows come from `<lr-option>` children plus `group` (labelled `role="group"` sections),
 * `sub` (a secondary line), and `dot-color` (a leading status dot) — same
 * rich-row support as `<lr-combobox>`.
 */
export const RichRows: Story = {
  render: () => html`
    <lr-select label="Inverter" placeholder="Pick one…" style="max-width: 22rem">
      <lr-option value="inv-1" group="Building A" sub="Running" dot-color="var(--lr-color-success)">
        Inverter 1
      </lr-option>
      <lr-option value="inv-2" group="Building A" sub="Idle" dot-color="var(--lr-color-text-quiet)">
        Inverter 2
      </lr-option>
      <lr-option value="inv-3" group="Building B" sub="Fault" dot-color="var(--lr-color-danger)">
        Inverter 3
      </lr-option>
    </lr-select>
  `,
};

/**
 * `size` walks the library's one form-control ladder, shared with `<lr-button>`/`<lr-input>`/
 * `<lr-textarea>`, so same-tier controls are the same height in a toolbar row. Default `m`.
 */
export const Sizes: Story = {
  render: () => {
    const sizes: LyraSelectSize[] = ['2xs', 'xs', 's', 'm', 'l', 'xl'];
    return html`
      <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 20rem">
        ${sizes.map(
          (size) => html`
            <lr-select size=${size} placeholder=${`Size "${size}"`}>
              <lr-option value="a">Apple</lr-option>
              <lr-option value="b">Banana</lr-option>
            </lr-select>
          `,
        )}
      </div>
    `;
  },
};

/** The `small`/`medium`/`large` spellings render exactly what `s`/`m`/`l` render. */
export const SizeSpellings: Story = {
  name: 'Both size spellings',
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 20rem">
      ${['s', 'small', 'm', 'medium', 'l', 'large'].map(
        (size) => html`
          <lr-select size=${size} placeholder=${`size="${size}"`}>
            <lr-option value="a">Apple</lr-option>
            <lr-option value="b">Banana</lr-option>
          </lr-select>
        `,
      )}
    </div>
  `,
};

export const Disabled: Story = {
  render: () => html`
    <lr-select label="Disabled" disabled placeholder="Can't touch this" style="max-width: 20rem">
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b">Banana</lr-option>
    </lr-select>
  `,
};

/** Start/end and prefix/suffix remain mirrored decorative slots. Their wrappers are always inert
 * and `aria-hidden`, so supplied content cannot become an invalid nested control. */
export const Adornments: Story = {
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-select label="Deployment region" value="primary">
        <span slot="start" aria-hidden="true">◉</span>
        <kbd slot="end">R</kbd>
        <lr-option value="primary"
          >Primary-production-region-with-an-intentionally-long-identifier</lr-option
        >
        <lr-option value="backup">Backup region</lr-option>
      </lr-select>
    </div>
  `,
};

/** Long selected labels and multiple tag rows remain inside exact-320px LTR/RTL allocations. */
export const SelectedValuesNarrow: Story = {
  name: 'Selected values narrow LTR/RTL (320px)',
  render: () => {
    const values = ['alpha', 'beta', 'gamma'];
    return html`
      <div style="display: grid; gap: var(--lr-space-m)">
        ${(['ltr', 'rtl'] as const).map(
          (direction) => html`
            <div dir=${direction} style="display: grid; gap: var(--lr-space-s); inline-size: 320px; max-inline-size: 100%">
              <lr-select value="primary" label="Single selection">
                <span slot="start" aria-hidden="true">◉</span>
                <kbd slot="end">R</kbd>
                <lr-option value="primary"
                  >PrimaryProductionRegionWithAnIntentionallyUnbrokenGeneratedIdentifier</lr-option
                >
              </lr-select>
              <lr-select multiple .value=${values} label="Multiple selection">
                ${values.map(
                  (value) => html`<lr-option value=${value}
                    >${value}GeneratedSelectionIdentifierWithoutNaturalBreaks</lr-option
                  >`,
                )}
              </lr-select>
            </div>
          `,
        )}
      </div>
    `;
  },
};

/** A long localized placeholder ellipsizes without widening its constrained flex allocation. */
export const LongLocalizedPlaceholder: Story = {
  render: () => html`
    <div style="display:flex; inline-size:228px; max-inline-size:100%; min-inline-size:0;">
      <lr-select
        label="Deployment environment"
        placeholder="Sélectionnez un environnement de déploiement disponible dans cette région"
        style="min-inline-size:0; flex:1 1 auto;"
      >
        <lr-option value="production">Production</lr-option>
        <lr-option value="staging">Staging</lr-option>
      </lr-select>
    </div>
  `,
};

/**
 * When exactly one `<lr-option>` is enabled, the trigger auto-commits that
 * option on click or Arrow Up/Down instead of opening a listbox — no chevron,
 * no popup. Useful for "only one choice available" states that would
 * otherwise force an unnecessary extra click.
 */
export const SingleOption: Story = {
  render: () => html`
    <lr-select label="Region" auto-commit-single-option style="max-width: 20rem">
      <lr-option value="us-east">US East</lr-option>
    </lr-select>
  `,
};

/** The same auto-commit behavior applies when only one option remains available among unavailable ones. */
export const SingleEnabledAmongDisabled: Story = {
  render: () => html`
    <lr-select label="Plan" auto-commit-single-option style="max-width: 20rem">
      <lr-option value="free" disabled>Free (unavailable)</lr-option>
      <lr-option value="pro">Pro</lr-option>
      <lr-option value="enterprise" disabled>Enterprise (unavailable)</lr-option>
    </lr-select>
  `,
};

/**
 * `required` blocks form submission while empty; `error-text` renders a
 * validation message alongside the shared `hint`.
 */
export const RequiredWithValidation: Story = {
  render: () => html`
    <form style="display: flex; flex-direction: column; gap: 1.5rem; max-width: 22rem">
      <lr-select label="Required" required hint="Pick your favorite">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
      <lr-select label="Invalid" required error-text="Selection required">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
      <button type="submit">Submit</button>
    </form>
  `,
};

/**
 * `multiple` turns the value into a `string[]` and renders one removable chip per selection.
 * Remove buttons are legal focusable siblings overlaid on the trigger, never nested inside it.
 * The trigger exposes one complete joined selected-value string while built-in painted chip labels
 * are hidden from assistive technology, so capped chips neither truncate nor duplicate the value.
 * Picking a selected row or pressing Backspace on the trigger remain equivalent alternatives.
 * Closed type-ahead skips selected occurrences and continues to a later unselected label match.
 */
export const Multiple: Story = {
  render: () => html`
    <lr-select label="Fruit" multiple placeholder="Pick any" style="max-width: 22rem">
      <lr-option value="a" selected>Apple</lr-option>
      <lr-option value="b" selected>Banana</lr-option>
      <lr-option value="c">Cherry</lr-option>
      <lr-option value="d">Date</lr-option>
    </lr-select>
  `,
};

/** Past `max-options-visible` chips, the rest collapse behind a localized "+N" chip. */
export const MaxOptionsVisible: Story = {
  render: () => html`
    <lr-select label="Fruit" multiple max-options-visible="2" style="max-width: 22rem">
      <lr-option value="a" selected>Apple</lr-option>
      <lr-option value="b" selected>Banana</lr-option>
      <lr-option value="c" selected>Cherry</lr-option>
      <lr-option value="d" selected>Date</lr-option>
    </lr-select>
  `,
};

/** `getTag` replaces a chip entirely, so the consumer owns its markup and parts. */
export const CustomTags: Story = {
  render: () => html`
    <lr-select
      label="Fruit"
      multiple
      style="max-width: 22rem"
      .getTag=${(option: LyraOption, index: number) =>
        html`<span part="tag" style="text-transform: uppercase">${index + 1}. ${option.label}</span>`}
    >
      <lr-option value="a" selected>Apple</lr-option>
      <lr-option value="b" selected>Banana</lr-option>
      <lr-option value="c">Cherry</lr-option>
    </lr-select>
  `,
};

/** `with-clear` adds a button that empties the selection and fires `lr-clear`. */
export const WithClear: Story = {
  render: () => html`
    <lr-select label="Fruit" with-clear style="max-width: 20rem">
      <lr-option value="a" selected>Apple</lr-option>
      <lr-option value="b">Banana</lr-option>
    </lr-select>
  `,
};

/** Mapped defaults and Shoelace aliases, including a fixed-position (`hoist`) popup. */
export const MigrationAliases: Story = {
  render: () => html`
    <lr-select
      label="Fruit"
      default-value="b"
      filled
      hoist
      help-text="Uses default-value, filled, hoist, prefix and suffix aliases"
      style="max-width: 22rem"
    >
      <span slot="prefix" aria-hidden="true">●</span>
      <span slot="suffix">optional</span>
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b">Banana</lr-option>
    </lr-select>
  `,
};

/** `appearance` retunes the trigger surface; `pill` rounds its corners. */
export const Appearances: Story = {
  render: () => {
    const appearances: LyraSelectAppearance[] = [
      'accent',
      'filled',
      'outlined',
      'filled-outlined',
      'plain',
    ];
    return html`
      <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 20rem">
        ${appearances.map(
          (appearance) => html`
            <lr-select appearance=${appearance} placeholder=${appearance}>
              <lr-option value="a">Apple</lr-option>
              <lr-option value="b">Banana</lr-option>
            </lr-select>
          `,
        )}
        <lr-select pill placeholder="pill">
          <lr-option value="a">Apple</lr-option>
        </lr-select>
      </div>
    `;
  },
};

export const IndependentTriggerStateTheme: Story = {
  name: 'Independent trigger state theme',
  render: () => html`
    <lr-select
      label="State hooks"
      placeholder="Hover, press, or open"
      style="max-inline-size: var(--lr-size-20rem); --lr-select-trigger-hover-bg: var(--lr-color-success-quiet); --lr-select-trigger-active-bg: var(--lr-color-warning-quiet); --lr-select-open-border-color: var(--lr-color-danger);"
    >
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b">Banana</lr-option>
    </lr-select>
  `,
};

/** Change the controls while open: placement, positioning strategy, and logical direction refresh
 * the live positioner without closing the listbox or moving its shared overlay-stack entry. */
export const Placement: PlacementStory = {
  args: {
    placement: 'top-start',
    hoist: false,
    direction: 'ltr',
  },
  argTypes: {
    placement: {
      control: 'select',
      options: ['top-start', 'top-end', 'right-start', 'bottom-start', 'bottom-end', 'left-start'],
    },
    hoist: { control: 'boolean' },
    direction: { control: 'inline-radio', options: ['ltr', 'rtl'] },
  },
  render: ({ placement, hoist, direction }) => html`
    <div dir=${direction} style="padding-block: 12rem">
      <lr-select
        label="Fruit"
        .placement=${placement}
        ?hoist=${hoist}
        open
        style="max-width: 20rem"
      >
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    </div>
  `,
};
