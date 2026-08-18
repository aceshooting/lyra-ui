import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './accordion.js';
import './accordion-item.js';
import './details.js';
import type { LyraAccordion } from './accordion.js';
import type { LyraAccordionItem } from './accordion-item.js';
import type { LyraDetails } from './details.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

const quickMotion = '--show-duration: 1ms; --hide-duration: 1ms;';

function buttonFor(item: LyraAccordionItem): HTMLButtonElement {
  return item.shadowRoot!.querySelector<HTMLButtonElement>('[part~="button"]')!;
}

async function renderAccordion(
  attributes = '',
): Promise<{ accordion: LyraAccordion; items: LyraAccordionItem[] }> {
  const wrapper = await fixture(html`<div>
    <lr-accordion data-attributes=${attributes}>
      <lr-accordion-item id="one" label="One" style=${quickMotion}>First</lr-accordion-item>
      <lr-accordion-item id="two" label="Two" style=${quickMotion}>Second</lr-accordion-item>
      <lr-accordion-item id="three" label="Three" style=${quickMotion}>Third</lr-accordion-item>
    </lr-accordion>
  </div>`);
  const accordion = wrapper.querySelector('lr-accordion') as LyraAccordion;
  if (attributes) {
    for (const [name, value = ''] of Array.from(attributes.matchAll(/([\w-]+)(?:="([^"]*)")?/g)).map(
      (match) => [match[1]!, match[2]],
    )) {
      accordion.setAttribute(name, value);
    }
    await accordion.updateComplete;
  }
  const items = [...accordion.querySelectorAll('lr-accordion-item')] as LyraAccordionItem[];
  await Promise.all(items.map((item) => item.updateComplete));
  return { accordion, items };
}

