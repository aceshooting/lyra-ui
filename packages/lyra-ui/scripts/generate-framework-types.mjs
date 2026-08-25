#!/usr/bin/env node

// Generates opt-in React/JSX, Vue, and Svelte declaration entry points from the public Custom
// Elements Manifest. The manifest owns the tag/class/module relationship and the documented
// properties, attributes, events, and CSS custom properties; this generator only translates that
// stable surface into each framework's declaration-merging vocabulary.

import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { expandManifestInheritance } from './manifest-compact.mjs';

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifestFile = path.join(packageDir, 'custom-elements.json');
const byName = (a, b) => a.localeCompare(b);
const identifierPattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const builtInTypeNames = new Set([
  'Array',
  'BigInt',
  'Boolean',
  'Date',
  'Element',
  'Event',
  'HTMLElement',
  'HTMLFormElement',
  'Intl',
  'Map',
  'Node',
  'Number',
  'Object',
  'Promise',
  'Readonly',
  'ReadonlyArray',
  'ReadonlyMap',
  'ReadonlySet',
  'Record',
  'Set',
  'String',
  'Symbol',
  'WeakMap',
  'WeakSet',
  'any',
  'bigint',
  'boolean',
  'false',
  'never',
  'null',
  'number',
  'object',
  'string',
  'symbol',
  'true',
  'undefined',
  'unknown',
  'void',
]);

function quoted(value) {
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

function union(values, indent = '  ') {
  if (values.length === 0) return 'never';
  return values.map((value) => `${indent}| ${quoted(value)}`).join('\n');
}

function moduleSpecifier(modulePath) {
  if (
    typeof modulePath !== 'string' ||
    !modulePath.startsWith('src/') ||
    !modulePath.endsWith('.ts') ||
    modulePath.includes('..')
  ) {
    throw new Error(
      `custom-element module path ${JSON.stringify(modulePath)} must be a TypeScript module below src/`,
    );
  }
  return `./${modulePath.slice('src/'.length).replace(/\.ts$/, '.js')}`;
}

function normalizeTypeText(type) {
  if (typeof type?.text !== 'string') return undefined;
  const text = type.text.replaceAll(/\s+/g, ' ').trim().replace(/^\|\s*/, '');
  return text || undefined;
}

function referencedTypeSymbols(typeText) {
  if (!typeText) return [];
  return [
    ...new Set(
      [...typeText.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)]
        .filter(({ index = 0 }) => typeText[index - 1] !== '.')
        .map(([name]) => name)
        .filter((name) => /^[A-Z_$]/.test(name) && !builtInTypeNames.has(name)),
    ),
  ].sort(byName);
}

