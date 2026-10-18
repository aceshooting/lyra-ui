import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './test-results.js';
import { LyraTestResults, type TestResultsSource } from './test-results.class.js';

describe('test-results provider pages', () => {
  it('uses authoritative global counts and bounded current rows', async () => {
    const source: TestResultsSource = {
      revision: 1,
      query: async () => ({ total: 1, rows: [{ key: JSON.stringify(['suite', 'tail']), order: 99,
        value: { suiteId: 'suite', suiteName: 'Suite', test: { id: 'tail', name: 'Final failure', status: 'failed' } } }],
        summary: { total: 1, passed: 0, failed: 1, skipped: 0, running: 0 } }),
      lookup: async () => [], locate: async () => null,
    };
    const el = await fixture<LyraTestResults>(html`<lr-test-results .dataSource=${source}></lr-test-results>`);
    await waitUntil(() => el.sourceTotal === 1, 'provider total must settle');
    expect(el.shadowRoot!.querySelectorAll('[part="test"]').length).to.equal(1);
    expect(el.shadowRoot!.textContent).to.include('Final failure');
  });
});

const result = (id = 'one') => ({ total: 1, rows: [{ key: JSON.stringify(['suite', id]), order: 0,
  value: { suiteId: 'suite', suiteName: 'Suite', test: { id, name: id, status: 'failed' as const, message: 'Failure' } } }],
  summary: { total: 1, passed: 0, failed: 1, skipped: 0, running: 0 } });
const provider = (query: TestResultsSource['query']): TestResultsSource => ({ revision: 1, query, lookup: async () => [], locate: async () => null });
const ready = async (el: LyraTestResults) => {
  await waitUntil(() => el.sourceTotal !== null); await el.updateComplete;
};

