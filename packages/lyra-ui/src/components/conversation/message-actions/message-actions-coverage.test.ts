import { expect, fixture, html, waitUntil, aTimeout } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './message-actions.js';
import type { LyraMessageActions } from './message-actions.js';

async function mount(): Promise<{
  wrapper: HTMLElement;
  toolbar: LyraMessageActions;
  first: HTMLButtonElement;
  second: HTMLButtonElement;
  outside: HTMLButtonElement;
}> {
  const wrapper = await fixture<HTMLElement>(html`
    <div>
      <button id="outside">Outside</button>
      <lr-message-actions .controls=${[]}>
        <button id="first">First</button>
        <button id="second">Second</button>
      </lr-message-actions>
    </div>
  `);
  const toolbar = wrapper.querySelector('lr-message-actions') as LyraMessageActions;
  await toolbar.updateComplete;
  const first = toolbar.querySelector<HTMLButtonElement>('#first')!;
  const second = toolbar.querySelector<HTMLButtonElement>('#second')!;
  await waitUntil(() => first.tabIndex === 0 && second.tabIndex === -1, 'roving tab stop is established');
  return { wrapper, toolbar, first, second, outside: wrapper.querySelector<HTMLButtonElement>('#outside')! };
}

describe('lr-message-actions focus ownership', () => {
  const restoreAuthorMethods: (() => void)[] = [];
  afterEach(() => {
    for (const restore of restoreAuthorMethods.splice(0)) restore();
  });

  it('keeps later direct actions available when an author focus predicate throws', async () => {
    const { toolbar, first, second } = await mount();
    const nativeMatches = first.matches.bind(first);
    let failedChecks = 0;
    restoreAuthorMethods.push(() => { Reflect.deleteProperty(first, 'matches'); });
    Object.defineProperty(first, 'matches', {
      configurable: true,
      value(selector: string): boolean {
        if (selector === ':disabled') {
          failedChecks += 1;
          throw new TypeError('disabled state unavailable');
        }
        return nativeMatches(selector);
      },
    });
    try {
      toolbar.append(document.createTextNode(''));
      await waitUntil(() => second.tabIndex === 0, 'later available action becomes the tab stop');
      expect(failedChecks > 0).to.equal(true);
    } finally {
      Reflect.deleteProperty(first, 'matches');
    }
  });

  it('continues reconciling direct actions when an author tabIndex setter throws', async () => {
    const { toolbar, first } = await mount();
    const added = document.createElement('button');
    added.textContent = 'Added';
    let writes = 0;
    restoreAuthorMethods.push(() => { Reflect.deleteProperty(first, 'tabIndex'); });
    Object.defineProperty(first, 'tabIndex', {
      configurable: true,
      get: () => Number(first.getAttribute('tabindex')),
      set() {
        writes += 1;
        throw new TypeError('tab index unavailable');
      },
    });
    try {
      toolbar.append(added);
      await waitUntil(() => added.tabIndex === -1, 'later direct actions are reconciled');
      expect(writes > 0).to.equal(true);
    } finally {
      Reflect.deleteProperty(first, 'tabIndex');
    }
  });

  it('continues restoring later direct actions when an author attribute method throws', async () => {
    const { toolbar, first, second } = await mount();
    const nativeRemoveAttribute = first.removeAttribute.bind(first);
    let releases = 0;
    restoreAuthorMethods.push(() => { Reflect.deleteProperty(first, 'removeAttribute'); });
    first.removeAttribute = (name: string): void => {
      if (name === 'tabindex') {
        releases += 1;
        throw new TypeError('attribute restoration unavailable');
      }
      nativeRemoveAttribute(name);
    };
    try {
      toolbar.replaceChildren();
      await waitUntil(() => !second.hasAttribute('tabindex'), 'later direct actions regain their authored state');
      expect(releases > 0).to.equal(true);
    } finally {
      Reflect.deleteProperty(first, 'removeAttribute');
    }
  });

  it('does not claim focus ownership from a focusin that arrives without real focus inside', async () => {
    const { first, second, outside } = await mount();
    await focusByKeyboard(outside);

    first.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
    first.remove();
    await waitUntil(() => second.tabIndex === 0, 'the survivor becomes the tab stop');
    await aTimeout(0);

    expect(document.activeElement === outside).to.equal(true);
  });

  it('does not pull focus back into the toolbar when a former stop is removed after focus left', async () => {
    const { first, second, outside } = await mount();
    await focusByKeyboard(first);
    await focusByKeyboard(outside);

    first.remove();
    await waitUntil(() => second.tabIndex === 0, 'the survivor becomes the tab stop');
    await aTimeout(0);

    expect(document.activeElement === outside).to.equal(true);
  });
});

describe('lr-message-actions detached while slot content changes', () => {
  it('re-establishes exactly one tab stop after being re-attached', async () => {
    const { wrapper, toolbar, first, second } = await mount();
    const added = document.createElement('button');
    added.textContent = 'Added';

    toolbar.append(added);
    toolbar.remove();
    await aTimeout(0);
    wrapper.append(toolbar);
    await toolbar.updateComplete;

    await waitUntil(
      () => [first, second, added].filter((button) => button.tabIndex === 0).length === 1,
      'exactly one roving tab stop after reconnect',
    );
    expect(added.isConnected).to.equal(true);
  });
});
