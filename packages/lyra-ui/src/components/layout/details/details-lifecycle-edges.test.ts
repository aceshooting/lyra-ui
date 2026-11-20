import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-accordion.js';
import '../../lr-accordion-item.js';
import '../../lr-details.js';
import type { LyraAccordion } from './accordion.class.js';
import type { LyraAccordionItem } from './accordion-item.class.js';
import type { LyraDetails } from './details.class.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

const quickMotion = '--show-duration: 1ms; --hide-duration: 1ms;';

function buttonFor(item: LyraAccordionItem): HTMLButtonElement {
  return item.shadowRoot!.querySelector<HTMLButtonElement>('[part~="button"]')!;
}

function gateFor(el: LyraDetails): HTMLElement {
  return el.shadowRoot!.querySelector<HTMLElement>('[part="content"]')!.parentElement!;
}

describe('lr-accordion-item edges', () => {
  it('ignores a same-value expanded write without emitting a toggle request', async () => {
    const accordion = await fixture<LyraAccordion>(html`<lr-accordion>
      <lr-accordion-item label="One" style=${quickMotion}>First</lr-accordion-item>
    </lr-accordion>`);
    const item = accordion.querySelector<LyraAccordionItem>('lr-accordion-item')!;
    await item.updateComplete;
    let requests = 0;
    accordion.addEventListener('lr-toggle-request', () => (requests += 1));
    item.expanded = false;
    await item.updateComplete;
    expect(requests).to.equal(0);
    expect(item.hasAttribute('expanded')).to.equal(false);
  });

  it('falls back to a host click before the item has rendered', () => {
    const item = document.createElement('lr-accordion-item') as LyraAccordionItem;
    let clicks = 0;
    item.addEventListener('click', (event) => {
      if (event.target === item) clicks += 1;
    });
    item.click();
    expect(clicks).to.equal(1);
    expect(item.expanded).to.equal(false);
  });

  it('forwards click() to the rendered trigger', async () => {
    const accordion = await fixture<LyraAccordion>(html`<lr-accordion mode="multiple">
      <lr-accordion-item label="One" style=${quickMotion}>First</lr-accordion-item>
    </lr-accordion>`);
    const item = accordion.querySelector<LyraAccordionItem>('lr-accordion-item')!;
    await item.updateComplete;
    item.click();
    await waitUntil(() => item.expanded, 'the trigger click expands the item');
    expect(buttonFor(item).getAttribute('aria-expanded')).to.equal('true');
  });

  it('ignores a trigger activation that races a synchronous disable', async () => {
    const accordion = await fixture<LyraAccordion>(html`<lr-accordion>
      <lr-accordion-item label="One" style=${quickMotion}>First</lr-accordion-item>
    </lr-accordion>`);
    const item = accordion.querySelector<LyraAccordionItem>('lr-accordion-item')!;
    await item.updateComplete;
    item.disabled = true;
    // The trigger has not re-rendered as disabled yet, so the native click still dispatches.
    buttonFor(item).click();
    await item.updateComplete;
    expect(item.expanded).to.equal(false);
    expect(buttonFor(item).disabled).to.equal(true);
  });

  it('renders a level-one heading around the trigger', async () => {
    const item = await fixture<LyraAccordionItem>(
      html`<lr-accordion-item label="Top" heading-level="1">Body</lr-accordion-item>`
    );
    const heading = item.shadowRoot!.querySelector('[part="heading"]')!;
    expect(heading.localName).to.equal('h1');
    expect(heading.contains(buttonFor(item))).to.equal(true);
  });
});

