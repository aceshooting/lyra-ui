import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './tab-group.js';
import './tab.js';
import './tab-panel.js';
import { storyColor } from '../../../../../../.storybook/theme-contract.js';

const meta: Meta = {
  title: 'Tabs',
  component: 'lr-tab-group',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'An APG tab strip supporting both Lyra\'s direct-child `slot`/`label` model and the upstream `<lr-tab panel>` + `<lr-tab-panel name>` model. The group synchronizes each child\'s reflected `active` SSR hint, emits `{ name, tabId }`, exposes `show(name)`, and retains logical placement and scroll-control aliases. Attribute-model icons and rich tab-label element roots are decorative, inert content while projected, so each real tab button remains the sole action and uses only accessibility-exposed flattened label text for its accessible name.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-tab-group>
      <div slot="input" label="Input" style="padding: 0.75rem 0;">Raw input goes here.</div>
      <div slot="preview" label="Preview" style="padding: 0.75rem 0;">Rendered preview goes here.</div>
      <div slot="settings" label="Settings" style="padding: 0.75rem 0;">Settings form goes here.</div>
    </lr-tab-group>
  `,
};

/** A host `aria-label` names the internal tablist by presence, including an explicitly empty
 * attribute; without it, the tablist has no localized fallback name. */
export const AccessibleNamePrecedence: Story = {
  render: () => html`
    <lr-tab-group aria-label="Workspace sections">
      <div slot="input" label="Input" style="padding: 0.75rem 0;">Raw input goes here.</div>
      <div slot="preview" label="Preview" style="padding: 0.75rem 0;">Rendered preview goes here.</div>
    </lr-tab-group>
  `,
};

export const WithDisabledTab: Story = {
  render: () => html`
    <lr-tab-group>
      <div slot="input" label="Input" style="padding: 0.75rem 0;">Raw input goes here.</div>
      <div slot="preview" label="Preview" disabled style="padding: 0.75rem 0;">
        Nothing to preview yet.
      </div>
      <div slot="settings" label="Settings" style="padding: 0.75rem 0;">Settings form goes here.</div>
    </lr-tab-group>
  `,
};

export const InitiallyActive: Story = {
  render: () => html`
    <lr-tab-group active="preview">
      <div slot="input" label="Input" style="padding: 0.75rem 0;">Raw input goes here.</div>
      <div slot="preview" label="Preview" style="padding: 0.75rem 0;">Rendered preview goes here.</div>
      <div slot="settings" label="Settings" style="padding: 0.75rem 0;">Settings form goes here.</div>
    </lr-tab-group>
  `,
};

export const AutoHiddenPanel: Story = {
  parameters: {
    docs: {
      description: {
        story: 'The "Preview" panel has no `label` attribute, so it never produces a tab -- no explicit hidden flag needed.',
      },
    },
  },
  render: () => html`
    <lr-tab-group>
      <div slot="input" label="Input" style="padding: 0.75rem 0;">Raw input goes here.</div>
      <div slot="preview" style="padding: 0.75rem 0;">This panel has no label, so it never gets a tab.</div>
      <div slot="settings" label="Settings" style="padding: 0.75rem 0;">Settings form goes here.</div>
    </lr-tab-group>
  `,
};

export const ChangeEvent: Story = {
  render: () => html`
    <div>
      <lr-tab-group @lr-tab-show=${(e: CustomEvent<{ tabId: string; name: string }>) => {
        const out = document.getElementById('tabs-change-log');
        if (out) out.textContent = `Active tab: ${e.detail.name} (${e.detail.tabId})`;
      }}>
        <div slot="input" label="Input" style="padding: 0.75rem 0;">Raw input goes here.</div>
        <div slot="preview" label="Preview" style="padding: 0.75rem 0;">Rendered preview goes here.</div>
        <div slot="settings" label="Settings" style="padding: 0.75rem 0;">Settings form goes here.</div>
      </lr-tab-group>
      <p id="tabs-change-log">Active tab: input</p>
    </div>
  `,
};

const crowdedTabs = [
  ['overview', 'Overview'],
  ['activity', 'Activity history'],
  ['artifacts', 'Generated artifacts'],
  ['evaluations', 'Evaluations'],
  ['settings', 'Workspace settings'],
  ['permissions', 'Permissions and access'],
] as const;

const crowdedPanels = () =>
  crowdedTabs.map(
    ([id, label]) => html`<div slot=${id} label=${label} style="padding: 0.75rem 0;">${label} panel</div>`,
  );

export const ScrollableOverflow: Story = {
  name: 'Scrollable overflow (scroll controls)',
  parameters: {
    docs: {
      description: {
        story:
          'A horizontal tab row that does not fit stays natively scrollable and gains a scroll control at each end, mirroring `wa-tab-group`/`sl-tab-group`. Both the controls and the edge fade appear only while the row genuinely overflows, from the same measurement, so a row that fits gets neither. The controls are pointer affordances: they are `aria-hidden` and out of the tab order, because the roving `tabindex` already puts every tab one arrow key away and focusing a tab scrolls it into view.',
      },
    },
  },
  render: () => html`
    <div style="inline-size: 375px; max-inline-size: 100%;">
      <lr-tab-group>${crowdedPanels()}</lr-tab-group>
    </div>
  `,
};

export const ScrollableOverflowRtl: Story = {
  name: 'Scrollable overflow under RTL',
  parameters: {
    docs: {
      description: {
        story:
          '"Previous" and "next" are logical, so both the controls and their chevrons mirror: the control that scrolls toward the tabs\' inline start sits on the right and points right. The chevron is turned by the wrapping `scroll-button-glyph` part, never by the icon itself.',
      },
    },
  },
  render: () => html`
    <div dir="rtl" style="inline-size: 375px; max-inline-size: 100%;">
      <lr-tab-group>${crowdedPanels()}</lr-tab-group>
    </div>
  `,
};

export const WithoutScrollControls: Story = {
  name: 'Overflow without scroll controls',
  parameters: {
    docs: {
      description: {
        story:
          '`without-scroll-controls` (Shoelace spells it `no-scroll-controls`; both work and neither is deprecated) leaves the overflowing row natively scrollable with the edge fade as its only affordance.',
      },
    },
  },
  render: () => html`
    <div style="inline-size: 375px; max-inline-size: 100%;">
      <lr-tab-group without-scroll-controls>${crowdedPanels()}</lr-tab-group>
    </div>
  `,
};

/** The selected tab's text color, its underline color, and the hover color of an *unselected* tab
 *  are three independent hooks. Before them, recoloring the selection meant hijacking library-wide
 *  `--lr-color-brand`/`--lr-color-text`, which repainted hovered-unselected tabs with it too. */
export const ThemedSelection: Story = {
  name: 'Themed selection (cssprops)',
  parameters: {
    docs: {
      description: {
        story:
          'Set `--lr-tab-group-selected-color`, `--lr-tab-group-indicator-color` and `--lr-tab-group-hover-color` on the element or any ancestor — none are declared on `:host`, so an ancestor value is never shadowed. Hover the unselected tabs to see the hover color stay independent of the selected one.',
      },
    },
  },
  render: () => html`
    <div
      style="--lr-tab-group-selected-color: ${storyColor('success')}; --lr-tab-group-indicator-color: ${storyColor(
        'success',
      )}; --lr-tab-group-hover-color: ${storyColor('brand')};"
    >
      <lr-tab-group>
        <div slot="input" label="Input" style="padding: 0.75rem 0;">Raw input goes here.</div>
        <div slot="preview" label="Preview" style="padding: 0.75rem 0;">Rendered preview goes here.</div>
        <div slot="settings" label="Settings" style="padding: 0.75rem 0;">Settings form goes here.</div>
      </lr-tab-group>
    </div>
  `,
};

/** The tab and overflow-control interaction states use separate inherited hooks, so pressing a
 *  tab or a scroll control does not require changing the selected or hover colors. */
export const ThemedInteractionStates: Story = {
  name: 'Themed interaction states (cssprops)',
  parameters: {
    docs: {
      description: {
        story:
          'Press an unselected tab or either visible overflow control. The tab and scroll-control hover/pressed hooks inherit from this wrapper while the selected tab keeps its normal treatment.',
      },
    },
  },
  render: () => html`
    <div
      style="inline-size: 220px; max-inline-size: 100%; --lr-tab-group-active-bg: ${storyColor(
        'warningQuiet',
      )}; --lr-tab-group-active-color: ${storyColor(
        'warning',
      )}; --lr-tab-group-scroll-button-hover-color: ${storyColor(
        'success',
      )}; --lr-tab-group-scroll-button-active-bg: ${storyColor(
        'successQuiet',
      )}; --lr-tab-group-scroll-button-active-color: ${storyColor('success')};"
    >
      <lr-tab-group>${crowdedPanels()}</lr-tab-group>
    </div>
  `,
};

export const ElementModel: StoryObj = {
  name: 'Upstream child model (lr-tab / lr-tab-panel)',
  parameters: {
    docs: {
      description: {
        story:
          'The `<lr-tab>` + `<lr-tab-panel>` shape mirrors `wa-tab-group`/`sl-tab-group`, so that markup renames mechanically. The group assigns the `slot` attributes itself, exposes its real unnamed slot as `defaultSlot`, and projects each tab\'s content into the real `role="tab"` button. Direct default-slot element roots are inert while projected, while only accessibility-exposed flattened text gives the real button its accessible name; use text or glyph markup rather than a second action.',
      },
    },
  },
  render: () => html`
    <lr-tab-group>
      <lr-tab panel="general" active>General</lr-tab>
      <lr-tab panel="advanced">Advanced</lr-tab>
      <lr-tab panel="danger" disabled>Danger zone</lr-tab>
      <lr-tab-panel name="general" active style="padding: 0.75rem 0;">General settings go here.</lr-tab-panel>
      <lr-tab-panel name="advanced" style="padding: 0.75rem 0;">Advanced settings go here.</lr-tab-panel>
      <lr-tab-panel name="danger" style="padding: 0.75rem 0;">Danger zone.</lr-tab-panel>
    </lr-tab-group>
  `,
};

export const RichElementLabel: StoryObj = {
  name: 'Rich element label (inert projection)',
  parameters: {
    docs: {
      description: {
        story:
          'A rich tab label can combine decorative glyphs and a badge without creating another action. Its direct default-slot element roots are inert while projected; the real tab button is named from the accessibility-exposed text, so the aria-hidden mail glyph does not enter its name.',
      },
    },
  },
  render: () => html`
    <lr-tab-group aria-label="Mailbox panels">
      <lr-tab panel="inbox" active>
        <span aria-hidden="true">✉</span>
        <span>Inbox</span>
        <span>3 unread</span>
      </lr-tab>
      <lr-tab panel="archive">Archive</lr-tab>
      <lr-tab-panel name="inbox" active>Unread messages.</lr-tab-panel>
      <lr-tab-panel name="archive">Archived messages.</lr-tab-panel>
    </lr-tab-group>
  `,
};

export const ClosableElementTabs: StoryObj = {
  name: 'Closable lr-tab request',
  parameters: {
    docs: {
      description: {
        story:
          '`closable` adds the mapped close affordance without adding a second focus stop inside the real tab button. Click the glyph or focus the tab and press Delete (`aria-keyshortcuts="Delete"`); both emit the Lyra-convention `lr-close` notification. This example handles the request by removing the matching tab and panel.',
      },
    },
  },
  render: () => html`
    <lr-tab-group
      aria-label="Open documents"
      @lr-close=${(event: CustomEvent<undefined>) => {
        const tab = event.target;
        const group = event.currentTarget;
        if (!(tab instanceof HTMLElement) || !(group instanceof HTMLElement)) return;
        const panelName = tab.getAttribute('panel');
        tab.remove();
        for (const child of Array.from(group.children)) {
          if (child.localName === 'lr-tab-panel' && child.getAttribute('name') === panelName) {
            child.remove();
            break;
          }
        }
      }}
    >
      <lr-tab panel="overview">Overview</lr-tab>
      <lr-tab panel="notes" active closable>Notes</lr-tab>
      <lr-tab-panel name="overview">Overview content.</lr-tab-panel>
      <lr-tab-panel name="notes" active>Notes content.</lr-tab-panel>
    </lr-tab-group>
  `,
};

export const ProgrammaticShow: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          '`show(name)` activates a matching enabled panel through the same hide/show event pair as pointer or keyboard input. Child `active` attributes stay synchronized for serialization and SSR handoff.',
      },
    },
  },
  render: () => html`
    <div>
      <lr-tab-group id="programmatic-tabs">
        <lr-tab panel="overview" active>Overview</lr-tab>
        <lr-tab panel="activity">Activity</lr-tab>
        <lr-tab-panel name="overview" active>Overview content.</lr-tab-panel>
        <lr-tab-panel name="activity">Activity content.</lr-tab-panel>
      </lr-tab-group>
      <button
        type="button"
        @click=${() => {
          const group = document.getElementById('programmatic-tabs') as HTMLElement & {
            show(name: string): void;
          };
          group.show('activity');
        }}
      >Show activity</button>
    </div>
  `,
};

export const Placement: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          '`start` and `end` are logical, so they mirror under RTL. Either one turns the tablist vertical, which switches the navigation keys to Up/Down per the WAI-ARIA APG.',
      },
    },
  },
  render: () => html`
    ${(['top', 'bottom', 'start', 'end'] as const).map(
      (placement) => html`
        <p style="margin-block: 1rem 0.25rem; font-weight: 600;">placement="${placement}"</p>
        <lr-tab-group placement=${placement}>
          <lr-tab panel="one-${placement}">First</lr-tab>
          <lr-tab panel="two-${placement}">Second</lr-tab>
          <lr-tab-panel name="one-${placement}" style="padding: 0.75rem;">First panel.</lr-tab-panel>
          <lr-tab-panel name="two-${placement}" style="padding: 0.75rem;">Second panel.</lr-tab-panel>
        </lr-tab-group>
      `,
    )}
  `,
};

export const VerticalLongLabelsNarrow: StoryObj = {
  name: 'Vertical long labels at 320px (LTR / RTL)',
  parameters: {
    docs: {
      description: {
        story:
          'The `--lr-tab-group-vertical-nav-max-inline-size` hook bounds a logical start/end strip without fixing its width. At an exact 320px allocation, long labels ellipsize while the adjacent panel remains usable in both directions.',
      },
    },
  },
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-l);">
      <div style="inline-size: 320px; max-inline-size: 100%;">
        <p style="margin-block: 0 var(--lr-space-xs);">LTR / start</p>
        <lr-tab-group placement="start" style="--lr-tab-group-vertical-nav-max-inline-size: var(--lr-size-10rem);">
          <div slot="overview" label="Overview with an intentionally long navigation label">Overview panel.</div>
          <div slot="history" label="Complete audit history for this workspace">History panel.</div>
        </lr-tab-group>
      </div>
      <div dir="rtl" style="inline-size: 320px; max-inline-size: 100%;">
        <p style="margin-block: 0 var(--lr-space-xs);">RTL / end</p>
        <lr-tab-group placement="end" style="--lr-tab-group-vertical-nav-max-inline-size: var(--lr-size-10rem);">
          <div slot="overview" label="نظرة عامة بعنوان تنقل طويل للغاية">لوحة النظرة العامة.</div>
          <div slot="history" label="سجل المراجعة الكامل لمساحة العمل">لوحة السجل.</div>
        </lr-tab-group>
      </div>
    </div>
  `,
};

