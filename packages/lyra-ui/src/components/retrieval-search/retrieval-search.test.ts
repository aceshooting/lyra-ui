import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './retrieval-search.js';
import type { LyraRetrievalSearch } from './retrieval-search.js';
import type { RetrievalQuery, CancelEventDetail } from '../../ai/types.js';
import type { RetrievalFiltersChangeDetail } from './retrieval-search.class.js';

function queryInputOf(el: LyraRetrievalSearch): HTMLElement {
  return el.shadowRoot!.querySelector('[part="query"]') as HTMLElement;
}

function modeOf(el: LyraRetrievalSearch): HTMLElement {
  return el.shadowRoot!.querySelector('[part="mode"]') as HTMLElement;
}

function submitButtonOf(el: LyraRetrievalSearch): HTMLButtonElement {
  return el.shadowRoot!.querySelector('[part="submit"]') as HTMLButtonElement;
}

function enterKeydown(init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...init });
}

it('defaults to an empty query, hybrid mode, no filters/scope, not loading, no error, not empty', async () => {
  const el = (await fixture(html`<lr-retrieval-search></lr-retrieval-search>`)) as LyraRetrievalSearch;
  expect(el.query).to.equal('');
  expect(el.mode).to.equal('hybrid');
  expect(el.filters).to.deep.equal({});
  expect(el.scope).to.deep.equal([]);
  expect(el.loading).to.be.false;
  expect(el.errorText).to.equal('');
  expect(el.empty).to.be.false;
});

it('renders a query lr-input, a 3-item vector/keyword/hybrid mode segmented, and a submit button', async () => {
  const el = (await fixture(html`<lr-retrieval-search></lr-retrieval-search>`)) as LyraRetrievalSearch;
  expect(queryInputOf(el).tagName.toLowerCase()).to.equal('lr-input');
  const segmented = modeOf(el) as HTMLElement & { items: { value: string; label: string }[] };
  expect(segmented.tagName.toLowerCase()).to.equal('lr-segmented');
  expect(segmented.items.map((i) => i.value)).to.deep.equal(['vector', 'keyword', 'hybrid']);
  expect(submitButtonOf(el)).to.exist;
});

it('updates query as the composed lr-input reports user edits', async () => {
  const el = (await fixture(html`<lr-retrieval-search></lr-retrieval-search>`)) as LyraRetrievalSearch;
  queryInputOf(el).dispatchEvent(new CustomEvent('lr-input', { detail: { value: 'solar inverter faults' }, bubbles: true }));
  await el.updateComplete;
  expect(el.query).to.equal('solar inverter faults');
});

it('updates mode as the composed lr-segmented reports a change', async () => {
  const el = (await fixture(html`<lr-retrieval-search></lr-retrieval-search>`)) as LyraRetrievalSearch;
  modeOf(el).dispatchEvent(new CustomEvent('lr-change', { detail: { value: 'vector' }, bubbles: true }));
  await el.updateComplete;
  expect(el.mode).to.equal('vector');
});

it('Enter in the query field submits, emitting lr-search with the full RetrievalQuery', async () => {
  const el = (await fixture(html`<lr-retrieval-search></lr-retrieval-search>`)) as LyraRetrievalSearch;
  el.query = 'panel degradation';
  el.mode = 'keyword';
  el.filters = { type: 'pdf' };
  el.scope = ['engineering-docs'];
  await el.updateComplete;

  const listener = oneEvent(el, 'lr-search');
  queryInputOf(el).dispatchEvent(enterKeydown());
  const ev = await listener;
  expect(ev.detail).to.deep.equal({
    text: 'panel degradation',
    mode: 'keyword',
    filters: { type: 'pdf' },
    scope: ['engineering-docs'],
  } satisfies RetrievalQuery);
});

it('clicking the submit button while idle also submits', async () => {
  const el = (await fixture(html`<lr-retrieval-search query="inverter trip"></lr-retrieval-search>`)) as LyraRetrievalSearch;
  const listener = oneEvent(el, 'lr-search');
  submitButtonOf(el).click();
  const ev = await listener;
  expect((ev.detail as RetrievalQuery).text).to.equal('inverter trip');
});

it('never treats an IME composition Enter as a submit trigger (isComposing)', async () => {
  const el = (await fixture(html`<lr-retrieval-search></lr-retrieval-search>`)) as LyraRetrievalSearch;
  let submitted = false;
  el.addEventListener('lr-search', () => (submitted = true));
  queryInputOf(el).dispatchEvent(enterKeydown({ isComposing: true }));
  await el.updateComplete;
  expect(submitted).to.be.false;
});

