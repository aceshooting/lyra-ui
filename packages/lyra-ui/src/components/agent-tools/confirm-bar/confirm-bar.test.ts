import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './confirm-bar.js';
import type { LyraConfirmBar } from './confirm-bar.js';
import type { LyraButton } from '../../forms/button/button.class.js';

it('defaults to decision null, pending null, tone neutral, and shows Deny before Approve', async () => {
  const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
  expect(el.decision).to.equal(null);
  expect(el.pending).to.equal(null);
  expect(el.hasAttribute('pending')).to.be.false;
  expect(el.tone).to.equal('neutral');
  const buttons = [...el.shadowRoot!.querySelectorAll('lr-button')];
  const denyIndex = buttons.findIndex((b) => b.getAttribute('part') === 'deny-button');
  const approveIndex = buttons.findIndex((b) => b.getAttribute('part') === 'approve-button');
  expect(denyIndex).to.be.greaterThan(-1);
  expect(denyIndex).to.be.lessThan(approveIndex);
});

it('renders the default toolName heading, or the generic-tool fallback when unset', async () => {
  const el = (await fixture(html`<lr-confirm-bar tool-name="run_shell"></lr-confirm-bar>`)) as LyraConfirmBar;
  expect(el.shadowRoot!.querySelector('[part="tool-name"]')!.textContent).to.equal('run_shell');

  const generic = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
  expect(generic.shadowRoot!.querySelector('[part="tool-name"]')!.textContent).to.equal('tool');
});

it('renders repeated heading placeholders and does not append a tool omitted by the translation', async () => {
  const repeated = (await fixture(html`
    <lr-confirm-bar tool-name="search" .strings=${{ toolApprovalHeading: '{tool} then {tool}?' }}></lr-confirm-bar>
  `)) as LyraConfirmBar;
  expect(repeated.shadowRoot!.querySelector('[part="heading"]')!.textContent!.trim()).to.equal('search then search?');
  expect(repeated.shadowRoot!.querySelectorAll('[part="tool-name"]').length).to.equal(2);

  const omitted = (await fixture(html`
    <lr-confirm-bar tool-name="search" .strings=${{ toolApprovalHeading: 'Proceed?' }}></lr-confirm-bar>
  `)) as LyraConfirmBar;
  expect(omitted.shadowRoot!.querySelector('[part="heading"]')!.textContent!.trim()).to.equal('Proceed?');
});

it('moves focus to status before a pending decision is finalized externally', async () => {
  const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
  const approve = el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton;
  el.addEventListener('lr-approve', (event) => event.preventDefault(), { once: true });
  approve.click();
  await el.updateComplete;
  approve.focus();
  el.decision = 'approved';
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement!.getAttribute('part')).to.equal('status');
});

it('a free-form heading wins over toolName and renders with no tool-name part', async () => {
  const el = (await fixture(
    html`<lr-confirm-bar tool-name="run_shell" heading="Send this email?"></lr-confirm-bar>`,
  )) as LyraConfirmBar;
  expect(el.shadowRoot!.querySelector('[part="heading"]')!.textContent!.trim()).to.equal('Send this email?');
  expect(el.shadowRoot!.querySelector('[part="tool-name"]')).to.not.exist;
});

it('hides the empty body wrapper when no default-slot content is projected, and shows it once content is added', async () => {
  const empty = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
  const emptyBody = empty.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  expect(emptyBody.hasAttribute('hidden')).to.be.true;

  const withBody = (await fixture(
    html`<lr-confirm-bar><p>Proposed diff preview</p></lr-confirm-bar>`,
  )) as LyraConfirmBar;
  const filledBody = withBody.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  expect(filledBody.hasAttribute('hidden')).to.be.false;
});

