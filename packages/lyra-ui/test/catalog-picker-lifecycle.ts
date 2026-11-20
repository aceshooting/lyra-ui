import { expect, fixture, waitUntil } from '@open-wc/testing';
import { unsafeStatic, html as staticHtml } from 'lit/static-html.js';

interface CatalogPickerUnderTest extends HTMLElement {
  open: boolean;
  value: string;
  disabled: boolean;
  readonly: boolean;
  catalog: unknown;
  updateComplete: Promise<boolean>;
}

const LIFECYCLE = ['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide'] as const;

function record(el: HTMLElement, names: readonly string[]): string[] {
  const seen: string[] = [];
  for (const name of names) el.addEventListener(name, () => seen.push(name));
  return seen;
}

/** Shared popup-lifecycle and change-request contract of the catalog-backed conversation pickers. */
export function describeCatalogPickerLifecycle(tagName: string): void {
  const tag = unsafeStatic(tagName);
  const mount = (open = false) =>
    fixture<CatalogPickerUnderTest>(
      staticHtml`<${tag} .catalog=${['alpha', 'beta']} value="alpha" ?open=${open}></${tag}>`,
    );
  const options = (el: CatalogPickerUnderTest) =>
    Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('[part="option"]'));

  describe(`${tagName} popup lifecycle`, () => {
    it('requests and settles an open and a close set through the property', async () => {
      const el = await mount();
      const seen = record(el, LIFECYCLE);
      el.open = true;
      await waitUntil(() => seen.includes('lr-after-show'), 'the opened listbox settles');
      el.open = false;
      await waitUntil(() => seen.includes('lr-after-hide'), 'the closed listbox settles');
      expect(seen).to.deep.equal(['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']);
    });

    it('keeps the listbox closed, and the attribute in step, when lr-show is cancelled', async () => {
      const el = await mount();
      let cancelable = false;
      el.addEventListener('lr-show', (event) => {
        cancelable = event.cancelable;
        event.preventDefault();
      });
      el.setAttribute('open', '');
      await el.updateComplete;
      expect(cancelable).to.equal(true);
      expect(el.open).to.equal(false);
      expect(el.hasAttribute('open')).to.equal(false);
      el.open = true;
      await el.updateComplete;
      expect(el.open).to.equal(false);
    });

    it('keeps the listbox open when lr-hide is cancelled', async () => {
      const el = await mount();
      el.open = true;
      await el.updateComplete;
      el.addEventListener('lr-hide', (event) => event.preventDefault());
      el.open = false;
      await el.updateComplete;
      expect(el.open).to.equal(true);
      expect(el.hasAttribute('open')).to.equal(true);
    });

    it('does not request the open state it renders with first', async () => {
      const seen: string[] = [];
      const onEvent = (event: Event) => seen.push(event.type);
      for (const name of LIFECYCLE) document.addEventListener(name, onEvent);
      try {
        const el = await mount(true);
        expect(el.open).to.equal(true);
        expect(seen).to.deep.equal([]);
      } finally {
        for (const name of LIFECYCLE) document.removeEventListener(name, onEvent);
      }
    });

    it('announces, but cannot veto, the close that disabling forces', async () => {
      const el = await mount();
      el.open = true;
      await el.updateComplete;
      const cancelable: boolean[] = [];
      el.addEventListener('lr-hide', (event) => {
        cancelable.push(event.cancelable);
        event.preventDefault();
      });
      el.disabled = true;
      await el.updateComplete;
      expect(el.open).to.equal(false);
      expect(cancelable).to.deep.equal([false]);
    });
  });

  describe(`${tagName} change request`, () => {
    it('requests a pick with a frozen proposal before committing it', async () => {
      const el = await mount();
      el.open = true;
      await el.updateComplete;
      const seen = record(el, ['lr-change-request', 'lr-change']);
      let detail: unknown;
      el.addEventListener('lr-change-request', (event) => {
        detail = (event as CustomEvent).detail;
      });
      options(el)[1]!.click();
      await el.updateComplete;
      expect(seen).to.deep.equal(['lr-change-request', 'lr-change']);
      expect(detail).to.deep.equal({ value: 'beta', inCatalog: true });
      expect(Object.isFrozen(detail)).to.equal(true);
      expect(el.value).to.equal('beta');
    });

    it('keeps the value and the open popup when the request is cancelled', async () => {
      const el = await mount();
      el.open = true;
      await el.updateComplete;
      const seen = record(el, ['lr-change']);
      el.addEventListener('lr-change-request', (event) => event.preventDefault());
      options(el)[1]!.click();
      await el.updateComplete;
      expect(el.value).to.equal('alpha');
      expect(el.open).to.equal(true);
      expect(seen).to.deep.equal([]);
    });

    for (const change of ['disables', 'detaches', 'makes read-only', 're-values'] as const) {
      it(`commits nothing when a request listener ${change} the picker`, async () => {
        const el = await mount();
        el.open = true;
        await el.updateComplete;
        const seen = record(el, ['lr-change']);
        el.addEventListener('lr-change-request', () => {
          if (change === 'disables') el.disabled = true;
          else if (change === 'detaches') el.remove();
          else if (change === 'makes read-only') el.readonly = true;
          else el.value = 'listener';
        });
        options(el)[1]!.click();
        await el.updateComplete;
        expect(el.value).to.equal(change === 're-values' ? 'listener' : 'alpha');
        expect(seen).to.deep.equal([]);
      });
    }

    it('never requests a programmatic value write', async () => {
      const el = await mount();
      const seen = record(el, ['lr-change-request']);
      el.value = 'beta';
      await el.updateComplete;
      expect(seen).to.deep.equal([]);
    });
  });
}
