import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import './activity-feed.js';
import type { ActivityEntry, LyraActivityFeed } from './activity-feed.class.js';

const meta: Meta = {
  title: 'ActivityFeed',
  component: 'lr-activity-feed',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'An append-only streaming log of granular agent actions, collapsing to a "Completed N steps" summary once the run is over. Omit `label` to localize the visible header; any supplied string, including "Activity" or an empty string, is rendered verbatim. An empty `label` remains visibly blank, while an otherwise unnamed header and list use the localized `activityFeedLabel` semantic fallback.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const entries: ActivityEntry[] = [
  {
    id: '1',
    text: 'Searching the web for recent changes',
    icon: '🔍',
    variant: 'brand',
  },
  { id: '2', text: 'Read src/index.ts', variant: 'neutral' },
  { id: '3', text: 'Read package.json', variant: 'neutral' },
  { id: '4', text: 'Ran the test suite', variant: 'success' },
];

export const LiveExpanded: Story = {
  name: 'Live, expanded',
  render: () =>
    html`<lr-activity-feed style="max-width: 32rem;" mode="live" expanded .entries=${entries}></lr-activity-feed>`,
};

export const BlankVisibleLabel: Story = {
  name: 'Blank visible label, localized semantics',
  render: () => html`
    <lr-activity-feed
      style="max-width: 32rem;"
      expanded
      label=""
      .strings=${{ activityFeedLabel: 'Activity feed' }}
    ></lr-activity-feed>
  `,
};

export const RethemedLiveIndicator: Story = {
  name: 'Live indicator rethemed',
  render: () => html`
    <lr-activity-feed
      style="max-width: 32rem; --lr-activity-feed-live-status-color: var(--lr-color-success);"
      mode="live"
      expanded
      .entries=${entries}
    ></lr-activity-feed>
  `,
};

export const PostHocCollapsed: Story = {
  name: 'Post-hoc, collapsed (finished run)',
  render: () =>
    html`<lr-activity-feed style="max-width: 32rem;" mode="post-hoc" .entries=${entries}></lr-activity-feed>`,
};

export const WithTimestamps: Story = {
  render: () => {
    const now = Date.now();
    const withTimes: ActivityEntry[] = entries.map((entry, i) => ({
      ...entry,
      timestamp: new Date(now - (entries.length - i) * 60000),
    }));
    return html`<lr-activity-feed
      style="max-width: 32rem;"
      mode="live"
      expanded
      show-timestamps
      .entries=${withTimes}
    ></lr-activity-feed>`;
  },
};

export const VirtualizedLongRun: Story = {
  name: 'Virtualized (300 entries)',
  render: () => {
    const many: ActivityEntry[] = Array.from({ length: 300 }, (_, i) => ({
      id: `e${i}`,
      text: `Step ${i + 1} of the run`,
      variant: i % 25 === 0 ? 'brand' : 'neutral',
    }));
    return html`<lr-activity-feed style="max-width: 32rem;" mode="live" expanded .entries=${many}></lr-activity-feed>`;
  },
};

const renderRichEntryText = (entry: ActivityEntry) => html`
  <strong>${entry.text}</strong><span> · tool: search</span>
`;

export const RichEntryTextWithConsumerPartStyling: Story = {
  name: 'Rich entry text with consumer part styling',
  render: () => html`
    <div style="max-width: 32rem;">
      <style>
        lr-activity-feed::part(entry-text) {
          color: var(--lr-color-brand);
          font-style: italic;
        }
      </style>
      <lr-activity-feed
        mode="live"
        expanded
        virtualize-at="0"
        .entries=${entries.slice(0, 1)}
        .renderText=${renderRichEntryText}
      ></lr-activity-feed>
    </div>
  `,
};

export const LiveStreamingDemo: Story = {
  name: 'Live demo (entries streaming in, then completes)',
  render: () => {
    const steps = [
      'Reading the repository structure…',
      'Searching for related issues…',
      'Opening src/index.ts…',
      'Opening package.json…',
      'Running the test suite…',
      'Summarizing findings…',
    ];
    const feedRef = createRef<LyraActivityFeed>();
    let timer: ReturnType<typeof setTimeout> | undefined;

    function start(): void {
      const feed = feedRef.value;
      if (!feed) return;
      if (timer !== undefined) clearTimeout(timer);
      let i = 0;
      const tick = (): void => {
        if (i >= steps.length) {
          feed.mode = 'post-hoc';
          timer = undefined;
          return;
        }
        feed.entries = [...feed.entries, { id: `s${i}`, text: steps[i]! }];
        i++;
        timer = setTimeout(tick, 500);
      };
      feed.entries = [];
      feed.mode = 'live';
      feed.expanded = true;
      timer = setTimeout(tick, 500);
    }
    return html`
      <div style="display:flex; flex-direction:column; gap:0.75rem; max-width:32rem;">
        <lr-activity-feed mode="live" ${ref(feedRef)}></lr-activity-feed>
        <button
          data-start
          style="font:inherit; font-size:0.8125rem; padding:0.3rem 0.7rem; border:1px solid var(--lr-color-border); border-radius:var(--lr-radius); background:var(--lr-color-surface); cursor:pointer; align-self:flex-start;"
          @click=${start}
        >
          Start run
        </button>
      </div>
    `;
  },
};

export const Narrow320: Story = {
  name: 'Narrow (320px)',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-activity-feed mode="live" expanded show-timestamps .entries=${entries}></lr-activity-feed>
    </div>
  `,
};
