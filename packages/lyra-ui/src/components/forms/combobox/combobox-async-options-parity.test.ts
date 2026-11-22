import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-combobox.js';
import type { LyraCombobox, ComboboxSource, ComboboxRequest, ComboboxOptions } from '../../lr-combobox.js';
import { rearmDevWarnings } from '../../../../test/expected-dev-warnings.js';

beforeEach(() => rearmDevWarnings('lr-combobox-source-rejected'));

const silenced = async (run: () => Promise<void>): Promise<void> => {
  const original = console.warn;
  console.warn = () => {};
  try {
    await run();
  } finally {
    console.warn = original;
  }
};

const rows = (query: string) => [{ value: query || 'a', label: query || 'Alpha' }];

const optionTexts = (el: LyraCombobox): string[] =>
  Array.from(el.shadowRoot!.querySelectorAll('[part~="option"]'), node => (node.textContent ?? '').trim());

describe('lr-combobox dataSource', () => {
  it('calls the provider with one { query, signal } request object', async () => {
    const requests: ComboboxRequest[] = [];
    const el = await fixture<LyraCombobox>(html`<lr-combobox source-delay="0"></lr-combobox>`);
    expect(el.dataSource).to.equal(null);
    const provider = (request: ComboboxRequest) => {
      requests.push(request);
      return rows(request.query);
    };
    el.dataSource = provider;
    expect(el.dataSource === provider).to.equal(true);
    el.open = true;
    await waitUntil(() => optionTexts(el).length === 1, 'the synchronous result renders');
    expect(requests.length).to.equal(1);
    expect(requests[0]!.query).to.equal('');
    expect(requests[0]!.signal instanceof AbortSignal).to.equal(true);
    el.inputValue = 'be';
    await waitUntil(() => requests.length === 2, 'the typed query reaches the provider');
    expect(requests[1]!.query).to.equal('be');
  });

  it('accepts a promise of option objects, option elements, or option markup', async () => {
    const element = document.createElement('lr-option');
    element.setAttribute('value', 'el');
    element.textContent = 'From element';
    const results: Record<string, ComboboxOptions> = {
      objects: [{ value: 'o', label: 'Object row', disabled: true }],
      elements: [element],
      markup: '<lr-option value="m1">Markup one</lr-option><lr-option value="m2" disabled>Markup two</lr-option>',
    };
    const el = await fixture<LyraCombobox>(html`<lr-combobox source-delay="0" open></lr-combobox>`);
    el.dataSource = async ({ query }) => results[query] ?? [];
    el.inputValue = 'objects';
    await waitUntil(() => optionTexts(el).join() === 'Object row', 'object rows');
    expect(el.shadowRoot!.querySelector('[part~="option"]')!.getAttribute('aria-disabled')).to.equal('true');
    el.inputValue = 'elements';
    await waitUntil(() => optionTexts(el).join() === 'From element', 'element rows');
    expect(element.isConnected, 'a returned element is read, never adopted').to.equal(false);
    el.inputValue = 'markup';
    await waitUntil(() => optionTexts(el).join() === 'Markup one,Markup two', 'markup rows');
    const options = el.shadowRoot!.querySelectorAll('[part~="option"]');
    expect(options[1]!.getAttribute('aria-disabled')).to.equal('true');
  });

  it('never runs script or handlers from returned markup', async () => {
    const win = window as unknown as { __comboboxMarkupRan?: boolean };
    delete win.__comboboxMarkupRan;
    const el = await fixture<LyraCombobox>(html`<lr-combobox source-delay="0" open></lr-combobox>`);
    el.dataSource = () =>
      '<lr-option value="x">Safe<img src="data:," onerror="window.__comboboxMarkupRan = true"></lr-option><script>window.__comboboxMarkupRan = true</script>';
    await waitUntil(() => optionTexts(el).join() === 'Safe', 'only the text survives');
    // wait-reason: asserting a would-be image error handler never fires (negative assertion)
    await aTimeout(40);
    expect(win.__comboboxMarkupRan).to.equal(undefined);
    expect(el.shadowRoot!.querySelector('img, script') === null).to.equal(true);
  });

  it('replaces source and reads null once source is assigned', async () => {
    const legacy: ComboboxSource = async () => [{ value: 'y', label: 'Legacy' }];
    const el = await fixture<LyraCombobox>(html`<lr-combobox source-delay="0" open></lr-combobox>`);
    el.dataSource = () => [{ value: 'x', label: 'Upstream' }];
    await waitUntil(() => optionTexts(el).join() === 'Upstream', 'dataSource rows');
    expect(typeof el.source).to.equal('function');
    el.source = legacy;
    expect(el.dataSource).to.equal(null);
    await waitUntil(() => optionTexts(el).join() === 'Legacy', 'source rows replace them');
    el.dataSource = () => [{ value: 'z', label: 'Again' }];
    await waitUntil(() => optionTexts(el).join() === 'Again', 'dataSource replaces source');
    el.dataSource = null;
    expect(el.source).to.equal(null);
    expect(el.dataSource).to.equal(null);
  });

  it('reports a provider rejection through the failed state and lr-options-error', async () => {
    const failure = new Error('down');
    const el = await fixture<LyraCombobox>(html`<lr-combobox source-delay="0" open></lr-combobox>`);
    let error: unknown;
    el.addEventListener('lr-options-error', event => { error = event.detail.error; });
    await silenced(async () => {
      el.dataSource = () => Promise.reject(failure);
      await waitUntil(() => error !== undefined, 'the rejection is reported');
    });
    expect(error === failure).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="source-error-row"]') !== null).to.equal(true);
  });
});

