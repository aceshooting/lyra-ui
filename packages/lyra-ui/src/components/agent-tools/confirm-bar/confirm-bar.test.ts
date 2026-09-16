import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import { LitElement, html as litHtml, type PropertyValues } from 'lit';
import { state } from 'lit/decorators.js';
import './confirm-bar.js';
import type { LyraConfirmBar } from './confirm-bar.js';
import type { LyraButton } from '../../forms/button/button.class.js';
import { nextHostUpdateOpportunity } from '../../../internal/focus-navigation.js';

it('defaults to decision null, pending null, variant neutral, and shows Deny before Approve', async () => {
  const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
  expect(el.decision).to.equal(null);
  expect(el.pending).to.equal(null);
  expect(el.hasAttribute('pending')).to.be.false;
  expect(el.variant).to.equal('neutral');
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
  expect((el.shadowRoot!.querySelector('[part="tool-name"]')) == null).to.be.true;
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

it('shows initial and dynamically-added text-only default-slot content', async () => {
  const initial = (await fixture(html`<lr-confirm-bar>Proposed diff preview</lr-confirm-bar>`)) as LyraConfirmBar;
  const initialBody = initial.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  expect(initialBody.hasAttribute('hidden')).to.be.false;

  const dynamic = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
  dynamic.append('Runtime diff preview');
  const slot = dynamic.shadowRoot!.querySelector<HTMLSlotElement>('[part="body"] slot')!;
  slot.dispatchEvent(new Event('slotchange'));
  await dynamic.updateComplete;
  const dynamicBody = dynamic.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  expect(dynamicBody.hasAttribute('hidden')).to.be.false;

  const whitespace = (await fixture(html`<lr-confirm-bar>  \n  </lr-confirm-bar>`)) as LyraConfirmBar;
  const whitespaceBody = whitespace.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  expect(whitespaceBody.hasAttribute('hidden')).to.be.true;
});

it('shows args read-only inside a collapsed lr-details + lr-json-viewer only when args is defined', async () => {
  const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
  expect((el.shadowRoot!.querySelector('[part="args"]')) == null).to.be.true;

  const withArgs = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
  withArgs.args = { path: '/etc/hosts' };
  await withArgs.updateComplete;
  const details = withArgs.shadowRoot!.querySelector('[part="args"]') as HTMLElement & { open: boolean };
  expect((details) != null).to.equal(true);
  expect(details.open).to.be.false; // collapsed by default
  expect(details.tagName.toLowerCase()).to.equal('lr-details');
  const viewer = details.querySelector('lr-json-viewer') as HTMLElement & { data: unknown };
  expect(viewer.data).to.deep.equal({ path: '/etc/hosts' });
});

it('stops the nested json-viewer\'s lr-copy (and sibling clipboard/search events) from leaking past the host', async () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: () => Promise.resolve() },
  });
  try {
    const el = (await fixture(
      html`<lr-confirm-bar .args=${{ path: '/etc/hosts' }}></lr-confirm-bar>`,
    )) as LyraConfirmBar;
    const details = el.shadowRoot!.querySelector('[part="args"]') as HTMLElement & { open: boolean };
    details.open = true;
    await el.updateComplete;
    const viewer = details.querySelector('lr-json-viewer') as HTMLElement & {
      copyable: boolean;
      updateComplete: Promise<unknown>;
    };
    viewer.copyable = true;
    await viewer.updateComplete;
    const observed: string[] = [];
    for (const type of ['lr-copy', 'lr-error', 'lr-copy-error', 'lr-search-change']) {
      el.addEventListener(type, () => observed.push(type));
    }
    const copyButton = viewer.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
    const viewerCopied = oneEvent(viewer, 'lr-copy');
    copyButton.click();
    await viewerCopied; // proves the copy action completed and the event fired on the viewer itself
    expect(observed).to.deep.equal([]);
  } finally {
    if (original) Object.defineProperty(navigator, 'clipboard', original);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }
});

