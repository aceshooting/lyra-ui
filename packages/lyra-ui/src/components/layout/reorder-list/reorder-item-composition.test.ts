import { expectDeprecatedUsage } from '../../../../test/expected-deprecations.js';
import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './reorder-item.js';
import './reorder-list.js';
import type { LyraReorderItem } from './reorder-item.class.js';
import {
  captureDeprecationWarnings,
  type DeprecatedUsage,
} from '../../../../test/expected-deprecations.js';

const ANCESTOR_TOKENS =
  '--lr-icon-button-bg: rgb(1, 2, 3); --lr-icon-button-radius: 11px; --lr-icon-button-border: 2px solid rgb(9, 8, 7);';

function movePart(el: LyraReorderItem, part: string): HTMLElement {
  return el.shadowRoot!.querySelector<HTMLElement>(`[part~="${part}"]`)!;
}

function nativeControl(el: LyraReorderItem, part: string): HTMLButtonElement {
  return movePart(el, part).shadowRoot!.querySelector<HTMLButtonElement>('[part~="button"]')!;
}

describe('lr-reorder-item: composed move lr-icon-buttons', () => {
  it('composes real lr-icon-buttons for both move controls', async () => {
    const el = (await fixture(html`<lr-reorder-item value="a">Row</lr-reorder-item>`)) as LyraReorderItem;
    await el.updateComplete;
    expect(movePart(el, 'move-up-button').localName).to.equal('lr-icon-button');
    expect(movePart(el, 'move-down-button').localName).to.equal('lr-icon-button');
    expect(movePart(el, 'move-up-button').getAttribute('exportparts')).to.contain(
      'button:move-up-button-control'
    );
    expect(movePart(el, 'move-down-button').getAttribute('exportparts')).to.contain(
      'button:move-down-button-control'
    );
  });

  it('forwards each native control under its hyphenated name and its deprecated __ alias', async () => {
    const el = (await fixture(html`
      <div>
        <style>
          .forwarded::part(move-up-button-control) { outline: 3px solid rgb(10, 20, 30); }
          .forwarded::part(move-down-button__control) { outline: 3px solid rgb(40, 50, 60); }
        </style>
        <lr-reorder-item class="forwarded" value="a">Row</lr-reorder-item>
      </div>
    `)).querySelector<LyraReorderItem>('lr-reorder-item')!;
    await el.updateComplete;
    expect(getComputedStyle(nativeControl(el, 'move-up-button')).outlineColor).to.equal('rgb(10, 20, 30)');
    expect(getComputedStyle(nativeControl(el, 'move-down-button')).outlineColor).to.equal('rgb(40, 50, 60)');
  });

  it('takes its paint from the shared --lr-icon-button-* contract on an ancestor', async () => {
    const host = await fixture(html`
      <div style=${ANCESTOR_TOKENS}><lr-reorder-item value="a">Row</lr-reorder-item></div>
    `);
    const el = host.querySelector<LyraReorderItem>('lr-reorder-item')!;
    await el.updateComplete;
    const style = getComputedStyle(nativeControl(el, 'move-up-button'));
    expect(style.backgroundColor).to.equal('rgb(1, 2, 3)');
    expect(style.borderTopLeftRadius).to.equal('11px');
    // Border is reachable through the same public token as the other paint properties. This
    // component sets no border default of its own, so the ancestor value is what paints -- the
    // composed control reads the public token ahead of any contextual default.
    expect(style.borderTopWidth, 'the ancestor border token reaches the control').to.equal('2px');
    expect(style.borderTopColor).to.equal('rgb(9, 8, 7)');
  });

  it('keeps the composed accessible name that names the verb and the row', async () => {
    const el = (await fixture(
      html`<div role="list"><lr-reorder-item value="a" aria-label="Second row">Row</lr-reorder-item></div>`
    )).querySelector<LyraReorderItem>('lr-reorder-item')!;
    await el.updateComplete;
    const control = nativeControl(el, 'move-up-button') as HTMLButtonElement & {
      ariaLabelledByElements?: readonly Element[] | null;
    };
    // No engine fallback branch. The projection is the whole point of the composition: an idref
    // cannot cross a shadow boundary, so ariaLabelledByElements is the ONLY channel that names the
    // composed control. A branch that fell back to reading `aria-labelledby` off the host would
    // assert an attribute the template writes one line away, i.e. it could never fail -- and the
    // thing this test exists to cover would go unverified on whichever engine took it.
    expect(
      'ariaLabelledByElements' in control,
      'the engine reflects element references; without it the composed control has no name at all'
    ).to.equal(true);
    const resolved = control.ariaLabelledByElements ?? [];
    expect(resolved.map((node) => (node.textContent ?? '').trim())).to.deep.equal([
      'Move up',
      'Second row',
    ]);
  });

  it('requests a move on Enter from the actually focused control', async () => {
    const el = (await fixture(html`<lr-reorder-item value="a">Row</lr-reorder-item>`)) as LyraReorderItem;
    await el.updateComplete;
    movePart(el, 'move-down-button').focus();
    await el.updateComplete;
    expect(
      movePart(el, 'move-down-button').shadowRoot!.activeElement ===
        nativeControl(el, 'move-down-button'),
      'focus landed on the composed native control'
    ).to.equal(true);
    const moved = oneEvent(el, 'lr-move-request');
    await sendKeys({ press: 'Enter' });
    const event = await moved;
    expect((event as CustomEvent<{ direction: string }>).detail.direction).to.equal('down');
  });

  it('disables the composed control when the move is unavailable', async () => {
    const enabled = (await fixture(
      html`<lr-reorder-item value="a">Row</lr-reorder-item>`
    )) as LyraReorderItem;
    await enabled.updateComplete;
    expect(nativeControl(enabled, 'move-up-button').disabled, 'enabled baseline').to.equal(false);

    const el = (await fixture(
      html`<lr-reorder-item value="a" disabled>Row</lr-reorder-item>`
    )) as LyraReorderItem;
    await el.updateComplete;
    for (const part of ['move-up-button', 'move-down-button']) {
      const composed = movePart(el, part) as HTMLElement & { disabled?: boolean };
      expect(composed.disabled, `${part} composed icon button is disabled`).to.equal(true);
      expect(nativeControl(el, part).disabled, `${part} native control is disabled`).to.equal(true);
    }
  });

  it('is accessible as a populated row inside its list', async () => {
    const list = await fixture(html`
      <lr-reorder-list>
        <lr-reorder-item value="a">First row</lr-reorder-item>
        <lr-reorder-item value="b">Second row</lr-reorder-item>
      </lr-reorder-list>
    `);
    for (const item of Array.from(list.querySelectorAll<LyraReorderItem>('lr-reorder-item'))) {
      await item.updateComplete;
    }
    await expect(list).to.be.accessible();
  });
});