describe('<lr-accordion>', () => {
  it('inherits independent group/item appearance and item pointer-state paint', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="
        --lr-accordion-outlined-bg: rgb(1, 2, 3);
        --lr-accordion-outlined-border-color: rgb(4, 5, 6);
        --lr-accordion-filled-bg: rgb(7, 8, 9);
        --lr-accordion-filled-border-color: rgb(10, 11, 12);
        --lr-accordion-filled-outlined-bg: rgb(13, 14, 15);
        --lr-accordion-filled-outlined-border-color: rgb(16, 17, 18);
        --lr-accordion-item-outlined-bg: rgb(19, 20, 21);
        --lr-accordion-item-filled-bg: rgb(22, 23, 24);
        --lr-accordion-item-filled-outlined-bg: rgb(25, 26, 27);
        --lr-accordion-item-button-hover-bg: rgb(28, 29, 30);
        --lr-accordion-item-button-active-bg: rgb(31, 32, 33);
      ">
        <lr-accordion appearance="outlined"><lr-accordion-item label="Outlined">A</lr-accordion-item></lr-accordion>
        <lr-accordion appearance="filled"><lr-accordion-item label="Filled">B</lr-accordion-item></lr-accordion>
        <lr-accordion appearance="filled-outlined"><lr-accordion-item label="Filled outlined">C</lr-accordion-item></lr-accordion>
      </div>
    `);
    const accordions = [...wrapper.querySelectorAll('lr-accordion')] as LyraAccordion[];
    const items = [...wrapper.querySelectorAll('lr-accordion-item')] as LyraAccordionItem[];
    await Promise.all([...accordions, ...items].map((element) => element.updateComplete));
    const bases = accordions.map((accordion) =>
      accordion.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!,
    );
    const itemBases = items.map((item) =>
      item.shadowRoot!.querySelector<HTMLElement>('[part~="accordion-item"]')!,
    );

    expect(getComputedStyle(bases[0]!).backgroundColor).to.equal('rgb(1, 2, 3)');
    expect(getComputedStyle(bases[0]!).borderTopColor).to.equal('rgb(4, 5, 6)');
    expect(getComputedStyle(bases[1]!).backgroundColor).to.equal('rgb(7, 8, 9)');
    expect(getComputedStyle(bases[1]!).borderTopColor).to.equal('rgb(10, 11, 12)');
    expect(getComputedStyle(bases[2]!).backgroundColor).to.equal('rgb(13, 14, 15)');
    expect(getComputedStyle(bases[2]!).borderTopColor).to.equal('rgb(16, 17, 18)');
    expect(getComputedStyle(itemBases[0]!).backgroundColor).to.equal('rgb(19, 20, 21)');
    expect(getComputedStyle(itemBases[1]!).backgroundColor).to.equal('rgb(22, 23, 24)');
    expect(getComputedStyle(itemBases[2]!).backgroundColor).to.equal('rgb(25, 26, 27)');

    const button = buttonFor(items[0]!);
    button.scrollIntoView();
    const rect = button.getBoundingClientRect();
    try {
      await sendMouse({
        type: 'move',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      expect(getComputedStyle(button).backgroundColor).to.equal('rgb(28, 29, 30)');
      await sendMouse({ type: 'down' });
      expect(getComputedStyle(button).backgroundColor).to.equal('rgb(31, 32, 33)');
    } finally {
      await resetMouse();
    }
  });

  it('defaults to the Web Awesome-compatible multiple mode and propagates presentation', async () => {
    const { accordion, items } = await renderAccordion();

    expect(accordion.mode).to.equal('multiple');
    expect(accordion.getAttribute('mode')).to.equal('multiple');
    expect(accordion.iconPlacement).to.equal('end');
    expect(accordion.headingLevel).to.equal('3');
    expect(accordion.appearance).to.equal('outlined');

    accordion.iconPlacement = 'start';
    accordion.headingLevel = '2';
    accordion.appearance = 'filled';
    await accordion.updateComplete;
    await Promise.all(items.map((item) => item.updateComplete));

    // Group presentation is an owner context, not a destructive write to the child's authored
    // public state. This lets remove/reparent restore the item exactly.
    expect(items.map((item) => item.iconPlacement)).to.deep.equal(['end', 'end', 'end']);
    expect(items.map((item) => item.headingLevel)).to.deep.equal(['3', '3', '3']);
    expect(items.map((item) => item.appearance)).to.deep.equal(['outlined', 'outlined', 'outlined']);
    expect(items.map((item) =>
      item.shadowRoot!.querySelector('[part~="accordion-item"]')?.getAttribute('data-icon-placement'),
    )).to.deep.equal(['start', 'start', 'start']);
    expect(items.map((item) =>
      item.shadowRoot!.querySelector('[part~="accordion-item"]')?.getAttribute('data-appearance'),
    )).to.deep.equal(['filled', 'filled', 'filled']);
    expect(items.map((item) => item.shadowRoot!.querySelector('h2')?.localName)).to.deep.equal([
      'h2',
      'h2',
      'h2',
    ]);

    accordion.headingLevel = 'outside-range';
    await accordion.updateComplete;
    await Promise.all(items.map((item) => item.updateComplete));
    expect(items.map((item) => item.shadowRoot!.querySelector('h3')?.localName)).to.deep.equal([
      'h3',
      'h3',
      'h3',
    ]);
  });

  it('uses mode as the sole expansion-policy authority', async () => {
    const originalWarn = console.warn;
    console.warn = () => {};
    let accordion: LyraAccordion;
    try {
      accordion = (await fixture(html`<lr-accordion mode="single" multiple="false">
        <lr-accordion-item label="One">One</lr-accordion-item>
      </lr-accordion>`)) as LyraAccordion;
    } finally {
      console.warn = originalWarn;
    }
    await accordion.updateComplete;
    expect(accordion.mode).to.equal('single');
    expect('multiple' in accordion).to.equal(false);
    expect(accordion.getAttribute('multiple')).to.equal('false');

    accordion.mode = 'single-collapsible';
    await accordion.updateComplete;
    expect(accordion.mode).to.equal('single-collapsible');
    expect(accordion.getAttribute('mode')).to.equal('single-collapsible');
  });

  it('allows multiple expanded items in the default mode', async () => {
    const { accordion, items } = await renderAccordion();
    const firstAfter = oneEvent(accordion, 'lr-after-expand');
    buttonFor(items[0]!).click();
    await firstAfter;
    const secondAfter = oneEvent(accordion, 'lr-after-expand');
    buttonFor(items[1]!).click();
    await secondAfter;

    expect(items.map((item) => item.expanded)).to.deep.equal([true, true, false]);
  });

  it('enforces single and single-collapsible interaction semantics', async () => {
    const single = (await fixture(html`<lr-accordion mode="single">
      <lr-accordion-item id="single-one" label="One" expanded style=${quickMotion}>One</lr-accordion-item>
      <lr-accordion-item id="single-two" label="Two" style=${quickMotion}>Two</lr-accordion-item>
    </lr-accordion>`)) as LyraAccordion;
    const singleItems = [...single.querySelectorAll('lr-accordion-item')] as LyraAccordionItem[];
    buttonFor(singleItems[0]!).click();
    await singleItems[0]!.updateComplete;
    expect(singleItems[0]!.expanded).to.be.true;

    const expanded = oneEvent(single, 'lr-after-expand');
    buttonFor(singleItems[1]!).click();
    await expanded;
    expect(singleItems.map((item) => item.expanded)).to.deep.equal([false, true]);

    const collapsible = (await fixture(html`<lr-accordion mode="single-collapsible">
      <lr-accordion-item label="One" expanded style=${quickMotion}>One</lr-accordion-item>
      <lr-accordion-item label="Two" style=${quickMotion}>Two</lr-accordion-item>
    </lr-accordion>`)) as LyraAccordion;
    const collapsibleItem = collapsible.querySelector('lr-accordion-item') as LyraAccordionItem;
    const collapsed = oneEvent(collapsible, 'lr-after-collapse');
    buttonFor(collapsibleItem).click();
    await collapsed;
    expect(collapsibleItem.expanded).to.be.false;
  });

  it('runs and honors collapse lifecycle events before replacing the expanded single item', async () => {
    const accordion = (await fixture(html`<lr-accordion mode="single">
      <lr-accordion-item id="locked" label="Locked" expanded style=${quickMotion}>Locked</lr-accordion-item>
      <lr-accordion-item id="next" label="Next" style=${quickMotion}>Next</lr-accordion-item>
    </lr-accordion>`)) as LyraAccordion;
    const items = [...accordion.querySelectorAll('lr-accordion-item')] as LyraAccordionItem[];
    const lifecycle: string[] = [];
    accordion.addEventListener('lr-expand', (event) => lifecycle.push(`${event.type}:${event.detail.item.id}`));
    accordion.addEventListener('lr-collapse', (event) => {
      lifecycle.push(`${event.type}:${event.detail.item.id}`);
      if (event.detail.item.id === 'locked') event.preventDefault();
    });
    accordion.addEventListener('lr-after-expand', (event) =>
      lifecycle.push(`${event.type}:${event.detail.item.id}`),
    );

    buttonFor(items[1]!).click();
    await Promise.all(items.map((item) => item.updateComplete));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    expect(items.map((item) => item.expanded)).to.deep.equal([true, false]);
    expect(lifecycle).to.deep.equal(['lr-expand:next', 'lr-collapse:locked']);
  });

  it('emits matching group lifecycle events for item and group methods', async () => {
    const accordion = (await fixture(html`<lr-accordion>
      <lr-accordion-item id="method-item" label="Method item" style=${quickMotion}>Content</lr-accordion-item>
      <lr-accordion-item id="disabled-open" label="Disabled open" disabled expanded style=${quickMotion}>
        Content
      </lr-accordion-item>
    </lr-accordion>`)) as LyraAccordion;
    const items = [...accordion.querySelectorAll('lr-accordion-item')] as LyraAccordionItem[];

    const itemExpanded = oneEvent(accordion, 'lr-after-expand');
    items[0]!.expand();
    const expandEvent = (await itemExpanded) as CustomEvent<{ item: LyraAccordionItem }>;
    expect(expandEvent.detail.item.id).to.equal('method-item');
    expect(expandEvent.detail.item === items[0]).to.equal(true);
    expect(Object.isFrozen(expandEvent.detail)).to.equal(true);

    const collapsedIds: string[] = [];
    accordion.addEventListener('lr-after-collapse', (event) => collapsedIds.push(event.detail.item.id));
    accordion.collapseAll();
    await new Promise<void>((resolve) => {
      const done = (): void => {
        if (collapsedIds.length === 2) resolve();
      };
      accordion.addEventListener('lr-after-collapse', done);
    });

    expect(items.map((item) => item.expanded)).to.deep.equal([false, false]);
    expect(collapsedIds.sort()).to.deep.equal(['disabled-open', 'method-item']);
  });

  it('keeps Details lifecycle events off the narrowed accordion-item surface', async () => {
    const { accordion, items } = await renderAccordion();
    const ancestor = accordion.parentElement!;
    const leaked: string[] = [];
    for (const type of ['lr-show', 'lr-hide', 'lr-after-show', 'lr-after-hide']) {
      ancestor.addEventListener(type, () => leaked.push(type));
    }
    const wrapperLifecycle: string[] = [];
    for (const type of ['lr-expand', 'lr-after-expand', 'lr-collapse', 'lr-after-collapse']) {
      accordion.addEventListener(type, () => wrapperLifecycle.push(type));
    }

    const afterExpand = oneEvent(accordion, 'lr-after-expand');
    buttonFor(items[0]!).click();
    await afterExpand;

    const afterCollapse = oneEvent(accordion, 'lr-after-collapse');
    buttonFor(items[0]!).click();
    await afterCollapse;

    expect(leaked).to.deep.equal([]);
    expect(wrapperLifecycle).to.deep.equal([
      'lr-expand',
      'lr-after-expand',
      'lr-collapse',
      'lr-after-collapse',
    ]);
  });

  it('reconciles excess initially expanded items when entering a single mode', async () => {
    const accordion = (await fixture(html`<lr-accordion mode="single-collapsible">
      <lr-accordion-item label="One" expanded>One</lr-accordion-item>
      <lr-accordion-item label="Two" expanded>Two</lr-accordion-item>
      <lr-accordion-item label="Three" expanded>Three</lr-accordion-item>
    </lr-accordion>`)) as LyraAccordion;
    const items = [...accordion.querySelectorAll('lr-accordion-item')] as LyraAccordionItem[];
    await Promise.all(items.map((item) => item.updateComplete));
    expect(items.map((item) => item.expanded)).to.deep.equal([true, false, false]);
  });

  it('emits cancelable before events and non-cancelable after events with the direct item', async () => {
    const { accordion, items } = await renderAccordion();
    const order: string[] = [];
    accordion.addEventListener('lr-expand', (event) => {
      order.push(event.type);
      expect(event.cancelable).to.be.true;
      expect(event.detail.item.id).to.equal('one');
    });
    accordion.addEventListener('lr-after-expand', (event) => {
      order.push(event.type);
      expect(event.cancelable).to.be.false;
      expect(event.detail.item.id).to.equal('one');
    });

    const after = oneEvent(accordion, 'lr-after-expand');
    buttonFor(items[0]!).click();
    await after;
    expect(order).to.deep.equal(['lr-expand', 'lr-after-expand']);

    accordion.addEventListener('lr-collapse', (event) => event.preventDefault(), { once: true });
    buttonFor(items[0]!).click();
    await items[0]!.updateComplete;
    expect(items[0]!.expanded).to.be.true;
  });

  it('does not emit an after event when the matching before event is vetoed', async () => {
    const { accordion, items } = await renderAccordion();
    let afterCount = 0;
    accordion.addEventListener('lr-expand', (event) => event.preventDefault());
    accordion.addEventListener('lr-after-expand', () => afterCount++);

    buttonFor(items[0]!).click();
    await items[0]!.updateComplete;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(items[0]!.expanded).to.be.false;
    expect(afterCount).to.equal(0);
  });

  it('expands and collapses direct enabled children through group methods', async () => {
    const { accordion, items } = await renderAccordion();
    items[1]!.disabled = true;
    await items[1]!.updateComplete;

    accordion.expandAll();
    await Promise.all(items.map((item) => item.updateComplete));
    expect(items.map((item) => item.expanded)).to.deep.equal([true, false, true]);

    accordion.collapseAll();
    await Promise.all(items.map((item) => item.updateComplete));
    expect(items.map((item) => item.expanded)).to.deep.equal([false, false, false]);

    accordion.mode = 'single';
    accordion.expandAll();
    await Promise.all(items.map((item) => item.updateComplete));
    expect(items.some((item) => item.expanded)).to.be.false;
  });

  // 9.0.0 removed direct <lr-details> panel support. An accordion coordinates
  // <lr-accordion-item> children only; a slotted <lr-details> is now ordinary content that owns its
  // own disclosure lifecycle, and the group neither enforces its single-panel invariant over it nor
  // translates its Details events into group events.
  it('no longer coordinates direct lr-details children', async () => {
    const accordion = (await fixture(html`<lr-accordion mode="single-collapsible">
      <lr-details id="legacy-one" summary="One" open>One</lr-details>
      <lr-details id="legacy-two" summary="Two">Two</lr-details>
    </lr-accordion>`)) as LyraAccordion;
    const details = [...accordion.querySelectorAll('lr-details')] as LyraDetails[];
    let groupEvents = 0;
    for (const name of ['lr-expand', 'lr-after-expand', 'lr-collapse', 'lr-after-collapse']) {
      accordion.addEventListener(name, () => {
        groupEvents += 1;
      });
    }

    await details[1]!.show();
    await Promise.all(details.map((item) => item.updateComplete));
    expect(details.map((item) => item.open)).to.deep.equal([true, true]);
    expect(groupEvents).to.equal(0);

    accordion.collapseAll();
    await Promise.all(details.map((item) => item.updateComplete));
    expect(details.map((item) => item.open)).to.deep.equal([true, true]);
  });

  // The v9 migration for the removal above is explicit across both tag and member vocabulary.
  it('coordinates the migrated lr-accordion-item markup with the full group lifecycle', async () => {
    const accordion = (await fixture(html`<lr-accordion mode="single-collapsible">
      <lr-accordion-item id="migrated-one" label="One" expanded style=${quickMotion}>One</lr-accordion-item>
      <lr-accordion-item id="migrated-two" label="Two" style=${quickMotion}>Two</lr-accordion-item>
    </lr-accordion>`)) as LyraAccordion;
    const items = [...accordion.querySelectorAll('lr-accordion-item')] as LyraAccordionItem[];
    const afterExpand = oneEvent(accordion, 'lr-after-expand');
    void items[1]!.expand();
    const event = (await afterExpand) as CustomEvent<{ item: HTMLElement }>;

    expect(event.detail.item.id).to.equal('migrated-two');
    await Promise.all(items.map((item) => item.updateComplete));
    expect(items.map((item) => item.expanded)).to.deep.equal([false, true]);
  });

  it('uses one roving tab stop, skips disabled items, and supports Home/End', async () => {
    const { items } = await renderAccordion();
    items[1]!.disabled = true;
    await items[1]!.updateComplete;
    buttonFor(items[0]!).focus();
    buttonFor(items[0]!).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }),
    );
    expect((document.activeElement as HTMLElement | null)?.id).to.equal('three');

    buttonFor(items[2]!).dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, composed: true }));
    expect((document.activeElement as HTMLElement | null)?.id).to.equal('one');

    buttonFor(items[0]!).dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true }));
    expect((document.activeElement as HTMLElement | null)?.id).to.equal('three');
    expect(buttonFor(items[1]!).tabIndex).to.equal(-1);
  });

  it('leaves composite keys from controls inside an expanded panel to that control', async () => {
    const accordion = (await fixture(html`<lr-accordion>
      <lr-accordion-item id="panel-owner" label="Owner" expanded>
        <input id="panel-editor" aria-label="Panel editor" />
      </lr-accordion-item>
      <lr-accordion-item id="panel-next" label="Next">Next</lr-accordion-item>
    </lr-accordion>`)) as LyraAccordion;
    const input = accordion.querySelector<HTMLInputElement>('#panel-editor')!;
    const next = accordion.querySelector<LyraAccordionItem>('#panel-next')!;
    await Promise.all([
      accordion.updateComplete,
      ...[...accordion.querySelectorAll('lr-accordion-item')].map((item) => item.updateComplete),
    ]);
    input.focus();

    for (const key of ['ArrowDown', 'ArrowRight', 'Home', 'End']) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true });
      input.dispatchEvent(event);
      expect(event.defaultPrevented, `${key} should retain native editor behavior`).to.be.false;
      expect(accordion.ownerDocument.activeElement?.id).to.equal('panel-editor');
      expect(buttonFor(next).tabIndex).to.equal(-1);
    }
  });

  it('runs lifecycle events for live policy closes and rejects a vetoed mode change', async () => {
    const accordion = (await fixture(html`<lr-accordion mode="multiple">
      <lr-accordion-item id="policy-first" label="First" expanded style=${quickMotion}>First</lr-accordion-item>
      <lr-accordion-item id="policy-second" label="Second" expanded style=${quickMotion}>Second</lr-accordion-item>
    </lr-accordion>`)) as LyraAccordion;
    const second = accordion.querySelector<LyraAccordionItem>('#policy-second')!;
    await Promise.all([accordion.updateComplete, second.updateComplete]);
    const order: string[] = [];
    accordion.addEventListener('lr-collapse', (event) => order.push(`${event.type}:${event.detail.item.id}`));
    accordion.addEventListener('lr-after-collapse', (event) => order.push(`${event.type}:${event.detail.item.id}`));

    const settled = oneEvent(accordion, 'lr-after-collapse');
    accordion.mode = 'single';
    await settled;
    expect(second.expanded).to.be.false;
    expect(order).to.deep.equal([
      'lr-collapse:policy-second',
      'lr-after-collapse:policy-second',
    ]);

    accordion.mode = 'multiple';
    await accordion.updateComplete;
    await second.expand();
    accordion.addEventListener('lr-collapse', (event) => event.preventDefault(), { once: true });
    accordion.mode = 'single';
    await accordion.updateComplete;
    expect(accordion.mode).to.equal('multiple');
    expect(accordion.getAttribute('mode')).to.equal('multiple');
    expect(second.expanded).to.be.true;
  });

  it('keeps item-authored presentation intact across live writes, removal, and reparenting', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div>
      <lr-accordion id="presentation-a" appearance="filled" heading-level="2" icon-placement="start">
        <lr-accordion-item
          id="presentation-item"
          appearance="outlined"
          heading-level="4"
          icon-placement="end"
          label="Presentation"
        >Content</lr-accordion-item>
      </lr-accordion>
      <lr-accordion id="presentation-b" appearance="filled-outlined" heading-level="5"></lr-accordion>
    </div>`);
    const first = wrapper.querySelector<LyraAccordion>('#presentation-a')!;
    const second = wrapper.querySelector<LyraAccordion>('#presentation-b')!;
    const item = wrapper.querySelector<LyraAccordionItem>('#presentation-item')!;
    const base = () => item.shadowRoot!.querySelector<HTMLElement>('[part~="accordion-item"]')!;
    await Promise.all([first.updateComplete, second.updateComplete, item.updateComplete]);
    expect([item.appearance, item.headingLevel, item.iconPlacement]).to.deep.equal([
      'outlined', '4', 'end',
    ]);
    expect(base().dataset.appearance).to.equal('filled');
    expect(item.shadowRoot!.querySelector('h2')).to.exist;

    item.appearance = 'plain';
    item.headingLevel = '6';
    item.iconPlacement = 'start';
    await item.updateComplete;
    expect(base().dataset.appearance).to.equal('filled');
    expect(item.shadowRoot!.querySelector('h2')).to.exist;

    item.remove();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await item.updateComplete;
    expect(base().dataset.appearance).to.equal('plain');
    expect(item.shadowRoot!.querySelector('h6')).to.exist;

    second.append(item);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await item.updateComplete;
    expect(base().dataset.appearance).to.equal('filled-outlined');
    expect(item.shadowRoot!.querySelector('h5')).to.exist;
    expect([item.appearance, item.headingLevel, item.iconPlacement]).to.deep.equal([
      'plain', '6', 'start',
    ]);
  });

  it('skips inert direct items while assigning and moving the roving stop', async () => {
    const accordion = (await fixture(html`<lr-accordion>
      <lr-accordion-item id="inert-one" label="One" inert>One</lr-accordion-item>
      <lr-accordion-item id="inert-two" label="Two">Two</lr-accordion-item>
      <lr-accordion-item id="inert-three" label="Three" inert>Three</lr-accordion-item>
      <lr-accordion-item id="inert-four" label="Four">Four</lr-accordion-item>
    </lr-accordion>`)) as LyraAccordion;
    const items = [...accordion.querySelectorAll('lr-accordion-item')] as LyraAccordionItem[];
    await Promise.all(items.map((item) => item.updateComplete));

    expect(items.map((item) => buttonFor(item).tabIndex)).to.deep.equal([-1, 0, -1, -1]);

    buttonFor(items[1]!).focus();
    buttonFor(items[1]!).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }),
    );
    await Promise.all(items.map((item) => item.updateComplete));

    expect((document.activeElement as HTMLElement | null)?.id).to.equal('inert-four');
    expect(items.map((item) => buttonFor(item).tabIndex)).to.deep.equal([-1, -1, -1, 0]);
  });

  it('skips hidden and aria-hidden direct items while moving the roving stop', async () => {
    const accordion = (await fixture(html`<lr-accordion>
      <lr-accordion-item id="available-one" label="One">One</lr-accordion-item>
      <lr-accordion-item id="hidden-two" label="Two" hidden>Two</lr-accordion-item>
      <lr-accordion-item id="aria-hidden-three" label="Three" aria-hidden="true">Three</lr-accordion-item>
      <lr-accordion-item id="available-four" label="Four">Four</lr-accordion-item>
    </lr-accordion>`)) as LyraAccordion;
    const items = [...accordion.querySelectorAll('lr-accordion-item')] as LyraAccordionItem[];
    await Promise.all(items.map((item) => item.updateComplete));

    buttonFor(items[0]!).focus();
    buttonFor(items[0]!).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }),
    );
    await Promise.all(items.map((item) => item.updateComplete));

    expect((document.activeElement as HTMLElement | null)?.id).to.equal('available-four');
    expect(items.map((item) => buttonFor(item).tabIndex)).to.deep.equal([-1, -1, -1, 0]);
  });

  it('rehomes focus after a focused direct item becomes inert', async () => {
    const { items } = await renderAccordion();
    buttonFor(items[1]!).focus();
    items[1]!.inert = true;
    await new Promise<void>((resolve) => setTimeout(resolve));
    await Promise.all(items.map((item) => item.updateComplete));

    expect((document.activeElement as HTMLElement | null)?.id).to.equal('three');
    expect(items.map((item) => buttonFor(item).tabIndex)).to.deep.equal([-1, -1, 0]);

    buttonFor(items[2]!).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }),
    );
    expect((document.activeElement as HTMLElement | null)?.id).to.equal('one');
  });

  it('rehomes focus after a focused direct item becomes disabled', async () => {
    const { items } = await renderAccordion();
    buttonFor(items[1]!).focus();
    items[1]!.disabled = true;
    await new Promise<void>((resolve) => setTimeout(resolve));
    await Promise.all(items.map((item) => item.updateComplete));

    expect((document.activeElement as HTMLElement | null)?.id).to.equal('three');
    expect(items.map((item) => buttonFor(item).tabIndex)).to.deep.equal([-1, -1, 0]);
  });

  it('does not reclaim foreign focus while a previous roving item becomes unavailable', async () => {
    const wrapper = await fixture(html`<div>
      <lr-accordion>
        <lr-accordion-item id="external-one" label="One">One</lr-accordion-item>
        <lr-accordion-item id="external-two" label="Two">Two</lr-accordion-item>
        <lr-accordion-item id="external-three" label="Three">Three</lr-accordion-item>
      </lr-accordion>
      <button id="accordion-external-focus">Outside</button>
    </div>`);
    const accordion = wrapper.querySelector('lr-accordion') as LyraAccordion;
    const items = [...accordion.querySelectorAll('lr-accordion-item')] as LyraAccordionItem[];
    const outside = wrapper.querySelector<HTMLButtonElement>('#accordion-external-focus')!;
    await Promise.all(items.map((item) => item.updateComplete));

    buttonFor(items[1]!).focus();
    outside.focus();
    items[1]!.inert = true;
    await new Promise<void>((resolve) => setTimeout(resolve));
    await Promise.all(items.map((item) => item.updateComplete));

    expect((document.activeElement as HTMLElement | null)?.id).to.equal('accordion-external-focus');
    expect(items.map((item) => buttonFor(item).tabIndex)).to.deep.equal([-1, -1, 0]);
  });

  it('does not reclaim focus from interactive content in an unavailable direct item', async () => {
    const accordion = (await fixture(html`<lr-accordion>
      <lr-accordion-item id="content-one" label="One" expanded>
        <button id="accordion-content-focus">Nested control</button>
      </lr-accordion-item>
      <lr-accordion-item id="content-two" label="Two">Two</lr-accordion-item>
    </lr-accordion>`)) as LyraAccordion;
    const items = [...accordion.querySelectorAll('lr-accordion-item')] as LyraAccordionItem[];
    const nested = accordion.querySelector<HTMLButtonElement>('#accordion-content-focus')!;
    await Promise.all(items.map((item) => item.updateComplete));

    nested.focus();
    items[0]!.disabled = true;
    await new Promise<void>((resolve) => setTimeout(resolve));
    await Promise.all(items.map((item) => item.updateComplete));

    expect((document.activeElement as HTMLElement | null)?.id).to.equal('accordion-content-focus');
    expect(items.map((item) => buttonFor(item).tabIndex)).to.deep.equal([-1, 0]);
  });

  it('removes roving stops under a composed inert ancestor and restores the prior stop', async () => {
    const wrapper = await fixture(html`<div id="accordion-inert-ancestor"><div id="accordion-shadow-host"></div></div>`);
    const host = wrapper.querySelector<HTMLElement>('#accordion-shadow-host')!;
    const shadow = host.attachShadow({ mode: 'open' });
    const accordion = document.createElement('lr-accordion') as LyraAccordion;
    const items = ['one', 'two', 'three'].map((name) => {
      const item = document.createElement('lr-accordion-item') as LyraAccordionItem;
      item.id = `ancestor-${name}`;
      item.label = name;
      item.isTabbable = name === 'one';
      item.textContent = name;
      return item;
    });
    accordion.append(...items);
    shadow.append(accordion);
    await accordion.updateComplete;
    await new Promise<void>((resolve) => setTimeout(resolve));
    await Promise.all(items.map((item) => item.updateComplete));

    buttonFor(items[1]!).focus();
    wrapper.inert = true;
    await new Promise<void>((resolve) => setTimeout(resolve));
    await Promise.all(items.map((item) => item.updateComplete));

    expect(items.map((item) => buttonFor(item).tabIndex)).to.deep.equal([-1, -1, -1]);

    wrapper.inert = false;
    await new Promise<void>((resolve) => setTimeout(resolve));
    await Promise.all(items.map((item) => item.updateComplete));

    expect(items.map((item) => buttonFor(item).tabIndex)).to.deep.equal([-1, 0, -1]);
  });

  it('rearms availability observation after document adoption', async () => {
    const wrapper = await fixture(html`<div>
      <lr-accordion>
        <lr-accordion-item label="One">One</lr-accordion-item>
        <lr-accordion-item label="Two">Two</lr-accordion-item>
      </lr-accordion>
    </div>`);
    const accordion = wrapper.querySelector('lr-accordion') as LyraAccordion;
    const items = [...accordion.querySelectorAll('lr-accordion-item')] as LyraAccordionItem[];
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    try {
      const foreignDocument = iframe.contentDocument!;
      const foreignAncestor = foreignDocument.createElement('div');
      foreignDocument.body.append(foreignAncestor);
      foreignAncestor.append(accordion);
      await new Promise<void>((resolve) => setTimeout(resolve));
      await Promise.all(items.map((item) => item.updateComplete));

      foreignAncestor.inert = true;
      await new Promise<void>((resolve) => setTimeout(resolve));
      await Promise.all(items.map((item) => item.updateComplete));
      expect(items.map((item) => buttonFor(item).tabIndex)).to.deep.equal([-1, -1]);

      foreignAncestor.inert = false;
      await new Promise<void>((resolve) => setTimeout(resolve));
      await Promise.all(items.map((item) => item.updateComplete));
      expect(items.map((item) => buttonFor(item).tabIndex)).to.deep.equal([0, -1]);

      wrapper.append(accordion);
      await new Promise<void>((resolve) => setTimeout(resolve));
      wrapper.inert = true;
      await new Promise<void>((resolve) => setTimeout(resolve));
      await Promise.all(items.map((item) => item.updateComplete));
      expect(items.map((item) => buttonFor(item).tabIndex)).to.deep.equal([-1, -1]);
    } finally {
      wrapper.inert = false;
      if (accordion.ownerDocument !== document) wrapper.append(accordion);
      iframe.remove();
    }
  });

  it('swaps horizontal previous/next keys in RTL', async () => {
    const wrapper = await fixture(html`<div dir="rtl">
      <lr-accordion>
        <lr-accordion-item id="rtl-one" label="One">One</lr-accordion-item>
        <lr-accordion-item id="rtl-two" label="Two">Two</lr-accordion-item>
        <lr-accordion-item id="rtl-three" label="Three">Three</lr-accordion-item>
      </lr-accordion>
    </div>`);
    const items = [...wrapper.querySelectorAll('lr-accordion-item')] as LyraAccordionItem[];
    buttonFor(items[1]!).focus();
    buttonFor(items[1]!).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }),
    );
    expect((document.activeElement as HTMLElement | null)?.id).to.equal('rtl-one');

    buttonFor(items[0]!).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, composed: true }),
    );
    expect((document.activeElement as HTMLElement | null)?.id).to.equal('rtl-two');
  });

  it('keeps keyboard movement and lifecycle ownership inside nested accordions', async () => {
    const outer = (await fixture(html`<lr-accordion mode="single">
      <lr-accordion-item id="outer-one" label="Outer one" expanded>
        <lr-accordion>
          <lr-accordion-item id="inner-one" label="Inner one">Inner one</lr-accordion-item>
          <lr-accordion-item id="inner-two" label="Inner two">Inner two</lr-accordion-item>
        </lr-accordion>
      </lr-accordion-item>
      <lr-accordion-item id="outer-two" label="Outer two">Outer two</lr-accordion-item>
    </lr-accordion>`)) as LyraAccordion;
    const innerOne = outer.querySelector('#inner-one') as LyraAccordionItem;
    const innerTwo = outer.querySelector('#inner-two') as LyraAccordionItem;
    const outerOne = outer.querySelector('#outer-one') as LyraAccordionItem;
    const outerTwo = outer.querySelector('#outer-two') as LyraAccordionItem;
    const innerAccordion = innerOne.closest('lr-accordion') as LyraAccordion;
    await Promise.all([outer, outerOne, outerTwo, innerAccordion, innerOne, innerTwo].map(
      (element) => element.updateComplete,
    ));
    await new Promise<void>((resolve) => setTimeout(resolve));
    let outerOwnExpands = 0;
    outer.addEventListener('lr-expand', (event) => {
      if (event.target === outer) outerOwnExpands++;
    });

    buttonFor(outerOne).focus();
    buttonFor(outerOne).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }),
    );
    expect((document.activeElement as HTMLElement | null)?.id).to.equal('outer-two');
    await Promise.all([outerOne, outerTwo].map((item) => item.updateComplete));
    buttonFor(innerOne).focus();
    expect([buttonFor(outerOne).tabIndex, buttonFor(outerTwo).tabIndex]).to.deep.equal([-1, 0]);

    buttonFor(innerOne).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }),
    );
    expect((document.activeElement as HTMLElement | null)?.id).to.equal('inner-two');

    const after = oneEvent(innerAccordion, 'lr-after-expand');
    buttonFor(innerOne).click();
    await after;
    expect(outerOwnExpands).to.equal(0);
    expect((outer.querySelector('#outer-one') as LyraAccordionItem).expanded).to.be.true;
  });

  it('restores one valid roving stop after children shrink and after reconnect', async () => {
    const wrapper = await fixture(html`<div>
      <lr-accordion appearance="outlined">
        <lr-accordion-item id="shrink-one" label="One">One</lr-accordion-item>
        <lr-accordion-item id="shrink-two" label="Two">Two</lr-accordion-item>
        <lr-accordion-item id="shrink-three" label="Three">Three</lr-accordion-item>
      </lr-accordion>
    </div>`);
    const accordion = wrapper.querySelector('lr-accordion') as LyraAccordion;
    const second = accordion.querySelector('#shrink-two') as LyraAccordionItem;
    buttonFor(second).focus();
    second.remove();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    let remaining = [...accordion.querySelectorAll('lr-accordion-item')] as LyraAccordionItem[];
    await Promise.all(remaining.map((item) => item.updateComplete));
    expect(remaining.map((item) => buttonFor(item).tabIndex)).to.deep.equal([0, -1]);

    accordion.remove();
    accordion.appearance = 'filled';
    wrapper.append(accordion);
    await accordion.updateComplete;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    remaining = [...accordion.querySelectorAll('lr-accordion-item')] as LyraAccordionItem[];
    await Promise.all(remaining.map((item) => item.updateComplete));

    expect(remaining.map((item) => item.appearance)).to.deep.equal(['outlined', 'outlined']);
    expect(remaining.map((item) =>
      item.shadowRoot!.querySelector('[part~="accordion-item"]')?.getAttribute('data-appearance'),
    )).to.deep.equal(['filled', 'filled']);
    expect(remaining.map((item) => buttonFor(item).tabIndex)).to.deep.equal([0, -1]);

    buttonFor(remaining[0]!).focus();
    remaining[0]!.inert = true;
    await new Promise<void>((resolve) => setTimeout(resolve));
    await Promise.all(remaining.map((item) => item.updateComplete));

    expect((document.activeElement as HTMLElement | null)?.id).to.equal('shrink-three');
    expect(remaining.map((item) => buttonFor(item).tabIndex)).to.deep.equal([-1, 0]);
    const expanded = oneEvent(accordion, 'lr-after-expand');
    buttonFor(remaining[1]!).click();
    await expanded;
    expect(remaining[1]!.expanded).to.be.true;
  });

  it('is accessible with populated and expanded content', async () => {
    const accordion = await fixture(html`<lr-accordion>
      <lr-accordion-item label="Shipping" expanded>
        <p>Ships in two business days.</p>
      </lr-accordion-item>
      <lr-accordion-item disabled>
        <strong slot="label">Unavailable</strong>
        Not currently offered.
      </lr-accordion-item>
    </lr-accordion>`);
    await expect(accordion).to.be.accessible();
  });
});

