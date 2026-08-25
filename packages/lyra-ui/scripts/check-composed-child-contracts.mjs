#!/usr/bin/env node
// Prevent silent no-op composition bugs. Every statically named `<lr-*>` child in a Lit template
// must receive only public attributes/properties from the package's custom-elements manifest.
// This covers both component implementation templates and Storybook examples. It deliberately
// reads the CEM instead of re-interpreting decorators, so the same published contract drives the
// checker, editor data, framework types, and docs.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'oxc-parser';
import {
  DOCUMENT_ANCHOR_TARGET_CONTRACT,
  DOCUMENT_ANCHOR_TARGET_TAGS,
} from '../custom-elements-manifest.config.js';

const defaultPackageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MARKUP_TEMPLATE_TAGS = new Set(['html', 'staticHtml']);

// Public platform surface inherited by every custom element. Component-specific members must
// still come from the CEM. Keep attributes and properties separate because Lit's `?name=` writes
// an attribute while `.name=` writes a JavaScript property.
const GLOBAL_ATTRIBUTES = new Set([
  'accesskey',
  'autocapitalize',
  'autofocus',
  'class',
  'contenteditable',
  'dir',
  'draggable',
  'enterkeyhint',
  'exportparts',
  'hidden',
  'id',
  'inert',
  'inputmode',
  'is',
  'itemid',
  'itemprop',
  'itemref',
  'itemscope',
  'itemtype',
  'lang',
  'nonce',
  'part',
  'popover',
  'role',
  'slot',
  'spellcheck',
  'style',
  'tabindex',
  'title',
  'translate',
]);

const GLOBAL_PROPERTIES = new Set([
  'accessKey',
  'ariaAtomic',
  'ariaAutoComplete',
  'ariaBrailleLabel',
  'ariaBrailleRoleDescription',
  'ariaBusy',
  'ariaChecked',
  'ariaColCount',
  'ariaColIndex',
  'ariaColIndexText',
  'ariaColSpan',
  'ariaCurrent',
  'ariaDescription',
  'ariaDisabled',
  'ariaExpanded',
  'ariaHasPopup',
  'ariaHidden',
  'ariaInvalid',
  'ariaKeyShortcuts',
  'ariaLabel',
  'ariaLevel',
  'ariaLive',
  'ariaModal',
  'ariaMultiLine',
  'ariaMultiSelectable',
  'ariaOrientation',
  'ariaPlaceholder',
  'ariaPosInSet',
  'ariaPressed',
  'ariaReadOnly',
  'ariaRelevant',
  'ariaRequired',
  'ariaRoleDescription',
  'ariaRowCount',
  'ariaRowIndex',
  'ariaRowIndexText',
  'ariaRowSpan',
  'ariaSelected',
  'ariaSetSize',
  'ariaSort',
  'ariaValueMax',
  'ariaValueMin',
  'ariaValueNow',
  'ariaValueText',
  'autocapitalize',
  'autofocus',
  'className',
  'contentEditable',
  'dir',
  'draggable',
  'enterKeyHint',
  'hidden',
  'id',
  'inert',
  'inputMode',
  'lang',
  'nonce',
  'outerText',
  'popover',
  'role',
  'slot',
  'spellcheck',
  'style',
  'tabIndex',
  'title',
  'translate',
]);

function visitNodes(node, visitor) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visitor(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent' || key === 'type' || key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) {
      for (const child of value) visitNodes(child, visitor);
    } else if (value && typeof value === 'object') {
      visitNodes(value, visitor);
    }
  }
}

function templateTagName(tag) {
  if (tag?.type === 'Identifier') return tag.name;
  if (tag?.type === 'MemberExpression' && !tag.computed && tag.property?.type === 'Identifier') {
    return tag.property.name;
  }
  return '';
}

function lineAt(source, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) if (source.charCodeAt(index) === 10) line += 1;
  return line;
}

function templateMarkup(quasi) {
  return quasi.quasis
    .map((part, index) => {
      const text = part.value?.cooked ?? part.value?.raw ?? '';
      return index < quasi.quasis.length - 1 ? `${text}__LYRA_EXPR_${index}__` : text;
    })
    .join('');
}

