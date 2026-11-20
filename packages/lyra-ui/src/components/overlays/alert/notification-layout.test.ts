import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-alert.js';
import '../../lr-callout.js';
import '../../lr-dialog.js';
import '../../lr-drawer.js';
import '../../lr-spinner.js';
import '../../lr-chip-group.js';
import '../../lr-kbd.js';
import '../../lr-empty.js';
import '../../lr-toast-item.js';

for (const name of ['alert', 'callout'] as const) {
  it(`uses the full message row of an iconless, non-closable ${name}`, async () => {
    const el = await fixture<HTMLElement>(name === 'alert'
      ? html`<lr-alert open>Notice</lr-alert>` : html`<lr-callout>Notice</lr-callout>`);
    const root = el.shadowRoot!;
    const base = root.querySelector('[part="base"]')!;
    const text = root.querySelector('[part="message"]')!;
    const style = getComputedStyle(base);
    const rect = base.getBoundingClientRect();
    expect(text.getBoundingClientRect().left - rect.left)
      .to.be.closeTo(parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth), 1);
    expect(rect.right - text.getBoundingClientRect().right)
      .to.be.closeTo(parseFloat(style.paddingRight) + parseFloat(style.borderRightWidth), 1);
  });
}

for (const name of ['dialog', 'drawer'] as const) {
  it(`wraps a long ${name} title inside its allocated width`, async () => {
    const title = 'A long title '.repeat(18);
    const el = await fixture<HTMLElement>(name === 'dialog'
      ? html`<lr-dialog open label=${title} style="--lr-dialog-width:240px">Body</lr-dialog>`
      : html`<lr-drawer open label=${title} style="--size:240px">Body</lr-drawer>`);
    const heading = el.shadowRoot!.querySelector<HTMLElement>('[part~="heading"]')!;
    expect(heading.scrollWidth).to.be.at.most(heading.clientWidth + 1);
    expect(heading.getBoundingClientRect().height).to.be.greaterThan(parseFloat(getComputedStyle(heading).fontSize) * 2);
  });
}

for (const [name, template, part, token, property] of [
  ['spinner track', html`<lr-spinner></lr-spinner>`, 'spinner-indicator', '--lr-spinner-track-color', 'borderBottomColor'],
  ['spinner indicator', html`<lr-spinner></lr-spinner>`, 'spinner-indicator', '--lr-spinner-indicator-color', 'borderTopColor'],
  ['chip-group', html`<lr-chip-group max-visible="1"><span>A</span><span>B</span></lr-chip-group>`, 'overflow-indicator', '--lr-chip-group-overflow-bg', 'backgroundColor'],
  ['kbd', html`<lr-kbd keys="K"></lr-kbd>`, 'key', '--lr-kbd-key-bg', 'backgroundColor'],
  ['alert', html`<lr-alert open>Notice</lr-alert>`, 'base', '--lr-alert-bg', 'backgroundColor'],
] as const) {
  it(`paints the ${name} from its component token`, async () => {
    const el = await fixture<HTMLElement>(template);
    el.style.setProperty(token, 'rgb(14, 27, 82)');
    const target = el.shadowRoot!.querySelector<HTMLElement>(`[part~="${part}"]`)!;
    expect(getComputedStyle(target)[property]).to.equal('rgb(14, 27, 82)');
  });
}

for (const [name, template, target] of [
  ['alert', html`<lr-alert open closable>Notice</lr-alert>`, 'close-button'],
  ['toast', html`<lr-toast-item duration="0">Notice</lr-toast-item>`, 'close-button'],
] as const) {
  it(`applies shared icon action paint to the ${name} close control`, async () => {
    const el = await fixture<HTMLElement>(template);
    el.style.setProperty('--lr-icon-button-bg', 'rgb(24, 49, 83)');
    const button = el.shadowRoot!.querySelector<HTMLElement>(`[part~="${target}"]`)!;
    expect(getComputedStyle(button).backgroundColor).to.equal('rgb(24, 49, 83)');
  });
}

