import { expect, fixture, html } from '@open-wc/testing';
import '../components/lr-input.js';
import '../components/lr-select.js';
import '../components/lr-time-input.js';
import '../components/lr-checkbox-group.js';

const label = (el: Element): CSSStyleDeclaration =>
  getComputedStyle(el.shadowRoot!.querySelector('[part~="form-control-label"]')!);

describe('form-control label tokens', () => {
  it('--lr-form-control-label-block-gap sets the label-to-field gap above the field', async () => {
    const wrap = await fixture<HTMLElement>(html`<div>
      <lr-input label="A"></lr-input><lr-select label="A"></lr-select><lr-time-input label="A"></lr-time-input>
      <div style="--lr-form-control-label-block-gap: 13px">
        <lr-input label="A"></lr-input><lr-select label="A"></lr-select><lr-time-input label="A"></lr-time-input>
      </div>
    </div>`);
    const [plainInput, plainSelect, plainTime, input, select, time] = Array.from(
      wrap.querySelectorAll('lr-input, lr-select, lr-time-input'),
    );
    expect([plainInput, plainSelect, plainTime].map((el) => label(el!).marginBlockEnd)).to.deep.equal(['4px', '4px', '4px']);
    expect([input, select, time].map((el) => label(el!).marginBlockEnd)).to.deep.equal(['13px', '13px', '13px']);
  });

  it('a collapsed start placement takes the block gap, a wide one keeps none', async () => {
    const wrap = await fixture<HTMLElement>(html`<div style="--lr-form-control-label-block-gap: 13px">
      <lr-input style="inline-size: 200px" label-placement="start" label="A"></lr-input>
      <lr-input style="inline-size: 600px" label-placement="start" label="A"></lr-input>
    </div>`);
    const [narrow, wide] = Array.from(wrap.querySelectorAll('lr-input'));
    expect([label(narrow!).marginBlockEnd, label(wide!).marginBlockEnd]).to.deep.equal(['13px', '0px']);
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
