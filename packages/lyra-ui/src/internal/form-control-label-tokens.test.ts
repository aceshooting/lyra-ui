import { expect, fixture, html } from '@open-wc/testing';
import '../components/lr-input.js';
import '../components/lr-select.js';
import '../components/lr-time-input.js';
import '../components/lr-checkbox-group.js';

const label = (el: Element): CSSStyleDeclaration =>
  getComputedStyle(el.shadowRoot!.querySelector('[part~="form-control-label"]')!);

describe('form-control label tokens', () => {
  it('--lr-form-control-label-gap sets the label-to-field gap above the field', async () => {
    const wrap = await fixture<HTMLElement>(html`<div>
      <lr-input label="A"></lr-input><lr-select label="A"></lr-select><lr-time-input label="A"></lr-time-input>
      <div style="--lr-form-control-label-gap: 13px">
        <lr-input label="A"></lr-input><lr-select label="A"></lr-select><lr-time-input label="A"></lr-time-input>
      </div>
      <div style="--lr-form-control-label-block-gap: 13px">
        <lr-input label="A"></lr-input><lr-select label="A"></lr-select><lr-time-input label="A"></lr-time-input>
      </div>
    </div>`);
    const [plainInput, plainSelect, plainTime, input, select, time, oldInput, oldSelect, oldTime] = Array.from(
      wrap.querySelectorAll('lr-input, lr-select, lr-time-input'),
    );
    expect([plainInput, plainSelect, plainTime].map((el) => label(el!).marginBlockEnd)).to.deep.equal(['4px', '4px', '4px']);
    expect([input, select, time].map((el) => label(el!).marginBlockEnd)).to.deep.equal(['13px', '13px', '13px']);
    expect([oldInput, oldSelect, oldTime].map((el) => label(el!).marginBlockEnd), 'the removed block-gap token is not read')
      .to.deep.equal(['4px', '4px', '4px']);
  });

  it('one --lr-form-control-label-gap spaces a wide start column, a collapsed start row and a top label', async () => {
    const wrap = await fixture<HTMLElement>(html`<div style="--lr-form-control-label-gap: 13px">
      <lr-input style="inline-size: 200px" label-placement="start" label="A"></lr-input>
      <lr-input style="inline-size: 600px" label-placement="start" label="A"></lr-input>
    </div>`);
    const [narrow, wide] = Array.from(wrap.querySelectorAll('lr-input'));
    expect([label(narrow!).marginBlockEnd, label(wide!).marginBlockEnd]).to.deep.equal(['13px', '0px']);
    const control = getComputedStyle(wide!.shadowRoot!.querySelector('[part~="form-control"]')!);
    expect(control.columnGap).to.equal('13px');
  });

  it('--lr-form-control-label-text-align and -text-transform style the label, inheriting when unset', async () => {
    const wrap = await fixture<HTMLElement>(html`<div>
      <lr-input label="A"></lr-input><lr-checkbox-group label="A"></lr-checkbox-group>
      <div style="--lr-form-control-label-text-align: end; --lr-form-control-label-text-transform: uppercase">
        <lr-input label="A"></lr-input><lr-checkbox-group label="A"></lr-checkbox-group>
      </div>
    </div>`);
    const [plainInput, plainGroup, input, group] = Array.from(wrap.querySelectorAll('lr-input, lr-checkbox-group'));
    for (const el of [plainInput, plainGroup]) {
      expect([label(el!).textAlign, label(el!).textTransform]).to.deep.equal(['start', 'none']);
    }
    for (const el of [input, group]) {
      expect([label(el!).textAlign, label(el!).textTransform]).to.deep.equal(['end', 'uppercase']);
    }
  });
});
