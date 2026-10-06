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
});