it('lr-approve carries args as-is; lr-deny carries only the resolver; both set decision and remove the buttons', async () => {
  const approveEl = (await fixture(
    html`<lr-confirm-bar .args=${{ x: 1 }}></lr-confirm-bar>`,
  )) as LyraConfirmBar;
  const approvePromise = oneEvent(approveEl, 'lr-approve');
  (approveEl.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).click();
  const approveDetail = (await approvePromise).detail as { args: unknown; waitUntil: unknown };
  expect(approveDetail.args, 'args reach the listener unedited').to.deep.equal({ x: 1 });
  expect(typeof approveDetail.waitUntil).to.equal('function');
  await approveEl.updateComplete;
  expect(approveEl.decision).to.equal('approved');
  expect((approveEl.shadowRoot!.querySelector('[part="approve-button"]')) == null).to.be.true;
  expect((approveEl.shadowRoot!.querySelector('[part="deny-button"]')) == null).to.be.true;

  const denyEl = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
  const denyPromise = oneEvent(denyEl, 'lr-deny');
  (denyEl.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton).click();
  // lr-deny still carries no data of its own -- `waitUntil` is the resolver every decision event
  // carries, not a denial payload -- so a listener reading the detail for deny-specific information
  // finds nothing, exactly as it did when the detail was null and exactly as
  // lr-tool-approval-dialog's own lr-deny still behaves.
  const denyDetail = (await denyPromise).detail as { waitUntil: unknown };
  expect(Object.keys(denyDetail)).to.deep.equal(['waitUntil']);
  expect(typeof denyDetail.waitUntil).to.equal('function');
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

it('does not announce an initially supplied decision on mount', async () => {
  const el = (await fixture(html`<lr-confirm-bar decision="approved"></lr-confirm-bar>`)) as LyraConfirmBar;
  const liveRegion = el.shadowRoot!.querySelector('lr-live-region')!;
  const regionText = () => liveRegion.shadowRoot!.querySelector('[part="region"]')!.textContent ?? '';
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  expect(regionText()).to.equal('');
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

it('routes the decided-state status color through --lr-confirm-bar-approved-color/-denied-color', async () => {
  const approved = (await fixture(
    html`<lr-confirm-bar style="--lr-confirm-bar-approved-color: rgb(1, 2, 3)"></lr-confirm-bar>`,
  )) as LyraConfirmBar;
  (approved.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).click();
  await approved.updateComplete;
  expect(getComputedStyle(approved.shadowRoot!.querySelector('[part="status"]') as HTMLElement).color).to.equal(
    'rgb(1, 2, 3)',
  );

  const denied = (await fixture(
    html`<lr-confirm-bar style="--lr-confirm-bar-denied-color: rgb(4, 5, 6)"></lr-confirm-bar>`,
  )) as LyraConfirmBar;
  (denied.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton).click();
  await denied.updateComplete;
  expect(getComputedStyle(denied.shadowRoot!.querySelector('[part="status"]') as HTMLElement).color).to.equal(
    'rgb(4, 5, 6)',
  );
});

it('reflects variant to a host attribute', async () => {
  const el = (await fixture(html`<lr-confirm-bar variant="danger"></lr-confirm-bar>`)) as LyraConfirmBar;
  expect(el.getAttribute('variant')).to.equal('danger');
});

it('is role="group" labeled by the heading', async () => {
  const el = (await fixture(html`<lr-confirm-bar tool-name="run_shell"></lr-confirm-bar>`)) as LyraConfirmBar;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(base.getAttribute('role')).to.equal('group');
  const labelledBy = base.getAttribute('aria-labelledby');
  expect(labelledBy).to.be.a('string');
  expect((el.shadowRoot!.getElementById(labelledBy!)) === (el.shadowRoot!.querySelector('[part="heading"]'))).to.equal(true);
});

it('lets a host aria-label override the heading-derived accessible name', async () => {
  const el = (await fixture(
    html`<lr-confirm-bar tool-name="run_shell" aria-label="Destructive command approval"></lr-confirm-bar>`,
  )) as LyraConfirmBar;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(base.getAttribute('role')).to.equal('group');
  expect(base.getAttribute('aria-label')).to.equal('Destructive command approval');
  expect(base.hasAttribute('aria-labelledby')).to.equal(false);
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

describe('compact and frame', () => {
  const part = (el: LyraConfirmBar, name: string) => el.shadowRoot!.querySelector(`[part="${name}"]`) as HTMLElement;

  it('defaults compact to false and reflects it as an attribute when set', async () => {
    const plain = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    expect(plain.compact).to.be.false;
    expect(plain.hasAttribute('compact')).to.be.false;

    const el = (await fixture(html`<lr-confirm-bar compact></lr-confirm-bar>`)) as LyraConfirmBar;
    expect(el.compact).to.be.true;
    expect(el.hasAttribute('compact')).to.be.true;
  });

  it('defaults frame to "card" and reflects it, in the shared container-frame vocabulary', async () => {
    const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    expect(el.frame).to.equal('card');
    expect(el.getAttribute('frame')).to.equal('card');

    el.frame = 'plain';
    await el.updateComplete;
    expect(el.getAttribute('frame')).to.equal('plain');
  });

  it('compact is density only — it keeps the card border, radius and background', async () => {
    const regular = (await fixture(html`<lr-confirm-bar tool-name="run_shell"></lr-confirm-bar>`)) as LyraConfirmBar;
    const el = (await fixture(html`<lr-confirm-bar compact tool-name="run_shell"></lr-confirm-bar>`)) as LyraConfirmBar;

    const compactStyle = getComputedStyle(part(el, 'base'));
    const regularStyle = getComputedStyle(part(regular, 'base'));

    // Chrome stays exactly as the default card draws it.
    expect(compactStyle.borderTopWidth).to.equal(regularStyle.borderTopWidth);
    expect(compactStyle.borderTopWidth).to.not.equal('0px');
    expect(compactStyle.borderTopLeftRadius).to.equal(regularStyle.borderTopLeftRadius);
    expect(compactStyle.backgroundColor).to.equal(regularStyle.backgroundColor);
    expect(compactStyle.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');

    // Density genuinely tightens: non-zero, but smaller than the full card padding.
    expect(parseFloat(compactStyle.paddingTop)).to.be.greaterThan(0);
    expect(parseFloat(compactStyle.paddingTop)).to.be.lessThan(parseFloat(regularStyle.paddingTop));
  });

  it('retints the resting bar through --lr-confirm-bar-bg', async () => {
    const el = (await fixture(
      html`<lr-confirm-bar tool-name="delete_row" style="--lr-confirm-bar-bg: rgb(1, 2, 3)"></lr-confirm-bar>`,
    )) as LyraConfirmBar;
    expect(getComputedStyle(part(el, 'base')).backgroundColor).to.equal('rgb(1, 2, 3)');
  });

  it('leaves the resting bar on the shared surface token when --lr-confirm-bar-bg is unset', async () => {
    const el = (await fixture(
      html`<lr-confirm-bar tool-name="delete_row" style="--lr-color-surface: rgb(4, 5, 6)"></lr-confirm-bar>`,
    )) as LyraConfirmBar;
    expect(getComputedStyle(part(el, 'base')).backgroundColor).to.equal('rgb(4, 5, 6)');
  });

  it('keeps frame="plain" transparent regardless of --lr-confirm-bar-bg', async () => {
    const el = (await fixture(
      html`<lr-confirm-bar
        frame="plain"
        tool-name="delete_row"
        style="--lr-confirm-bar-bg: rgb(1, 2, 3)"
      ></lr-confirm-bar>`,
    )) as LyraConfirmBar;
    expect(getComputedStyle(part(el, 'base')).backgroundColor).to.equal('rgba(0, 0, 0, 0)');
  });

  it('frame="plain" is the chrome escape — border, radius, padding and background all go', async () => {
    const el = (await fixture(
      html`<lr-confirm-bar frame="plain" variant="danger" tool-name="delete_row"></lr-confirm-bar>`,
    )) as LyraConfirmBar;
    const baseStyle = getComputedStyle(part(el, 'base'));
    expect(baseStyle.borderTopWidth).to.equal('0px');
    expect(baseStyle.borderInlineStartWidth).to.equal('0px');
    expect(baseStyle.borderTopLeftRadius).to.equal('0px');
    expect(baseStyle.paddingTop).to.equal('0px');
    expect(baseStyle.paddingInlineStart).to.equal('0px');
    expect(baseStyle.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
  });

  it('compact frame="plain" reproduces the pre-9.0.0 compact presentation, even with variant="danger"', async () => {
    const el = (await fixture(
      html`<lr-confirm-bar compact frame="plain" variant="danger" tool-name="delete_row"></lr-confirm-bar>`,
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

  it('drops the compact chrome custom properties — re-chroming is frame="card" now', async () => {
    const el = (await fixture(html`
      <lr-confirm-bar
        compact
        frame="plain"
        tool-name="run_shell"
        style="--lr-confirm-bar-compact-background:rgb(1, 2, 3);--lr-confirm-bar-compact-border:2px solid rgb(4, 5, 6);--lr-confirm-bar-compact-radius:9px;"
      ></lr-confirm-bar>
    `)) as LyraConfirmBar;
    const baseStyle = getComputedStyle(part(el, 'base'));
    expect(baseStyle.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    expect(baseStyle.borderTopWidth).to.equal('0px');
    expect(baseStyle.borderTopLeftRadius).to.equal('0px');
  });

  it('neutralizes the narrow-container query so the buttons are not stretched inside a table cell', async () => {
    const wrap = await fixture(html`
      <div style="inline-size:240px;">
        <lr-confirm-bar compact tool-name="run_shell"></lr-confirm-bar>
        <lr-confirm-bar tool-name="run_shell"></lr-confirm-bar>
      </div>
    `);
    const compact = wrap.querySelector<LyraConfirmBar>('lr-confirm-bar[compact]');
    const regular = wrap.querySelector<LyraConfirmBar>('lr-confirm-bar:not([compact])');
    if (!compact || !regular) throw new Error('Expected both compact and regular confirm bars.');

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
    const approveDetail = (await approvePromise).detail as { args: unknown; waitUntil: unknown };
    expect(approveDetail.args).to.deep.equal({ x: 1 });
    expect(typeof approveDetail.waitUntil).to.equal('function');
    await approveEl.updateComplete;
    expect(approveEl.decision).to.equal('approved');

    const denyEl = (await fixture(html`<lr-confirm-bar compact></lr-confirm-bar>`)) as LyraConfirmBar;
    const denyPromise = oneEvent(denyEl, 'lr-deny');
    (part(denyEl, 'deny-button') as LyraButton).click();
    const denyDetail = (await denyPromise).detail as { waitUntil: unknown };
    expect(Object.keys(denyDetail)).to.deep.equal(['waitUntil']);
    await denyEl.updateComplete;
    expect(denyEl.decision).to.equal('denied');
  });

  it('leaves the default presentation byte-identical when compact is unset', async () => {
    const el = (await fixture(html`<lr-confirm-bar variant="danger"></lr-confirm-bar>`)) as LyraConfirmBar;
    expect(getComputedStyle(el).display).to.equal('block');
    expect(getComputedStyle(el).containerType).to.equal('inline-size');

    const baseStyle = getComputedStyle(part(el, 'base'));
    expect(baseStyle.flexDirection).to.equal('column');
    expect(baseStyle.borderTopWidth).to.not.equal('0px');
    expect(baseStyle.paddingTop).to.not.equal('0px');
    expect(baseStyle.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
  });

  it('is accessible in the compact and chrome-less presentations, before and after a decision', async () => {
    const el = (await fixture(
      html`<lr-confirm-bar
        compact
        frame="plain"
        variant="danger"
        tool-name="delete_row"
        .args=${{ id: 7 }}
      ></lr-confirm-bar>`,
    )) as LyraConfirmBar;
    await expect(el).to.be.accessible();

    (el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).click();
    await el.updateComplete;
    await expect(el).to.be.accessible();

    const dense = (await fixture(
      html`<lr-confirm-bar compact tool-name="delete_row" .args=${{ id: 7 }}></lr-confirm-bar>`,
    )) as LyraConfirmBar;
    await expect(dense).to.be.accessible();
  });
});

describe('focus-on-mount and escape-denies', () => {
  it('defaults autofocus and escape-denies to false and reflects them as attributes when set', async () => {
    const plain = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    expect(plain.autofocus).to.be.false;
    expect(plain.escapeDenies).to.be.false;
    expect(plain.hasAttribute('autofocus')).to.be.false;
    expect(plain.hasAttribute('escape-denies')).to.be.false;

    const el = (await fixture(
      html`<lr-confirm-bar autofocus escape-denies></lr-confirm-bar>`,
    )) as LyraConfirmBar;
    expect(el.autofocus).to.be.true;
    expect(el.escapeDenies).to.be.true;
    expect(el.hasAttribute('autofocus')).to.be.true;
    expect(el.hasAttribute('escape-denies')).to.be.true;
  });

  it('does not move focus anywhere when autofocus is unset', async () => {
    const outside = document.createElement('button');
    document.body.append(outside);
    try {
      outside.focus();
      await fixture(html`<lr-confirm-bar tool-name="run_shell"></lr-confirm-bar>`);
      expect(document.activeElement === outside).to.be.true;
    } finally {
      outside.remove();
    }
  });

  it('autofocus moves focus to the Deny control after the bar\'s own first render', async () => {
    const el = (await fixture(
      html`<lr-confirm-bar autofocus tool-name="run_shell"></lr-confirm-bar>`,
    )) as LyraConfirmBar;
    const deny = el.shadowRoot!.querySelector('[part="deny-button"]') as HTMLElement & {
      updateComplete: Promise<unknown>;
    };
    await deny.updateComplete;
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement === deny).to.be.true;
  });

  it('autofocus falls back to [part="status"] when Deny is unavailable (disabled)', async () => {
    const el = (await fixture(
      html`<lr-confirm-bar autofocus disabled tool-name="run_shell"></lr-confirm-bar>`,
    )) as LyraConfirmBar;
    const deny = el.shadowRoot!.querySelector('[part="deny-button"]') as HTMLElement & {
      updateComplete: Promise<unknown>;
    };
    await deny.updateComplete;
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement!.getAttribute('part')).to.equal('status');
  });

  it('autofocus falls back to [part="status"] when already decided (no Deny control rendered)', async () => {
    const el = (await fixture(
      html`<lr-confirm-bar autofocus decision="approved" tool-name="run_shell"></lr-confirm-bar>`,
    )) as LyraConfirmBar;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="deny-button"]') == null).to.be.true;
    expect(el.shadowRoot!.activeElement!.getAttribute('part')).to.equal('status');
  });

  it('escape-denies maps Escape on [part="base"] to the same outcome as clicking Deny', async () => {
    const el = (await fixture(
      html`<lr-confirm-bar escape-denies tool-name="run_shell"></lr-confirm-bar>`,
    )) as LyraConfirmBar;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const denyPromise = oneEvent(el, 'lr-deny');
    base.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true }),
    );
    await denyPromise;
    await el.updateComplete;
    expect(el.decision).to.equal('denied');
  });

  it('a successful escape-denies deny swallows the Escape, mirroring lr-memory-panel\'s onConfirmKeyDown', async () => {
    // decide() actually changing state here (undecided -> denied) is the "Escape actually denied
    // something" branch documented on onBaseKeyDown -- stopPropagation() there is deliberate so one
    // Escape press does not also dismiss an unrelated enclosing dialog/popover on the same keypress,
    // exactly like lr-memory-panel's own onConfirmKeyDown (`stop propagation only when the cancel
    // actually closed something`). The *ineffectual* Escape cases (disabled, already decided --
    // covered above) are the ones that must keep propagating.
    const wrapper = document.createElement('div');
    const el = (await fixture(
      html`<lr-confirm-bar escape-denies tool-name="run_shell"></lr-confirm-bar>`,
      { parentNode: wrapper },
    )) as LyraConfirmBar;
    let bubbledToWrapper = false;
    wrapper.addEventListener('keydown', () => {
      bubbledToWrapper = true;
    });
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const denyPromise = oneEvent(el, 'lr-deny');
    base.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true }),
    );
    await denyPromise;
    expect(el.decision, 'sanity: deny actually succeeded').to.equal('denied');
    expect(bubbledToWrapper, 'a successful deny must swallow its own Escape').to.equal(false);
  });

  it('never denies on Escape when escape-denies is unset, and never swallows it either', async () => {
    const wrapper = document.createElement('div');
    const el = (await fixture(html`<lr-confirm-bar tool-name="run_shell"></lr-confirm-bar>`, {
      parentNode: wrapper,
    })) as LyraConfirmBar;
    let bubbledToWrapper = false;
    wrapper.addEventListener('keydown', () => {
      bubbledToWrapper = true;
    });
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    let denyFired = false;
    el.addEventListener('lr-deny', () => {
      denyFired = true;
    });
    base.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true }),
    );
    await el.updateComplete;
    expect(denyFired).to.be.false;
    expect(el.decision).to.equal(null);
    expect(bubbledToWrapper, 'escape-denies unset: Escape is a complete no-op, never swallowed').to.equal(true);
  });

  it('ignores keys other than Escape even when escape-denies is set', async () => {
    const el = (await fixture(
      html`<lr-confirm-bar escape-denies tool-name="run_shell"></lr-confirm-bar>`,
    )) as LyraConfirmBar;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    let denyFired = false;
    el.addEventListener('lr-deny', () => {
      denyFired = true;
    });
    base.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true }),
    );
    await el.updateComplete;
    expect(denyFired).to.be.false;
  });

  it('never denies on Escape while disabled, and never swallows an ineffectual Escape', async () => {
    // `parentNode` is an open-wc fixture option -- the fixture wrapper appends it under
    // `document.body` itself and the global afterEach fixtureCleanup removes it, so this test
    // must not append/remove it manually (that would double-remove the node).
    const wrapper = document.createElement('div');
    const el = (await fixture(
      html`<lr-confirm-bar escape-denies disabled tool-name="run_shell"></lr-confirm-bar>`,
      { parentNode: wrapper },
    )) as LyraConfirmBar;
    let denyFired = false;
    el.addEventListener('lr-deny', () => {
      denyFired = true;
    });
    let bubbledToWrapper = false;
    wrapper.addEventListener('keydown', () => {
      bubbledToWrapper = true;
    });
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true }),
    );
    expect(denyFired).to.be.false;
    expect(el.decision).to.equal(null);
    // decide() was a no-op (disabled), so onBaseKeyDown must not have stopped propagation --
    // otherwise an enclosing dialog listening for its own Escape would never see this event.
    expect(bubbledToWrapper).to.be.true;
  });

  it('never denies on Escape once already decided, and never swallows that ineffectual Escape', async () => {
    const wrapper = document.createElement('div');
    const el = (await fixture(
      html`<lr-confirm-bar escape-denies decision="approved" tool-name="run_shell"></lr-confirm-bar>`,
      { parentNode: wrapper },
    )) as LyraConfirmBar;
    let bubbledToWrapper = false;
    wrapper.addEventListener('keydown', () => {
      bubbledToWrapper = true;
    });
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true }),
    );
    expect(el.decision).to.equal('approved');
    expect(bubbledToWrapper).to.be.true;
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
  it('renders Deny/Approve as lr-button with variant="neutral"/"brand" ("danger" under variant="danger")', async () => {
    const neutral = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    const deny = neutral.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton;
    const approve = neutral.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton;
    expect(deny.tagName.toLowerCase()).to.equal('lr-button');
    expect(approve.tagName.toLowerCase()).to.equal('lr-button');
    expect(deny.variant).to.equal('neutral');
    expect(approve.variant).to.equal('brand');
    expect(deny.type).to.equal('button');
    expect(approve.type).to.equal('button');

    const danger = (await fixture(html`<lr-confirm-bar variant="danger"></lr-confirm-bar>`)) as LyraConfirmBar;
    const dangerApprove = danger.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton;
    expect(dangerApprove.variant).to.equal('danger');
    // Deny is not variant-sensitive -- stays neutral even under variant="danger".
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
      '[part~="base"]',
    ) as HTMLElement;
    const approveBase = (
      el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton
    ).shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    // Deny is variant="neutral" appearance="outlined": no fill, so it recedes against whatever
    // surface the bar sits on, with --lr-color-text for the label. Both are declared on the button
    // rather than inherited -- when lr-button's default appearance changed to "accent" in 8.0.0, a
    // bar relying on the default would have turned its SAFE action into the loud one.
    expect(getComputedStyle(denyBase).backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(denyBase).color).to.equal(toRgb(resolve('--lr-color-text')));
    // Approve (variant="brand"): --lr-color-brand / --lr-color-on-brand.
    expect(getComputedStyle(approveBase).backgroundColor).to.equal(toRgb(resolve('--lr-color-brand')));
    expect(getComputedStyle(approveBase).color).to.equal(toRgb(resolve('--lr-color-on-brand')));

    const danger = (await fixture(html`<lr-confirm-bar variant="danger"></lr-confirm-bar>`)) as LyraConfirmBar;
    await danger.updateComplete;
    const dangerResolve = (token: string) => getComputedStyle(danger).getPropertyValue(token).trim();
    const dangerApproveBase = (
      danger.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton
    ).shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
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
      const denyButton = el.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton;
      const approveButton = el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton;
      expect(denyButton.getAttribute('exportparts')).to.include('button:deny-button-base');
      expect(approveButton.getAttribute('exportparts')).to.include('button:approve-button-base');
      denyButton.setAttribute('exportparts', 'button:deny-button-base');
      approveButton.setAttribute('exportparts', 'button:approve-button-base');
      const denyBase = denyButton.shadowRoot!.querySelector('[part~="button"]') as HTMLElement;
      const approveBase = approveButton.shadowRoot!.querySelector('[part~="button"]') as HTMLElement;
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
    expect(approveEl.pending).to.equal('approve');
    expect(approveEl.hasAttribute('pending')).to.be.true;
    expect(approveEl.shadowRoot!.querySelector('[part="approve-button"]')).to.exist;
    expect(approveEl.shadowRoot!.querySelector('[part="deny-button"]')).to.exist;

    const denyEl = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    denyEl.addEventListener('lr-deny', (e) => e.preventDefault());
    (denyEl.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton).click();
    await denyEl.updateComplete;
    expect(denyEl.decision).to.equal(null);
    expect(denyEl.pending).to.equal('deny');
  });

  it('lr-approve/lr-deny report cancelable:true, and only a prevented listener stops the default finalization', async () => {
    const approveEl = (await fixture(html`<lr-confirm-bar .args=${{ x: 1 }}></lr-confirm-bar>`)) as LyraConfirmBar;
    const approvePromise = oneEvent(approveEl, 'lr-approve');
    (approveEl.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).click();
    const approveEvent = await approvePromise;
    expect(approveEvent.cancelable, 'lr-approve must be cancelable').to.equal(true);
    expect(approveEvent.defaultPrevented, 'not prevented here').to.equal(false);
    await approveEl.updateComplete;
    expect(approveEl.decision, 'not-prevented path finalizes normally').to.equal('approved');
    expect(approveEl.pending).to.equal(null);

    const preventedEl = (await fixture(html`<lr-confirm-bar .args=${{ x: 1 }}></lr-confirm-bar>`)) as LyraConfirmBar;
    const preventedPromise = oneEvent(preventedEl, 'lr-approve');
    preventedEl.addEventListener('lr-approve', (e) => e.preventDefault(), { once: true });
    (preventedEl.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).click();
    const preventedEvent = await preventedPromise;
    expect(preventedEvent.cancelable, 'lr-approve must be cancelable').to.equal(true);
    expect(preventedEvent.defaultPrevented, 'prevented here').to.equal(true);
    await preventedEl.updateComplete;
    expect(preventedEl.decision, 'prevented path never finalizes').to.equal(null);
    expect(preventedEl.pending).to.equal('approve');

    const denyEl = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    const denyPromise = oneEvent(denyEl, 'lr-deny');
    (denyEl.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton).click();
    const denyEvent = await denyPromise;
    expect(denyEvent.cancelable, 'lr-deny must be cancelable').to.equal(true);
    expect(denyEvent.defaultPrevented).to.equal(false);
    await denyEl.updateComplete;
    expect(denyEl.decision).to.equal('denied');

    const preventedDenyEl = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    const preventedDenyPromise = oneEvent(preventedDenyEl, 'lr-deny');
    preventedDenyEl.addEventListener('lr-deny', (e) => e.preventDefault(), { once: true });
    (preventedDenyEl.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton).click();
    const preventedDenyEvent = await preventedDenyPromise;
    expect(preventedDenyEvent.cancelable, 'lr-deny must be cancelable').to.equal(true);
    expect(preventedDenyEvent.defaultPrevented).to.equal(true);
    await preventedDenyEl.updateComplete;
    expect(preventedDenyEl.decision).to.equal(null);
    expect(preventedDenyEl.pending).to.equal('deny');
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
    expect(el.pending).to.equal('approve');

    el.decision = 'approved';
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="approve-button"]')) == null).to.be.true;
    expect((el.shadowRoot!.querySelector('[part="deny-button"]')) == null).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="status"]')!.textContent!.trim()).to.equal('Approved');
  });

  it('bounces back to the undecided, both-buttons-enabled state when pending is reset to null', async () => {
    const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    el.addEventListener('lr-deny', (e) => e.preventDefault());
    (el.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton).click();
    await el.updateComplete;
    expect(el.pending).to.equal('deny');

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
    expect(el.pending).to.equal('approve');
    expect((el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).loading).to.be.true;
    await expect(el).to.be.accessible();
  });

  it('a listener that vetoes and clears pending itself synchronously wins over the built-in fallback', async () => {
    // Regression: decide() used to dispatch lr-approve/lr-deny synchronously, then unconditionally
    // overwrite `pending` with its own built-in value -- clobbering whatever a synchronous listener
    // had just set (e.g. a listener that resolves out of band and bounces pending straight back to
    // null instead of ever wanting the loading/disabled pending presentation).
    const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    el.addEventListener('lr-approve', (e) => {
      e.preventDefault();
      el.pending = null;
    });
    (el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).click();
    await el.updateComplete;
    expect(el.pending).to.equal(null);
    expect(el.decision).to.equal(null);
    // Both controls stay enabled and interactive -- the built-in pending presentation never landed.
    const deny = el.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton;
    const approve = el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton;
    expect(deny.disabled).to.be.false;
    expect(approve.disabled).to.be.false;
    expect(approve.loading).to.be.false;
  });

  it('a listener that vetoes and finalizes the decision itself synchronously wins over the built-in fallback', async () => {
    const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    el.addEventListener('lr-deny', (e) => {
      e.preventDefault();
      el.decision = 'denied';
    });
    (el.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton).click();
    await el.updateComplete;
    expect(el.decision).to.equal('denied');
    expect(el.pending).to.equal(null);
    expect((el.shadowRoot!.querySelector('[part="deny-button"]')) == null).to.be.true;
    expect((el.shadowRoot!.querySelector('[part="approve-button"]')) == null).to.be.true;
  });

  it('hands focus to [part="status"] when entering the pending state, never dropping it to <body>', async () => {
    // `?loading` on the just-activated button makes lr-button's internal native <button> genuinely
    // `disabled`, and the browser blurs a focused element the moment it becomes disabled. Keyboard
    // activation (Tab, then Enter/Space) always leaves that button focused when `decide()` runs, so
    // without an explicit handoff the user is silently dropped to <body> for the whole duration of
    // the host's async work -- contradicting the component's own documented focus contract.
    for (const which of ['approve', 'deny'] as const) {
      const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
      el.addEventListener(which === 'approve' ? 'lr-approve' : 'lr-deny', (e) => e.preventDefault());
      const button = el.shadowRoot!.querySelector(`[part="${which}-button"]`) as LyraButton;
      button.focus();
      await el.updateComplete;
      button.click();
      await el.updateComplete;

      expect(el.pending, `${which} entered the pending state`).to.equal(
        which,
      );
      const status = el.shadowRoot!.querySelector('[part="status"]') as HTMLElement;
      expect(
        el.shadowRoot!.activeElement === status,
        `${which} moved focus to [part="status"], not <body>`,
      ).to.equal(true);
      expect(document.activeElement === el, `${which} kept focus inside the component`).to.equal(true);
    }
  });
});