describe('test-results provider admission and authority', () => {
  it('preserves contiguous provider ordering and original occurrence identity', async () => {
    const rows = ['a', 'b', 'a'].map((suiteId, index) => ({ key: JSON.stringify([suiteId, String(index)]), order: index,
      value: { suiteId, suiteName: suiteId, test: { id: String(index), name: String(index), status: 'passed' as const } } }));
    const el = await fixture<LyraTestResults>(html`<lr-test-results .dataSource=${provider(async () => ({ total: 3, rows,
      summary: { total: 3, passed: 3, failed: 0, skipped: 0, running: 0 } }))}></lr-test-results>`);
    await ready(el);
    expect([...el.shadowRoot!.querySelectorAll('[part="test-name"]')].map(node => node.textContent!.trim())).to.deep.equal(['0', '1', '2']);
    expect([...el.shadowRoot!.querySelectorAll('[part="suite-header"]')].map(node => node.textContent)).to.deep.equal(['a', 'b', 'a']);
  });

  for (const kind of ['missing-summary', 'wrong-summary', 'unsafe-summary', 'wrong-key', 'accessor', 'oversized', 'wrong-status', 'oversized-page']) {
    it(`rejects ${kind} without presenting successful counts`, async () => {
      let accessorReads = 0;
      const source = provider(async () => {
        const page = result();
        if (kind === 'missing-summary') Reflect.deleteProperty(page, 'summary');
        if (kind === 'wrong-summary') page.summary.failed = 0;
        if (kind === 'unsafe-summary') page.summary.total = Number.MAX_SAFE_INTEGER + 1;
        if (kind === 'wrong-key') page.rows[0]!.key = 'wrong';
        if (kind === 'accessor') Object.defineProperty(page.rows[0]!.value.test, 'name', { get() { accessorReads++; return 'Bad'; } });
        if (kind === 'oversized') page.rows[0]!.value.test.message = 'x'.repeat(65_537);
        if (kind === 'wrong-status') { page.summary.failed = 0; page.summary.passed = 1; }
        if (kind === 'oversized-page') page.rows = new Array(101);
        return page;
      });
      const el = await fixture<LyraTestResults>(html`<lr-test-results .dataSource=${source} .strings=${{ tableLoadFailed: 'Cannot load', retry: 'Try again' }}></lr-test-results>`);
      await waitUntil(() => !!el.shadowRoot!.querySelector('[part="source-retry"]'));
      expect(el.sourceTotal).to.equal(null);
      expect(el.shadowRoot!.querySelectorAll('[part="count"]').length).to.equal(0);
      expect(el.shadowRoot!.textContent).to.include('Cannot load');
      expect(accessorReads).to.equal(0);
    });
  }

  it('ignores arbitrary output and attachment graphs', async () => {
    let reads = 0;
    const page = result();
    Object.defineProperty(page.rows[0]!.value.test, 'output', { get() { reads++; throw new Error('opaque'); } });
    Object.defineProperty(page.rows[0]!.value.test, 'attachments', { get() { reads++; throw new Error('opaque'); } });
    const el = await fixture<LyraTestResults>(html`<lr-test-results .dataSource=${provider(async () => page)}></lr-test-results>`);
    await ready(el); expect(reads).to.equal(0);
  });

  it('keeps pending counts unknown and revokes retained select/toggle controls immediately', async () => {
    const el = await fixture<LyraTestResults>(html`<lr-test-results .dataSource=${provider(async () => result())}></lr-test-results>`);
    await ready(el);
    const select = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="test-name"]')!;
    const toggle = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="test-expand-toggle"]')!;
    let selections = 0; let toggles = 0;
    el.addEventListener('lr-test-select', () => selections++); el.addEventListener('lr-toggle', () => toggles++);
    let release!: (value: ReturnType<typeof result>) => void;
    el.dataSource = provider(() => new Promise(resolve => { release = resolve; }));
    expect(el.sourceTotal).to.equal(null); select.click(); toggle.click();
    expect(selections).to.equal(0); expect(toggles).to.equal(0);
    await waitUntil(() => !!release); await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="count"]').length).to.equal(0);
    release(result('current')); await ready(el);
    expect(el.shadowRoot!.textContent).to.include('current');
  });

  it('rechecks toggle authority after a synchronous veto listener replaces the source', async () => {
    const el = await fixture<LyraTestResults>(html`<lr-test-results .dataSource=${provider(async () => result())}></lr-test-results>`);
    await ready(el); let toggles = 0;
    el.addEventListener('lr-toggle-request', () => { el.dataSource = provider(async () => result('next')); });
    el.addEventListener('lr-toggle', () => toggles++);
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="test-expand-toggle"]')!.click();
    await ready(el); expect(toggles).to.equal(0);
  });

  it('does not let a retained retry button retry another provider', async () => {
    const el = await fixture<LyraTestResults>(html`<lr-test-results .dataSource=${provider(async () => { throw new Error('private failure'); })}></lr-test-results>`);
    await waitUntil(() => !!el.shadowRoot!.querySelector('[part="source-retry"]'));
    const retry = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="source-retry"]')!;
    let calls = 0;
    el.dataSource = provider(async () => { calls++; return result('new'); });
    await ready(el); retry.click(); await el.updateComplete;
    expect(calls).to.equal(1); expect(el.shadowRoot!.textContent).not.to.include('private failure');
  });

  it('refreshes same-source/keyless updates, but not ordinary named paints, and restores current suites', async () => {
    let calls = 0;
    const source = provider(async () => { calls++; return result(String(calls)); });
    const el = await fixture<LyraTestResults>(html`<lr-test-results .dataSource=${source} .suites=${[{ id: 'legacy', name: 'Legacy', tests: [{ id: 'old', name: 'Legacy row', status: 'passed' }] }]}></lr-test-results>`);
    await ready(el); el.requestUpdate('strings'); await el.updateComplete; expect(calls).to.equal(1);
    el.dataSource = source; await ready(el); expect(calls).to.equal(2);
    el.requestUpdate(); el.requestUpdate('strings'); await ready(el); expect(calls).to.equal(3);
    el.dataSource = undefined; await el.updateComplete;
    expect(el.sourceTotal).to.equal(null); expect(el.shadowRoot!.textContent).to.include('Legacy row');
  });

  it('fails closed for a runtime-invalid filter and a defined invalid source', async () => {
    const el = await fixture<LyraTestResults>(html`<lr-test-results .dataSource=${provider(async () => result())}></lr-test-results>`);
    await ready(el);
    el.statusFilter = ['other'] as unknown as LyraTestResults['statusFilter']; await el.updateComplete;
    expect(el.sourceTotal).to.equal(null); expect(el.shadowRoot!.querySelectorAll('[part="source-retry"]').length).to.equal(1);
    el.dataSource = null as unknown as TestResultsSource; await el.updateComplete;
    expect(el.sourceTotal).to.equal(null); expect(el.shadowRoot!.querySelectorAll('[part="source-retry"]').length).to.equal(1);
  });

  it('makes one exact out-of-range correction', async () => {
    const pages: number[] = [];
    const source = provider(async ({ page }) => { pages.push(page); const value = result(); return { ...value, rows: page ? [] : value.rows }; });
    const el = await fixture<LyraTestResults>(html`<lr-test-results .sourcePage=${99} .dataSource=${source}></lr-test-results>`);
    await ready(el); expect(pages).to.deep.equal([99, 0]); expect(el.sourcePage).to.equal(0);
  });
});

