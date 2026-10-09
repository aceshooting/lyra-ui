import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { css } from 'lit';
import { LyraElement } from './lyra-element.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../test/wtr-mouse.js';
import { GEMSTONE_KEYS } from '../theme/gemstones-data.js';
import { focusByKeyboard } from '../../test/wtr-focus.js';
import '../components/data/tree/tree.js';
import '../components/data/tree/tree-item.js';
import '../components/layout/stepper/stepper.js';
import '../components/data/context-meter/context-meter.js';
import type { LyraStepper } from '../components/layout/stepper/stepper.class.js';
import type { LyraContextMeter } from '../components/data/context-meter/context-meter.class.js';
import type { LyraTreeItem } from '../components/data/tree/tree-item.class.js';
import { glassSurface } from './glass-surface.styles.js';
import { contrastRatio, resolvedColorToken, toRgba } from '../../test/color-contrast.js';
import '../components/forms/button/button.js';
import type { LyraButton } from '../components/forms/button/button.class.js';

class GlassContrastFixture extends LyraElement {
  static override styles = [LyraElement.styles, css`
    .surface { position: relative; padding: 16px; }
    ${glassSurface('.surface', css`var(--test-surface, var(--lr-color-surface-overlay))`)}
  `];
  override render() { return html`<div class="surface"><slot></slot></div>`; }
}
customElements.define('test-glass-contrast', GlassContrastFixture);

const composite = (foreground: string, background: string): string => {
  const a = toRgba(foreground);
  const b = toRgba(background);
  return `rgb(${a.slice(0, 3).map((value, i) => value * a[3] / 255 + b[i]! * (1 - a[3] / 255)).join(' ')})`;
};

