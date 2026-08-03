import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './accordion.js';
import './accordion-item.js';
import './details.js';
import type { LyraAccordion } from './accordion.js';
import type { LyraAccordionItem } from './accordion-item.js';
import type { LyraDetails } from './details.js';

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
  it('defaults to the Web Awesome-compatible multiple mode and propagates presentation', async () => {
    const { accordion, items } = await renderAccordion();

    expect(accordion.mode).to.equal('multiple');
    expect(accordion.getAttribute('mode')).to.equal('multiple');
    expect(accordion.multiple).to.be.true;
    expect(accordion.hasAttribute('multiple')).to.be.false;
    expect(accordion.iconPlacement).to.equal('end');
    expect(accordion.headingLevel).to.equal('3');
    expect(accordion.appearance).to.equal('outlined');

    accordion.iconPlacement = 'start';
    accordion.headingLevel = '2';
    accordion.appearance = 'filled';
    await accordion.updateComplete;
    await Promise.all(items.map((item) => item.updateComplete));

    expect(items.map((item) => item.iconPlacement)).to.deep.equal(['start', 'start', 'start']);
    expect(items.map((item) => item.headingLevel)).to.deep.equal(['2', '2', '2']);
    expect(items.map((item) => item.appearance)).to.deep.equal(['filled', 'filled', 'filled']);

    accordion.headingLevel = 'outside-range';
    await accordion.updateComplete;
    await Promise.all(items.map((item) => item.updateComplete));
    expect(items.map((item) => item.shadowRoot!.querySelector('h3')?.localName)).to.deep.equal([
      'h3',
      'h3',
      'h3',
    ]);
  });

  it('keeps the legacy multiple alias unambiguous and gives an authored mode precedence', async () => {
    const explicit = (await fixture(html`<lr-accordion mode="single" multiple>
      <lr-accordion-item label="One">One</lr-accordion-item>
    </lr-accordion>`)) as LyraAccordion;
    await explicit.updateComplete;
    expect(explicit.mode).to.equal('single');
    expect(explicit.multiple).to.be.false;

    const { accordion } = await renderAccordion();
    accordion.multiple = false;
    await accordion.updateComplete;
    expect(accordion.mode).to.equal('single-collapsible');
    expect(accordion.getAttribute('multiple')).to.equal('false');

    accordion.multiple = true;
    await accordion.updateComplete;
    expect(accordion.mode).to.equal('multiple');
    expect(accordion.hasAttribute('multiple')).to.be.false;

    const markupAlias = (await fixture(html`<lr-accordion multiple="false">
      <lr-accordion-item label="One">One</lr-accordion-item>
    </lr-accordion>`)) as LyraAccordion;
    expect(markupAlias.mode).to.equal('single-collapsible');
  });

  it('allows multiple expanded items in the default mode', async () => {
    const { items } = await renderAccordion();
    const firstAfter = oneEvent(items[0]!, 'lr-after-show');
    buttonFor(items[0]!).click();
    await firstAfter;
    const secondAfter = oneEvent(items[1]!, 'lr-after-show');
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

    const collapsedIds: string[] = [];
    accordion.addEventListener('lr-after-collapse', (event) => collapsedIds.push(event.detail.item.id));
    const itemCollapsed = oneEvent(items[0]!, 'lr-after-hide');
    const disabledItemCollapsed = oneEvent(items[1]!, 'lr-after-hide');
    accordion.collapseAll();
    await Promise.all([itemCollapsed, disabledItemCollapsed]);

    expect(items.map((item) => item.expanded)).to.deep.equal([false, false]);
    expect(collapsedIds.sort()).to.deep.equal(['disabled-open', 'method-item']);
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

  it('keeps direct lr-details children working with the legacy lifecycle', async () => {
    const accordion = (await fixture(html`<lr-accordion multiple="false">
      <lr-details id="legacy-one" summary="One" open>One</lr-details>
      <lr-details id="legacy-two" summary="Two">Two</lr-details>
    </lr-accordion>`)) as LyraAccordion;
    const details = [...accordion.querySelectorAll('lr-details')] as LyraDetails[];
    const afterExpand = oneEvent(accordion, 'lr-after-expand');
    details[1]!.show();
    const event = (await afterExpand) as CustomEvent<{ item: HTMLElement }>;

    expect(event.detail.item.id).to.equal('legacy-two');
    expect(details.map((item) => item.open)).to.deep.equal([false, true]);
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
    let outerOwnExpands = 0;
    outer.addEventListener('lr-expand', (event) => {
      if (event.target === outer) outerOwnExpands++;
    });

    buttonFor(innerOne).focus();
    buttonFor(innerOne).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }),
    );
    expect((document.activeElement as HTMLElement | null)?.id).to.equal('inner-two');

    const innerAccordion = innerOne.closest('lr-accordion') as LyraAccordion;
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

    expect(remaining.map((item) => item.appearance)).to.deep.equal(['filled', 'filled']);
    expect(remaining.map((item) => buttonFor(item).tabIndex)).to.deep.equal([0, -1]);
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
      composedPath: () => [first],
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
  it('exposes the complete item surface and keeps Details aliases synchronized', async () => {
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

    expect(item.open).to.be.true;
    expect(item.expanded).to.be.true;
    expect(item.hasAttribute('open')).to.be.true;
    expect(item.hasAttribute('expanded')).to.be.true;
    expect(item.shadowRoot!.querySelector('[part~="base"][part~="accordion-item"]')).to.exist;
    expect(item.shadowRoot!.querySelector('h2[part~="heading"]')).to.exist;
    for (const part of ['button', 'summary', 'label', 'icon', 'panel', 'content']) {
      expect(item.shadowRoot!.querySelector(`[part~="${part}"]`), `missing part ${part}`).to.exist;
    }
    expect(getComputedStyle(item.shadowRoot!.querySelector<HTMLElement>('[part~="icon"]')!).order).to.equal('-1');

    item.open = false;
    await item.updateComplete;
    expect(item.expanded).to.be.false;
    expect(item.hasAttribute('expanded')).to.be.false;

    item.expanded = true;
    await item.updateComplete;
    expect(item.open).to.be.true;

    item.headingLevel = 'none';
    await item.updateComplete;
    expect(item.shadowRoot!.querySelector('[part~="heading"]')).to.equal(null);
  });

  it('accepts the legacy summary property and summary slot as label aliases', async () => {
    const propertyItem = (await fixture(
      html`<lr-accordion-item summary="Legacy summary">Content</lr-accordion-item>`,
    )) as LyraAccordionItem;
    expect(buttonFor(propertyItem).textContent).to.contain('Legacy summary');

    const slotItem = (await fixture(html`<lr-accordion-item>
      <span slot="summary">Legacy slot</span>
      Content
    </lr-accordion-item>`)) as LyraAccordionItem;
    expect(slotItem.querySelector('[slot="summary"]')?.textContent).to.equal('Legacy slot');
    expect(buttonFor(slotItem).textContent).to.not.contain('Details');
  });

  it('gives the canonical label slot precedence and restores the summary alias when it is removed', async () => {
    const item = (await fixture(html`<lr-accordion-item label="Property label" summary="Summary property">
      <span id="canonical-label" slot="label">Canonical slot</span>
      <span id="legacy-label" slot="summary">Summary slot</span>
      Content
    </lr-accordion-item>`)) as LyraAccordionItem;
    const labelSlot = item.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="label"]')!;
    const summarySlot = item.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="summary"]')!;
    expect(labelSlot.hidden).to.be.false;
    expect(summarySlot.hidden).to.be.true;

    item.querySelector('#canonical-label')!.remove();
    await item.updateComplete;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(labelSlot.hidden).to.be.true;
    expect(summarySlot.hidden).to.be.false;
    expect(summarySlot.assignedElements()[0]?.id).to.equal('legacy-label');
  });

  it('supports expand(), collapse(), toggle(), show(), hide(), focus(), blur(), and click()', async () => {
    const item = (await fixture(
      html`<lr-accordion-item label="Methods" style=${quickMotion}>Content</lr-accordion-item>`,
    )) as LyraAccordionItem;

    let settled = oneEvent(item, 'lr-after-show');
    item.expand();
    expect(item.expanded).to.be.true;
    await settled;
    settled = oneEvent(item, 'lr-after-hide');
    item.collapse();
    expect(item.expanded).to.be.false;
    await settled;
    settled = oneEvent(item, 'lr-after-show');
    item.toggle();
    expect(item.expanded).to.be.true;
    await settled;
    item.hide();
    expect(item.expanded).to.be.false;
    item.show();
    expect(item.expanded).to.be.true;

    item.focus();
    expect(item.shadowRoot!.activeElement?.localName).to.equal('button');
    item.blur();
    expect(item.shadowRoot!.activeElement?.localName ?? null).to.equal(null);
    item.click();
    await item.updateComplete;
    expect(item.expanded).to.be.false;
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

  it('keeps a vetoed expanded attribute write synchronized with the open alias', async () => {
    const item = (await fixture(
      html`<lr-accordion-item label="Vetoed">Content</lr-accordion-item>`,
    )) as LyraAccordionItem;
    item.addEventListener('lr-show', (event) => event.preventDefault(), { once: true });

    item.setAttribute('expanded', '');
    await item.updateComplete;
    expect(item.expanded).to.be.false;
    expect(item.open).to.be.false;
    expect(item.hasAttribute('expanded')).to.be.false;
    expect(item.hasAttribute('open')).to.be.false;
  });

  it('keeps a disabled write through the open attribute alias synchronized', async () => {
    const item = (await fixture(
      html`<lr-accordion-item label="Disabled alias" disabled>Content</lr-accordion-item>`,
    )) as LyraAccordionItem;

    item.setAttribute('open', '');
    await item.updateComplete;

    expect(item.open).to.be.false;
    expect(item.expanded).to.be.false;
    expect(item.hasAttribute('open')).to.be.false;
    expect(item.hasAttribute('expanded')).to.be.false;
  });

  it('keeps the canonical and Details-compatible spacing hooks live in rendered styles', async () => {
    const item = (await fixture(html`<lr-accordion-item
      label="Spacing"
      style="--lr-accordion-item-spacing: 17px"
    >Content</lr-accordion-item>`)) as LyraAccordionItem;
    const button = buttonFor(item);
    expect(getComputedStyle(button).paddingInlineStart).to.equal('17px');

    item.style.removeProperty('--lr-accordion-item-spacing');
    item.style.setProperty('--lr-details-spacing', '23px');
    expect(getComputedStyle(button).paddingInlineStart).to.equal('23px');

    item.style.setProperty('--spacing', '29px');
    expect(getComputedStyle(button).paddingInlineStart).to.equal('29px');

    item.style.setProperty('--lr-details-font-size', '21px');
    expect(getComputedStyle(button).fontSize).to.equal('21px');
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

  it('waits for rendered item motion before the inherited Details after-event', async () => {
    const item = (await fixture(html`<lr-accordion-item
      label="After timing"
      style="--show-duration: 80ms"
    >Content</lr-accordion-item>`)) as LyraAccordionItem;
    const panel = item.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!;
    // Establish the collapsed style in a painted frame so the subsequent state change creates a
    // real transition rather than being coalesced into the initial render.
    void panel.offsetWidth;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const after = oneEvent(item, 'lr-after-show');

    const startedAt = performance.now();
    item.show();
    await after;

    expect(performance.now() - startedAt).to.be.at.least(50);
  });

  it('publishes the animating custom state only while a transition is settling', async () => {
    const item = (await fixture(html`<lr-accordion-item
      label="Animation state"
      style="--show-duration: 40ms"
    >Content</lr-accordion-item>`)) as LyraAccordionItem;

    const expansion = oneEvent(item, 'lr-after-show');
    item.expand();
    await item.updateComplete;
    expect(item.matches(':state(animating)')).to.be.true;
    await expansion;
    expect(item.matches(':state(animating)')).to.be.false;
  });

  it('contains long labels and content at a 320px allocation', async () => {
    const item = (await fixture(html`<lr-accordion-item
      label="A_really_long_unbroken_label_that_must_wrap_without_widening_the_panel"
      expanded
      style="inline-size: 320px"
    >A_really_long_unbroken_content_value_that_must_wrap_without_widening_the_panel</lr-accordion-item>`)) as LyraAccordionItem;
    const base = item.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
    expect(base.scrollWidth).to.be.at.most(base.clientWidth + 1);
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
