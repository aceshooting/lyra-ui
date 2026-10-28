import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { ref } from 'lit/directives/ref.js';
import { createSimulationClock, type ClockSnapshot } from '../../../simulation-clock.js';
import { createTimeIndex } from '../../../time-index.js';
import { bindSequencePlayback } from '../../../sequence-time-binding.js';
import type { LyraMap } from '../map/map.class.js';
import type { LyraChart } from '../../charts/chart/chart.class.js';
import '../map/map.js';
import '../../charts/chart/chart.js';
import type { LyraSequencePlayback } from './sequence-playback.js';
import { storyColor } from '../../../../../../.storybook/theme-contract.js';

const meta: Meta = {
  title: 'Sequence Playback',
  component: 'lr-sequence-playback',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The play button retains its disabled resting paint when too few items are available; enabled pointer feedback remains visible. Discrete sequence playback controls with `itemCount`/`currentIndex` and native `FocusEvent` relays from the active internal control.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-sequence-playback item-count="10" interval-ms="500"></lr-sequence-playback>`,
};

/** `focus()` targets the primary play/pause control; native and prefixed focus listeners each
 * receive exactly one notification. */
export const ProgrammaticFocus: Story = {
  render: () => html`
    <div style="display: grid; gap: 0.75rem; justify-items: start;">
      <lr-sequence-playback item-count="10" interval-ms="500"></lr-sequence-playback>
      <button
        type="button"
        @click=${(event: Event) => {
          const playback = (event.currentTarget as HTMLElement).parentElement!.querySelector(
            'lr-sequence-playback',
          ) as LyraSequencePlayback;
          playback.focus();
        }}
      >Focus play/pause</button>
    </div>
  `,
};

export const CustomIcons: Story = {
  name: 'Custom play/pause icons via slots',
  parameters: {
    docs: {
      description: {
        story:
          'The icon slots are decorative overrides rendered inert inside the play/pause button, so use a glyph or SVG rather than a second interactive control. An empty slot keeps the built-in glyph.',
      },
    },
  },
  render: () => html`
    <lr-sequence-playback item-count="10" interval-ms="500">
      <span slot="play-icon">▶</span>
      <span slot="pause-icon">⏸</span>
    </lr-sequence-playback>
  `,
};

export const NoLoop: Story = {
  render: () =>
    html`<lr-sequence-playback item-count="10" interval-ms="500" without-loop></lr-sequence-playback>`,
};

export const SingleFrame: Story = {
  render: () => html`<lr-sequence-playback item-count="1"></lr-sequence-playback>`,
};

export const ThemedActivePlayButton: Story = {
  name: 'Themed active play button (cssprops)',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-sequence-playback-play-button-active-bg` and `--lr-sequence-playback-play-button-active-border-color` retint only the pressed play/pause button. They are read as inline fallbacks rather than declared on `:host`, so a theme set on an ancestor flows into the component.',
      },
    },
  },
  render: () => html`
    <div
      style="
        --lr-sequence-playback-play-button-active-bg: ${storyColor('successQuiet')};
        --lr-sequence-playback-play-button-active-border-color: ${storyColor('success')};
      "
    >
      <lr-sequence-playback item-count="10" interval-ms="500"></lr-sequence-playback>
    </div>
  `,
};