describe('test-results provider transitions', () => {
  it('defers an explicit completion until the current full summary arrives', async () => {
    let release!: (value: ReturnType<typeof result>) => void;
    const source = provider(() => new Promise(resolve => { release = resolve; }));
    const el = await fixture<LyraTestResults>(html`<lr-test-results run-id="run" run-state="running" .dataSource=${source}
      .strings=${{ testResultsCompleteAnnounce: '{passed} ok, {failed} failed, {skipped} skipped' }}></lr-test-results>`);
    await waitUntil(() => !!release);
    el.runState = 'complete'; await el.updateComplete;
    const region = () => el.shadowRoot!.querySelector('lr-live-region')!.shadowRoot!.querySelector('[part="region"]')!.textContent;
    expect(region()).to.equal('');
    release(result()); await ready(el);
    await waitUntil(() => region() === '0 ok, 1 failed, 0 skipped');
  });

  it('bounds ignored-abort request concurrency and admits only the latest page intent', async () => {
    const releases: (() => void)[] = [];
    const pages: number[] = []; let active = 0; let maxActive = 0;
    const source = provider(({ page }) => new Promise(resolve => {
      pages.push(page); active++; maxActive = Math.max(active, maxActive);
      releases.push(() => { active--; const response = result(`page-${page}`); response.total = 20; response.summary.total = 20; response.summary.failed = 20; resolve(response); });
    }));
    const el = await fixture<LyraTestResults>(html`<lr-test-results .sourcePageSize=${1} .dataSource=${source}></lr-test-results>`);
    await waitUntil(() => releases.length === 1);
    for (let page = 1; page < 20; page++) el.sourcePage = page;
    expect(el.sourceTotal).to.equal(null);
    releases.shift()!(); await waitUntil(() => pages.length === 2);
    expect(pages).to.deep.equal([0, 19]); expect(maxActive).to.equal(1);
    releases.shift()!(); await ready(el);
    expect(el.shadowRoot!.textContent).to.include('page-19');
    expect(el.shadowRoot!.textContent).not.to.include('page-0');
  });

  it('clears page-only expansion while retaining exact punctuation and surrogate IDs', async () => {
    const suiteId = 's:,\ud800'; const id = 't:,\udfff';
    const source = provider(async () => ({ total: 1,
      rows: [{ key: JSON.stringify([suiteId, id]), order: 0, value: { suiteId, suiteName: 'Odd', test: { id, name: 'Odd', status: 'failed' } } }],
      summary: { total: 1, passed: 0, failed: 1, skipped: 0, running: 0 } }));
    const el = await fixture<LyraTestResults>(html`<lr-test-results .dataSource=${source}></lr-test-results>`);
    await ready(el); let selected: unknown;
    el.addEventListener('lr-test-select', event => { selected = (event as CustomEvent).detail; });
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="test-name"]')!.click();
    expect(selected).to.deep.equal({ suiteId, testId: id });
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="test-expand-toggle"]')!.click(); await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="failure"]')!.hasAttribute('hidden')).to.equal(true);
    el.dataSource = source; await ready(el);
    expect(el.shadowRoot!.querySelector('[part="failure"]')!.hasAttribute('hidden')).to.equal(false);
  });

  it('uses noMatches only for a filtered empty response with a nonempty full run', async () => {
    const source = provider(async () => ({ total: 0, rows: [], summary: { total: 1, failed: 0, passed: 1, skipped: 0, running: 0 } }));
    const el = await fixture<LyraTestResults>(html`<lr-test-results .statusFilter=${['failed']} .dataSource=${source}
      .strings=${{ noMatches: 'No matching tests', noData: 'Empty run' }}></lr-test-results>`);
    await ready(el);
    expect(el.sourceTotal).to.equal(0);
    expect(el.shadowRoot!.querySelector('lr-empty')!.getAttribute('heading')).to.equal('No matching tests');
  });
});