describe('disabled', () => {
  it('defaults to false and reflects it as an attribute when set', async () => {
    const plain = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    expect(plain.disabled).to.be.false;
    expect(plain.hasAttribute('disabled')).to.be.false;

    const el = (await fixture(html`<lr-confirm-bar disabled></lr-confirm-bar>`)) as LyraConfirmBar;
    expect(el.disabled).to.be.true;
    expect(el.hasAttribute('disabled')).to.be.true;
  });

  it('forwards disabled to both the Deny and Approve lr-buttons', async () => {
    const el = (await fixture(html`<lr-confirm-bar disabled></lr-confirm-bar>`)) as LyraConfirmBar;
    const deny = el.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton;
    const approve = el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton;
    expect(deny.disabled).to.be.true;
    expect(approve.disabled).to.be.true;
  });

  it('blocks the approve path: clicking Approve fires no lr-approve and leaves decision unset', async () => {
    const el = (await fixture(html`<lr-confirm-bar disabled></lr-confirm-bar>`)) as LyraConfirmBar;
    let fired = false;
    el.addEventListener('lr-approve', () => (fired = true));
    (el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).click();
    await el.updateComplete;
    expect(fired).to.be.false;
    expect(el.decision).to.equal(null);
  });

  it('blocks the deny path: clicking Deny fires no lr-deny and leaves decision unset', async () => {
    const el = (await fixture(html`<lr-confirm-bar disabled></lr-confirm-bar>`)) as LyraConfirmBar;
    let fired = false;
    el.addEventListener('lr-deny', () => (fired = true));
    (el.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton).click();
    await el.updateComplete;
    expect(fired).to.be.false;
    expect(el.decision).to.equal(null);
  });

  it('is still accessible while disabled', async () => {
    const el = (await fixture(html`<lr-confirm-bar disabled tool-name="run_shell"></lr-confirm-bar>`)) as LyraConfirmBar;
    await expect(el).to.be.accessible();
  });
});

