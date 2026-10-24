import { expect, fixture, html } from '@open-wc/testing';
import { firstFormControlFocusTarget } from './form-control-focus-target.js';

describe('composed form-control focus targets', () => {
  for (const markup of [
    '<a href="#focus-target">Link</a>',
    '<audio controls></audio>',
    '<video controls></video>',
    '<object data="about:blank" style="width:32px;height:32px"></object>',
    '<details open><summary>Summary</summary></details>',
    '<div contenteditable="true">Editable text</div>',
  ]) {
    it(`recognizes a native sequential target in ${markup.split('>')[0]}>`, async () => {
      const host = await fixture<HTMLElement>(html`<div><button id="fallback">Fallback</button></div>`);
      const container = document.createElement('div');
      container.innerHTML = markup;
      const target = container.querySelector<HTMLElement>('summary') ?? container.firstElementChild as HTMLElement;
      target.id = 'native-target';
      host.prepend(container);
      expect(firstFormControlFocusTarget(host)?.id).to.equal('native-target');
    });
  }

  it('skips CSS-hidden subtrees and descendants of an already editable parent', async () => {
    const host = await fixture<HTMLElement>(html`<div>
      <div style="display:none"><button>Hidden</button></div>
      <div style="content-visibility:hidden"><button>Skipped</button></div>
      <div contenteditable="true" tabindex="-1"><span contenteditable="true">Nested editing surface</span></div>
      <button id="visible-target">Visible</button>
    </div>`);
    expect(firstFormControlFocusTarget(host)?.id).to.equal('visible-target');
  });

  it('reads ARIA exclusion tokens the way overlay focus does (ASCII case-insensitive, trimmed)', async () => {
    const host = await fixture<HTMLElement>(html`<div>
      <div aria-hidden=" TRUE "><button>Hidden from assistive technology</button></div>
      <div aria-disabled=" true"><button>Disabled group</button></div>
      <button id="available-target">Available</button>
    </div>`);
    expect(firstFormControlFocusTarget(host)?.id).to.equal('available-target');
  });

  it('uses rendered rectangles on older visibility APIs and skips targets whose visibility capability rejects', async () => {
    const host = await fixture<HTMLElement>(html`<div>
      <button id="unavailable-target">Unavailable</button><button id="legacy-target">Legacy</button>
    </div>`);
    const unavailable = host.querySelector<HTMLElement>('#unavailable-target')!;
    const legacy = host.querySelector<HTMLElement>('#legacy-target')!;
    Object.defineProperty(unavailable, 'checkVisibility', {
      configurable: true, value() { throw new TypeError('visibility unavailable'); },
    });
    Object.defineProperty(legacy, 'checkVisibility', { configurable: true, value: undefined });
    try {
      expect(firstFormControlFocusTarget(host)?.id).to.equal('legacy-target');
      legacy.style.display = 'none';
      expect(firstFormControlFocusTarget(host)?.id ?? null).to.equal(null);
    } finally {
      Reflect.deleteProperty(unavailable, 'checkVisibility');
      Reflect.deleteProperty(legacy, 'checkVisibility');
    }
  });

  it('returns a tabindex=1 target at once, ahead of earlier targets in document order', async () => {
    const host = await fixture<HTMLElement>(html`<div>
      <button id="natural">Natural</button><button id="late" tabindex="2">Second</button>
      <button id="first" tabindex="1">First</button><button id="after" tabindex="1">Also first</button>
    </div>`);
    expect(firstFormControlFocusTarget(host)?.id).to.equal('first');
  });

  it('puts positive tabindex targets ahead of natural order and keeps the lowest positive one', async () => {
    const host = await fixture<HTMLElement>(html`<div>
      <button id="natural">Natural</button><button id="three" tabindex="3">Three</button>
      <button id="two" tabindex="2">Two</button><button id="four" tabindex="4">Four</button>
    </div>`);
    expect(firstFormControlFocusTarget(host)?.id).to.equal('two');
    const naturalOnly = await fixture<HTMLElement>(html`<div><button id="a">A</button><button id="b" tabindex="0">B</button></div>`);
    expect(firstFormControlFocusTarget(naturalOnly)?.id, 'document order decides among natural targets').to.equal('a');
  });

  it('inspects an element reported twice by its slot only once', async () => {
    const host = await fixture<HTMLElement>(html`<div><button id="only">Only</button></div>`);
    const root = host.attachShadow({ mode: 'open' });
    const slot = root.appendChild(document.createElement('slot'));
    const button = host.querySelector('button')!;
    let reads = 0;
    Object.defineProperty(button, 'tabIndex', { configurable: true, get() { reads += 1; return 0; } });
    Object.defineProperty(slot, 'assignedElements', { value: () => [button, button] });
    try {
      expect(firstFormControlFocusTarget(host)?.id).to.equal('only');
      expect(reads, 'the repeated reference is skipped before a second tab-order read').to.equal(1);
    } finally {
      Reflect.deleteProperty(button, 'tabIndex');
    }
  });
});
