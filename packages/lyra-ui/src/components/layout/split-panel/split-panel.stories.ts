import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './split-panel.js';

const meta: Meta = {
  title: 'Layout/Split panel',
  component: 'lr-split-panel',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'An accessible two-pane layout with percent/pixel positioning, optional primary-pane preservation, constraints, snapping, keyboard resizing, and horizontal or vertical orientation. The divider keeps its ARIA range numeric while reporting the current percentage through the effective locale. String snap points reflect to the `snap` attribute; callback snap functions are property-only.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const paneStyle = 'padding: var(--lr-space-l); block-size: 100%; box-sizing: border-box;';

function capReposition(event: Event): void {
  const request = event as CustomEvent<{ position: number }>;
  if (request.detail.position > 65) request.preventDefault();
}

export const Default: Story = {
  render: () => html`
    <lr-split-panel
      aria-label="Resize editor panes"
      lang="ar-EG"
      .strings=${{ resizeValuePercent: 'النسبة {value} بالمئة' }}
      style="block-size: 16rem; border: var(--lr-border-width-thin) solid var(--lr-color-border)"
    >
      <section slot="start" style=${`${paneStyle} background: var(--lr-color-surface-raised);`}>
        <strong>Source</strong>
        <p>Drag the divider or focus it and use Left/Right.</p>
      </section>
      <section slot="end" style=${paneStyle}>
        <strong>Preview</strong>
        <p>The default position is 50%.</p>
      </section>
    </lr-split-panel>
  `,
};

export const CancelableReposition: Story = {
  name: 'Cancelable reposition',
  parameters: {
    docs: {
      description: {
        story:
          'The `lr-reposition-request` event proposes a snapped and constrained pointer or keyboard position before the divider moves. This example vetoes positions above 65%, leaving `lr-reposition` as the existing post-commit notification.',
      },
    },
  },
  render: () => html`
    <lr-split-panel
      aria-label="Resize capped panes"
      style="block-size: 16rem; border: var(--lr-border-width-thin) solid var(--lr-color-border)"
      @lr-reposition-request=${capReposition}
    >
      <section slot="start" style=${`${paneStyle} background: var(--lr-color-surface-raised);`}>
        This pane can grow to 65%.
      </section>
      <section slot="end" style=${paneStyle}>
        Further drag or ArrowRight proposals are vetoed.
      </section>
    </lr-split-panel>
  `,
};

export const Vertical: Story = {
  render: () => html`
    <lr-split-panel
      orientation="vertical"
      position="35"
      aria-label="Resize stacked panes"
      style="block-size: 24rem; border: var(--lr-border-width-thin) solid var(--lr-color-border)"
    >
      <section slot="start" style=${`${paneStyle} background: var(--lr-color-surface-raised);`}>
        Timeline
      </section>
      <section slot="end" style=${paneStyle}>Details</section>
    </lr-split-panel>
  `,
};

export const FixedPrimaryWithConstraints: Story = {
  name: 'Fixed primary + constraints',
  render: () => html`
    <lr-split-panel
      primary="start"
      position-in-pixels="240"
      aria-label="Resize navigation"
      style="block-size: 16rem; --min: 10rem; --max: 22rem; border: var(--lr-border-width-thin) solid var(--lr-color-border)"
    >
      <nav
        slot="start"
        aria-label="Project"
        style=${`${paneStyle} background: var(--lr-color-surface-raised);`}
      >
        The start pane remains 240px wide when the story canvas resizes.
      </nav>
      <main slot="end" style=${paneStyle}>Flexible workspace</main>
    </lr-split-panel>
  `,
};

export const SnappingAndCustomDivider: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'String snapping parses one cached numeric projection per `snap` value: at most the first 16,384 UTF-16 code units and 256 finite valid pixel, percentage, or `repeat()` tokens participate.',
      },
    },
  },
  render: () => html`
    <lr-split-panel
      snap="25% 50% 75%"
      snap-threshold="16"
      aria-label="Resize snapping panes"
      style="block-size: 16rem; border: var(--lr-border-width-thin) solid var(--lr-color-border)"
    >
      <section slot="start" style=${`${paneStyle} background: var(--lr-color-surface-raised);`}>
        Snaps at 25%, 50%, and 75%
      </section>
      <span slot="divider" aria-hidden="true">⋮</span>
      <section slot="end" style=${paneStyle}>Custom divider content</section>
    </lr-split-panel>
  `,
};

export const RightToLeft: Story = {
  render: () => html`
    <lr-split-panel
      dir="rtl"
      position="35"
      aria-label="تغيير حجم الجزأين"
      style="block-size: 16rem; border: var(--lr-border-width-thin) solid var(--lr-color-border)"
    >
      <section slot="start" style=${`${paneStyle} background: var(--lr-color-surface-raised);`}>
        البداية المنطقية
      </section>
      <section slot="end" style=${paneStyle}>النهاية المنطقية</section>
    </lr-split-panel>
  `,
};

export const NarrowLongPanes: Story = {
  name: 'Narrow long panes (320px, LTR and RTL)',
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-m)">
      <lr-split-panel
        aria-label="Resize narrow panes"
        style="inline-size: 320px; max-inline-size: 100%; block-size: 200px; border: var(--lr-border-width-thin) solid var(--lr-color-border)"
      >
        <section
          slot="start"
          style=${`${paneStyle} background: var(--lr-color-surface-raised);`}
        >
          <strong>Start pane</strong>
          <p style="margin: var(--lr-space-s) 0 0">
            <code>unbrokenpanecontentmustwrapinsideanarrowallocatedsplitpanelwithoutcreatingahorizontalscrollbar</code>
          </p>
        </section>
        <section slot="end" style=${paneStyle}>
          <strong>End pane</strong>
          <p style="margin: var(--lr-space-s) 0 0">
            <code>unbrokenpanecontentmustwrapinsideanarrowallocatedsplitpanelwithoutcreatingahorizontalscrollbar</code>
          </p>
        </section>
      </lr-split-panel>

      <lr-split-panel
        dir="rtl"
        aria-label="تغيير حجم الجزأين الضيقين"
        style="inline-size: 320px; max-inline-size: 100%; block-size: 200px; border: var(--lr-border-width-thin) solid var(--lr-color-border)"
      >
        <section
          slot="start"
          style=${`${paneStyle} background: var(--lr-color-surface-raised);`}
        >
          <strong>البداية المنطقية</strong>
          <p style="margin: var(--lr-space-s) 0 0">
            <code>unbrokenpanecontentmustwrapinsideanarrowallocatedsplitpanelwithoutcreatingahorizontalscrollbar</code>
          </p>
        </section>
        <section slot="end" style=${paneStyle}>
          <strong>النهاية المنطقية</strong>
          <p style="margin: var(--lr-space-s) 0 0">
            <code>unbrokenpanecontentmustwrapinsideanarrowallocatedsplitpanelwithoutcreatingahorizontalscrollbar</code>
          </p>
        </section>
      </lr-split-panel>
    </div>
  `,
};
