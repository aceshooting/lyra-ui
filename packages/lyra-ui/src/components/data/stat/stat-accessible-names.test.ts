import { expect, fixture, html } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './stat.js';
import type { LyraStat } from './stat.js';

async function expectValidNames(stat: LyraStat): Promise<void> {
  await expect(stat).to.be.accessible();
  const axe = (window as Window & { axe?: typeof import('axe-core') }).axe;
  if (!axe) throw new Error('The accessibility scan must load axe before the naming audit.');
  const audit = await axe.run(stat, { runOnly: ['aria-prohibited-attr'] });
  expect(audit.violations.map((result) => result.id)).to.deep.equal([]);
  // Visible text can turn prohibited naming into a needs-review result instead of a violation.
  expect(audit.incomplete.map((result) => result.id)).to.deep.equal([]);
}

for (const linked of [false, true]) {
  it(`gives populated ${linked ? 'linked' : 'unlinked'} metric values nameable semantics`, async () => {
    const stat = await fixture<LyraStat>(html`<lr-stat
      label="Latency" value="42" unit="ms" exact-value="42.03 ms"
      .href=${linked ? '/metrics' : ''}
      .rows=${[
        { label: 'First response', value: '12', exactValue: '12.04 ms' },
        { label: 'Next response', value: '30' },
      ]}
    ></lr-stat>`);
    expect(stat.shadowRoot!.querySelectorAll('[part="row-value"]').length).to.equal(2);
    await expectValidNames(stat);
    const value = stat.shadowRoot!.querySelector<HTMLElement>('[part="value"]')!;
    expect(value.getAttribute('role')).to.equal('definition');
    expect(stat.shadowRoot!.querySelector('[part="label"]')!.getAttribute('role')).to.equal('term');
    expect(value.getAttribute('title')).to.equal('42.03 ms');
    expect(value.getAttribute('tabindex')).to.equal(linked ? null : '0');
    const rowValues = Array.from(stat.shadowRoot!.querySelectorAll<HTMLElement>('[part="row-value"]'));
    expect(rowValues.map((row) => row.getAttribute('role'))).to.deep.equal(['definition', 'definition']);
    expect(rowValues.map((row) => row.getAttribute('tabindex'))).to.deep.equal([linked ? null : '0', null]);
    expect(Array.from(stat.shadowRoot!.querySelectorAll('[part="row-label"]'), (label) => label.getAttribute('role')))
      .to.deep.equal(['term', 'term']);
    const target = linked ? stat.shadowRoot!.querySelector<HTMLElement>('[part="base"]')! : value;
    await focusByKeyboard(target);
    expect(stat.shadowRoot!.activeElement === target).to.equal(true);
  });
}

it('names a unit-only value without inventing an absent metric term', async () => {
  const stat = await fixture<LyraStat>(html`<lr-stat value="42" unit="ms" exact-value="42.03 ms"></lr-stat>`);
  await expectValidNames(stat);
  const value = stat.shadowRoot!.querySelector('[part="value"]')!;
  expect(value.getAttribute('role')).to.equal('definition');
  expect(value.getAttribute('aria-labelledby')!.split(' ').map((id) => stat.shadowRoot!.getElementById(id)!.textContent).join(' '))
    .to.equal('42 ms');
  expect(stat.shadowRoot!.querySelector('[part="label"]')!.hasAttribute('role')).to.equal(false);
});

it('keeps unnamed values plain and updates semantics when labels appear or disappear', async () => {
  const stat = await fixture<LyraStat>(html`<lr-stat value="42" exact-value="42.03"
    .rows=${[{ label: '', value: '10', exactValue: '10.02' }]}
  ></lr-stat>`);
  const value = stat.shadowRoot!.querySelector('[part="value"]')!;
  const row = stat.shadowRoot!.querySelector('[part="row-value"]')!;
  expect(value.hasAttribute('role')).to.equal(false);
  expect(value.hasAttribute('aria-labelledby')).to.equal(false);
  expect(row.hasAttribute('role')).to.equal(false);
  expect(row.hasAttribute('aria-labelledby')).to.equal(false);
  expect(value.getAttribute('title')).to.equal('42.03');
  await expectValidNames(stat);
  stat.label = 'Latency';
  stat.rows = [{ label: 'Response', value: '10', exactValue: '10.02' }];
  await stat.updateComplete;
  await expectValidNames(stat);
  expect(value.getAttribute('role')).to.equal('definition');
  expect(row.getAttribute('role')).to.equal('definition');
  stat.label = '';
  stat.rows = [{ label: '', value: '10', exactValue: '10.02' }];
  await stat.updateComplete;
  expect(value.hasAttribute('role')).to.equal(false);
  expect(row.hasAttribute('role')).to.equal(false);
  await expectValidNames(stat);
});
