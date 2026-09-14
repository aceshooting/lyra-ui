import { expect, fixture, waitUntil } from '@open-wc/testing';
import { css, html as litHtml } from 'lit';
import { property } from 'lit/decorators.js';
import { sendKeys } from '@web/test-runner-commands';
import '../components/overlays/empty/empty.js';
import {
  LYRA_DEFAULT_loading,
  LYRA_DEFAULT_noData,
  LYRA_DEFAULT_retry,
  LYRA_DEFAULT_tableLoadFailed,
} from './default-strings.generated.js';
import {
  dataStateAriaBusy,
  renderDataState,
  resolveDataState,
  type DataStateConfig,
  type LyraDataStatePartPrefix,
} from './data-state-renderer.js';
import {
  dataStateRetryStyles,
  dataStateSurfaceStyles,
} from './data-state-renderer.styles.js';
import type { LyraLocaleStrings } from './localization.js';
import { LyraElement } from './lyra-element.js';
import { defineElement } from './prefix.js';

const IDLE_STATE: DataStateConfig = { loading: false, error: false, empty: false };

/** The English slice a component adopting this renderer generates for itself. Declared by hand
 *  here because the slice generator only rewrites component class modules, never a test stub. */
const STUB_STRINGS: Readonly<LyraLocaleStrings> = {
  loading: LYRA_DEFAULT_loading,
  noData: LYRA_DEFAULT_noData,
  retry: LYRA_DEFAULT_retry,
  tableLoadFailed: LYRA_DEFAULT_tableLoadFailed,
};

class DataStateStub extends LyraElement {
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    ...STUB_STRINGS,
  };

  static override styles = [
    LyraElement.styles,
    css`
      ${dataStateRetryStyles}
    `,
  ];

  @property({ attribute: false }) config: DataStateConfig = IDLE_STATE;
  @property({ attribute: false }) partPrefix: LyraDataStatePartPrefix = {};
  @property({ attribute: false }) retryEventName = 'lr-retry';

  override render(): unknown {
    return litHtml`${renderDataState(this, this.config, this.partPrefix, this.retryEventName)}`;
  }
}

/** The grid-shaped host the parameterized surface partial exists for: a full-width structural row
 *  wrapping whichever state currently applies, exactly as `lr-table` renders its failure row. */
class DataStateRowStub extends DataStateStub {
  static override styles = [
    LyraElement.styles,
    css`
      ${dataStateRetryStyles}
      ${dataStateSurfaceStyles('error')}
    `,
  ];

  override render(): unknown {
    return litHtml`<div part="error-row">
      <div part="error-cell">
        ${renderDataState(this, this.config, this.partPrefix, this.retryEventName)}
      </div>
    </div>`;
  }
}

defineElement('data-state-renderer-test-stub', DataStateStub);
defineElement('data-state-renderer-test-row', DataStateRowStub);

async function stub(config: Partial<DataStateConfig> = {}, options: {
  partPrefix?: LyraDataStatePartPrefix;
  retryEventName?: string;
} = {}): Promise<DataStateStub> {
  const element = await fixture<DataStateStub>(
    litHtml`<lr-data-state-renderer-test-stub></lr-data-state-renderer-test-stub>`,
  );
  element.config = { ...IDLE_STATE, ...config };
  if (options.partPrefix !== undefined) element.partPrefix = options.partPrefix;
  if (options.retryEventName !== undefined) element.retryEventName = options.retryEventName;
  await element.updateComplete;
  return element;
}

const headingOf = (element: LyraElement, prefix: string): string | null =>
  element.shadowRoot!.querySelector(`lr-empty[part="${prefix}"]`)?.getAttribute('heading') ?? null;

const descriptionOf = (element: LyraElement, prefix: string): string | null =>
  element.shadowRoot!.querySelector(`lr-empty[part="${prefix}"]`)?.getAttribute('description') ?? null;

const retryButton = (element: LyraElement): HTMLButtonElement | null =>
  element.shadowRoot!.querySelector<HTMLButtonElement>('[part="retry-button"]');

const slotNames = (element: LyraElement): string[] =>
  [...element.shadowRoot!.querySelectorAll('slot')].map((slot) => slot.name);

const builtInPrefixes = (element: LyraElement): string[] =>
  [...element.shadowRoot!.querySelectorAll('lr-empty')].map(
    (node) => node.getAttribute('part') ?? '',
  );