function tagEnd(markup, start) {
  let quote = '';
  for (let index = start; index < markup.length; index += 1) {
    const char = markup[index];
    if (quote) {
      if (char === quote) quote = '';
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '>') {
      return index;
    }
  }
  return markup.length;
}

function parseBindings(attributeText) {
  const bindings = [];
  let index = 0;
  while (index < attributeText.length) {
    while (/\s/.test(attributeText[index] ?? '')) index += 1;
    if (index >= attributeText.length || attributeText[index] === '/') break;
    const start = index;
    while (index < attributeText.length && !/[\s=/>]/.test(attributeText[index])) index += 1;
    const rawName = attributeText.slice(start, index);
    while (/\s/.test(attributeText[index] ?? '')) index += 1;
    if (attributeText[index] === '=') {
      index += 1;
      while (/\s/.test(attributeText[index] ?? '')) index += 1;
      const quote = attributeText[index];
      if (quote === '"' || quote === "'") {
        index += 1;
        while (index < attributeText.length && attributeText[index] !== quote) index += 1;
        if (index < attributeText.length) index += 1;
      } else {
        while (index < attributeText.length && !/[\s>]/.test(attributeText[index])) index += 1;
      }
    }

    if (!rawName || rawName.startsWith('__LYRA_EXPR_') || rawName.startsWith('...')) continue;
    const prefix = rawName[0];
    if (prefix === '@' || prefix === '#') continue;
    if (prefix === '.') bindings.push({ kind: 'property', name: rawName.slice(1), display: rawName });
    else if (prefix === '?') {
      bindings.push({ kind: 'attribute', name: rawName.slice(1).toLowerCase(), display: rawName });
    } else {
      bindings.push({ kind: 'attribute', name: rawName.toLowerCase(), display: rawName });
    }
  }
  return bindings;
}

function tagsInMarkup(markup, line) {
  const tags = [];
  let index = 0;
  while (index < markup.length) {
    const open = markup.indexOf('<', index);
    if (open < 0) break;
    if (markup.startsWith('<!--', open)) {
      const close = markup.indexOf('-->', open + 4);
      index = close < 0 ? markup.length : close + 3;
      continue;
    }
    if (markup[open + 1] === '/' || markup[open + 1] === '!' || markup[open + 1] === '?') {
      index = tagEnd(markup, open + 1) + 1;
      continue;
    }
    const nameMatch = /^[A-Za-z][A-Za-z0-9._:-]*/.exec(markup.slice(open + 1));
    if (!nameMatch) {
      index = open + 1;
      continue;
    }
    const name = nameMatch[0].toLowerCase();
    const nameEnd = open + 1 + nameMatch[0].length;
    const end = tagEnd(markup, nameEnd);
    if (name.startsWith('lr-')) {
      tags.push({ tag: name, line, bindings: parseBindings(markup.slice(nameEnd, end)) });
    }
    index = end + 1;
  }
  return tags;
}

/** Extract statically analyzable custom-child bindings from AST-recognized Lit templates. */
export function extractComposedChildBindings(source, file = 'component.ts') {
  const parsed = parseSync(file, source);
  if (parsed.errors.length > 0) {
    const detail = parsed.errors.slice(0, 3).map((error) => error.message).join('; ');
    throw new Error(`${file}: composed-child parser failed: ${detail}`);
  }
  let templates = 0;
  const tags = [];
  visitNodes(parsed.program, (node) => {
    if (node.type !== 'TaggedTemplateExpression') return;
    if (!MARKUP_TEMPLATE_TAGS.has(templateTagName(node.tag))) return;
    templates += 1;
    tags.push(...tagsInMarkup(templateMarkup(node.quasi), lineAt(source, node.start ?? 0)));
  });
  return { templates, tags };
}

function normalizeModulePath(modulePath) {
  return String(modulePath ?? '')
    .replace(/^\/+/, '')
    .replace(/\.js$/, '.ts');
}