it('never treats an IME composition Enter as a submit trigger (keyCode 229 fallback)', async () => {
  const el = (await fixture(html`<lr-retrieval-search></lr-retrieval-search>`)) as LyraRetrievalSearch;
  let submitted = false;
  el.addEventListener('lr-search', () => (submitted = true));
  const ev = enterKeydown();
  Object.defineProperty(ev, 'keyCode', { value: 229 });
  queryInputOf(el).dispatchEvent(ev);
  await el.updateComplete;
  expect(submitted).to.be.false;
});

describe('loading / cancellation', () => {
  it('renders a Cancel affordance instead of Search while loading', async () => {
    const el = (await fixture(html`<lr-retrieval-search></lr-retrieval-search>`)) as LyraRetrievalSearch;
    expect(submitButtonOf(el).textContent!.trim()).to.equal('Search');
    el.loading = true;
    await el.updateComplete;
    expect(submitButtonOf(el).textContent!.trim()).to.equal('Cancel');
  });

  it('clicking Cancel while loading emits only lr-cancel, never lr-search', async () => {
    const el = (await fixture(html`<lr-retrieval-search loading></lr-retrieval-search>`)) as LyraRetrievalSearch;
    let searched = false;
    el.addEventListener('lr-search', () => (searched = true));
    const listener = oneEvent(el, 'lr-cancel');
    submitButtonOf(el).click();
    const ev = await listener;
    expect((ev.detail as CancelEventDetail).reason).to.be.undefined;
    expect(searched).to.be.false;
  });

  it('submitting again (Enter) while loading supersedes: emits lr-cancel then lr-search', async () => {
    const el = (await fixture(html`<lr-retrieval-search loading query="first"></lr-retrieval-search>`)) as LyraRetrievalSearch;
    const cancelPromise = oneEvent(el, 'lr-cancel');
    const searchPromise = oneEvent(el, 'lr-search');
    el.query = 'second';
    await el.updateComplete;
    queryInputOf(el).dispatchEvent(enterKeydown());
    const [cancelEv, searchEv] = await Promise.all([cancelPromise, searchPromise]);
    expect((cancelEv.detail as CancelEventDetail).reason).to.equal('superseded');
    expect((searchEv.detail as RetrievalQuery).text).to.equal('second');
  });
});

describe('active filters/scope chips', () => {
  it('renders no chip-group when there are no filters and no scope', async () => {
    const el = (await fixture(html`<lr-retrieval-search></lr-retrieval-search>`)) as LyraRetrievalSearch;
    expect(el.shadowRoot!.querySelector('[part="filters"]')).to.not.exist;
  });

  it('renders removable chips for scope entries and filter entries', async () => {
    const el = (await fixture(html`<lr-retrieval-search></lr-retrieval-search>`)) as LyraRetrievalSearch;
    el.scope = ['engineering-docs'];
    el.filters = { type: 'pdf' };
    await el.updateComplete;
    const chips = Array.from(el.shadowRoot!.querySelectorAll('[part="filters"] lr-chip'));
    expect(chips.length).to.equal(2);
    const scopeChip = el.shadowRoot!.querySelector('[part="filters"] lr-chip[value="engineering-docs"]')!;
    expect(scopeChip.textContent!.trim()).to.equal('engineering-docs');
    const filterChip = el.shadowRoot!.querySelector('[part="filters"] lr-chip[value="type"]')!;
    expect(filterChip.textContent!.trim()).to.equal('type: pdf');
  });

  it('removing a scope chip updates scope and emits lr-filters-change with the full next state', async () => {
    const el = (await fixture(html`<lr-retrieval-search></lr-retrieval-search>`)) as LyraRetrievalSearch;
    el.scope = ['engineering-docs', 'support-tickets'];
    el.filters = { type: 'pdf' };
    await el.updateComplete;
    const chip = el.shadowRoot!.querySelector('[part="filters"] lr-chip[value="engineering-docs"]')!;
    const listener = oneEvent(el, 'lr-filters-change');
    chip.dispatchEvent(new CustomEvent('lr-remove', { detail: { value: 'engineering-docs' }, bubbles: true }));
    const ev = await listener;
    expect(el.scope).to.deep.equal(['support-tickets']);
    expect((ev.detail as RetrievalFiltersChangeDetail)).to.deep.equal({
      filters: { type: 'pdf' },
      scope: ['support-tickets'],
    });
  });

  it('removing a filter chip updates filters and emits lr-filters-change', async () => {
    const el = (await fixture(html`<lr-retrieval-search></lr-retrieval-search>`)) as LyraRetrievalSearch;
    el.scope = ['engineering-docs'];
    el.filters = { type: 'pdf', year: 2025 };
    await el.updateComplete;
    const chip = el.shadowRoot!.querySelector('[part="filters"] lr-chip[value="type"]')!;
    const listener = oneEvent(el, 'lr-filters-change');
    chip.dispatchEvent(new CustomEvent('lr-remove', { detail: { value: 'type' }, bubbles: true }));
    const ev = await listener;
    expect(el.filters).to.deep.equal({ year: 2025 });
    expect((ev.detail as RetrievalFiltersChangeDetail)).to.deep.equal({
      filters: { year: 2025 },
      scope: ['engineering-docs'],
    });
  });

  it('formats a non-string filter value for its chip label', async () => {
    const el = (await fixture(html`<lr-retrieval-search></lr-retrieval-search>`)) as LyraRetrievalSearch;
    el.filters = { verified: true, tags: ['solar', 'inverter'] };
    await el.updateComplete;
    const verifiedChip = el.shadowRoot!.querySelector('[part="filters"] lr-chip[value="verified"]')!;
    expect(verifiedChip.textContent!.trim()).to.equal('verified: true');
    const tagsChip = el.shadowRoot!.querySelector('[part="filters"] lr-chip[value="tags"]')!;
    expect(tagsChip.textContent!.trim()).to.equal('tags: solar, inverter');
  });
});