it('keeps a default (non-compact) bar from collapsing in a shrink-to-fit flex row', async () => {
  // `container-type: inline-size` strips content-based intrinsic sizing, so an inline-size query
  // container placed in a shrink-to-fit context needs a contain-intrinsic-inline-size fallback or
  // it collapses to a sliver. The compact variant sets `container: none` and is unaffected.
  const wrapper = (await fixture(html`
    <div style="display: flex; align-items: flex-start;">
      <lr-confirm-bar tool-name="run_shell"></lr-confirm-bar>
    </div>
  `)) as HTMLElement;
  const el = wrapper.querySelector('lr-confirm-bar') as LyraConfirmBar;
  await el.updateComplete;
  expect(el.getBoundingClientRect().width).to.be.greaterThan(100);
  const approve = el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton;
  expect(approve.getBoundingClientRect().width).to.be.greaterThan(0);
});

it('chains willUpdate()/updated() to super so a mixin layered under LyraElement would still run', async () => {
  // No shared mixin overrides either hook today, so the only way to prove the chain is live
  // (rather than grepping source text for the call) is to patch the base-class hooks a future
  // mixin would extend and confirm they actually fire.
  const proto = LitElement.prototype as unknown as Record<string, unknown>;
  const hooks = ['willUpdate', 'updated'] as const;
  const saved = hooks.map((hook) => ({
    hook,
    hadOwn: Object.prototype.hasOwnProperty.call(LitElement.prototype, hook),
    original: proto[hook] as ((changed: PropertyValues) => void) | undefined,
  }));
  // Recorded per tag name, never as a bare boolean: this component's own shadow root mounts
  // <lr-button>/<lr-live-region>, which are LitElement subclasses too and would trip a shared flag
  // regardless of whether lr-confirm-bar itself chained anything.
  const calledBy: Record<string, Set<string>> = { willUpdate: new Set(), updated: new Set() };
  for (const { hook, original } of saved) {
    proto[hook] = function (this: LitElement, changed: PropertyValues) {
      calledBy[hook]!.add(this.localName);
      original?.call(this, changed);
    };
  }
  try {
    const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    await el.updateComplete;
    expect(calledBy['willUpdate']!.has('lr-confirm-bar'), 'willUpdate chained to super').to.equal(true);
    expect(calledBy['updated']!.has('lr-confirm-bar'), 'updated chained to super').to.equal(true);
  } finally {
    for (const { hook, hadOwn, original } of saved) {
      if (hadOwn) proto[hook] = original;
      else delete proto[hook];
    }
  }
});

