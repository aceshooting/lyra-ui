import { resolveDeclarationsInShadow as resolveInShadow } from '../../../../test/shadow-style.js';
import { expect, fixture, html } from '@open-wc/testing';
import './thread-list.js';
import type { LyraChatThread, LyraThreadList } from './thread-list.js';

const THREADS: LyraChatThread[] = [
  { id: 't1', title: 'Quarterly review' },
  { id: 't2', title: 'Deployment notes' },
];

function searchInput(el: LyraThreadList): HTMLInputElement {
  return el.shadowRoot!.querySelector<HTMLInputElement>(
    '[part="search-input"]'
  )!;
}

function clearButton(el: LyraThreadList): HTMLButtonElement | null {
  return el.shadowRoot!.querySelector<HTMLButtonElement>(
    '[part="clear-button"]'
  );
}

function fieldGeometry(el: LyraThreadList): Record<string, string> {
  const computed = getComputedStyle(searchInput(el));
  return {
    'min-block-size': computed.getPropertyValue('min-block-size'),
    'font-size': computed.getPropertyValue('font-size'),
    'padding-inline-start': computed.getPropertyValue('padding-inline-start'),
    'padding-inline-end': computed.getPropertyValue('padding-inline-end'),
    'padding-block-start': computed.getPropertyValue('padding-block-start'),
    'padding-block-end': computed.getPropertyValue('padding-block-end'),
    'border-start-start-radius': computed.getPropertyValue(
      'border-start-start-radius'
    ),
  };
}

async function searchableFixture(): Promise<LyraThreadList> {
  const el = await fixture<LyraThreadList>(
    html`<lr-thread-list searchable .threads=${THREADS}></lr-thread-list>`
  );
  await el.updateComplete;
  return el;
}

