import { expect, fixture, html } from '@open-wc/testing';
import './components/lr-callout.js';
import './components/lr-zoomable-frame.js';
import './components/lr-menu.js';
import './components/lr-dialog.js';
import './components/lr-lightbox.js';
import './components/lr-tool-approval-dialog.js';
import './components/lr-tool-result-dialog.js';
import './components/lr-tool-select-dialog.js';

// The hosts whose own :host rule paints margin, padding or border, kept in step with the recipe in
// llms/shared/native-styles-and-utilities.md and .storybook/tailwind.css.
const BOX_PAINTING_HOSTS = [
  'lr-callout',
  'lr-zoomable-frame',
  'lr-menu',
  'lr-dialog',
  'lr-lightbox',
  'lr-tool-approval-dialog',
  'lr-tool-result-dialog',
  'lr-tool-select-dialog',
] as const;

const RESET = '@layer base { *, ::before, ::after { margin: 0; padding: 0; border: 0 solid; } }';
const RECIPE = `@layer base {
  :where(${BOX_PAINTING_HOSTS.join(', ')}) {
    margin: revert-layer;
    padding: revert-layer;
    border: revert-layer;
  }
}`;

const sheets: HTMLStyleElement[] = [];
const addSheet = (text: string): void => {
  const style = document.createElement('style');
  style.textContent = text;
  document.head.append(style);
  sheets.push(style);
};

afterEach(() => {
  for (const sheet of sheets.splice(0)) sheet.remove();
});

const box = (el: Element): string => {
  const style = getComputedStyle(el);
  return [
    style.paddingBlockStart,
    style.paddingInlineEnd,
    style.borderBlockStartWidth,
    style.borderInlineEndWidth,
    style.marginBlockStart,
  ].join(' ');
};

const render = async (): Promise<HTMLElement> =>
  fixture<HTMLElement>(html`<div>
    ${BOX_PAINTING_HOSTS.map((name) => document.createElement(name))}
  </div>`);

describe('document resets and host-owned boxes', () => {
  it('a reset strips each listed host box and the documented same-layer recipe restores it', async () => {
    addSheet('@layer theme, base, components, utilities;');
    const wrapper = await render();
    const hosts = BOX_PAINTING_HOSTS.map((name) => wrapper.querySelector(name)!);
    const clean = hosts.map(box);

    addSheet(RESET);
    const reset = hosts.map(box);
    BOX_PAINTING_HOSTS.forEach((name, index) => {
      expect(reset[index], `${name} paints a host box a reset can strip`).to.not.equal(clean[index]);
    });

    addSheet(RECIPE);
    expect(hosts.map(box)).to.deep.equal(clean);
  });

  it('keeps a consumer rule in a later layer authoritative over the recipe', async () => {
    addSheet('@layer theme, base, components, utilities;');
    addSheet(RESET);
    addSheet(RECIPE);
    addSheet('@layer components { lr-callout { padding: 3px; } }');
    const wrapper = await render();
    expect(getComputedStyle(wrapper.querySelector('lr-callout')!).paddingBlockStart).to.equal('3px');
  });
});
