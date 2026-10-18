import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './av-player.js';
import '../../../surfaces/glass.css';
import type { LyraAvCueSource, LyraAvCue, LyraAvPlayer } from './av-player.class.js';
import { storyColor } from '../../../../../../.storybook/theme-contract.js';

const meta: Meta = {
  title: 'DocumentViewer/AvPlayer',
  component: 'lr-av-player',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Removing mime-type restores automatic video fallback. Open-ended transcript cues use the next strictly chronological start with indexed reconciliation per seek, and unavailable timeline controls retain resting paint under hover and press. Audio/video player built on a native media element with bounded readonly cue/track collections whose retained records are cloned and frozen. Cue collections require a trimmed nonempty `cueId` and retain the first occurrence, while the transcript stays synced to playback. Cue changes carry a frozen readonly `{ cueId, index }`; time-range marker activations carry `{ highlightId }`. Marker buttons are siblings of the slider rather than nested controls. Self-registers into the document-viewer registry for common audio/video MIME types.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const CUES: LyraAvCue[] = [
  { cueId: 'c1', start: 0, end: 0.6, text: 'Welcome to the show.', speaker: 'Host' },
  { cueId: 'c2', start: 0.6, end: 1.4, text: 'Today we discuss agentic UI.', speaker: 'Host' },
  { cueId: 'c3', start: 1.4, end: 2, text: 'Thanks for having me.', speaker: 'Guest' },
];
const PEAKS = Array.from({ length: 120 }, (_v, i) => Math.abs(Math.sin(i / 6)) * 0.9 + 0.05);
const SEARCH_CUES = Array.from({ length: 72 }, (_v, index): LyraAvCue => ({
  cueId: `search-cue-${index}`,
  start: index * 4,
  text: index === 58 ? 'Needle: search result beyond the initial transcript viewport.' : `Transcript cue ${index + 1}.`,
  speaker: index % 2 === 0 ? 'Host' : 'Guest',
}));
const AUDIO_SRC = '/fixtures/sample-video.mp4';
const VIDEO_SRC = '/fixtures/sample-video.mp4';

export const AudioWithTranscript: Story = {
  render: () => html`<lr-av-player
    src=${AUDIO_SRC}
    mime-type="audio/mp4"
    name="Episode 1"
    .cues=${CUES}
    .peaks=${PEAKS}
    .highlights=${[{ id: 'h1', anchor: { kind: 'time-range', start: 0.6, end: 1.4 }, label: 'Agentic UI segment' }]}
  ></lr-av-player>`,
};

export const Video: Story = {
  render: () => html`<lr-av-player src=${VIDEO_SRC} mime-type="video/mp4" name="Demo clip"></lr-av-player>`,
};

export const NoSrc: Story = {
  render: () => html`<lr-av-player></lr-av-player>`,
};

export const UnsafeSourceError: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'An unsafe source fails closed while retaining the authored aggregate name on the host. The localized visible error remains ordinary text; post-mount failures also emit `lr-render-error` and announce through the shared light-DOM sink.',
      },
    },
  },
  render: () => html`<lr-av-player
    src="javascript:alert(1)"
    aria-label="Unavailable episode controls"
  ></lr-av-player>`,
};

export const Narrow320: Story = {
  render: () => html`<div style="max-inline-size:320px">
    <lr-av-player src=${AUDIO_SRC} mime-type="audio/mp4" name="Episode 1" .cues=${CUES} .peaks=${PEAKS}></lr-av-player>
  </div>`,
};

export const RtlPhysicalTimeline: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The surrounding player controls inherit RTL, while the elapsed-time timeline remains a physical left-to-right axis: ArrowLeft rewinds and ArrowRight advances.',
      },
    },
  },
  render: () => html`
    <lr-av-player dir="rtl" src=${AUDIO_SRC} mime-type="audio/mp4" name="حلقة تجريبية" .cues=${CUES}></lr-av-player>
  `,
};

export const SearchResultReveal: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A find-in-page search highlights and reveals the active cue even when it begins outside the rendered transcript window. Search navigation never seeks the audio/video playhead.',
      },
    },
  },
  render: () => html`<lr-av-player
    src=${AUDIO_SRC}
    mime-type="audio/mp4"
    name="Long searchable transcript"
    .cues=${SEARCH_CUES}
  ></lr-av-player>`,
  play: async ({ canvasElement }) => {
    const player = canvasElement.querySelector('lr-av-player') as LyraAvPlayer | null;
    if (player) await player.search('needle');
  },
};

