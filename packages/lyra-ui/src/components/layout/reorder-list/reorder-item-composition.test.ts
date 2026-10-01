import { expectStaleAttribute } from '../../../../test/expected-stale-attributes.js';
import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './reorder-item.js';
import './reorder-list.js';
import type { LyraReorderItem } from './reorder-item.class.js';
import type { LyraIconButton } from '../../forms/icon-button/icon-button.class.js';
import { registerLyraLocale } from '../../../internal/localization.js';
import {
  captureDeprecationWarnings,
  type DeprecatedUsage,
} from '../../../../test/expected-deprecations.js';

// These fixtures deliberately verify that retired attributes remain inert.
expectStaleAttribute('lr-reorder-item', 'accessible-label');

const ANCESTOR_TOKENS =
  '--lr-icon-button-bg: rgb(1, 2, 3); --lr-icon-button-radius: 11px; --lr-icon-button-border: 2px solid rgb(9, 8, 7);';

function movePart(el: LyraReorderItem, part: string): HTMLElement {
  return el.shadowRoot!.querySelector<HTMLElement>(`[part~="${part}"]`)!;
}

function nativeControl(el: LyraReorderItem, part: string): HTMLButtonElement {
  return movePart(el, part).shadowRoot!.querySelector<HTMLButtonElement>('[part~="button"]')!;
}

function referenceTexts(el: LyraReorderItem, part: string): string[] {
  const control = nativeControl(el, part) as HTMLButtonElement & {
    ariaLabelledByElements?: readonly Element[] | null;
  };
  expect('ariaLabelledByElements' in control, 'native element references remain available').to.equal(true);
  return (control.ariaLabelledByElements ?? []).map((node) => (node.textContent ?? '').trim());
}

async function settleMoveControls(el: LyraReorderItem): Promise<void> {
  await el.updateComplete;
  for (const part of ['move-up-button', 'move-down-button']) {
    await (movePart(el, part) as LyraIconButton).updateComplete;
  }
}

describe('lr-reorder-item: localized move-control fallbacks', () => {
  it('provides specific English action fallbacks while preserving action and row references', async () => {
    const el = await fixture<LyraReorderItem>(html`<lr-reorder-item value="row">Row</lr-reorder-item>`);
    await settleMoveControls(el);
    expect(nativeControl(el, 'move-up-button').getAttribute('aria-label')).to.equal('Move up');
    expect(nativeControl(el, 'move-down-button').getAttribute('aria-label')).to.equal('Move down');
    expect(referenceTexts(el, 'move-up-button')).to.deep.equal(['Move up', 'Row']);
    expect(referenceTexts(el, 'move-down-button')).to.deep.equal(['Move down', 'Row']);
  });

  it('updates both disabled native fallbacks from strings without losing full row references', async () => {
    const el = await fixture<LyraReorderItem>(html`<lr-reorder-item value="row" disabled>Row</lr-reorder-item>`);
    el.strings = { moveUp: 'Monter', moveDown: 'Descendre' };
    await settleMoveControls(el);
    for (const [part, label] of [['move-up-button', 'Monter'], ['move-down-button', 'Descendre']] as const) {
      expect(nativeControl(el, part).disabled).to.equal(true);
      expect(nativeControl(el, part).getAttribute('aria-label')).to.equal(label);
      expect(referenceTexts(el, part)).to.deep.equal([label, 'Row']);
    }
    el.strings = { moveUp: 'Vers le haut', moveDown: 'Vers le bas' };
    await settleMoveControls(el);
    expect(nativeControl(el, 'move-up-button').getAttribute('aria-label')).to.equal('Vers le haut');
    expect(nativeControl(el, 'move-down-button').getAttribute('aria-label')).to.equal('Vers le bas');
    expect(referenceTexts(el, 'move-up-button')).to.deep.equal(['Vers le haut', 'Row']);
    expect(referenceTexts(el, 'move-down-button')).to.deep.equal(['Vers le bas', 'Row']);
  });

  it('follows a live registered locale and keeps row text and explicit row labels in references', async () => {
    registerLyraLocale('fr-x-reorder-fallback', {
      moveUp: 'Monter la ligne', moveDown: 'Descendre la ligne', iconButtonLabel: 'Bouton',
    });
    const el = await fixture<LyraReorderItem>(html`<lr-reorder-item value="row">Row</lr-reorder-item>`);
    el.lang = 'fr-x-reorder-fallback';
    await waitUntil(() => nativeControl(el, 'move-up-button').getAttribute('aria-label') === 'Monter la ligne');
    await settleMoveControls(el);
    expect(nativeControl(el, 'move-down-button').getAttribute('aria-label')).to.equal('Descendre la ligne');
    el.textContent = 'Live row';
    await waitUntil(() => referenceTexts(el, 'move-up-button')[1] === 'Live row');
    expect(referenceTexts(el, 'move-down-button')).to.deep.equal(['Descendre la ligne', 'Live row']);
    el.ariaLabel = 'Explicit row';
    await settleMoveControls(el);
    expect(referenceTexts(el, 'move-up-button')).to.deep.equal(['Monter la ligne', 'Explicit row']);
    expect(referenceTexts(el, 'move-down-button')).to.deep.equal(['Descendre la ligne', 'Explicit row']);
    expect(nativeControl(el, 'move-up-button').getAttribute('aria-label')).to.equal('Monter la ligne');
  });

  it('preserves an explicit icon-button fallback without replacing the full row references', async () => {
    const el = await fixture<LyraReorderItem>(html`<lr-reorder-item value="row">Row</lr-reorder-item>`);
    const up = movePart(el, 'move-up-button') as LyraIconButton;
    up.accessibleLabel = 'Caller fallback';
    el.strings = { moveUp: 'Monter', moveDown: 'Descendre' };
    await settleMoveControls(el);
    expect(nativeControl(el, 'move-up-button').getAttribute('aria-label')).to.equal('Caller fallback');
    expect(referenceTexts(el, 'move-up-button')).to.deep.equal(['Monter', 'Row']);
    expect(nativeControl(el, 'move-down-button').getAttribute('aria-label')).to.equal('Descendre');
    expect(referenceTexts(el, 'move-down-button')).to.deep.equal(['Descendre', 'Row']);
  });
});

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

  it('forwards each native control under its hyphenated name without its removed __ alias', async () => {
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
    expect(getComputedStyle(nativeControl(el, 'move-down-button')).outlineColor).to.not.equal('rgb(40, 50, 60)');
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

  it('ignores accessible-label and names both move actions from content', async () => {
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
    expect(labels).to.deep.equal(['Move up Row', 'Move up Row']);
    expect(warnings).to.have.length(0);
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
    expect(labelledText(el, 'move-up-button')).to.equal('Move up Row');
  });

  it('ignores a property-only accessibleLabel assignment', async () => {
    const el = (await fixture(html`<lr-reorder-item value="a">Row</lr-reorder-item>`)) as LyraReorderItem;
    (el as LyraReorderItem & { accessibleLabel?: string }).accessibleLabel = 'Assigned';
    await el.updateComplete;
    expect(labelledText(el, 'move-up-button')).to.equal('Move up Row');
  });
});