/** The retry control is laid out only once `lr-empty` has resolved its `actions` slot presence.
 *  Focus and hit testing both need a real box, so poll rather than assuming one update settles it. */
async function laidOutRetryButton(element: LyraElement): Promise<HTMLButtonElement> {
  await waitUntil(
    () => (retryButton(element)?.getClientRects().length ?? 0) > 0,
    'the built-in retry control must be laid out',
  );
  return retryButton(element)!;
}

it('resolves exactly one tier, loading over error over empty', () => {
  expect(resolveDataState({ loading: true, error: true, empty: true })).to.equal('loading');
  expect(resolveDataState({ loading: true, error: false, empty: false })).to.equal('loading');
  expect(resolveDataState({ loading: false, error: true, empty: true })).to.equal('error');
  expect(resolveDataState({ loading: false, error: false, empty: true })).to.equal('empty');
  expect(resolveDataState(IDLE_STATE)).to.equal(null);
});

it('renders nothing at all when no tier applies', async () => {
  const element = await stub();
  expect(slotNames(element)).to.deep.equal([]);
  expect(builtInPrefixes(element)).to.deep.equal([]);
});

it('renders only the loading tier when every tier could apply', async () => {
  const element = await stub({ loading: true, error: true, empty: true });

  expect(slotNames(element)).to.deep.equal(['loading']);
  expect(builtInPrefixes(element)).to.deep.equal(['loading']);
  expect(headingOf(element, 'loading')).to.equal('Loading…');
  expect(
    retryButton(element) === null,
    'a loading host must not render the failure tier retry control',
  ).to.equal(true);
});

it('reports the busy state to the host in both directions', () => {
  expect(dataStateAriaBusy({ ...IDLE_STATE, loading: true })).to.equal('true');
  expect(
    dataStateAriaBusy({ ...IDLE_STATE, error: true, empty: true }),
    'a settled state must say so rather than dropping the attribute',
  ).to.equal('false');
  expect(dataStateAriaBusy(IDLE_STATE)).to.equal('false');
});

it('keeps the transient loading tier out of the host document outline', async () => {
  const element = await stub({ loading: true, loadingLabel: 'Loading prices' });
  const state = element.shadowRoot!.querySelector<LyraElement>('lr-empty')!;
  await state.updateComplete;

  expect(headingOf(element, 'loading'), 'the caller-supplied label reaches the state').to.equal(
    'Loading prices',
  );
  expect(state.getAttribute('heading-level')).to.equal('none');

  const heading = state.shadowRoot!.querySelector('[part="heading"]');
  expect(heading === null, 'lr-empty must still render its heading part').to.equal(false);
  expect(
    heading!.getAttribute('role'),
    'a busy state is not a section of the host outline',
  ).to.equal(null);
  expect(heading!.hasAttribute('aria-level')).to.equal(false);
});

it('keeps the settled tiers at their level-three heading, and honours an override', async () => {
  const settled = await stub({ error: true });
  const errorState = settled.shadowRoot!.querySelector<LyraElement>('lr-empty')!;
  await errorState.updateComplete;
  expect(errorState.getAttribute('heading-level')).to.equal('3');
  expect(
    errorState.shadowRoot!.querySelector('[part="heading"]')!.getAttribute('aria-level'),
  ).to.equal('3');

  settled.config = { ...IDLE_STATE, empty: true };
  await settled.updateComplete;
  expect(
    settled.shadowRoot!.querySelector('lr-empty')!.getAttribute('heading-level'),
  ).to.equal('3');

  // A host rendering its states inside a listbox or a grid cell opts every tier out.
  const opted = await stub({ error: true, headingLevel: 'none' });
  const optedState = opted.shadowRoot!.querySelector<LyraElement>('lr-empty')!;
  await optedState.updateComplete;
  expect(optedState.getAttribute('heading-level')).to.equal('none');
  expect(
    optedState.shadowRoot!.querySelector('[part="heading"]')!.getAttribute('role'),
  ).to.equal(null);
});

it('renders only the error tier when both error and empty could apply', async () => {
  const element = await stub({ error: true, empty: true });

  expect(slotNames(element)).to.deep.equal(['error']);
  expect(builtInPrefixes(element)).to.deep.equal(['error']);
  expect(headingOf(element, 'error')).to.equal('Could not load data');
  expect(retryButton(element)!.textContent?.trim()).to.equal('Retry');
});