export const ElementModelLongContentNarrow: StoryObj = {
  name: 'Element-model long content at 320px (LTR / RTL)',
  parameters: {
    docs: {
      description: {
        story:
          'The upstream lr-tab and lr-tab-panel child model keeps both an unbroken tab label and active panel content within an exact 320px allocation in LTR and RTL.',
      },
    },
  },
  render: () => {
    const longTab =
      'AnExtremelyLongUnbrokenElementModelTabLabelThatMustRemainContained'.repeat(4);
    const longPanel =
      'AnExtremelyLongUnbrokenElementModelTabPanelValueThatMustRemainContained'.repeat(4);
    return html`
      <div style="display: grid; gap: var(--lr-space-l);">
        ${([
          { direction: 'ltr', placement: 'start' },
          { direction: 'rtl', placement: 'end' },
        ] as const).map(
          ({ direction, placement }) => html`
            <div dir=${direction} style="inline-size: 320px; max-inline-size: 100%;">
              <lr-tab-group placement=${placement} style="inline-size: 100%;">
                <lr-tab panel="details" active>${longTab}</lr-tab>
                <lr-tab panel="history">History</lr-tab>
                <lr-tab-panel name="details" active>${longPanel}</lr-tab-panel>
                <lr-tab-panel name="history">History panel.</lr-tab-panel>
              </lr-tab-group>
            </div>
          `,
        )}
      </div>
    `;
  },
};

export const ManualActivation: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          'With `activation="manual"` the arrow keys move focus only and Enter or Space commits. The APG requires this whenever revealing a panel is expensive — automatic activation would load every panel the user arrows past.',
      },
    },
  },
  render: () => html`
    <lr-tab-group activation="manual">
      <lr-tab panel="cheap">Cheap</lr-tab>
      <lr-tab panel="expensive">Expensive</lr-tab>
      <lr-tab panel="also-expensive">Also expensive</lr-tab>
      <lr-tab-panel name="cheap" style="padding: 0.75rem 0;">Already loaded.</lr-tab-panel>
      <lr-tab-panel name="expensive" style="padding: 0.75rem 0;">Fetched on demand.</lr-tab-panel>
      <lr-tab-panel name="also-expensive" style="padding: 0.75rem 0;">Also fetched on demand.</lr-tab-panel>
    </lr-tab-group>
  `,
};