it('supports every alert appearance while keeping the default treatment', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-alert']>(html`<lr-alert open variant="danger">Notice</lr-alert>`);
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  const paint = () => [getComputedStyle(base).backgroundColor, getComputedStyle(base).borderTopColor];
  const initial = paint();
  const transparent = 'rgba(0, 0, 0, 0)';
  expect(initial[0]).to.not.equal(transparent);
  expect(initial[1]).to.not.equal(transparent);
  for (const appearance of ['accent', 'filled', 'outlined', 'plain', 'filled-outlined'] as const) {
    el.setAttribute('appearance', appearance);
    await el.updateComplete;
    const [bg, border] = paint();
    expect(bg === transparent).to.equal(appearance === 'outlined' || appearance === 'plain');
    expect(border === transparent).to.equal(appearance === 'filled' || appearance === 'plain');
    if (appearance === 'accent') expect(bg).to.not.equal(initial[0]);
    if (appearance === 'filled-outlined') expect(paint()).to.deep.equal(initial);
  }
});

for (const [name, template, part] of [
  ['alert', html`<lr-alert open><span data-word>Notification</span><table style="width:600px"><tr><td>Details</td></tr></table></lr-alert>`, 'message'],
  ['empty', html`<lr-empty><span slot="heading" data-word>Notification</span><table slot="description" style="width:600px"><tr><td>Details</td></tr></table></lr-empty>`, 'heading'],
  ['kbd', html`<lr-kbd keys="Notification"></lr-kbd>`, 'key'],
  ['toast', html`<lr-toast-item duration="0"><span data-word>Notification</span><table style="width:600px"><tr><td>Details</td></tr></table></lr-toast-item>`, 'content'],
] as const) {
  it(`keeps a whole word readable in the space allocated to ${name}`, async () => {
    const row = await fixture<HTMLDivElement>(html`<div style="display:flex;width:440px">
      <div style="flex:0 0 200px"></div><div style="flex:1;min-width:0">${template}</div>
    </div>`);
    const el = row.lastElementChild!.firstElementChild! as HTMLElement;
    const content = el.shadowRoot!.querySelector<HTMLElement>(`[part~="${part}"]`)!;
    if (name === 'toast') await waitUntil(() => content.getBoundingClientRect().width > 0);
    const word = document.createRange();
    word.selectNodeContents(el.querySelector('[data-word]') ?? content);
    const fragments = Array.from(word.getClientRects()).filter(rect => rect.width > 0);
    expect(fragments.length).to.equal(1);
    expect(fragments[0]!.right).to.be.at.most(row.getBoundingClientRect().right + 1);
    expect(content.getBoundingClientRect().width).to.be.greaterThan(60);
    expect(content.getBoundingClientRect().right).to.be.at.most(row.getBoundingClientRect().right + 1);
  });
}

it('themes each alert panel edge and ink independently of its appearance', async () => {
  const el = await fixture<HTMLElement>(html`<lr-alert open appearance="accent" style="
    --lr-alert-bg:rgb(12, 13, 14);--lr-alert-color:rgb(220, 221, 222);
    --lr-alert-border:rgb(30, 40, 50);--lr-alert-radius:13px;
    --lr-alert-shadow:rgb(0, 0, 0) 0px 0px 3px">Saved</lr-alert>`);
  const panel = getComputedStyle(el.shadowRoot!.querySelector('[part="base"]')!);
  expect(panel.backgroundColor).to.equal('rgb(12, 13, 14)');
  expect(panel.color).to.equal('rgb(220, 221, 222)');
  expect(panel.borderTopColor).to.equal('rgb(30, 40, 50)');
  expect(panel.borderTopLeftRadius).to.equal('13px');
  expect(panel.boxShadow).to.equal('rgb(0, 0, 0) 0px 0px 3px 0px');
});

it('themes key cap and overflow-indicator edges and text', async () => {
  const host = await fixture<HTMLElement>(html`<div style="--lr-kbd-key-border-color:rgb(12, 13, 14);
    --lr-kbd-key-color:rgb(25, 26, 27);--lr-chip-group-overflow-border-color:rgb(12, 13, 14);
    --lr-chip-group-overflow-color:rgb(25, 26, 27)">
    <lr-kbd keys="K"></lr-kbd><lr-chip-group max-visible="1"><span>A</span><span>B</span></lr-chip-group></div>`);
  for (const [name, part] of [['lr-kbd', 'key'], ['lr-chip-group', 'overflow-indicator']] as const) {
    const style = getComputedStyle(host.querySelector(name)!.shadowRoot!.querySelector(`[part~="${part}"]`)!);
    expect(style.color).to.equal('rgb(25, 26, 27)');
    expect(style.borderTopColor).to.equal('rgb(12, 13, 14)');
  }
});
