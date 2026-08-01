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
    expect(accordion.multiple).to.be.true;
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

    accordion.multiple = true;
    await accordion.updateComplete;
    expect(accordion.mode).to.equal('multiple');

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
    for (const part of ['button', 'label', 'icon', 'panel', 'content']) {
      expect(item.shadowRoot!.querySelector(`[part~="${part}"]`), `missing part ${part}`).to.exist;
    }

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

  it('supports expand(), collapse(), toggle(), show(), hide(), focus(), blur(), and click()', async () => {
    const item = (await fixture(
      html`<lr-accordion-item label="Methods" style=${quickMotion}>Content</lr-accordion-item>`,
    )) as LyraAccordionItem;

    await item.expand();
    expect(item.expanded).to.be.true;
    await item.collapse();
    expect(item.expanded).to.be.false;
    await item.toggle();
    expect(item.expanded).to.be.true;
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
    await item.expand();
    expect(item.expanded).to.be.false;
  });

  it('renders motion by default and installs a reduced-motion kill switch for panel and icon', async () => {
    const item = (await fixture(
      html`<lr-accordion-item label="Motion">Content</lr-accordion-item>`,
    )) as LyraAccordionItem;
    const panel = item.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!;
    expect(getComputedStyle(panel).transitionDuration).to.not.equal('0s');

    const reducedRules = item.shadowRoot!.adoptedStyleSheets
      .flatMap((sheet) => [...sheet.cssRules])
      .filter(
        (rule): rule is CSSMediaRule =>
          rule instanceof CSSMediaRule && rule.conditionText === '(prefers-reduced-motion: reduce)',
      )
      .flatMap((media) => [...media.cssRules])
      .map((rule) => rule.cssText)
      .join(' ');
    expect(reducedRules).to.match(/\[part~=["']panel["']\]/);
    expect(reducedRules).to.match(/\[part~=["']icon["']\]/);
    expect(reducedRules).to.include('transition: none');
  });
});
