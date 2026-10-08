import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { css } from 'lit';
import { LyraElement } from './lyra-element.js';
import { glassSurface } from './glass-surface.styles.js';
import { contrastRatio, resolvedColorToken, toRgba } from '../../test/color-contrast.js';
import { applyLyraStyleScope } from '../theme/theme.js';
import '../components/forms/input/input.js';
import '../components/overlays/dialog/dialog.js';
import '../components/overlays/overlay/popover.js';
import '../components/layout/card/card.js';
import '../components/layout/details/details.js';
import '../components/layout/details/accordion-item.js';
import type { LyraInput } from '../components/forms/input/input.class.js';
import type { LyraDialog } from '../components/overlays/dialog/dialog.class.js';
import type { LyraPopover } from '../components/overlays/overlay/popover.class.js';

const composite = (paint: string, backdrop: string): string => {
  const foreground = toRgba(paint);
  const background = toRgba(backdrop);
  return `rgb(${foreground.slice(0, 3).map((channel, index) => channel * foreground[3] / 255 + background[index]! * (1 - foreground[3] / 255)).join(' ')})`;
};

class GlassBorderFixture extends LyraElement {
  static override styles = [LyraElement.styles, css`
    .surface { position: relative; padding: 16px; }
    ${glassSurface('.surface', css`var(--lr-color-surface-overlay)`)}
  `];
  override render() { return html`<div class="surface"><slot></slot></div>`; }
}
customElements.define('test-glass-border', GlassBorderFixture);

