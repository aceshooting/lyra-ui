import { expect, fixture, waitUntil } from '@open-wc/testing';
import '../lr-breadcrumb.js';
import '../lr-menubar.js';
import '../lr-stepper.js';
import '../lr-tab-group.js';
import '../lr-button-group.js';
import '../lr-control-group.js';
import '../lr-reorder-list.js';
import '../lr-segmented.js';
import '../lr-scroller.js';
import '../lr-navigation-menu.js';
import '../lr-app-rail.js';

interface Case {
  tag: string;
  selector: string;
  /** Localized default; `null` means the role has none and the attribute is omitted. */
  fallback: string | null;
}

const CASES: Case[] = [
  { tag: 'lr-breadcrumb', selector: 'nav', fallback: 'Breadcrumb' },
  { tag: 'lr-menubar', selector: '[role="menubar"]', fallback: 'Menu' },
  { tag: 'lr-stepper', selector: '[role="list"]', fallback: null },
  { tag: 'lr-tab-group', selector: '[role="tablist"]', fallback: null },
  { tag: 'lr-button-group', selector: '[role="group"]', fallback: null },
  { tag: 'lr-control-group', selector: '[role="group"]', fallback: null },
  { tag: 'lr-reorder-list', selector: '[role="list"]', fallback: null },
  { tag: 'lr-scroller', selector: '[role="region"], [role="group"]', fallback: 'Scrollable content' },
  { tag: 'lr-navigation-menu', selector: 'nav', fallback: 'Navigation' },
  { tag: 'lr-app-rail', selector: '[role="navigation"]', fallback: 'Navigation' },
];

async function build(tag: string, attrs: Record<string, string>): Promise<HTMLElement> {
  const host = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) host.setAttribute(name, value);
  return fixture<HTMLElement>(host);
}

describe('blank and whitespace-only labels on layout landmarks', () => {
  for (const { tag, selector, fallback } of CASES) {
    for (const [source, attrs] of [
      ['label', { label: '   ' }],
      ['aria-label', { 'aria-label': '   ' }],
    ] as const) {
      it(`<${tag}> ${source}="   " falls back instead of naming the role with whitespace`, async () => {
        const host = await build(tag, attrs);
        await (host as unknown as { updateComplete: Promise<unknown> }).updateComplete;
        const target = host.shadowRoot!.querySelector(selector);
        expect(target, 'role owner rendered').to.not.equal(null);
        const name = target!.getAttribute('aria-label');
        if (fallback === null) expect(name).to.equal(null);
        else expect(name).to.equal(fallback);
      });
    }
  }

  it('<lr-segmented> ignores a whitespace label for the radiogroup name', async () => {
    const host = await build('lr-segmented', { label: '   ' });
    await waitUntil(() => host.shadowRoot!.querySelector('[role="radiogroup"]'));
    expect(host.shadowRoot!.querySelector('[role="radiogroup"]')!.getAttribute('aria-label')).to.equal(null);
  });

  it('keeps an explicitly empty host aria-label as the documented landmark opt-out', async () => {
    const host = await build('lr-navigation-menu', { 'aria-label': '' });
    expect(host.shadowRoot!.querySelector('nav')!.getAttribute('aria-label')).to.equal('');
  });
});
