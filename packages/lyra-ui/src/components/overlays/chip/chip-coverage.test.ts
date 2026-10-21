import { fixture, expect, html } from '@open-wc/testing';
import './chip.js';
import type { LyraChip } from './chip.js';

/** Re-projects its light DOM into a removable chip living in its own shadow root, so the chip's
 *  label sources are slot-forwarded nodes that the chip itself does not contain. */
class ChipCoverageForwarder extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const chip = this.ownerDocument.createElement('lr-chip');
    chip.setAttribute('removable', '');
    chip.append(this.ownerDocument.createElement('slot'));
    root.append(chip);
  }
}
customElements.define('chip-coverage-forwarder', ChipCoverageForwarder);

async function mountForwarded(markup: ReturnType<typeof html>): Promise<{ wrapper: HTMLElement; chip: LyraChip; remove: HTMLElement }> {
  const outer = (await fixture(markup)) as HTMLElement;
  const wrapper = outer.localName === 'chip-coverage-forwarder' ? outer : outer.querySelector<HTMLElement>('chip-coverage-forwarder')!;
  const chip = wrapper.shadowRoot!.querySelector('lr-chip') as LyraChip;
  await chip.updateComplete;
  const remove = chip.shadowRoot!.querySelector<HTMLElement>('[part="remove-button"]')!;
  return { wrapper, chip, remove };
}

describe('lr-chip derived action name from slot-forwarded source content', () => {
  it('names the action from a closed details summary only, and from the body once opened', async () => {
    const { wrapper, chip, remove } = await mountForwarded(html`
      <chip-coverage-forwarder>
        <details>
          <summary>Visible summary</summary>
          <span>Hidden body</span>
        </details>
      </chip-coverage-forwarder>
    `);
    expect(remove.getAttribute('aria-label')).to.equal('Remove Visible summary');

    wrapper.querySelector('details')!.open = true;
    await Promise.resolve();
    await chip.updateComplete;
    expect(remove.getAttribute('aria-label')).to.equal('Remove Visible summary Hidden body');
  });

  it('ignores forwarded text under an aria-hidden ancestor outside the chip', async () => {
    const { remove } = await mountForwarded(html`
      <chip-coverage-forwarder>
        <span>Shown</span>
        <div aria-hidden="true"><span>Concealed</span></div>
      </chip-coverage-forwarder>
    `);
    expect(remove.getAttribute('aria-label')).to.equal('Remove Shown');
  });

  it('ignores forwarded text whose forwarding element sits under an aria-hidden ancestor', async () => {
    const { remove } = await mountForwarded(html`
      <div aria-hidden="true"><chip-coverage-forwarder><span>Behind</span></chip-coverage-forwarder></div>
    `);
    expect(remove.getAttribute('aria-label')).to.not.contain('Behind');
  });

  it('ignores forwarded text whose forwarding element sits in the closed body of a details element', async () => {
    const { remove } = await mountForwarded(html`
      <details><summary>Toggle</summary><chip-coverage-forwarder><span>Folded</span></chip-coverage-forwarder></details>
    `);
    expect(remove.getAttribute('aria-label')).to.not.contain('Folded');
  });
});
