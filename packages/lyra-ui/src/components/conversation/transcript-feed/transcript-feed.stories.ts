import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './transcript-feed.js';
import type { LyraTranscriptEntry, LyraTranscriptFeed } from './transcript-feed.class.js';

const meta: Meta = {
  title: 'Transcript Feed',
  component: 'lr-transcript-feed',
};
export default meta;
type Story = StoryObj;

const entries: LyraTranscriptEntry[] = [
  { id: '1', speaker: 'You', text: 'What is the weather like tomorrow?', timestamp: Date.now() - 20000 },
  { id: '2', speaker: 'Agent', text: 'Let me check that for you.', timestamp: Date.now() - 15000 },
  { id: '3', speaker: 'Agent', text: 'Tomorrow will be sunny with a high of 22°C.', timestamp: Date.now() - 10000 },
];

export const Default: Story = {
  render: () => html`
    <div style="block-size: 240px;">
      <lr-transcript-feed .entries=${entries}></lr-transcript-feed>
    </div>
  `,
};

export const WithInterimCaption: Story = {
  render: () => html`
    <div style="block-size: 240px;">
      <lr-transcript-feed
        .entries=${[...entries, { id: '4', speaker: 'You', text: 'And the day after...', interim: true }]}
      ></lr-transcript-feed>
    </div>
  `,
};

/** Simulates a live speech-to-text session: an interim caption grows word by word, then finalizes
 *  into the log (same `id`, `interim` flips to unset) before the next interim caption starts. */
export const LiveInterimTranscription: Story = {
  render: () => {
    const words = ['Tomorrow', 'will', 'also', 'bring', 'a', 'light', 'breeze', 'from', 'the', 'northwest.'];

    function wire(root: HTMLElement): void {
      const feed = root.querySelector<LyraTranscriptFeed>('lr-transcript-feed')!;
      if (feed.hasAttribute('data-wired')) return;
      feed.setAttribute('data-wired', '');
      const maxTurns = 3;
      let wordIndex = 0;
      let turn = 0;
      const tick = (): void => {
        wordIndex++;
        const finished = wordIndex >= words.length;
        const live: LyraTranscriptEntry = {
          id: `live-${turn}`,
          speaker: 'Agent',
          text: words.slice(0, wordIndex).join(' '),
          interim: !finished,
        };
        feed.entries = [...entries, live];
        if (finished) {
          wordIndex = 0;
          turn++;
        }
        // Bounded rather than infinite, so a story left open in the background doesn't keep a
        // setTimeout chain alive indefinitely.
        if (turn < maxTurns) setTimeout(tick, 400);
      };
      root.querySelector('[data-start]')!.addEventListener('click', () => {
        feed.entries = [...entries];
        wordIndex = 0;
        turn = 0;
        setTimeout(tick, 400);
      });
    }

    return html`
      <div
        style="display:flex; flex-direction:column; gap:0.75rem;"
        @click=${(e: Event) => wire(e.currentTarget as HTMLElement)}
      >
        <div style="block-size: 240px;">
          <lr-transcript-feed .entries=${entries}></lr-transcript-feed>
        </div>
        <button
          data-start
          style="font:inherit; font-size:0.8125rem; padding:0.3rem 0.7rem; border:1px solid var(--lr-color-border); border-radius:var(--lr-radius); background:var(--lr-color-surface); cursor:pointer; align-self:flex-start;"
        >
          Start live captions
        </button>
      </div>
    `;
  },
};

export const WithTimestamps: Story = {
  render: () => html`
    <div style="block-size: 240px;">
      <lr-transcript-feed .entries=${entries} show-timestamps></lr-transcript-feed>
    </div>
  `,
};

export const Empty: Story = {
  render: () => html`
    <div style="block-size: 160px;">
      <lr-transcript-feed></lr-transcript-feed>
    </div>
  `,
};

export const Narrow320: Story = {
  render: () => html`
    <div style="max-inline-size: 320px; block-size: 200px; border: 1px dashed var(--lr-color-border);">
      <lr-transcript-feed .entries=${entries} show-timestamps></lr-transcript-feed>
    </div>
  `,
};