function collectElements(manifest) {
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.modules)) {
    throw new TypeError('Custom Elements Manifest must contain a modules array');
  }

  const elements = [];
  const tags = new Set();
  const classes = new Set();

  for (const module of manifest.modules) {
    for (const declaration of module.declarations ?? []) {
      if (declaration.customElement !== true || !declaration.tagName) continue;

      const { name: className, tagName } = declaration;
      if (typeof tagName !== 'string' || !tagName.includes('-')) {
        throw new Error(`invalid custom-element tag name ${JSON.stringify(tagName)}`);
      }
      if (tags.has(tagName)) {
        throw new Error(`duplicate custom-element tag name ${JSON.stringify(tagName)}`);
      }
      if (typeof className !== 'string' || !identifierPattern.test(className)) {
        throw new Error(`invalid class name ${JSON.stringify(className)} for <${tagName}>`);
      }
      if (classes.has(className)) {
        throw new Error(`duplicate custom-element class name ${JSON.stringify(className)}`);
      }
      tags.add(tagName);
      classes.add(className);

      const members = (declaration.members ?? []).filter(
        (member) =>
          member.kind === 'field' &&
          member.static !== true &&
          member.readonly !== true &&
          member.privacy !== 'private' &&
          member.privacy !== 'protected' &&
          typeof member.name === 'string',
      );
      const propertyNames = [...new Set(members.map((member) => member.name))].sort(byName);
      const propertySet = new Set(propertyNames);
      const propertyOverrides = members
        .filter((member) => member.lyraReadType !== undefined)
        .map((member) => {
          const readType = normalizeTypeText(member.lyraReadType);
          const writeType = normalizeTypeText(member.type);
          if (!readType || !writeType) {
            throw new Error(
              `${tagName}.${member.name}: asymmetric accessor metadata requires read and write types`,
            );
          }
          return { name: member.name, readType, writeType };
        })
        .filter(({ readType, writeType }) => readType !== writeType)
        .sort((a, b) => a.name.localeCompare(b.name));

      const memberByName = new Map(
        (declaration.members ?? [])
          .filter(
            (member) =>
              member.kind === 'field' &&
              member.static !== true &&
              member.privacy !== 'private' &&
              member.privacy !== 'protected' &&
              typeof member.name === 'string',
          )
          .map((member) => [member.name, member]),
      );
      const aliases = [];
      for (const attribute of declaration.attributes ?? []) {
        if (typeof attribute.name !== 'string') continue;
        const fieldName = attribute.fieldName;
        if (typeof fieldName === 'string' && attribute.name === fieldName && propertySet.has(fieldName)) {
          continue;
        }
        aliases.push({
          name: attribute.name,
          fieldName:
            typeof fieldName === 'string' && memberByName.has(fieldName) ? fieldName : undefined,
          typeText: normalizeTypeText(attribute.type),
        });
      }
      aliases.sort((a, b) => a.name.localeCompare(b.name));

      elements.push({
        tagName,
        className,
        specifier: moduleSpecifier(module.path),
        superclassName:
          typeof declaration.superclass?.name === 'string'
            ? declaration.superclass.name
            : undefined,
        propertyNames,
        propertyOverrides,
        aliases,
        eventNames: [...new Set((declaration.events ?? []).map((event) => event.name).filter(Boolean))].sort(
          byName,
        ),
        cssNames: [
          ...new Set((declaration.cssProperties ?? []).map((property) => property.name).filter(Boolean)),
        ].sort(byName),
      });
    }
  }

  elements.sort((a, b) => a.tagName.localeCompare(b.tagName));
  const byClassName = new Map(elements.map((element) => [element.className, element]));

  function eventMapOwner(element, visited = new Set()) {
    if (element.eventNames.length === 0) return undefined;
    if (visited.has(element.className)) {
      throw new Error(`custom-element inheritance cycle at ${element.className}`);
    }
    visited.add(element.className);
    const superclass = element.superclassName
      ? byClassName.get(element.superclassName)
      : undefined;
    if (
      superclass &&
      element.eventNames.length === superclass.eventNames.length &&
      element.eventNames.every((name, index) => name === superclass.eventNames[index])
    ) {
      return eventMapOwner(superclass, visited);
    }
    return element;
  }

  for (const element of elements) {
    const owner = eventMapOwner(element);
    element.eventMapName = owner ? `${owner.className}EventMap` : undefined;
    element.eventMapSpecifier = owner?.specifier;
  }

  return elements;
}

