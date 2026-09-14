import { expect, fixture, html } from '@open-wc/testing';
import './eval-dataset.js';
import type { LyraEvalDataset } from './eval-dataset.js';

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

function fieldGeometry(el: LyraEvalDataset): Record<string, string> {
  const computed = getComputedStyle(
    el.shadowRoot!.querySelector<HTMLInputElement>('[part="search-input"]')!
  );
  return {
    'min-block-size': computed.getPropertyValue('min-block-size'),
    'font-size': computed.getPropertyValue('font-size'),
    'padding-inline-start': computed.getPropertyValue('padding-inline-start'),
    'padding-inline-end': computed.getPropertyValue('padding-inline-end'),
    'padding-block-start': computed.getPropertyValue('padding-block-start'),
    'border-start-start-radius': computed.getPropertyValue(
      'border-start-start-radius'
    ),
  };
}

async function searchableDataset(): Promise<LyraEvalDataset> {
  const el = await fixture<LyraEvalDataset>(
    html`<lr-eval-dataset searchable></lr-eval-dataset>`
  );
  await el.updateComplete;
  return el;
}

describe('lr-eval-dataset search-field sizing', () => {
  it('renders the search field on exactly its pre-hook geometry when no hook is set', async () => {
    const el = await searchableDataset();
    const expected = resolveInShadow(el, [
      ['padding-inline-start', 'var(--lr-space-s)'],
      ['padding-inline-end', 'var(--lr-icon-button-size)'],
      ['padding-block-start', 'var(--lr-space-xs)'],
      ['border-start-start-radius', 'var(--lr-radius)'],
    ]);
    const geometry = fieldGeometry(el);

    // A field that declares no minimum of its own resolves as `auto` where it is a flex item and
    // as `0px` elsewhere; both mean the same thing, and both are what this field computed before
    // the hook existed.
    const unsetMinimum = geometry['min-block-size']!;
    expect(
      unsetMinimum === 'auto' || parseFloat(unsetMinimum) === 0,
      'an unset height hook must impose no minimum of its own'
    ).to.equal(true);
    expect(geometry['font-size']).to.equal(getComputedStyle(el).fontSize);
    expect(geometry['padding-inline-start']).to.equal(
      expected['padding-inline-start']
    );
    expect(geometry['padding-inline-end']).to.equal(
      expected['padding-inline-end']
    );
    expect(geometry['padding-block-start']).to.equal(
      expected['padding-block-start']
    );
    expect(geometry['border-start-start-radius']).to.equal(
      expected['border-start-start-radius']
    );
  });

  it('sizes the search field through --lr-eval-dataset-search-*', async () => {
    const el = await searchableDataset();
    el.style.setProperty('--lr-eval-dataset-search-min-height', '39px');
    el.style.setProperty('--lr-eval-dataset-search-font-size', '9px');
    el.style.setProperty('--lr-eval-dataset-search-padding-inline', '21px');
    el.style.setProperty('--lr-eval-dataset-search-padding-block', '23px');
    el.style.setProperty('--lr-eval-dataset-search-radius', '3px');
    await el.updateComplete;

    const geometry = fieldGeometry(el);
    const reservedEnd = resolveInShadow(el, [
      ['padding-inline-end', 'var(--lr-icon-button-size)'],
    ]);
    expect(geometry['min-block-size']).to.equal('39px');
    expect(geometry['font-size']).to.equal('9px');
    expect(geometry['padding-inline-start']).to.equal('21px');
    expect(geometry['padding-block-start']).to.equal('23px');
    expect(geometry['border-start-start-radius']).to.equal('3px');
    expect(
      geometry['padding-inline-end'],
      'the trailing gutter is reserved for the overlaid clear button, so it is not a knob'
    ).to.equal(reservedEnd['padding-inline-end']);
  });
});