function isPublicMember(member) {
  return !member.static && member.privacy !== 'private' && member.privacy !== 'protected';
}

/** Build each tag's public surface, following non-flattened superclass and mixin references. */
export function contractsFromManifest(manifest) {
  const declarationsByKey = new Map();
  const declarationsByName = new Map();
  const moduleOf = new WeakMap();
  for (const module of manifest.modules ?? []) {
    const modulePath = normalizeModulePath(module.path);
    for (const declaration of module.declarations ?? []) {
      if (!declaration?.name) continue;
      moduleOf.set(declaration, modulePath);
      declarationsByKey.set(`${modulePath}#${declaration.name}`, declaration);
      const matches = declarationsByName.get(declaration.name) ?? [];
      matches.push(declaration);
      declarationsByName.set(declaration.name, matches);
    }
  }

  const resolveReference = (reference, owner) => {
    if (!reference?.name) return undefined;
    if (reference.module) {
      const exact = declarationsByKey.get(`${normalizeModulePath(reference.module)}#${reference.name}`);
      if (exact) return exact;
    }
    const sameModule = declarationsByKey.get(`${moduleOf.get(owner)}#${reference.name}`);
    if (sameModule) return sameModule;
    const matches = declarationsByName.get(reference.name) ?? [];
    return matches.length === 1 ? matches[0] : undefined;
  };

  const surfaceCache = new WeakMap();
  const collectSurface = (declaration, visiting = new Set()) => {
    const cached = surfaceCache.get(declaration);
    if (cached) return cached;
    if (visiting.has(declaration)) return { properties: new Set(), attributes: new Set() };
    const nextVisiting = new Set(visiting).add(declaration);
    const properties = new Set();
    const attributes = new Set();
    const references = [declaration.superclass, ...(declaration.mixins ?? [])];
    for (const reference of references) {
      const parent = resolveReference(reference, declaration);
      if (!parent) continue;
      const inherited = collectSurface(parent, nextVisiting);
      for (const name of inherited.properties) properties.add(name);
      for (const name of inherited.attributes) attributes.add(name);
    }
    for (const member of declaration.members ?? []) {
      if (!isPublicMember(member) || member.kind === 'method' || !member.name) continue;
      properties.add(member.name);
      if (typeof member.attribute === 'string') attributes.add(member.attribute.toLowerCase());
    }
    for (const attribute of declaration.attributes ?? []) {
      if (attribute?.name) attributes.add(attribute.name.toLowerCase());
    }
    const surface = { properties, attributes, definitionModule: moduleOf.get(declaration) };
    surfaceCache.set(declaration, surface);
    return surface;
  };

  const contracts = new Map();
  for (const module of manifest.modules ?? []) {
    for (const declaration of module.declarations ?? []) {
      if (declaration?.tagName?.startsWith('lr-')) {
        contracts.set(declaration.tagName.toLowerCase(), collectSurface(declaration));
      }
    }
  }

  // DocumentAnchorTarget is a source-only mixin outside CEM's analyzer globs. The manifest plugin
  // projects this same exported contract into generated metadata, but the checker also consumes it
  // directly so a stale generated CEM cannot produce false composition findings between source
  // edits and regeneration. Keeping one exported table prevents the two effective surfaces from
  // drifting or accumulating path-specific exceptions here.
  for (const tagName of DOCUMENT_ANCHOR_TARGET_TAGS) {
    const contract = contracts.get(tagName);
    if (!contract) continue;
    for (const [name, metadata] of Object.entries(DOCUMENT_ANCHOR_TARGET_CONTRACT.fields)) {
      contract.properties.add(name);
      if (metadata.attribute) contract.attributes.add(metadata.attribute.toLowerCase());
    }
  }
  return contracts;
}

function collectFiles(root, result = []) {
  if (!fs.existsSync(root)) return result;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) collectFiles(absolute, result);
    else if (/\.(?:[cm]?[jt]s)$/.test(entry.name)) result.push(absolute);
  }
  return result;
}

