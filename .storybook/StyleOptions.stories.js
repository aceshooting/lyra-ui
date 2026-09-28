import { html } from 'lit';
import { ref } from 'lit/directives/ref.js';
import '../packages/lyra-ui/src/theme.css';
import { applyLyraStyleScope } from '../packages/lyra-ui/src/theme/theme.js';
import { LYRA_SHAPE_PRESETS } from '../packages/lyra-ui/src/theme/options/shape.js';
import { LYRA_TYPOGRAPHY_PRESETS } from '../packages/lyra-ui/src/theme/options/typography.js';
import { LYRA_ELEVATION_PRESETS } from '../packages/lyra-ui/src/theme/options/elevation.js';
import '../packages/lyra-ui/src/components/forms/button/button.js';
import '../packages/lyra-ui/src/components/forms/textarea/textarea.js';
import '../packages/lyra-ui/src/components/layout/card/card.js';
import '../packages/lyra-ui/src/components/overlays/dialog/dialog.js';

export default {
  title: 'Theming/Optional design presets',
  tags: ['!autodocs'],
  parameters: {
    docs: { description: { component: 'Compose shape, local-font typography and shadow presets with the selected look. Fonts use installed local families with system fallbacks; these examples download no fonts.' } },
  },
};

const grid = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr));gap:1.5rem;padding:1rem';
const panel = 'padding:1rem;display:grid;gap:1rem;align-content:start;background:var(--lr-theme-color-surface-default);color:var(--lr-theme-color-text-normal);font-family:var(--lr-theme-font-family-body);line-height:var(--lr-theme-line-height-normal);min-inline-size:0';
const apply = (overrides, mode = 'light') => ref(element => {
  if (element) queueMicrotask(() => applyLyraStyleScope(element, { mode, overrides }));
});

export const ShapeAndElevation = {
  render: () => html`<div style=${grid}>
    ${['light', 'dark'].flatMap(mode => Object.entries(LYRA_SHAPE_PRESETS).map(([shape, shapeTokens]) => html`
      <section ${apply({ ...shapeTokens, ...LYRA_ELEVATION_PRESETS.raised }, mode)} style=${panel}>
        <h2 style="margin:0">${shape} · ${mode}</h2>
        <div style="display:flex;flex-wrap:wrap;gap:0.5rem">
          <lr-button variant="brand">Save changes</lr-button>
          <lr-button pill>Keep pill shape</lr-button>
          <lr-button style="--lr-button-radius:0.25rem">Local corners</lr-button>
        </div>
        <lr-card style="--lr-card-shadow:var(--lr-shadow-m)">Raised card using the shared elevation scale.</lr-card>
        <lr-card ${apply(LYRA_ELEVATION_PRESETS.flat, mode)} style="--lr-card-shadow:var(--lr-shadow-m)">Flat elevation inside the same shape scope.</lr-card>
      </section>
    `))}
  </div>`,
};

const samples = {
  system: { lang: 'en', text: 'Shared workspace · 123 · Long text wraps with the available space.' },
  arabic: { lang: 'ar', dir: 'rtl', text: 'مَسَاحَةُ عَمَلٍ مُشْتَرَكَة · English · ١٢٣' },
  hebrew: { lang: 'he', dir: 'rtl', text: 'סְבִיבַת עֲבוֹדָה מְשֻׁתֶּפֶת · English · 123' },
  devanagari: { lang: 'hi', text: 'साझा कार्यक्षेत्र · English · १२३' },
  thai: { lang: 'th', text: 'พื้นที่ทำงานร่วมกัน · English · ๑๒๓' },
  japanese: { lang: 'ja', text: '共有ワークスペース · English · １２３' },
  korean: { lang: 'ko', text: '공유 작업 공간 · English · 123' },
  'simplified-chinese': { lang: 'zh-Hans', text: '共享工作区 · English · 123' },
  'traditional-chinese': { lang: 'zh-Hant', text: '共享工作區 · English · 123' },
};

export const ScriptTypography = {
  render: () => html`<div style=${grid}>
    ${Object.entries(LYRA_TYPOGRAPHY_PRESETS).map(([name, tokens]) => html`
      <section ${apply(tokens)} lang=${samples[name].lang} dir=${samples[name].dir ?? 'ltr'} style=${panel}>
        <h2 style="margin:0;font-family:var(--lr-theme-font-family-heading)">${name}</h2>
        <p style="margin:0">${samples[name].text}</p>
        <lr-textarea label="Editable sample" .value=${samples[name].text}></lr-textarea>
      </section>
    `)}
  </div>`,
};

export const TonalElevation = {
  render: () => html`<div style=${grid}>
    ${['light', 'dark'].map(mode => html`
      <section ${apply(LYRA_ELEVATION_PRESETS.tonal, mode)} style=${panel}>
        <h2 style="margin:0">Tonal surfaces · ${mode}</h2>
        <lr-card>Low container surface, with no added shadow.</lr-card>
        <lr-button @click=${event => event.currentTarget.parentElement.querySelector('lr-dialog').show()}>Open highest surface</lr-button>
        <lr-dialog label="Tonal elevation">A distinct container step keeps the modal visible without a shadow.</lr-dialog>
      </section>
    `)}
  </div>`,
};
