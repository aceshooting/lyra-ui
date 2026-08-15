import { fixture, expect, html } from '@open-wc/testing';
import './breadcrumb-item.js';
import './breadcrumb.js';
import type { LyraBreadcrumbItem } from './breadcrumb-item.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

it('renders a link with design-token color and no default UA underline', async () => {
  const el = (await fixture(html`<lr-breadcrumb-item href="/">Home</lr-breadcrumb-item>`)) as LyraBreadcrumbItem;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLAnchorElement;
  const style = getComputedStyle(base);
  // Browser default unvisited-link color is rgb(0, 0, 238); a token-styled link must not fall back to it.
  expect(style.color).to.not.equal('rgb(0, 0, 238)');
  expect(style.textDecorationLine).to.equal('none');
  expect(base.getAttribute('aria-current')).to.equal('false');
});

it("restores the declared rel default when the attribute is removed", async () => {
  const el = (await fixture(
    html`<lr-breadcrumb-item rel="nofollow"></lr-breadcrumb-item>`
  )) as LyraBreadcrumbItem;
  el.removeAttribute("rel");
  await el.updateComplete;
  expect(el.rel).to.equal("noreferrer noopener");
});

it('renders a native button when a non-current item has no href', async () => {
  const breadcrumb = await fixture(html`
    <lr-breadcrumb><lr-breadcrumb-item>Open menu</lr-breadcrumb-item></lr-breadcrumb>
  `);
  const el = breadcrumb.querySelector('lr-breadcrumb-item') as LyraBreadcrumbItem;
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>('button[part="base"]');
  expect(button != null).to.equal(true);
  expect(button!.type).to.equal('button');
  expect(button!.getAttribute('aria-current')).to.equal('false');
  await expect(breadcrumb).to.be.accessible();
});

it("floors tiny link and button owners to a 24px target in both axes", async () => {
  for (const markup of [
    html`<lr-breadcrumb-item href="/tiny"></lr-breadcrumb-item>`,
    html`<lr-breadcrumb-item></lr-breadcrumb-item>`,
  ]) {
    const el = (await fixture(markup)) as LyraBreadcrumbItem;
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    const rect = base.getBoundingClientRect();
    expect(rect.width, base.tagName).to.be.at.least(24);
    expect(rect.height, base.tagName).to.be.at.least(24);
  }
});

it('does not inspect an unavailable render root during the server-side first update', () => {
  const el = document.createElement('lr-breadcrumb-item') as LyraBreadcrumbItem;
  el.href = '/reports';
  const access = el as unknown as { willUpdate(changed: Map<PropertyKey, unknown>): void;
  };

  expect(() => access.willUpdate(new Map([['href', '']]))).not.to.throw();
});

it('preserves focus across link, button, and current-label owner replacements', async () => {
  const el = (await fixture(
    html`<lr-breadcrumb-item href="/reports">Reports</lr-breadcrumb-item>`,
  )) as LyraBreadcrumbItem;
  (el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).focus();

  el.href = '';
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.tagName).to.equal('BUTTON');

  el.href = '/reports';
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.tagName).to.equal('A');

  el.current = true;
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.tagName).to.equal('SPAN');
  expect((el.shadowRoot!.activeElement as HTMLElement | null)?.tabIndex).to.equal(-1);
});

it('does not move external focus when its native owner changes', async () => {
  const wrapper = await fixture(html`
    <div role="list">
      <button id="outside">Outside</button>
      <lr-breadcrumb-item href="/reports">Reports</lr-breadcrumb-item>
    </div>
  `);
  const el = wrapper.querySelector('lr-breadcrumb-item') as LyraBreadcrumbItem;
  wrapper.querySelector<HTMLElement>('#outside')!.focus();
  el.href = '';
  await el.updateComplete;
  expect(el.ownerDocument.activeElement?.id).to.equal('outside');
});