describe('opacity-aware glass control borders', () => {
  let previous: CSSStyleSheet[];
  let sheets: CSSStyleSheet[];
  before(async () => {
    sheets = await Promise.all(['theme.css', 'styles/tokens-root.css', 'surfaces/glass.css', 'preferences.css'].map(async path => {
      const response = await fetch(new URL(`../${path}`, import.meta.url));
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(await response.text());
      return sheet;
    }));
  });
  beforeEach(() => { previous = document.adoptedStyleSheets; });
  afterEach(() => { document.adoptedStyleSheets = previous; });

  for (const setup of ['sheetless', 'theme', 'explicit'] as const) for (const mode of ['light', 'dark'] as const) {
    it(`uses the painted opacity for ${setup}/${mode} ordinary and strong borders`, async () => {
      document.adoptedStyleSheets = [...previous, ...(setup === 'sheetless' ? [] : setup === 'theme' ? [sheets[0]!] : sheets)];
      const host = await fixture<GlassBorderFixture>(html`<test-glass-border data-lr-theme=${mode} data-lr-surface="glass"></test-glass-border>`);
      const surface = host.shadowRoot!.querySelector<HTMLElement>('.surface')!;
      const border = () => toRgba(resolvedColorToken(surface, '--lr-color-border'));
      const strong = () => toRgba(resolvedColorToken(surface, '--lr-color-border-strong'));
      const original = () => toRgba(resolvedColorToken(surface, '--_lr-glass-original-border'));
      host.style.setProperty('--lr-theme-surface-opacity', '1');
      expect(border()).to.deep.equal(original());
      expect(strong()).to.deep.equal(toRgba(resolvedColorToken(surface, '--_lr-glass-original-border-strong')));
      host.style.setProperty('--lr-theme-surface-opacity', '0.7');
      const qualified = border();
      const foreground = toRgba(resolvedColorToken(surface, '--lr-color-text'));
      expect(Math.abs(qualified[0] - foreground[0])).to.be.greaterThan(5);
      expect(strong()).to.deep.equal(qualified);
      for (const opacity of [0, 0.35, 0.7, 1]) {
        surface.style.setProperty('--lr-theme-surface-opacity', String(opacity));
        expect(toRgba(getComputedStyle(surface).backgroundColor)[3]).to.be.within(Math.floor(opacity * 255), Math.ceil(opacity * 255));
      }
      surface.style.removeProperty('--lr-theme-surface-opacity');
      expect(border()).to.deep.equal(qualified);
      const subtle = toRgba(resolvedColorToken(host, '--lr-color-border-subtle'));
      host.setAttribute('data-lr-theme-scope', '');
      host.style.setProperty('--lr-theme-color-surface-border-subtle', 'rgb(27 39 51)');
      expect(toRgba(resolvedColorToken(surface, '--lr-color-border-subtle'))).to.deep.equal([27, 39, 51, 255]);
      host.style.removeProperty('--lr-theme-color-surface-border-subtle');
      expect(toRgba(resolvedColorToken(host, '--lr-color-border-subtle'))).to.deep.equal(subtle);
      host.setAttribute('data-lr-contrast', 'more');
      if (setup === 'explicit') {
        expect(toRgba(getComputedStyle(surface).backgroundColor)[3]).to.equal(255);
        expect(contrastRatio(resolvedColorToken(surface, '--lr-color-border'), getComputedStyle(surface).backgroundColor)).to.be.at.least(3);
      }
    });
  }

  for (const kind of ['dialog', 'popover'] as const) for (const mode of ['light', 'dark'] as const) {
    it(`keeps ${mode} ${kind} descendants qualified while honoring opacity and control overrides`, async () => {
      document.adoptedStyleSheets = [...previous, ...sheets];
      const scope = await fixture<HTMLDivElement>(html`<div>${kind === 'dialog'
        ? html`<lr-dialog label="Details"><lr-input label="Name" appearance="filled-outlined"></lr-input></lr-dialog>`
        : html`<lr-popover><button slot="trigger">Details</button><lr-input label="Name" appearance="filled-outlined"></lr-input></lr-popover>`}</div>`);
      applyLyraStyleScope(scope, { look: 'shadcn', surface: 'glass', mode });
      scope.style.setProperty('--lr-theme-surface-opacity', '0.7');
      scope.setAttribute('data-lr-theme-scope', '');
      scope.style.setProperty('--lr-theme-transition-fast', '0s');
      const overlay = scope.firstElementChild as LyraDialog | LyraPopover;
      const input = scope.querySelector<LyraInput>('lr-input')!;
      await Promise.all([overlay.updateComplete, input.updateComplete]);
      overlay.addEventListener('lr-initial-focus', event => event.preventDefault());
      await overlay.show();
      const surface = overlay.shadowRoot!.querySelector<HTMLElement>(kind === 'dialog' ? '[part~="panel"]' : '[part~="popup"]')!;
      const wrapper = input.shadowRoot!.querySelector<HTMLElement>('[part~="input-wrapper"]')!;
      await waitUntil(() => surface.getBoundingClientRect().width > 0 && getComputedStyle(surface).opacity === '1');
      const color = getComputedStyle(wrapper).borderTopColor;
      expect(Math.abs(toRgba(color)[0] - toRgba(resolvedColorToken(surface, '--lr-color-text'))[0])).to.be.greaterThan(5);
      for (const backdrop of ['black', 'white']) {
        const behind = composite(getComputedStyle(surface).backgroundColor, backdrop);
        const interior = composite(getComputedStyle(wrapper).backgroundColor, behind);
        expect(contrastRatio(color, behind), `${kind}/${mode}: outside boundary`).to.be.at.least(3);
        expect(contrastRatio(color, interior), `${kind}/${mode}: inside boundary`).to.be.at.least(3);
      }
      scope.style.setProperty('--lr-theme-surface-opacity', '1');
      const original = resolvedColorToken(surface, '--_lr-glass-original-border');
      expect(toRgba(getComputedStyle(wrapper).borderTopColor)).to.deep.equal(toRgba(original));
      overlay.style.setProperty('--lr-theme-surface-opacity', '0.7');
      expect(toRgba(getComputedStyle(wrapper).borderTopColor)).to.deep.equal(toRgba(color));
      input.style.setProperty('--lr-input-border-color', 'rgb(17 29 41)');
      expect(toRgba(getComputedStyle(wrapper).borderTopColor)).to.deep.equal([17, 29, 41, 255]);
      await overlay.hide();
      applyLyraStyleScope(scope, null);
    });
  }

  for (const carrier of ['ordinary', 'popover', 'modal'] as const) for (const mode of ['light', 'dark'] as const) {
    it(`resolves native ${carrier}/${mode} border tiers from local opacity and captured material`, async () => {
      document.adoptedStyleSheets = [...previous, ...sheets];
      const outer = await fixture<HTMLDivElement>(html`<div class="lr-surface-chrome" data-lr-mode=${mode} data-lr-surface="glass"></div>`);
      const surface = document.createElement(carrier === 'modal' ? 'dialog' : 'div');
      surface.className = 'lr-surface-chrome';
      surface.setAttribute('data-lr-surface', 'glass');
      surface.textContent = 'Details';
      if (carrier === 'popover') surface.setAttribute('popover', 'manual');
      outer.append(surface);
      try {
        if (carrier === 'modal') (surface as HTMLDialogElement).showModal();
        if (carrier === 'popover') surface.showPopover();
        const original = () => toRgba(resolvedColorToken(surface, '--_lr-glass-original-border'));
        const border = () => toRgba(resolvedColorToken(surface, '--lr-color-border'));
        if (carrier === 'ordinary') {
          expect(toRgba(getComputedStyle(surface).backgroundColor)[3]).to.equal(255);
          expect(border()).to.deep.equal(original());
        } else {
          expect(toRgba(getComputedStyle(surface).backgroundColor)[3]).to.be.within(152, 154);
          for (const backdrop of ['black', 'white']) {
            expect(contrastRatio(resolvedColorToken(surface, '--lr-color-border'), composite(getComputedStyle(surface).backgroundColor, backdrop))).to.be.at.least(3);
          }
          for (const opacity of [0, 0.35, 0.7, 1]) {
            surface.style.setProperty('--lr-theme-surface-opacity', String(opacity));
            expect(toRgba(getComputedStyle(surface).backgroundColor)[3]).to.be.within(Math.floor(opacity * 255), Math.ceil(opacity * 255));
          }
          expect(border()).to.deep.equal(original());
          expect(toRgba(resolvedColorToken(surface, '--lr-color-border-strong'))).to.deep.equal(toRgba(resolvedColorToken(surface, '--_lr-glass-original-border-strong')));
        }
        surface.style.setProperty('--lr-theme-surface-opacity', '0');
        surface.setAttribute('data-lr-contrast', 'more');
        expect(toRgba(getComputedStyle(surface).backgroundColor)[3]).to.equal(255);
        expect(contrastRatio(resolvedColorToken(surface, '--lr-color-border'), getComputedStyle(surface).backgroundColor)).to.be.at.least(3);
      } finally {
        if (carrier === 'modal') (surface as HTMLDialogElement).close();
        if (carrier === 'popover') surface.hidePopover();
      }
    });
  }

  for (const container of ['card', 'details', 'accordion-item'] as const) for (const mode of ['light', 'dark'] as const) {
    it(`keeps ${container}/${mode} content controls at their opaque interior's border color`, async () => {
      document.adoptedStyleSheets = [...previous, ...sheets];
      const content = html`<lr-input label="Name" appearance="filled-outlined"></lr-input><lr-input label="Outlined name"></lr-input><button style="border:1px solid var(--lr-color-border)">Native</button><lr-popover top-layer><button slot="trigger">Nested popup</button>Details</lr-popover>`;
      const host = await fixture<GlassBorderFixture>(html`<test-glass-border data-lr-theme=${mode} data-lr-surface="glass">${container === 'card'
        ? html`<lr-card>${content}</lr-card>`
        : container === 'details' ? html`<lr-details open summary="Details">${content}</lr-details>`
          : html`<lr-accordion-item expanded label="Details">${content}</lr-accordion-item>`}</test-glass-border>`);
      const panel = host.firstElementChild as LyraElement;
      const input = panel.querySelector<LyraInput>('lr-input')!;
      await Promise.all([panel.updateComplete, input.updateComplete]);
      const chrome = host.shadowRoot!.querySelector<HTMLElement>('.surface')!;
      const wrapper = input.shadowRoot!.querySelector<HTMLElement>('[part~="input-wrapper"]')!;
      expect(toRgba(getComputedStyle(wrapper).borderTopColor)).to.deep.equal(toRgba(resolvedColorToken(chrome, '--_lr-glass-original-border')));
      expect(contrastRatio(getComputedStyle(wrapper).borderTopColor, getComputedStyle(wrapper).backgroundColor)).to.be.at.least(3);
      const body = panel.shadowRoot!.querySelector<HTMLElement>(container === 'card' ? '[part="body"]' : container === 'details' ? '[part="content"]' : '[part="panel"]')!;
      expect(body.getBoundingClientRect().height).to.be.greaterThan(0);
      expect(toRgba(resolvedColorToken(input.shadowRoot!, '--lr-color-border-strong'))).to.deep.equal(toRgba(resolvedColorToken(chrome, '--_lr-glass-original-border-strong')));
      const painted = panel.shadowRoot!.querySelector<HTMLElement>(container === 'card' ? '[part="base"]' : container === 'details' ? '[part~="base"]' : '[part~="accordion-item"]')!;
      expect(toRgba(getComputedStyle(painted).backgroundColor)[3]).to.equal(255);
      const outlined = panel.querySelectorAll<LyraInput>('lr-input')[1]!;
      await outlined.updateComplete;
      const outlinedWrapper = outlined.shadowRoot!.querySelector<HTMLElement>('[part~="input-wrapper"]')!;
      expect(contrastRatio(getComputedStyle(outlinedWrapper).borderTopColor, getComputedStyle(painted).backgroundColor)).to.be.at.least(3);
      const native = panel.querySelector<HTMLButtonElement>('button')!;
      panel.setAttribute('data-lr-theme-scope', '');
      panel.style.setProperty('--lr-color-border', 'rgb(13 25 37)');
      expect(toRgba(getComputedStyle(native).borderTopColor)).to.deep.equal([13, 25, 37, 255]);
      panel.style.removeProperty('--lr-color-border');
      panel.style.setProperty('--lr-theme-color-surface-border', 'rgb(29 41 53)');
      expect(toRgba(getComputedStyle(wrapper).borderTopColor)).to.deep.equal([29, 41, 53, 255]);
      panel.style.removeProperty('--lr-theme-color-surface-border');
      input.style.setProperty('--lr-input-border-color', 'rgb(17 29 41)');
      expect(toRgba(getComputedStyle(wrapper).borderTopColor)).to.deep.equal([17, 29, 41, 255]);
      const backgroundInput = container === 'card' ? '--lr-card-outlined-bg' : container === 'details' ? '--lr-details-outlined-bg' : '--lr-accordion-item-outlined-bg';
      panel.style.setProperty(backgroundInput, 'rgb(29 41 53 / 0.5)');
      expect(toRgba(getComputedStyle(painted).backgroundColor)[3]).to.be.within(127, 128);
      expect(toRgba(getComputedStyle(wrapper).borderTopColor)).to.deep.equal([17, 29, 41, 255]);
      panel.style.removeProperty(backgroundInput);
      const popup = panel.querySelector<LyraPopover>('lr-popover')!;
      await popup.updateComplete;
      await popup.show();
      const popupSurface = popup.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
      expect(toRgba(getComputedStyle(popupSurface).backgroundColor)[3]).to.be.within(152, 154);
      expect(Math.abs(toRgba(resolvedColorToken(popupSurface, '--lr-color-border'))[0] - toRgba(resolvedColorToken(chrome, '--_lr-glass-original-border'))[0])).to.be.greaterThan(50);
      await popup.hide();
    });
  }

  for (const setup of ['sheetless', 'explicit'] as const) for (const appearance of ['outlined', 'plain', 'filled', 'filled-outlined']) {
    it(`preserves ${setup}/${appearance} content boundary semantics`, async () => {
      document.adoptedStyleSheets = [...previous, ...(setup === 'sheetless' ? [] : sheets)];
      const host = await fixture<GlassBorderFixture>(html`<test-glass-border data-lr-theme="dark" data-lr-surface="glass"><lr-card appearance=${appearance}><lr-input label="Card name"></lr-input></lr-card><lr-details appearance=${appearance} open summary="Details"><lr-input label="Details name"></lr-input></lr-details><lr-accordion-item appearance=${appearance} expanded label="Accordion"><lr-input label="Accordion name"></lr-input></lr-accordion-item></test-glass-border>`);
      const surface = host.shadowRoot!.querySelector<HTMLElement>('.surface')!;
      const original = toRgba(resolvedColorToken(surface, '--_lr-glass-original-border'));
      for (const panel of [...host.children] as LyraElement[]) {
        const input = panel.querySelector<LyraInput>('lr-input')!;
        await Promise.all([panel.updateComplete, input.updateComplete]);
        const wrapper = input.shadowRoot!.querySelector<HTMLElement>('[part~="input-wrapper"]')!;
        if (appearance === 'outlined') expect(toRgba(getComputedStyle(wrapper).borderTopColor)).to.deep.equal(original);
        else expect(toRgba(getComputedStyle(wrapper).borderTopColor)[0]).to.be.greaterThan(original[0] + 50);
      }
    });
  }
});
