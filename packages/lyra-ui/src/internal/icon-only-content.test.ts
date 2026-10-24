import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { hasIconOnlyDefaultContent, IconOnlyLabelObserver } from './icon-only-content.js';
import { tag } from './prefix.js';

it('IconOnlyLabelObserver follows a replaced label element', async () => {
  const stage = await fixture<HTMLDivElement>(html`<div><div><i></i></div><div></div></div>`);
  const [host, labels] = [...stage.children] as HTMLElement[];
  const makeLabel = (): HTMLElement => {
    const el = document.createElement('span');
    el.style.cssText = 'display: inline-block; inline-size: 10px; block-size: 10px';
    labels!.append(el);
    return el;
  };
  let label = makeLabel();
  const changes: boolean[] = [];
  const observer = new IconOnlyLabelObserver(host!, () => label, () => false, next => changes.push(next));
  observer.arm();
  await waitUntil(() => changes.length === 1);
  label = makeLabel();
  observer.arm();
  await waitUntil(() => changes.length === 2, 'the replacement label is observed');
  observer.disarm();
  expect(changes).to.deep.equal([true, true]);
});

describe('hasIconOnlyDefaultContent', () => {
  const hostOf = async (markup: ReturnType<typeof html>): Promise<HTMLElement> => fixture<HTMLElement>(markup);

  it('is true for exactly one visible textless element and false for every other shape', async () => {
    expect(hasIconOnlyDefaultContent(await hostOf(html`<div><i></i></div>`))).to.equal(true);
    expect(hasIconOnlyDefaultContent(await hostOf(html`<div></div>`)), 'no content at all').to.equal(false);
    expect(hasIconOnlyDefaultContent(await hostOf(html`<div><i></i><b></b></div>`)), 'two visible elements').to.equal(false);
    expect(hasIconOnlyDefaultContent(await hostOf(html`<div><i></i> label</div>`)), 'direct text').to.equal(false);
    expect(hasIconOnlyDefaultContent(await hostOf(html`<div><i>glyph</i></div>`)), 'text inside the element').to.equal(false);
  });

  it('does not count slotted, hidden, clipped or visually-hidden siblings as content', async () => {
    expect(hasIconOnlyDefaultContent(await hostOf(html`<div><i></i><span slot="end">Named</span></div>`))).to.equal(true);
    expect(hasIconOnlyDefaultContent(await hostOf(html`<div><i></i><span hidden>Name</span></div>`))).to.equal(true);
    expect(hasIconOnlyDefaultContent(await hostOf(html`<div><i></i><span style="visibility: hidden">Name</span></div>`))).to.equal(true);
    expect(hasIconOnlyDefaultContent(await hostOf(html`<div><i></i><span style="position: absolute; clip-path: inset(50%)">Name</span></div>`))).to.equal(true);
    const host = await hostOf(html`<div><i></i></div>`);
    host.append(document.createElement(tag('visually-hidden')));
    expect(hasIconOnlyDefaultContent(host), 'the visually-hidden element is recognised by tag').to.equal(true);
    expect(hasIconOnlyDefaultContent(await hostOf(html`<div><i></i><span style="position: absolute">Name</span></div>`)), 'absolute but not clipped is visible').to.equal(false);
  });

  it('treats elements of a document without a browsing context as visible', () => {
    const ownerless = document.implementation.createHTMLDocument('ownerless');
    const host = ownerless.body.appendChild(ownerless.createElement('div'));
    host.append(ownerless.createElement('i'));
    expect(hasIconOnlyDefaultContent(host)).to.equal(true);
    host.append(ownerless.createElement('b'));
    expect(hasIconOnlyDefaultContent(host)).to.equal(false);
  });

  it('answers from the children alone for a host without light-DOM node access', () => {
    const icon = document.createElement('i');
    expect(hasIconOnlyDefaultContent({ children: [icon] } as unknown as Element)).to.equal(true);
    expect(hasIconOnlyDefaultContent({} as unknown as Element)).to.equal(false);
  });

  it('does not arm a label observer in a document without a browsing context', () => {
    const ownerless = document.implementation.createHTMLDocument('ownerless');
    const host = ownerless.body.appendChild(ownerless.createElement('div'));
    const label = host.appendChild(ownerless.createElement('span'));
    const changes: boolean[] = [];
    const observer = new IconOnlyLabelObserver(host, () => label, () => false, next => changes.push(next));
    expect(() => observer.arm()).to.not.throw();
    observer.disarm();
    expect(changes).to.deep.equal([]);
  });
});
