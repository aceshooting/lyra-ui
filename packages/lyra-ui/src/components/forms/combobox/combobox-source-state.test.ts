import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import './combobox.js';
import type { LyraCombobox, ComboboxSource } from './combobox.js';

/** Every `source` below rejects or resolves deliberately; the component logs a console warning for
 *  a real rejection, which is noise here, not a failure. */
const withSilencedWarning = async (run: () => Promise<void>): Promise<void> => {
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    await run();
  } finally {
    console.warn = originalWarn;
  }
};

const errorRow = (el: LyraCombobox): HTMLElement | null =>
  el.shadowRoot!.querySelector<HTMLElement>('[part~="source-error"]');

const retryButton = (el: LyraCombobox): HTMLButtonElement | null =>
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="retry-button"]');

const optionCount = (el: LyraCombobox): number =>
  el.shadowRoot!.querySelectorAll('[part~="option"]').length;

describe('lr-combobox async source failures', () => {
  it('renders the shared error row with a retry control instead of an empty listbox', async () => {
    const el = await fixture<LyraCombobox>(
      html`<lr-combobox source-delay="0" open></lr-combobox>`
    );
    await withSilencedWarning(async () => {
      el.source = async () => {
        throw new Error('private server detail');
      };
      await waitUntil(() => errorRow(el) !== null, 'the failure renders the shared error row');
      expect(retryButton(el) === null).to.equal(false, 'the error row offers a retry');
      expect(optionCount(el)).to.equal(0);
      expect(errorRow(el)!.textContent).to.not.contain('private server detail');
    });
  });

  it('emits a non-cancelable lr-source-error carrying the rejection', async () => {
    const el = await fixture<LyraCombobox>(
      html`<lr-combobox source-delay="0" open></lr-combobox>`
    );
    const failure = new Error('upstream down');
    const seen: { error: unknown; cancelable: boolean }[] = [];
    el.addEventListener('lr-source-error', (event) => {
      seen.push({
        error: (event as CustomEvent<{ error: unknown }>).detail.error,
        cancelable: event.cancelable,
      });
    });
    await withSilencedWarning(async () => {
      el.source = async () => {
        throw failure;
      };
      await waitUntil(() => seen.length === 1, 'the rejection is announced exactly once');
      expect(seen[0]!.error === failure).to.equal(true, 'the detail carries the rejection');
      expect(seen[0]!.cancelable).to.equal(false);
    });
  });

  it('recovers through the retry control, honouring a vetoed lr-retry', async () => {
    const el = await fixture<LyraCombobox>(
      html`<lr-combobox source-delay="0" open></lr-combobox>`
    );
    let shouldFail = true;
    const retries: boolean[] = [];
    el.addEventListener('lr-retry', (event) => {
      retries.push(event.cancelable);
    });
    await withSilencedWarning(async () => {
      el.source = async () => {
        if (shouldFail) throw new Error('nope');
        return [{ value: 'a', label: 'Alpha' }];
      };
      await waitUntil(() => errorRow(el) !== null, 'the failure renders');
      const veto = (event: Event): void => event.preventDefault();
      el.addEventListener('lr-retry', veto);
      retryButton(el)!.click();
      await aTimeout(30);
      el.removeEventListener('lr-retry', veto);
      expect(errorRow(el) === null).to.equal(false, 'a vetoed retry leaves the failure visible');
      shouldFail = false;
      retryButton(el)!.click();
      await waitUntil(() => optionCount(el) === 1, 'the un-vetoed retry reloads the rows');
      expect(errorRow(el) === null).to.equal(true);
      expect(retries).to.deep.equal([true, true]);
    });
  });

  it('localizes the error copy through a .strings override', async () => {
    const el = await fixture<LyraCombobox>(html`<lr-combobox
      source-delay="0"
      open
      .strings=${{ comboboxLoadError: 'Options unavailable', retry: 'Try again' }}
    ></lr-combobox>`);
    await withSilencedWarning(async () => {
      el.source = async () => {
        throw new Error('detail');
      };
      await waitUntil(() => errorRow(el) !== null, 'the failure renders');
      // The heading lives in the composed <lr-empty>'s own shadow root, so the reachable
      // assertion is the attribute the renderer wrote, not the host row's textContent.
      expect(errorRow(el)!.getAttribute('heading')).to.equal('Options unavailable');
      expect(retryButton(el)!.textContent!.trim()).to.equal('Try again');
    });
  });

  it('keeps the form-control error slot working alongside the source-error row', async () => {
    const el = await fixture<LyraCombobox>(html`<lr-combobox source-delay="0" open error-text="x">
      <span slot="error">Field message</span>
    </lr-combobox>`);
    await withSilencedWarning(async () => {
      el.source = async () => {
        throw new Error('detail');
      };
      await waitUntil(() => errorRow(el) !== null, 'the failure renders');
      const fieldSlot = el.shadowRoot!.querySelector<HTMLSlotElement>(
        '[part="error"] slot[name="error"]'
      );
      expect(fieldSlot === null).to.equal(false, 'the form-control error slot still exists');
      expect(
        fieldSlot!.assignedElements({ flatten: true }).map((node) => node.textContent)
      ).to.deep.equal(['Field message']);
    });
  });

  it('keeps loading ahead of error and error ahead of empty', async () => {
    const el = await fixture<LyraCombobox>(
      html`<lr-combobox source-delay="0" open></lr-combobox>`
    );
    await withSilencedWarning(async () => {
      el.source = async () => {
        await aTimeout(300);
        throw new Error('slow failure');
      };
      await waitUntil(
        () => el.shadowRoot!.querySelector('.loading') !== null,
        'loading wins first'
      );
      expect(errorRow(el) === null).to.equal(true, 'no stale failure under a loading state');
      await waitUntil(() => errorRow(el) !== null, 'the failure then wins over empty', {
        timeout: 2000,
      });
      expect(el.shadowRoot!.querySelector('.empty') === null).to.equal(
        true,
        'no "no matches" copy hiding the retry'
      );
    });
  });

  it('passes an accessibility audit while the error row is showing', async () => {
    const el = await fixture<LyraCombobox>(
      html`<lr-combobox label="Fruit" source-delay="0" open></lr-combobox>`
    );
    await withSilencedWarning(async () => {
      el.source = async () => {
        throw new Error('detail');
      };
      await waitUntil(() => errorRow(el) !== null, 'the failure renders');
      await expect(el).to.be.accessible();
    });
  });
});

