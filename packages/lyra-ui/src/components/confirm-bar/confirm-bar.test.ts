import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './confirm-bar.js';
import type { LyraConfirmBar } from './confirm-bar.js';

it('defaults to decision null, tone neutral, and shows Deny before Approve', async () => {
  const el = (await fixture(html`<lyra-confirm-bar></lyra-confirm-bar>`)) as LyraConfirmBar;
  expect(el.decision).to.equal(null);
  expect(el.tone).to.equal('neutral');
  const buttons = [...el.shadowRoot!.querySelectorAll('button')];
  const denyIndex = buttons.findIndex((b) => b.getAttribute('part') === 'deny-button');
  const approveIndex = buttons.findIndex((b) => b.getAttribute('part') === 'approve-button');
  expect(denyIndex).to.be.greaterThan(-1);
  expect(denyIndex).to.be.lessThan(approveIndex);
});

it('renders the default toolName heading, or the generic-tool fallback when unset', async () => {
  const el = (await fixture(html`<lyra-confirm-bar tool-name="run_shell"></lyra-confirm-bar>`)) as LyraConfirmBar;
  expect(el.shadowRoot!.querySelector('[part="tool-name"]')!.textContent).to.equal('run_shell');

  const generic = (await fixture(html`<lyra-confirm-bar></lyra-confirm-bar>`)) as LyraConfirmBar;
  expect(generic.shadowRoot!.querySelector('[part="tool-name"]')!.textContent).to.equal('tool');
});

it('a free-form heading wins over toolName and renders with no tool-name part', async () => {
  const el = (await fixture(
    html`<lyra-confirm-bar tool-name="run_shell" heading="Send this email?"></lyra-confirm-bar>`,
  )) as LyraConfirmBar;
  expect(el.shadowRoot!.querySelector('[part="heading"]')!.textContent!.trim()).to.equal('Send this email?');
  expect(el.shadowRoot!.querySelector('[part="tool-name"]')).to.not.exist;
});

it('hides the empty body wrapper when no default-slot content is projected, and shows it once content is added', async () => {
  const empty = (await fixture(html`<lyra-confirm-bar></lyra-confirm-bar>`)) as LyraConfirmBar;
  const emptyBody = empty.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  expect(emptyBody.hasAttribute('hidden')).to.be.true;

  const withBody = (await fixture(
    html`<lyra-confirm-bar><p>Proposed diff preview</p></lyra-confirm-bar>`,
  )) as LyraConfirmBar;
  const filledBody = withBody.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  expect(filledBody.hasAttribute('hidden')).to.be.false;
});

it('shows args read-only inside a collapsed lyra-details + lyra-json-viewer only when args is defined', async () => {
  const el = (await fixture(html`<lyra-confirm-bar></lyra-confirm-bar>`)) as LyraConfirmBar;
  expect(el.shadowRoot!.querySelector('[part="args"]')).to.not.exist;

  const withArgs = (await fixture(html`<lyra-confirm-bar></lyra-confirm-bar>`)) as LyraConfirmBar;
  withArgs.args = { path: '/etc/hosts' };
  await withArgs.updateComplete;
  const details = withArgs.shadowRoot!.querySelector('[part="args"]') as HTMLElement & { open: boolean };
  expect(details).to.exist;
  expect(details.open).to.be.false; // collapsed by default
  expect(details.tagName.toLowerCase()).to.equal('lyra-details');
  const viewer = details.querySelector('lyra-json-viewer') as HTMLElement & { data: unknown };
  expect(viewer.data).to.deep.equal({ path: '/etc/hosts' });
});

it('lyra-approve carries args as-is; lyra-deny has no detail; both set decision and remove the buttons', async () => {
  const approveEl = (await fixture(
    html`<lyra-confirm-bar .args=${{ x: 1 }}></lyra-confirm-bar>`,
  )) as LyraConfirmBar;
  const approvePromise = oneEvent(approveEl, 'lyra-approve');
  (approveEl.shadowRoot!.querySelector('[part="approve-button"]') as HTMLButtonElement).click();
  expect((await approvePromise).detail).to.deep.equal({ args: { x: 1 } });
  await approveEl.updateComplete;
  expect(approveEl.decision).to.equal('approved');
  expect(approveEl.shadowRoot!.querySelector('[part="approve-button"]')).to.not.exist;
  expect(approveEl.shadowRoot!.querySelector('[part="deny-button"]')).to.not.exist;

  const denyEl = (await fixture(html`<lyra-confirm-bar></lyra-confirm-bar>`)) as LyraConfirmBar;
  const denyPromise = oneEvent(denyEl, 'lyra-deny');
  (denyEl.shadowRoot!.querySelector('[part="deny-button"]') as HTMLButtonElement).click();
  // CustomEventInit's `detail` member defaults to `null`, not `undefined`, per the DOM spec --
  // this.emit('lyra-deny') passes no second argument, which is equivalent to an absent `detail`
  // option -- same as lyra-tool-approval-dialog's own identical lyra-deny event.
  expect((await denyPromise).detail).to.be.null;
  await denyEl.updateComplete;
  expect(denyEl.decision).to.equal('denied');
});

it('shows visible decided-state text, never color alone, and reflects decision as a host attribute', async () => {
  const el = (await fixture(html`<lyra-confirm-bar></lyra-confirm-bar>`)) as LyraConfirmBar;
  (el.shadowRoot!.querySelector('[part="approve-button"]') as HTMLButtonElement).click();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="status"]')!.textContent!.trim()).to.equal('Approved');
  expect(el.getAttribute('decision')).to.equal('approved');
});

