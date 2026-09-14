import { expect, fixture, html } from '@open-wc/testing';
import './retrieval-search.js';
import type { LyraRetrievalSearch } from './retrieval-search.js';

function resolveInShadow(
  el: HTMLElement,
  declarations: readonly (readonly [string, string])[]
): Record<string, string> {
  const probe = document.createElement('div');
  for (const [property, value] of declarations) {
    probe.style.setProperty(property, value);
  }
  el.shadowRoot!.append(probe);
  const computed = getComputedStyle(probe);
  const resolved: Record<string, string> = {};
  for (const [property] of declarations) {
    resolved[property] = computed.getPropertyValue(property);
  }
  probe.remove();
  return resolved;
}

/**
 * Reads the size each composed control resolved, as a property rather than an attribute: both
 * controls reflect their own `size`, so an attribute read cannot tell "the row forwarded nothing"
 * apart from "the control reflected its own default".
 */
function rowSizes(el: LyraRetrievalSearch): {
  query: string | undefined;
  mode: string | undefined;
} {
  const query = el.shadowRoot!.querySelector('[part="query"]') as
    | (HTMLElement & { size?: string })
    | null;
  const mode = el.shadowRoot!.querySelector('[part="mode"]') as
    | (HTMLElement & { size?: string })
    | null;
  return { query: query?.size, mode: mode?.size };
}

function submitMinHeight(el: LyraRetrievalSearch): string {
  return getComputedStyle(
    el.shadowRoot!.querySelector<HTMLElement>('[part="submit"]')!
  ).getPropertyValue('min-block-size');
}

async function row(): Promise<LyraRetrievalSearch> {
  const el = await fixture<LyraRetrievalSearch>(
    html`<lr-retrieval-search></lr-retrieval-search>`
  );
  await el.updateComplete;
  return el;
}

describe('lr-retrieval-search query-row sizing', () => {
  it('leaves every control in the row on its own default while no size is set', async () => {
    const el = await row();
    const floor = resolveInShadow(el, [
      ['min-block-size', 'var(--lr-icon-button-size)'],
    ]);

    expect(el.size).to.equal(undefined);
    expect(el.hasAttribute('size')).to.equal(false);
    expect(rowSizes(el)).to.deep.equal({ query: 'm', mode: 'm' });
    expect(submitMinHeight(el)).to.equal(floor['min-block-size']);
  });

  it('puts the whole row on one tier, submit button included', async () => {
    const el = await row();
    el.size = 'l';
    await el.updateComplete;

    const expected = resolveInShadow(el, [
      ['min-block-size', 'var(--lr-form-control-height)'],
    ]);
    expect(el.getAttribute('size')).to.equal('l');
    expect(rowSizes(el)).to.deep.equal({ query: 'l', mode: 'l' });
    expect(
      submitMinHeight(el),
      'the native submit button has to be tiered by this component, not by forwarding'
    ).to.equal(expected['min-block-size']);
  });

  it('keeps the submit button above the shared tap-target floor at the smallest tier', async () => {
    const el = await row();
    el.size = '2xs';
    await el.updateComplete;

    const floor = resolveInShadow(el, [
      ['min-block-size', 'var(--lr-icon-button-size)'],
    ]);
    const tier = resolveInShadow(el, [
      ['min-block-size', 'var(--lr-form-control-height)'],
    ]);
    expect(
      parseFloat(tier['min-block-size']!) <
        parseFloat(floor['min-block-size']!),
      'the 2xs tier must actually be shorter than the floor for this test to mean anything'
    ).to.equal(true);
    expect(submitMinHeight(el)).to.equal(floor['min-block-size']);
  });

  it('drops an unsupported size back to the untiered row and removes the attribute', async () => {
    const el = await row();
    el.size = 'l';
    await el.updateComplete;
    el.size = 'huge' as never;
    await el.updateComplete;

    const floor = resolveInShadow(el, [
      ['min-block-size', 'var(--lr-icon-button-size)'],
    ]);
    expect(el.size).to.equal(undefined);
    expect(el.hasAttribute('size')).to.equal(false);
    expect(rowSizes(el)).to.deep.equal({ query: 'm', mode: 'm' });
    expect(submitMinHeight(el)).to.equal(floor['min-block-size']);
  });
});