it('shows args read-only inside a collapsed lr-details + lr-json-viewer only when args is defined', async () => {
  const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
  expect(el.shadowRoot!.querySelector('[part="args"]')).to.not.exist;

  const withArgs = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
  withArgs.args = { path: '/etc/hosts' };
  await withArgs.updateComplete;
  const details = withArgs.shadowRoot!.querySelector('[part="args"]') as HTMLElement & { open: boolean };
  expect(details).to.exist;
  expect(details.open).to.be.false; // collapsed by default
  expect(details.tagName.toLowerCase()).to.equal('lr-details');
  const viewer = details.querySelector('lr-json-viewer') as HTMLElement & { data: unknown };
  expect(viewer.data).to.deep.equal({ path: '/etc/hosts' });
});

it('lr-approve carries args as-is; lr-deny has no detail; both set decision and remove the buttons', async () => {
  const approveEl = (await fixture(
    html`<lr-confirm-bar .args=${{ x: 1 }}></lr-confirm-bar>`,
  )) as LyraConfirmBar;
  const approvePromise = oneEvent(approveEl, 'lr-approve');
  (approveEl.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).click();
  expect((await approvePromise).detail).to.deep.equal({ args: { x: 1 } });
  await approveEl.updateComplete;
  expect(approveEl.decision).to.equal('approved');
  expect(approveEl.shadowRoot!.querySelector('[part="approve-button"]')).to.not.exist;
  expect(approveEl.shadowRoot!.querySelector('[part="deny-button"]')).to.not.exist;

  const denyEl = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
  const denyPromise = oneEvent(denyEl, 'lr-deny');
  (denyEl.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton).click();
  // CustomEventInit's `detail` member defaults to `null`, not `undefined`, per the DOM spec --
  // this.emit('lr-deny') passes no second argument, which is equivalent to an absent `detail`
  // option -- same as lr-tool-approval-dialog's own identical lr-deny event.
  expect((await denyPromise).detail).to.be.null;
  await denyEl.updateComplete;
  expect(denyEl.decision).to.equal('denied');
});

it('shows visible decided-state text, never color alone, and reflects decision as a host attribute', async () => {
  const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
  (el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).click();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="status"]')!.textContent!.trim()).to.equal('Approved');
  expect(el.getAttribute('decision')).to.equal('approved');
});

it('moves focus to [part="status"] synchronously on activation, before the buttons unmount', async () => {
  const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
  const approveButton = el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton;
  approveButton.click();
  // Synchronous: no await needed before this assertion.
  expect(el.shadowRoot!.activeElement!.getAttribute('part')).to.equal('status');
});

it('announces the decision via an internal polite live region', async () => {
  const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
  const liveRegion = el.shadowRoot!.querySelector('lr-live-region')!;
  const regionText = () => liveRegion.shadowRoot!.querySelector('[part="region"]')!.textContent ?? '';
  (el.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton).click();
  await el.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  expect(regionText()).to.equal('Action denied.');
});

it('a host-set decision renders identically but emits nothing itself', async () => {
  const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
  let approveFired = false;
  let denyFired = false;
  el.addEventListener('lr-approve', () => (approveFired = true));
  el.addEventListener('lr-deny', () => (denyFired = true));
  el.decision = 'approved';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="status"]')!.textContent!.trim()).to.equal('Approved');
  expect(approveFired).to.be.false;
  expect(denyFired).to.be.false;
});

it('reflects tone to a host attribute', async () => {
  const el = (await fixture(html`<lr-confirm-bar tone="danger"></lr-confirm-bar>`)) as LyraConfirmBar;
  expect(el.getAttribute('tone')).to.equal('danger');
});

it('is role="group" labeled by the heading', async () => {
  const el = (await fixture(html`<lr-confirm-bar tool-name="run_shell"></lr-confirm-bar>`)) as LyraConfirmBar;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(base.getAttribute('role')).to.equal('group');
  const labelledBy = base.getAttribute('aria-labelledby');
  expect(labelledBy).to.be.a('string');
  expect(el.shadowRoot!.getElementById(labelledBy!)).to.equal(el.shadowRoot!.querySelector('[part="heading"]'));
});

