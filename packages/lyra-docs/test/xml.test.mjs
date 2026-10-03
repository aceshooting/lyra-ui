import assert from 'node:assert/strict';
import test from 'node:test';
import { wordText, assertExternalHyperlink } from './xml.mjs';

const wordNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const officeNamespace = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const packageNamespace = 'http://schemas.openxmlformats.org/package/2006/relationships';
const target = 'https://example.test/linked';
const escape = value => value.replace(/[<>&"']/gu, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character]);
const document = body => `<doc:document xmlns:doc="${wordNamespace}" xmlns:rel="${officeNamespace}"><doc:body>${body}</doc:body></doc:document>`;
const link = (id = 'used', text = 'Linked words') => `<doc:hyperlink rel:id="${id}"><doc:r><doc:t>${text}</doc:t></doc:r></doc:hyperlink>`;
const relationships = body => `<pkg:Relationships xmlns:pkg="${packageNamespace}">${body}</pkg:Relationships>`;
const relationship = (url = target, extra = {}) => `<pkg:Relationship Id="${extra.id ?? 'used'}" Type="${extra.type ?? `${officeNamespace}/hyperlink`}" TargetMode="${extra.mode ?? 'External'}" Target="${escape(url)}"/>`;
const checkLink = (documentXml, relationshipsXml, expectedTarget = target) => assertExternalHyperlink(documentXml, relationshipsXml, { text: 'Linked words', target: expectedTarget });

test('Word text decodes entities and preserves nested marker-like text and CDATA', () => {
  const xml = document('<doc:p><doc:r><doc:t>A &lt;outer&gt;&lt;inner&gt;value&lt;/inner&gt;&lt;/outer&gt; &amp; B&#x1F600;</doc:t><doc:t><![CDATA[ <literal> ]]></doc:t></doc:r></doc:p>');
  assert.equal(wordText(xml), 'A <outer><inner>value</inner></outer> & B😀 <literal> ');
});

test('Word text follows namespace URIs, preserves whitespace and excludes attributes and foreign text', () => {
  const xml = document('<doc:p marker="not text"><doc:r><doc:t xml:space="preserve"> leading </doc:t><doc:t>tail&#33;</doc:t></doc:r><fake:t xmlns:fake="urn:foreign">not Word text</fake:t></doc:p>');
  assert.equal(wordText(xml), ' leading tail!');
  assert.equal(wordText(`<document xmlns="${wordNamespace}"><body><p><r><t>default namespace</t></r></p></body></document>`), 'default namespace');
});

test('Word text refuses malformed XML, undefined entities, wrong roots and doctypes', () => {
  for (const xml of [document('<doc:t>unclosed'), document('<doc:t>&unknown;</doc:t>'), '<document/>', `<!DOCTYPE document>${document('<doc:t>text</doc:t>')}`]) {
    assert.throws(() => wordText(xml));
  }
});

test('external link follows the actual Word hyperlink ID and namespace aliases', () => {
  checkLink(document(link()), relationships(relationship()));
  const split = '<doc:hyperlink rel:id="used"><doc:r><doc:t>Linked </doc:t></doc:r><doc:r><doc:t>words</doc:t></doc:r></doc:hyperlink>';
  checkLink(document(split), relationships(relationship()));
  const escapedTarget = 'https://example.test/linked?a=1&b=2';
  checkLink(document(link()), relationships(relationship(escapedTarget)), escapedTarget);
});

for (const [label, url] of [
  ['host suffix', 'https://example.test.evil.invalid/linked'],
  ['path', 'https://evil.invalid/https://example.test/linked'],
  ['query', 'https://evil.invalid/?next=https://example.test/linked'],
  ['fragment', 'https://evil.invalid/#https://example.test/linked'],
  ['extra path', 'https://example.test/linked/other'],
  ['extra query', 'https://example.test/linked?next=evil'],
  ['credentials', 'https://unexpected@example.test/linked']
]) {
  test(`external link refuses an expected URL embedded in a different ${label}`, () => {
    assert.throws(() => checkLink(document(link()), relationships(relationship(url))));
  });
}

test('unrelated relationship and regular document text cannot satisfy the hyperlink assertion', () => {
  const decoy = relationship(target, { id: 'unrelated' });
  assert.throws(() => checkLink(document(link()), relationships(relationship('https://evil.invalid/') + decoy)));
  assert.throws(() => checkLink(document(link()), relationships(decoy)));
  assert.throws(() => checkLink(document('<doc:p><doc:r><doc:t>Linked words</doc:t></doc:r></doc:p>'), relationships(relationship())));
  assert.throws(() => checkLink(document(link('used', 'Other words')), relationships(relationship())));
});

test('external link requires hyperlink type, external mode and namespaced relationship ID', () => {
  assert.throws(() => checkLink(document(link()), relationships(relationship(target, { type: `${officeNamespace}/image` }))));
  assert.throws(() => checkLink(document(link()), relationships(relationship(target, { mode: 'Internal' }))));
  assert.throws(() => checkLink(document('<doc:hyperlink id="used"><doc:r><doc:t>Linked words</doc:t></doc:r></doc:hyperlink>'), relationships(relationship())));
});

test('external link refuses ambiguous hyperlinks, duplicate IDs and foreign relationship namespaces', () => {
  assert.throws(() => checkLink(document(link() + link()), relationships(relationship())));
  assert.throws(() => checkLink(document(link()), relationships(relationship() + relationship('https://evil.invalid/'))));
  assert.throws(() => checkLink(document(link()), `<Relationships xmlns="urn:foreign"><Relationship Id="used" Target="${target}"/></Relationships>`));
});

test('external link refuses malformed document or relationships XML before asserting a target', () => {
  assert.throws(() => checkLink(document(link()) + '<extra>', relationships(relationship())));
  assert.throws(() => checkLink(document(link()), relationships(relationship()) + '<extra>'));
  assert.throws(() => checkLink(document(link()), `<!DOCTYPE Relationships>${relationships(relationship())}`));
});

test('XML comments and foreign hyperlink elements cannot supply verification evidence', () => {
  assert.equal(wordText(document('<!-- <doc:t>decoy</doc:t> --><doc:p><doc:r><doc:t>real</doc:t></doc:r></doc:p>')), 'real');
  assert.throws(() => checkLink(document(link()), relationships(`<!-- ${relationship()} -->${relationship('https://evil.invalid/')}`)));
  assert.throws(() => checkLink(document(`<fake:hyperlink xmlns:fake="urn:foreign" rel:id="used"><doc:r><doc:t>Linked words</doc:t></doc:r></fake:hyperlink>`), relationships(relationship())));
  assert.throws(() => checkLink(document('<doc:hyperlink xmlns:fake="urn:foreign" fake:id="used"><doc:r><doc:t>Linked words</doc:t></doc:r></doc:hyperlink>'), relationships(relationship())));
  assert.throws(() => wordText(document('<doc:t>before<doc:r/>after</doc:t>')));
});