function imports(elements, frameworkImport) {
  const symbolsBySpecifier = new Map();
  for (const element of elements) {
    const classSymbols = symbolsBySpecifier.get(element.specifier) ?? new Set();
    classSymbols.add(element.className);
    symbolsBySpecifier.set(element.specifier, classSymbols);
    if (element.eventMapName && element.eventMapSpecifier) {
      const eventSymbols = symbolsBySpecifier.get(element.eventMapSpecifier) ?? new Set();
      eventSymbols.add(element.eventMapName);
      symbolsBySpecifier.set(element.eventMapSpecifier, eventSymbols);
    }
    // A field-backed attribute alias is emitted as Class['field'], so its manifest type text is
    // deliberately not a dependency here. Scanning that redundant text imports private source
    // aliases, generic parameters, platform namespace members, and the same inherited alias from
    // every subclass even though none of those names appear in the generated type expression.
    for (const alias of element.aliases.filter(({ fieldName }) => !fieldName)) {
      for (const symbol of referencedTypeSymbols(alias.typeText)) classSymbols.add(symbol);
    }
    for (const override of element.propertyOverrides) {
      for (const symbol of referencedTypeSymbols(override.writeType)) classSymbols.add(symbol);
    }
  }
  return [
    frameworkImport,
    "import type { LyraGlobalEventMap } from './events.js';",
    ...[...symbolsBySpecifier]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([specifier, symbols]) =>
          `import type { ${[...symbols].sort(byName).join(', ')} } from '${specifier}';`,
      ),
  ].join('\n');
}

function aliasType(element, indent) {
  if (element.aliases.length === 0) return '{}';
  const memberIndent = `${indent}  `;
  return [
    '{',
    ...element.aliases.map(({ name, fieldName, typeText }) =>
      fieldName
        ? `${memberIndent}${quoted(name)}?: ${element.className}[${quoted(fieldName)}];`
        : typeText
          ? `${memberIndent}${quoted(name)}?: LyraAttributeValue<${typeText}>;`
          : `${memberIndent}${quoted(name)}?: LyraUnknownAttributeValue;`,
    ),
    `${indent}}`,
  ].join('\n');
}

function propertyOverrideType(element, indent) {
  if (element.propertyOverrides.length === 0) return '{}';
  const memberIndent = `${indent}  `;
  return [
    '{',
    ...element.propertyOverrides.map(
      ({ name, writeType }) =>
        `${memberIndent}${identifierPattern.test(name) ? name : quoted(name)}: ${writeType};`,
    ),
    `${indent}}`,
  ].join('\n');
}

function elementType(element, frameworkName) {
  const typeName = `${element.className}${frameworkName}Props`;
  const helper =
    frameworkName === 'React'
      ? 'LyraReactElementProps'
      : frameworkName === 'Svelte'
        ? 'LyraSvelteElementProps'
        : 'LyraVueCustomElement';
  return [
    `export type ${typeName} = ${helper}<`,
    `  ${element.className},`,
    `${union(element.propertyNames, '  ')},`,
    `  ${propertyOverrideType(element, '  ')},`,
    `  ${element.eventMapName ?? '{}'},`,
    `${union(element.eventNames, '  ')},`,
    `${union(element.cssNames, '  ')},`,
    `  ${aliasType(element, '  ')}`,
    '>;',
  ].join('\n');
}

function generatedHeader(kind) {
  return [
    `// GENERATED FILE — do not edit by hand. Opt-in ${kind} custom-element declarations.`,
    '// Regenerate with `pnpm --filter @aceshooting/lyra-ui run framework-types`.',
    '// This module contains types only; its emitted JavaScript is an empty module.',
    '',
  ].join('\n');
}

function sharedEventTypes() {
  return [
    'export type LyraUnknownAttributeValue = string | number | boolean | null | undefined;',
    '',
    'type LyraAttributePrimitive<Value> = Value extends boolean',
    "  ? Value | '' | 'true' | 'false'",
    '  : Value extends number',
    '    ? Value | `${Value}`',
    '    : Value extends string',
    '      ? Value',
    '      : LyraUnknownAttributeValue;',
    '',
    '/** Markup-compatible values for a typed attribute alias that has no public class field. */',
    'export type LyraAttributeValue<Value> =',
    '  | LyraAttributePrimitive<Exclude<Value, null | undefined>>',
    '  | Extract<Value, null | undefined>;',
    '',
    'type LyraFallbackEvent<Name extends string> = Name extends keyof LyraGlobalEventMap',
    '  ? LyraGlobalEventMap[Name]',
    '  : Name extends keyof HTMLElementEventMap',
    '    ? HTMLElementEventMap[Name]',
    '    : Event;',
    '',
    'type LyraEventFor<',
    '  ElementEvents extends object,',
    '  Name extends string,',
    '> = Name extends keyof ElementEvents',
    '  ? ElementEvents[Name] extends Event',
    '    ? ElementEvents[Name]',
    '    : LyraFallbackEvent<Name>',
    '  : LyraFallbackEvent<Name>;',
    '',
    'type LyraBoundEvent<',
    '  ElementType extends HTMLElement,',
    '  ElementEvents extends object,',
    '  Name extends string,',
    '> = LyraEventFor<ElementEvents, Name> & { readonly currentTarget: ElementType };',
    '',
    'export type LyraCSSCustomProperties<Names extends string> = Partial<',
    '  Record<Names, string | number>',
    '>;',
  ].join('\n');
}

