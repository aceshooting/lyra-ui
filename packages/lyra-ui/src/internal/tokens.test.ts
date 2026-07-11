import { fixture, expect, html } from '@open-wc/testing';
import { LitElement } from 'lit';
import { tokens } from './tokens.styles.js';

class TokenProbe extends LitElement {
  static styles = [tokens];
  render() {
    return html`<div part="probe"></div>`;
  }
}
customElements.define('lyra-token-probe', TokenProbe);

async function probeVar(name: string): Promise<string> {
  const el = (await fixture(html`<lyra-token-probe></lyra-token-probe>`)) as TokenProbe;
  return getComputedStyle(el).getPropertyValue(name).trim();
}

it('defines the new motion tokens with the documented fallback values', async () => {
  expect(await probeVar('--lyra-transition-fast')).to.equal('120ms ease-out');
  expect(await probeVar('--lyra-transition-base')).to.equal('180ms ease-out');
});

it('defines a single disabled-opacity token', async () => {
  expect(await probeVar('--lyra-opacity-disabled')).to.equal('0.5');
});

it('defines the focus-ring tokens, with color aliasing the existing brand token', async () => {
  expect(await probeVar('--lyra-focus-ring-width')).to.equal('2px');
  expect(await probeVar('--lyra-focus-ring-offset')).to.equal('2px');
  expect(await probeVar('--lyra-focus-ring-color')).to.equal(await probeVar('--lyra-color-brand'));
});

it('defines an icon-button-size token', async () => {
  expect(await probeVar('--lyra-icon-button-size')).to.equal('2.5rem');
});

it('darkens the border fallback to clear WCAG 1.4.11 non-text 3:1 contrast against white', async () => {
  expect(await probeVar('--lyra-color-border')).to.equal('#8a8a90');
});

it('provides a dark-aware fallback under prefers-color-scheme: dark when no --wa-* theme is present', () => {
  const cssText = tokens.cssText;
  expect(cssText).to.match(/@media\s*\(prefers-color-scheme:\s*dark\)/);
  // The dark block must still chain through the same --wa-* token names (a real
  // Web Awesome theme value must still win over this fallback), only the
  // literal fallback hex changes.
  const darkBlockMatch = /@media\s*\(prefers-color-scheme:\s*dark\)\s*{([\s\S]*?)}\s*}/.exec(cssText);
  expect(darkBlockMatch, 'expected a dark-mode block').to.not.equal(null);
  expect(darkBlockMatch![1]).to.include('--wa-color-surface-default');
  expect(darkBlockMatch![1]).to.include('--wa-color-text-normal');
});