export const ThemedActiveStates: Story = {
  name: 'Themed active states (cssprops)',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-av-player-marker-active-color` (the selected timeline marker), `--lr-av-player-cue-hover-bg` (a hovered cue row, whose pressed step mixes from this same value), `--lr-av-player-cue-current-bg` (the cue the playhead is inside) and `--lr-av-player-cue-active-match-color` (the current search match) each retint one state on its own. None is declared on `:host`, so a value set on any ancestor is never shadowed — and unlike hijacking `--lr-color-brand`/`--lr-color-warning`, the other markers, cues and matches keep their own treatment.',
      },
    },
  },
  render: () => html`
    <lr-av-player
      style="--lr-av-player-marker-active-color: ${storyColor('success')}; --lr-av-player-cue-hover-bg: ${storyColor('dangerQuiet')}; --lr-av-player-cue-current-bg: ${storyColor('warningQuiet')}; --lr-av-player-cue-active-match-color: ${storyColor('brand')};"
      src=${AUDIO_SRC}
      mime-type="audio/mp4"
      name="Episode 1"
      .cues=${CUES}
      .peaks=${PEAKS}
      .highlights=${[{ id: 'h1', anchor: { kind: 'time-range', start: 0.6, end: 1.4 }, label: 'Agentic UI segment' }]}
      active-highlight-id="h1"
    ></lr-av-player>
  `,
};

export const ClearControls: Story = {
  render: () => html`<lr-av-player controls-surface="clear" src=${VIDEO_SRC} mime-type="video/mp4" name="Clear controls"></lr-av-player>`,
  parameters: { docs: { description: { story: 'Load surfaces/glass.css for the player-owned gradient scrim and clear playback-rate controls. Native video controls remain browser-owned.' } } },
};

export const PreparedWaveform: Story = {
  parameters: { docs: { description: { story: 'A bounded envelope represents the complete million-sample timeline. Bind matching media to enable seeking; its duration must agree within 1ms. Unequal bucket spans retain their actual positions, including the loud final interval even when the last sample is quiet.' } } },
  render: () => {
    const waveform: import('../../../utilities/data-preparation.js').LyraPreparedWaveform = {
      revision: 'recording', sampleCount: 1000000, duration: 10,
      counts: { sourceCount: 1000000, validCount: 1000000, invalidCount: 0 },
      buckets: [
        { startIndex: 0, endIndex: 700000, maxAmplitude: 0.2 },
        { startIndex: 700000, endIndex: 900000, maxAmplitude: 0.5 },
        { startIndex: 900000, endIndex: 1000000, maxAmplitude: 1 },
      ], firstAmplitude: 0.1, lastAmplitude: 0,
    };
    return html`<lr-av-player kind="audio" name="Whole recording envelope" .waveform=${waveform}></lr-av-player>`;
  },
};

/** A provider may keep its full transcript in a database; this small authored example makes
 * the same indexed contract inspectable without allocating a large transcript in the story. */
const INDEXED_CUES: LyraAvCueSource = {
  revision: 'episode-1',
  count: CUES.length,
  getCue: index => CUES[index] ?? null,
  findCue: cueId => {
    const index = CUES.findIndex(cue => cue.cueId === cueId);
    return index < 0 ? null : { index, cue: CUES[index]! };
  },
  activeAt: time => {
    const index = CUES.findIndex(cue => time >= cue.start && time < cue.end!);
    if (index >= 0) return { index, cue: CUES[index]!, validFrom: CUES[index]!.start, validUntil: CUES[index]!.end! };
    return { index: null, cue: null, validFrom: CUES.at(-1)!.end!, validUntil: Infinity };
  },
  search: (query, request) => {
    const folded = query.toLocaleLowerCase(request.locale);
    const matches = CUES.flatMap((cue, index) => cue.text.toLocaleLowerCase(request.locale).includes(folded) ||
      (cue.speaker ?? '').toLocaleLowerCase(request.locale).includes(folded) ? [{ index, cue }] : []);
    return { count: matches.length, getMatch: index => matches[index]! };
  },
};

export const IndexedTranscript: Story = {
  parameters: { docs: { description: { story: 'A host-owned transcript source supplies indexed rows, active intervals, and exact search counts. This example searches speaker labels and reveals the next match without seeking playback. Large providers keep their search index outside the player; the player requests one match at a time.' } } },
  play: async ({ canvasElement }) => {
    const player = canvasElement.querySelector<LyraAvPlayer>('lr-av-player');
    if (player) { await player.search('Host'); await player.searchNext(); }
  },
  render: () => html`<lr-av-player src=${AUDIO_SRC} mime-type="audio/mp4" name="Indexed transcript"
    .cueSource=${INDEXED_CUES}></lr-av-player>`,
};