describe('lr-thread-list search sizing', () => {
  it('renders the default search field on the shared m geometry', async () => {
    const el = await searchableFixture();
    const expected = resolveInShadow(el, [
      ['min-block-size', 'var(--lr-form-control-height)'],
      ['font-size', 'var(--lr-form-control-font-size)'],
      ['padding-inline-start', 'var(--lr-form-control-padding-inline)'],
      ['padding-block-start', 'var(--lr-form-control-padding-block)'],
      ['border-start-start-radius', 'var(--lr-form-control-radius)'],
    ]);
    expect(el.size).to.equal('m');
    expect(el.getAttribute('size')).to.equal('m');
    const geometry = fieldGeometry(el);
    for (const [property, value] of Object.entries(expected)) {
      expect(geometry[property], property).to.equal(value);
    }
  });

  it('resolves the search field onto the shared form-control ladder for a size tier', async () => {
    const el = await searchableFixture();
    const untiered = fieldGeometry(el);

    el.size = 's';
    await el.updateComplete;
    expect(el.getAttribute('size')).to.equal('s');

    const expected = resolveInShadow(el, [
      ['min-block-size', 'var(--lr-form-control-height)'],
      ['font-size', 'var(--lr-form-control-font-size)'],
      ['padding-inline-start', 'var(--lr-form-control-padding-inline)'],
      ['padding-block-start', 'var(--lr-form-control-padding-block)'],
      ['border-start-start-radius', 'var(--lr-form-control-radius)'],
    ]);
    const tiered = fieldGeometry(el);

    expect(
      tiered['min-block-size'],
      'a tier must give the field the shared row height'
    ).to.equal(expected['min-block-size']);
    expect(tiered['min-block-size']).to.not.equal(
      untiered['min-block-size']
    );
    expect(tiered['font-size']).to.equal(expected['font-size']);
    expect(tiered['font-size']).to.not.equal(untiered['font-size']);
    expect(tiered['padding-inline-start']).to.equal(
      expected['padding-inline-start']
    );
    expect(tiered['padding-block-start']).to.equal(
      expected['padding-block-start']
    );
    expect(tiered['border-start-start-radius']).to.equal(
      expected['border-start-start-radius']
    );
  });

  it('reads the Web Awesome and Shoelace size spellings as the same tier', async () => {
    const canonical = await searchableFixture();
    canonical.size = 's';
    await canonical.updateComplete;
    const alias = await searchableFixture();
    alias.setAttribute('size', 'small');
    await alias.updateComplete;

    expect(alias.size).to.equal('small');
    expect(fieldGeometry(alias)).to.deep.equal(fieldGeometry(canonical));
  });

  it('restores the m field after an unsupported size or attribute removal', async () => {
    const el = await searchableFixture();
    const untiered = fieldGeometry(el);

    el.size = 'l';
    await el.updateComplete;
    expect(fieldGeometry(el)).to.not.deep.equal(untiered);

    el.size = 'huge' as never;
    await el.updateComplete;

    expect(el.size).to.equal('m');
    expect(el.getAttribute('size')).to.equal('m');
    el.size = 's';
    await el.updateComplete;
    el.removeAttribute('size');
    await el.updateComplete;
    expect(el.size).to.equal('m');
    expect(fieldGeometry(el)).to.deep.equal(untiered);
  });

  it('lets --lr-thread-list-search-* win over both the default geometry and an active tier', async () => {
    const el = await searchableFixture();
    el.size = 'xl';
    el.style.setProperty('--lr-thread-list-search-font-size', '11px');
    el.style.setProperty('--lr-thread-list-search-min-height', '13px');
    el.style.setProperty('--lr-thread-list-search-padding-inline', '17px');
    el.style.setProperty('--lr-thread-list-search-padding-block', '19px');
    el.style.setProperty('--lr-thread-list-search-radius', '23px');
    await el.updateComplete;

    const geometry = fieldGeometry(el);
    expect(geometry['font-size']).to.equal('11px');
    expect(geometry['min-block-size']).to.equal('13px');
    expect(geometry['padding-inline-start']).to.equal('17px');
    expect(geometry['padding-block-start']).to.equal('19px');
    expect(geometry['border-start-start-radius']).to.equal('23px');
  });

  it('sizes the search row gutter and gap through their own hooks', async () => {
    const el = await searchableFixture();
    el.style.setProperty('--lr-thread-list-search-padding', '29px');
    el.style.setProperty('--lr-thread-list-search-gap', '31px');
    await el.updateComplete;

    const wrapper = getComputedStyle(
      el.shadowRoot!.querySelector('[part="search"]')!
    );
    expect(wrapper.getPropertyValue('padding-inline-start')).to.equal('29px');
    expect(wrapper.getPropertyValue('column-gap')).to.equal('31px');
  });

  it('scales the clear button through its own hook without dropping below the tap-target floor', async () => {
    const el = await searchableFixture();
    searchInput(el).value = 'quarter';
    searchInput(el).dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;

    const rendered = clearButton(el);
    expect(rendered === null, 'a non-empty query renders the clear button').to
      .equal(false);

    el.style.setProperty('--lr-thread-list-search-clear-size', '48px');
    await el.updateComplete;
    expect(getComputedStyle(clearButton(el)!).inlineSize).to.equal('48px');

    const floor = resolveInShadow(el, [
      ['inline-size', 'var(--lr-icon-button-size)'],
    ]);
    el.style.setProperty('--lr-thread-list-search-clear-size', '2px');
    await el.updateComplete;
    expect(
      getComputedStyle(clearButton(el)!).inlineSize,
      'the WCAG target floor must survive a shrinking clear-size hook'
    ).to.equal(floor['inline-size']);
  });

  it('keeps the tier applied across a disconnect and reconnect', async () => {
    const el = await searchableFixture();
    el.size = 'l';
    await el.updateComplete;
    const tiered = fieldGeometry(el);

    const parent = el.parentElement!;
    el.remove();
    parent.append(el);
    await el.updateComplete;

    expect(el.size).to.equal('l');
    expect(fieldGeometry(el)).to.deep.equal(tiered);
  });

  it('keeps the tiered field symmetric and the clear button at the inline end under dir="rtl"', async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<div dir="rtl" style="inline-size:320px">
        <lr-thread-list
          searchable
          size="l"
          .threads=${THREADS}
        ></lr-thread-list>
      </div>`
    );
    const el = wrapper.querySelector<LyraThreadList>('lr-thread-list')!;
    await el.updateComplete;
    searchInput(el).value = 'quarter';
    searchInput(el).dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;

    const geometry = fieldGeometry(el);
    expect(geometry['padding-inline-start']).to.equal(
      geometry['padding-inline-end']
    );
    const inputRect = searchInput(el).getBoundingClientRect();
    const clearRect = clearButton(el)!.getBoundingClientRect();
    expect(
      Math.round(clearRect.right) <= Math.round(inputRect.left),
      'the clear button stays at the inline end, which is visually left under rtl'
    ).to.equal(true);
  });

  it('stays accessible with a tier applied and the clear button rendered', async () => {
    const el = await searchableFixture();
    el.size = 's';
    await el.updateComplete;
    searchInput(el).value = 'quarter';
    searchInput(el).dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;

    expect(clearButton(el) === null).to.equal(false);
    await expect(el).to.be.accessible();
  });
});