describe('loading / error / empty status region', () => {
  it('shows a spinner while loading', async () => {
    const el = (await fixture(html`<lr-retrieval-search loading></lr-retrieval-search>`)) as LyraRetrievalSearch;
    expect(el.shadowRoot!.querySelector('[part="spinner"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="error"]')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="empty"]')).to.not.exist;
  });

  it('shows the host-supplied error message verbatim in a role="alert" region', async () => {
    const el = (await fixture(
      html`<lr-retrieval-search error-text="The retrieval service timed out."></lr-retrieval-search>`,
    )) as LyraRetrievalSearch;
    const error = el.shadowRoot!.querySelector('[part="error"]')!;
    expect(error.getAttribute('role')).to.equal('alert');
    expect(error.textContent!.trim()).to.equal('The retrieval service timed out.');
  });

  it('shows a compact lr-empty when empty is true and there is no error/loading', async () => {
    const el = (await fixture(html`<lr-retrieval-search empty></lr-retrieval-search>`)) as LyraRetrievalSearch;
    const empty = el.shadowRoot!.querySelector('[part="empty"]')!;
    expect(empty).to.exist;
    expect(empty.tagName.toLowerCase()).to.equal('lr-empty');
  });

  it('prioritizes loading over error and empty', async () => {
    const el = (await fixture(
      html`<lr-retrieval-search loading error-text="stale error" empty></lr-retrieval-search>`,
    )) as LyraRetrievalSearch;
    expect(el.shadowRoot!.querySelector('[part="spinner"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="error"]')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="empty"]')).to.not.exist;
  });

  it('prioritizes error over empty', async () => {
    const el = (await fixture(
      html`<lr-retrieval-search error-text="failed" empty></lr-retrieval-search>`,
    )) as LyraRetrievalSearch;
    expect(el.shadowRoot!.querySelector('[part="error"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="empty"]')).to.not.exist;
  });
});

