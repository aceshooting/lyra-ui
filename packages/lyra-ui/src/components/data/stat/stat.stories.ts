import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { narrowStoryFrames } from '../../../../../../.storybook/narrow-story.js';

const meta: Meta = {
  title: 'Stat',
  component: 'lr-stat',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Gallery: Story = {
  render: () => html`
    <div class="flex flex-wrap gap-4">
      <lr-stat label="Revenue" value="12.4" unit="k€" delta-percent="3.2" variant="success"></lr-stat>
      <lr-stat label="Active agents" value="17" variant="brand"></lr-stat>
      <lr-stat label="Errors" value="128" delta-percent="-5.1" variant="danger"></lr-stat>
      <lr-stat label="Pending Reviews" value="42" delta-percent="8.6" variant="warning"></lr-stat>
      <lr-stat label="Sessions" value="9,204"></lr-stat>
      <lr-stat label="Uptime" value="99.98" unit="%" caption="Last 30 days">
        <svg slot="start" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="9"></circle>
        </svg>
      </lr-stat>
      <lr-stat label="Latency" value="182" unit="ms" delta-percent="14" good-direction="down">
        <span slot="caption">Median over <strong>1,000</strong> requests</span>
      </lr-stat>
    </div>
  `,
};

export const StartAndLegacyIconSlots: Story = {
  name: 'Canonical and legacy icon slots',
  parameters: {
    docs: {
      description: {
        story:
          'Use the canonical start slot for a leading icon. The shipped unnamed slot remains a permanent fallback, and start takes precedence if both are filled.',
      },
    },
  },
  render: () => html`
    <div class="flex flex-wrap gap-4">
      <lr-stat label="Canonical start" value="128">
        <span slot="start" aria-hidden="true">◆</span>
      </lr-stat>
      <lr-stat label="Legacy fallback" value="42">
        <span aria-hidden="true">◇</span>
      </lr-stat>
    </div>
  `,
};

export const RetintedVariants: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Headline variant colors are independently themeable without changing the trend-pill or shared semantic colors.',
      },
    },
  },
  render: () => html`
    <div
      class="flex flex-wrap gap-4"
      style="
        --lr-stat-value-brand-color: var(--lr-color-success);
        --lr-stat-value-success-color: var(--lr-color-brand);
        --lr-stat-value-warning-color: var(--lr-color-danger);
        --lr-stat-value-danger-color: var(--lr-color-warning);
      "
    >
      <lr-stat label="Running" value="17" variant="brand"></lr-stat>
      <lr-stat label="Passed" value="128" variant="success"></lr-stat>
      <lr-stat label="Waiting" value="42" variant="warning"></lr-stat>
      <lr-stat label="Failed" value="3" variant="danger"></lr-stat>
    </div>
  `,
};

export const SparkAndBreakdown: Story = {
  render: () => html`
    <div class="flex flex-wrap gap-4">
      <lr-stat label="Revenue" value="12.4" unit="k€" delta-percent="3.2" variant="success" caption="Last 30 days">
        <lr-sparkline slot="spark" mark="line" .values=${[4, 6, 5, 8, 7, 9, 12, 10, 13, 12.4]}></lr-sparkline>
      </lr-stat>
      <lr-stat label="Sessions" value="9,204" caption="By channel">
        <lr-sparkline slot="spark" mark="bar" .values=${[3, 5, 4, 6, 8, 7, 9]}></lr-sparkline>
      </lr-stat>
    </div>
  `,
};

export const BreakdownRows: Story = {
  render: () => html`
    <div class="flex flex-wrap gap-4">
      <lr-stat label="Sessions" value="9,204" caption="By channel"></lr-stat>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('lr-stat') as HTMLElement & {
      rows: { label: string; value: string }[];
    };
    el.rows = [
      { label: 'Direct', value: '64%' },
      { label: 'Referral', value: '21%' },
      { label: 'Other', value: '15%' },
    ];
  },
};

export const BreakdownRowsWithExactValue: Story = {
  render: () => html`
    <div class="flex flex-wrap gap-4">
      <lr-stat label="Usage" value="12,480" caption="By model, this billing cycle"></lr-stat>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('lr-stat') as HTMLElement & {
      rows: { label: string; value: string; exactValue?: string }[];
    };
    el.rows = [
      { label: 'Sonnet tokens', value: '8.4K', exactValue: '8,412 tokens' },
      { label: 'Haiku tokens', value: '3.1K', exactValue: '3,068 tokens' },
      { label: 'Cache reads', value: '980' },
    ];
  },
};

export const Emphasis: Story = {
  render: () => html`
    <div class="flex flex-wrap gap-4">
      <lr-stat label="Revenue" value="12.4" unit="k€" delta-percent="3.2" emphasis></lr-stat>
      <lr-stat label="Errors" value="128" delta-percent="-5.1" variant="danger" emphasis></lr-stat>
    </div>
  `,
};

