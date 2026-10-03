import assert from 'node:assert/strict';
import { SaxesParser } from 'saxes';

const wordNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const officeNamespace = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const packageNamespace = 'http://schemas.openxmlformats.org/package/2006/relationships';
const isElement = (node, uri, local) => node.uri === uri && node.local === local;

function parseXml(xml, uri, local) {
  const parser = new SaxesParser({ xmlns: true });
  const stack = [];
  let root;
  parser.on('doctype', () => { throw new Error('DOCX XML must not contain a doctype'); });
  parser.on('opentag', tag => {
    const node = { ...tag, children: [], text: '' };
    if (stack.length) stack.at(-1).children.push(node);
    else root = node;
    stack.push(node);
  });
  const appendText = text => { if (stack.length) stack.at(-1).text += text; };
  parser.on('text', appendText);
  parser.on('cdata', appendText);
  parser.on('closetag', () => { stack.pop(); });
  parser.write(xml).close();
  assert.ok(root && isElement(root, uri, local), `Expected XML root {${uri}}${local}`);
  return root;
}

function collectWordContent(node, hyperlinks = []) {
  if (isElement(node, wordNamespace, 't')) {
    assert.equal(node.children.length, 0, 'Word text must not contain child elements');
    return node.text;
  }
  const text = node.children.map(child => collectWordContent(child, hyperlinks)).join('');
  if (isElement(node, wordNamespace, 'hyperlink')) hyperlinks.push({ node, text });
  return text;
}

/** Read decoded Word text elements, excluding markup, comments and foreign text elements. */
export function wordText(xml) {
  return collectWordContent(parseXml(xml, wordNamespace, 'document'));
}

/** Assert the selected Word text links through its relationship ID to the exact external target. */
export function assertExternalHyperlink(documentXml, relationshipsXml, { text, target }) {
  const hyperlinks = [];
  collectWordContent(parseXml(documentXml, wordNamespace, 'document'), hyperlinks);
  const relationships = parseXml(relationshipsXml, packageNamespace, 'Relationships');
  const byId = new Map();
  for (const node of relationships.children) {
    if (!isElement(node, packageNamespace, 'Relationship')) continue;
    const attribute = name => Object.values(node.attributes).find(value => value.uri === '' && value.local === name)?.value;
    const id = attribute('Id');
    assert.ok(id, 'Relationship must have an ID');
    assert.equal(byId.has(id), false, 'Relationship IDs must be unique');
    byId.set(id, { target: attribute('Target'), type: attribute('Type'), mode: attribute('TargetMode') });
  }
  const matching = hyperlinks.filter(link => link.text === text);
  assert.equal(matching.length, 1, 'Expected exactly one hyperlink containing the selected Word text');
  const id = Object.values(matching[0].node.attributes).find(value => value.uri === officeNamespace && value.local === 'id')?.value;
  assert.ok(id, 'Word hyperlink must have a namespaced relationship ID');
  const relationship = byId.get(id);
  assert.ok(relationship, 'Word hyperlink relationship must exist');
  assert.equal(relationship.type, `${officeNamespace}/hyperlink`, 'Relationship must be a hyperlink');
  assert.equal(relationship.mode, 'External', 'Hyperlink must have an external target');
  assert.equal(relationship.target, target, 'Hyperlink must resolve to the exact expected target');
}