function renderReact(elements) {
  const types = elements.map((element) => elementType(element, 'React')).join('\n\n');
  const entries = elements
    .map(({ tagName, className }) => `  ${quoted(tagName)}: ${className}ReactProps;`)
    .join('\n');
  return `${generatedHeader('React 19 and JSX')}\
${imports(elements, "import type * as React from 'react';")}

${sharedEventTypes()}

type LyraReactEventProps<
  ElementType extends HTMLElement,
  ElementEvents extends object,
  EventNames extends string,
> = {
  [Name in EventNames as \`on\${Name}\`]?: (
    event: LyraBoundEvent<ElementType, ElementEvents, Name>,
  ) => void;
} & {
  [Name in EventNames as \`on\${Name}Capture\`]?: (
    event: LyraBoundEvent<ElementType, ElementEvents, Name>,
  ) => void;
};

type LyraReactElementProps<
  ElementType extends HTMLElement,
  PropertyNames extends keyof ElementType,
  PropertyOverrides extends object,
  ElementEvents extends object,
  EventNames extends string,
  CSSNames extends string,
  AttributeAliases extends object,
> = Omit<
  React.HTMLAttributes<ElementType>,
  PropertyNames | keyof AttributeAliases | keyof LyraReactEventProps<ElementType, ElementEvents, EventNames> | 'style'
> &
  React.RefAttributes<ElementType> &
  Partial<Omit<Pick<ElementType, PropertyNames>, keyof PropertyOverrides> & PropertyOverrides> &
  AttributeAliases &
  LyraReactEventProps<ElementType, ElementEvents, EventNames> & {
    style?: React.CSSProperties & LyraCSSCustomProperties<CSSNames>;
  };

${types}

export interface LyraReactIntrinsicElements {
${entries}
}

declare global {
  namespace JSX {
    interface IntrinsicElements extends LyraReactIntrinsicElements {}
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends LyraReactIntrinsicElements {}
  }
}
`;
}

function renderVue(elements) {
  const types = elements.map((element) => elementType(element, 'Vue')).join('\n\n');
  const entries = elements
    .map(({ tagName, className }) => `  ${quoted(tagName)}: ${className}VueProps;`)
    .join('\n');
  return `${generatedHeader('Vue 3')}\
${imports(elements, "import type { EmitFn, HTMLAttributes, PublicProps } from 'vue';")}

${sharedEventTypes()}

type LyraVueEmit<
  ElementType extends HTMLElement,
  ElementEvents extends object,
  EventNames extends string,
> = EmitFn<{
  [Name in EventNames]: (event: LyraBoundEvent<ElementType, ElementEvents, Name>) => void;
}>;

type LyraVueCustomElement<
  ElementType extends HTMLElement,
  PropertyNames extends keyof ElementType,
  PropertyOverrides extends object,
  ElementEvents extends object,
  EventNames extends string,
  CSSNames extends string,
  AttributeAliases extends object,
> = new () => ElementType & {
  /** @deprecated Template prop metadata only; this property does not exist at runtime. */
  $props: Omit<HTMLAttributes, PropertyNames | keyof AttributeAliases | 'style'> &
    Partial<Omit<Pick<ElementType, PropertyNames>, keyof PropertyOverrides> & PropertyOverrides> &
    AttributeAliases &
    PublicProps & {
      style?: HTMLAttributes['style'] | LyraCSSCustomProperties<CSSNames>;
    };
  /** @deprecated Template event metadata only; this property does not exist at runtime. */
  $emit: LyraVueEmit<ElementType, ElementEvents, EventNames>;
};

${types}

export interface LyraVueGlobalComponents {
${entries}
}

declare module 'vue' {
  interface GlobalComponents extends LyraVueGlobalComponents {}
}
`;
}

