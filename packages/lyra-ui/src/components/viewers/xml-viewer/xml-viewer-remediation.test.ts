import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './xml-viewer.js';
import type { LyraXmlViewer } from './xml-viewer.js';

function node(viewer: LyraXmlViewer, tagName: string): HTMLElement | undefined {
  return [...viewer.shadowRoot!.querySelectorAll<HTMLElement>('[part="node"]')]
    .find((row) => row.querySelector('[part="tag"]')?.textContent === tagName);
}

async function collapse(viewer: LyraXmlViewer, tagName: string) {
  const toggle = node(viewer, tagName)?.querySelector<HTMLButtonElement>('[part="toggle"]');
  expect(toggle?.getAttribute('aria-expanded'), `${tagName} starts expanded`).to.equal('true');
  toggle!.click();
  await viewer.updateComplete;
  expect(node(viewer, tagName)?.querySelector('[part="toggle"]')?.getAttribute('aria-expanded')).to.equal('false');
}

for (const method of ['search', 'searchNext', 'searchPrevious'] as const) {
  it(`${method} reopens only the active match path after manual collapse and reveals its text`, async () => {
    const padding = Array.from({ length: 30 }, (_, index) => `<padding>${index}</padding>`).join('');
    const viewer = await fixture<LyraXmlViewer>(html`<lr-xml-viewer max-height="180px"
      style="inline-size: 400px"
      .xml=${`<root>${padding}<branchA><hitA>needle one</hitA></branchA>${padding}<branchB><hitB>needle two</hitB></branchB></root>`}
    ></lr-xml-viewer>`);
    await viewer.updateComplete;
    if (method !== 'search') expect(await viewer.search('needle')).to.equal(2);
    for (const tagName of ['hitA', 'hitB', 'branchA', 'branchB', 'root']) await collapse(viewer, tagName);
    expect(viewer.shadowRoot!.querySelectorAll('[data-active-match]').length).to.equal(0);

    if (method === 'search') expect(await viewer.search('needle')).to.equal(2);
    else expect(await viewer[method]()).to.equal(true);
    const selected = method === 'search' ? 'A' : 'B';
    const other = selected === 'A' ? 'B' : 'A';
    const active = viewer.shadowRoot!.querySelector<HTMLElement>('[data-active-match]');
    expect(active?.querySelector('[part="tag"]')?.textContent).to.equal(`hit${selected}`);
    expect(active?.querySelector('[part="toggle"]')?.getAttribute('aria-expanded')).to.equal('true');
    expect(node(viewer, `branch${other}`)?.querySelector('[part="toggle"]')?.getAttribute('aria-expanded')).to.equal('false');
    expect([...viewer.shadowRoot!.querySelectorAll('[part="text"]')].some((row) => row.textContent === `needle ${selected === 'A' ? 'one' : 'two'}`)).to.equal(true);
    await waitUntil(() => {
      const base = viewer.shadowRoot!.querySelector('[part="base"]')!.getBoundingClientRect();
      const rect = active!.getBoundingClientRect();
      return rect.top >= base.top && rect.bottom <= base.bottom;
    }, 'successful search navigation did not bring the selected row into the visible allocation');

    await collapse(viewer, `branch${selected}`);
    viewer.collapsedDepth = 1;
    await viewer.updateComplete;
    expect(viewer.shadowRoot!.querySelectorAll('[data-active-match]').length).to.equal(0);
    expect(node(viewer, `branch${selected}`)?.querySelector('[part="toggle"]')?.getAttribute('aria-expanded')).to.equal('false');
  });
}