describe('lr-combobox refresh()', () => {
  it('re-runs the current query without changing the source identity', async () => {
    const queries: string[] = [];
    const source: ComboboxSource = async (query) => {
      queries.push(query);
      return [{ value: query || 'a', label: query || 'Alpha' }];
    };
    const el = await fixture<LyraCombobox>(
      html`<lr-combobox source-delay="0" open .source=${source}></lr-combobox>`
    );
    await waitUntil(() => queries.length === 1, 'the first query runs on open');
    el.inputValue = 'be';
    await waitUntil(() => queries.includes('be'), 'typing re-queries');
    const before = queries.length;
    el.refresh();
    await waitUntil(() => queries.length === before + 1, 'refresh() re-invokes the source');
    expect(queries[queries.length - 1]).to.equal('be', 'with the last query text');
    expect(el.source === source).to.equal(true, 'the source identity is untouched');
  });

  it('keeps the debounce identity, so a later keystroke still debounces', async () => {
    const queries: string[] = [];
    const source: ComboboxSource = async (query) => {
      queries.push(query);
      return [];
    };
    const el = await fixture<LyraCombobox>(
      html`<lr-combobox source-delay="60" open .source=${source}></lr-combobox>`
    );
    await waitUntil(() => queries.length === 1, 'the first query runs on open', { timeout: 2000 });
    el.refresh();
    await waitUntil(() => queries.length === 2, 'refresh() re-runs immediately');
    el.inputValue = 'a';
    el.inputValue = 'ab';
    el.inputValue = 'abc';
    await aTimeout(20);
    expect(queries.length).to.equal(2, 'the burst is still debounced, not run per keystroke');
    await waitUntil(() => queries.length === 3, 'the debounced query lands once', {
      timeout: 2000,
    });
    expect(queries[2]).to.equal('abc');
  });

  it('queues a refresh requested while closed until the next open', async () => {
    const queries: string[] = [];
    const source: ComboboxSource = async (query) => {
      queries.push(query);
      return [{ value: 'a', label: 'Alpha' }];
    };
    const el = await fixture<LyraCombobox>(
      html`<lr-combobox source-delay="0" .source=${source}></lr-combobox>`
    );
    await el.updateComplete;
    const before = queries.length;
    el.refresh();
    await aTimeout(30);
    expect(queries.length).to.equal(before, 'a closed combobox does not fetch');
    el.open = true;
    await waitUntil(() => queries.length === before + 1, 'the queued refresh runs on open');
  });

  it('keeps the expanded combobox pointing at a valid popup role while the source failed', async () => {
    const el = await fixture<LyraCombobox>(
      html`<lr-combobox label="Pick" source-delay="0" open show-unknown-option></lr-combobox>`
    );
    await withSilencedWarning(async () => {
      el.source = async () => {
        throw new Error('down');
      };
      await waitUntil(() => errorRow(el) !== null, 'the failure state renders');
      const input = el.shadowRoot!.querySelector<HTMLInputElement>('[part="combobox-input"]')!;
      const popup = el.shadowRoot!.querySelector<HTMLElement>('[part~="listbox"]')!;
      expect(input.getAttribute('aria-expanded')).to.equal('true');
      expect(input.getAttribute('aria-controls')).to.equal(popup.id);
      // WAI-ARIA allows a combobox's popup to be listbox/grid/tree/dialog. `presentation` is not
      // one of them, and the retry `button` is not a valid listbox child either.
      expect(popup.getAttribute('role')).to.equal('dialog');
      expect(input.getAttribute('aria-haspopup')).to.equal('dialog');
      expect(popup.hasAttribute('aria-multiselectable')).to.equal(false);
      expect((popup.getAttribute('aria-label') ?? '').length > 0).to.equal(
        true,
        'a dialog popup carries an accessible name'
      );
      expect(input.hasAttribute('aria-activedescendant')).to.equal(
        false,
        'no option row renders, so a retained active index would be a dangling idref'
      );
      await expect(el).to.be.accessible();
    });
  });

  it('restores the listbox role once a retry succeeds', async () => {
    const el = await fixture<LyraCombobox>(
      html`<lr-combobox label="Pick" source-delay="0" open></lr-combobox>`
    );
    await withSilencedWarning(async () => {
      let fail = true;
      el.source = async () => {
        if (fail) throw new Error('down');
        return [{ value: 'a', label: 'Alpha' }];
      };
      await waitUntil(() => errorRow(el) !== null, 'the failure state renders');
      fail = false;
      retryButton(el)!.click();
      await waitUntil(() => errorRow(el) === null, 'the retry succeeds');
      await el.updateComplete;
      const input = el.shadowRoot!.querySelector<HTMLInputElement>('[part="combobox-input"]')!;
      const popup = el.shadowRoot!.querySelector<HTMLElement>('[part~="listbox"]')!;
      expect(popup.getAttribute('role')).to.equal('listbox');
      expect(popup.getAttribute('aria-multiselectable')).to.equal('false');
      expect(input.hasAttribute('aria-haspopup')).to.equal(false);
    });
  });

  it('is inert without a source', async () => {
    const el = await fixture<LyraCombobox>(
      html`<lr-combobox open>
        <lr-option value="a">Alpha</lr-option>
      </lr-combobox>`
    );
    el.refresh();
    await aTimeout(20);
    expect(optionCount(el)).to.equal(1, 'local options are untouched');
    expect(errorRow(el) === null).to.equal(true);
  });
});
