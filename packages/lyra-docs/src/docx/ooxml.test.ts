import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveOoxmlPart, resolveOoxmlSegments } from './ooxml.js';

test('resolves internal targets relative to an OOXML part', () => {
  assert.equal(resolveOoxmlPart('/word/document.xml', 'media/image1.png'), '/word/media/image1.png');
  assert.equal(resolveOoxmlPart('/word/document.xml', '../docProps/core.xml'), '/docProps/core.xml');
  assert.equal(resolveOoxmlPart('/word/document.xml', '/word/media/image1.png'), '/word/media/image1.png');
});

test('rejects package escape and non-part targets', () => {
  for (const target of ['../../escape.xml', 'https://example.com/a', '//host/a', 'media%2fimage.png', 'media\\image.png', 'part.xml#id']) {
    assert.equal(resolveOoxmlPart('/word/document.xml', target), null);
  }
});

test('relationship segment resolution preserves the caller source', () => {
  const source = ['word', 'media'];
  assert.deepEqual(resolveOoxmlSegments(source, '../document.xml'), ['word', 'document.xml']);
  assert.deepEqual(source, ['word', 'media']);
  assert.equal(resolveOoxmlSegments(source, '../../../outside.xml'), null);
});
