import { expect, fixture, html } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { resetMouse, sendMouse } from '../../test/wtr-mouse.js';
import { focusAfterPointer, focusByKeyboard } from '../../test/wtr-focus.js';
import { isKeyboardFocusEvent, lastInputModality, trackInputModality } from './focus-modality.js';
import '../components/overlays/overlay/tooltip.js';

before(() => trackInputModality(document));

async function clickCenter(target: Element): Promise<void> {
  const rect = target.getBoundingClientRect();
  await sendMouse({
    type: 'click',
    position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
  });
  await resetMouse();
}

/** Records the predicate's verdict for every `focusin` reaching `listenOn`. */
function recordFocus(listenOn: EventTarget): { results: boolean[]; stop(): void } {
  const results: boolean[] = [];
  const listener = (event: Event): void => {
    results.push(isKeyboardFocusEvent(event));
  };
  listenOn.addEventListener('focusin', listener);
  return { results, stop: () => listenOn.removeEventListener('focusin', listener) };
}

async function freshFrame(): Promise<{ frame: HTMLIFrameElement; doc: Document; view: Window }> {
  const frame = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
  const doc = frame.contentDocument;
  const view = frame.contentWindow;
  if (!doc || !view) throw new Error('The iframe document was unavailable.');
  return { frame, doc, view };
}

function blurActive(): void {
  (document.activeElement as HTMLElement | null)?.blur?.();
}

describe('focus-modality recorder', () => {
  it('M1 arms once on the window, never on the document, and skips a viewless document', async () => {
    const { doc, view } = await freshFrame();
    const windowTypes: string[] = [];
    const documentTypes: string[] = [];
    const originalWindowAdd = view.addEventListener;
    const originalDocumentAdd = doc.addEventListener;
    view.addEventListener = function (this: Window, type: string, ...rest: unknown[]) {
      windowTypes.push(type);
      return (originalWindowAdd as (...args: unknown[]) => void).call(this, type, ...rest);
    } as typeof view.addEventListener;
    doc.addEventListener = function (this: Document, type: string, ...rest: unknown[]) {
      documentTypes.push(type);
      return (originalDocumentAdd as (...args: unknown[]) => void).call(this, type, ...rest);
    } as typeof doc.addEventListener;
    try {
      trackInputModality(doc);
      trackInputModality(doc);
    } finally {
      view.addEventListener = originalWindowAdd;
      doc.addEventListener = originalDocumentAdd;
    }
    expect(windowTypes.slice().sort()).to.deep.equal(['blur', 'keydown', 'pointerdown']);
    expect(documentTypes).to.deep.equal([]);

    const inert = document.implementation.createHTMLDocument('inert');
    expect(() => trackInputModality(inert)).not.to.throw();
    expect(lastInputModality(inert)).to.equal('unknown');
    expect(lastInputModality(null)).to.equal('unknown');
  });

  it('M2 records keys and presses, ignoring composition and bare modifiers, per document', async () => {
    const el = await fixture<HTMLDivElement>(html`<div><button>a</button><button>b</button></div>`);
    const [a] = Array.from(el.querySelectorAll('button'));
    a!.focus();
    await sendKeys({ press: 'Tab' });
    expect(lastInputModality(document)).to.equal('keyboard');

    await clickCenter(a!);
    expect(lastInputModality(document)).to.equal('pointer');

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, isComposing: true }));
    const legacy = new KeyboardEvent('keydown', { key: 'Unidentified', bubbles: true });
    Object.defineProperty(legacy, 'keyCode', { value: 229 });
    document.body.dispatchEvent(legacy);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', bubbles: true }));
    expect(lastInputModality(document), 'composition and bare modifiers are not counted').to.equal('pointer');

    el.querySelectorAll('button')[1]!.focus();
    await sendKeys({ press: 'Shift+Tab' });
    expect(lastInputModality(document)).to.equal('keyboard');

    const { doc, view } = await freshFrame();
    trackInputModality(doc);
    doc.body.dispatchEvent(new view.KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(lastInputModality(doc)).to.equal('keyboard');
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(lastInputModality(document)).to.equal('pointer');
    expect(lastInputModality(doc), 'documents are isolated').to.equal('keyboard');
  });
});

