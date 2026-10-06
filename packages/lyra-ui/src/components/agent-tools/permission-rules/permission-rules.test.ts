import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './permission-rules.js';
import type { LyraPermissionRules, PermissionRule } from './permission-rules.class.js';

const rules: PermissionRule[] = [
  { id: 'read', label: 'Read records', description: 'Read account data', scope: 'accounts:read', decision: 'ask' },
  { id: 'write', label: 'Update records', scope: 'accounts:write', decision: 'deny' },
];

describe('lr-permission-rules', () => {
  it('renders each rule and scope with its controlled decision', async () => {
    const el = await fixture<LyraPermissionRules>(html`<lr-permission-rules .rules=${rules}></lr-permission-rules>`);
    const selects = [...el.shadowRoot!.querySelectorAll<HTMLSelectElement>('[part="decision"]')];
    expect(selects.map((select) => select.value)).to.deep.equal(['ask', 'deny']);
    expect(el.shadowRoot!.querySelectorAll('[part="rule"]')).to.have.lengthOf(2);
    expect(el.shadowRoot!.textContent).to.contain('accounts:read');
  });

  it('emits a correlated controlled decision and restores the supplied value', async () => {
    const el = await fixture<LyraPermissionRules>(html`<lr-permission-rules .rules=${rules}></lr-permission-rules>`);
    const select = el.shadowRoot!.querySelector<HTMLSelectElement>('[part="decision"]')!;
    const changed = oneEvent(el, 'lr-permission-rule-change');
    select.value = 'allow';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect((await changed as CustomEvent).detail).to.deep.equal({ ruleId: 'read', decision: 'allow' });
    await el.updateComplete;
    expect(select.value).to.equal('ask');
  });

  it('normalizes duplicate and blank identities first-wins and honors the render ceiling', async () => {
    const many: PermissionRule[] = Array.from({ length: 102 }, (_, index) => ({
      id: `rule-${index}`,
      label: `Rule ${index}`,
      scope: `scope:${index}`,
      decision: 'ask',
    }));
    const input = [rules[0]!, { ...rules[0]!, label: 'duplicate should not win' }, { ...rules[1]!, id: '   ' }, ...many];
    const el = await fixture<LyraPermissionRules>(html`<lr-permission-rules .rules=${input}></lr-permission-rules>`);
    expect(el.shadowRoot!.querySelectorAll('[part="rule"]')).to.have.lengthOf(100);
    expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.contain('100');
    expect(el.shadowRoot!.querySelector('[part="rule"]')?.textContent).to.contain('Read records');
    expect(el.shadowRoot!.textContent).not.to.contain('duplicate should not win');
  });

  it('re-renders replaced and shrinking controlled data without stale rows', async () => {
    const el = await fixture<LyraPermissionRules>(html`<lr-permission-rules .rules=${rules}></lr-permission-rules>`);
    el.rules = [{ id: 'new', label: 'New rule', scope: 'new:scope', decision: 'allow' }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="rule"]')).to.have.lengthOf(1);
    expect(el.shadowRoot!.textContent).to.contain('New rule');
    expect(el.shadowRoot!.textContent).not.to.contain('Read records');
  });

  it('keeps an assigned array detached from later caller mutations', async () => {
    const source: PermissionRule[] = [{ ...rules[0]! }];
    const el = await fixture<LyraPermissionRules>(html`<lr-permission-rules .rules=${source}></lr-permission-rules>`);
    source[0]!.label = 'Mutated outside the component';
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).to.contain('Read records');
    expect(el.shadowRoot!.textContent).not.to.contain('Mutated outside the component');
  });

  it('disables decisions when disabled or readonly', async () => {
    const disabled = await fixture<LyraPermissionRules>(html`<lr-permission-rules disabled .rules=${rules}></lr-permission-rules>`);
    expect([...disabled.shadowRoot!.querySelectorAll<HTMLSelectElement>('[part="decision"]')].every((item) => item.disabled)).to.be.true;
    const readonly = await fixture<LyraPermissionRules>(html`<lr-permission-rules readonly .rules=${rules}></lr-permission-rules>`);
    expect([...readonly.shadowRoot!.querySelectorAll<HTMLSelectElement>('[part="decision"]')].every((item) => item.disabled)).to.be.true;
  });

  it('does not emit changes from a stale select after host readonly state is applied', async () => {
    const el = await fixture<LyraPermissionRules>(html`<lr-permission-rules .rules=${rules}></lr-permission-rules>`);
    let changes = 0;
    el.addEventListener('lr-permission-rule-change', () => changes++);
    const stale = el.shadowRoot!.querySelector<HTMLSelectElement>('[part="decision"]')!;
    el.readonly = true;
    await el.updateComplete;
    stale.value = 'allow';
    stale.dispatchEvent(new Event('change', { bubbles: true }));
    expect(changes).to.equal(0);
    expect(stale.value).to.equal('ask');
  });

  it('rejects removed and replaced rule identities before the next render', async () => {
    const el = await fixture<LyraPermissionRules>(html`<lr-permission-rules .rules=${rules}></lr-permission-rules>`);
    const stale = el.shadowRoot!.querySelector<HTMLSelectElement>('[part="decision"]')!;
    let changes = 0;
    el.addEventListener('lr-permission-rule-change', () => changes++);
    el.rules = [{ ...rules[0]!, scope: 'different:scope' }];
    stale.value = 'allow';
    stale.dispatchEvent(new Event('change', { bubbles: true }));
    expect(changes).to.equal(0);
    await el.updateComplete;
    const removed = el.shadowRoot!.querySelector<HTMLSelectElement>('[part="decision"]')!;
    el.rules = [];
    removed.value = 'allow';
    removed.dispatchEvent(new Event('change', { bubbles: true }));
    expect(changes).to.equal(0);
  });

  it('restores the latest host decision and blocks reentrant changes', async () => {
    const el = await fixture<LyraPermissionRules>(html`<lr-permission-rules .rules=${rules}></lr-permission-rules>`);
    const select = el.shadowRoot!.querySelector<HTMLSelectElement>('[part="decision"]')!;
    let changes = 0;
    el.addEventListener('lr-permission-rule-change', () => {
      changes++;
      if (changes === 1) {
        el.rules = [{ ...rules[0]!, decision: 'allow' }];
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    select.value = 'allow';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(changes).to.equal(1);
    expect(select.value).to.equal('allow');
    await el.updateComplete;
    expect(select.value).to.equal('allow');
  });

  it('follows a host acknowledgement that arrives after the change event returns', async () => {
    const el = await fixture<LyraPermissionRules>(html`<lr-permission-rules .rules=${rules}></lr-permission-rules>`);
    const select = el.shadowRoot!.querySelector<HTMLSelectElement>('[part="decision"]')!;
    el.addEventListener('lr-permission-rule-change', (event) => {
      const { ruleId, decision } = (event as CustomEvent<{ ruleId: string; decision: PermissionRule['decision'] }>).detail;
      // The host applies the change after the listener returns.
      void Promise.resolve().then(() => {
        el.rules = el.rules.map((rule) => (rule.id === ruleId ? { ...rule, decision } : rule));
      });
    });
    select.value = 'allow';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(select.value).to.equal('ask');
    await Promise.resolve();
    await el.updateComplete;
    expect(select.value).to.equal('allow');
    select.value = 'deny';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();
    await el.updateComplete;
    expect(select.value).to.equal('deny');
  });

  it('keeps each decision select bound to its own rule when the host reorders rules', async () => {
    const el = await fixture<LyraPermissionRules>(html`<lr-permission-rules .rules=${rules}></lr-permission-rules>`);
    const readSelect = el.shadowRoot!.querySelector<HTMLSelectElement>('[part="decision"]')!;
    const readLabel = readSelect.getAttribute('aria-label');
    el.rules = [rules[1]!, rules[0]!];
    await el.updateComplete;
    expect(readSelect.getAttribute('aria-label')).to.equal(readLabel);
    expect(readSelect.value).to.equal('ask');
  });

  it('uses host aria-label on the semantic group and allows a strings override', async () => {
    const el = await fixture<LyraPermissionRules>(html`
      <lr-permission-rules aria-label="Workspace rules" .strings=${{ permissionRulesLabel: 'Access rules' }} .rules=${rules}></lr-permission-rules>
    `);
    expect(el.shadowRoot!.querySelector('fieldset')?.getAttribute('aria-label')).to.equal('Workspace rules');
    expect(el.shadowRoot!.querySelector('legend')?.textContent).to.equal('Access rules');
  });

  it('restores the localized label when its attribute is removed', async () => {
    const el = await fixture<LyraPermissionRules>(html`<lr-permission-rules label="Custom" .strings=${{ permissionRulesLabel: 'Access rules' }}></lr-permission-rules>`);
    el.removeAttribute('label');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('legend')?.textContent).to.equal('Access rules');
  });

  it('is accessible in empty and populated states, including narrow long-content layout', async () => {
    const empty = await fixture<LyraPermissionRules>(html`<lr-permission-rules></lr-permission-rules>`);
    await expect(empty).to.be.accessible();
    const populated = await fixture<LyraPermissionRules>(html`
      <lr-permission-rules dir="rtl" style="inline-size: 320px" .rules=${[
        { id: 'long', label: 'A very long unbroken permission label '.repeat(4), description: 'Long description '.repeat(20), scope: 'resource:'.repeat(14), decision: 'ask' as const },
      ]}></lr-permission-rules>
    `);
    await expect(populated).to.be.accessible();
    expect(getComputedStyle(populated.shadowRoot!.querySelector('[part="rule-label"]')!).overflowWrap).to.equal('anywhere');
    const hostWidth = populated.getBoundingClientRect().width;
    const fieldset = populated.shadowRoot!.querySelector('[part="base"]')!;
    expect(fieldset.getBoundingClientRect().width).to.be.at.most(hostWidth);
    expect(fieldset.scrollWidth).to.be.at.most(fieldset.clientWidth);
    const hostRect = populated.getBoundingClientRect();
    const row = populated.shadowRoot!.querySelector('[part="rule"]')!.getBoundingClientRect();
    const copy = populated.shadowRoot!.querySelector('[part="rule-copy"]')!.getBoundingClientRect();
    const decision = populated.shadowRoot!.querySelector('[part="decision"]')!.getBoundingClientRect();
    expect(populated.scrollWidth).to.be.at.most(populated.clientWidth);
    expect(row.left).to.be.at.least(hostRect.left - 1);
    expect(row.right).to.be.at.most(hostRect.right + 1);
    expect(copy.left).to.be.at.least(decision.right - 1);
    expect(copy.right).to.be.at.most(hostRect.right + 1);
    expect(getComputedStyle(populated.shadowRoot!.querySelector('[part="rule"]')!).direction).to.equal('rtl');
  });
});
