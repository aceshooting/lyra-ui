import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../test/wtr-focus.js';
import '../components/lr-json-viewer.js';
import '../components/lr-xml-viewer.js';
import type { LyraJsonViewer } from '../components/lr-json-viewer.js';
import type { LyraXmlViewer } from '../components/lr-xml-viewer.js';

const activeLabel = (root: ShadowRoot): string | null => (root.activeElement as HTMLElement | null)?.getAttribute('aria-label') ?? null;

const cases = [
  {
    name: 'lr-json-viewer',
    mount: async () => (await fixture<HTMLDivElement>(html`<div><lr-json-viewer copyable .data=${{ a: { b: 1 }, c: [1, 2] }}></lr-json-viewer><button>after</button></div>`)),
  },
  {
    name: 'lr-xml-viewer',
    mount: async () => (await fixture<HTMLDivElement>(html`<div><lr-xml-viewer copyable .xml=${'<root><a><b/></a><c><d/></c></root>'}></lr-xml-viewer><button>after</button></div>`)),
  },
] as const;

for (const { name, mount } of cases) {
  it(`${name} makes its node controls one roving tab stop`, async () => {
    const wrapper = await mount();
    const el = wrapper.querySelector<LyraJsonViewer | LyraXmlViewer>(name)!;
    await el.updateComplete;
    const root = el.shadowRoot!;
    await waitUntil(() => root.querySelector('[part="tree"] [part~="toggle"]') !== null, 'the tree renders');
    await el.updateComplete;
    const tree = root.querySelector('[part="tree"]')!;
    const controls = Array.from(tree.querySelectorAll<HTMLElement>('[part~="toggle"]:not([hidden]), [part~="copy-button"]'));
    expect(controls.length > 4).to.equal(true);
    expect(controls.filter(control => control.tabIndex === 0).length).to.equal(1);
    const toggles = Array.from(tree.querySelectorAll<HTMLElement>('[part~="toggle"]:not([hidden])'));
    await focusByKeyboard(toggles[0]!);
    await sendKeys({ press: 'ArrowDown' });
    expect(activeLabel(root)).to.equal(toggles[1]!.getAttribute('aria-label'));
    await sendKeys({ press: 'ArrowRight' });
    expect(root.activeElement?.getAttribute('part')).to.equal('copy-button');
    await sendKeys({ press: 'ArrowLeft' });
    expect(activeLabel(root)).to.equal(toggles[1]!.getAttribute('aria-label'));
    expect(controls.filter(control => control.tabIndex === 0).length).to.equal(1);
    await sendKeys({ press: 'Tab' });
    expect(document.activeElement === wrapper.querySelector('button')).to.equal(true);
  });
}
