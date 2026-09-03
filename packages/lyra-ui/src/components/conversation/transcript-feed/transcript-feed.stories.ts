import { html } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './transcript-feed.js';
import type { LyraTranscriptEntry, LyraTranscriptFeed } from './transcript-feed.class.js';

const meta: Meta = {
  title: 'Transcript Feed',
  component: 'lr-transcript-feed',
  parameters: {
    docs: {
      description: {
        component:
          'Transcript entries require unique nonempty, nonblank IDs; invalid and later duplicate rows are omitted first-wins within each session, and an invalid-only collection renders the empty state.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const entries: LyraTranscriptEntry[] = [
  { id: '1', speaker: 'You', text: 'What is the weather like tomorrow?', timestamp: Date.now() - 20000 },
  { id: '2', speaker: 'Agent', text: 'Let me check that for you.', timestamp: Date.now() - 15000 },
  { id: '3', speaker: 'Agent', text: 'Tomorrow will be sunny with a high of 22°C.', timestamp: Date.now() - 10000 },
];
const narrowUnbrokenTranscriptText = 'TranscriptIdentifierWithoutNaturalBreaks'.repeat(6);
const narrowRtlEntries: LyraTranscriptEntry[] = [
  {
    id: 'rtl-final',
    speaker: narrowUnbrokenTranscriptText,
    text: narrowUnbrokenTranscriptText,
    timestamp: Date.now() - 20_000,
  },
  {
    id: 'rtl-interim',
    speaker: narrowUnbrokenTranscriptText,
    text: narrowUnbrokenTranscriptText,
    timestamp: Date.now() - 10_000,
    interim: true,
  },
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
    const feedRef = createRef<LyraTranscriptFeed>();
    const maxTurns = 3;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let wordIndex = 0;
    let turn = 0;
    const tick = (): void => {
      const feed = feedRef.value;
      if (!feed) {
        timer = undefined;
        return;
      }
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
      if (turn < maxTurns) timer = setTimeout(tick, 400);
      else timer = undefined;
    };
    const startCaptions = (): void => {
      const feed = feedRef.value;
      if (!feed) return;
      if (timer !== undefined) clearTimeout(timer);
      feed.entries = [...entries];
      wordIndex = 0;
      turn = 0;
      timer = setTimeout(tick, 400);
    };

    return html`
      <div style="display:flex; flex-direction:column; gap:0.75rem;">
        <div style="block-size: 240px;">
          <lr-transcript-feed ${ref(feedRef)} .entries=${entries}></lr-transcript-feed>
        </div>
        <button
          data-start
          @click=${startCaptions}
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

/** Exact 320px RTL allocation with final/interim captions, timestamps, and the public
 * `follow="false"` jump-to-latest state under long unbroken caller content. */
export const Narrow320: Story = {
  name: 'Narrow RTL (320px, long content)',
  render: () => html`
    <div
      dir="rtl"
      style="inline-size:320px;max-inline-size:100%;block-size:200px;outline:1px dashed var(--lr-color-border);"
    >
      <lr-transcript-feed follow="false" .entries=${narrowRtlEntries} show-timestamps></lr-transcript-feed>
    </div>
  `,
};