describe('lr-reorder-item: host aria-label and the deprecated accessible-label attribute', () => {
  const aliasUsage: readonly DeprecatedUsage[] = [
    { tag: 'lr-reorder-item', kind: 'attribute', name: 'accessible-label' },
  ];
  const labelledText = (el: LyraReorderItem, part: string): string =>
    (movePart(el, part).getAttribute('aria-labelledby') ?? '')
      .split(/\s+/)
      .map((id) => el.shadowRoot!.getElementById(id)?.textContent ?? '')
      .join(' ')
      .trim();

  it('names the row and both move actions from the host aria-label, without a warning', async () => {
    let el!: LyraReorderItem;
    const warnings = await captureDeprecationWarnings(aliasUsage, async () => {
      el = (await fixture(
        html`<div role="list"><lr-reorder-item value="a" aria-label="Invoices">Row</lr-reorder-item></div>`
      )).querySelector<LyraReorderItem>('lr-reorder-item')!;
      await el.updateComplete;
    });
    expect(warnings).to.have.length(0);
    expect(labelledText(el, 'move-up-button')).to.equal('Move up Invoices');
    expect(labelledText(el, 'move-down-button')).to.equal('Move down Invoices');
    expect(el.getAttribute('aria-label')).to.equal('Invoices');
    await expect(el.parentElement!).to.be.accessible();
  });

  it('keeps the accessible-label alias naming both move actions, and warns once naming aria-label', async () => {
    const labels: string[] = [];
    const warnings = await captureDeprecationWarnings(aliasUsage, async () => {
      for (let index = 0; index < 2; index += 1) {
        const el = (await fixture(
          html`<lr-reorder-item value="a" accessible-label="Invoices">Row</lr-reorder-item>`
        )) as LyraReorderItem;
        await el.updateComplete;
        labels.push(labelledText(el, 'move-up-button'));
      }
    });
    expect(labels).to.deep.equal(['Move up Invoices', 'Move up Invoices']);
    expect(warnings.map(({ key }) => key)).to.deep.equal([
      'lyra-deprecated:lr-reorder-item:attribute:accessible-label',
    ]);
    expect(warnings[0]!.message).to.contain('aria-label');
  });

  it('lets the host aria-label win over the accessible-label alias', async () => {
    let el!: LyraReorderItem;
    await captureDeprecationWarnings(aliasUsage, async () => {
      el = (await fixture(
        html`<lr-reorder-item value="a" accessible-label="Old" aria-label="New">Row</lr-reorder-item>`
      )) as LyraReorderItem;
      await el.updateComplete;
    });
    expect(labelledText(el, 'move-up-button')).to.equal('Move up New');
    el.removeAttribute('aria-label');
    await el.updateComplete;
    expect(labelledText(el, 'move-up-button')).to.equal('Move up Old');
  });

  it('does not warn for a property-only accessibleLabel assignment', async () => {
    const el = (await fixture(html`<lr-reorder-item value="a">Row</lr-reorder-item>`)) as LyraReorderItem;
    const warnings = await captureDeprecationWarnings(aliasUsage, async () => {
      el.accessibleLabel = 'Assigned';
      await el.updateComplete;
    });
    expect(warnings).to.have.length(0);
    expect(labelledText(el, 'move-up-button')).to.equal('Move up Assigned');
  });
});

expectDeprecatedUsage('lr-reorder-item', 'property', 'accessibleLabel');
