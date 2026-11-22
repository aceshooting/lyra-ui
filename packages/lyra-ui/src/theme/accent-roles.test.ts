import { expect, fixture, html } from '@open-wc/testing';
import '../components/lr-badge.js';
import { setForcedColors } from '../../test/wtr-media.js';
import { GEMSTONE_KEYS } from './gemstones-data.js';

type Role = 'neutral' | 'success' | 'warning' | 'danger';
type Mode = 'light' | 'dark';

const ROLES: readonly Role[] = ['neutral', 'success', 'warning', 'danger'];
const MODES: readonly Mode[] = ['light', 'dark'];
const CHANNELS = ['fill-quiet', 'fill-normal', 'fill-loud', 'border-quiet', 'border-normal', 'border-loud', 'on-quiet', 'on-normal', 'on-loud'] as const;

let sheets: CSSStyleSheet[];
let previousSheets: CSSStyleSheet[];

async function loadSheet(path: string): Promise<CSSStyleSheet> {
  const response = await fetch(new URL(`../${path}`, import.meta.url));
  if (!response.ok) throw new Error(`Missing style fixture: ${path}`);
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(await response.text());
  return sheet;
}

before(async () => {
  sheets = await Promise.all(['theme.css', 'accents.css', 'accent-roles.css'].map(loadSheet));
});
beforeEach(() => {
  previousSheets = document.adoptedStyleSheets;
  document.adoptedStyleSheets = [...previousSheets, ...sheets];
});
afterEach(() => {
  document.adoptedStyleSheets = previousSheets;
});

/** The used colour a token resolves to inside `scope`, read through a real `color` property. */
function paint(scope: Element, token: string): string {
  const probe = document.createElement('span');
  probe.style.color = `var(${token})`;
  scope.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}

function channels(scope: Element, role: Role | 'brand'): string[] {
  return CHANNELS.map(channel => paint(scope, `--lr-color-${role}-${channel}`));
}

