import { html, svg } from 'lit';
import { resolveLyraChartPalette, sampleLyraChartScale } from '../../packages/lyra-ui/src/theme/chart-palette.js';
import { getLyraChartSeriesCue } from '../../packages/lyra-ui/src/theme/options/charts.js';
import '../../packages/lyra-ui/src/components/lr-button.js';
import '../../packages/lyra-ui/src/components/lr-input.js';
import '../../packages/lyra-ui/src/components/lr-select.js';
import '../../packages/lyra-ui/src/components/lr-option.js';
import '../../packages/lyra-ui/src/components/lr-switch.js';
import '../../packages/lyra-ui/src/components/lr-card.js';
import '../../packages/lyra-ui/src/components/lr-menu.js';
import '../../packages/lyra-ui/src/components/lr-menu-item.js';
import '../../packages/lyra-ui/src/components/lr-dialog.js';

const sampleText = {
  arabic: ['ar', 'rtl', 'مَسَاحَةُ عَمَلٍ مُشْتَرَكَة · English · ١٢٣'],
  urdu: ['ur', 'rtl', 'مشترکہ کام کی جگہ · English · ۱۲۳'],
  hebrew: ['he', 'rtl', 'סְבִיבַת עֲבוֹדָה מְשֻׁתֶּפֶת · English · 123'],
  devanagari: ['hi', 'ltr', 'साझा कार्यक्षेत्र · English · १२३'],
  thai: ['th', 'ltr', 'พื้นที่ทำงานร่วมกัน · English · ๑๒๓'],
  japanese: ['ja', 'ltr', '共有ワークスペース · English · １２３'],
  korean: ['ko', 'ltr', '공유 작업 공간 · English · 123'],
  'simplified-chinese': ['zh-Hans', 'ltr', '共享工作区 · English · 123'],
  'traditional-chinese': ['zh-Hant', 'ltr', '共享工作區 · English · 123'],
};
export function previewTemplate(t, { script = 'system', direction = 'ltr', zoom = false, locale = 'en' } = {}) {
  const sample = sampleText[script] ?? ['en', direction, t('previewText')];
  return html`<div class="tb-preview-pair">
    ${['primary', 'comparison'].map((key, index) => html`<section class="tb-specimen" data-preview=${key} lang=${locale} dir=${direction} style=${zoom ? '--_builder-text-scale:2' : ''}>
      <p class="tb-mode-label" data-mode-label>${index ? t('comparison') : t('preview')}</p>
      <h2 data-sample-heading>${t('previewTitle')}</h2>
      <p data-sample-body lang=${sample[0]}>${sample[2]}</p>
      <p class="tb-quiet" data-sample-quiet>${t('previewText')}</p>
      <div class="tb-actions">
        <lr-button data-brand variant="brand">${t('save')}</lr-button>
        <lr-button appearance="outlined">${t('dismiss')}</lr-button>
        <lr-button appearance="plain" variant="brand">${t('action')}</lr-button>
        <lr-button disabled>${t('disabled')}</lr-button>
      </div>
      <lr-input label=${t('project')} value=${t('projectValue')} hint=${t('previewText')}></lr-input>
      <lr-input label=${t('project')} error-text=${t('invalid')} required></lr-input>
      <lr-select label=${t('density')} value="comfortable"><lr-option value="comfortable">${t('comfortable')}</lr-option><lr-option value="compact">${t('compact')}</lr-option></lr-select>
      <lr-switch>${t('notifications')}</lr-switch>
      <lr-card style="--lr-card-shadow:var(--lr-shadow-m)"><strong slot="header">${t('previewTitle')}</strong>${t('previewText')}<code slot="footer">const workspace = 'shared';</code></lr-card>
      <lr-button style="--lr-button-radius:0.25rem">${t('local')}</lr-button>
      <div class="tb-backdrop"><lr-menu label=${t('menu')}><lr-menu-item>${t('open')}</lr-menu-item><lr-menu-item>${t('share')}</lr-menu-item></lr-menu></div>
      <lr-button @click=${event => event.currentTarget.parentElement.querySelector('lr-dialog').show()}>${t('overlay')}</lr-button>
      <lr-dialog label=${t('dialog')}>${t('dialogText')}</lr-dialog>
      <section data-lr-density="compact" data-lr-surface="solid" class="tb-island"><h3>${t('island')}</h3><lr-input label=${t('filter')}></lr-input></section>
      <h3>${t('chart')}</h3>
      <svg data-palette-svg viewBox="0 0 320 100" role="img" aria-label=${t('chart')}>
        ${Array.from({ length: 8 }, (_, i) => svg`<rect data-palette-mark=${i} x=${i * 40 + 4} y=${80 - i * 7} width="28" height=${20 + i * 7}></rect>`)}
      </svg>
      <canvas data-palette-canvas width="320" height="100" role="img" aria-label=${t('chart')}></canvas>
      <div class="tb-series-cues">${Array.from({ length: 8 }, (_, i) => {
        const cue = getLyraChartSeriesCue(i);
        return html`<span><svg viewBox="0 0 70 20" aria-hidden="true"><path d="M0 10H70" fill="none" stroke="currentColor" stroke-dasharray=${cue.dash.join(' ') || 'none'}></path>${cue.marker === 'circle' ? svg`<circle cx="35" cy="10" r="4"></circle>` : cue.marker === 'square' ? svg`<rect x="31" y="6" width="8" height="8"></rect>` : cue.marker === 'triangle' ? svg`<path d="M35 5L40 15H30Z"></path>` : svg`<path d="M35 4L41 10L35 16L29 10Z"></path>`}</svg>${t('series')} ${i + 1}</span>`;
      })}</div>
      ${['sequential', 'diverging'].map(kind => html`<div><h4>${t(kind)}</h4><div class="tb-scale">${Array.from({ length: 5 }, (_, i) => html`<span><i data-scale=${kind} data-step=${i}></i>${kind === 'diverging' ? i * 50 - 100 : i * 25}</span>`)}</div></div>`)}
      <details><summary>${t('data')}</summary><table><thead><tr><th>${t('series')}</th><th>${t('value')}</th></tr></thead><tbody>${Array.from({ length: 8 }, (_, i) => html`<tr><th>${t('series')} ${i + 1}</th><td>${20 + i * 7}</td></tr>`)}</tbody></table></details>
    </section>`)}
  </div>`;
}

export function paintPalette(root, mode) {
  const palette = resolveLyraChartPalette(root, { mode });
  const context = root.querySelector('canvas').getContext('2d');
  context.clearRect(0, 0, 320, 100);
  palette.categorical.forEach((color, index) => {
    root.querySelector(`[data-palette-mark="${index}"]`).setAttribute('fill', color);
    context.fillStyle = color;
    context.fillRect(index * 40 + 4, 80 - index * 7, 28, 20 + index * 7);
  });
  root.querySelectorAll('[data-scale]').forEach(element => {
    element.style.backgroundColor = sampleLyraChartScale(root, palette[element.dataset.scale], Number(element.dataset.step) / 4);
  });
  return palette;
}
