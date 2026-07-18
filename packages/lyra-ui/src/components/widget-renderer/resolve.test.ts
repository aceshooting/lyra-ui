import { expect } from '@open-wc/testing';
import { resolveTree, type ResolveContext, type WidgetNode } from './resolve.js';
import type { WidgetTypeRegistry } from './registry.js';

function ctx(registry: WidgetTypeRegistry, warnings: string[] = []): ResolveContext {
  return { registry, warned: new Set(), warn: (m) => warnings.push(m) };
}

describe('resolveTree (security-critical allowlist enforcement)', () => {
  it('skips an entire node (and its subtree) whose type is not in the registry, with one dev warning', () => {
    const registry: WidgetTypeRegistry = new Map();
    const warnings: string[] = [];
    const node: WidgetNode = { type: 'evil-widget', children: [{ type: 'text' as never }] };
    const resolved = resolveTree(node, ctx(registry, warnings));
    expect(resolved).to.be.null;
    expect(warnings).to.have.lengthOf(1);
    expect(warnings[0]).to.include('evil-widget');
  });

  it('deduplicates repeated warnings for the same unknown type within one instance', () => {
    const registry: WidgetTypeRegistry = new Map();
    const warnings: string[] = [];
    const c = ctx(registry, warnings);
    resolveTree({ type: 'row', children: [{ type: 'evil' }, { type: 'evil' }] }, c);
    expect(warnings.filter((w) => w.includes('evil'))).to.have.lengthOf(1);
  });

  it('skips a prop not in the allowlist (never assigned), keeping allowlisted props', () => {
    const registry: WidgetTypeRegistry = new Map([
      ['button', { tag: 'lr-button', props: { variant: 'string' }, action: { event: 'click' } }],
    ]);
    const node: WidgetNode = { type: 'button', props: { variant: 'brand', onclick: 'alert(1)' as never } };
    const resolved = resolveTree(node, ctx(registry));
    expect(resolved).to.not.be.null;
    expect(resolved!.kind === 'mapped' && resolved!.props).to.deep.equal({ variant: 'brand' });
  });

  it('skips a prop whose runtime type does not match the allowlisted primitive type', () => {
    const registry: WidgetTypeRegistry = new Map([['stat', { tag: 'lr-stat', props: { value: 'string' } }]]);
    const node: WidgetNode = { type: 'stat', props: { value: 42 } }; // number, allowlist says string
    const resolved = resolveTree(node, ctx(registry));
    expect(resolved!.kind === 'mapped' && resolved!.props).to.deep.equal({});
  });

  it('forcedProps always win over an allowlisted prop value from the node', () => {
    const registry: WidgetTypeRegistry = new Map([
      ['markdown', { tag: 'lr-markdown', props: { content: 'string' }, forcedProps: { sanitize: true } }],
    ]);
    const node: WidgetNode = { type: 'markdown', props: { content: 'hi', sanitize: false as never } };
    const resolved = resolveTree(node, ctx(registry));
    expect(resolved!.kind === 'mapped' && resolved!.props).to.deep.equal({ content: 'hi', sanitize: true });
  });

  it('drops a child slot not in the parent type\'s allowlist -- child renders unslotted, not dropped', () => {
    const registry: WidgetTypeRegistry = new Map([
      ['card', { tag: 'lr-card', slots: ['header'] }],
      ['text', undefined as never], // never looked up -- built-in
    ]);
    const node: WidgetNode = {
      type: 'card',
      children: [{ type: 'text', slot: 'header', children: ['ok'] }, { type: 'text', slot: 'footer', children: ['dropped-slot'] }],
    };
    const resolved = resolveTree(node, ctx(registry));
    const children = resolved!.kind === 'mapped' ? resolved!.children : [];
    expect(children[0].slot).to.equal('header');
    expect(children[1].slot).to.be.undefined; // 'footer' not allowlisted -> unslotted, still rendered
  });

  it('converts a string child into a text leaf node without allowlist checks', () => {
    const registry: WidgetTypeRegistry = new Map([['row', undefined as never]]);
    const node: WidgetNode = { type: 'row', children: ['hello world'] };
    const resolved = resolveTree(node, ctx(registry));
    expect(resolved!.children[0]).to.deep.equal({ key: '0.0', kind: 'text', text: 'hello world' });
  });

  it('never has an innerHTML/unsafeHTML code path -- structural guarantee via source inspection', async () => {
    const source = await (await fetch(new URL('./resolve.js', import.meta.url))).text();
    expect(source).to.not.include('innerHTML');
    expect(source).to.not.include('unsafeHTML');
  });

  it('enforces the depth cap (32), skipping nodes beyond it with a warning', () => {
    const registry: WidgetTypeRegistry = new Map([['row', { }], ['col', {}]]);
    let node: WidgetNode = { type: 'row' };
    for (let i = 0; i < 40; i++) node = { type: 'row', children: [node] };
    const warnings: string[] = [];
    const resolved = resolveTree(node, ctx(registry, warnings));
    expect(resolved).to.not.be.null;
    expect(warnings.some((w) => w.includes('depth'))).to.be.true;
  });

  it('enforces the node-count cap (5000), skipping excess nodes with a warning', () => {
    const registry: WidgetTypeRegistry = new Map([['row', {}]]);
    const children: WidgetNode[] = [];
    for (let i = 0; i < 5010; i++) children.push({ type: 'row' });
    const node: WidgetNode = { type: 'row', children };
    const warnings: string[] = [];
    const resolved = resolveTree(node, ctx(registry, warnings));
    expect(resolved!.children.length).to.be.at.most(5000);
    expect(warnings.some((w) => w.includes('5000') || w.includes('node'))).to.be.true;
  });

  it('resolves the built-in row/col types with their gap/align/justify enum props, never a tag', () => {
    const node: WidgetNode = { type: 'row', props: { gap: 'm', align: 'center', justify: 'between' } };
    const resolved = resolveTree(node, ctx(new Map()));
    expect(resolved!.kind).to.equal('builtin-row');
    expect(resolved!.tag).to.be.undefined;
    expect(resolved!.props).to.deep.equal({ gap: 'm', align: 'center', justify: 'between' });
  });

  it('rejects a row/col gap/align/justify value outside its enum', () => {
    const node: WidgetNode = { type: 'row', props: { gap: 'huge' as never } };
    const resolved = resolveTree(node, ctx(new Map()));
    expect(resolved!.props).to.deep.equal({});
  });

  it('resolves the built-in text type as a childless-props plain node', () => {
    const node: WidgetNode = { type: 'text', children: ['hi'] };
    const resolved = resolveTree(node, ctx(new Map()));
    expect(resolved!.kind).to.equal('builtin-text');
    expect(resolved!.props).to.deep.equal({});
  });

  it('returns null for a structurally unusable root (non-object)', () => {
    expect(resolveTree(null, ctx(new Map()))).to.be.null;
    expect(resolveTree(undefined, ctx(new Map()))).to.be.null;
    expect(resolveTree('nope' as unknown as WidgetNode, ctx(new Map()))).to.be.null;
  });

  it('wires actionId/payload only when the resolved type has a registered action', () => {
    const registry: WidgetTypeRegistry = new Map([['button', { tag: 'lr-button', action: { event: 'click' } }]]);
    const node: WidgetNode = { type: 'button', actionId: 'submit', payload: { formId: 'f1' } };
    const resolved = resolveTree(node, ctx(registry));
    expect(resolved!.actionEvent).to.equal('click');
    expect(resolved!.actionId).to.equal('submit');
    expect(resolved!.payload).to.deep.equal({ formId: 'f1' });
  });

  it('keys a node by id when present, else by structural path', () => {
    const registry: WidgetTypeRegistry = new Map([['row', {}]]);
    const node: WidgetNode = { type: 'row', children: [{ type: 'row', id: 'stable-1' }, { type: 'row' }] };
    const resolved = resolveTree(node, ctx(registry));
    expect(resolved!.children[0].key).to.equal('stable-1');
    expect(resolved!.children[1].key).to.equal('0.1');
  });
});