describe('test-results failure announcements', () => {
  it('announces a settled provider failure through the light-DOM sink', async () => {
    let reject!: (reason: Error) => void;
    const source = provider(() => new Promise((_resolve, fail) => { reject = fail; }));
    const el = await fixture<LyraTestResults>(html`<lr-test-results .dataSource=${source} .strings=${{ tableLoadFailed: 'Result page unavailable' }}></lr-test-results>`);
    await waitUntil(() => !!reject); await el.updateComplete;
    reject(new Error('hidden provider error'));
    await waitUntil(() => !!el.shadowRoot!.querySelector('[part="source-retry"]'));
    await waitUntil(() => [...document.querySelectorAll('[data-lr-live-region="polite"]')].some(node => node.textContent!.includes('Result page unavailable')));
  });
});

describe('test-results route separation', () => {
  it('does not project legacy rows when source filters change', async () => {
    const el = await fixture<LyraTestResults>(html`<lr-test-results .dataSource=${provider(async () => result())}></lr-test-results>`);
    await ready(el);
    const probe = el as unknown as { rebuildProjection(): void };
    const original = probe.rebuildProjection; let projections = 0;
    probe.rebuildProjection = () => { projections++; original.call(el); };
    try {
      el.shadowRoot!.querySelector<HTMLButtonElement>('[part="filter-toggle"][data-status="failed"]')!.click();
      await ready(el);
      expect(projections).to.equal(0);
    } finally { probe.rebuildProjection = original; }
  });
});

class ReentrantResults extends LyraTestResults {
  completionHook?: () => void;
  protected override localize(key: string, fallback?: string, values?: Record<string, string | number>): string {
    const text = super.localize(key, fallback, values);
    if (key === 'testResultsCompleteAnnounce') this.completionHook?.();
    return text;
  }
}
customElements.define('test-reentrant-results', ReentrantResults);
it('rejects completion text made obsolete during localization', async () => {
  const el = await fixture<ReentrantResults>(html`<test-reentrant-results run-id="old" run-state="running" .dataSource=${provider(async () => result())}></test-reentrant-results>`);
  await waitUntil(() => el.sourceTotal === 1); await el.updateComplete;
  const region = el.shadowRoot!.querySelector<LyraLiveRegion>('lr-live-region')!;
  const original = region.announce; const messages: string[] = [];
  region.announce = (text, options) => { messages.push(text); original.call(region, text, options); };
  el.completionHook = () => { el.completionHook = undefined; el.dataSource = provider(async () => result()); el.runId = 'new'; };
  try {
    el.runState = 'complete'; await el.updateComplete;
    expect(messages.length).to.equal(0);
  } finally { region.announce = original; }
});
it('drops deferred completion when the same run resumes before summary arrives', async () => {
  const delayed = provider(async () => result());
  const answer = await delayed.query({ page: 0, pageSize: 100, query: { statuses: [] }, revision: 1, locale: 'en', signal: new AbortController().signal });
  let release!: (value: typeof answer) => void;
  delayed.query = () => new Promise(resolve => { release = resolve; });
  const el = await fixture<LyraTestResults>(html`<lr-test-results run-id="run" run-state="running" .dataSource=${delayed}></lr-test-results>`);
  await waitUntil(() => !!release);
  const region = el.shadowRoot!.querySelector<LyraLiveRegion>('lr-live-region')!;
  const original = region.announce; const messages: string[] = [];
  region.announce = (text, options) => { messages.push(text); original.call(region, text, options); };
  try {
    el.runState = 'complete'; await el.updateComplete;
    el.runState = 'running'; await el.updateComplete;
    release(answer); await waitUntil(() => el.sourceTotal === 1); await el.updateComplete;
    expect(messages.length).to.equal(0);
  } finally { region.announce = original; }
});

