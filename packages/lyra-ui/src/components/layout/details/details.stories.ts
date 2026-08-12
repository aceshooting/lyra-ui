import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './details.js';
import { storyColor } from '../../../../../../.storybook/theme-contract.js';

const meta: Meta = { title: 'Disclosure/Details', component: 'lr-details', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-details summary="More information">Additional details.</lr-details>` };

/** A present host `aria-label` names the native summary trigger, including an explicitly empty
 *  attribute; without it, the trigger keeps its content-derived name. */
export const AccessibleNamePrecedence: StoryObj = {
  render: () => html`<lr-details summary="Visible fallback" aria-label="Security settings">
    Configure access and verification options.
  </lr-details>`,
};

export const GroupedWithCustomIcons: StoryObj = {
  name: 'Named group, appearance, and custom icons',
  parameters: {
    docs: {
      description: {
        story:
          'Disclosures with the same non-empty `name` in one document or shadow root are mutually exclusive. `icon-placement` is logical, and the two icon slots select closed/open artwork without replacing the summary control. The icon wrapper exports both `icon` and the Shoelace-compatible `summary-icon` part.',
      },
    },
  },
  render: () => html`
    <div style="display:grid; gap:var(--lr-space-xs); max-inline-size:28rem;">
      <lr-details
        name="project-settings"
        appearance="filled"
        icon-placement="start"
        summary="Generation settings"
        open
      >
        <span slot="expand-icon">＋</span>
        <span slot="collapse-icon">−</span>
        Configure the generation model and limits.
      </lr-details>
      <lr-details
        name="project-settings"
        appearance="filled"
        icon-placement="start"
        summary="Publishing settings"
      >
        <span slot="expand-icon">＋</span>
        <span slot="collapse-icon">−</span>
        Configure destinations and review policy.
      </lr-details>
    </div>
  `,
};

export const Sizes: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          "`size` runs the library's shared ladder. Both spellings of a tier work (`s`/`small`, `m`/`medium`, `l`/`large`), so markup migrated from Web Awesome or Shoelace needs no attribute rewrite.",
      },
    },
  },
  render: () => html`
    <div style="inline-size:24rem">
      ${(['2xs', 'xs', 's', 'm', 'l', 'xl'] as const).map(
        (size) =>
          html`<lr-details size=${size} summary=${`Size "${size}"`}
            >The panel and its summary both take the tier's rhythm.</lr-details
          >`,
      )}
    </div>
  `,
};

export const ThemedAppearancesAndStates: StoryObj = {
  name: 'Themed appearances and states',
  parameters: {
    docs: {
      description: {
        story:
          'Appearance, hover, and pressed paint use inheritable component-scoped hooks, so one disclosure family can be themed without changing shared surface or brand tokens.',
      },
    },
  },
  render: () => html`
    <div
      style="
        display: grid;
        gap: var(--lr-space-s);
        --lr-details-outlined-bg: ${storyColor('surface')};
        --lr-details-outlined-border-color: ${storyColor('border')};
        --lr-details-filled-bg: ${storyColor('successQuiet')};
        --lr-details-filled-border-color: ${storyColor('success')};
        --lr-details-filled-outlined-bg: ${storyColor('warningQuiet')};
        --lr-details-filled-outlined-border-color: ${storyColor('warning')};
        --lr-details-summary-hover-bg: ${storyColor('dangerQuiet')};
        --lr-details-summary-active-bg: ${storyColor('danger')};
        --lr-details-gap: var(--lr-space-l);
        --lr-details-radius: var(--lr-radius-pill);
      "
    >
      <lr-details appearance="outlined" summary="Outlined">Outlined content.</lr-details>
      <lr-details appearance="filled" summary="Filled">Filled content.</lr-details>
      <lr-details appearance="filled-outlined" summary="Filled outlined">
        Hover and press this summary to exercise the scoped state hooks.
      </lr-details>
    </div>
  `,
};

export const NarrowRtlLongContent: StoryObj = {
  name: 'Narrow RTL long content (320px)',
  parameters: {
    docs: {
      description: {
        story:
          'An exact 320px RTL allocation keeps an expanded long localized summary, content block, and action inside the disclosure surface.',
      },
    },
  },
  render: () => html`
    <div
      dir="rtl"
      style="inline-size: 320px; max-inline-size: 100%; border: var(--lr-border-width-thin) dashed var(--lr-color-border);"
    >
      <lr-details open>
        <span slot="summary">عنوانتفاصيلمحليطويلجداًبدونأيفرصةللفصلالتلقائي</span>
        <p>محتوىتفصيليمحليطويلجداًبدونأيفرصةللفصلالتلقائي</p>
        <button type="button">إجراءمحليطويلجداًبدونأيفرصةللفصلالتلقائي</button>
      </lr-details>
    </div>
  `,
};

export const Lifecycle: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          'Opening emits `lr-show` (cancelable), then `lr-toggle`, then `lr-after-show`; closing mirrors it. The `lr-toggle` detail includes `source`: `user` for summary activation, `programmatic` for the API or `open`, and `peer` for a named sibling close. The `animating` CSS state exists until that settled boundary. `await details.show()` and `await details.hide()` settle after the matching `lr-after-*` event. Because the native `<details>` toggle is intercepted, a vetoed `lr-show` cannot leave the panel visually expanded.',
      },
    },
  },
  render: () => html`
    <lr-details
      summary="Vetoes the first open attempt"
      @lr-show=${(event: Event) => {
        const el = event.currentTarget as HTMLElement & { dataset: DOMStringMap };
        if (el.dataset['refused']) return;
        el.dataset['refused'] = 'yes';
        event.preventDefault();
      }}
    >
      The first click is refused by an <code>lr-show</code> listener; the second one opens the panel.
    </lr-details>
  `,
};