describe('lr-combobox lr-options-request', () => {
  it('fires once per call with the query and the signal the source receives', async () => {
    const seen: Array<{ query: string; signal: AbortSignal; cancelable: boolean; bubbles: boolean; composed: boolean }> = [];
    let received: AbortSignal | undefined;
    const source: ComboboxSource = async (query, { signal }) => {
      received = signal;
      return rows(query);
    };
    const el = await fixture<LyraCombobox>(html`<lr-combobox source-delay="0" .source=${source}></lr-combobox>`);
    el.addEventListener('lr-options-request', event => {
      seen.push({ ...event.detail, cancelable: event.cancelable, bubbles: event.bubbles, composed: event.composed });
    });
    el.open = true;
    await waitUntil(() => seen.length === 1, 'the open query is announced');
    expect(seen[0]!.query).to.equal('');
    expect(seen[0]!.signal === received).to.equal(true, 'the event shares the source signal');
    expect(seen[0]!.cancelable).to.equal(false);
    expect(seen[0]!.bubbles && seen[0]!.composed).to.equal(true);
    el.inputValue = 'be';
    await waitUntil(() => seen.length === 2, 'a typed query is announced');
    expect(seen[1]!.query).to.equal('be');
  });

  it('aborts the signal when a newer request supersedes it and when the control disconnects', async () => {
    const signals: AbortSignal[] = [];
    const el = await fixture<LyraCombobox>(
      html`<lr-combobox source-delay="0" open .source=${(async () => new Promise(() => {})) as ComboboxSource}></lr-combobox>`
    );
    el.addEventListener('lr-options-request', event => signals.push(event.detail.signal));
    el.inputValue = 'a';
    await waitUntil(() => signals.length === 1, 'first request');
    el.inputValue = 'ab';
    await waitUntil(() => signals.length === 2, 'second request');
    expect(signals[0]!.aborted).to.equal(true);
    expect(signals[1]!.aborted).to.equal(false);
    el.remove();
    expect(signals[1]!.aborted).to.equal(true);
  });

  it('does not fire without a source or below the minimum query length', async () => {
    const el = await fixture<LyraCombobox>(html`<lr-combobox source-delay="0" min-query-length="3" open></lr-combobox>`);
    let count = 0;
    el.addEventListener('lr-options-request', () => count++);
    el.inputValue = 'ab';
    el.source = async () => [];
    // wait-reason: asserting no call is made below the minimum (negative assertion)
    await aTimeout(40);
    expect(count).to.equal(0);
  });
});

