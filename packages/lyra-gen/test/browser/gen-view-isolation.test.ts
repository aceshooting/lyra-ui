import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '@aceshooting/lyra-translations/fr/conversation.js';
import { focusByKeyboard } from '../../../lyra-ui/test/wtr-focus.js';
import { createCatalog } from '../../src/catalog.js';
import { LyraGenViewElement } from '../../src/gen-view.js';
import { LYRA_GEN_STRINGS } from '../../src/localization.js';
import { validateView } from '../../src/runtime.js';
import type { LyraGenAction, LyraGenView } from '../../src/types.js';

const catalog = createCatalog({ id: 'isolation-browser', version: '1', components: {
  stack: { tag: 'div', properties: {}, children: true },
  text: { tag: 'p', properties: {}, text: true },
  action: { tag: 'button', properties: {}, text: true, interactive: true, events: ['click'] },
}, actions: { press: { payload: { type: 'object', properties: {} } } } });
const view = (revision: number, badType = 'missing-role'): LyraGenView => ({ version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'isolation', revision, root: { id: 'root', type: 'stack', children: [
  { id: 'intro', type: 'text', text: 'Unaffected copy' },
  { id: 'broken', type: badType, text: 'Defective' },
  { id: 'go', type: 'action', text: 'Continue', action: { name: 'press', payload: {} } },
] } } as unknown as LyraGenView);
const settled = async (host: LyraGenViewElement): Promise<void> => {
  await host.updateComplete;
  await waitUntil(() => host.status === 'ready' || host.status === 'error', 'Generated view settles', { timeout: 5000 });
};
const fallbacks = (host: LyraGenViewElement): NodeListOf<HTMLElement> => host.shadowRoot!.querySelectorAll<HTMLElement>('[part="isolated"]');

describe('generated view error isolation', () => {
  it('renders siblings and one localized non-interactive fallback in isolate mode', async () => {
    const host = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${catalog} .document=${view(0)} recovery="isolate"></lr-gen-view>`);
    await settled(host);
    expect(host.status).to.equal('ready');
    expect(host.shadowRoot!.querySelector('[data-gen-id="intro"]')?.textContent).to.equal('Unaffected copy');
    expect(host.shadowRoot!.querySelector('[data-gen-id="go"]')?.textContent).to.equal('Continue');
    const [fallback, ...rest] = fallbacks(host);
    expect(rest.length).to.equal(0);
    expect(fallback!.getAttribute('data-gen-id')).to.equal('broken');
    expect(fallback!.getAttribute('role')).to.equal('group');
    expect(fallback!.textContent).to.equal(LYRA_GEN_STRINGS.genViewInvalid);
    expect(fallback!.querySelector('button, a, input, [tabindex]')).to.equal(null);
    expect(getComputedStyle(fallback!).borderBlockStartStyle).to.equal('dashed');
    await expect(host).to.be.accessible();
  });

  it('keeps strict as the default and for invalid recovery values', async () => {
    const host = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${catalog} .document=${view(0)}></lr-gen-view>`);
    await settled(host);
    expect(host.recovery).to.equal('strict');
    expect(host.status).to.equal('error');
    expect(fallbacks(host).length).to.equal(0);
    expect(host.shadowRoot!.querySelector('[part="error"]')?.textContent).to.equal(LYRA_GEN_STRINGS.genViewInvalid);
    host.setAttribute('recovery', 'bogus');
    host.document = view(1);
    await settled(host);
    expect(host.status).to.equal('error');
    host.recovery = 'isolate';
    await settled(host);
    expect(host.status).to.equal('ready');
    expect(fallbacks(host).length).to.equal(1);
  });

  it('translates the fallback through a registered locale and mirrors under RTL', async () => {
    const parent = await fixture<HTMLElement>(html`<section lang="fr" dir="rtl"><lr-gen-view .catalog=${catalog} .document=${view(0)} recovery="isolate"></lr-gen-view></section>`);
    const host = parent.querySelector<LyraGenViewElement>('lr-gen-view')!;
    await settled(host);
    const fallback = fallbacks(host)[0]!;
    expect(fallback.textContent).to.equal('Cette vue générée ne peut pas être affichée.');
    expect(getComputedStyle(host).direction).to.equal('rtl');
    expect(host.hasAttribute('dir')).to.equal(false);
    expect(getComputedStyle(fallback).textAlign === 'right' || getComputedStyle(fallback).textAlign === 'start').to.equal(true);
    await expect(host).to.be.accessible();
  });

  it('keeps focus and actions on a sibling control while the defective node changes', async () => {
    const host = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${catalog} .document=${view(0)} recovery="isolate"></lr-gen-view>`);
    await settled(host);
    const actions: LyraGenAction[] = [];
    host.addEventListener('lr-gen-action', event => actions.push((event as CustomEvent<LyraGenAction>).detail));
    const control = host.shadowRoot!.querySelector<HTMLButtonElement>('[data-gen-id="go"]')!;
    await focusByKeyboard(control);
    expect(host.shadowRoot!.activeElement).to.equal(control);
    host.document = view(1, 'another-missing-role');
    await settled(host);
    expect(host.shadowRoot!.querySelector('[data-gen-id="go"]')).to.equal(control);
    expect(host.shadowRoot!.activeElement).to.equal(control);
    control.click();
    await waitUntil(() => actions.length === 1, 'The sibling action is requested', { timeout: 5000 });
    expect(actions.map(action => action.name)).to.deep.equal(['press']);
    fallbacks(host)[0]!.click();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(actions.length).to.equal(1);
  });

  it('renders an isolated document that a host persisted and re-validated, even under strict recovery', async () => {
    const checked = validateView(view(0), catalog, { recovery: 'isolate' });
    expect(checked.ok && checked.isolated?.length).to.equal(1);
    if (!checked.ok) return;
    const host = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${catalog} .document=${checked.value}></lr-gen-view>`);
    await settled(host);
    expect(host.status).to.equal('ready');
    expect(fallbacks(host).length).to.equal(1);
    // A JSON copy carries the reserved marker type and is rejected; hosts persist the original input.
    const copy = JSON.parse(JSON.stringify(checked.value)) as LyraGenView;
    host.document = { ...copy, revision: 1 };
    await settled(host);
    expect(host.status).to.equal('error');
  });
});
