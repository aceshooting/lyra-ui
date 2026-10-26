#!/usr/bin/env node
/** Verify the reviewed overlay against public component metadata and source type declarations. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { API } from 'typescript/unstable/sync';
import * as ts from 'typescript/unstable/ast';
import { createCatalogPropertyProof, createSchemaTypeProof } from './catalog-type-proof.mjs';
import { verifyTableAdapter } from './catalog-adapter-proof.mjs';
import { validateSchema } from '../dist/schema.js';
import { validateView } from '../dist/runtime.js';
import { initialCatalog } from '../dist/catalog.js';

const uiRoot = fileURLToPath(new URL('../../lyra-ui/', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('../../lyra-ui/custom-elements.json', import.meta.url), 'utf8'));
const declarations = manifest.modules.flatMap(module => (module.declarations ?? []).map(declaration => ({ ...declaration, module: module.path })));
const byName = new Map(declarations.map(declaration => [declaration.name, declaration]));
const configPath = fileURLToPath(new URL('./fixtures/tsconfig.catalog-proof.json', import.meta.url));
const api = new API({ cwd: uiRoot });
const snapshot = api.updateSnapshot({ openProjects: [configPath] });
const project = snapshot.getProject(configPath) ?? snapshot.getProjects()[0];
assert.ok(project, 'Component TypeScript project must load.');
const program = project.program;
const checker = project.checker;
try {
const classDeclarations = new Map();
for (const fileName of program.getSourceFileNames()) {
  const source = program.getSourceFile(fileName);
  if (!source) continue;
  if (!source.fileName.startsWith(uiRoot) || source.isDeclarationFile) continue;
  const visit = node => {
    if (ts.isClassDeclaration(node) && node.name) classDeclarations.set(node.name.text, node);
    node.forEachChild(visit);
  };
  visit(source);
}

function members(declaration, seen = new Set()) {
  if (!declaration || seen.has(declaration.name)) return [];
  seen.add(declaration.name);
  return [...(declaration.members ?? []), ...members(byName.get(declaration.superclass?.name), seen), ...(declaration.mixins ?? []).flatMap(mixin => members(byName.get(mixin.name), seen))];
}
function inherited(declaration, field, seen = new Set()) {
  if (!declaration || seen.has(declaration.name)) return [];
  seen.add(declaration.name);
  return [...(declaration[field] ?? []), ...inherited(byName.get(declaration.superclass?.name), field, seen)];
}
const { assignment, literals } = createSchemaTypeProof(project);
const proofSource = program.getSourceFile(fileURLToPath(new URL('./fixtures/catalog-proof-types.ts', import.meta.url)));
assert.ok(proofSource, 'Concrete catalog proof types must load.');
const concreteProof = createCatalogPropertyProof(project, proofSource);
const concreteProperties = new Set(['select.value', 'table.rows', 'table.columns']);
const typeProofs = [];

function schemaChecks(schema, name) {
  assert.ok(!validateSchema(null, schema).diagnostics.some(item => item.code === 'schema.invalid'), `${name}: malformed supported schema`);
  if (Object.hasOwn(schema, 'default')) assert.ok(validateSchema(schema.default, schema).ok, `${name}: schema default does not validate`);
  if ('anyOf' in schema) { schema.anyOf.forEach((child, index) => schemaChecks(child, `${name}.anyOf[${index}]`)); return; }
  if (schema.type === 'string' && !schema.enum) assert.ok(Number.isSafeInteger(schema.maxLength) && schema.maxLength <= 65536, `${name}: explicit string ceiling required`);
  if (schema.type === 'array') {
    assert.ok(Number.isSafeInteger(schema.maxItems) && schema.maxItems <= 2000, `${name}: explicit array ceiling required`);
    schemaChecks(schema.items, `${name}[]`);
  }
  if (['number', 'integer'].includes(schema.type)) assert.ok(Number.isFinite(schema.minimum) && Number.isFinite(schema.maximum), `${name}: explicit numeric range required`);
  if (schema.type === 'object') for (const [key, child] of Object.entries(schema.properties)) schemaChecks(child, `${name}.${key}`);
}
function sourceDefault(classNode, key, seen = new Set()) {
  if (seen.has(key)) return { known: false };
  seen.add(key);
  const declaration = classNode.members.find(member => member.name?.getText() === key && (ts.isPropertyDeclaration(member) || ts.isGetAccessorDeclaration(member)));
  if (!declaration) return { known: false };
  let expression = declaration.initializer;
  if (ts.isGetAccessorDeclaration(declaration)) {
    const statements = declaration.body?.statements;
    if (statements?.length !== 1 || !ts.isReturnStatement(statements[0])) return { known: false };
    const returned = statements[0].expression;
    if (returned && ts.isPropertyAccessExpression(returned) && returned.expression.kind === ts.SyntaxKind.ThisKeyword) return sourceDefault(classNode, returned.name.text, seen);
    expression = returned;
  }
  while (expression && (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression) || ts.isParenthesizedExpression(expression))) expression = expression.expression;
  if (!expression) return { known: false };
  if (ts.isStringLiteral(expression)) return { known: true, value: expression.text };
  if (ts.isNumericLiteral(expression)) return { known: true, value: Number(expression.text) };
  if (expression.kind === ts.SyntaxKind.TrueKeyword) return { known: true, value: true };
  if (expression.kind === ts.SyntaxKind.FalseKeyword) return { known: true, value: false };
  if (expression.kind === ts.SyntaxKind.NullKeyword) return { known: true, value: null };
  return { known: false };
}
let properties = 0;
let verifiedTypes = 0;
let examples = 0;
let authoredDefaults = 0;
let usageGuides = 0;
let enumValues = 0;
for (const [role, component] of Object.entries(initialCatalog.components)) {
  for (const field of ['description', 'useWhen', 'documentation']) if (component[field] !== undefined) assert.ok(typeof component[field] === 'string' && component[field].trim().length > 0 && component[field].length <= 2048, `${role}: invalid ${field}`);
  if (component.useWhen) usageGuides++;
  if (component.minimumBlockSize) assert.match(component.minimumBlockSize, /^(?:[1-9]\d*(?:\.\d+)?|0\.\d+)(?:rem|em|px)$/, `${role}: invalid reserved block size`);
  for (const [key, schema] of Object.entries(component.properties)) schemaChecks(schema, `${role}.${key}`);
  for (const example of component.examples ?? []) {
    assert.equal(example.type, role, `${role}: example role mismatch`);
    const checked = validateView({ version: '1', catalog: { id: initialCatalog.id, version: initialCatalog.version }, surfaceId: 'catalog-example', revision: 0, root: example }, initialCatalog);
    assert.ok(checked.ok, `${role}: example fails runtime validation: ${JSON.stringify(checked.diagnostics)}`);
    examples++;
  }
  if (!component.tag.includes('-')) {
    assert.ok(['div', 'p', 'h2', 'form'].includes(component.tag), `${role}: unreviewed native tag`);
    const nativeProperties = component.tag === 'form' ? { ariaLabel: 'string' } : {};
    for (const [key, schema] of Object.entries(component.properties)) {
      assert.ok(Object.hasOwn(nativeProperties, key), `${role}.${key}: unreviewed native property`);
      assert.equal(schema.type, nativeProperties[key], `${role}.${key}: unreviewed native property type`);
    }
    for (const event of component.events ?? []) assert.ok(component.tag === 'form' && event === 'submit', `${role}: unreviewed native event`);
    continue;
  }
  const declaration = declarations.find(candidate => candidate.tagName === component.tag);
  assert.ok(declaration, `${role}: unknown component tag`);
  const fields = new Map(members(declaration).filter(member => member.kind === 'field' && !['private', 'protected'].includes(member.privacy)).reverse().map(member => [member.name, member]));
  const classNode = classDeclarations.get(declaration.name);
  assert.ok(classNode, `${role}: public class must resolve`);
  if (role === 'select') {
    assert.deepEqual(sourceDefault(classNode, 'multiple'), { known: true, value: false }, 'The concrete select proof requires the actual single-selection default.');
    assert.equal(component.prepareProperties, undefined, 'A select adapter requires a separately reviewed concrete mode.');
  }
  const classType = checker.getTypeAtLocation(classNode);
  for (const [key, schema] of Object.entries(component.properties)) {
    const member = fields.get(key);
    assert.ok(member, `${role}.${key}: not a public component property`);
    properties++;
    const propertySymbol = checker.getPropertyOfType(classType, key);
    assert.ok(propertySymbol, `${role}.${key}: component property type must resolve`);
    const propertyType = checker.getTypeOfSymbolAtLocation(propertySymbol, propertySymbol.valueDeclaration?.resolve(project) ?? classNode);
    const checkedType = assignment(schema, propertyType, classNode);
    const property = `${role}.${key}`;
    const proof = concreteProperties.has(property) ? concreteProof(property, schema) : checkedType;
    assert.equal(proof.status, 'verified', `${property}: ${proof.status}: ${proof.reason}`);
    if (concreteProperties.has(property)) typeProofs.push({ property,
      mode: property === 'table.columns' ? 'adapter-shape-and-concrete-component' : 'concrete-component',
      rawGenericStatus: checkedType.status,
    });
    verifiedTypes++;
    if (Object.hasOwn(schema, 'default')) {
      authoredDefaults++;
      const raw = member.default;
      let componentDefault;
      if (typeof raw === 'string' && /^'[^'\\]*'$/.test(raw)) componentDefault = raw.slice(1, -1);
      else try { componentDefault = JSON.parse(raw); } catch {
        const source = sourceDefault(classNode, key);
        assert.ok(source.known, `${role}.${key}: component default is not a comparable literal or a direct accessor-backed literal.`);
        componentDefault = source.value;
      }
      assert.deepEqual(schema.default, componentDefault, `${role}.${key}: declared default differs from component metadata`);
    }
    if (schema.enum) {
      const symbol = checker.getPropertyOfType(classType, key);
      assert.ok(symbol, `${role}.${key}: property type must resolve`);
      const type = checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration?.resolve(project) ?? classNode);
      const allowed = literals(type);
      if (allowed) for (const value of schema.enum) {
        assert.ok(allowed.includes(value), `${role}.${key}: unsupported enum value ${String(value)}`);
        enumValues++;
      }
    }
  }
  const events = new Set(inherited(declaration, 'events').map(event => event.name));
  for (const event of [...(component.events ?? []), ...Object.values(component.bindings ?? {}).map(binding => binding.event)]) assert.ok(events.has(event) || (role === 'button' && event === 'click'), `${role}: unlisted event ${event}`);
  const slots = new Set(inherited(declaration, 'slots').map(slot => slot.name ?? ''));
  for (const slot of component.slots ?? []) assert.ok(slots.has(slot), `${role}: unlisted slot ${slot}`);
  assert.equal(typeof component.load, 'function', `${role}: missing granular loader`);
  assert.ok(component.load.toString().includes(`@aceshooting/lyra-ui/components/${component.tag}.js`), `${role}: loader must reference its trusted granular entry`);
  await readFile(path.join(uiRoot, 'llms/components', `${component.tag}.md`), 'utf8');
}
for (const property of concreteProperties) assert.ok(typeProofs.some(proof => proof.property === property), `${property}: stale concrete proof`);
assert.equal(Object.hasOwn(initialCatalog.components.select.properties, 'multiple'), false, 'The select proof applies only to the single-selection catalog.');
const adapterProof = verifyTableAdapter(initialCatalog.components.table, validateSchema);
console.log(JSON.stringify({ roles: Object.keys(initialCatalog.components).length, properties, verifiedTypes, enumValues, authoredDefaults, examples, usageGuides, typeProofs, adapterProof }, null, 2));

} finally { snapshot.dispose(); api.close(); }