describe('rendered glass foreground qualification', () => {
  let previous: CSSStyleSheet[];
  let sheets: CSSStyleSheet[];
  before(async () => {
    sheets = await Promise.all(['theme.css', 'looks/shadcn.css', 'looks/material.css', 'looks/data.css', 'looks/terminal.css', 'looks/high-contrast.css', 'accents.css', 'surfaces/glass.css'].map(async path => {
      const response = await fetch(new URL(`../${path}`, import.meta.url));
      if (!response.ok) throw new Error(`Missing fixture ${path}`);
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(await response.text());
      return sheet;
    }));
  });
  beforeEach(() => { previous = document.adoptedStyleSheets; document.adoptedStyleSheets = [...previous, ...sheets]; });
  afterEach(async () => { document.adoptedStyleSheets = previous; await resetMouse(); });

  it('reuses its document canvas and returns independent bytes for cached colors', () => {
    const canvasPrototype = HTMLCanvasElement.prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
    const contextPrototype = CanvasRenderingContext2D.prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
    const originalGetContext = canvasPrototype['getContext']!;
    const originalGetImageData = contextPrototype['getImageData']!;
    let contextCreations = 0;
    let pixelReads = 0;
    try {
      canvasPrototype['getContext'] = function (this: HTMLCanvasElement, ...args: unknown[]) {
        contextCreations++;
        return originalGetContext.apply(this, args);
      };
      contextPrototype['getImageData'] = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
        pixelReads++;
        return originalGetImageData.apply(this, args);
      };
      const first = toRgba('rgb(17 93 211)');
      toRgba('rgb(19 97 223)');
      first[0] = 0;
      const repeated = toRgba('rgb(17 93 211)');
      expect(contextCreations).to.be.at.most(1);
      expect(pixelReads).to.be.at.most(2);
      expect(repeated).to.deep.equal([17, 93, 211, 255]);
      expect(repeated).to.not.equal(first);
    } finally {
      canvasPrototype['getContext'] = originalGetContext;
      contextPrototype['getImageData'] = originalGetImageData;
    }
  });

  it('resets the shared canvas before parsing an invalid color', () => {
    expect(toRgba('rgb(17 93 211)')).to.deep.equal([17, 93, 211, 255]);
    expect(toRgba('not-a-color')).to.deep.equal([0, 0, 0, 255]);
  });

  for (const look of ['lyra', 'shadcn', 'material', 'data', 'terminal', 'high-contrast']) for (const mode of ['light', 'dark']) for (const treatment of ['solid', 'glass']) {
    it(`qualifies ${look}/${mode}/${treatment} chrome with every named accent over both extreme backdrops`, async () => {
      const host = await fixture<GlassContrastFixture>(html`<test-glass-contrast data-lr-look=${look} data-lr-mode=${mode} data-lr-surface=${treatment}><lr-button appearance="plain" variant="brand">Action</lr-button><lr-button appearance="accent" variant="brand">Filled</lr-button></test-glass-contrast>`);
      const [plain, filled] = [...host.children] as LyraButton[];
      await plain!.updateComplete;
      await filled!.updateComplete;
      const surface = host.shadowRoot!.querySelector<HTMLElement>('.surface')!;
      const plainBase = plain!.shadowRoot!.querySelector('[part~="base"]')!;
      const filledBase = filled!.shadowRoot!.querySelector('[part~="base"]')!;
      for (const accent of ['', ...GEMSTONE_KEYS]) {
        if (accent) host.setAttribute('data-lr-accent', accent);
        else host.removeAttribute('data-lr-accent');
        for (const surfaceToken of ['--lr-color-surface', '--lr-color-surface-raised', '--lr-color-surface-overlay', '--lr-color-surface-container-high', '--lr-color-surface-container-highest']) {
          surface.style.setProperty('--test-surface', `var(${surfaceToken})`);
          const paint = getComputedStyle(surface).backgroundColor;
          if (treatment === 'glass') expect(toRgba(paint)[3]).to.be.within(152, 153);
          else expect(toRgba(paint)[3]).to.equal(255);
          const textColors = ['--lr-color-text', '--lr-color-text-quiet'].map(token => [token, resolvedColorToken(surface, token)] as const);
          const edgeColors = ['--lr-color-border', '--lr-color-border-strong', '--lr-focus-ring-color'].map(token => [token, resolvedColorToken(surface, token)] as const);
          const plainColor = getComputedStyle(plainBase).color;
          for (const backdrop of ['black', 'white']) {
            const background = composite(paint, backdrop);
            for (const [token, color] of textColors) {
              expect(contrastRatio(color, background), `${look}/${mode}/${accent}/${surfaceToken}/${token}/${backdrop}`).to.be.at.least(4.5);
            }
            expect(contrastRatio(plainColor, background), `${look}/${mode}/${accent}: plain action`).to.be.at.least(4.5);
            const highlighted = treatment === 'glass' ? composite('rgb(255 255 255 / 0.12)', background) : background;
            for (const [token, color] of edgeColors) {
              expect(contrastRatio(color, highlighted), `${look}/${mode}/${accent}/${token}: edge`).to.be.at.least(3);
            }
          }
          expect(contrastRatio(getComputedStyle(filledBase).color, getComputedStyle(filledBase).backgroundColor), 'opaque accent on-color').to.be.at.least(4.5);
        }
      }
    });
  }
  for (const look of ['lyra', 'shadcn', 'material', 'data', 'terminal', 'high-contrast']) for (const mode of ['light', 'dark']) for (const treatment of ['solid', 'glass']) {
    it(`keeps ${look}/${mode}/${treatment} hover, press, selected and keyboard focus qualified for every accent`, async function () {
      this.timeout(30000);
      const host = await fixture<GlassContrastFixture>(html`<test-glass-contrast data-lr-look=${look} data-lr-mode=${mode} data-lr-surface=${treatment} style="--lr-theme-transition-fast:0s"><lr-button appearance="plain" variant="brand">Action</lr-button><lr-button appearance="accent" variant="brand">Filled</lr-button><lr-tree label="Tree"><lr-tree-item selected>Selected row</lr-tree-item></lr-tree></test-glass-contrast>`);
      const button = host.firstElementChild as LyraButton;
      const selected = host.querySelector<LyraTreeItem>('lr-tree-item')!;
      const filled = host.querySelector<LyraButton>('lr-button[appearance="accent"]')!;
      await Promise.all([button.updateComplete, filled.updateComplete, selected.updateComplete]);
      await waitUntil(() => selected.getAttribute('aria-selected') === 'true');
      const base = button.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
      const item = selected.shadowRoot!.querySelector<HTMLElement>('[part~="item"]')!;
      const surface = host.shadowRoot!.querySelector<HTMLElement>('.surface')!;
      const assertContrast = (target: HTMLElement, state: string, focusTarget?: HTMLElement) => {
        for (const accent of ['', ...GEMSTONE_KEYS]) {
          if (accent) host.setAttribute('data-lr-accent', accent);
          else host.removeAttribute('data-lr-accent');
          for (const surfaceToken of ['--lr-color-surface', '--lr-color-surface-raised', '--lr-color-surface-overlay', '--lr-color-surface-container-high', '--lr-color-surface-container-highest']) {
            surface.style.setProperty('--test-surface', `var(${surfaceToken})`);
            const paint = getComputedStyle(target);
            const borderColor = resolvedColorToken(surface, '--lr-color-border');
            // The inset highlight occupies the edge, not the padded text region.
            const foreground = paint.color;
            const targetBackground = paint.backgroundColor;
            const surfacePaint = getComputedStyle(surface).backgroundColor;
            const outline = focusTarget ? getComputedStyle(focusTarget) : undefined;
            for (const backdrop of ['black', 'white']) {
              const behind = composite(surfacePaint, backdrop);
              const highlighted = treatment === 'glass' ? composite('rgb(255 255 255 / 0.12)', behind) : behind;
              const background = composite(targetBackground, behind);
              const label = `${look}/${mode}/${treatment}/${accent || 'none'}/${surfaceToken}/${state}/${backdrop}`;
              expect(contrastRatio(foreground, background), `${label}: text`).to.be.at.least(4.5);
              expect(contrastRatio(borderColor, highlighted), `${label}: control edge`).to.be.at.least(3);
              if (outline) {
                expect(outline.outlineStyle, `${label}: visible outline`).to.equal('solid');
                expect(Number.parseFloat(outline.outlineWidth), `${label}: outline width`).to.be.greaterThan(0);
                expect(contrastRatio(outline.outlineColor, highlighted), `${label}: focus`).to.be.at.least(3);
              }
            }
          }
        }
      };
      await resetMouse();
      assertContrast(item, 'selected');
      for (const [target, state] of [[base, 'plain'], [filled.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!, 'filled'], [item, 'selected']] as const) {
        await hoverUntilMatched(target, `${state} receives pointer hover`);
        assertContrast(target, `${state}-hover`);
        await sendMouse({ type: 'down' });
        try {
          await waitUntil(() => target.matches(':active'));
          assertContrast(target, `${state}-press`);
        } finally { await sendMouse({ type: 'up' }); }
      }
      await resetMouse();
      await focusByKeyboard(base);
      await waitUntil(() => base.matches(':focus-visible'));
      assertContrast(base, 'keyboard-focus', base);
      await focusByKeyboard(selected);
      await waitUntil(() => selected.matches(':focus-visible'));
      expect(selected.getAttribute('aria-selected')).to.equal('true');
      assertContrast(item, 'selected-keyboard-focus', selected.shadowRoot!.querySelector<HTMLElement>('[part="row"]')!);
    });
  }

  it('preserves explicit foreground hooks during hover and press', async () => {
    const host = await fixture<GlassContrastFixture>(html`<test-glass-contrast data-lr-theme-scope style="--lr-theme-transition-fast:0s"><lr-button appearance="plain" variant="brand" style="--lr-button-hover-color:rgb(7, 8, 9)">Action</lr-button><lr-tree label="Tree"><lr-tree-item selected style="--lr-tree-selected-color:rgb(10, 11, 12)">Selected</lr-tree-item></lr-tree></test-glass-contrast>`);
    const button = host.firstElementChild as LyraButton;
    const selected = host.querySelector<LyraTreeItem>('lr-tree-item')!;
    await Promise.all([button.updateComplete, selected.updateComplete]);
    const base = button.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
    const item = selected.shadowRoot!.querySelector<HTMLElement>('[part~="item"]')!;
    for (const [target, color] of [[base, 'rgb(7, 8, 9)'], [item, 'rgb(10, 11, 12)']] as const) {
      await hoverUntilMatched(target, 'overridden control receives hover');
      expect(getComputedStyle(target).color).to.equal(color);
      await sendMouse({ type: 'down' });
      try {
        await waitUntil(() => target.matches(':active'));
        expect(getComputedStyle(target).color).to.equal(color);
      } finally { await sendMouse({ type: 'up' }); }
    }
  });

  for (const look of ['lyra', 'shadcn', 'material', 'data', 'terminal', 'high-contrast']) for (const mode of ['light', 'dark']) {
    it(`uses paired text fills for ${look}/${mode} step numbers and interactive legend rows`, async () => {
      const host = await fixture<HTMLElement>(html`<div data-lr-look=${look} data-lr-mode=${mode} style="--lr-theme-transition-fast:0s"><lr-stepper .steps=${[{ stepId: 'next', label: 'Next', state: 'pending' }]}></lr-stepper><lr-context-meter interactive with-legend total="100" .segments=${[{ label: 'Used', value: 50, tone: 'brand' }]}></lr-context-meter></div>`);
      const stepper = host.firstElementChild as LyraStepper;
      const meter = host.lastElementChild as LyraContextMeter;
      await Promise.all([stepper.updateComplete, meter.updateComplete]);
      const index = stepper.shadowRoot!.querySelector<HTMLElement>('[part="step-index"]')!;
      const legend = meter.shadowRoot!.querySelector<HTMLElement>('button[part~="legend-item"]')!;
      const check = (target: HTMLElement, state: string) => {
        for (const accent of ['', ...GEMSTONE_KEYS]) {
          if (accent) host.setAttribute('data-lr-accent', accent);
          else host.removeAttribute('data-lr-accent');
          const paint = getComputedStyle(target);
          expect(contrastRatio(paint.color, paint.backgroundColor), `${look}/${mode}/${accent}/${state}`).to.be.at.least(4.5);
        }
      };
      check(index, 'step number');
      await hoverUntilMatched(legend, 'legend receives hover');
      check(legend, 'legend hover');
      await sendMouse({ type: 'down' });
      try {
        await waitUntil(() => legend.matches(':active'));
        check(legend, 'legend press');
      } finally { await sendMouse({ type: 'up' }); }
    });
  }

});
