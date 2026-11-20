import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { twoFrames } from '../../../../test/frames.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { ComboboxSource, ComboboxSourceRow, LyraCombobox } from '../../lr-combobox.js';
import '../../lr-combobox.js';
import '../../lr-option.js';

type MinimumCombobox = LyraCombobox & { minQueryLength: number };
const input = (el: LyraCombobox): HTMLInputElement =>
  el.shadowRoot!.querySelector<HTMLInputElement>('[part="combobox-input"]')!;
const optionCount = (el: LyraCombobox): number =>
  el.shadowRoot!.querySelectorAll('[part="option"]').length;
async function settle(el: LyraCombobox): Promise<void> {
  await el.updateComplete;
  await twoFrames(el.ownerDocument);
  await el.updateComplete;
}
function edit(el: LyraCombobox, text: string): void {
  input(el).value = text;
  input(el).dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: text }));
}
function expectClosed(el: LyraCombobox): void {
  expect(el.open).to.equal(false);
  expect(el.hasAttribute('open')).to.equal(false);
  expect(input(el).getAttribute('aria-expanded')).to.equal('false');
  expect(input(el).hasAttribute('aria-activedescendant')).to.equal(false);
}

describe('lr-combobox minimum query length', () => {
  for (const explicitZero of [false, true]) {
    it(`preserves empty-query opening and selected-label warmup with ${explicitZero ? 'explicit zero' : 'the property unset'}`, async () => {
      const calls: string[] = [];
      const source: ComboboxSource = async query => {
        calls.push(query);
        return [{ value: 'known', label: 'Known' }];
      };
      const el = await fixture<MinimumCombobox>(html`<lr-combobox label="Search" value="known" source-delay="0"
        .source=${source}></lr-combobox>`);
      if (explicitZero) el.minQueryLength = 0;
      expect(el.minQueryLength).to.equal(0);
      await waitUntil(() => input(el).value === 'Known', 'the existing selected-value warmup resolves its label');
      expect(calls.includes('')).to.equal(true);
      await el.show();
      expect(el.open).to.equal(true);
      expect(optionCount(el)).to.equal(1);
      await expect(el).to.be.accessible();
    });
  }

  it('normalizes the attribute and property as a finite nonnegative count', async () => {
    const el = await fixture<MinimumCombobox>(html`<lr-combobox label="Search" min-query-length="3.9"></lr-combobox>`);
    expect(el.minQueryLength).to.equal(3);
    for (const value of [-2, Number.NaN, Number.POSITIVE_INFINITY]) {
      el.minQueryLength = value;
      expect(el.minQueryLength).to.equal(0);
    }
    el.setAttribute('min-query-length', '4');
    await el.updateComplete;
    expect(el.minQueryLength).to.equal(4);
    el.removeAttribute('min-query-length');
    await el.updateComplete;
    expect(el.minQueryLength).to.equal(0);
  });

  it('blocks initial markup, focus, click, direct open, show and arrows without hanging show callers', async () => {
    const el = await fixture<MinimumCombobox>(html`<lr-combobox label="Search" min-query-length="3" open>
      <lr-option value="alpha">Alpha</lr-option>
    </lr-combobox>`);
    await settle(el);
    expectClosed(el);
    const events: string[] = [];
    for (const name of ['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide', 'lr-change', 'lr-activate']) {
      el.addEventListener(name, () => events.push(name));
    }
    await focusByKeyboard(input(el));
    el.click();
    el.open = true;
    let resolved = false;
    const showing = el.show().then(() => { resolved = true; });
    await Promise.resolve();
    expect(resolved, 'a rejected show resolves immediately').to.equal(true);
    await showing;
    await sendKeys({ press: 'ArrowDown' });
    await sendKeys({ press: 'ArrowUp' });
    await settle(el);
    expectClosed(el);
    expect(el.value).to.equal('');
    expect(events).to.deep.equal([]);
    expect(el.shadowRoot!.activeElement === input(el)).to.equal(true);
  });

  it('counts trimmed Unicode code points while preserving the raw provider query', async () => {
    const calls: string[] = [];
    const source: ComboboxSource = async query => {
      calls.push(query);
      return [{ value: 'match', label: 'Match' }];
    };
    const el = await fixture<MinimumCombobox>(html`<lr-combobox label="Search" min-query-length="2" source-delay="0"
      .source=${source}></lr-combobox>`);
    el.inputValue = '  😀  ';
    el.refresh();
    await settle(el);
    expectClosed(el);
    expect(calls).to.deep.equal([]);
    expect(input(el).value).to.equal('  😀  ');
    edit(el, '  😀a  ');
    await waitUntil(() => calls.includes('  😀a  '), 'two trimmed code points reach the provider');
    await waitUntil(() => el.open && optionCount(el) === 1, 'the eligible query opens populated suggestions');
    expect(calls.every(query => query === '  😀a  ')).to.equal(true);
    expect(input(el).value).to.equal('  😀a  ');
    await expect(el).to.be.accessible();
  });

  it('keeps the native draft, caret, focus and committed row when shrinking forces a noncancelable close', async () => {
    const el = await fixture<MinimumCombobox>(html`<lr-combobox label="Search" min-query-length="3" value="known">
      <lr-option value="known">Known</lr-option><lr-option value="alpha">Alpha</lr-option>
    </lr-combobox>`);
    const selectionEvents: string[] = [];
    const hides: boolean[] = [];
    for (const name of ['lr-change', 'lr-activate', 'lr-clear']) el.addEventListener(name, () => selectionEvents.push(name));
    el.addEventListener('lr-hide', event => { hides.push(event.cancelable); event.preventDefault(); });
    await focusByKeyboard(input(el));
    el.select();
    await sendKeys({ type: 'alpha' });
    await waitUntil(() => el.open && optionCount(el) > 0, 'qualifying native input opens suggestions');
    for (let index = 0; index < 4; index++) await sendKeys({ press: 'Backspace' });
    await waitUntil(() => !el.open, 'the shortened query closes suggestions despite the ordinary hide veto');
    await settle(el);
    expectClosed(el);
    expect(el.inputValue).to.equal('a');
    expect(input(el).value).to.equal('a');
    expect(input(el).selectionStart).to.equal(1);
    expect(el.shadowRoot!.activeElement === input(el)).to.equal(true);
    expect(el.value).to.equal('known');
    expect(el.selectedRows.map(row => row.label)).to.deep.equal(['Known']);
    expect(hides).to.deep.equal([false]);
    expect(selectionEvents).to.deep.equal([]);
    await expect(el).to.be.accessible();
  });

  it('cancels an armed debounce below threshold before any source callback', async () => {
    const calls: string[] = [];
    const el = await fixture<MinimumCombobox>(html`<lr-combobox label="Search" min-query-length="3" source-delay="60"
      .source=${async (query: string) => { calls.push(query); return []; }}></lr-combobox>`);
    el.inputValue = 'ready';
    el.inputValue = 'x';
    // wait-reason: the negative assertion covers the explicit 60ms provider debounce with a real timer margin.
    await aTimeout(120);
    expect(calls).to.deep.equal([]);
    el.sourceDelay = 0;
    el.inputValue = 'recovered';
    await waitUntil(() => calls.includes('recovered'), 'a fresh eligible query can still invoke the provider');
    expect(calls).to.deep.equal(['recovered']);
  });

  for (const outcome of ['resolve', 'reject'] as const) {
    it(`aborts an in-flight query and ignores its late ${outcome} after shrinking`, async () => {
      const calls: { query: string; signal: AbortSignal; resolve: (rows: readonly ComboboxSourceRow[]) => void; reject: (error: Error) => void }[] = [];
      const source: ComboboxSource = (query, { signal }) => new Promise((resolve, reject) => {
        calls.push({ query, signal, resolve, reject });
      });
      const el = await fixture<MinimumCombobox>(html`<lr-combobox label="Search" min-query-length="3" source-delay="0"
        .source=${source}></lr-combobox>`);
      const errors: string[] = [];
      el.addEventListener('lr-source-error', event => errors.push(event.detail.query));
      el.inputValue = 'ready';
      void el.show();
      await waitUntil(() => calls.some(call => call.query === 'ready'), 'the qualifying request is physically in flight');
      const stale = calls.find(call => call.query === 'ready')!;
      el.inputValue = 'x';
      await settle(el);
      expect(stale.signal.aborted).to.equal(true);
      expectClosed(el);
      expect(input(el).value).to.equal('x');
      if (outcome === 'resolve') stale.resolve([{ value: 'stale', label: 'Stale' }]);
      else stale.reject(new Error('obsolete provider failure'));
      await settle(el);
      expect(optionCount(el)).to.equal(0);
      expect(el.sourceTotal).to.equal(0);
      expect(errors).to.deep.equal([]);
      el.inputValue = 'fresh';
      void el.show();
      await waitUntil(() => calls.some(call => call.query === 'fresh'), 'the provider recovers after cancellation');
      calls.find(call => call.query === 'fresh')!.resolve([{ value: 'current', label: 'Current' }]);
      await waitUntil(() => optionCount(el) === 1, 'only fresh rows render');
      expect(el.shadowRoot!.textContent?.includes('Stale')).to.equal(false);
      expect(el.open).to.equal(true);
      expect(input(el).getAttribute('aria-expanded')).to.equal('true');
    });
  }

  it('reconciles raised thresholds and releases an unpainted show without inventing hide events', async () => {
    const el = await fixture<MinimumCombobox>(html`<lr-combobox label="Search" min-query-length="2">
      <lr-option value="ready">Ready</lr-option>
    </lr-combobox>`);
    const events: string[] = [];
    for (const name of ['lr-show', 'lr-hide']) el.addEventListener(name, () => events.push(name));
    el.inputValue = 'ready';
    let resolved = false;
    void el.show().then(() => { resolved = true; });
    el.minQueryLength = 8;
    await waitUntil(() => resolved, 'threshold reconciliation releases pending show callers');
    await settle(el);
    expectClosed(el);
    expect(events).to.deep.equal([]);
    expect(input(el).value).to.equal('ready');
    el.minQueryLength = 1;
    await settle(el);
    expectClosed(el);
    await el.show();
    expect(el.open).to.equal(true);
    el.minQueryLength = 9;
    await settle(el);
    expectClosed(el);
    expect(input(el).value).to.equal('ready');
  });

  it('keeps range edits silent and rechecks filter-listener query and provider replacement', async () => {
    const oldCalls: string[] = [], replacementCalls: string[] = [];
    const replacement: ComboboxSource = async query => { replacementCalls.push(query); return [{ value: 'new', label: 'New' }]; };
    const el = await fixture<MinimumCombobox>(html`<lr-combobox label="Search" min-query-length="3" source-delay="0"
      .source=${async (query: string) => { oldCalls.push(query); return []; }}></lr-combobox>`);
    const filters: string[] = [];
    el.inputValue = 'ab';
    el.setRangeText('x', 0, 2, 'end');
    el.addEventListener('lr-filter', event => {
      filters.push(event.detail.value);
      el.inputValue = 'q';
      el.source = replacement;
    }, { once: true });
    await settle(el);
    expectClosed(el);
    expect(input(el).value).to.equal('x');
    expect(filters).to.deep.equal([]);
    edit(el, 'ready');
    await settle(el);
    expectClosed(el);
    expect(input(el).value).to.equal('q');
    expect(oldCalls).to.deep.equal([]);
    expect(replacementCalls).to.deep.equal([]);
    expect(filters).to.deep.equal(['ready']);
    el.inputValue = 'recover';
    await el.show();
    await waitUntil(() => replacementCalls.includes('recover'), 'only the latest provider/query is eligible');
    expect(replacementCalls.every(query => query === 'recover')).to.equal(true);
  });

  it('rechecks a synchronous source callback that makes its own query ineligible', async () => {
    const calls: string[] = [];
    const el = await fixture<MinimumCombobox>(html`<lr-combobox label="Search" min-query-length="3" source-delay="0"></lr-combobox>`);
    el.source = async query => {
      calls.push(query);
      el.inputValue = 'x';
      return [{ value: 'stale', label: 'Stale' }];
    };
    el.inputValue = 'ready';
    void el.show();
    await waitUntil(() => calls.includes('ready'), 'the provider synchronously edits its own host');
    await settle(el);
    expectClosed(el);
    expect(calls).to.deep.equal(['ready']);
    expect(input(el).value).to.equal('x');
    expect(optionCount(el)).to.equal(0);
    expect(el.sourceTotal).to.equal(0);
  });

  it('honors a newer eligible query and provider installed by the forced-hide listener', async () => {
    const originalCalls: string[] = [], replacementCalls: string[] = [];
    const el = await fixture<MinimumCombobox>(html`<lr-combobox label="Search" min-query-length="3" source-delay="0"
      .source=${async (query: string) => { originalCalls.push(query); return [{ value: 'old', label: 'Old' }]; }}></lr-combobox>`);
    el.inputValue = 'ready';
    await el.show();
    await waitUntil(() => optionCount(el) === 1, 'the original eligible query is open and populated');
    let hides = 0;
    el.addEventListener('lr-hide', () => {
      hides += 1;
      el.inputValue = 'renewed';
      el.source = async query => { replacementCalls.push(query); return [{ value: 'new', label: 'New' }]; };
      void el.show();
    }, { once: true });
    edit(el, 'x');
    await waitUntil(() => replacementCalls.includes('renewed') && el.open, 'the hide listener owns the fresh eligible search');
    await settle(el);
    expect(hides).to.equal(1);
    expect(input(el).value).to.equal('renewed');
    expect(originalCalls.includes('x')).to.equal(false);
    expect(replacementCalls.every(query => query === 'renewed')).to.equal(true);
    expect(input(el).getAttribute('aria-expanded')).to.equal('true');
  });

  it('retires loading when an abort listener lowers the minimum without starting another query', async () => {
    let resolvePending!: (rows: readonly ComboboxSourceRow[]) => void;
    const calls: string[] = [];
    const el = await fixture<MinimumCombobox>(html`<lr-combobox label="Search" min-query-length="2" source-delay="0"
      loading-text="Searching catalog"></lr-combobox>`);
    el.source = (query, { signal }) => {
      calls.push(query);
      signal.addEventListener('abort', () => { el.minQueryLength = 0; }, { once: true });
      return new Promise(resolve => { resolvePending = resolve; });
    };
    el.inputValue = 'ready';
    await el.show();
    const loadingIsVisible = (): boolean =>
      el.shadowRoot!.querySelector('[part="listbox"]')?.textContent?.includes('Searching catalog') ?? false;
    await waitUntil(loadingIsVisible, 'the original request visibly owns loading');
    el.minQueryLength = 8;
    await settle(el);
    expect(el.minQueryLength).to.equal(0);
    expect(el.open).to.equal(true);
    expect(input(el).value).to.equal('ready');
    expect(loadingIsVisible(), 'the retired request cannot strand loading after reentry').to.equal(false);
    expect(calls).to.deep.equal(['ready']);
    resolvePending([{ value: 'stale', label: 'Stale' }]);
    await settle(el);
    expect(optionCount(el)).to.equal(0);
    expect(loadingIsVisible()).to.equal(false);
  });

  it('suppresses selected-value warmup through reconnect and adoption, then permits a fresh eligible query', async () => {
    const calls: string[] = [];
    const el = await fixture<MinimumCombobox>(html`<lr-combobox label="Search" value="known" min-query-length="3" source-delay="0"
      .source=${async (query: string) => { calls.push(query); return [{ value: 'known', label: 'Known' }]; }}></lr-combobox>`);
    await settle(el);
    expect(calls).to.deep.equal([]);
    expect(el.value).to.equal('known');
    const parent = el.parentElement!;
    el.remove(); parent.append(el);
    await settle(el);
    expect(calls).to.deep.equal([]);
    const frame = document.createElement('iframe');
    document.body.append(frame);
    try {
      const doc = frame.contentDocument!;
      doc.body.append(doc.adoptNode(el));
      el.inputValue = 'x';
      el.open = true;
      el.refresh();
      await settle(el);
      expectClosed(el);
      expect(calls).to.deep.equal([]);
      expect(el.value).to.equal('known');
      el.inputValue = 'known';
      await el.show();
      await waitUntil(() => calls.includes('known'), 'the adopted control uses its current query when eligible');
      expect(calls.every(query => query === 'known')).to.equal(true);
    } finally {
      document.adoptNode(el); el.remove(); frame.remove();
    }
  });
});
