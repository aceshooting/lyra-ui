import { expect, fixture, html } from '@open-wc/testing';
import type { LyraChart3d, LyraChart3dColumns } from './chart-3d.class.js';
import { normalizeChart3dCamera } from './chart-3d-data.js';
import './chart-3d.js';

function columns(count = 3): LyraChart3dColumns {
  return {
    ids: Array.from({ length: count }, (_, index) => `row-${index}`),
    x: Float32Array.from({ length: count }, (_, index) => index),
    y: Float32Array.from({ length: count }, (_, index) => index * 2),
    z: Float32Array.from({ length: count }, (_, index) => -index),
  };
}

async function mount(data: LyraChart3dColumns | null): Promise<LyraChart3d> {
  const wrapper = await fixture<HTMLElement>(html`<div></div>`);
  const el = document.createElement('lr-chart-3d') as LyraChart3d;
  el.data = data;
  wrapper.append(el);
  await el.updateComplete;
  return el;
}

const part = (el: LyraChart3d, name: string) => el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`);
const headers = (el: LyraChart3d) => Array.from(el.shadowRoot!.querySelectorAll('thead th')).map((cell) => cell.textContent!.trim());

function revoked(): object {
  const { proxy, revoke } = Proxy.revocable({}, {});
  revoke();
  return proxy;
}

describe('lr-chart-3d controls retained after the data is cleared', () => {
  it('fit() without rows restores the default camera instead of throwing', async () => {
    const el = await mount(null);
    expect(part(el, 'empty')).to.exist;
    el.camera = { ...normalizeChart3dCamera(undefined), distance: 9 };
    el.fit();
    expect(el.camera).to.deep.equal(normalizeChart3dCamera(undefined));
  });

  it('a detached cursor, row or page control is inert once the rows are gone', async () => {
    const el = await mount(columns(450));
    const cursor = part(el, 'cursor')!;
    const row = part(el, 'row-button')!;
    const next = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="page-button"]')[1]!;
    expect(next.disabled).to.equal(false);
    const selections: { id: string }[] = [];
    el.addEventListener('lr-chart-row-select', (event) => selections.push((event as CustomEvent).detail));
    // While populated, the same controls move the cursor and select rows.
    cursor.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(part(el, 'cursor')!.textContent).to.include('2');
    row.click();
    expect(selections.map((detail) => detail.id)).to.deep.equal(['row-0']);
    cursor.click();
    expect(selections).to.have.length(2);
    await el.updateComplete;
    next.click();
    await el.updateComplete;
    expect(part(el, 'row-button')!.dataset['id']).to.equal('row-200');
    selections.length = 0;
    const selectedBefore = el.selectedId;
    el.data = null;
    await el.updateComplete;
    expect(part(el, 'empty')).to.exist;
    expect(cursor.isConnected).to.equal(false);

    cursor.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    cursor.click();
    row.click();
    next.click();
    await el.updateComplete;

    expect(selections).to.have.length(0);
    expect(el.selectedId).to.equal(selectedBefore);
    expect(part(el, 'empty')).to.exist;
  });
});

describe('lr-chart-3d normalization edges', () => {
  it('an unreadable axis normalizes to the localized default title and equal axes do not re-render', async () => {
    const el = await mount(columns());
    const defaults = headers(el);
    el.xAxis = { label: 'Width', unit: 'm' };
    await el.updateComplete;
    expect(headers(el).join('|')).to.include('Width');

    el.xAxis = revoked() as never;
    await el.updateComplete;
    expect(headers(el)).to.deep.equal(defaults);
    const stored = el.xAxis;

    // An empty-but-readable axis is the same unset axis and keeps the stored object.
    el.xAxis = { label: '', unit: '' };
    expect(el.xAxis).to.equal(stored);
    el.xAxis = revoked() as never;
    expect(el.xAxis).to.equal(stored);
    expect(headers(el)).to.deep.equal(defaults);
  });

  it('stops admitting hidden categories once every valid index is hidden', async () => {
    const el = await mount(columns());
    const all = new Set<number>(Array.from({ length: 70_000 }, (_, index) => index));
    el.hiddenCategories = all;
    const hidden = el.hiddenCategories;
    expect(hidden.size).to.equal(65_536);
    expect(hidden.has(65_535)).to.equal(true);
    expect(hidden.has(65_536)).to.equal(false);
  });
});
