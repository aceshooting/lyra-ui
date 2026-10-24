import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import type { LyraXmlViewer } from './xml-viewer.class.js';
import './xml-viewer.js';

for (const xml of ['<root>unfinished text', '<root><!--unfinished', '<root><![CDATA[unfinished', '<root><child attr="unfinished']) {
  it(`rejects truncated XML ${JSON.stringify(xml)} and recovers without a stale tree`, async () => {
    const element = await fixture<LyraXmlViewer>(html`<lr-xml-viewer
      .xml=${'<old />'} .strings=${{ xmlViewerParseError: 'Malformed document' }}
    ></lr-xml-viewer>`);
    const failed = oneEvent(element, 'lr-render-error');
    element.xml = xml;
    const event = await failed;
    await element.updateComplete;
    expect(event.bubbles && event.composed).to.equal(true);
    expect(element.shadowRoot!.querySelector('[part="error"]')?.textContent).to.equal('Malformed document');
    expect(element.shadowRoot!.querySelectorAll('[part="node"]').length).to.equal(0);
    element.xml = '<recovered><item>visible</item></recovered>';
    await element.updateComplete;
    expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
    expect(element.shadowRoot!.querySelector('[part="tag"]')?.textContent).to.equal('recovered');
    expect(await element.search('visible')).to.equal(1);
  });
}

it('renders a bounded expanded XML tree and restores all rows when its public row limit increases', async () => {
  const element = await fixture<LyraXmlViewer>(html`<lr-xml-viewer
    .xml=${'<root>\n  <first/>\n  <second/>\n</root>'} .maxRows=${1} .expandDepth=${10}
    .strings=${{ xmlViewerLimit: 'More rows are available' }}
  ></lr-xml-viewer>`);
  expect(element.shadowRoot!.querySelectorAll('[part="node"]').length).to.equal(1);
  expect(element.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.contain('More rows are available');
  element.maxRows = 10;
  await element.updateComplete;
  expect(element.shadowRoot!.querySelectorAll('[part="node"]').length).to.equal(3);
  expect(element.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(0);
  expect(Array.from(element.shadowRoot!.querySelectorAll('[part="tag"]'), node => node.textContent)).to.deep.equal(['root', 'first', 'second']);
});

it('bounds XML highlight path resolution and restores independently activatable rows after a larger public budget', async () => {
  const element = await fixture<LyraXmlViewer>(html`<lr-xml-viewer
    .xml=${'<root><item/></root>'} .maxNodes=${3}
    .highlights=${[
      { id: 'first', anchor: { kind: 'node-path', path: [0] } },
      { id: 'repeat', anchor: { kind: 'node-path', path: [0] } },
      { id: 'root', anchor: { kind: 'node-path', path: [] } },
    ]}
  ></lr-xml-viewer>`);
  expect(element.shadowRoot!.querySelectorAll('[part="highlight-action"]').length).to.equal(1);
  expect(element.shadowRoot!.querySelector('[part="highlight-action"]')?.getAttribute('data-highlight-id')).to.equal('first');
  element.maxNodes = 10;
  await element.updateComplete;
  expect(element.shadowRoot!.querySelectorAll('[part="highlight-action"]').length).to.equal(2);
  const button = element.shadowRoot!.querySelector<HTMLButtonElement>('[part="highlight-action"][data-highlight-id="root"]')!;
  const activated = oneEvent(element, 'lr-highlight-activate');
  button.click();
  expect((await activated).detail).to.deep.equal({ highlightId: 'root' });
});

it('reports a lower-bound XML search after its attribute scan budget and restores exact search for a later document', async () => {
  const padding = 'x'.repeat(60_000);
  const attributes = Array.from({ length: 70 }, (_, index) => `a${index}="${padding}"`).join(' ');
  const element = await fixture<LyraXmlViewer>(html`<lr-xml-viewer expand-depth="0"
    .xml=${`<root first="needle"><branch><payload ${attributes}/></branch></root>`}
  ></lr-xml-viewer>`);
  expect(element.shadowRoot!.querySelectorAll('[part="node"]').length).to.equal(1);
  const changed = oneEvent(element, 'lr-search-change');
  expect(await element.search('needle')).to.equal(1);
  expect((await changed).detail).to.deep.include({ query: 'needle', matchCount: 1, matchCountExact: false, activeIndex: 0 });
  expect(element.shadowRoot!.querySelectorAll('[part="node"][data-active-match]').length).to.equal(1);
  expect(Array.from(element.shadowRoot!.querySelectorAll('[part="tag"]'), node => node.textContent)).to.deep.equal(['root', 'branch']);
  expect(Array.from(element.shadowRoot!.querySelectorAll('[part="attribute-value"]'), node => node.textContent)).to.deep.equal(['needle']);
  element.xml = '<root><item>needle</item></root>';
  await element.updateComplete;
  const recovered = oneEvent(element, 'lr-search-change');
  expect(await element.search('needle')).to.equal(1);
  expect((await recovered).detail).to.deep.include({ matchCount: 1, matchCountExact: true, activeIndex: 0 });
  expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
});