it('normalizes mixed-case aria-hidden and observes excluded accordion ancestors', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div aria-hidden=" TRUE ">
      <lr-accordion>
        <lr-accordion-item id="case-one" label="One">One</lr-accordion-item>
        <lr-accordion-item id="case-two" label="Two" aria-hidden=" TrUe ">Two</lr-accordion-item>
      </lr-accordion>
    </div>
  `);
  const accordion = wrapper.querySelector('lr-accordion') as LyraAccordion;
  const items = [...accordion.querySelectorAll('lr-accordion-item')] as LyraAccordionItem[];
  await Promise.all([accordion.updateComplete, ...items.map((item) => item.updateComplete)]);
  expect(items.map((item) => buttonFor(item).tabIndex)).to.deep.equal([-1, -1]);

  wrapper.removeAttribute('aria-hidden');
  await new Promise<void>((resolve) => setTimeout(resolve));
  await Promise.all(items.map((item) => item.updateComplete));
  expect(items.map((item) => buttonFor(item).tabIndex)).to.deep.equal([0, -1]);
});

it('recognizes foreign-realm accordion items in focus and keyboard event paths', async () => {
  const accordion = (await fixture(html`<lr-accordion></lr-accordion>`)) as LyraAccordion;
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  try {
    const foreignDocument = iframe.contentDocument!;
    const first = foreignDocument.createElement('lr-accordion-item') as unknown as LyraAccordionItem;
    const second = foreignDocument.createElement('lr-accordion-item') as unknown as LyraAccordionItem;
    Object.assign(first, { disabled: false, isTabbable: false });
    Object.assign(second, { disabled: false, isTabbable: false });
    const firstShadow = (first as unknown as HTMLElement).attachShadow({ mode: 'open' });
    const foreignTrigger = foreignDocument.createElement('button');
    foreignTrigger.setAttribute('part', 'button');
    firstShadow.append(foreignTrigger);
    let focused = false;
    Object.defineProperty(second, 'focus', { configurable: true, value: () => { focused = true; } });

    const access = accordion as unknown as {
      panels: Set<LyraAccordionItem>;
      handleFocusIn(event: FocusEvent): void;
      handleKeyDown(event: KeyboardEvent): void;
    };
    access.panels.add(first);
    access.panels.add(second);
    access.handleFocusIn({ composedPath: () => [first] } as unknown as FocusEvent);
    expect(first.isTabbable).to.equal(true);

    let prevented = false;
    access.handleKeyDown({
      key: 'ArrowDown',
      composedPath: () => [foreignTrigger, firstShadow, first],
      preventDefault: () => { prevented = true; },
      stopPropagation: () => undefined,
    } as unknown as KeyboardEvent);
    expect(prevented).to.equal(true);
    expect(second.isTabbable).to.equal(true);
    expect(focused).to.equal(true);
  } finally {
    iframe.remove();
  }
});

describe('<lr-accordion-item>', () => {
  it('exposes the complete canonical item surface without the Details vocabulary', async () => {
    const item = (await fixture(html`<lr-accordion-item
      label="Canonical label"
      expanded
      heading-level="2"
      icon-placement="start"
      appearance="filled-outlined"
      style=${quickMotion}
    >
      <span slot="icon">+</span>
      Content
    </lr-accordion-item>`)) as LyraAccordionItem;

    expect(item.expanded).to.be.true;
    expect(item.hasAttribute('expanded')).to.be.true;
    for (const removed of ['open', 'summary', 'name', 'size', 'show', 'hide']) {
      expect(removed in item, `${removed} must remain on lr-details only`).to.equal(false);
    }
    expect(item.shadowRoot!.querySelector('[part~="base"][part~="accordion-item"]')).to.exist;
    expect(item.shadowRoot!.querySelector('h2[part~="heading"]')).to.exist;
    for (const part of ['button', 'label', 'icon', 'panel', 'content']) {
      expect(item.shadowRoot!.querySelector(`[part~="${part}"]`), `missing part ${part}`).to.exist;
    }
    expect(item.shadowRoot!.querySelector('[part~="summary"]') === null).to.equal(true);
    expect(getComputedStyle(item.shadowRoot!.querySelector<HTMLElement>('[part~="icon"]')!).order).to.equal('-1');

    item.expanded = false;
    await item.updateComplete;
    expect(item.expanded).to.be.false;
    expect(item.hasAttribute('expanded')).to.be.false;

    item.expanded = true;
    await item.updateComplete;
    expect(item.expanded).to.be.true;

    item.headingLevel = 'none';
    await item.updateComplete;
    expect((item.shadowRoot!.querySelector('[part~="heading"]')) === (null)).to.equal(true);
  });

  it('forwards a host aria-label to the trigger by presence and restores content naming when removed', async () => {
    const item = (await fixture(html`
      <lr-accordion-item label="Fallback item" aria-label="">Content</lr-accordion-item>
    `)) as LyraAccordionItem;
    const button = buttonFor(item);

    expect(button.hasAttribute('aria-label')).to.equal(true);
    expect(button.getAttribute('aria-label')).to.equal('');

    item.setAttribute('aria-label', 'Author item');
    await item.updateComplete;
    expect(button.getAttribute('aria-label')).to.equal('Author item');

    item.removeAttribute('aria-label');
    await item.updateComplete;
    expect(button.hasAttribute('aria-label')).to.equal(false);
    expect(button.textContent).to.contain('Fallback item');
  });

  it('keeps a slotted label decorative while its text names the sole trigger', async () => {
    const item = (await fixture(html`<lr-accordion-item>
      <a id="slotted-label-link" slot="label" href="#account">Account settings</a>
      <input id="slotted-label-input" slot="label" aria-label="Email alerts">
      Content
    </lr-accordion-item>`)) as LyraAccordionItem;
    const link = item.querySelector<HTMLElement>('#slotted-label-link')!;
    const input = item.querySelector<HTMLElement>('#slotted-label-input')!;
    const button = buttonFor(item);
    const visualLabel = button.querySelector<HTMLElement>('[part="label"] > [inert][aria-hidden="true"]')!;

    link.focus();
    expect(item.ownerDocument.activeElement?.id).to.not.equal('slotted-label-link');
    input.focus();
    expect(item.ownerDocument.activeElement?.id).to.not.equal('slotted-label-input');
    expect(visualLabel.hasAttribute('inert')).to.equal(true);
    expect(visualLabel.getAttribute('aria-hidden')).to.equal('true');
    expect(button.hasAttribute('aria-label')).to.equal(false);
    expect(button.getAttribute('aria-labelledby')).to.equal('label');

    let linkActivations = 0;
    link.addEventListener('click', () => linkActivations++);
    const rect = link.getBoundingClientRect();
    try {
      await sendMouse({
        type: 'click',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      await item.updateComplete;
      expect(linkActivations).to.equal(0);
      expect(item.expanded).to.equal(true);
    } finally {
      await resetMouse();
    }
    await expect(item).to.be.accessible();
  });

  it('keeps interactive icon content visible but inert beneath the sole trigger', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div>
      <button id="before-accordion-icon">Before</button>
      <lr-accordion-item label="Preferences">
        <a id="nested-accordion-icon" slot="icon" href="#nested-icon">+</a>
        Content
      </lr-accordion-item>
    </div>`);
    const item = wrapper.querySelector('lr-accordion-item') as LyraAccordionItem;
    const before = wrapper.querySelector<HTMLButtonElement>('#before-accordion-icon')!;
    const nestedIcon = wrapper.querySelector<HTMLAnchorElement>('#nested-accordion-icon')!;
    const icon = buttonFor(item).querySelector<HTMLElement>('[part~="icon"]')!;

    expect(icon.getAttribute('aria-hidden')).to.equal('true');
    expect(icon.hasAttribute('inert')).to.equal(true);
    expect(nestedIcon.getBoundingClientRect().width).to.be.greaterThan(0);
    before.focus();
    nestedIcon.focus();
    expect(item.ownerDocument.activeElement === before).to.equal(true);
    await expect(item).to.be.accessible();
  });

  it('keeps a slotted trigger name live and lets a present host label win', async () => {
    const item = (await fixture(html`<lr-accordion-item aria-label="Author label">
      <span id="live-slotted-label" slot="label">Initial label</span>
      Content
    </lr-accordion-item>`)) as LyraAccordionItem;
    const label = item.querySelector<HTMLElement>('#live-slotted-label')!;
    const button = buttonFor(item);

    expect(button.getAttribute('aria-label')).to.equal('Author label');
    expect(button.hasAttribute('aria-labelledby')).to.equal(false);
    item.setAttribute('aria-label', '');
    await item.updateComplete;
    expect(button.getAttribute('aria-label')).to.equal('');
    expect(button.hasAttribute('aria-labelledby')).to.equal(false);

    item.removeAttribute('aria-label');
    await item.updateComplete;
    expect(button.hasAttribute('aria-label')).to.equal(false);
    expect(button.getAttribute('aria-labelledby')).to.equal('label');

    label.textContent = 'Updated label';
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(label.textContent).to.equal('Updated label');
    expect(button.getAttribute('aria-labelledby')).to.equal('label');
  });

  it('supports expand(), collapse(), toggle(), focus(), and click()', async () => {
    const item = (await fixture(
      html`<lr-accordion-item label="Methods" style=${quickMotion}>Content</lr-accordion-item>`,
    )) as LyraAccordionItem;

    let settled = item.expand();
    expect(item.expanded).to.be.true;
    await settled;
    settled = item.collapse();
    expect(item.expanded).to.be.false;
    await settled;
    settled = item.toggle();
    expect(item.expanded).to.be.true;
    await settled;

    item.focus();
    expect(item.shadowRoot!.activeElement?.localName).to.equal('button');
    item.click();
    await item.updateComplete;
    expect(item.expanded).to.be.false;
  });

  it('uses owner-scoped coordination without leaking private protocol-shaped events', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div>
      <lr-accordion id="protocol-owner" mode="single">
        <lr-accordion-item id="protocol-owned" label="Owned">Owned</lr-accordion-item>
      </lr-accordion>
      <lr-accordion-item id="protocol-standalone" label="Standalone">Standalone</lr-accordion-item>
    </div>`);
    const owner = wrapper.querySelector<LyraAccordion>('#protocol-owner')!;
    const owned = wrapper.querySelector<LyraAccordionItem>('#protocol-owned')!;
    const standalone = wrapper.querySelector<LyraAccordionItem>('#protocol-standalone')!;
    await Promise.all([owner.updateComplete, owned.updateComplete, standalone.updateComplete]);
    const leaked: string[] = [];
    for (const name of ['lr-accordion-item-trigger', 'lr-accordion-item-state-change']) {
      wrapper.addEventListener(name, (event) => {
        leaked.push(event.type);
        event.preventDefault();
      });
    }

    buttonFor(standalone).click();
    await standalone.updateComplete;
    buttonFor(owned).click();
    await owned.updateComplete;
    owned.disabled = true;
    await owned.updateComplete;

    expect(standalone.expanded).to.be.true;
    expect(owned.expanded).to.be.true;
    expect(leaked).to.deep.equal([]);
  });

  it('renders explicit false ARIA state and gates every activation path while disabled', async () => {
    const item = (await fixture(
      html`<lr-accordion-item label="Disabled" disabled>Content</lr-accordion-item>`,
    )) as LyraAccordionItem;
    const button = buttonFor(item);
    expect(button.getAttribute('aria-expanded')).to.equal('false');
    expect(button.getAttribute('aria-disabled')).to.equal('true');
    expect(button.disabled).to.be.true;
    button.click();
    item.click();
    item.expand();
    expect(item.expanded).to.be.false;
  });

  it('keeps a group-vetoed expanded attribute write synchronized', async () => {
    const accordion = (await fixture(html`<lr-accordion>
      <lr-accordion-item label="Vetoed">Content</lr-accordion-item>
    </lr-accordion>`)) as LyraAccordion;
    const item = accordion.querySelector('lr-accordion-item') as LyraAccordionItem;
    accordion.addEventListener('lr-expand', (event) => event.preventDefault(), { once: true });

    item.setAttribute('expanded', '');
    await item.updateComplete;
    expect(item.expanded).to.be.false;
    expect(item.hasAttribute('expanded')).to.be.false;
  });

  it('keeps a disabled expanded-attribute write synchronized', async () => {
    const item = (await fixture(
      html`<lr-accordion-item label="Disabled alias" disabled>Content</lr-accordion-item>`,
    )) as LyraAccordionItem;

    item.setAttribute('expanded', '');
    await item.updateComplete;

    expect(item.expanded).to.be.false;
    expect(item.hasAttribute('expanded')).to.be.false;
  });

  it('keeps the canonical and upstream spacing hooks live in rendered styles', async () => {
    const item = (await fixture(html`<lr-accordion-item
      label="Spacing"
      style="--lr-accordion-item-spacing: 17px"
    >Content</lr-accordion-item>`)) as LyraAccordionItem;
    const button = buttonFor(item);
    expect(getComputedStyle(button).paddingInlineStart).to.equal('17px');

    item.style.removeProperty('--lr-accordion-item-spacing');
    item.style.setProperty('--spacing', '29px');
    expect(getComputedStyle(button).paddingInlineStart).to.equal('29px');
  });

  it('mirrors the icon rotation in RTL and lets consumer part styles disable it', async () => {
    const wrapper = await fixture(html`<div dir="rtl">
      <style>lr-accordion-item.no-rotation::part(icon) { rotate: none; }</style>
      <lr-accordion-item label="RTL icon" expanded>Content</lr-accordion-item>
      <lr-accordion-item class="no-rotation" label="Static icon" expanded>Content</lr-accordion-item>
    </div>`);
    const items = [...wrapper.querySelectorAll('lr-accordion-item')] as LyraAccordionItem[];
    const rotatingIcon = items[0]!.shadowRoot!.querySelector<HTMLElement>('[part~="icon"]')!;
    const staticIcon = items[1]!.shadowRoot!.querySelector<HTMLElement>('[part~="icon"]')!;

    expect(getComputedStyle(rotatingIcon).rotate).to.equal('-90deg');
    expect(getComputedStyle(staticIcon).rotate).to.equal('none');
  });

  it('settles expand() only after rendered item motion', async () => {
    const item = (await fixture(html`<lr-accordion-item
      label="After timing"
      style="--show-duration: 80ms"
    >Content</lr-accordion-item>`)) as LyraAccordionItem;
    const panel = item.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!;
    // Establish the collapsed style in a painted frame so the subsequent state change creates a
    // real transition rather than being coalesced into the initial render.
    void panel.offsetWidth;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const startedAt = performance.now();
    await item.expand();

    expect(performance.now() - startedAt).to.be.at.least(50);
  });

  it('publishes the animating custom state only while a transition is settling', async () => {
    const item = (await fixture(html`<lr-accordion-item
      label="Animation state"
      style="--show-duration: 40ms"
    >Content</lr-accordion-item>`)) as LyraAccordionItem;

    const expansion = item.expand();
    await item.updateComplete;
    expect(item.matches(':state(animating)')).to.be.true;
    await expansion;
    expect(item.matches(':state(animating)')).to.be.false;
  });

  it('contains expanded long labels, content, and actions in an exact 320px RTL accordion', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div dir="rtl" style="inline-size: 320px; max-inline-size: 100%;">
        <lr-accordion>
          <lr-accordion-item
            label="عنوانقسممحليطويلجداًبدونأيفرصةللفصلالتلقائي"
            expanded
          >
            <p>محتوىقسممحليطويلجداًبدونأيفرصةللفصلالتلقائي</p>
            <button type="button">إجراءمحليطويلجداًبدونأيفرصةللفصلالتلقائي</button>
          </lr-accordion-item>
          <lr-accordion-item label="عنوانقسمثانطويلجداًبدونأيفرصةللفصلالتلقائي">
            Secondary content
          </lr-accordion-item>
        </lr-accordion>
      </div>
    `);
    const accordion = wrapper.querySelector('lr-accordion') as LyraAccordion;
    const items = [...wrapper.querySelectorAll('lr-accordion-item')] as LyraAccordionItem[];
    await Promise.all([accordion.updateComplete, ...items.map((item) => item.updateComplete)]);
    const groupBase = accordion.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    const itemBase = items[0]!.shadowRoot!.querySelector<HTMLElement>('[part~="accordion-item"]')!;
    const button = buttonFor(items[0]!);
    const content = items[0]!.shadowRoot!.querySelector<HTMLElement>('[part~="content"]')!;

    expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth);
    expect(accordion.scrollWidth).to.be.at.most(accordion.clientWidth);
    expect(groupBase.scrollWidth).to.be.at.most(groupBase.clientWidth);
    expect(itemBase.scrollWidth).to.be.at.most(itemBase.clientWidth);
    expect(button.scrollWidth).to.be.at.most(button.clientWidth);
    expect(content.scrollWidth).to.be.at.most(content.clientWidth);
    expect(getComputedStyle(groupBase).direction).to.equal('rtl');
  });

  it('renders motion by default and applies the reduced-motion kill switch to panel and icon', async () => {
    const item = (await fixture(
      html`<lr-accordion-item label="Motion">Content</lr-accordion-item>`,
    )) as LyraAccordionItem;
    const panel = item.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!;
    const icon = item.shadowRoot!.querySelector<HTMLElement>('[part~="icon"]')!;
    expect(getComputedStyle(panel).transitionDuration).to.not.equal('0s');

    const reducedRule = item.shadowRoot!.adoptedStyleSheets
      .flatMap((sheet) => [...sheet.cssRules])
      .find(
        (rule): rule is CSSMediaRule =>
          rule instanceof CSSMediaRule &&
          rule.conditionText === '(prefers-reduced-motion: reduce)' &&
          [...rule.cssRules].some(
            (nested) =>
              nested instanceof CSSStyleRule &&
              nested.selectorText.includes('panel') &&
              nested.selectorText.includes('icon'),
          ),
      );
    expect(reducedRule?.conditionText).to.equal('(prefers-reduced-motion: reduce)');
    const originalCondition = reducedRule!.media.mediaText;
    try {
      reducedRule!.media.mediaText = 'all';
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      expect(getComputedStyle(panel).transitionDuration).to.equal('0s');
      expect(getComputedStyle(icon).transitionDuration).to.equal('0s');
    } finally {
      reducedRule!.media.mediaText = originalCondition;
    }
  });

  it('localizes the fallback label and is accessible in its own populated expanded state', async () => {
    const item = (await fixture(html`<lr-accordion-item expanded>
      <p>Populated panel content.</p>
    </lr-accordion-item>`)) as LyraAccordionItem;
    item.strings = { details: 'Localized disclosure' };
    await item.updateComplete;

    expect(buttonFor(item).textContent).to.contain('Localized disclosure');
    await expect(item).to.be.accessible();
  });
});