export const RetintedEmphasis: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The emphasis edge and neutral headline have separate hooks; the adjacent brand variant keeps its own independent value hook.',
      },
    },
  },
  render: () => html`
    <div
      class="flex flex-wrap gap-4"
      style="--lr-stat-emphasis-border-color: var(--lr-color-warning); --lr-stat-emphasis-value-color: var(--lr-color-success); --lr-stat-value-brand-color: var(--lr-color-danger)"
    >
      <lr-stat label="Emphasized" value="12.4" emphasis></lr-stat>
      <lr-stat label="Brand variant" value="17" variant="brand"></lr-stat>
    </div>
  `,
};

export const LinkedKpi: Story = {
  render: () => html`
    <lr-stat
      label="Memories"
      value="128"
      caption="Open the memory inventory"
      href="?path=/story/stat--linked-kpi"
    ></lr-stat>
  `,
};

export const ThemedLinkedKpi: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Linked-card hover and press paint use inherited component hooks. Hover and press this tile to see the independent border, shadow, and background values.',
      },
    },
  },
  render: () => html`
    <div
      style="--lr-stat-link-hover-border-color: var(--lr-color-warning); --lr-stat-link-hover-shadow: var(--lr-shadow-m); --lr-stat-link-active-border-color: var(--lr-color-danger); --lr-stat-link-active-bg: var(--lr-color-danger-quiet)"
    >
      <lr-stat
        label="Memories"
        value="128"
        caption="Hover or press this themed link"
        href="?path=/story/stat--themed-linked-kpi"
      ></lr-stat>
    </div>
  `,
};

export const LinkedKpiWithAction: Story = {
  render: () => html`
    <lr-stat
      aria-label="Open revenue details"
      label="Revenue"
      value="12.4"
      unit="k€"
      href="?path=/story/stat--linked-kpi-with-action"
    >
      <button slot="caption" type="button">Compare periods</button>
    </lr-stat>
  `,
};

export const Frame: Story = {
  render: () => html`
    <div class="flex flex-wrap gap-4">
      <lr-stat label="Revenue" value="12.4" unit="k€" delta-percent="3.2" caption="Last 30 days"></lr-stat>
      <lr-stat frame="plain" label="Revenue" value="12.4" unit="k€" delta-percent="3.2" caption="Last 30 days"></lr-stat>
      <lr-stat
        frame="plain"
        label="Memories"
        value="128"
        caption="Hover or tab to me — a plain link underlines its value instead of shifting a border it no longer has"
        href="?path=/story/stat--frame"
      ></lr-stat>
    </div>
  `,
};

export const Orientation: Story = {
  render: () => html`
    <div class="flex flex-col gap-4">
      <lr-stat
        orientation="horizontal"
        label="Checks"
        value="87"
        unit="/100"
        delta-percent="4.2"
        caption="42 of 48 clean"
      ></lr-stat>
      <!-- The acceptance shape: chrome-less, single baseline row, no label box. -->
      <lr-stat frame="plain" orientation="horizontal" value="87" unit="/100" caption="42 of 48 clean"></lr-stat>
      <!-- rows/spark have no place on a text baseline: they stay stacked below the row. -->
      <lr-stat
        orientation="horizontal"
        label="Sessions"
        value="9,204"
        caption="By channel"
        .rows=${[
          { label: 'Direct', value: '64%' },
          { label: 'Referral', value: '21%' },
          { label: 'Other', value: '15%' },
        ]}
      >
        <lr-sparkline slot="spark" mark="bar" .values=${[3, 5, 4, 6, 8, 7, 9]}></lr-sparkline>
      </lr-stat>
    </div>
  `,
};

export const ExactValueSubProseCompact: Story = {
  render: () => html`
    <div class="flex flex-wrap gap-4">
      <lr-stat
        label="Revenue"
        value="$1.2K"
        exact-value="$1,204.37"
        sub="vs. last week"
        caption="Updated 2h ago"
        delta-percent="3.2"
        variant="success"
      ></lr-stat>
      <lr-stat label="Status" prose value="Waiting for the next sync…"></lr-stat>
      <lr-stat label="Sessions" value="9,204" sub="+312 today" compact></lr-stat>
    </div>
  `,
};

export const NarrowLongContent: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Paired LTR/RTL allocations at the default 20rem (320px) contract with long localized and unbroken content.',
      },
    },
  },
  render: () =>
    narrowStoryFrames((direction) => {
      const rtl = direction === 'rtl';
      return html`
        <lr-stat
          orientation="horizontal"
          label=${rtl
            ? 'إجمالي عمليات التحقق المكتملة لهذا الإصدار'
            : 'Gesamte abgeschlossene Prüfungen dieser Version'}
          value="987654321"
          unit=${rtl ? 'عملية' : 'Prüfungen'}
          caption=${rtl
            ? 'مرجعغيرقابلللالتفافللتأكدمنبقاءالمحتوىداخلالمساحة'
            : 'NichtUmbrechbareReferenzZurPrüfungDerSchmalenZuordnung'}
          .rows=${[
            {
              label: rtl
                ? 'التحقق من إمكانية الوصول باستخدام تسمية طويلة'
                : 'Barrierefreiheitsprüfung mit langem Namen',
              value: '124567',
            },
            {
              label: rtl ? 'اختبارات التكامل متعددة المحركات' : 'Engineübergreifende Integrationstests',
              value: '863087',
            },
          ]}
        ></lr-stat>
      `;
    }),
};