it('publishes the composed empty-state parts under each tier prefix', async () => {
  const element = await stub({ error: true });

  expect(
    element.shadowRoot!.querySelector('lr-empty')!.getAttribute('exportparts'),
  ).to.equal(
    'base:error-base, icon:error-icon, heading:error-heading, description:error-description, actions:error-actions',
  );
});

it('names parts from a per-tier record and from a verbatim string', async () => {
  const record = await stub(
    { error: true },
    { partPrefix: { error: 'results-error', empty: 'results-empty' } },
  );
  expect(builtInPrefixes(record)).to.deep.equal(['results-error']);
  expect(
    record.shadowRoot!.querySelector('lr-empty')!.getAttribute('exportparts'),
  ).to.equal(
    'base:results-error-base, icon:results-error-icon, heading:results-error-heading, ' +
      'description:results-error-description, actions:results-error-actions',
  );

  record.config = { ...IDLE_STATE, empty: true };
  await record.updateComplete;
  expect(builtInPrefixes(record)).to.deep.equal(['results-empty']);

  const verbatim = await stub({ error: true }, { partPrefix: 'failure' });
  expect(builtInPrefixes(verbatim)).to.deep.equal(['failure']);

  const missingEntry = await stub({ error: true }, { partPrefix: { empty: 'results-empty' } });
  expect(
    builtInPrefixes(missingEntry),
    'an unnamed tier falls back to the tier name itself',
  ).to.deep.equal(['error']);
});

it('lets a per-tier slot override suppress only its own built-in copy', async () => {
  const element = await stub({
    error: true,
    slots: { error: litHtml`<p part="custom-error">Custom failure</p>` },
  });

  expect(slotNames(element), 'the branch slot survives the override').to.deep.equal(['error']);
  expect(builtInPrefixes(element)).to.deep.equal([]);
  expect(
    element.shadowRoot!.querySelector('[part="custom-error"]')?.textContent,
  ).to.equal('Custom failure');

  element.config = {
    ...IDLE_STATE,
    empty: true,
    slots: { error: litHtml`<p part="custom-error">Custom failure</p>` },
  };
  await element.updateComplete;

  expect(
    builtInPrefixes(element),
    'overriding the failure copy must not silence the sibling no-data copy',
  ).to.deep.equal(['empty']);
  expect(headingOf(element, 'empty')).to.equal('No data');
});

it('lets a consumer replace one tier wholesale from light DOM', async () => {
  const element = await fixture<DataStateStub>(
    litHtml`<lr-data-state-renderer-test-stub
      ><div slot="error" id="consumer-error">Consumer failure</div></lr-data-state-renderer-test-stub
    >`,
  );
  element.config = { ...IDLE_STATE, error: true };
  await element.updateComplete;

  const slot = element.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="error"]');
  expect(slot === null, 'the failure tier must render inside its named slot').to.equal(false);
  expect(
    slot!.assignedElements({ flatten: false }).map((node) => node.id),
    'the consumer node must actually be assigned to the tier slot',
  ).to.deep.equal(['consumer-error']);

  // The built-in copy stays in the tree as the slot's fallback content, which the spec leaves
  // unrendered while anything is assigned -- so assert boxes, not presence.
  const builtIn = element.shadowRoot!.querySelector('lr-empty');
  expect(builtIn === null, 'the built-in copy remains the slot fallback').to.equal(false);
  expect(
    builtIn!.getClientRects().length,
    'assigned light-DOM content must suppress the built-in copy',
  ).to.equal(0);
  expect(
    element.shadowRoot!.querySelector('[part="retry-button"]')?.getClientRects().length ?? 0,
    'the replaced tier must not leave its retry control laid out underneath',
  ).to.equal(0);
});

it('emits the caller-given cancelable retry event and commits only when unvetoed', async () => {
  let retries = 0;
  const element = await stub(
    { error: true, onRetry: () => (retries += 1) },
    { retryEventName: 'lr-reload' },
  );

  let received: CustomEvent | undefined;
  const veto = (event: Event): void => {
    received = event as CustomEvent;
    event.preventDefault();
  };
  element.addEventListener('lr-reload', veto);
  retryButton(element)!.click();

  expect(received?.type).to.equal('lr-reload');
  expect(received?.cancelable).to.equal(true);
  expect(received?.bubbles).to.equal(true);
  expect(received?.composed).to.equal(true);
  expect(retries, 'a vetoed retry must not run the default action').to.equal(0);

  element.removeEventListener('lr-reload', veto);
  retryButton(element)!.click();
  expect(retries, 'an unvetoed retry runs the caller-supplied default action').to.equal(1);
});