describe('lr-combobox lr-options-error', () => {
  it('fires beside lr-source-error with the upstream detail shape', async () => {
    const failure = new Error('down');
    const el = await fixture<LyraCombobox>(html`<lr-combobox source-delay="0" open></lr-combobox>`);
    const order: string[] = [];
    let detail: { error: unknown; request: { query: string } } | undefined;
    el.addEventListener('lr-source-error', () => order.push('source'));
    el.addEventListener('lr-options-error', event => {
      order.push('options');
      detail = event.detail;
      expect(event.cancelable).to.equal(false);
    });
    await silenced(async () => {
      el.source = async () => { throw failure; };
      await waitUntil(() => order.length === 2, 'both events fire once');
    });
    expect(order).to.deep.equal(['source', 'options']);
    expect(detail!.error === failure).to.equal(true);
    expect(detail!.request).to.deep.equal({ query: '' });
  });

  it('does not fire for a superseded request', async () => {
    let calls = 0;
    const el = await fixture<LyraCombobox>(html`<lr-combobox source-delay="0" open></lr-combobox>`);
    let errors = 0;
    el.addEventListener('lr-options-error', () => errors++);
    await silenced(async () => {
      el.source = (async (_query: string, { signal }: { signal: AbortSignal }) => {
        calls++;
        if (calls === 1) {
          await new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
        }
        return [{ value: 'a', label: 'A' }];
      }) as ComboboxSource;
      await waitUntil(() => calls === 1, 'first call');
      el.inputValue = 'x';
      await waitUntil(() => calls === 2, 'second call');
      // wait-reason: asserting the superseded rejection stays silent (negative assertion)
      await aTimeout(30);
    });
    expect(errors).to.equal(0);
  });
});

describe('lr-combobox reload()', () => {
  it('re-runs the current query immediately, like refresh()', async () => {
    const queries: string[] = [];
    const source: ComboboxSource = async query => { queries.push(query); return rows(query); };
    const el = await fixture<LyraCombobox>(html`<lr-combobox source-delay="0" open .source=${source}></lr-combobox>`);
    await waitUntil(() => queries.length === 1, 'open query');
    el.inputValue = 'be';
    await waitUntil(() => queries.includes('be'), 'typed query');
    const before = queries.length;
    el.reload();
    await waitUntil(() => queries.length === before + 1, 'reload re-invokes the source');
    expect(queries[queries.length - 1]).to.equal('be');
  });

  it('queues while closed and is inert without a source', async () => {
    const queries: string[] = [];
    const source: ComboboxSource = async query => { queries.push(query); return rows(query); };
    const bare = await fixture<LyraCombobox>(html`<lr-combobox></lr-combobox>`);
    expect(() => bare.reload()).to.not.throw();
    const el = await fixture<LyraCombobox>(html`<lr-combobox source-delay="0" .source=${source}></lr-combobox>`);
    const before = queries.length;
    el.reload();
    // wait-reason: asserting a closed combobox does not fetch (negative assertion)
    await aTimeout(30);
    expect(queries.length).to.equal(before);
    el.open = true;
    await waitUntil(() => queries.length === before + 1, 'the queued reload runs on open');
  });
});

describe('lr-combobox filter-debounce alias', () => {
  it('maps the attribute and property onto source-delay', async () => {
    const el = await fixture<LyraCombobox>(html`<lr-combobox filter-debounce="0"></lr-combobox>`);
    expect(el.sourceDelay).to.equal(0);
    expect(el.filterDebounce).to.equal(0);
    el.filterDebounce = 350;
    expect(el.sourceDelay).to.equal(350);
    const defaults = await fixture<LyraCombobox>(html`<lr-combobox></lr-combobox>`);
    expect(defaults.sourceDelay, 'unset keeps the existing default').to.equal(200);
    expect(defaults.filterDebounce).to.equal(200);
  });
});

describe('lr-combobox async options accessibility', () => {
  it('stays accessible with a dataSource listbox open', async () => {
    const el = await fixture<LyraCombobox>(
      html`<lr-combobox label="City" source-delay="0" open .dataSource=${async ({ query }: ComboboxRequest) => rows(query)}></lr-combobox>`
    );
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part~="option"]').length === 1, 'rows render');
    await expect(el).to.be.accessible();
  });
});
