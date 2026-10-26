import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../lyra-ui/test/wtr-focus.js';
import { createCatalog } from '../../src/catalog.js';
import { LyraGenViewElement } from '../../src/gen-view.js';
import type { LyraGenView } from '../../src/types.js';
import { connectGeneratedNavigation } from '../../examples/navigation.js';

const catalog = createCatalog({ id: 'navigation-example', version: '1', components: {
  button: { tag: 'button', properties: {}, text: true, events: ['click'] },
}, actions: { destination: { confirm: true, payload: { type: 'object', properties: {
  kind: { type: 'string' }, destination: { type: 'string' },
}, required: ['kind', 'destination'], additionalProperties: false } } } });
const documentFor = (kind = 'navigation', destination = 'https://EXAMPLE.COM:443/a/../review?item=1', revision = 0): LyraGenView => ({
  version: '1', surfaceId: 'navigation', revision, catalog: { id: catalog.id, version: catalog.version },
  root: { id: 'open', type: 'button', text: 'Generated label is not the trusted destination',
    action: { name: 'destination', payload: { kind, destination } } },
});
type App = Awaited<ReturnType<typeof setup>>;
let opened: unknown[][];
let originalOpen: typeof window.open;
beforeEach(() => { opened = []; originalOpen = window.open; window.open = (...args) => { opened.push(args); return null; }; });
afterEach(() => { window.open = originalOpen; });
async function setup(kind = 'navigation', destination?: string) {
  const root = await fixture<HTMLElement>(html`<section><lr-gen-view .catalog=${catalog} .document=${documentFor(kind, destination)}></lr-gen-view><div data-host></div></section>`);
  const view = root.querySelector<LyraGenViewElement>('lr-gen-view')!;
  const region = root.querySelector<HTMLElement>('[data-host]')!;
  let allowed = true;
  let origins = ['https://example.com'];
  let authorizeEffect: (() => void) | undefined;
  const connection = connectGeneratedNavigation(view, region, { actionName: 'destination',
    policy: () => ({ origins }), authorize: () => { authorizeEffect?.(); return allowed; },
    strings: { heading: 'Review destination', open: 'Open destination', cancel: 'Cancel', unavailable: 'Destination unavailable' } });
  await waitUntil(() => view.status === 'ready');
  return { root, view, region, connection, deny() { allowed = false; }, revoke() { origins = []; },
    duringAuthorization(effect: () => void) { authorizeEffect = effect; } };
}
async function request(app: App): Promise<void> {
  await focusByKeyboard(app.view.shadowRoot!.querySelector<HTMLElement>('[data-gen-id="open"]')!);
  await sendKeys({ press: 'Enter' });
  await app.view.updateComplete;
}
async function approve(app: App): Promise<void> {
  await focusByKeyboard(app.region.querySelector<HTMLButtonElement>('button')!);
  await sendKeys({ press: 'Enter' });
}