it('still emits the retry event for a host that supplies no default action', async () => {
  // The shape of a host that only listens for the event and reloads from its own handler. The
  // commit still runs -- it just has nothing to call -- so the optional-call path is exercised;
  // anything it threw would surface as an uncaught error and fail this file.
  const element = await stub({ error: true });
  const cancelableFlags: boolean[] = [];
  element.addEventListener('lr-retry', (event) => cancelableFlags.push(event.cancelable));

  retryButton(element)!.click();
  expect(cancelableFlags, 'an absent onRetry must not suppress the event').to.deep.equal([true]);

  const veto = (event: Event): void => event.preventDefault();
  element.addEventListener('lr-retry', veto);
  retryButton(element)!.click();
  expect(cancelableFlags).to.deep.equal([true, true]);
  element.removeEventListener('lr-retry', veto);
});

it('dispatches through a caller-supplied emit adapter when one is given', async () => {
  let retries = 0;
  const cancelableFlags: boolean[] = [];
  const element = await stub();
  element.config = {
    ...IDLE_STATE,
    error: true,
    onRetry: () => (retries += 1),
    // Annotated inline, the shape DataStateConfig.emitRetry documents for an adopting host.
    emitRetry: (detail, init: { cancelable: true }) => {
      cancelableFlags.push(init.cancelable);
      const event = new CustomEvent('lr-host-retry', {
        ...init,
        detail,
        bubbles: true,
        composed: true,
      });
      element.dispatchEvent(event);
      return event;
    },
  };
  await element.updateComplete;

  const seen: string[] = [];
  element.addEventListener('lr-host-retry', (event) => seen.push(event.type));
  retryButton(element)!.click();

  expect(seen).to.deep.equal(['lr-host-retry']);
  expect(cancelableFlags, 'the helper always proposes a cancelable request').to.deep.equal([true]);
  expect(retries).to.equal(1);

  const veto = (event: Event): void => event.preventDefault();
  element.addEventListener('lr-host-retry', veto);
  retryButton(element)!.click();
  expect(retries, 'a vetoed adapter dispatch must not commit either').to.equal(1);
  element.removeEventListener('lr-host-retry', veto);
});

it('activates retry from the keyboard on the actually-focused control', async () => {
  let retries = 0;
  const element = await stub({ error: true, onRetry: () => (retries += 1) });
  const button = await laidOutRetryButton(element);

  const events: string[] = [];
  element.addEventListener('lr-retry', (event) => events.push(event.type));

  button.focus();
  expect(
    element.shadowRoot!.activeElement === button,
    'the retry control must actually hold focus before the key press',
  ).to.equal(true);

  await sendKeys({ press: 'Enter' });
  expect(events).to.deep.equal(['lr-retry']);
  expect(retries).to.equal(1);

  await sendKeys({ press: 'Space' });
  expect(events).to.deep.equal(['lr-retry', 'lr-retry']);
  expect(retries).to.equal(2);
});

it('keeps retry working after a disconnect and reconnect', async () => {
  let retries = 0;
  const element = await stub({ error: true, onRetry: () => (retries += 1) });
  const parent = element.parentNode!;

  element.remove();
  parent.appendChild(element);
  await element.updateComplete;

  retryButton(element)!.click();
  expect(retries).to.equal(1);
});

it('routes the built-in failure copy through a strings override', async () => {
  const element = await stub({ error: true });
  expect(
    headingOf(element, 'error'),
    'the English default must render with no locale registered',
  ).to.equal('Could not load data');

  element.strings = { tableLoadFailed: 'Catalogue unavailable', retry: 'Try again' };
  await element.updateComplete;

  expect(headingOf(element, 'error')).to.equal('Catalogue unavailable');
  expect(retryButton(element)!.textContent?.trim()).to.equal('Try again');
});

it('renders a caller-supplied heading verbatim without localizing it', async () => {
  const element = await stub({
    error: true,
    errorHeading: 'Feed offline',
    errorDescription: 'The pricing service did not respond.',
  });

  expect(headingOf(element, 'error')).to.equal('Feed offline');
  expect(descriptionOf(element, 'error')).to.equal('The pricing service did not respond.');
});