function renderSvelte(elements) {
  const types = elements.map((element) => elementType(element, 'Svelte')).join('\n\n');
  const entries = elements
    .map(({ tagName, className }) => `  ${quoted(tagName)}: ${className}SvelteProps;`)
    .join('\n');
  const tagEntries = elements
    .map(({ tagName, className }) => `  ${quoted(tagName)}: ${className};`)
    .join('\n');
  return `${generatedHeader('Svelte 5')}\
${imports(elements, "import type { HTMLAttributes } from 'svelte/elements';")}

${sharedEventTypes()}

type LyraSvelteEventProps<
  ElementType extends HTMLElement,
  ElementEvents extends object,
  EventNames extends string,
> = {
  [Name in EventNames as \`on\${Name}\`]?: (
    event: LyraBoundEvent<ElementType, ElementEvents, Name>,
  ) => void | null;
} & {
  [Name in EventNames as \`on:\${Name}\`]?: (
    event: LyraBoundEvent<ElementType, ElementEvents, Name>,
  ) => void | null;
};

type LyraSvelteStyleProps<CSSNames extends string> = {
  [Name in CSSNames as \`style:\${Name}\`]?: string | number | null | undefined;
};

type LyraSvelteElementProps<
  ElementType extends HTMLElement,
  PropertyNames extends keyof ElementType,
  PropertyOverrides extends object,
  ElementEvents extends object,
  EventNames extends string,
  CSSNames extends string,
  AttributeAliases extends object,
> = Omit<
  HTMLAttributes<ElementType>,
  PropertyNames | keyof AttributeAliases | keyof LyraSvelteEventProps<ElementType, ElementEvents, EventNames>
> &
  Partial<Omit<Pick<ElementType, PropertyNames>, keyof PropertyOverrides> & PropertyOverrides> &
  AttributeAliases &
  LyraSvelteEventProps<ElementType, ElementEvents, EventNames> &
  LyraSvelteStyleProps<CSSNames>;

${types}

export interface LyraSvelteElements {
${entries}
}

export interface LyraElementTagNameMap {
${tagEntries}
}

declare module 'svelte/elements' {
  export interface SvelteHTMLElements extends LyraSvelteElements {}
}

declare global {
  interface HTMLElementTagNameMap extends LyraElementTagNameMap {}
}
`;
}

export function generateFrameworkTypes(manifest) {
  const elements = collectElements(manifest);
  if (elements.length === 0) {
    throw new Error('Custom Elements Manifest contains no custom-element declarations');
  }
  return new Map([
    ['src/custom-elements-jsx.ts', renderReact(elements)],
    ['src/svelte.ts', renderSvelte(elements)],
    ['src/vue.ts', renderVue(elements)],
  ]);
}

export function generate({ write = true } = {}) {
  const manifest = expandManifestInheritance(JSON.parse(readFileSync(manifestFile, 'utf8')));
  const output = generateFrameworkTypes(manifest);
  if (write) {
    for (const [relative, text] of output) {
      writeFileSync(path.join(packageDir, relative), text);
    }
  }
  return output;
}

const isMain =
  process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  const output = generate();
  const tagCount = output.get('src/custom-elements-jsx.ts')?.match(/^  'lr-[^']+':/gm)?.length ?? 0;
  console.log(`Generated React, Vue, and Svelte declarations for ${tagCount} custom elements.`);
}
