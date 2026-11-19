import { expect } from '@open-wc/testing';
import { anchorScrollBehavior, scrollToHeadingAnchor, scrollToResolvedRange } from './heading-anchor.js';

const created: Element[] = [];

function content(markup: string, doc: Document = document): HTMLElement {
  const root = doc.createElement('div');
  root.innerHTML = markup;
  doc.body.append(root);
  created.push(root);
  return root;
}

/** Records which element scrolled, and how, without moving the page. */
function scrollSpy(root: Element): Array<[string, ScrollIntoViewOptions]> {
  const calls: Array<[string, ScrollIntoViewOptions]> = [];
  for (const element of [root, ...root.querySelectorAll('*')]) {
    (element as HTMLElement).scrollIntoView = (options?: boolean | ScrollIntoViewOptions) => {
      calls.push([element.getAttribute('data-name') ?? element.localName, typeof options === 'object' ? options : {}]);
    };
  }
  return calls;
}

afterEach(() => {
  for (const element of created.splice(0)) element.remove();
});

const outline = (...ids: string[]) => ids.map((id) => ({ id }));

describe('scrollToHeadingAnchor', () => {
  it('scrolls to the heading carrying the id, ignoring other elements with that id', () => {
    const root = content('<p id="usage" data-name="paragraph">x</p><h2 data-name="intro">Intro</h2><h3 id="usage" data-name="usage">Usage</h3>');
    const calls = scrollSpy(root);
    expect(scrollToHeadingAnchor(root, outline('intro', 'usage'), 'usage')).to.equal(true);
    expect(calls.map(([name, options]) => [name, options.block])).to.deep.equal([['usage', 'start']]);
  });

  it('falls back to the heading at the same outline position when its id was stripped', () => {
    const root = content('<h1 data-name="first">A</h1><section><h2 data-name="second">B</h2></section><h2 data-name="third">C</h2>');
    const calls = scrollSpy(root);
    expect(scrollToHeadingAnchor(root, outline('a', 'b', 'c'), 'b')).to.equal(true);
    expect(calls.map(([name]) => name)).to.deep.equal(['second']);
  });

  it('reports false for an empty id, an id outside the outline or a missing heading', () => {
    const root = content('<h2 id="known">Known</h2>');
    const calls = scrollSpy(root);
    expect(scrollToHeadingAnchor(root, outline('known'), '')).to.equal(false);
    expect(scrollToHeadingAnchor(root, outline('known'), 'other')).to.equal(false);
    expect(scrollToHeadingAnchor(root, outline('known', 'gone'), 'gone')).to.equal(false);
    expect(calls.length).to.equal(0);
  });

  it('animates only when motion is allowed and the document has a window', () => {
    const root = content('<h2 id="moving" data-name="moving">Moving</h2>');
    const calls = scrollSpy(root);
    const expected = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    expect(anchorScrollBehavior(root)).to.equal(expected);
    scrollToHeadingAnchor(root, outline('moving'), 'moving');
    root.setAttribute('data-lr-motion', 'reduce');
    scrollToHeadingAnchor(root, outline('moving'), 'moving');
    expect(calls.map(([, options]) => options.behavior)).to.deep.equal([expected, 'auto']);

    const detached = document.implementation.createHTMLDocument('detached');
    const windowless = content('<h2 id="still">Still</h2>', detached);
    const still = scrollSpy(windowless);
    expect(scrollToHeadingAnchor(windowless, outline('still'), 'still')).to.equal(true);
    expect(still.map(([, options]) => options.behavior)).to.deep.equal(['auto']);
  });
});

describe('scrollToResolvedRange', () => {
  it('centres the element that holds the start of the range', () => {
    const root = content('<p data-name="para">one <em data-name="em">two</em></p>');
    const calls = scrollSpy(root);
    const text = root.querySelector('em')!.firstChild!;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 3);
    scrollToResolvedRange(root, range);
    const around = document.createRange();
    around.selectNodeContents(root.querySelector('p')!);
    scrollToResolvedRange(root, around);
    expect(calls.map(([name, options]) => [name, options.block])).to.deep.equal([['em', 'center'], ['para', 'center']]);
  });

  it('falls back to the content root for a range whose start has no parent element', () => {
    const root = content('<p>unused</p>');
    const calls = scrollSpy(root);
    const orphan = document.createRange();
    orphan.setStart(document.createTextNode('loose'), 0);
    scrollToResolvedRange(root, orphan);
    expect(calls.map(([name]) => name)).to.deep.equal(['div']);
  });
});
