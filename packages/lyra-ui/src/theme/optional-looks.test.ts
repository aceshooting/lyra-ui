import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { applyLyraStyleScope } from './theme.js';
import { LYRA_DATA_LOOK } from './looks/data.js';
import { LYRA_TERMINAL_LOOK } from './looks/terminal.js';
import { LYRA_HIGH_CONTRAST_LOOK } from './looks/high-contrast.js';
import { applyLyraPreferences } from './preferences.js';
import { resolveLyraChartPalette } from './chart-palette.js';
import { GEMSTONE_KEYS } from './gemstones-data.js';
import { contrastRatio, resolvedColorToken, toRgba } from '../../test/color-contrast.js';
import { setForcedColors, setReducedMotion } from '../../test/wtr-media.js';
import { focusByKeyboard } from '../../test/wtr-focus.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../test/wtr-mouse.js';
import '../components/forms/button/button.js';
import '../components/forms/input/input.js';
import '../components/layout/card/card.js';
import '../components/overlays/dialog/dialog.js';
import type { LyraButton } from '../components/forms/button/button.class.js';
import type { LyraInput } from '../components/forms/input/input.class.js';
import type { LyraDialog } from '../components/overlays/dialog/dialog.class.js';

const looks = [LYRA_DATA_LOOK, LYRA_TERMINAL_LOOK, LYRA_HIGH_CONTRAST_LOOK];
const modes = ['light', 'dark'] as const;
const color = (scope: Element, suffix: string): string => resolvedColorToken(scope, `--lr-theme-color-${suffix}`);