it('moves focus to [part="status"] synchronously on activation, before the buttons unmount', async () => {
  const el = (await fixture(html`<lyra-confirm-bar></lyra-confirm-bar>`)) as LyraConfirmBar;
  const approveButton = el.shadowRoot!.querySelector('[part="approve-button"]') as HTMLButtonElement;
  approveButton.click();
  // Synchronous: no await needed before this assertion.
  expect(el.shadowRoot!.activeElement).to.equal(el.shadowRoot!.querySelector('[part="status"]'));
});

it('announces the decision via an internal polite live region', async () => {
  const el = (await fixture(html`<lyra-confirm-bar></lyra-confirm-bar>`)) as LyraConfirmBar;
  const liveRegion = el.shadowRoot!.querySelector('lyra-live-region')!;
  const regionText = () => liveRegion.shadowRoot!.querySelector('[part="region"]')!.textContent ?? '';
  (el.shadowRoot!.querySelector('[part="deny-button"]') as HTMLButtonElement).click();
  await el.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  expect(regionText()).to.equal('Action denied.');
});

it('a host-set decision renders identically but emits nothing itself', async () => {
  const el = (await fixture(html`<lyra-confirm-bar></lyra-confirm-bar>`)) as LyraConfirmBar;
  let approveFired = false;
  let denyFired = false;
  el.addEventListener('lyra-approve', () => (approveFired = true));
  el.addEventListener('lyra-deny', () => (denyFired = true));
  el.decision = 'approved';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="status"]')!.textContent!.trim()).to.equal('Approved');
  expect(approveFired).to.be.false;
  expect(denyFired).to.be.false;
});

it('reflects tone to a host attribute', async () => {
  const el = (await fixture(html`<lyra-confirm-bar tone="danger"></lyra-confirm-bar>`)) as LyraConfirmBar;
  expect(el.getAttribute('tone')).to.equal('danger');
});

it('is role="group" labeled by the heading', async () => {
  const el = (await fixture(html`<lyra-confirm-bar tool-name="run_shell"></lyra-confirm-bar>`)) as LyraConfirmBar;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(base.getAttribute('role')).to.equal('group');
  const labelledBy = base.getAttribute('aria-labelledby');
  expect(labelledBy).to.be.a('string');
  expect(el.shadowRoot!.getElementById(labelledBy!)).to.equal(el.shadowRoot!.querySelector('[part="heading"]'));
});

it('is accessible before and after a decision, with and without args', async () => {
  const plain = (await fixture(html`<lyra-confirm-bar tool-name="run_shell"></lyra-confirm-bar>`)) as LyraConfirmBar;
  await expect(plain).to.be.accessible();

  const withArgs = (await fixture(
    html`<lyra-confirm-bar tool-name="run_shell" .args=${{ cmd: 'ls' }}></lyra-confirm-bar>`,
  )) as LyraConfirmBar;
  await expect(withArgs).to.be.accessible();

  const decided = (await fixture(html`<lyra-confirm-bar decision="approved"></lyra-confirm-bar>`)) as LyraConfirmBar;
  await expect(decided).to.be.accessible();
});

describe('localization', () => {
  it('localizes the heading, generic tool-name fallback, args label, and Deny/Approve labels via this.localize(), reusing lyra-tool-approval-dialog\'s own keys', async () => {
    const el = (await fixture(
      html`<lyra-confirm-bar
        .args=${{ path: '/etc/hosts' }}
        .strings=${{
          toolApprovalHeading: 'Approuver l’appel {tool} ?',
          toolApprovalGenericTool: 'outil',
          toolApprovalArgsLabel: 'Arguments de l’appel (JSON)',
          deny: 'Refuser',
          approve: 'Approuver',
        }}
      ></lyra-confirm-bar>`,
    )) as LyraConfirmBar;

    expect(el.shadowRoot!.querySelector('[part="heading"]')!.textContent!.trim()).to.equal('Approuver l’appel outil ?');
    expect(el.shadowRoot!.querySelector('[part="tool-name"]')!.textContent).to.equal('outil');
    const details = el.shadowRoot!.querySelector('[part="args"]') as HTMLElement & { summary: string };
    expect(details.summary).to.equal('Arguments de l’appel (JSON)');
    expect((el.shadowRoot!.querySelector('[part="deny-button"]') as HTMLElement).textContent!.trim()).to.equal(
      'Refuser',
    );
    expect((el.shadowRoot!.querySelector('[part="approve-button"]') as HTMLElement).textContent!.trim()).to.equal(
      'Approuver',
    );
  });

  it('localizes the decided-state text and the live-region announcement via this.localize()', async () => {
    const el = (await fixture(
      html`<lyra-confirm-bar
        .strings=${{
          confirmApproved: 'Approuvé',
          confirmDenied: 'Refusé',
          confirmApprovedAnnounce: 'Action approuvée.',
          confirmDeniedAnnounce: 'Action refusée.',
        }}
      ></lyra-confirm-bar>`,
    )) as LyraConfirmBar;
    const liveRegion = el.shadowRoot!.querySelector('lyra-live-region')!;
    const regionText = () => liveRegion.shadowRoot!.querySelector('[part="region"]')!.textContent ?? '';

    (el.shadowRoot!.querySelector('[part="approve-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    await new Promise((r) => requestAnimationFrame(r));

    expect(el.shadowRoot!.querySelector('[part="status"]')!.textContent!.trim()).to.equal('Approuvé');
    expect(regionText()).to.equal('Action approuvée.');
  });
});
