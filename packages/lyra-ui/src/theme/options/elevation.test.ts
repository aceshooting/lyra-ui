import { expect, fixture, html } from '@open-wc/testing';
import { setForcedColors } from '../../../test/wtr-media.js';
import { contrastRatio, toRgba } from '../../../test/color-contrast.js';
import { applyLyraStyleScope } from '../theme.js';
import { LYRA_ELEVATION_PRESETS } from './elevation.js';
import { LYRA_MATERIAL_LOOK } from '../looks/material.js';
import '../../components/layout/card/card.js';
import '../../components/layout/menu/menu.js';
import '../../components/overlays/dialog/dialog.js';
import type { LyraCard } from '../../components/layout/card/card.js';
import type { LyraDialog } from '../../components/overlays/dialog/dialog.js';

// Normalize the specified fill through the same color space as the painted Glass material.
function glassColor(fill: string, mode: 'light' | 'dark' = 'light') {
  const qualifiedFill = mode === 'dark' ? `color-mix(in srgb, ${fill} 20%, black)` : fill;
  return toRgba(`color-mix(in srgb, ${qualifiedFill} 60%, transparent)`);
}

describe('tonal surface elevation', () => {
  let sheets: CSSStyleSheet[];
  let previous: CSSStyleSheet[];
  before(async () => {
    sheets = await Promise.all(['theme.css', 'looks/material.css', 'looks/shadcn.css'].map(async path => {
      const response = await fetch(new URL(`../../${path}`, import.meta.url));
      if (!response.ok) throw new Error(`Missing elevation fixture: ${path}`);
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(await response.text());
      return sheet;
    }));
  });
  beforeEach(() => { previous = document.adoptedStyleSheets; document.adoptedStyleSheets = [...previous, ...sheets]; });
  afterEach(() => { document.adoptedStyleSheets = previous; });

  async function surfaces() {
    const scope = await fixture<HTMLElement>(html`<section><lr-card>Content</lr-card><lr-dialog label="Details">Content</lr-dialog></section>`);
    const card = scope.querySelector<LyraCard>('lr-card')!;
    const dialog = scope.querySelector<LyraDialog>('lr-dialog')!;
    await Promise.all([card.updateComplete, dialog.updateComplete]);
    return { scope, card, dialog, base: card.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!, panel: dialog.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')! };
  }

  it('preserves existing page and overlay hooks until a container role is selected, then restores them', async () => {
    const { scope, card, dialog, base, panel } = await surfaces();
    scope.setAttribute('data-lr-theme-scope', '');
    scope.style.setProperty('--lr-theme-color-surface-default', '#123456');
    scope.style.setProperty('--lr-theme-color-surface-overlay', '#345678');
    const initial = { card: getComputedStyle(base).backgroundColor, panel: getComputedStyle(panel).backgroundColor, z: getComputedStyle(panel).zIndex };
    expect(initial.card).to.equal('rgb(18, 52, 86)');
    expect(Number.parseFloat(getComputedStyle(panel).getPropertyValue('--lr-theme-surface-opacity'))).to.equal(0.6);
    expect(toRgba(initial.panel)).to.deep.equal(glassColor('rgb(52 86 120)'));
    try {
      applyLyraStyleScope(scope, { overrides: {
        '--lr-theme-color-surface-container-low': '#654321',
        '--lr-theme-color-surface-container-highest': '#765432',
      } });
      expect(getComputedStyle(base).backgroundColor).to.equal('rgb(101, 67, 33)');
      expect(toRgba(getComputedStyle(panel).backgroundColor)).to.deep.equal(glassColor('rgb(118 84 50)'));
      expect(getComputedStyle(panel).zIndex).to.equal(initial.z);
      card.style.setProperty('--lr-card-outlined-bg', '#abcdef');
      dialog.style.setProperty('--lr-overlay-surface', '#fedcba');
      expect(getComputedStyle(base).backgroundColor).to.equal('rgb(171, 205, 239)');
      expect(toRgba(getComputedStyle(panel).backgroundColor)).to.deep.equal(glassColor('rgb(254 220 186)'));
    } finally {
      applyLyraStyleScope(scope, null);
      card.style.removeProperty('--lr-card-outlined-bg');
      dialog.style.removeProperty('--lr-overlay-surface');
    }
    expect(getComputedStyle(base).backgroundColor).to.equal(initial.card);
    expect(getComputedStyle(panel).backgroundColor).to.equal(initial.panel);
  });

  it('renders Material container levels identically through stylesheet and runtime looks', async () => {
    const { scope, base, panel } = await surfaces();
    try {
      for (const mode of ['light', 'dark'] as const) {
        applyLyraStyleScope(scope, { look: 'material', mode });
        const expected = { card: getComputedStyle(base).backgroundColor, panel: getComputedStyle(panel).backgroundColor };
        expect(expected.card).to.equal(mode === 'light' ? 'rgb(252, 242, 237)' : 'rgb(33, 25, 20)');
        expect(toRgba(expected.panel)).to.deep.equal(glassColor(mode === 'light' ? 'rgb(236 223 215)' : 'rgb(53 42 36)', mode));
        applyLyraStyleScope(scope, { look: LYRA_MATERIAL_LOOK, mode });
        expect(getComputedStyle(base).backgroundColor).to.equal(expected.card);
        expect(getComputedStyle(panel).backgroundColor).to.equal(expected.panel);
      }
    } finally { applyLyraStyleScope(scope, null); }
  });

  it('composes neutral tonal elevation with each look and changes both surface and shadow', async () => {
    const { scope, base, panel } = await surfaces();
    try {
      for (const look of ['lyra', 'shadcn', 'material']) for (const mode of ['light', 'dark'] as const) {
        applyLyraStyleScope(scope, { look, mode, overrides: LYRA_ELEVATION_PRESETS.tonal });
        expect(getComputedStyle(base).backgroundColor).to.equal(mode === 'light' ? 'rgb(247, 247, 247)' : 'rgb(32, 32, 32)');
        expect(toRgba(getComputedStyle(panel).backgroundColor)).to.deep.equal(glassColor(mode === 'light' ? 'rgb(226 226 226)' : 'rgb(57 57 57)', mode));
        expect(getComputedStyle(panel).boxShadow).to.equal('none');
      }
    } finally { applyLyraStyleScope(scope, null); }
  });

  it('keeps normal and quiet text legible on every tonal container in each look and mode', async () => {
    const { scope, card } = await surfaces();
    const probe = document.createElement('span');
    probe.textContent = 'Surface content';
    card.append(probe);
    try {
      for (const look of ['lyra', 'shadcn', 'material']) for (const mode of ['light', 'dark'] as const) {
        applyLyraStyleScope(scope, { look, mode, overrides: LYRA_ELEVATION_PRESETS.tonal });
        for (const role of ['container-lowest', 'container-low', 'container', 'container-high', 'container-highest']) {
          probe.style.background = `var(--lr-color-surface-${role})`;
          for (const foreground of ['text', 'text-quiet']) {
            probe.style.color = `var(--lr-color-${foreground})`;
            const style = getComputedStyle(probe);
            expect(contrastRatio(style.color, style.backgroundColor), `${look}/${mode}/${role}/${foreground}`).to.be.at.least(4.5);
          }
        }
      }
    } finally { applyLyraStyleScope(scope, null); }
  });

  it('uses the high tonal level on an anchored menu without changing its positioning', async () => {
    const scope = await fixture<HTMLElement>(html`<section><lr-menu><lr-menu-item>Open</lr-menu-item></lr-menu></section>`);
    const menu = scope.querySelector<HTMLElement>('lr-menu')!;
    const before = getComputedStyle(menu).position;
    try {
      applyLyraStyleScope(scope, { mode: 'light', overrides: LYRA_ELEVATION_PRESETS.tonal });
      expect(toRgba(getComputedStyle(menu).backgroundColor)).to.deep.equal(glassColor('rgb(233 233 233)'));
      expect(getComputedStyle(menu).position).to.equal(before);
      menu.style.setProperty('--lr-overlay-surface', '#123456');
      expect(toRgba(getComputedStyle(menu).backgroundColor)).to.deep.equal(glassColor('rgb(18 52 86)'));
    } finally { applyLyraStyleScope(scope, null); }
  });

  it('retains visible system boundaries and surfaces in forced colors', async function () {
    try { await setForcedColors('active'); } catch { this.skip(); }
    if (!matchMedia('(forced-colors: active)').matches) { await setForcedColors('none'); this.skip(); }
    const { scope, base, panel } = await surfaces();
    try {
      applyLyraStyleScope(scope, { look: 'material', mode: 'dark', overrides: LYRA_ELEVATION_PRESETS.tonal });
      for (const surface of [base, panel]) {
        const style = getComputedStyle(surface);
        expect(Number.parseFloat(style.borderTopWidth)).to.be.greaterThan(0);
        expect(style.borderTopStyle).to.equal('solid');
        expect(style.borderTopColor).not.to.equal(style.backgroundColor);
      }
    } finally { applyLyraStyleScope(scope, null); await setForcedColors('none'); }
  });
});
