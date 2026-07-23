import { expect } from '@open-wc/testing';
import { adaptA2UiSurface } from './a2ui.js';

it('maps an A2UI-style component graph into a versioned allowlisted widget document', () => {
  const document = adaptA2UiSurface(
    {
      surfaceId: 'answer-card',
      rootId: 'root',
      components: [
        { id: 'root', type: 'Column', children: ['title', 'action'] },
        { id: 'title', type: 'Text', text: 'Grounded answer' },
        {
          id: 'action',
          type: 'Button',
          text: 'Open',
          action: { id: 'open-source', payload: { sourceId: 'doc-1' } },
        },
      ],
      data: { selected: 'doc-1' },
    },
    { Column: 'col', Text: 'text', Button: 'button' },
  );

  expect(document?.version).to.equal('1');
  expect(document?.root.type).to.equal('col');
  expect(document?.root.children).to.have.lengthOf(2);
  expect((document?.root.children?.[1] as { actionId?: string }).actionId).to.equal('open-source');
  expect(document?.state).to.deep.equal({ selected: 'doc-1' });
});

it('fails closed for unknown component types and dangling roots', () => {
  expect(adaptA2UiSurface(
    {
      rootId: 'root',
      components: [{ id: 'root', type: 'ArbitraryHtml', text: '<script>bad()</script>' }],
    },
    { Text: 'text' },
  )).to.equal(null);
  expect(adaptA2UiSurface({ rootId: 'missing', components: [] }, {})).to.equal(null);
});

it('drops cyclic, dangling, and unknown descendants while preserving the valid surface', () => {
  const document = adaptA2UiSurface(
    {
      rootId: 'root',
      components: [
        {
          id: 'root',
          type: 'Column',
          props: { gap: 'medium' },
          children: ['valid', 'cycle', 'missing', 'unknown'],
        },
        { id: 'valid', type: 'Text', text: 'Kept' },
        { id: 'cycle', type: 'Column', children: ['root'] },
        { id: 'unknown', type: 'ArbitraryHtml', text: '<script>bad()</script>' },
      ],
    },
    { Column: 'col', Text: 'text' },
  );

  expect(document?.root.props).to.deep.equal({ gap: 'medium' });
  expect(document?.root.children).to.have.lengthOf(2);
  expect(document?.root.children?.map((child) => child.id)).to.deep.equal(['valid', 'cycle']);
  expect(document?.root.children?.[1]?.children).to.equal(undefined);
  expect(document).to.not.have.property('state');
});

it('enforces component-count and traversal-depth ceilings', () => {
  const tooMany = Array.from({ length: 5001 }, (_, index) => ({
    id: `component-${index}`,
    type: 'Text',
  }));
  expect(adaptA2UiSurface(
    { rootId: 'component-0', components: tooMany },
    { Text: 'text' },
  )).to.equal(null);

  const deep = Array.from({ length: 35 }, (_, index) => ({
    id: `node-${index}`,
    type: 'Column',
    children: index < 34 ? [`node-${index + 1}`] : [],
  }));
  const document = adaptA2UiSurface(
    { rootId: 'node-0', components: deep },
    { Column: 'col' },
  );
  let node = document?.root;
  let depth = 0;
  while (node?.children?.[0]) {
    depth += 1;
    node = node.children[0];
  }
  expect(depth).to.equal(32);
  expect(node?.id).to.equal('node-32');
});