describe('accessible naming', () => {
  it('names the role="search" landmark from the localized default, label, then a host aria-label in increasing precedence', async () => {
    const el1 = (await fixture(html`<lr-retrieval-search></lr-retrieval-search>`)) as LyraRetrievalSearch;
    const base1 = el1.shadowRoot!.querySelector('[part="base"]')!;
    expect(base1.getAttribute('role')).to.equal('search');
    expect(base1.getAttribute('aria-label')).to.equal('Retrieval search');

    const el2 = (await fixture(html`<lr-retrieval-search label="Knowledge base search"></lr-retrieval-search>`)) as LyraRetrievalSearch;
    expect(el2.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Knowledge base search');

    const el3 = (await fixture(
      html`<lr-retrieval-search label="Knowledge base search" aria-label="Support search"></lr-retrieval-search>`,
    )) as LyraRetrievalSearch;
    expect(el3.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Support search');
  });
});

describe('localization', () => {
  it('resolves the mode segmented labels and submit/cancel button text through this.strings overrides', async () => {
    const el = (await fixture(
      html`<lr-retrieval-search
        loading
        .strings=${{
          retrievalModeVector: 'Vecteur',
          retrievalModeKeyword: 'Mot-clé',
          retrievalModeHybrid: 'Hybride',
          cancel: 'Annuler',
        }}
      ></lr-retrieval-search>`,
    )) as LyraRetrievalSearch;
    const segmented = modeOf(el) as HTMLElement & { items: { value: string; label: string }[] };
    expect(segmented.items.map((i) => i.label)).to.deep.equal(['Vecteur', 'Mot-clé', 'Hybride']);
    expect(submitButtonOf(el).textContent!.trim()).to.equal('Annuler');
  });

  it('resolves the filter-chip label template and empty description through this.strings overrides', async () => {
    const el = (await fixture(
      html`<lr-retrieval-search
        empty
        .strings=${{ retrievalFilterChipLabel: '{key} = {value}', retrievalSearchEmptyDescription: 'Aucun résultat.' }}
      ></lr-retrieval-search>`,
    )) as LyraRetrievalSearch;
    el.filters = { type: 'pdf' };
    await el.updateComplete;
    const chip = el.shadowRoot!.querySelector('[part="filters"] lr-chip[value="type"]')!;
    expect(chip.textContent!.trim()).to.equal('type = pdf');
    const empty = el.shadowRoot!.querySelector('[part="empty"]') as HTMLElement & { description: string };
    expect(empty.description).to.equal('Aucun résultat.');
  });
});

describe('RTL', () => {
  it('renders and functions correctly under dir="rtl" (mode selection, chip removal)', async () => {
    const el = (await fixture(html`<lr-retrieval-search dir="rtl"></lr-retrieval-search>`)) as LyraRetrievalSearch;
    el.scope = ['engineering-docs'];
    await el.updateComplete;

    modeOf(el).dispatchEvent(new CustomEvent('lr-change', { detail: { value: 'keyword' }, bubbles: true }));
    await el.updateComplete;
    expect(el.mode).to.equal('keyword');

    const chip = el.shadowRoot!.querySelector('[part="filters"] lr-chip[value="engineering-docs"]')!;
    const listener = oneEvent(el, 'lr-filters-change');
    chip.dispatchEvent(new CustomEvent('lr-remove', { detail: { value: 'engineering-docs' }, bubbles: true }));
    await listener;
    expect(el.scope).to.deep.equal([]);
  });
});

describe('320px allocation', () => {
  it('can shrink to a 320px allocation without overflowing', async () => {
    const wrapper = await fixture(html`
      <div style="display: flex; inline-size: 320px;">
        <lr-retrieval-search style="min-inline-size: 0; flex: 1 1 auto;"></lr-retrieval-search>
      </div>
    `);
    const el = wrapper.querySelector('lr-retrieval-search') as LyraRetrievalSearch;
    el.scope = ['engineering-docs', 'support-tickets', 'release-notes'];
    el.filters = { type: 'pdf', year: 2025 };
    await el.updateComplete;
    expect(el.getBoundingClientRect().width).to.be.at.most(320);
  });
});

describe('accessibility', () => {
  it('is accessible in a populated state (query, mode, filters, scope chips)', async () => {
    const el = (await fixture(html`<lr-retrieval-search query="inverter fault codes"></lr-retrieval-search>`)) as LyraRetrievalSearch;
    el.mode = 'vector';
    el.scope = ['engineering-docs'];
    el.filters = { type: 'pdf' };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="filters"] lr-chip').length).to.equal(2);
    await expect(el).to.be.accessible();
  });

  it('is accessible while loading', async () => {
    const el = (await fixture(html`<lr-retrieval-search loading query="inverter fault codes"></lr-retrieval-search>`)) as LyraRetrievalSearch;
    expect(el.shadowRoot!.querySelector('[part="spinner"]')).to.exist;
    await expect(el).to.be.accessible();
  });

  it('is accessible with an error', async () => {
    const el = (await fixture(
      html`<lr-retrieval-search error-text="The retrieval service timed out."></lr-retrieval-search>`,
    )) as LyraRetrievalSearch;
    await expect(el).to.be.accessible();
  });

  it('is accessible in the empty state', async () => {
    const el = (await fixture(html`<lr-retrieval-search empty query="no matches for this"></lr-retrieval-search>`)) as LyraRetrievalSearch;
    await expect(el).to.be.accessible();
  });
});