it('is accessible before and after a decision, with and without args', async () => {
  const plain = (await fixture(html`<lr-confirm-bar tool-name="run_shell"></lr-confirm-bar>`)) as LyraConfirmBar;
  await expect(plain).to.be.accessible();

  const withArgs = (await fixture(
    html`<lr-confirm-bar tool-name="run_shell" .args=${{ cmd: 'ls' }}></lr-confirm-bar>`,
  )) as LyraConfirmBar;
  await expect(withArgs).to.be.accessible();

  const decided = (await fixture(html`<lr-confirm-bar decision="approved"></lr-confirm-bar>`)) as LyraConfirmBar;
  await expect(decided).to.be.accessible();
});

describe('compact', () => {
  const part = (el: LyraConfirmBar, name: string) => el.shadowRoot!.querySelector(`[part="${name}"]`) as HTMLElement;

  it('defaults compact to false and reflects it as an attribute when set', async () => {
    const plain = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    expect(plain.compact).to.be.false;
    expect(plain.hasAttribute('compact')).to.be.false;

    const el = (await fixture(html`<lr-confirm-bar compact></lr-confirm-bar>`)) as LyraConfirmBar;
    expect(el.compact).to.be.true;
    expect(el.hasAttribute('compact')).to.be.true;
  });

  it('renders as an inline row with no border, padding or background, even with tone="danger"', async () => {
    const el = (await fixture(
      html`<lr-confirm-bar compact tone="danger" tool-name="delete_row"></lr-confirm-bar>`,
    )) as LyraConfirmBar;

    // The host itself must flip too -- restyling only [part='base'] still leaves a
    // `display: block` host that breaks the row it was dropped into.
    expect(getComputedStyle(el).display).to.equal('inline-flex');

    const baseStyle = getComputedStyle(part(el, 'base'));
    expect(baseStyle.flexDirection).to.equal('row');
    expect(baseStyle.borderTopWidth).to.equal('0px');
    expect(baseStyle.borderInlineStartWidth).to.equal('0px');
    expect(baseStyle.paddingTop).to.equal('0px');
    expect(baseStyle.paddingInlineStart).to.equal('0px');
    expect(baseStyle.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
  });

  it('neutralizes the narrow-container query so the buttons are not stretched inside a table cell', async () => {
    const wrap = await fixture(html`
      <div style="inline-size:240px;">
        <lr-confirm-bar compact tool-name="run_shell"></lr-confirm-bar>
        <lr-confirm-bar tool-name="run_shell"></lr-confirm-bar>
      </div>
    `);
    const [compact, regular] = [...wrap.querySelectorAll('lr-confirm-bar')] as LyraConfirmBar[];

    expect(getComputedStyle(compact).containerType).to.equal('normal');
    expect(getComputedStyle(part(compact, 'deny-button')).flexGrow).to.equal('0');

    // Control: the same 240px allocation *does* trip the query in the default presentation, which
    // is exactly what makes it wrong for a compact bar dropped into a narrow cell.
    expect(getComputedStyle(regular).containerType).to.equal('inline-size');
    expect(getComputedStyle(part(regular, 'deny-button')).flexGrow).to.equal('1');
  });

  it('does not match an unrelated narrow ancestor query container while compact', async () => {
    const wrap = await fixture(html`
      <div style="container-type:inline-size;inline-size:240px;">
        <lr-confirm-bar compact tool-name="run_shell"></lr-confirm-bar>
      </div>
    `);
    const compact = wrap.querySelector('lr-confirm-bar') as LyraConfirmBar;
    expect(getComputedStyle(part(compact, 'deny-button')).flexGrow).to.equal('0');
  });

  it('keeps the focus-management contract: focus lands on [part="status"] before the buttons unmount', async () => {
    const el = (await fixture(html`<lr-confirm-bar compact></lr-confirm-bar>`)) as LyraConfirmBar;
    (part(el, 'approve-button') as LyraButton).click();
    // Synchronous, exactly as in the default presentation.
    expect(el.shadowRoot!.activeElement!.getAttribute('part')).to.equal('status');
    await el.updateComplete;
    expect(part(el, 'status').textContent!.trim()).to.equal('Approved');
  });

  // Regression guard for the trap that `[part='status']:empty { display: none }` sets: that rule
  // never matches (Chromium's `:empty` does not ignore the whitespace-only text nodes lit leaves in
  // the part), and it must stay that way -- `decide()` focuses `[part='status']` synchronously
  // *before* `decision` is set, so an undecided status that were `display: none` would make
  // `.focus()` a no-op and drop focus to `<body>` the instant the buttons unmount.
  it('keeps the undecided [part="status"] rendered-but-zero-sized rather than display:none', async () => {
    const el = (await fixture(html`<lr-confirm-bar compact></lr-confirm-bar>`)) as LyraConfirmBar;
    const status = part(el, 'status');
    expect(getComputedStyle(status).display).to.not.equal('none');
    const box = status.getBoundingClientRect();
    expect(box.width).to.equal(0);
    expect(box.height).to.equal(0);

    (part(el, 'deny-button') as LyraButton).click();
    await el.updateComplete;
    expect(part(el, 'status').getBoundingClientRect().width).to.be.greaterThan(0);
  });

  it('fires lr-approve/lr-deny identically', async () => {
    const approveEl = (await fixture(
      html`<lr-confirm-bar compact .args=${{ x: 1 }}></lr-confirm-bar>`,
    )) as LyraConfirmBar;
    const approvePromise = oneEvent(approveEl, 'lr-approve');
    (part(approveEl, 'approve-button') as LyraButton).click();
    expect((await approvePromise).detail).to.deep.equal({ args: { x: 1 } });
    await approveEl.updateComplete;
    expect(approveEl.decision).to.equal('approved');

    const denyEl = (await fixture(html`<lr-confirm-bar compact></lr-confirm-bar>`)) as LyraConfirmBar;
    const denyPromise = oneEvent(denyEl, 'lr-deny');
    (part(denyEl, 'deny-button') as LyraButton).click();
    expect((await denyPromise).detail).to.be.null;
    await denyEl.updateComplete;
    expect(denyEl.decision).to.equal('denied');
  });

  it('leaves the default presentation byte-identical when compact is unset', async () => {
    const el = (await fixture(html`<lr-confirm-bar tone="danger"></lr-confirm-bar>`)) as LyraConfirmBar;
    expect(getComputedStyle(el).display).to.equal('block');
    expect(getComputedStyle(el).containerType).to.equal('inline-size');

    const baseStyle = getComputedStyle(part(el, 'base'));
    expect(baseStyle.flexDirection).to.equal('column');
    expect(baseStyle.borderTopWidth).to.not.equal('0px');
    expect(baseStyle.paddingTop).to.not.equal('0px');
    expect(baseStyle.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
  });

  it('is accessible in the compact presentation, before and after a decision', async () => {
    const el = (await fixture(
      html`<lr-confirm-bar compact tone="danger" tool-name="delete_row" .args=${{ id: 7 }}></lr-confirm-bar>`,
    )) as LyraConfirmBar;
    await expect(el).to.be.accessible();

    (el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).click();
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

describe('localization', () => {
  it('localizes the heading, generic tool-name fallback, args label, and Deny/Approve labels via this.localize(), reusing lr-tool-approval-dialog\'s own keys', async () => {
    const el = (await fixture(
      html`<lr-confirm-bar
        .args=${{ path: '/etc/hosts' }}
        .strings=${{
          toolApprovalHeading: 'Approuver l’appel {tool} ?',
          toolApprovalGenericTool: 'outil',
          toolApprovalArgsLabel: 'Arguments de l’appel (JSON)',
          deny: 'Refuser',
          approve: 'Approuver',
        }}
      ></lr-confirm-bar>`,
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
      html`<lr-confirm-bar
        .strings=${{
          confirmApproved: 'Approuvé',
          confirmDenied: 'Refusé',
          confirmApprovedAnnounce: 'Action approuvée.',
          confirmDeniedAnnounce: 'Action refusée.',
        }}
      ></lr-confirm-bar>`,
    )) as LyraConfirmBar;
    const liveRegion = el.shadowRoot!.querySelector('lr-live-region')!;
    const regionText = () => liveRegion.shadowRoot!.querySelector('[part="region"]')!.textContent ?? '';

    (el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).click();
    await el.updateComplete;
    await new Promise((r) => requestAnimationFrame(r));

    expect(el.shadowRoot!.querySelector('[part="status"]')!.textContent!.trim()).to.equal('Approuvé');
    expect(regionText()).to.equal('Action approuvée.');
  });
});

describe('deny/approve as lr-button', () => {
  it('renders Deny/Approve as lr-button with variant="neutral"/"brand" ("danger" under tone="danger")', async () => {
    const neutral = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    const deny = neutral.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton;
    const approve = neutral.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton;
    expect(deny.tagName.toLowerCase()).to.equal('lr-button');
    expect(approve.tagName.toLowerCase()).to.equal('lr-button');
    expect(deny.variant).to.equal('neutral');
    expect(approve.variant).to.equal('brand');
    expect(deny.type).to.equal('button');
    expect(approve.type).to.equal('button');

    const danger = (await fixture(html`<lr-confirm-bar tone="danger"></lr-confirm-bar>`)) as LyraConfirmBar;
    const dangerApprove = danger.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton;
    expect(dangerApprove.variant).to.equal('danger');
    // Deny is not tone-sensitive -- stays neutral even under tone="danger".
    const dangerDeny = danger.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton;
    expect(dangerDeny.variant).to.equal('neutral');
  });

  it('matches the pre-swap Deny/Approve colors via lr-button computed styles (visual-parity regression guard)', async () => {
    const toRgb = (color: string) => {
      const probe = document.createElement('span');
      probe.style.color = color;
      document.body.appendChild(probe);
      const rgb = getComputedStyle(probe).color;
      probe.remove();
      return rgb;
    };

    const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    await el.updateComplete;
    const resolve = (token: string) => getComputedStyle(el).getPropertyValue(token).trim();
    const denyBase = (el.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton).shadowRoot!.querySelector(
      '[part="base"]',
    ) as HTMLElement;
    const approveBase = (
      el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton
    ).shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    // Deny (variant="neutral", lr-button's own default appearance="filled"): --lr-color-surface /
    // --lr-color-text, the same pairing todays hand-rolled CSS hardcoded before the swap.
    expect(getComputedStyle(denyBase).backgroundColor).to.equal(toRgb(resolve('--lr-color-surface')));
    expect(getComputedStyle(denyBase).color).to.equal(toRgb(resolve('--lr-color-text')));
    // Approve (variant="brand"): --lr-color-brand / --lr-color-on-brand.
    expect(getComputedStyle(approveBase).backgroundColor).to.equal(toRgb(resolve('--lr-color-brand')));
    expect(getComputedStyle(approveBase).color).to.equal(toRgb(resolve('--lr-color-on-brand')));

    const danger = (await fixture(html`<lr-confirm-bar tone="danger"></lr-confirm-bar>`)) as LyraConfirmBar;
    await danger.updateComplete;
    const dangerResolve = (token: string) => getComputedStyle(danger).getPropertyValue(token).trim();
    const dangerApproveBase = (
      danger.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton
    ).shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(dangerApproveBase).backgroundColor).to.equal(toRgb(dangerResolve('--lr-color-danger')));
    expect(getComputedStyle(dangerApproveBase).color).to.equal(toRgb(dangerResolve('--lr-color-on-danger')));
  });

  it('exposes the internal lr-button parts to a consumer through exportparts', async () => {
    const sheet = document.createElement('style');
    sheet.textContent = `
      lr-confirm-bar.consumer-probe::part(deny-button-base) { letter-spacing: 3px; }
      lr-confirm-bar.consumer-probe::part(approve-button-base) { letter-spacing: 5px; }
    `;
    document.head.append(sheet);
    try {
      const el = (await fixture(
        html`<lr-confirm-bar class="consumer-probe"></lr-confirm-bar>`,
      )) as LyraConfirmBar;
      const denyBase = (el.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton).shadowRoot!.querySelector(
        '[part="base"]',
      ) as HTMLElement;
      const approveBase = (
        el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton
      ).shadowRoot!.querySelector('[part="base"]') as HTMLElement;
      expect(getComputedStyle(denyBase).letterSpacing).to.equal('3px');
      expect(getComputedStyle(approveBase).letterSpacing).to.equal('5px');
    } finally {
      sheet.remove();
    }
  });
});

describe('async pending decisions', () => {
  it('lr-approve/lr-deny are cancelable; preventDefault() sets pending instead of finalizing decision', async () => {
    const approveEl = (await fixture(html`<lr-confirm-bar .args=${{ x: 1 }}></lr-confirm-bar>`)) as LyraConfirmBar;
    approveEl.addEventListener('lr-approve', (e) => e.preventDefault());
    (approveEl.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).click();
    await approveEl.updateComplete;
    expect(approveEl.decision).to.equal(null);
    expect(approveEl.pending).to.equal('approved');
    expect(approveEl.hasAttribute('pending')).to.be.true;
    expect(approveEl.shadowRoot!.querySelector('[part="approve-button"]')).to.exist;
    expect(approveEl.shadowRoot!.querySelector('[part="deny-button"]')).to.exist;

    const denyEl = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    denyEl.addEventListener('lr-deny', (e) => e.preventDefault());
    (denyEl.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton).click();
    await denyEl.updateComplete;
    expect(denyEl.decision).to.equal(null);
    expect(denyEl.pending).to.equal('denied');
  });

  it('shows loading on the pending button and disables the other one', async () => {
    const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    el.addEventListener('lr-approve', (e) => e.preventDefault());
    (el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).click();
    await el.updateComplete;
    const deny = el.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton;
    const approve = el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton;
    expect(approve.loading).to.be.true;
    expect(approve.disabled).to.be.false;
    expect(deny.loading).to.be.false;
    expect(deny.disabled).to.be.true;
  });

  it('finalizes normally when the host sets .decision after preventDefault()', async () => {
    const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    el.addEventListener('lr-approve', (e) => e.preventDefault());
    (el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).click();
    await el.updateComplete;
    expect(el.pending).to.equal('approved');

    el.decision = 'approved';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="approve-button"]')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="deny-button"]')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="status"]')!.textContent!.trim()).to.equal('Approved');
  });

  it('bounces back to the undecided, both-buttons-enabled state when pending is reset to null', async () => {
    const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    el.addEventListener('lr-deny', (e) => e.preventDefault());
    (el.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton).click();
    await el.updateComplete;
    expect(el.pending).to.equal('denied');

    el.pending = null;
    await el.updateComplete;
    const deny = el.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton;
    const approve = el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton;
    expect(deny.loading).to.be.false;
    expect(deny.disabled).to.be.false;
    expect(approve.loading).to.be.false;
    expect(approve.disabled).to.be.false;
    expect(el.decision).to.equal(null);
  });

  it('defaults pending to null and leaves the synchronous decide() path unchanged when never touched', async () => {
    const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    expect(el.pending).to.equal(null);
    const approvePromise = oneEvent(el, 'lr-approve');
    (el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).click();
    await approvePromise;
    await el.updateComplete;
    expect(el.decision).to.equal('approved');
    expect(el.pending).to.equal(null);
  });

  it('is accessible while a decision is pending (loading + disabled lr-button still expose a valid name/state)', async () => {
    const el = (await fixture(html`<lr-confirm-bar tool-name="run_shell"></lr-confirm-bar>`)) as LyraConfirmBar;
    el.addEventListener('lr-approve', (e) => e.preventDefault());
    (el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).click();
    await el.updateComplete;
    // Prove the pending state actually landed before checking accessibility -- otherwise this
    // would pass vacuously against the ordinary undecided render.
    expect(el.pending).to.equal('approved');
    expect((el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).loading).to.be.true;
    await expect(el).to.be.accessible();
  });
});
