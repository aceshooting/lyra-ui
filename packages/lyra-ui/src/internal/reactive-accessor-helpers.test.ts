import { expect, fixture, html } from '@open-wc/testing';
import { LitElement } from 'lit';
import { isLiveDisabled } from './form-associated.js';
import { PositioningStrategyState, positioningStrategyConverter } from './positioning-strategy.js';
import { writeCatalogProperty } from './selection-catalog.js';
import { writeOptionalSize, type LyraSize } from './variants.js';

class Host extends LitElement {
  static formAssociated = true;
  updates: string[] = [];
  private _size?: LyraSize;
  get size(): LyraSize | undefined { return this._size; }
  set size(next: LyraSize | undefined) { writeOptionalSize(this, this._size, next, (v) => { this._size = v; }); }
  readonly strategy = new PositioningStrategyState(this);
  get positioningStrategy() { return this.strategy.value; }
  set positioningStrategy(next) { this.strategy.set(next); }
  get hoist() { return this.strategy.hoist; }
  set hoist(next: boolean) { this.strategy.setHoist(next); }
  private _rows?: readonly string[];
  validityCalls = 0;
  get rows() { return this._rows; }
  set rows(value: readonly string[] | undefined) {
    writeCatalogProperty(this, 'rows', this._rows, () => value && [...value], (v) => { this._rows = v; }, () => { this.validityCalls++; });
  }
  override requestUpdate(name?: PropertyKey, old?: unknown, options?: never): void {
    if (typeof name === 'string') this.updates.push(name);
    super.requestUpdate(name, old, options);
  }
  get effectiveDisabled(): boolean { return this.hasAttribute('disabled'); }
}
customElements.define('h3-accessor-host', Host);

describe('writeOptionalSize', () => {
  it('reflects a valid size, drops an invalid one with its stale attribute, and skips unchanged writes', async () => {
    const el = await fixture<Host>(html`<h3-accessor-host size="m"></h3-accessor-host>`);
    expect(el.getAttribute('size')).to.equal('m');
    el.size = 'small';
    expect(el.size).to.equal('small');
    expect(el.getAttribute('size')).to.equal('small');
    el.updates.length = 0;
    el.size = 'small';
    expect(el.updates).to.deep.equal([]);
    el.size = 'huge' as never;
    expect(el.size).to.equal(undefined);
    expect(el.hasAttribute('size')).to.equal(false);
    expect(el.updates).to.deep.equal(['size']);
  });
});

describe('PositioningStrategyState', () => {
  it('records an authored default as authored, mirrors hoist, and rejects invalid values', async () => {
    const el = await fixture<Host>(html`<h3-accessor-host></h3-accessor-host>`);
    expect(el.strategy.authored).to.equal(undefined);
    expect(el.positioningStrategy).to.equal('absolute');
    el.positioningStrategy = 'absolute';
    expect(el.strategy.authored).to.equal('absolute');
    el.updates.length = 0;
    el.hoist = true;
    expect(el.positioningStrategy).to.equal('fixed');
    expect(el.updates).to.deep.equal(['positioningStrategy', 'hoist']);
    el.positioningStrategy = 'sticky' as never;
    expect(el.positioningStrategy).to.equal('absolute');
    expect(el.hoist).to.equal(false);
    expect(positioningStrategyConverter.fromAttribute!('sticky')).to.equal(undefined);
  });
});

describe('writeCatalogProperty', () => {
  it('stores a snapshot, revalidates and requests the named update; undefined restores defaults', async () => {
    const el = await fixture<Host>(html`<h3-accessor-host></h3-accessor-host>`);
    const source = ['a', 'b'];
    el.rows = source;
    source.push('c');
    expect(el.rows).to.deep.equal(['a', 'b']);
    expect(el.validityCalls).to.equal(1);
    expect(el.updates).to.include('rows');
    el.rows = undefined;
    expect(el.rows).to.equal(undefined);
    expect(el.validityCalls).to.equal(2);
  });
});

describe('isLiveDisabled', () => {
  it('reads own disablement and the synchronous fieldset cascade', async () => {
    const form = await fixture<HTMLFormElement>(html`<form><fieldset><h3-accessor-host></h3-accessor-host></fieldset></form>`);
    const el = form.querySelector('h3-accessor-host') as Host;
    expect(isLiveDisabled(el)).to.equal(false);
    el.setAttribute('disabled', '');
    expect(isLiveDisabled(el)).to.equal(true);
    el.removeAttribute('disabled');
    form.querySelector('fieldset')!.disabled = true;
    expect(el.effectiveDisabled).to.equal(false);
    expect(isLiveDisabled(el)).to.equal(true);
  });

  it('answers from own state alone on a host without matches()', () => {
    const el = document.createElement('h3-accessor-host') as Host;
    Object.defineProperty(el, 'matches', { configurable: true, value: undefined });
    expect(isLiveDisabled(el)).to.equal(false);
    el.setAttribute('disabled', '');
    expect(isLiveDisabled(el)).to.equal(true);
  });
});