describe('host navigation example', () => {
  it('shows the canonical destination and opens it once only after a trusted keyboard confirmation', async () => {
    const app = await setup();
    try {
      await request(app);
      expect(app.region.querySelector('p')?.textContent).to.equal('https://example.com/review?item=1');
      expect(app.region.querySelector('button')?.getAttribute('aria-describedby')).to.equal(app.region.querySelector('p')?.id);
      expect(opened.length).to.equal(0);
      await approve(app);
      await waitUntil(() => opened.length === 1);
      expect(opened[0]).to.deep.equal(['https://example.com/review?item=1', '_blank', 'noopener,noreferrer']);
      app.region.querySelector('button')!.click();
      expect(opened.length).to.equal(1);
    } finally { app.connection.dispose(); }
  });

  it('does not treat a synthetic click during active user activation as confirmation', async () => {
    const app = await setup();
    try {
      await request(app);
      expect(navigator.userActivation.isActive).to.equal(true);
      app.region.querySelector('button')!.click();
      await app.view.updateComplete;
      expect(opened.length).to.equal(0);
      await approve(app);
      await waitUntil(() => opened.length === 1);
    } finally { app.connection.dispose(); }
  });

  it('ignores a forged action event and supports keyboard cancellation without navigation', async () => {
    const app = await setup();
    try {
      app.view.dispatchEvent(new CustomEvent('lr-gen-action', { detail: {
        surfaceId: 'navigation', nodeId: 'open', revision: 0, name: 'destination',
        payload: { kind: 'navigation', destination: 'https://example.com/' },
      } }));
      expect(opened.length).to.equal(0);
      await request(app);
      const buttons = app.region.querySelectorAll('button');
      await focusByKeyboard(buttons[1]!);
      await sendKeys({ press: 'Space' });
      expect(buttons[0]!.disabled).to.equal(true);
      expect(opened.length).to.equal(0);
    } finally { app.connection.dispose(); }
  });

  for (const kind of ['download', 'fetch', 'executable', 'media']) {
    it(`refuses the ${kind} sink even for an allowlisted HTTPS destination`, async () => {
      const app = await setup(kind);
      try {
        await request(app);
        expect(app.region.textContent).to.equal('Destination unavailable');
        expect(app.region.querySelectorAll('button,a,img,iframe,script').length).to.equal(0);
        expect(opened.length).to.equal(0);
      } finally { app.connection.dispose(); }
    });
  }

  const credentialDestination = new URL('https://example.com/');
  credentialDestination.username = 'fixture';
  credentialDestination.password = 'fixture';
  for (const destination of ['javascript:alert(1)', 'https://denied.example/', credentialDestination.href, '/relative']) {
    it(`refuses an unsafe destination ${destination}`, async () => {
      const app = await setup('navigation', destination);
      try { await request(app); expect(app.region.textContent).to.equal('Destination unavailable'); expect(opened.length).to.equal(0); }
      finally { app.connection.dispose(); }
    });
  }

  for (const revoke of ['deny', 'revoke'] as const) {
    it(`rechecks current host ${revoke} policy before navigation`, async () => {
      const app = await setup();
      try { await request(app); app[revoke](); await approve(app); expect(opened.length).to.equal(0); expect(app.region.textContent).to.equal('Destination unavailable'); }
      finally { app.connection.dispose(); }
    });
  }

  for (const change of ['document', 'origins'] as const) {
    it(`rejects a reentrant ${change} change in the final host authorization callback`, async () => {
      const app = await setup();
      try {
        await request(app);
        let checks = 0;
        app.duringAuthorization(() => {
          if (++checks !== 2) return;
          if (change === 'document') app.view.document = documentFor('navigation', 'https://example.com/new', 1);
          else app.revoke();
        });
        await approve(app);
        expect(checks).to.equal(2);
        expect(opened.length).to.equal(0);
      } finally { app.connection.dispose(); }
    });
  }

  it('does not activate a cancelled, superseded or disconnected review', async () => {
    const app = await setup();
    try {
      await request(app);
      app.connection.cancel();
      expect(app.region.querySelector('button')!.disabled).to.equal(true);
      await request(app);
      app.view.document = documentFor('navigation', 'https://example.com/new', 1);
      const stale = app.region.querySelector('button')!;
      stale.click();
      await app.view.updateComplete;
      expect(opened.length).to.equal(0);
      expect(stale.disabled).to.equal(true);
      await request(app);
      app.view.remove();
      expect(app.region.querySelector('button')!.disabled).to.equal(true);
      expect(opened.length).to.equal(0);
    } finally { app.connection.dispose(); }
  });

  it('restores an unset or prior confirmation callback without overwriting a later owner', async () => {
    const app = await setup();
    app.connection.dispose();
    expect(app.view.confirmAction).to.equal(undefined);
    const prior = () => false;
    app.view.confirmAction = prior;
    const options = { actionName: 'destination', policy: () => ({ origins: ['https://example.com'] }), authorize: () => true,
      strings: { heading: 'Review', open: 'Open', cancel: 'Cancel', unavailable: 'Unavailable' } };
    const first = connectGeneratedNavigation(app.view, app.region, options);
    first.dispose();
    expect(app.view.confirmAction === prior).to.equal(true);
    const second = connectGeneratedNavigation(app.view, app.region, options);
    const later = () => true;
    app.view.confirmAction = later;
    second.dispose();
    expect(app.view.confirmAction === later).to.equal(true);
  });
});
