import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './json-viewer.js';
import type { LyraJsonViewer } from './json-viewer.js';

let originalClipboard: PropertyDescriptor | undefined;
beforeEach(() => {
  originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: () => Promise.resolve() },
  });
});
afterEach(() => {
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
  else Reflect.deleteProperty(navigator, 'clipboard');
});

async function withData(data: unknown): Promise<LyraJsonViewer> {
  const el = await fixture<LyraJsonViewer>(html`<lr-json-viewer .data=${data}></lr-json-viewer>`);
  await el.updateComplete;
  return el;
}

describe('bounded descriptor admission', () => {
  it('caps deep admission before reading a descendant beyond the supported depth', async () => {
    let data: Record<string, unknown> = { beyond: 'not admitted' };
    for (let depth = 0; depth < 101; depth += 1) data = { child: data };
    const el = await fixture<LyraJsonViewer>(html`<lr-json-viewer .data=${data} expand-depth="0"></lr-json-viewer>`);
    expect(await el.runSearch('not admitted')).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(1);
  });

  it('retains safe array siblings after descriptor failure and unsupported symbol leaves', async () => {
    const data = new Proxy([0, Symbol('hidden'), 'kept'], {
      getOwnPropertyDescriptor(target, key) {
        if (key === '0') throw new Error('private array descriptor failure');
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    const el = await withData(data);
    expect(await el.runSearch('kept')).to.equal(1);
    expect(await el.runSearch('undefined')).to.equal(2);
    expect(el.shadowRoot!.textContent).not.to.contain('private array descriptor failure');
    expect(el.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(1);
  });

  it('stops own-object admission at the node budget while retaining earlier data', async () => {
    const data = Object.fromEntries(Array.from({ length: 5001 }, (_, index) => [`key-${index}`, index]));
    const el = await fixture<LyraJsonViewer>(html`<lr-json-viewer .data=${data} expand-depth="0"></lr-json-viewer>`);
    expect(await el.runSearch('key-5000')).to.equal(0);
    expect(await el.runSearch('key-4998')).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(1);
  });

  it('refuses a revoked array and a failed own-key reflection without affecting valid siblings', async () => {
    const revoked = Proxy.revocable([], {});
    revoked.revoke();
    const inaccessible = new Proxy({}, {
      ownKeys() { throw new Error('private reflection failure'); },
    });
    const el = await withData({ revoked: revoked.proxy, inaccessible, safe: 'kept' });
    const keys = Array.from(el.shadowRoot!.querySelectorAll('[part="key"]'), key => key.textContent);
    expect(keys).to.deep.equal(['safe']);
    expect(el.shadowRoot!.textContent).to.contain('kept');
    expect(el.shadowRoot!.textContent).not.to.contain('private reflection failure');
    expect(el.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(1);
  });

  it('refuses unsafe array lengths and omits unsupported leaves without invoking them', async () => {
    let calls = 0;
    const invalidLength = new Proxy([], {
      getOwnPropertyDescriptor(target, key) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
        return key === 'length' ? { ...descriptor, value: -1 } : descriptor;
      },
    });
    const throwingLength = new Proxy([], {
      getOwnPropertyDescriptor() { throw new Error('private length failure'); },
    });
    const el = await withData({
      invalidLength, throwingLength, symbol: Symbol('hidden'),
      callable: () => { calls += 1; }, safe: 42,
    });
    expect(Array.from(el.shadowRoot!.querySelectorAll('[part="key"]'), key => key.textContent)).to.deep.equal(['safe']);
    expect(calls).to.equal(0);
    expect(el.shadowRoot!.textContent).to.contain('42');
    expect(el.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(1);
  });

  it('ignores an own-key name that disappears before its descriptor is read', async () => {
    const source = new Proxy({}, {
      ownKeys: () => ['vanished', 'safe'],
      getOwnPropertyDescriptor(_target, key) {
        return key === 'safe' ? { value: 'kept', enumerable: true, configurable: true } : undefined;
      },
    });
    const el = await withData(source);
    expect(Array.from(el.shadowRoot!.querySelectorAll('[part="key"]'), key => key.textContent)).to.deep.equal(['safe']);
    expect(el.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(0);
  });

  it('stops array admission at the node budget and never searches later values', async () => {
    const data = Array.from({ length: 5001 }, (_, index) => index === 5000 ? 'beyond budget' : index);
    const el = await fixture<LyraJsonViewer>(html`<lr-json-viewer .data=${data} expand-depth="0"></lr-json-viewer>`);
    expect(await el.runSearch('beyond budget')).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(1);
    expect(el.shadowRoot!.textContent).not.to.contain('beyond budget');
  });

  it('bounds sparse array inspections even when no child consumes a JSON node', async () => {
    const data = new Array<unknown>(10001);
    data[10000] = 'beyond inspection budget';
    const el = await fixture<LyraJsonViewer>(html`<lr-json-viewer .data=${data} expand-depth="0"></lr-json-viewer>`);
    expect(await el.runSearch('beyond inspection budget')).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(1);
    expect(el.shadowRoot!.querySelector('.preview')!.textContent).to.contain('10,000');
  });

  it('bounds non-enumerable name inspection and reports the refused later branch', async () => {
    const data = Object.create(null) as Record<string, unknown>;
    for (let index = 0; index < 10001; index += 1) {
      Object.defineProperty(data, `hidden-${index}`, { value: index });
    }
    data['late'] = 'beyond inspection budget';
    const el = await withData(data);
    expect(await el.runSearch('beyond inspection budget')).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="key"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(1);
  });
});

describe('realm-installed array serialization hooks', () => {
  for (const throwsDuringCoercion of [false, true]) {
    it(`copies a safe fallback when an inherited hook suppresses JSON${throwsDuringCoercion ? ' and coercion throws' : ''}`, async () => {
      const el = await fixture<LyraJsonViewer>(html`<lr-json-viewer copyable .data=${[1, 2]}></lr-json-viewer>`);
      const originalJson = Object.getOwnPropertyDescriptor(Array.prototype, 'toJSON');
      const originalCoercion = Object.getOwnPropertyDescriptor(Array.prototype, Symbol.toPrimitive);
      const copied = oneEvent(el, 'lr-copy');
      try {
        Object.defineProperty(Array.prototype, 'toJSON', {
          configurable: true,
          value(this: unknown[]) { return Object.isFrozen(this) ? undefined : this; },
        });
        if (throwsDuringCoercion) {
          Object.defineProperty(Array.prototype, Symbol.toPrimitive, {
            configurable: true,
            value(this: unknown[]) {
              if (Object.isFrozen(this)) throw new Error('private coercion failure');
              return this.join(',');
            },
          });
        }
        el.shadowRoot!.querySelector<HTMLButtonElement>('[part="toolbar"] [part="copy-button"]')!.click();
      } finally {
        if (originalJson) Object.defineProperty(Array.prototype, 'toJSON', originalJson);
        else Reflect.deleteProperty(Array.prototype, 'toJSON');
        if (originalCoercion) Object.defineProperty(Array.prototype, Symbol.toPrimitive, originalCoercion);
        else Reflect.deleteProperty(Array.prototype, Symbol.toPrimitive);
      }
      const event = await copied as CustomEvent<{ ok: boolean; text: string }>;
      expect(event.detail.ok).to.equal(true);
      expect(event.detail.text).to.equal(throwsDuringCoercion ? '' : '1,2');
      expect(el.shadowRoot!.textContent).not.to.contain('private coercion failure');
    });
  }

  it('reports serialization failure through a frozen failure outcome without calling clipboard', async () => {
    const el = await fixture<LyraJsonViewer>(html`<lr-json-viewer copyable .data=${[1, 2]}></lr-json-viewer>`);
    const originalJson = Object.getOwnPropertyDescriptor(Array.prototype, 'toJSON');
    const failure = new Error('private serialization failure');
    let writes = 0;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => { writes += 1; return Promise.resolve(); } },
    });
    const rejected = oneEvent(el, 'lr-copy-error');
    let genericErrors = 0;
    el.addEventListener('lr-error', () => genericErrors += 1);
    try {
      Object.defineProperty(Array.prototype, 'toJSON', {
        configurable: true,
        value(this: unknown[]) {
          if (Object.isFrozen(this)) throw failure;
          return this;
        },
      });
      el.shadowRoot!.querySelector<HTMLButtonElement>('[part="toolbar"] [part="copy-button"]')!.click();
    } finally {
      if (originalJson) Object.defineProperty(Array.prototype, 'toJSON', originalJson);
      else Reflect.deleteProperty(Array.prototype, 'toJSON');
    }
    const event = await rejected as CustomEvent<{ ok: boolean; text: string; reason: string; error: unknown }>;
    expect(event.detail.ok).to.equal(false);
    expect(event.detail.text).to.equal('');
    expect(event.detail.reason).to.equal('failed');
    expect(event.detail.error === failure).to.equal(true);
    expect(Object.isFrozen(event.detail)).to.equal(true);
    expect(genericErrors).to.equal(1);
    expect(writes).to.equal(0);
    expect(el.shadowRoot!.textContent).not.to.contain('private serialization failure');
  });
});

it('drops collapse overrides for removed paths before their names are reused', async () => {
  const el = await withData({ nested: { value: 'original' } });
  const nestedRow = Array.from(el.shadowRoot!.querySelectorAll('.row')).find(row => row.querySelector('[part="key"]')?.textContent === 'nested')!;
  nestedRow.querySelector<HTMLButtonElement>('[part="toggle"]')!.click();
  await el.updateComplete;
  expect(el.shadowRoot!.textContent).not.to.contain('original');
  el.data = { different: true };
  await el.updateComplete;
  el.data = { nested: { value: 'replacement' } };
  await el.updateComplete;
  expect(el.shadowRoot!.textContent).to.contain('replacement');
});

it('clears a navigated search and applies then removes a valid max-height override', async () => {
  const el = await withData({ value: 'needle' });
  expect(await el.runSearch('needle')).to.equal(1);
  expect(await el.searchNext()).to.equal(true);
  el.clearSearch();
  await el.updateComplete;
  expect(el.query).to.equal('');
  expect(el.shadowRoot!.querySelectorAll('[data-match], [data-active]').length).to.equal(0);
  expect(await el.searchNext()).to.equal(false);
  el.maxHeight = '80px';
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  expect(getComputedStyle(base).maxHeight).to.equal('80px');
  el.maxHeight = '80px; color:red';
  await el.updateComplete;
  expect(base.style.getPropertyValue('--lr-json-viewer-max-height')).to.equal('');
  expect(getComputedStyle(base).maxHeight).to.equal('none');
});