describe('isKeyboardFocusEvent', () => {
  it('M3 answers the truth table', async () => {
    const el = await fixture<HTMLDivElement>(html`
      <div>
        <button id="start">start</button>
        <button id="next">next</button>
        <input id="field" type="text" aria-label="Field" />
        <label id="label" for="labelled">Labelled</label>
        <input id="labelled" type="text" />
        <button id="unfocused">unfocused</button>
        <x-plain-custom id="custom">custom</x-plain-custom>
      </div>
    `);
    const byId = (id: string) => el.querySelector<HTMLElement>(`#${id}`)!;
    const recorder = recordFocus(el);
    try {
      byId('start').focus();
      recorder.results.length = 0;
      await sendKeys({ press: 'Tab' });
      expect(recorder.results, 'keyboard Tab onto a button').to.deep.equal([true]);

      blurActive();
      recorder.results.length = 0;
      await clickCenter(byId('next'));
      expect(recorder.results, 'pointer click on a button').to.deep.equal([false]);

      recorder.results.length = 0;
      await clickCenter(byId('field'));
      expect(recorder.results, 'pointer click into a text field').to.deep.equal([false]);

      recorder.results.length = 0;
      await clickCenter(byId('label'));
      expect(recorder.results, 'label click that focuses a text field').to.deep.equal([false]);
      expect(document.activeElement === byId('labelled'), 'the label moved focus').to.equal(true);

      byId('start').focus();
      await sendKeys({ press: 'Tab' });
      recorder.results.length = 0;
      byId('unfocused').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      byId('custom').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      expect(recorder.results, 'synthetic focusin on unfocused elements').to.deep.equal([false, false]);
    } finally {
      recorder.stop();
    }
    expect(isKeyboardFocusEvent(new FocusEvent('focus')), 'no element in the path').to.equal(false);

    const { doc } = await freshFrame();
    trackInputModality(doc);
    doc.body.innerHTML = '<button>fresh</button>';
    const fresh = recordFocus(doc);
    try {
      doc.querySelector('button')!.focus();
      expect(fresh.results, 'fresh document plus script focus').to.deep.equal([true]);
    } finally {
      fresh.stop();
    }
  });

  it('M4 lets modality decide for a focused closed-root host', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
    const host = document.createElement('x-closed-host');
    const inner = document.createElement('button');
    inner.textContent = 'inner';
    host.attachShadow({ mode: 'closed' }).append(inner);
    wrapper.append(host);
    const recorder = recordFocus(host);
    try {
      await focusByKeyboard(inner);
      expect(recorder.results, 'keyboard focus inside a closed root').to.deep.equal([true]);
      blurActive();
      recorder.results.length = 0;
      await focusAfterPointer(inner);
      expect(recorder.results, 'pointer-then-script focus inside a closed root').to.deep.equal([false]);
    } finally {
      recorder.stop();
      inner.blur();
    }

    const { doc } = await freshFrame();
    trackInputModality(doc);
    const frameHost = doc.createElement('x-closed-host');
    const frameInner = doc.createElement('button');
    frameHost.attachShadow({ mode: 'closed' }).append(frameInner);
    doc.body.append(frameHost);
    const fresh = recordFocus(frameHost);
    try {
      frameInner.focus();
      expect(fresh.results, 'unknown modality, closed root').to.deep.equal([true]);
    } finally {
      fresh.stop();
    }
  });

  it('M5 fails open when :focus-visible throws, but never for pointer or unfocused targets', async () => {
    const el = await fixture<HTMLDivElement>(html`<div><button id="a">a</button><button id="b">b</button></div>`);
    const b = el.querySelector<HTMLButtonElement>('#b')!;
    const original = Element.prototype.matches;
    const recorder = recordFocus(el);
    Element.prototype.matches = function (this: Element, selector: string): boolean {
      if (selector === ':focus-visible') throw new SyntaxError('unsupported selector');
      return original.call(this, selector);
    } as typeof Element.prototype.matches;
    try {
      await focusByKeyboard(b);
      blurActive();
      await focusAfterPointer(b);
      blurActive();
      b.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    } finally {
      Element.prototype.matches = original;
      recorder.stop();
    }
    expect(recorder.results).to.deep.equal([true, false, false]);
  });

  it('M6 arms the owner window when a Lyra element connects, including after adoption into a frame', async () => {
    const { doc, view } = await freshFrame();
    doc.body.dispatchEvent(new view.KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(lastInputModality(doc), 'an unarmed frame records nothing').to.equal('unknown');
    const tooltip = document.createElement('lr-tooltip');
    document.body.append(tooltip);
    try {
      doc.body.append(tooltip);
      doc.body.dispatchEvent(new view.KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      expect(lastInputModality(doc)).to.equal('keyboard');
    } finally {
      tooltip.remove();
    }
  });

  it('M7 resets to unknown on the window blur only', async () => {
    const el = await fixture<HTMLDivElement>(html`
      <div>
        <button id="start">start</button>
        <button id="opener" @mousedown=${(event: Event) => event.preventDefault()}>open</button>
        <button id="trigger">trigger</button>
      </div>
    `);
    const start = el.querySelector<HTMLButtonElement>('#start')!;
    const opener = el.querySelector<HTMLButtonElement>('#opener')!;
    const trigger = el.querySelector<HTMLButtonElement>('#trigger')!;
    const recorder = recordFocus(trigger);
    try {
      // The opener takes no focus, so the engine keeps reporting the script focus that follows as
      // `:focus-visible` (the "click does not focus" shape); only the recorder can refuse it.
      // Control: without the reset, script focus after the press is not keyboard focus.
      await focusByKeyboard(start);
      await clickCenter(opener);
      expect(lastInputModality(document)).to.equal('pointer');
      trigger.focus();
      expect(trigger.matches(':focus-visible'), 'the engine reports the ring').to.equal(true);

      await focusByKeyboard(start);
      await clickCenter(opener);
      trigger.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
      expect(lastInputModality(document), 'a bubbling element blur does not reset').to.equal('pointer');
      window.dispatchEvent(new FocusEvent('blur'));
      expect(lastInputModality(document)).to.equal('unknown');
      trigger.focus();
    } finally {
      recorder.stop();
      trigger.blur();
    }
    expect(recorder.results).to.deep.equal([false, true]);
  });

  it('M8 records the key before a document-capture handler moves focus', async () => {
    const el = await fixture<HTMLDivElement>(html`<div><button id="start">start</button><button id="target">t</button></div>`);
    const start = el.querySelector<HTMLButtonElement>('#start')!;
    const target = el.querySelector<HTMLButtonElement>('#target')!;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Enter') target.focus();
    };
    document.addEventListener('keydown', onKey, true);
    const recorder = recordFocus(target);
    try {
      await clickCenter(start);
      expect(lastInputModality(document)).to.equal('pointer');
      await sendKeys({ press: 'Enter' });
    } finally {
      document.removeEventListener('keydown', onKey, true);
      recorder.stop();
      target.blur();
    }
    expect(recorder.results).to.deep.equal([true]);
  });
});