describe('waitUntil (deferred decisions)', () => {
  /** A promise whose settlement this test controls, so no timer or fake clock is involved. */
  function deferred(): {
    promise: Promise<void>;
    resolve: () => void;
    reject: (reason?: unknown) => void;
  } {
    let resolve!: () => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, reject, resolve };
  }

  it('lr-approve\'s detail carries waitUntil; calling it holds the bar pending with no preventDefault()', async () => {
    const el = (await fixture(html`<lr-confirm-bar .args=${{ x: 1 }}></lr-confirm-bar>`)) as LyraConfirmBar;
    const work = deferred();
    let sawArgs: unknown;
    el.addEventListener('lr-approve', (event) => {
      const detail = (event as CustomEvent<{ args: unknown; waitUntil: (p: Promise<unknown>) => void }>).detail;
      sawArgs = detail.args;
      detail.waitUntil(work.promise);
    });
    (el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).click();
    await el.updateComplete;

    expect(sawArgs).to.deep.equal({ x: 1 });
    expect(el.pending, 'waitUntil() alone enters the pending state').to.equal('approve');
    expect(el.decision, 'and does not finalize yet').to.equal(null);
    const approve = el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton;
    const deny = el.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton;
    expect(approve.loading, 'the awaited action shows loading').to.equal(true);
    expect(deny.disabled, 'the other action is disabled meanwhile').to.equal(true);

    // Set up before the settlement it waits on. lr-decision-settled is also the answer to "when is
    // the decided state really finished?" -- awaiting one updateComplete after the promise is not,
    // because the promise chain and Lit's own update queue interleave.
    const settled = oneEvent(el, 'lr-decision-settled');
    work.resolve();
    await settled;
    expect(el.decision, 'resolution finalizes the decision').to.equal('approved');
    expect(el.pending, 'and clears pending').to.equal(null);
    expect(
      el.shadowRoot!.querySelector('[part="status"]')!.textContent!.trim(),
    ).to.equal('Approved');
  });

  it('lr-deny\'s detail carries waitUntil too, and a rejection bounces the bar back to undecided', async () => {
    const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    const work = deferred();
    el.addEventListener('lr-deny', (event) => {
      (event as CustomEvent<{ waitUntil: (p: Promise<unknown>) => void }>).detail.waitUntil(work.promise);
    });
    (el.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton).click();
    await el.updateComplete;
    expect(el.pending).to.equal('deny');

    work.reject(new Error('network down'));
    await work.promise.catch(() => undefined);
    await el.updateComplete;
    await el.updateComplete;
    expect(el.decision, 'a rejection never finalizes').to.equal(null);
    expect(el.pending, 'a rejection restores the undecided state').to.equal(null);
    const deny = el.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton;
    const approve = el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton;
    expect(deny.loading).to.equal(false);
    expect(deny.disabled).to.equal(false);
    expect(approve.disabled).to.equal(false);
  });

  it('waits for every waitUntil() a dispatch collected, not just the first', async () => {
    const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    const first = deferred();
    const second = deferred();
    el.addEventListener('lr-approve', (event) => {
      (event as CustomEvent<{ waitUntil: (p: Promise<unknown>) => void }>).detail.waitUntil(first.promise);
    });
    el.addEventListener('lr-approve', (event) => {
      (event as CustomEvent<{ waitUntil: (p: Promise<unknown>) => void }>).detail.waitUntil(second.promise);
    });
    (el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).click();
    await el.updateComplete;
    expect(el.pending).to.equal('approve');

    first.resolve();
    await first.promise;
    await el.updateComplete;
    expect(el.decision, 'one of two settled is not settled').to.equal(null);
    expect(el.pending).to.equal('approve');

    second.resolve();
    await second.promise;
    await el.updateComplete;
    expect(el.decision).to.equal('approved');
  });

  it('a listener that vetoes and writes pending itself still wins over waitUntil\'s bookkeeping', async () => {
    // The VetoWriteGuard contract, unchanged by waitUntil: emit() is synchronous, so a listener
    // that resolves the decision out of band owns it. Tracking the write (not the value) is what
    // makes `pending = null` -- value-identical to "untouched" -- detectable.
    const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    const work = deferred();
    el.addEventListener('lr-approve', (event) => {
      event.preventDefault();
      (event as CustomEvent<{ waitUntil: (p: Promise<unknown>) => void }>).detail.waitUntil(work.promise);
      el.pending = null;
    });
    (el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).click();
    await el.updateComplete;
    expect(el.pending, 'the listener\'s own write survives').to.equal(null);
    expect(el.decision).to.equal(null);

    work.resolve();
    await work.promise;
    await el.updateComplete;
    expect(el.decision, 'and the settlement never clobbers it').to.equal(null);
    expect(el.pending).to.equal(null);
  });

  it('absorbs a waitUntil promise whose rejection the listener\'s own resolution made irrelevant', async () => {
    // The listener wins outright, so the bar deliberately applies no bookkeeping to the promise it
    // was handed -- but it did accept it, and `Promise.resolve(p)` on a native promise hands back
    // that same object, so dropping it with nothing attached turns its rejection into an unhandled
    // rejection in the host page. Nothing in this test may attach its own handler to `work.promise`
    // for the same reason: doing so would mark it handled and hide the defect.
    const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    const work = deferred();
    const unhandled: string[] = [];
    const onUnhandled = (event: PromiseRejectionEvent): void => {
      unhandled.push(String((event.reason as Error | undefined)?.message));
      event.preventDefault();
    };
    window.addEventListener('unhandledrejection', onUnhandled);
    try {
      el.addEventListener('lr-approve', (event) => {
        event.preventDefault();
        (event as CustomEvent<{ waitUntil: (p: Promise<unknown>) => void }>).detail.waitUntil(work.promise);
        el.decision = 'approved';
      });
      (el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).click();
      await el.updateComplete;
      expect(el.decision, 'the listener still owns the outcome').to.equal('approved');

      work.reject(new Error('dropped deferral'));
      // `unhandledrejection` is only reported once the microtask queue has drained, so a macrotask
      // turn is the earliest point at which its absence is evidence rather than timing.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled, 'the dropped promise is absorbed, not leaked').to.deep.equal([]);
      expect(el.decision).to.equal('approved');
      expect(el.pending).to.equal(null);
    } finally {
      window.removeEventListener('unhandledrejection', onUnhandled);
    }
  });

  it('a host that finalizes the decision itself while the promise is in flight is not overwritten', async () => {
    const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    const work = deferred();
    el.addEventListener('lr-deny', (event) => {
      (event as CustomEvent<{ waitUntil: (p: Promise<unknown>) => void }>).detail.waitUntil(work.promise);
    });
    (el.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton).click();
    await el.updateComplete;
    el.decision = 'approved';
    await el.updateComplete;

    work.reject(new Error('too late'));
    await work.promise.catch(() => undefined);
    await el.updateComplete;
    expect(el.decision, 'the host-set decision stands').to.equal('approved');
    expect(el.pending).to.equal(null);
  });

  it('waitUntil() called after the dispatch is a no-op, not a retroactive pending state', async () => {
    const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    let late: ((p: Promise<unknown>) => void) | undefined;
    el.addEventListener('lr-approve', (event) => {
      late = (event as CustomEvent<{ waitUntil: (p: Promise<unknown>) => void }>).detail.waitUntil;
    });
    (el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).click();
    await el.updateComplete;
    expect(el.decision, 'no waitUntil during dispatch: the synchronous path is unchanged').to.equal('approved');

    const work = deferred();
    late!(work.promise);
    await el.updateComplete;
    expect(el.decision).to.equal('approved');
    expect(el.pending).to.equal(null);
  });

  it('hands focus to [part="status"] when waitUntil() enters the pending state', async () => {
    const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    const work = deferred();
    el.addEventListener('lr-approve', (event) => {
      (event as CustomEvent<{ waitUntil: (p: Promise<unknown>) => void }>).detail.waitUntil(work.promise);
    });
    const approve = el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton;
    approve.focus();
    await el.updateComplete;
    approve.click();
    await el.updateComplete;
    expect(
      el.shadowRoot!.activeElement?.getAttribute('part'),
      'the loading button becomes disabled, so focus must be handed over first',
    ).to.equal('status');
    work.resolve();
    await work.promise;
  });

  it('restores focus to the action\'s own control when a rejection bounces the bar back', async () => {
    const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    const work = deferred();
    el.addEventListener('lr-deny', (event) => {
      (event as CustomEvent<{ waitUntil: (p: Promise<unknown>) => void }>).detail.waitUntil(work.promise);
    });
    const deny = el.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton;
    deny.focus();
    await el.updateComplete;
    deny.click();
    await el.updateComplete;

    work.reject(new Error('nope'));
    await work.promise.catch(() => undefined);
    await el.updateComplete;
    await el.updateComplete;
    expect(el.pending).to.equal(null);
    expect(
      el.shadowRoot!.activeElement?.getAttribute('part'),
      'the retryable control gets focus back, not the status text',
    ).to.equal('deny-button');
  });

  it('is accessible while a waitUntil() decision is in flight', async () => {
    const el = (await fixture(html`<lr-confirm-bar tool-name="run_shell"></lr-confirm-bar>`)) as LyraConfirmBar;
    const work = deferred();
    el.addEventListener('lr-approve', (event) => {
      (event as CustomEvent<{ waitUntil: (p: Promise<unknown>) => void }>).detail.waitUntil(work.promise);
    });
    (el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).click();
    await el.updateComplete;
    expect(el.pending, 'sanity: the pending state actually landed').to.equal('approve');
    await expect(el).to.be.accessible();
    work.resolve();
    await work.promise;
  });

  it('does not throw when the promise settles after the bar was removed from the document', async () => {
    const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    const work = deferred();
    el.addEventListener('lr-approve', (event) => {
      (event as CustomEvent<{ waitUntil: (p: Promise<unknown>) => void }>).detail.waitUntil(work.promise);
    });
    (el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).click();
    await el.updateComplete;
    el.remove();
    work.resolve();
    await work.promise;
    await el.updateComplete;
    expect(el.decision, 'the decision still settles for a re-attached bar').to.equal('approved');
  });
});

