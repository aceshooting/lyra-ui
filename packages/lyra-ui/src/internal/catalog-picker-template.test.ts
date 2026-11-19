import { expect, fixture, html as fixtureHtml } from '@open-wc/testing';
import { LitElement, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { catalogControlName, renderCatalogInput, renderCatalogLabel } from './catalog-picker-template.js';
import { InputLimitAnnouncement } from './input-limit-announcement.js';

class CatalogInputHost extends LitElement {
  @property() label = '';
  @property() placeholder = '';
  @property() autocomplete = 'off';
  @property({ type: Boolean }) override spellcheck = true;
  @property() override autocapitalize = '';
  @property({ type: Boolean }) override autocorrect = true;
  @property({ attribute: 'inputmode' }) override inputMode = '';
  @property({ attribute: 'enterkeyhint' }) override enterKeyHint = '';
  @property({ type: Boolean }) readonly = false;
  @property({ type: Boolean }) required = false;
  @property({ type: Boolean }) effectiveDisabled = false;
  @property({ type: Boolean }) open = false;
  @property({ type: Boolean }) invalid = false;
  @property({ type: Boolean }) limited = false;
  events: string[] = [];
  announced = 0;
  readonly limit = new InputLimitAnnouncement(this, { limited: () => this.limited, announce: () => { this.announced += 1; } });

  protected override render() {
    return html`${renderCatalogLabel('field', this.label, this.label.length > 0)}${renderCatalogInput({
      host: this,
      id: 'field',
      listId: 'list',
      activeId: this.open ? 'list-opt-0' : '',
      open: this.open,
      value: this.open ? 'query' : 'Committed',
      name: catalogControlName(this, this.label.length > 0, this.placeholder, 'Model'),
      describedBy: this.invalid ? 'p-error p-hint' : undefined,
      invalid: this.invalid,
      onInput: () => { this.events.push('input'); },
      onKeyDown: () => { this.events.push('keydown'); },
      onFocus: () => { this.events.push('focus'); },
      onBlur: () => { this.events.push('blur'); },
    })}<div id="list"></div>`;
  }
}
customElements.define('h3c-catalog-input-host', CatalogInputHost);

const input = (el: CatalogInputHost) => el.renderRoot.querySelector('input')!;
const attrs = (el: CatalogInputHost, names: string[]) => names.map(name => input(el).getAttribute(name));

describe('catalog picker templates', () => {
  it('renders the free-text combobox input with defaults omitted and state forwarded', async () => {
    const el = await fixture<CatalogInputHost>(fixtureHtml`<h3c-catalog-input-host></h3c-catalog-input-host>`);
    const names = ['role', 'aria-label', 'aria-expanded', 'aria-controls', 'aria-activedescendant', 'aria-autocomplete',
      'aria-describedby', 'aria-required', 'aria-readonly', 'aria-invalid', 'autocomplete', 'spellcheck', 'autocapitalize',
      'autocorrect', 'inputmode', 'enterkeyhint', 'placeholder'];
    expect(attrs(el, names)).to.deep.equal(['combobox', 'Model', 'false', 'list', '', 'list', null, 'false', 'false', 'false',
      'off', 'true', null, null, null, null, '']);
    expect([input(el).value, input(el).readOnly, input(el).disabled]).to.deep.equal(['Committed', false, false]);
    expect(el.renderRoot.querySelector('label')!.hidden).to.equal(true);
    Object.assign(el, {
      label: 'Model id', placeholder: 'Pick', autocomplete: '', spellcheck: false, autocapitalize: 'words', autocorrect: false,
      inputMode: 'search', enterKeyHint: 'go', readonly: true, required: true, effectiveDisabled: true, open: true, invalid: true,
    });
    await el.updateComplete;
    expect(attrs(el, names)).to.deep.equal(['combobox', null, 'true', 'list', 'list-opt-0', 'list', 'p-error p-hint', 'true', 'true', 'true',
      null, 'false', 'words', 'off', 'search', 'go', 'Pick']);
    expect([input(el).value, input(el).readOnly, input(el).disabled]).to.deep.equal(['query', true, true]);
    const label = el.renderRoot.querySelector('label')!;
    expect([label.hidden, label.htmlFor, label.textContent?.trim()]).to.deep.equal([false, 'field', 'Model id']);
  });

  it('names the control from the host aria-label first, then the placeholder, then the fallback', async () => {
    const el = await fixture<CatalogInputHost>(fixtureHtml`<h3c-catalog-input-host placeholder="Type a model"></h3c-catalog-input-host>`);
    expect(input(el).getAttribute('aria-label')).to.equal('Type a model');
    el.setAttribute('aria-label', 'Chat model');
    el.requestUpdate();
    await el.updateComplete;
    expect(input(el).getAttribute('aria-label')).to.equal('Chat model');
    expect(catalogControlName(el, true, '', 'Model'), 'host label wins over a visible one').to.equal('Chat model');
    el.removeAttribute('aria-label');
    expect(catalogControlName(el, true, 'Pick', 'Model') === nothing).to.equal(true);
  });

  it('forwards the editing events to the supplied handlers', async () => {
    const el = await fixture<CatalogInputHost>(fixtureHtml`<h3c-catalog-input-host></h3c-catalog-input-host>`);
    for (const type of ['input', 'keydown', 'focus', 'blur']) input(el).dispatchEvent(new Event(type));
    expect(el.events).to.deep.equal(['input', 'keydown', 'focus', 'blur']);
  });
});

describe('InputLimitAnnouncement', () => {
  it('announces only rendered transitions into truncation after mount', async () => {
    const el = await fixture<CatalogInputHost>(fixtureHtml`<h3c-catalog-input-host limited></h3c-catalog-input-host>`);
    expect(el.announced, 'mounted truncated').to.equal(0);
    el.requestUpdate();
    await el.updateComplete;
    expect(el.announced, 'stays truncated').to.equal(0);
    el.limited = false;
    await el.updateComplete;
    el.limited = true;
    await el.updateComplete;
    expect(el.announced).to.equal(1);
  });
});