it('renders a caller-supplied no-data heading and description verbatim', async () => {
  const localized = await stub({ empty: true });
  expect(
    headingOf(localized, 'empty'),
    'the English default must render with no locale registered',
  ).to.equal('No data');

  const element = await stub({
    empty: true,
    emptyHeading: 'No matching rows',
    emptyDescription: 'Clear the filter to see everything.',
  });

  expect(headingOf(element, 'empty')).to.equal('No matching rows');
  expect(descriptionOf(element, 'empty')).to.equal('Clear the filter to see everything.');
});

it('leaves compact and description unset when the caller omits them', async () => {
  const element = await stub({ empty: true });
  const state = element.shadowRoot!.querySelector('lr-empty')!;

  expect(state.hasAttribute('compact'), 'compact must stay opt-in').to.equal(false);
  expect(descriptionOf(element, 'empty')).to.equal('');

  element.config = { ...IDLE_STATE, empty: true, compact: true };
  await element.updateComplete;
  expect(
    element.shadowRoot!.querySelector('lr-empty')!.hasAttribute('compact'),
  ).to.equal(true);
});

it('paints the shared retry control from the stylesheet partial', async () => {
  const element = await stub({ error: true });
  const button = await laidOutRetryButton(element);
  const computed = getComputedStyle(button);

  expect(computed.cursor, 'the retry control must read as interactive').to.equal('pointer');
  expect(computed.display).to.equal('inline-flex');
});

it('paints a grid host state row from the parameterized surface partial', async () => {
  const element = await fixture<DataStateRowStub>(
    litHtml`<lr-data-state-renderer-test-row></lr-data-state-renderer-test-row>`,
  );
  element.config = { ...IDLE_STATE, error: true };
  await element.updateComplete;

  const cell = element.shadowRoot!.querySelector<HTMLElement>('[part="error-cell"]')!;
  const computed = getComputedStyle(cell);
  expect(
    computed.backgroundColor,
    'the surface partial must paint the state cell rather than leaving it transparent',
  ).to.not.equal('rgba(0, 0, 0, 0)');
  expect(computed.borderBlockEndStyle).to.equal('solid');
});

it('rejects a part prefix that is not a kebab-case part name', () => {
  expect(() => dataStateSurfaceStyles(`error'] , [part='row`)).to.throw(TypeError);
  expect(() => dataStateSurfaceStyles('Error')).to.throw(TypeError);
  expect(() => dataStateSurfaceStyles('')).to.throw(TypeError);
  expect(() => dataStateSurfaceStyles('results-error')).to.not.throw();
});

it('refuses in the renderer exactly the prefixes the stylesheet partial refuses', async () => {
  // The part a host names for the markup and the prefix it hands the surface partial are two
  // separate arguments with nothing tying them together. Accepting a value in one entry point and
  // rejecting it in the other is how the attribute and the selector meant to paint it drift apart.
  const element = await stub();
  const failed: DataStateConfig = { ...IDLE_STATE, error: true };

  expect(() => renderDataState(element, failed, 'Results Error', 'lr-retry')).to.throw(TypeError);
  expect(() => renderDataState(element, failed, { error: 'results error' }, 'lr-retry')).to.throw(
    TypeError,
  );
  expect(() =>
    renderDataState(element, failed, `error'] , [part='row`, 'lr-retry'),
  ).to.throw(TypeError);

  expect(() => renderDataState(element, failed, { error: 'results-error' }, 'lr-retry')).to.not.throw();
  expect(
    () => renderDataState(element, failed, {}, 'lr-retry'),
    'the tier-name fallback is itself a valid part name',
  ).to.not.throw();
});

it('is accessible in the loading state', async () => {
  const element = await stub({ loading: true, loadingLabel: 'Loading prices' });
  await expect(element).to.be.accessible();
});

it('is accessible in the failure state', async () => {
  const element = await stub({
    error: true,
    errorDescription: 'The pricing service did not respond.',
  });
  await laidOutRetryButton(element);
  await expect(element).to.be.accessible();
});

it('is accessible in the empty state', async () => {
  const element = await stub({
    empty: true,
    emptyDescription: 'Try a different search.',
  });
  await expect(element).to.be.accessible();
});
