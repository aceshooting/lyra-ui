import { expect, fixture, html } from '@open-wc/testing';
import { highlightToneStyles } from './text-highlight.styles.js';

const tokens = '--lr-color-brand-quiet: rgb(1, 1, 1); --lr-color-success-quiet: rgb(2, 2, 2); --lr-color-warning-quiet: rgb(3, 3, 3); --lr-color-danger-quiet: rgb(4, 4, 4); --lr-color-surface-raised: rgb(5, 5, 5); --lr-color-brand: rgb(6, 6, 6); --lr-color-mix-partner: rgb(255, 255, 255); --lr-color-mix-hover: 50%; --lr-color-mix-active: 50%; --lr-border-width-thin: 1px;';

async function mount(css: string) {
  return fixture<HTMLDivElement>(html`<div style=${tokens}>
    <style>${css}</style>
    <div part="content">
      <mark id="accent" data-lr-highlight-tone="accent">a</mark>
      <mark id="success" data-lr-highlight-tone="success">b</mark>
      <mark id="warning" data-lr-highlight-tone="warning">c</mark>
      <mark id="danger" data-lr-highlight-tone="danger">d</mark>
      <mark id="neutral" data-lr-highlight-tone="neutral">e</mark>
      <mark id="themed" data-lr-highlight-tone="success" style="--lr-doc-highlight-success-bg: rgb(9, 9, 9)">f</mark>
      <mark id="active" data-lr-highlight-tone="accent" data-lr-highlight-name="lr-highlight-active">g</mark>
    </div>
  </div>`);
}

const style = (root: HTMLElement, id: string) => getComputedStyle(root.querySelector(`#${id}`)!);

describe('highlightToneStyles', () => {
  it('paints each fallback mark from its tone token or theme fallback', async () => {
    const root = await mount(highlightToneStyles('doc').cssText);
    expect(['accent', 'success', 'warning', 'danger', 'neutral', 'themed'].map((id) => style(root, id).backgroundColor))
      .to.deep.equal(['rgb(1, 1, 1)', 'rgb(2, 2, 2)', 'rgb(3, 3, 3)', 'rgb(4, 4, 4)', 'rgb(5, 5, 5)', 'rgb(9, 9, 9)']);
    expect(style(root, 'active').outlineColor).to.equal('rgb(6, 6, 6)');
    expect(style(root, 'accent').cursor).to.equal('auto');
  });

  it('makes marks interactive and honours a custom scope and outline token', async () => {
    const css = highlightToneStyles('doc', { scope: "[part~='content']", interactive: true, activeOutlineToken: '--x-outline' });
    const root = await mount(css.cssText);
    root.style.setProperty('--x-outline', 'rgb(7, 7, 7)');
    expect(style(root, 'accent').cursor).to.equal('pointer');
    expect(style(root, 'active').outlineColor).to.equal('rgb(7, 7, 7)');
    expect(style(root, 'success').backgroundColor).to.equal('rgb(2, 2, 2)');
  });
});