describe('lr-accordion edges', () => {
  it('survives a reconnect that is undone before its rebind microtask runs', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div><lr-accordion>
      <lr-accordion-item id="a" label="A" style=${quickMotion}>A</lr-accordion-item>
      <lr-accordion-item id="b" label="B" style=${quickMotion}>B</lr-accordion-item>
    </lr-accordion></div>`);
    const accordion = wrapper.querySelector<LyraAccordion>('lr-accordion')!;
    await accordion.updateComplete;
    accordion.remove();
    wrapper.append(accordion);
    accordion.remove();
    await Promise.resolve();
    await Promise.resolve();
    wrapper.append(accordion);
    await waitUntil(() => {
      const [a] = accordion.querySelectorAll<LyraAccordionItem>('lr-accordion-item');
      return buttonFor(a!).tabIndex === 0;
    }, 'the final reconnect rebinds the items');
    const [a, b] = [...accordion.querySelectorAll<LyraAccordionItem>('lr-accordion-item')];
    await focusByKeyboard(buttonFor(a!));
    buttonFor(a!).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
    expect(b!.shadowRoot!.activeElement === buttonFor(b!)).to.equal(true);
  });

  it('leaves unrelated keys on a trigger to the page', async () => {
    const accordion = await fixture<LyraAccordion>(html`<lr-accordion>
      <lr-accordion-item label="A" style=${quickMotion}>A</lr-accordion-item>
      <lr-accordion-item label="B" style=${quickMotion}>B</lr-accordion-item>
    </lr-accordion>`);
    const [a] = [...accordion.querySelectorAll<LyraAccordionItem>('lr-accordion-item')];
    await a!.updateComplete;
    await focusByKeyboard(buttonFor(a!));
    const event = new KeyboardEvent('keydown', { key: 'x', bubbles: true, composed: true, cancelable: true });
    buttonFor(a!).dispatchEvent(event);
    expect(event.defaultPrevented).to.equal(false);
    expect(a!.shadowRoot!.activeElement === buttonFor(a!)).to.equal(true);
  });

  it('announces only the settled state when an expansion is reversed mid-motion', async () => {
    const accordion = await fixture<LyraAccordion>(html`<lr-accordion mode="multiple">
      <lr-accordion-item label="A" style="--show-duration: 200ms; --hide-duration: 1ms;">A</lr-accordion-item>
    </lr-accordion>`);
    const item = accordion.querySelector<LyraAccordionItem>('lr-accordion-item')!;
    await item.updateComplete;
    const settled: string[] = [];
    accordion.addEventListener('lr-after-expand', () => settled.push('expand'));
    accordion.addEventListener('lr-after-collapse', () => settled.push('collapse'));
    const expanding = item.expand();
    await item.updateComplete;
    await item.collapse();
    await expanding;
    await waitUntil(() => settled.includes('collapse'), 'the collapse settles');
    expect(item.expanded).to.equal(false);
    expect(settled).to.not.include('expand');
  });
});

describe('lr-details edges', () => {
  it('treats redundant open writes and calls as no-ops without lifecycle events', async () => {
    const el = await fixture<LyraDetails>(html`<lr-details summary="S" style=${quickMotion}>Body</lr-details>`);
    const events: string[] = [];
    for (const name of ['lr-show', 'lr-hide']) el.addEventListener(name, () => events.push(name));
    el.open = false;
    await el.hide();
    expect(events).to.deep.equal([]);
    await el.show();
    expect(events).to.deep.equal(['lr-show']);
    el.open = true;
    await el.show();
    expect(events).to.deep.equal(['lr-show']);
    expect(el.open).to.equal(true);
  });

  it('reverts a live rename into a group whose open peer vetoes its close', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div>
      <lr-details id="a" name="first" open summary="A" style=${quickMotion}>A</lr-details>
      <lr-details id="b" name="second" open summary="B" style=${quickMotion}>B</lr-details>
    </div>`);
    const a = wrapper.querySelector<LyraDetails>('#a')!;
    const b = wrapper.querySelector<LyraDetails>('#b')!;
    await Promise.all([a.updateComplete, b.updateComplete]);
    b.addEventListener('lr-hide', (event) => event.preventDefault());
    a.name = 'second';
    await a.updateComplete;
    await a.updateComplete;
    expect(a.name).to.equal('first');
    expect(a.open).to.equal(true);
    expect(b.open).to.equal(true);
  });

  it('keeps a closed panel findable after adoption into another document and back', async () => {
    const el = await fixture<LyraDetails>(html`<lr-details summary="S" style=${quickMotion}>Body</lr-details>`);
    const parent = el.parentElement!;
    const other = document.implementation.createHTMLDocument('other');
    other.body.append(el);
    expect(el.ownerDocument === other).to.equal(true);
    parent.append(el);
    await el.updateComplete;
    expect(gateFor(el).getAttribute('hidden')).to.equal('until-found');
    await el.show();
    other.body.append(el);
    parent.append(el);
    await el.updateComplete;
    expect(el.open).to.equal(true);
    expect(gateFor(el).hasAttribute('hidden'), 'an open panel stays revealed across adoption').to.equal(false);
  });

  it('ignores a fragment that names the disclosure itself or content outside it', async () => {
    const originalUrl = window.location.href;
    const ownId = `own-details-${Math.random().toString(36).slice(2)}`;
    const outsideId = `outside-details-${Math.random().toString(36).slice(2)}`;
    try {
      window.history.replaceState(window.history.state, '', `#${ownId}`);
      const wrapper = await fixture<HTMLDivElement>(html`<div>
        <span id=${outsideId}>Outside</span>
        <lr-details id=${ownId} summary="Self">Body</lr-details>
      </div>`);
      const el = wrapper.querySelector<LyraDetails>('lr-details')!;
      await el.updateComplete;
      await Promise.resolve();
      expect(el.open, 'the host id is not a default-slot target').to.equal(false);
      window.history.replaceState(window.history.state, '', `#${outsideId}`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      await el.updateComplete;
      expect(el.open, 'an element outside the disclosure does not reveal it').to.equal(false);
    } finally {
      window.history.replaceState(window.history.state, '', originalUrl);
    }
  });
});
