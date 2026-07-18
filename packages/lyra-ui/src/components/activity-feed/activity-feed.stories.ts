import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
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
          'An append-only streaming log of granular agent actions, collapsing to a "Completed N steps" summary once the run is over.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const entries: ActivityEntry[] = [
  { id: '1', text: 'Searching the web for recent changes', icon: '🔍', tone: 'brand' },
  { id: '2', text: 'Read src/index.ts', tone: 'neutral' },
  { id: '3', text: 'Read package.json', tone: 'neutral' },
  { id: '4', text: 'Ran the test suite', tone: 'success' },
];

export const LiveExpanded: Story = {
  name: 'Live, expanded',
  render: () => html`<lr-activity-feed style="max-width: 32rem;" mode="live" expanded .entries=${entries}></lr-activity-feed>`,
};

export const PostHocCollapsed: Story = {
  name: 'Post-hoc, collapsed (finished run)',
  render: () => html`<lr-activity-feed style="max-width: 32rem;" mode="post-hoc" .entries=${entries}></lr-activity-feed>`,
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
      tone: i % 25 === 0 ? 'brand' : 'neutral',
    }));
    return html`<lr-activity-feed style="max-width: 32rem;" mode="live" expanded .entries=${many}></lr-activity-feed>`;
  },
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
    function wire(root: HTMLElement): void {
      const feed = root.querySelector<LyraActivityFeed>('lr-activity-feed')!;
      if (feed.hasAttribute('data-wired')) return;
      feed.setAttribute('data-wired', '');
      let i = 0;
      const tick = (): void => {
        if (i >= steps.length) {
          feed.mode = 'post-hoc';
          return;
        }
        feed.entries = [...feed.entries, { id: `s${i}`, text: steps[i]! }];
        i++;
        setTimeout(tick, 500);
      };
      root.querySelector('[data-start]')!.addEventListener('click', () => {
        feed.entries = [];
        feed.mode = 'live';
        feed.expanded = true;
        i = 0;
        setTimeout(tick, 500);
      });
    }
    return html`
      <div
        style="display:flex; flex-direction:column; gap:0.75rem; max-width:32rem;"
        @click=${(e: Event) => wire(e.currentTarget as HTMLElement)}
      >
        <lr-activity-feed mode="live"></lr-activity-feed>
        <button
          data-start
          style="font:inherit; font-size:0.8125rem; padding:0.3rem 0.7rem; border:1px solid var(--lr-color-border); border-radius:var(--lr-radius); background:var(--lr-color-surface); cursor:pointer; align-self:flex-start;"
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