/** One clock drives independent map, chart and detail consumers; each owns its rendering. */
export const SharedEpochTime: Story = {
  name: 'Shared time with irregular samples',
  parameters: { docs: { description: { story: 'A synthetic track uses irregular sample times. The map interpolates this small local path, the chart highlights the held sample, and details format the same instant in a selected time zone. Live follows wall time; replay has no physical simulation or synchronized-paint claim. Text details remain usable without WebGL.' } } },
  render: () => {
    let cleanup: (() => void) | undefined;
    let generation = 0;
    const attach = (element?: Element): void => {
      cleanup?.(); cleanup = undefined;
      const current = ++generation;
      if (!element) return;
      queueMicrotask(() => {
        if (current !== generation || !element.isConnected) return;
        const playback = element.querySelector<LyraSequencePlayback>('lr-sequence-playback')!;
        const map = element.querySelector<LyraMap>('lr-map')!;
        const chart = element.querySelector<LyraChart>('lr-chart')!;
        const output = element.querySelector<HTMLParagraphElement>('[data-time-detail]')!;
        const zone = element.querySelector<HTMLSelectElement>('[data-zone]')!;
        const locale = element.querySelector<HTMLSelectElement>('[data-locale]')!;
        const rate = element.querySelector<HTMLSelectElement>('[data-rate]')!;
        const live = element.querySelector<HTMLButtonElement>('[data-live]')!;
        const replay = element.querySelector<HTMLButtonElement>('[data-replay]')!;
        const abort = new AbortController();
        const base = Date.now() - 60_000;
        const offsets = [0, 4000, 13000, 40000, 60000];
        const values = [20, 45, 35, 70, 60];
        const index = createTimeIndex(offsets.map(value => base + value));
        const clock = createSimulationClock({ range: [base, base + 60_000], instant: base });
        const release = bindSequencePlayback(playback, clock, index, { signal: abort.signal });
        chart.labels = offsets.map(value => `${value / 1000}s`);
        let lastIndex = -1;
        const copy = {
          en: { live: 'Live', replay: 'Replay from start', speed: 'Replay speed', zone: 'Time zone', locale: 'Format locale', sample: 'sample', map: 'Synthetic time-bound track', chart: 'Synthetic samples and selected sample' },
          fr: { live: 'En direct', replay: 'Rejouer depuis le début', speed: 'Vitesse de lecture', zone: 'Fuseau horaire', locale: 'Langue du format', sample: 'échantillon', map: 'Trajectoire synthétique liée au temps', chart: 'Échantillons synthétiques et sélection' },
          ar: { live: 'مباشر', replay: 'إعادة من البداية', speed: 'سرعة التشغيل', zone: 'المنطقة الزمنية', locale: 'لغة التنسيق', sample: 'عينة', map: 'مسار زمني تجريبي', chart: 'العينات التجريبية والعينة المحددة' },
        };
        const reducedMotion = element.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)');
        let delivered = clock.snapshot;
        const present = (): void => {
          const text = copy[locale.value as keyof typeof copy] ?? copy.en;
          for (const node of element.querySelectorAll<HTMLElement>('[data-copy]')) {
            const key = node.dataset['copy'] as keyof typeof text;
            node.textContent = text[key];
          }
          element.setAttribute('dir', locale.value === 'ar' ? 'rtl' : 'ltr');
          map.label = text.map; chart.label = text.chart;
          const snapshot = delivered;
          const instant = snapshot.instant;
          const location = index.locate(instant)!;
          const progress = (location.lowerIndex + (reducedMotion?.matches ? 0 : location.fraction)) / (index.length - 1);
          map.markers = [{ id: 'sample-track', lngLat: [-3 + 6 * progress, 48.4 + 1.6 * progress], label: new Intl.DateTimeFormat(locale.value, { timeZone: zone.value, timeStyle: 'medium' }).format(instant) }];
          if (location.lowerIndex !== lastIndex) {
            lastIndex = location.lowerIndex;
            chart.datasets = [{ label: 'Synthetic value', data: values }, { label: 'Selected sample', data: values.map((value, position) => position === lastIndex ? value : null) }];
          }
          const formatted = new Intl.DateTimeFormat(locale.value, { timeZone: zone.value, dateStyle: 'medium', timeStyle: 'medium' }).format(instant);
          output.textContent = `${formatted} · ${snapshot.mode} · ${text.sample} ${location.lowerIndex + 1}/${index.length} · ${instant.toFixed(0)} ms`;
          live.setAttribute('aria-pressed', String(snapshot.mode === 'live'));
          replay.setAttribute('aria-pressed', String(snapshot.mode === 'replay'));
        };
        clock.subscribe((snapshot: ClockSnapshot) => { delivered = snapshot; present(); }, { signal: abort.signal });
        reducedMotion?.addEventListener('change', present, { signal: abort.signal });
        zone.addEventListener('change', present, { signal: abort.signal });
        locale.addEventListener('change', present, { signal: abort.signal });
        rate.addEventListener('change', () => clock.setRate(Number(rate.value)), { signal: abort.signal });
        live.addEventListener('click', () => { const now = Date.now(); clock.setRange([base, now + 60_000]); clock.setMode('live'); }, { signal: abort.signal });
        replay.addEventListener('click', () => { clock.setRange([base, base + 60_000]); clock.seek(base); }, { signal: abort.signal });
        cleanup = () => { abort.abort(); release(); clock.dispose(); };
      });
    };
    return html`
      <section style="display: grid; gap: var(--lr-space-m); min-inline-size: 0" ${ref(attach)}>
        <p>Irregular samples: 0, 4, 13, 40 and 60 seconds. Replay follows elapsed time, not equal-duration steps. The text is the fallback when a renderer is unavailable.</p>
        <lr-sequence-playback></lr-sequence-playback>
        <div style="display: flex; flex-wrap: wrap; gap: var(--lr-space-s)">
          <button type="button" data-live data-copy="live" aria-pressed="false">Live</button>
          <button type="button" data-replay data-copy="replay" aria-pressed="true">Replay from start</button>
          <label><span data-copy="speed">Replay speed</span> <select data-rate><option value="1">1×</option><option value="2">2×</option><option value="10">10×</option></select></label>
          <label><span data-copy="zone">Time zone</span> <select data-zone><option value="UTC">UTC</option><option value="Europe/Paris">Europe/Paris</option><option value="America/New_York">America/New_York</option></select></label>
          <label><span data-copy="locale">Format locale</span> <select data-locale><option value="en">English</option><option value="fr">Français</option><option value="ar">العربية</option></select></label>
        </div>
        <p data-time-detail aria-live="off" style="overflow-wrap: anywhere"></p>
        <lr-map label="Synthetic time-bound track" style="block-size: 16rem; min-inline-size: 0" .center=${[0, 49]} .zoom=${4}
          .mapStyle=${{ version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': storyColor('surface') } }] }}></lr-map>
        <lr-chart type="line" without-animation label="Synthetic samples and the selected sample" style="block-size: 16rem; min-inline-size: 0"></lr-chart>
        <p>Position interpolation is application-owned. No orbital, terrain, or physical calculation is implied. The clock never flies the camera. Reduced motion holds the map at sample positions while details retain the exact selected instant.</p>
      </section>
    `;
  },
};