async function scope(attributes: Record<string, string>): Promise<HTMLDivElement> {
  const element = await fixture<HTMLDivElement>(html`<div></div>`);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

function rgb(value: string): [number, number, number] {
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) throw new Error(`Not an rgb colour: ${value}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function contrast(a: string, b: string): number {
  const luminance = (color: [number, number, number]) => color
    .map(channel => channel / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index]!, 0);
  const [high, low] = [luminance(rgb(a)), luminance(rgb(b))].sort((x, y) => y - x);
  return (high! + 0.05) / (low! + 0.05);
}

describe('data-lr-accent-<role>', () => {
  for (const mode of MODES) {
    it(`leaves every role at its look default without a role attribute (${mode})`, async () => {
      const withRoles = await scope({ 'data-lr-mode': mode });
      const before = ROLES.map(role => channels(withRoles, role));
      document.adoptedStyleSheets = [...previousSheets, sheets[0]!, sheets[1]!];
      const without = await scope({ 'data-lr-mode': mode });
      expect(ROLES.map(role => channels(without, role))).to.deep.equal(before);
    });

    for (const role of ROLES) {
      it(`remaps ${role} to the brand ramp of the same gemstone in ${mode} mode`, async () => {
        const reference = await scope({ 'data-lr-mode': mode, 'data-lr-accent': 'sapphire' });
        const remapped = await scope({ 'data-lr-mode': mode, [`data-lr-accent-${role}`]: 'sapphire' });
        const plain = await scope({ 'data-lr-mode': mode });
        expect(channels(remapped, role)).to.deep.equal(channels(reference, 'brand'));
        expect(channels(remapped, role)).not.to.deep.equal(channels(plain, role));
        // Only the named role moves: brand, focus and the other roles keep their colours.
        expect(channels(remapped, 'brand')).to.deep.equal(channels(plain, 'brand'));
        expect(paint(remapped, '--lr-focus-ring-color')).to.equal(paint(plain, '--lr-focus-ring-color'));
        for (const other of ROLES.filter(candidate => candidate !== role)) {
          expect(channels(remapped, other), other).to.deep.equal(channels(plain, other));
        }
      });
    }
  }

  it('follows the mode of an enclosing scope', async () => {
    const outer = await fixture<HTMLDivElement>(html`<div data-lr-mode="dark"><div data-lr-accent-danger="aquamarine"></div></div>`);
    const reference = await scope({ 'data-lr-mode': 'dark', 'data-lr-accent': 'aquamarine' });
    expect(channels(outer.firstElementChild!, 'danger')).to.deep.equal(channels(reference, 'brand'));
  });

  it('remaps several roles at once and lets a nested scope override or clear one', async () => {
    const outer = await fixture<HTMLDivElement>(html`
      <div data-lr-mode="light" data-lr-accent-success="sapphire" data-lr-accent-warning="ruby">
        <div id="override" data-lr-accent-success="amethyst"></div>
        <div id="clear" data-lr-accent-success="none"></div>
        <div id="unknown" data-lr-accent-success="not-a-gemstone"></div>
      </div>`);
    const sapphire = channels(await scope({ 'data-lr-mode': 'light', 'data-lr-accent': 'sapphire' }), 'brand');
    const ruby = channels(await scope({ 'data-lr-mode': 'light', 'data-lr-accent': 'ruby' }), 'brand');
    const amethyst = channels(await scope({ 'data-lr-mode': 'light', 'data-lr-accent': 'amethyst' }), 'brand');
    const plain = await scope({ 'data-lr-mode': 'light' });
    expect(channels(outer, 'success')).to.deep.equal(sapphire);
    expect(channels(outer, 'warning')).to.deep.equal(ruby);
    expect(channels(outer.querySelector('#override')!, 'success')).to.deep.equal(amethyst);
    expect(channels(outer.querySelector('#override')!, 'warning')).to.deep.equal(ruby);
    expect(channels(outer.querySelector('#clear')!, 'success')).to.deep.equal(channels(plain, 'success'));
    expect(channels(outer.querySelector('#clear')!, 'warning')).to.deep.equal(ruby);
    expect(channels(outer.querySelector('#unknown')!, 'success')).to.deep.equal(sapphire);
  });

  it('composes with a named brand accent on the same element', async () => {
    const both = await scope({ 'data-lr-mode': 'light', 'data-lr-accent': 'ruby', 'data-lr-accent-success': 'sapphire' });
    expect(channels(both, 'brand')).to.deep.equal(channels(await scope({ 'data-lr-mode': 'light', 'data-lr-accent': 'ruby' }), 'brand'));
    expect(channels(both, 'success')).to.deep.equal(channels(await scope({ 'data-lr-mode': 'light', 'data-lr-accent': 'sapphire' }), 'brand'));
  });

  it('repaints a component variant with the remapped role', async () => {
    const remapped = await fixture<HTMLDivElement>(html`<div data-lr-mode="light" data-lr-accent-success="sapphire"><lr-badge variant="success" appearance="accent">Up</lr-badge></div>`);
    const reference = await fixture<HTMLDivElement>(html`<div data-lr-mode="light" data-lr-accent="sapphire"><lr-badge variant="brand" appearance="accent">Up</lr-badge></div>`);
    const surface = (host: Element) => getComputedStyle(host.querySelector('lr-badge')!.shadowRoot!.querySelector('[part~="base"]')!);
    expect(surface(remapped).backgroundColor).to.equal(surface(reference).backgroundColor);
    expect(surface(remapped).color).to.equal(surface(reference).color);
  });

  for (const mode of MODES) {
    it(`keeps every remapped ramp inside the contrast contract (${mode})`, async () => {
      const page = paint(await scope({ 'data-lr-mode': mode }), '--lr-color-surface');
      for (const gemstone of GEMSTONE_KEYS) for (const role of ROLES) {
        const element = await scope({ 'data-lr-mode': mode, [`data-lr-accent-${role}`]: gemstone });
        const [fillQuiet, fillNormal, fillLoud, , borderNormal, borderLoud, onQuiet, onNormal, onLoud] = channels(element, role);
        const label = `${role}=${gemstone}`;
        expect(contrast(onQuiet!, fillQuiet!), `${label} on-quiet`).to.be.at.least(4.5);
        expect(contrast(onNormal!, fillNormal!), `${label} on-normal`).to.be.at.least(4.5);
        expect(contrast(onLoud!, fillLoud!), `${label} on-loud`).to.be.at.least(4.5);
        expect(contrast(fillLoud!, fillQuiet!), `${label} loud text on quiet fill`).to.be.at.least(4.5);
        expect(contrast(fillLoud!, page), `${label} loud text on the page`).to.be.at.least(4.5);
        expect(contrast(borderNormal!, page), `${label} border-normal`).to.be.at.least(3);
        expect(contrast(borderLoud!, page), `${label} border-loud`).to.be.at.least(3);
        element.remove();
      }
    });
  }

  it('yields to system colours under forced colors', async () => {
    try {
      await setForcedColors('active');
    } catch {
      return;
    }
    try {
      if (!matchMedia('(forced-colors: active)').matches) return;
      const remapped = await scope({ 'data-lr-accent-danger': 'sapphire', 'data-lr-accent-success': 'ruby' });
      const plain = await scope({});
      for (const token of ['--lr-color-danger', '--lr-color-on-danger', '--lr-color-danger-quiet', '--lr-color-success', '--lr-color-on-success', '--lr-color-success-quiet']) {
        expect(paint(remapped, token), token).to.equal(paint(plain, token));
      }
    } finally {
      await setForcedColors('none');
    }
  });
});