describe('lr-decision-settled', () => {
  it('fires after the status render, non-cancelable, with the decision in its detail', async () => {
    const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    const settledPromise = oneEvent(el, 'lr-decision-settled');
    (el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).click();
    const settled = await settledPromise;
    expect(settled.detail).to.deep.equal({ decision: 'approved' });
    expect(settled.cancelable, 'a settled notification is never a veto point').to.equal(false);
    expect(settled.bubbles).to.equal(true);
    expect(settled.composed).to.equal(true);
    expect(
      el.shadowRoot!.querySelector('[part="status"]')!.textContent!.trim(),
      'the status has already rendered when the event fires',
    ).to.equal('Approved');
  });

  it('fires for a host-set decision too, so an unmounting host has one signal for every path', async () => {
    const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    const settledPromise = oneEvent(el, 'lr-decision-settled');
    el.decision = 'denied';
    const settled = await settledPromise;
    expect(settled.detail).to.deep.equal({ decision: 'denied' });
  });

  it('does not fire for a decision supplied in the initial markup', async () => {
    const el = (await fixture(html`<lr-confirm-bar decision="approved"></lr-confirm-bar>`)) as LyraConfirmBar;
    let fired = false;
    el.addEventListener('lr-decision-settled', () => {
      fired = true;
    });
    await el.updateComplete;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    expect(fired, 'mounting an already-decided bar announces nothing and settles nothing').to.equal(false);
  });

  it('fires once a waitUntil() promise resolves, after the pending state has cleared', async () => {
    const el = (await fixture(html`<lr-confirm-bar></lr-confirm-bar>`)) as LyraConfirmBar;
    let resolveWork!: () => void;
    const work = new Promise<void>((resolve) => {
      resolveWork = resolve;
    });
    el.addEventListener('lr-approve', (event) => {
      (event as CustomEvent<{ waitUntil: (p: Promise<unknown>) => void }>).detail.waitUntil(work);
    });
    const settledPromise = oneEvent(el, 'lr-decision-settled');
    (el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).click();
    await el.updateComplete;
    resolveWork();
    const settled = await settledPromise;
    expect(settled.detail).to.deep.equal({ decision: 'approved' });
    expect(el.pending).to.equal(null);
  });
});