function eligibleSource(file) {
  const name = path.basename(file);
  return !name.endsWith('.d.ts') && !name.includes('.test.') && !name.includes('.styles.');
}

function isGlobalAttribute(name) {
  return GLOBAL_ATTRIBUTES.has(name) || name.startsWith('aria-') || name.startsWith('data-');
}

function bindingFinding(file, entry, binding, kind) {
  return `[composed-child-contract] ${file}:${entry.line} <${entry.tag}> uses unknown public ${kind} ${binding.display}`;
}

export function analyzeComposedChildContracts({
  packageDir = defaultPackageDir,
  manifestPath = path.join(packageDir, 'custom-elements.json'),
} = {}) {
  const absolutePackageDir = path.resolve(packageDir);
  const manifest = JSON.parse(fs.readFileSync(path.resolve(manifestPath), 'utf8'));
  const contracts = contractsFromManifest(manifest);
  const roots = [path.join(absolutePackageDir, 'src', 'components'), path.join(absolutePackageDir, '.storybook')];
  const files = roots.flatMap((root) => collectFiles(root)).filter(eligibleSource).sort();
  const stats = { files: files.length, storyFiles: 0, templates: 0, tags: 0, bindings: 0 };
  const findings = [];

  for (const absoluteFile of files) {
    const file = path.relative(absolutePackageDir, absoluteFile).split(path.sep).join('/');
    if (file.includes('.stories.')) stats.storyFiles += 1;
    const source = fs.readFileSync(absoluteFile, 'utf8');
    const extracted = extractComposedChildBindings(source, file);
    stats.templates += extracted.templates;
    stats.tags += extracted.tags.length;
    for (const entry of extracted.tags) {
      stats.bindings += entry.bindings.length;
      const contract = contracts.get(entry.tag);
      if (!contract) {
        findings.push(`[composed-child-contract] ${file}:${entry.line} <${entry.tag}> is absent from custom-elements.json`);
        continue;
      }
      for (const binding of entry.bindings) {
        if (binding.kind === 'property') {
          // Recursive trees legitimately hand private bookkeeping from one instance to another.
          // That is not cross-component composition: the defining module owns both endpoints and
          // TypeScript checks the private name there. Keep validating static attributes because
          // those remain markup/public state even on a recursively rendered self.
          const internalSelfBinding = contract.definitionModule === file;
          if (!internalSelfBinding && !contract.properties.has(binding.name) && !GLOBAL_PROPERTIES.has(binding.name)) {
            findings.push(bindingFinding(file, entry, binding, 'property'));
          }
        } else if (!contract.attributes.has(binding.name) && !isGlobalAttribute(binding.name)) {
          findings.push(bindingFinding(file, entry, binding, 'attribute'));
        }
      }
    }
  }

  if (stats.templates === 0 || stats.tags === 0 || stats.bindings === 0) {
    findings.push(
      `[composed-child-contract] nonzero coverage required (templates=${stats.templates}, tags=${stats.tags}, bindings=${stats.bindings})`,
    );
  }
  findings.sort();
  return { findings, stats };
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function runCli() {
  const packageDir = path.resolve(optionValue('--package-dir') ?? defaultPackageDir);
  const manifestArgument = optionValue('--manifest');
  const manifestPath = manifestArgument
    ? path.resolve(process.cwd(), manifestArgument)
    : path.join(packageDir, 'custom-elements.json');
  const { findings, stats } = analyzeComposedChildContracts({ packageDir, manifestPath });
  if (findings.length > 0) {
    console.error('Composed-child public-contract check failed:');
    for (const finding of findings) console.error(`- ${finding}`);
    console.error(
      `Scanned ${stats.files} files (${stats.storyFiles} stories), ${stats.templates} Lit templates, ${stats.tags} lr-* tags, and ${stats.bindings} bindings.`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    `Composed-child public-contract check passed: ${stats.files} files (${stats.storyFiles} stories), ${stats.templates} Lit templates, ${stats.tags} lr-* tags, ${stats.bindings} bindings.`,
  );
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) runCli();
