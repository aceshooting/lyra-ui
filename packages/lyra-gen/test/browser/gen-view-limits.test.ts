import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { createCatalog, initialCatalog } from '../../src/catalog.js';
import { LyraGenViewElement } from '../../src/gen-view.js';
import { HARD_LIMITS } from '../../src/schema.js';
import type { LyraGenCatalog, LyraGenView } from '../../src/types.js';

function source(text: string, catalog: LyraGenCatalog = initialCatalog): LyraGenView {
  return { version: '1', surfaceId: 'limits', revision: 0, catalog: { id: catalog.id, version: catalog.version }, root: { id: 'copy', type: 'text', text } };
}

describe('generated view instance limits', () => {
  it('keeps unset defaults and rejects a current document when the host lowers its ceiling', async () => {
    const text = 'bounded content '.repeat(100);
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .document=${source(text)}></lr-gen-view>`);
    await waitUntil(() => element.status === 'ready', 'Generated controls become ready', { timeout: 5000 });
    expect(element.limits).to.equal(undefined);
    expect(element.shadowRoot!.querySelector('[data-gen-id="copy"]')?.textContent).to.equal(text);
    element.limits = { maxStringLength: 32 };
    await element.updateComplete;
    expect(element.status).to.equal('error');
    expect(element.shadowRoot!.querySelector('[data-gen-id="copy"]') === null).to.equal(true);
    element.limits = undefined;
    await element.updateComplete;
    await waitUntil(() => element.status === 'ready', 'Generated controls become ready', { timeout: 5000 });
    expect(element.shadowRoot!.querySelector('[data-gen-id="copy"]')?.textContent).to.equal(text);
  });

  it('rejects oversized documents before invoking a trusted lazy loader', async () => {
    let calls = 0;
    const catalog = createCatalog({ id: 'limits', version: '1', components: { text: { tag: 'p', properties: {}, text: true, load: async () => { calls++; } } } });
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${catalog} .document=${source('x'.repeat(100), catalog)} .limits=${{ maxStringLength: 32 }}></lr-gen-view>`);
    expect(element.status).to.equal('error');
    expect(calls).to.equal(0);
  });

  it('cannot expand above hard ceilings and restores invalid bound edits to the admitted state', async () => {
    const oversized = await fixture<LyraGenViewElement>(html`<lr-gen-view .document=${source('x'.repeat(HARD_LIMITS.maxStringLength + 1))} .limits=${{ maxStringLength: Number.MAX_SAFE_INTEGER }}></lr-gen-view>`);
    expect(oversized.status).to.equal('error');
    const document: LyraGenView = { ...source(''), root: { id: 'field', type: 'input', props: { label: 'Field', value: 'Start' }, bindings: { value: '/field' } } };
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .document=${document} .limits=${{ maxStringLength: 20 }}></lr-gen-view>`);
    await waitUntil(() => element.status === 'ready', 'Generated controls become ready', { timeout: 5000 });
    const input = element.shadowRoot!.querySelector<HTMLElement & { value: string }>('[data-gen-id="field"]')!;
    input.value = 'x'.repeat(21);
    const error = oneEvent(element, 'lr-gen-error');
    input.dispatchEvent(new CustomEvent('lr-input', { bubbles: true, composed: true }));
    await error;
    await element.updateComplete;
    expect(input.value).to.equal('Start');
  });
  it('keeps failure behavior identical with no observer or a throwing categories-only observer', async () => {
    const baseline = await fixture<LyraGenViewElement>(html`<lr-gen-view></lr-gen-view>`);
    const observed = await fixture<LyraGenViewElement>(html`<lr-gen-view></lr-gen-view>`);
    const categories: string[][] = [];
    observed.failureCategories = values => {
      categories.push([...values]);
      expect(Object.isFrozen(values)).to.equal(true);
      throw new Error('Observer failure');
    };
    const invalid = { ...source('Private value'), root: { id: 'copy', type: 'not-reviewed', text: 'Private value' } };
    const plainError = oneEvent(baseline, 'lr-gen-error');
    const observedError = oneEvent(observed, 'lr-gen-error');
    baseline.document = invalid;
    observed.document = invalid;
    expect((await plainError as CustomEvent).detail).to.deep.equal((await observedError as CustomEvent).detail);
    await Promise.all([baseline.updateComplete, observed.updateComplete]);
    expect(baseline.status).to.equal('error');
    expect(observed.status).to.equal('error');
    expect(observed.shadowRoot!.querySelector('[part="error"]')?.textContent).to.equal(baseline.shadowRoot!.querySelector('[part="error"]')?.textContent);
    expect(categories).to.deep.equal([['catalog']]);
    expect(JSON.stringify(categories)).not.to.contain('Private value');
  });

});