describe('returnFocusTo', () => {
  async function barWithTrigger(): Promise<{
    back: HTMLButtonElement;
    el: LyraConfirmBar;
  }> {
    const wrapper = (await fixture(html`
      <div>
        <button type="button" id="back">Back</button>
        <lr-confirm-bar tool-name="run_shell"></lr-confirm-bar>
      </div>
    `)) as HTMLElement;
    return {
      back: wrapper.querySelector('#back') as HTMLButtonElement,
      el: wrapper.querySelector('lr-confirm-bar') as LyraConfirmBar,
    };
  }

  it('defaults to null and is a property, never an attribute', async () => {
    const { back, el } = await barWithTrigger();
    // Compared as a boolean: the property's type admits an element, and chai serializing a live node
    // as `actual` hangs the whole file until the watchdog.
    expect(el.returnFocusTo === null, 'unset by default').to.equal(true);
    el.returnFocusTo = back;
    await el.updateComplete;
    expect(el.hasAttribute('returnfocusto'), 'an element reference is never reflected').to.equal(false);
    expect(el.hasAttribute('return-focus-to')).to.equal(false);
  });

  it('left unset, the decided bar still parks focus on [part="status"] exactly as before', async () => {
    const { el } = await barWithTrigger();
    (el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).click();
    expect(el.shadowRoot!.activeElement!.getAttribute('part')).to.equal('status');
  });

  it('returns focus to the host-named element after Approve', async () => {
    const { back, el } = await barWithTrigger();
    el.returnFocusTo = back;
    const approve = el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton;
    approve.focus();
    await el.updateComplete;
    approve.click();
    expect(document.activeElement === back, 'focus went back to the host\'s named control').to.equal(true);
    expect(
      el.shadowRoot!.activeElement === null,
      'and not to the bar\'s own status part',
    ).to.equal(true);
  });

  it('returns focus to the host-named element after Deny', async () => {
    const { back, el } = await barWithTrigger();
    el.returnFocusTo = back;
    (el.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton).click();
    expect(document.activeElement === back).to.equal(true);
  });

  it('accepts a thunk, resolved at the moment the decision lands', async () => {
    const { back, el } = await barWithTrigger();
    let resolved = 0;
    el.returnFocusTo = () => {
      resolved += 1;
      return back;
    };
    expect(resolved, 'the thunk is not called just by assigning it').to.equal(0);
    (el.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton).click();
    expect(resolved).to.equal(1);
    expect(document.activeElement === back).to.equal(true);
  });

  it('returns focus when a pending decision is finalized externally', async () => {
    const { back, el } = await barWithTrigger();
    el.returnFocusTo = back;
    el.addEventListener('lr-approve', (event) => event.preventDefault(), { once: true });
    (el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).click();
    await el.updateComplete;
    expect(el.pending).to.equal('approve');
    el.decision = 'approved';
    await el.updateComplete;
    expect(document.activeElement === back).to.equal(true);
  });

  it('returns focus when a waitUntil() promise resolves', async () => {
    const { back, el } = await barWithTrigger();
    el.returnFocusTo = back;
    let resolveWork!: () => void;
    const work = new Promise<void>((resolve) => {
      resolveWork = resolve;
    });
    el.addEventListener('lr-deny', (event) => {
      (event as CustomEvent<{ waitUntil: (p: Promise<unknown>) => void }>).detail.waitUntil(work);
    });
    (el.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton).click();
    await el.updateComplete;
    const settled = oneEvent(el, 'lr-decision-settled');
    resolveWork();
    await settled;
    expect(el.decision).to.equal('denied');
    expect(document.activeElement === back).to.equal(true);
  });

  it('skips an inert return target and falls back to [part="status"]', async () => {
    // An inert element refuses focus() silently, so a chain that does not check would strand the
    // user on <body> at exactly the moment a decision was announced.
    const { back, el } = await barWithTrigger();
    back.inert = true;
    el.returnFocusTo = back;
    (el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).click();
    expect(document.activeElement === back, 'the inert target never takes focus').to.equal(false);
    expect(el.shadowRoot!.activeElement!.getAttribute('part')).to.equal('status');
  });

  it('skips a return target that no longer exists and falls back to [part="status"]', async () => {
    const { back, el } = await barWithTrigger();
    el.returnFocusTo = back;
    back.remove();
    (el.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton).click();
    expect(el.shadowRoot!.activeElement!.getAttribute('part')).to.equal('status');
  });

  it('skips a thunk that returns null and falls back to [part="status"]', async () => {
    const { el } = await barWithTrigger();
    el.returnFocusTo = () => null;
    (el.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton).click();
    expect(el.shadowRoot!.activeElement!.getAttribute('part')).to.equal('status');
  });

  it('is accessible with a return target set, before and after the decision', async () => {
    const { back, el } = await barWithTrigger();
    el.returnFocusTo = back;
    await expect(el).to.be.accessible();
    (el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).click();
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('returns focus under dir="rtl" exactly as it does under ltr', async () => {
    const wrapper = (await fixture(html`
      <div dir="rtl">
        <button type="button" id="back-rtl">Back</button>
        <lr-confirm-bar tool-name="run_shell"></lr-confirm-bar>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-confirm-bar') as LyraConfirmBar;
    const back = wrapper.querySelector('#back-rtl') as HTMLButtonElement;
    el.returnFocusTo = back;
    await el.updateComplete;
    (el.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton).click();
    expect(document.activeElement === back).to.equal(true);
  });
});

describe('returnFocusTo against a real conditionally re-rendering Lit host', () => {
  // The documented motivating case, reproduced with a genuine reactive host rather than a fixture
  // that keeps a stable `back` button around for the bar's whole lifetime: a conditional render
  // swaps its own trigger out for `<lr-confirm-bar>`, and swaps a BRAND NEW trigger back in once a
  // decision lands. The host's own re-render runs on Lit's ordinary microtask-batched update
  // cycle -- exactly the same relative ordering every other supported framework's commit has to
  // this bar's own synchronous focus handoff, which is why a plain Lit host is sufficient to
  // reproduce the bug the request described for React/Vue/Svelte hosts too.
  class ConfirmBarSwapHost extends LitElement {
    @state() confirming = false;

    protected override createRenderRoot(): ShadowRoot {
      return this.attachShadow({ mode: 'open' });
    }

    protected override render() {
      if (!this.confirming) {
        return litHtml`<button
          type="button"
          data-action="delete"
          @click=${() => {
            this.confirming = true;
          }}
        >Delete</button>`;
      }
      return litHtml`<lr-confirm-bar
        tool-name="delete"
        .returnFocusTo=${() => this.shadowRoot!.querySelector<HTMLElement>('[data-action="delete"]')}
        @lr-deny=${() => {
          this.confirming = false;
        }}
        @lr-approve=${(event: CustomEvent<{ waitUntil: (p: Promise<unknown>) => void }>) => {
          event.preventDefault();
        }}
      ></lr-confirm-bar>`;
    }
  }
  customElements.define('confirm-bar-swap-host-test', ConfirmBarSwapHost);

  async function swapHostFixture(): Promise<ConfirmBarSwapHost> {
    const host = await fixture<ConfirmBarSwapHost>(
      html`<confirm-bar-swap-host-test></confirm-bar-swap-host-test>`,
    );
    await host.updateComplete;
    return host;
  }

  it('lands focus on the re-created trigger after an immediate Deny click', async () => {
    const host = await swapHostFixture();
    host.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="delete"]')!.click();
    await host.updateComplete;
    const bar = host.shadowRoot!.querySelector('lr-confirm-bar') as LyraConfirmBar;
    await bar.updateComplete;

    (bar.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton).click();
    // The host's `lr-deny` listener clears `confirming` synchronously, inside the bar's own
    // synchronous dispatch -- but the host's own re-render (the thing that removes the bar and
    // re-creates the trigger) is scheduled asynchronously, same as every supported framework.
    await nextHostUpdateOpportunity();
    await nextHostUpdateOpportunity();
    await host.updateComplete;

    const recreatedTrigger = host.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="delete"]');
    expect(recreatedTrigger === null, 'the host swapped the bar back out for a new trigger').to.equal(false);
    expect(
      host.shadowRoot!.querySelector('lr-confirm-bar') === null,
      'the old bar is gone, not merely hidden',
    ).to.equal(true);
    expect(
      host.shadowRoot!.activeElement === recreatedTrigger,
      'focus landed on the re-created trigger, not <body> or [part="status"]',
    ).to.equal(true);
  });

  it('lands focus on the re-created trigger after a deferred decision write', async () => {
    const host = await swapHostFixture();
    host.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="delete"]')!.click();
    await host.updateComplete;
    const bar = host.shadowRoot!.querySelector('lr-confirm-bar') as LyraConfirmBar;
    await bar.updateComplete;

    (bar.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton).click();
    await bar.updateComplete;
    expect(bar.pending).to.equal('approve');

    // The documented deferred-path shape: the decision lands first, and only afterward does the
    // host clear its own state, both from the same async continuation -- matching the reference's
    // own worked example (`llms/agent-tools.md`'s async `lr-approve` handler).
    bar.decision = 'approved';
    host.confirming = false;
    await nextHostUpdateOpportunity();
    await nextHostUpdateOpportunity();
    await host.updateComplete;

    const recreatedTrigger = host.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="delete"]');
    expect(recreatedTrigger === null, 'the host swapped the bar back out for a new trigger').to.equal(false);
    expect(
      host.shadowRoot!.activeElement === recreatedTrigger,
      'focus landed on the re-created trigger, not <body> or [part="status"]',
    ).to.equal(true);
  });

  it('never overrides a focus move the host or user made between park and resolution', async () => {
    const host = await swapHostFixture();
    host.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="delete"]')!.click();
    await host.updateComplete;
    const bar = host.shadowRoot!.querySelector('lr-confirm-bar') as LyraConfirmBar;
    await bar.updateComplete;

    const elsewhere = document.createElement('button');
    elsewhere.textContent = 'Somewhere else entirely';
    document.body.appendChild(elsewhere);
    try {
      (bar.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton).click();
      // Simulate a user tabbing away (or the host explicitly moving focus) before the deferred
      // re-resolution has had its chance to run.
      elsewhere.focus();
      await nextHostUpdateOpportunity();
      await nextHostUpdateOpportunity();
      await host.updateComplete;

      expect(
        document.activeElement === elsewhere,
        'the newer, genuinely different focus move was not overridden',
      ).to.equal(true);
    } finally {
      elsewhere.remove();
    }
  });
});
