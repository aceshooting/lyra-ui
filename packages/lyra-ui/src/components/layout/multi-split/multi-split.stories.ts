import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Multi Split',
  component: 'lr-multi-split',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

function capMultiSplitResize(event: Event): void {
  const request = event as CustomEvent<{ sizes: number[] }>;
  if (request.detail.sizes[0]! > 65) request.preventDefault();
}

export const Default: Story = {
  render: () => html`
    <lr-multi-split
      style="height: 8rem; border: 1px solid var(--lr-color-border)"
    >
      <div panel-id="navigation" style="padding: 0.5rem">Panel A</div>
      <div panel-id="content" style="padding: 0.5rem">Panel B</div>
      <div panel-id="inspector" style="padding: 0.5rem">Panel C</div>
    </lr-multi-split>
  `,
};

export const Vertical: Story = {
  render: () => html`
    <lr-multi-split
      orientation="vertical"
      style="height: 16rem; border: 1px solid var(--lr-color-border)"
    >
      <div style="padding: 0.5rem">Panel A</div>
      <div style="padding: 0.5rem">Panel B</div>
      <div style="padding: 0.5rem">Panel C</div>
    </lr-multi-split>
  `,
};

export const FixedHeightLongPanels: Story = {
  name: 'Fixed-height long-panel scrolling with unbroken content (320px)',
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-m)">
      <lr-multi-split
        style="inline-size: 320px; max-inline-size: 100%; block-size: 200px; border: 1px solid var(--lr-color-border)"
      >
        <div style="padding: 0.5rem">
          <strong>First pane</strong>
          <p>
            Long direct-panel content stays inside this fixed-height split.
            Scroll this pane independently to read the rest of this repeated
            explanatory content. Long direct-panel content stays inside this
            fixed-height split. Scroll this pane independently to read the rest
            of this repeated explanatory content.
          </p>
          <code
            >unbrokenpanelcontentmustwrapinsideanarrowallocatedsplitwithoutcreatingahorizontalscrollbar</code
          >
        </div>
        <div style="padding: 0.5rem">
          <strong>Second pane</strong>
          <p>
            Each direct panel owns its native overflow, so one long pane does
            not spill into content below the split. Scroll this pane
            independently to reach the rest of the repeated explanatory content.
            Each direct panel owns its native overflow, so one long pane does
            not spill into content below the split.
          </p>
          <code
            >unbrokenpanelcontentmustwrapinsideanarrowallocatedsplitwithoutcreatingahorizontalscrollbar</code
          >
        </div>
      </lr-multi-split>

      <lr-multi-split
        dir="rtl"
        style="inline-size: 320px; max-inline-size: 100%; block-size: 200px; border: 1px solid var(--lr-color-border)"
      >
        <div style="padding: 0.5rem">
          <strong>لوحة أولى</strong>
          <p>
            يبقى المحتوى الطويل داخل اللوحة ذات الارتفاع الثابت ويمكن تمرير كل
            لوحة بشكل مستقل. يبقى المحتوى الطويل داخل اللوحة ذات الارتفاع الثابت
            ويمكن تمرير كل لوحة بشكل مستقل.
          </p>
          <code
            >unbrokenpanelcontentmustwrapinsideanarrowallocatedsplitwithoutcreatingahorizontalscrollbar</code
          >
        </div>
        <div style="padding: 0.5rem">
          <strong>لوحة ثانية</strong>
          <p>
            لا ينسكب المحتوى إلى ما يلي التقسيم عند استخدام مساحة ثابتة. لا
            ينسكب المحتوى إلى ما يلي التقسيم عند استخدام مساحة ثابتة.
          </p>
          <code
            >unbrokenpanelcontentmustwrapinsideanarrowallocatedsplitwithoutcreatingahorizontalscrollbar</code
          >
        </div>
      </lr-multi-split>
    </div>
  `,
};

export const FixedPixelRangePanel: Story = {
  render: () => html`
    <lr-multi-split
      style="height: 8rem; border: 1px solid var(--lr-color-border)"
      .panelConstraints=${[{ minPx: 160, maxPx: 320 }, null]}
    >
      <div style="padding: 0.5rem">
        Sidebar — pinned between 160px and 320px regardless of the split's own
        percent-based sizing or a container resize
      </div>
      <div style="padding: 0.5rem">
        Main content — fills the rest, percent-based as usual
      </div>
    </lr-multi-split>
  `,
};

export const AchievableDividerAriaBounds: Story = {
  name: 'Adjacent achievable divider bounds',
  parameters: {
    docs: {
      description: {
        story:
          'Each divider separator reports the leading panel percentage as aria-valuenow. Its aria-valuemin/max are the range currently achievable within that adjacent pair, after applying both panels’ constraints—not global whole-track bounds.',
      },
    },
  },
  render: () => html`
    <lr-multi-split
      style="height: 8rem; border: 1px solid var(--lr-color-border)"
      .sizes=${[50, 30, 20]}
      .panelConstraints=${[
        { minPercent: 20, maxPercent: 60 },
        { minPercent: 15, maxPercent: 35 },
        { minPercent: 10, maxPercent: 40 },
      ]}
    >
      <div style="padding: 0.5rem">Panel A</div>
      <div style="padding: 0.5rem">Panel B</div>
      <div style="padding: 0.5rem">Panel C</div>
    </lr-multi-split>
  `,
};

export const ResponsiveCollapse: Story = {
  render: () => html`
    <div
      style="resize: horizontal; overflow: hidden; inline-size: 100%; min-inline-size: 12rem; max-inline-size: 100%; border: 1px dashed var(--lr-color-border); padding: 0.5rem;"
    >
      <p
        style="margin: 0 0 0.5rem; font: 12px sans-serif; color: var(--lr-color-text-quiet)"
      >
        Drag this box's bottom-right corner to shrink it. lr-multi-split only
        handles the width-collapse mechanics (and signals the current state via
        the <code>data-collapse-state</code> attribute + the
        <code>lr-multi-split-collapse-change</code> event) — below 640px the
        sidebar clamps to a fixed <code>rail-width</code>; below 400px it
        instead becomes a floating overlay card. The sidebar's own content is
        expected to adapt itself to the clamped width (e.g. via its own
        container query); this demo just swaps in a shorter label to keep it
        legible at rail width.
      </p>
      <lr-multi-split
        collapse="start"
        rail-width="3.5rem"
        style="height: 12rem; border: 1px solid var(--lr-color-border)"
        @lr-multi-split-collapse-change=${(e: CustomEvent<{ state: string }>) =>
          console.log('lr-multi-split-collapse-change', e.detail.state)}
      >
        <div
          style="padding: 0.5rem; background: var(--lr-color-brand-quiet); overflow: hidden"
        >
          Sidebar (collapse="start")
        </div>
        <div style="padding: 0.5rem">
          Main content — grows to fill whatever space the sidebar frees up
        </div>
      </lr-multi-split>
    </div>
  `,
};

export const CollapseBreakpointLengths: Story = {
  render: () => html`
    <div
      style="resize: horizontal; overflow: hidden; inline-size: 100%; min-inline-size: 12rem; max-inline-size: 100%; border: 1px dashed var(--lr-color-border); padding: 0.5rem;"
    >
      <p
        style="margin: 0 0 0.5rem; font: 12px sans-serif; color: var(--lr-color-text-quiet)"
      >
        The same 640px/400px thresholds authored as CSS lengths (<code
          >rail-breakpoint="40rem" float-breakpoint="25rem"</code
        >) — identical crossing widths at the default 16px root font size, but
        they now track it. Try it: run
        <code>document.documentElement.style.fontSize = '20px'</code> in the
        console and this split rails at 800px instead. <code>px</code>/<code
          >em</code
        >
        and the original bare number are accepted too; an unparseable or
        viewport-relative value (<code>80vw</code>) falls back to the documented
        <code>640</code>/<code>400</code> defaults rather than switching
        collapse off.
      </p>
      <lr-multi-split
        collapse="start"
        rail-breakpoint="40rem"
        float-breakpoint="25rem"
        rail-width="3.5rem"
        style="height: 12rem; border: 1px solid var(--lr-color-border)"
        @lr-multi-split-collapse-change=${(e: CustomEvent<{ state: string }>) =>
          console.log('lr-multi-split-collapse-change (rem)', e.detail.state)}
      >
        <div
          style="padding: 0.5rem; background: var(--lr-color-brand-quiet); overflow: hidden"
        >
          Sidebar
        </div>
        <div style="padding: 0.5rem">Main content</div>
      </lr-multi-split>
    </div>
  `,
};

export const CollapseBreakpointBasisViewport: Story = {
  render: () => html`
    <p
      style="margin: 0 0 0.5rem; font: 12px sans-serif; color: var(--lr-color-text-quiet)"
    >
      <code>collapse-breakpoint-basis="viewport"</code> keys the collapse
      thresholds off the viewport via <code>matchMedia</code> instead of the
      split's own allocation — use it to collapse in step with a page-level
      <code>@media</code> layout. Resize the browser window (not a wrapper) past
      640px and 400px. Note <code>(max-width:)</code> is inclusive, so viewport
      basis crosses 1px later than container basis, which compares strictly
      <code>&lt;</code>. The first paint is already in the right state — no
      <code>ResizeObserver</code> round-trip — and that initial state is not
      announced as a <code>lr-multi-split-collapse-change</code>.
    </p>
    <lr-multi-split
      collapse="start"
      collapse-breakpoint-basis="viewport"
      rail-width="3.5rem"
      style="height: 12rem; border: 1px solid var(--lr-color-border)"
      @lr-multi-split-collapse-change=${(e: CustomEvent<{ state: string }>) =>
        console.log(
          'lr-multi-split-collapse-change (viewport)',
          e.detail.state
        )}
    >
      <div
        style="padding: 0.5rem; background: var(--lr-color-brand-quiet); overflow: hidden"
      >
        Sidebar
      </div>
      <div style="padding: 0.5rem">Main content</div>
    </lr-multi-split>
  `,
};

export const ResponsiveOrientation: Story = {
  render: () => html`
    <div
      style="resize: horizontal; overflow: hidden; inline-size: 100%; min-inline-size: 8rem; max-inline-size: 100%; border: 1px dashed var(--lr-color-border); padding: 0.5rem;"
    >
      <p
        style="margin: 0 0 0.5rem; font: 12px sans-serif; color: var(--lr-color-text-quiet)"
      >
        Drag this box's bottom-right corner to shrink it below 500px — the split
        stacks its panels (<code
          >orientation-breakpoint="500" narrow-orientation="vertical"</code
        >) even though the surrounding page is wide. The observation boundary is
        the split's own measured allocation, not the viewport. Add
        <code>orientation-breakpoint-basis="viewport"</code> to key off the
        viewport via <code>matchMedia</code> instead of the split's own width —
        the only way two siblings in one row can flip together at a shared
        breakpoint.
      </p>
      <lr-multi-split
        orientation-breakpoint="500"
        narrow-orientation="vertical"
        style="height: 12rem; border: 1px solid var(--lr-color-border)"
        @lr-multi-split-orientation-change=${(
          e: CustomEvent<{ orientation: string }>
        ) =>
          console.log(
            'lr-multi-split-orientation-change',
            e.detail.orientation
          )}
      >
        <div style="padding: 0.5rem">Panel A</div>
        <div style="padding: 0.5rem">Panel B</div>
      </lr-multi-split>
    </div>

    <div
      style="resize: horizontal; overflow: hidden; inline-size: 100%; min-inline-size: 8rem; max-inline-size: 100%; border: 1px dashed var(--lr-color-border); padding: 0.5rem; margin-block-start: 1rem;"
    >
      <p
        style="margin: 0 0 0.5rem; font: 12px sans-serif; color: var(--lr-color-text-quiet)"
      >
        The same breakpoint authored as a CSS length
        (<code>orientation-breakpoint="31.25rem"</code>) — identical crossing
        width at the default 16px root font size, but it now tracks the root
        font size the way a sibling
        <code>@media (max-width: 31.25rem)</code> rule does. Try it: run
        <code>document.documentElement.style.fontSize = '32px'</code> in the
        console and this split stacks at twice the width, while the
        <code>500</code> one above doesn't move. <code>px</code>/<code>em</code>
        are accepted too; an unparseable or viewport-relative value
        (<code>80vw</code>) behaves as unset.
      </p>
      <lr-multi-split
        orientation-breakpoint="31.25rem"
        narrow-orientation="vertical"
        style="height: 12rem; border: 1px solid var(--lr-color-border)"
        @lr-multi-split-orientation-change=${(
          e: CustomEvent<{ orientation: string }>
        ) =>
          console.log(
            'lr-multi-split-orientation-change (rem)',
            e.detail.orientation
          )}
      >
        <div style="padding: 0.5rem">Panel A</div>
        <div style="padding: 0.5rem">Panel B</div>
      </lr-multi-split>
    </div>
  `,
};

export const PercentPanelConstraints: Story = {
  render: () => html`
    <lr-multi-split
      style="height: 8rem; border: 1px solid var(--lr-color-border)"
      .panelConstraints=${[
        { minPx: 200, minPercent: 20, maxPercent: 50 },
        null,
      ]}
    >
      <div style="padding: 0.5rem">
        Sidebar — at least 200px AND at least 20% (whichever is stricter), at
        most 50%
      </div>
      <div style="padding: 0.5rem">Main content — fills the rest</div>
    </lr-multi-split>
  `,
};

export const CancelableResize: Story = {
  name: 'Cancelable resize',
  parameters: {
    docs: {
      description: {
        story:
          'The `lr-resize-request` event proposes each pointer or keyboard size change before the split commits it. This example vetoes a first-panel size above 65%, so the existing `lr-resize` event only follows accepted proposals.',
      },
    },
  },
  render: () => html`
    <lr-multi-split
      style="height: 10rem; border: 1px solid var(--lr-color-border)"
      @lr-resize-request=${capMultiSplitResize}
    >
      <div style="padding: 0.5rem; background: var(--lr-color-surface-raised)">
        This pane can grow to 65%.
      </div>
      <div style="padding: 0.5rem">
        Further drag or ArrowRight proposals are vetoed.
      </div>
    </lr-multi-split>
  `,
};

export const DisabledCollapseIntent: Story = {
  name: 'Forced collapse remains inert while disabled',
  parameters: {
    docs: {
      description: {
        story:
          '`collapse-state="floating"` can retain consumer intent, but with the default `collapse="none"` the effective state reflects as `wide`: both panels remain in-flow and no backdrop, focus trap, event, or scroll lock is created.',
      },
    },
  },
  render: () => html`
    <lr-multi-split
      collapse-state="floating"
      open
      style="height: 10rem; border: 1px solid var(--lr-color-border)"
    >
      <div style="padding: 0.5rem; background: var(--lr-color-surface-raised)">
        Collapse intent is disabled
      </div>
      <div style="padding: 0.5rem">Main content remains alongside it.</div>
    </lr-multi-split>
  `,
};