describe('owner names and direct a11y coverage', () => {
  for (const [name, markup] of [
    ['link', html`<lr-breadcrumb-item href="/reports" aria-label="">Reports</lr-breadcrumb-item>`],
    ['button', html`<lr-breadcrumb-item aria-label="">Open reports</lr-breadcrumb-item>`],
  ] as const) {
    it(`forwards an explicit host label to its ${name} owner by presence`, async () => {
      const list = await fixture(html`<div role="list">${markup}</div>`);
      const el = list.querySelector('lr-breadcrumb-item') as LyraBreadcrumbItem;
      const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;

      expect(base.getAttribute('aria-label')).to.equal('');

      el.setAttribute('aria-label', 'Archive reports');
      await el.updateComplete;
      expect(base.getAttribute('aria-label')).to.equal('Archive reports');

      el.removeAttribute('aria-label');
      await el.updateComplete;
      expect(base.hasAttribute('aria-label')).to.be.false;
      await expect(el).to.be.accessible();
    });
  }

  it('axe-checks the current-page branch on its own tag', async () => {
    const list = await fixture(html`
      <div role="list"><lr-breadcrumb-item current>Reports</lr-breadcrumb-item></div>
    `);
    const el = list.querySelector('lr-breadcrumb-item') as LyraBreadcrumbItem;
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;

    expect(base.tagName).to.equal('SPAN');
    expect(base.getAttribute('aria-current')).to.equal('page');
    await expect(el).to.be.accessible();
  });
});

describe('host click()', () => {
  for (const [name, markup] of [
    ['button', html`<lr-breadcrumb-item>Open menu</lr-breadcrumb-item>`],
    ['link', html`<lr-breadcrumb-item href="/reports">Reports</lr-breadcrumb-item>`],
  ] as const) {
    it(`activates the internal ${name}`, async () => {
      const el = (await fixture(markup)) as LyraBreadcrumbItem;
      const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
      let activations = 0;
      base.addEventListener('click', (event) => {
        event.preventDefault();
        activations += 1;
      });

      el.click();

      expect(activations).to.equal(1);
    });
  }

  it('does not activate the current-page label', async () => {
    const el = (await fixture(
      html`<lr-breadcrumb-item current>Reports</lr-breadcrumb-item>`,
    )) as LyraBreadcrumbItem;
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    let activations = 0;
    base.addEventListener('click', () => (activations += 1));

    el.click();

    expect(activations).to.equal(0);
  });
});

it('supports both upstream adornment vocabularies and part aliases', async () => {
  const el = (await fixture(html`
    <lr-breadcrumb-item href="/reports">
      <span slot="start">S</span><span slot="prefix">P</span>
      Reports
      <span slot="end">E</span><span slot="suffix">X</span>
      <span slot="separator">→</span>
    </lr-breadcrumb-item>
  `)) as LyraBreadcrumbItem;
  expect(el.shadowRoot!.querySelector('[part="base"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="label"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part~="start"][part~="prefix"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part~="end"][part~="suffix"]')).to.exist;
  for (const name of ['start', 'prefix', 'end', 'suffix', 'separator']) {
    const slot = el.shadowRoot!.querySelector<HTMLSlotElement>(`slot[name="${name}"]`)!;
    expect(slot.assignedNodes({ flatten: true }).length, name).to.be.greaterThan(0);
  }
});

it('forwards target and force-adds the security guard to a settable rel', async () => {
  const el = (await fixture(html`
    <lr-breadcrumb-item href="https://example.com" target="_blank">Example</lr-breadcrumb-item>
  `)) as LyraBreadcrumbItem;
  const anchor = el.shadowRoot!.querySelector('a')!;
  expect(anchor.getAttribute('target')).to.equal('_blank');
  // Order-insensitive: rel is an unordered token set, and the rendered order depends on whether a
  // token came from the author's value or from the forced guard.
  const rendered = anchor.getAttribute('rel')!.split(' ');
  expect(rendered).to.include('noopener');
  expect(rendered).to.include('noreferrer');
  expect('rel' in el).to.equal(true);
});

it('strips opener from an author rel and keeps the guard when target is set', async () => {
  const el = (await fixture(html`
    <lr-breadcrumb-item href="https://example.com" target="_blank" rel="opener nofollow"
      >Example</lr-breadcrumb-item
    >
  `)) as LyraBreadcrumbItem;
  const rendered = el.shadowRoot!.querySelector('a')!.getAttribute('rel')!.split(' ');
  expect(rendered).to.not.include('opener');
  expect(rendered).to.include('nofollow');
  expect(rendered).to.include('noopener');
  expect(rendered).to.include('noreferrer');
});