describe('optional authored looks', () => {
  let previous: CSSStyleSheet[];
  let sheets: CSSStyleSheet[];
  before(async () => {
    sheets = await Promise.all(['theme.css', 'styles/tokens-root.css', 'density.css', 'preferences.css', 'accents.css', 'surfaces/glass.css', ...looks.map(look => `looks/${look.id}.css`)].map(async path => {
      const response = await fetch(new URL(`../${path}`, import.meta.url));
      if (!response.ok) throw new Error(`Missing optional look fixture: ${path}`);
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(await response.text());
      return sheet;
    }));
  });
  beforeEach(async () => {
    previous = document.adoptedStyleSheets;
    document.adoptedStyleSheets = [...previous, ...sheets];
    await setReducedMotion('no-preference');
  });
  afterEach(async () => {
    document.adoptedStyleSheets = previous;
    await setReducedMotion('no-preference');
    await setForcedColors('none');
    await resetMouse();
  });

  for (const look of looks) for (const mode of modes) {
    for (const density of ['compact', 'comfortable', 'touch'] as const) for (const surface of ['solid', 'glass'] as const) {
      it(`${look.id}/${mode}/${density}/${surface} renders equal runtime and CSS surfaces with readable roles`, async () => {
        const scope = await fixture<HTMLElement>(html`<section>
          <lr-button variant="brand">Save</lr-button><lr-input label="Name" value="Example"></lr-input>
          <lr-card>Record details</lr-card>
          <button style="color:var(--lr-theme-color-text-normal);background:var(--lr-theme-color-surface-default);font-family:var(--lr-theme-font-family-body);border-radius:var(--lr-theme-border-radius-button)">Native action</button>
        </section>`);
        const button = scope.querySelector<LyraButton>('lr-button')!;
        const input = scope.querySelector<LyraInput>('lr-input')!;
        await Promise.all([button.updateComplete, input.updateComplete]);
        const base = button.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
        const native = scope.querySelector('button')!;
        const values = () => [getComputedStyle(base).color, getComputedStyle(base).backgroundColor, getComputedStyle(base).borderRadius,
          getComputedStyle(native).fontFamily, getComputedStyle(native).color, getComputedStyle(native).backgroundColor,
          getComputedStyle(input).getPropertyValue('--lr-form-control-height'), base.getBoundingClientRect().height];
        try {
          applyLyraStyleScope(scope, { look: look.id, mode, density, surface });
          const stylesheet = values();
          applyLyraStyleScope(scope, { look, mode, density, surface });
          expect(values()).to.deep.equal(stylesheet);
          expect(toRgba(getComputedStyle(native).color)).to.deep.equal(toRgba(color(scope, 'text-normal')));
          for (const level of ['default', 'raised', 'overlay', 'container', 'container-lowest', 'container-low', 'container-high', 'container-highest']) {
            for (const text of ['normal', 'quiet']) expect(contrastRatio(color(scope, `text-${text}`), color(scope, `surface-${level}`)), `${text}/${level}`).to.be.at.least(4.5);
          }
          for (const role of ['brand', 'neutral', 'success', 'warning', 'danger']) for (const tier of ['quiet', 'normal', 'loud']) {
            expect(contrastRatio(color(scope, `${role}-on-${tier}`), color(scope, `${role}-fill-${tier}`)), `${role}/${tier}`).to.be.at.least(4.5);
          }
          expect(contrastRatio(color(scope, 'focus'), color(scope, 'surface-default'))).to.be.at.least(3);
          expect(contrastRatio(color(scope, 'surface-border'), color(scope, 'surface-default'))).to.be.at.least(3);
          expect(base.getBoundingClientRect().height).to.be.at.least(density === 'touch' ? 44 : 24);
          expect(input.shadowRoot!.querySelector('input')!.value).to.equal('Example');
          if (look.id === 'terminal') expect(getComputedStyle(native).fontFamily).to.include('monospace');
        } finally { applyLyraStyleScope(scope, null); }
      });
    }

    it(`${look.id}/${mode} preserves every accent and resolves palette colors for SVG and canvas`, async () => {
      const scope = await fixture<HTMLElement>(html`<section><svg aria-label="Series sample"><rect width="20" height="20" style="fill:var(--lr-theme-color-chart-1)"></rect></svg></section>`);
      try {
        for (const accent of [...GEMSTONE_KEYS, '#7851a9']) {
          applyLyraStyleScope(scope, { look, mode, density: 'touch', surface: 'solid', accent });
          expect(contrastRatio(color(scope, 'brand-on-loud'), color(scope, 'brand-fill-loud')), accent).to.be.at.least(4.5);
          expect(scope.getAttribute('data-lr-density')).to.equal('touch');
          const palette = resolveLyraChartPalette(scope, { mode });
          expect(toRgba(palette.categorical[0]!)).to.deep.equal(toRgba(getComputedStyle(scope.querySelector('rect')!).fill));
          for (const [index, value] of palette.sequential.entries()) expect(toRgba(value)).to.deep.equal(toRgba(color(scope, `chart-sequential-${index + 1}`)));
        }
      } finally { applyLyraStyleScope(scope, null); }
    });

    it(`${look.id}/${mode} keeps nested mode/density/preferences independent and restores scope`, async () => {
      const scope = await fixture<HTMLElement>(html`<section><section id="inner"><button style="color:var(--lr-color-text-quiet);outline:var(--lr-focus-ring);transition:opacity var(--lr-transition-base)">Nested action</button></section></section>`);
      const inner = scope.querySelector<HTMLElement>('#inner')!;
      const control = inner.querySelector('button')!;
      try {
        applyLyraStyleScope(scope, { look, mode, density: 'touch' });
        applyLyraStyleScope(inner, { mode: mode === 'light' ? 'dark' : 'light', density: 'compact' });
        const duration = getComputedStyle(control).transitionDuration;
        applyLyraPreferences(scope, { contrast: 'more', motion: 'reduce' });
        expect(Number.parseFloat(getComputedStyle(control).transitionDuration)).to.be.lessThan(0.001);
        expect(Number.parseFloat(getComputedStyle(control).outlineWidth)).to.be.at.least(3);
        applyLyraPreferences(inner, { contrast: 'system', motion: 'system' });
        expect(getComputedStyle(control).transitionDuration).to.equal(duration);
        await setReducedMotion('reduce');
        expect(Number.parseFloat(getComputedStyle(control).transitionDuration)).to.be.lessThan(0.001);
        expect(scope.getAttribute('data-lr-look')).to.equal(look.id);
        expect(inner.getAttribute('data-lr-density')).to.equal('compact');
        const branch = look.tokens['--lr-theme-color-surface-default'];
        expect(toRgba(color(inner, 'surface-default'))).to.deep.equal(toRgba(typeof branch === 'string' ? branch : branch![mode === 'light' ? 'dark' : 'light']!));
      } finally {
        applyLyraPreferences(inner, null); applyLyraPreferences(scope, null);
        applyLyraStyleScope(inner, null); applyLyraStyleScope(scope, null);
      }
      expect(scope.hasAttribute('data-lr-look')).to.equal(false);
      expect(inner.hasAttribute('data-lr-mode')).to.equal(false);
    });

    it(`${look.id}/${mode} keeps real pointer and keyboard states legible at narrow RTL allocation`, async () => {
      const scope = await fixture<HTMLElement>(html`<section dir="rtl" style="inline-size:320px;font-size:200%"><lr-button variant="brand">حفظ السجل الطويل</lr-button></section>`);
      const button = scope.querySelector<LyraButton>('lr-button')!;
      await button.updateComplete;
      const base = button.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
      try {
        applyLyraStyleScope(scope, { look, mode, density: 'comfortable' });
        applyLyraPreferences(scope, { motion: 'reduce' });
        await focusByKeyboard(base);
        expect(base.matches(':focus-visible')).to.equal(true);
        expect(Number.parseFloat(getComputedStyle(base).outlineWidth)).to.be.greaterThan(0);
        await hoverUntilMatched(base, 'Optional look button did not become hovered');
        await waitUntil(() => contrastRatio(getComputedStyle(base).color, getComputedStyle(base).backgroundColor) >= 4.5);
        await sendMouse({ type: 'down' });
        await waitUntil(() => base.matches(':active'));
        expect(contrastRatio(getComputedStyle(base).color, getComputedStyle(base).backgroundColor)).to.be.at.least(4.5);
        await sendMouse({ type: 'up' });
        expect(scope.scrollWidth).to.be.at.most(320);
        await expect(button).to.be.accessible();
      } finally { applyLyraPreferences(scope, null); applyLyraStyleScope(scope, null); }
    });

    it(`${look.id}/${mode} carries the look into an open overlay and respects local component geometry`, async () => {
      const scope = await fixture<HTMLElement>(html`<section><lr-button style="--lr-button-radius:1rem">Open</lr-button><lr-dialog label="Record details"><p>Inspect this record.</p></lr-dialog></section>`);
      const dialog = scope.querySelector<LyraDialog>('lr-dialog')!;
      const button = scope.querySelector<LyraButton>('lr-button')!;
      await Promise.all([dialog.updateComplete, button.updateComplete]);
      try {
        applyLyraStyleScope(scope, { look, mode, surface: 'glass' });
        applyLyraPreferences(scope, { motion: 'reduce' });
        await focusByKeyboard(button);
        await dialog.show();
        const panel = dialog.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!;
        expect(panel.getBoundingClientRect().width).to.be.greaterThan(0);
        expect(contrastRatio(getComputedStyle(panel).color, getComputedStyle(panel).backgroundColor)).to.be.at.least(4.5);
        expect(toRgba(resolvedColorToken(panel, '--lr-theme-color-text-normal'))).to.deep.equal(toRgba(color(scope, 'text-normal')));
        await expect(dialog).to.be.accessible();
        await dialog.hide();
        const base = button.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
        expect(Number.parseFloat(getComputedStyle(base).borderRadius)).to.equal(Number.parseFloat(getComputedStyle(document.documentElement).fontSize));
      } finally {
        await dialog.hide();
        applyLyraPreferences(scope, null); applyLyraStyleScope(scope, null);
      }
    });
  }

  for (const look of looks) it(`${look.id} preserves browser forced-color control where supported`, async function () {
    if (!CSS.supports('forced-color-adjust', 'auto')) this.skip();
    const scope = await fixture<HTMLElement>(html`<section><lr-button>Save</lr-button></section>`);
    const button = scope.querySelector<LyraButton>('lr-button')!;
    await button.updateComplete;
    try {
      applyLyraStyleScope(scope, { look, mode: 'dark' });
      await setForcedColors('active');
      expect(matchMedia('(forced-colors: active)').matches).to.equal(true);
      const base = button.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
      expect(getComputedStyle(base).forcedColorAdjust).to.equal('auto');
      expect(toRgba(getComputedStyle(base).color)[3]).to.equal(255);
      expect(contrastRatio(getComputedStyle(base).color, getComputedStyle(base).backgroundColor)).to.be.at.least(4.5);
    } finally { applyLyraStyleScope(scope, null); }
  });
});