describe('test-results provider lifecycle', () => {
  for (const lifecycle of ['reconnect', 'adoption', 'locale']) {
    it(`revokes stale rows and completion during ${lifecycle} and renders the current summary`, async () => {
      const calls: { locale: string; release: (value: ReturnType<typeof result>) => void }[] = [];
      const source = provider(({ locale }) => new Promise(resolve => { calls.push({ locale, release: resolve }); }));
      const el = await fixture<LyraTestResults>(html`<lr-test-results run-id="run" run-state="running" .dataSource=${source}></lr-test-results>`);
      await waitUntil(() => calls.length === 1); calls[0]!.release(result('initial')); await ready(el);
      const oldButton = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="test-name"]')!;
      let selections = 0; const messages: string[] = [];
      el.addEventListener('lr-test-select', () => selections++);
      const region = el.shadowRoot!.querySelector<LyraLiveRegion>('lr-live-region')!;
      const announce = region.announce;
      region.announce = (text, options) => { messages.push(text); announce.call(region, text, options); };
      let frame: HTMLIFrameElement | undefined;
      try {
        el.requestUpdate(); await waitUntil(() => calls.length === 2);
        el.runState = 'complete'; await el.updateComplete;
        if (lifecycle === 'locale') {
          el.locale = 'fr'; await el.updateComplete;
        } else if (lifecycle === 'reconnect') {
          const parent = el.parentNode!; el.remove(); parent.appendChild(el);
        } else {
          frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
          frame.contentDocument!.adoptNode(el); frame.contentDocument!.body.appendChild(el);
        }
        oldButton.click(); expect(selections).to.equal(0); expect(el.sourceTotal).to.equal(null);
        calls[1]!.release(result('obsolete'));
        await waitUntil(() => calls.length === 3);
        expect(el.shadowRoot!.textContent).not.to.include('obsolete');
        calls[2]!.release(result('current')); await ready(el);
        expect(el.shadowRoot!.textContent).to.include('current');
        expect(el.shadowRoot!.querySelector('[part="count"][data-status="failed"]')!.textContent).to.include('1');
        expect(calls.length).to.equal(3);
        expect(messages.length).to.equal(lifecycle === 'locale' ? 1 : 0);
        if (lifecycle === 'locale') expect(calls[2]!.locale).to.equal('fr');
      } finally { region.announce = announce; if (frame) { el.remove(); frame.remove(); } }
    });
  }
});

it('stops obsolete source descriptor capture when an early field replaces the provider', async () => {
  const el = await fixture<LyraTestResults>(html`<lr-test-results></lr-test-results>`);
  let replaced = false; let laterReads = 0;
  const page = result('obsolete');
  page.rows[0]!.value = new Proxy(page.rows[0]!.value, { getOwnPropertyDescriptor(target, key) {
    if (key === 'suiteId' && !replaced) { replaced = true; el.dataSource = provider(async () => result('current')); }
    else if (key === 'suiteName') laterReads++;
    return Reflect.getOwnPropertyDescriptor(target, key);
  } });
  el.dataSource = provider(async () => page);
  await waitUntil(() => el.shadowRoot!.querySelector('[part="test-name"]')?.textContent?.trim() === 'current');
  expect(laterReads).to.equal(0); expect(el.shadowRoot!.textContent).not.to.include('obsolete');
  expect(el.shadowRoot!.querySelector('[part="source-retry"]')).to.equal(null);
});