it('renders the upstream default rel on a same-tab link', async () => {
  // Both wa-breadcrumb-item and sl-breadcrumb-item default rel to 'noreferrer noopener'.
  const el = (await fixture(html`
    <lr-breadcrumb-item href="https://example.com">Example</lr-breadcrumb-item>
  `)) as LyraBreadcrumbItem;
  const rendered = el.shadowRoot!.querySelector('a')!.getAttribute('rel')!.split(' ');
  expect(rendered).to.include('noreferrer');
  expect(rendered).to.include('noopener');
});

it('shows a focus ring on the link via :focus-visible', async () => {
  const el = (await fixture(html`<lr-breadcrumb-item href="/">Home</lr-breadcrumb-item>`)) as LyraBreadcrumbItem;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLAnchorElement;
  base.focus();
  await el.updateComplete;
  const style = getComputedStyle(base);
  expect(style.outlineWidth).to.equal('2px');
  expect(style.outlineOffset).to.equal('2px');
});

it('gives the current-page span a distinct font-weight from a plain link', async () => {
  const link = (await fixture(html`<lr-breadcrumb-item href="/">Home</lr-breadcrumb-item>`)) as LyraBreadcrumbItem;
  const current = (await fixture(html`<lr-breadcrumb-item current>Reports</lr-breadcrumb-item>`)) as LyraBreadcrumbItem;
  const linkBase = link.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const currentBase = current.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(getComputedStyle(currentBase).fontWeight).to.not.equal(getComputedStyle(linkBase).fontWeight);
  expect(currentBase.getAttribute('aria-current')).to.equal('page');
});

it('is accessible', async () => {
  // Wrapped in <lr-breadcrumb> so the item's self-applied role="listitem" has the
  // role="list" ancestor axe's aria-required-parent rule expects (breadcrumb.class.ts
  // renders that role on its own shadow-DOM [part="list"] wrapper).
  const el = await fixture(html`<lr-breadcrumb><lr-breadcrumb-item href="/">Home</lr-breadcrumb-item></lr-breadcrumb>`);
  await expect(el).to.be.accessible();
});

describe('current-state cssprop', () => {
  /** Resolves what a `declaration` would compute to *inside this component's shadow root*, where the
   *  `--lr-*` design tokens actually live. Used to assert the unset default byte-for-byte against
   *  the token it falls back to. */
  function resolvedInShadow(el: LyraBreadcrumbItem, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  async function themedItem(style: string): Promise<LyraBreadcrumbItem> {
    const wrapper = (await fixture(html`
      <div style=${style}>
        <lr-breadcrumb><lr-breadcrumb-item current>Reports</lr-breadcrumb-item></lr-breadcrumb>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-breadcrumb-item') as LyraBreadcrumbItem;
    await el.updateComplete;
    return el;
  }

  it('recolors the current-page item from an ancestor, not a :host-declared prop', async () => {
    const el = await themedItem('--lr-breadcrumb-current-color: rgb(0, 51, 102);');
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('aria-current')).to.equal('page');
    expect(getComputedStyle(base).color).to.equal('rgb(0, 51, 102)');
  });

  it('renders byte-identically to the pre-cssprop output when the prop is unset', async () => {
    const el = await themedItem('');
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).color).to.equal(
      resolvedInShadow(el, 'color: var(--lr-color-text-quiet)', 'color'),
    );
  });

  it('is accessible with the current-state prop themed', async () => {
    const el = await fixture(html`
      <div style="--lr-breadcrumb-current-color: rgb(0, 51, 102);">
        <lr-breadcrumb>
          <lr-breadcrumb-item href="/">Home</lr-breadcrumb-item>
          <lr-breadcrumb-item current>Reports</lr-breadcrumb-item>
        </lr-breadcrumb>
      </div>
    `);
    await expect(el.querySelector('lr-breadcrumb')!).to.be.accessible();
  });
});

it('inherits its pressed fill independently from an ancestor', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div style="--lr-breadcrumb-item-active-bg: rgb(1, 2, 3);">
      <lr-breadcrumb><lr-breadcrumb-item>Reports</lr-breadcrumb-item></lr-breadcrumb>
    </div>
  `);
  const el = wrapper.querySelector('lr-breadcrumb-item') as LyraBreadcrumbItem;
  const target = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const rect = target.getBoundingClientRect();
  try {
    await sendMouse({ type: 'move', position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)] });
    await sendMouse({ type: 'down' });
    expect(getComputedStyle(target).backgroundColor).to.equal('rgb(1, 2, 3)');
  } finally {
    await resetMouse();
  }
});
