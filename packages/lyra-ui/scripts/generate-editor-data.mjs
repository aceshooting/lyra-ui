// Regenerates the editor-autocomplete data files from custom-elements.json:
//   - vscode-html-data.json  (VS Code's `html.customData` format -- tag names, attributes, slots)
//   - vscode-css-data.json   (VS Code's `css.customData` format -- every `--lr-*` custom property)
//   - web-types.json         (JetBrains' web-types format -- same coverage, for WebStorm/IntelliJ)
// TypeScript consumers already get tag/attribute completion via the generated
// `HTMLElementTagNameMap` (produced by `tsc` alongside `dist/*.d.ts`). Plain HTML, Vue templates,
// and Angular templates never go through that type graph, so editors need these small JSON data
// files instead -- see https://github.com/microsoft/vscode-custom-data (schema version 1.1) and
// https://github.com/JetBrains/web-types for the formats. custom-elements.json is the single
// source of truth for the components themselves. The manifest records an aliased union by NAME
// (`ButtonVariant`), never its expansion, so ~200 attributes across ~160 aliases used to ship with
// no enumerated values at all -- meaning no editor could offer `variant="…"` completion for any of
// them, which is most of the library's closed string sets. `readTypeAliases()` below resolves those
// names by scanning the source for their declarations, so the value lists are real.
// A regex, not the TypeScript API: this repo pins TypeScript 7's native compiler, which ships no
// JavaScript compiler API at all (`ts.createProgram` and friends are simply absent), so every
// AST-based tool is unavailable. That is workable here only because the contributor contract
// forbids `enum` and requires these sets to be exported literal unions or unambiguous chains of
// those aliases -- a narrow, uniform graph a small parser reads reliably. A declaration it cannot
// parse, a cycle, or an ambiguous name is skipped, never guessed at.
// Wired into `prepack`, right after `manifest`, so these never drift from a freshly regenerated
// custom-elements.json before publish. Also runnable directly: `node
// scripts/generate-editor-data.mjs` (or `pnpm run generate-editor-data`) from `packages/lyra-ui/`
// any time after `pnpm run manifest`.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  htmlDataValues,
  readTypeAliases,
  webTypesValue,
} from './editor-type-values.mjs';
import { cssPropertyDescription } from './editor-css-descriptions.mjs';
import { mergeDesignTokenEditorProperties } from './design-token-editor.mjs';
import { expandManifestInheritance } from './manifest-compact.mjs';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const manifestPath = join(packageDir, 'custom-elements.json');
const htmlDataPath = join(packageDir, 'vscode-html-data.json');
const cssDataPath = join(packageDir, 'vscode-css-data.json');
const webTypesPath = join(packageDir, 'web-types.json');

const manifest = expandManifestInheritance(JSON.parse(readFileSync(manifestPath, 'utf8')));
const pkg = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
const designTokenInput = JSON.parse(
  readFileSync(join(packageDir, 'scripts', 'fixtures', 'token-editor.generated.json'), 'utf8'),
);

function markdown(value) {
  return { kind: 'markdown', value };
}

const TYPE_ALIAS_REGISTRY = readTypeAliases(join(packageDir, 'src'));

function literalValues(typeText) {
  return htmlDataValues(typeText, TYPE_ALIAS_REGISTRY);
}

function deprecationDescription(deprecation) {
  if (!deprecation) return undefined;
  const replacement = deprecation.replacement?.usage ?? deprecation.replacement?.name;
  return `Deprecated since \`${deprecation.since}\`. Use ${deprecation.replacement?.kind ?? 'API'} ` +
    `\`${replacement}\`. Removal is not permitted before \`${deprecation.removalNotBefore}\`. ` +
    deprecation.rationale;
}

function attributeDescriptionText(attribute) {
  const lines = [];
  if (attribute.description) lines.push(attribute.description);
  const deprecation = deprecationDescription(attribute.deprecation);
  if (deprecation) lines.push(deprecation);
  const meta = [];
  if (attribute.type?.text) meta.push(`Type: \`${attribute.type.text}\``);
  if (attribute.default !== undefined) meta.push(`Default: \`${attribute.default}\``);
  if (meta.length) lines.push(meta.join('  \n'));
  return lines.length ? lines.join('\n\n') : undefined;
}

function attributeDescription(attribute) {
  const text = attributeDescriptionText(attribute);
  return text ? markdown(text) : undefined;
}

// web-types' `value.type` is a union expressed as an array, so a closed string set is recorded as
// its literal members (`["'top'", "'bottom'"]`) rather than an opaque alias name — that array is
// what WebStorm/IntelliJ turn into a completion list. An alias that expands (see `expandTypeText`)
// is expanded here too; a bare identifier-shaped type that does not (`boolean`, `string`) is
// recorded as itself; anything else is left undescribed structurally, still covered in prose by
// `attributeDescriptionText` above, rather than guessed at.
function webTypesAttributeValue(attribute) {
  return webTypesValue(attribute.type?.text, TYPE_ALIAS_REGISTRY);
}

function escapeTableCell(text) {
  return (text ?? '').replaceAll('\n', ' ').replaceAll('|', '\\|');
}

function markdownTable(rows) {
  const header = '| Name | Description |\n| --- | --- |';
  const body = rows.map((row) => `| ${row.name} | ${escapeTableCell(row.description)} |`).join('\n');
  return `${header}\n${body}`;
}

function componentMetadataDescription(declaration) {
  if (!declaration.status || !declaration.since) return undefined;
  const lines = [
    '**Component metadata**',
    '',
    `- Status: \`${declaration.status}\``,
    `- Since: \`${declaration.since}\``,
  ];
  if (declaration.maturity?.rationale) lines.push(`- Rationale: ${declaration.maturity.rationale}`);
  if (declaration.maturity?.graduationCriteria) {
    lines.push(`- Graduation: ${declaration.maturity.graduationCriteria}`);
  }
  for (const entry of declaration.deprecations ?? []) {
    const subject = entry.kind === 'component'
      ? `\`${declaration.tagName}\``
      : `\`${entry.name}\`${entry.attribute ? ` / \`${entry.attribute}\`` : ''}`;
    lines.push(`- Deprecated ${entry.kind} ${subject}: ${deprecationDescription(entry)}`);
  }
  return lines.join('\n');
}

function tagDescription(declaration) {
  const sections = [declaration.description || `\`<${declaration.tagName}>\` custom element.`];
  const componentMetadata = componentMetadataDescription(declaration);
  if (componentMetadata) sections.push(componentMetadata);

  if (declaration.slots?.length) {
    sections.push(
      [
        '**Slots**',
        markdownTable(
          declaration.slots.map((slot) => ({
            name: slot.name ? `\`${slot.name}\`` : '(default)',
            description: slot.description,
          })),
        ),
      ].join('\n\n'),
    );
  }

  if (declaration.cssParts?.length) {
    sections.push(
      [
        '**CSS Shadow Parts**',
        markdownTable(
          declaration.cssParts.map((part) => ({ name: `\`${part.name}\``, description: part.description })),
        ),
      ].join('\n\n'),
    );
  }

  if (declaration.cssProperties?.length) {
    sections.push(
      [
        '**CSS Custom Properties**',
        declaration.cssProperties
          .map((prop) => {
            const defaultSuffix = prop.default !== undefined ? ` (default: \`${prop.default}\`)` : '';
            return `- \`${prop.name}\`${defaultSuffix} — ${prop.description ?? ''}`;
          })
          .join('\n'),
      ].join('\n\n'),
    );
  }

  return sections.join('\n\n---\n\n');
}

function collectCustomElements() {
  const declarations = [];
  for (const module of manifest.modules ?? []) {
    for (const declaration of module.declarations ?? []) {
      if (declaration.kind === 'class' && declaration.customElement === true && declaration.tagName) {
        if (!['stable', 'experimental'].includes(declaration.status) ||
            !/^(?:\d+\.\d+\.\d+|unreleased)$/.test(declaration.since ?? '')) {
          throw new Error(`${declaration.tagName} is missing valid CEM status/since metadata`);
        }
        declarations.push(declaration);
      }
    }
  }
  // Sort for a stable, readable diff -- module iteration order isn't part of this script's
  // contract, only custom-elements.json's own content is.
  return declarations.sort((a, b) => a.tagName.localeCompare(b.tagName));
}

const customElements = collectCustomElements();

// --- html.customData ---------------------------------------------------------------------------

const htmlData = {
  version: 1.1,
  tags: customElements.map((declaration) => ({
    name: declaration.tagName,
    description: markdown(tagDescription(declaration)),
    attributes: (declaration.attributes ?? []).map((attribute) => ({
      name: attribute.name,
      description: attributeDescription(attribute),
      values: literalValues(attribute.type?.text),
    })),
  })),
};

writeFileSync(htmlDataPath, `${JSON.stringify(htmlData, null, 2)}\n`);

// --- css.customData ------------------------------------------------------------------------------
// custom-elements.json scopes each `--lr-*` custom property to the component(s) that document
// it via `@cssprop`; css.customData has no per-tag scoping, so properties documented identically
// by multiple components (e.g. `--lr-transition-ambient`) are merged into one entry that lists
// every consuming tag, and properties documented differently per component keep each component's
// own wording as a separate line.

const propertiesByName = new Map();
for (const declaration of customElements) {
  for (const prop of declaration.cssProperties ?? []) {
    if (!propertiesByName.has(prop.name)) propertiesByName.set(prop.name, []);
    propertiesByName.get(prop.name).push({
      tag: declaration.tagName,
      description: prop.description,
      ...(Object.hasOwn(prop, 'default') ? { default: prop.default } : {}),
    });
  }
}
mergeDesignTokenEditorProperties(propertiesByName, designTokenInput);

// Computed once, reused by both css.customData (markdown-wrapped) and web-types (plain string).
const cssProperties = [...propertiesByName.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, entries]) => ({ name, descriptionText: cssPropertyDescription(entries) }));

const cssData = {
  version: 1.1,
  properties: cssProperties.map(({ name, descriptionText }) => ({
    name,
    description: markdown(descriptionText),
  })),
};

writeFileSync(cssDataPath, `${JSON.stringify(cssData, null, 2)}\n`);

// --- web-types.json (JetBrains WebStorm/IntelliJ) -----------------------------------------------
// Nice-to-have companion to the two files above -- same source data, WebStorm/IntelliJ's format
// instead of VS Code's. See https://github.com/JetBrains/web-types (schema at
// https://json.schemastore.org/web-types) -- there is no per-tag `css.customData`-style scoping
// here either (same reasoning as the css.customData section above), and no formal `slots` field on
// a plain `html-element` (unlike Vue/React components, web-types has no first-class slot concept
// for plain custom elements), so slots stay folded into `tagDescription`'s markdown alongside CSS
// parts, same as the VS Code file.
const webTypes = {
  $schema: 'https://json.schemastore.org/web-types',
  name: pkg.name,
  version: pkg.version,
  'description-markup': 'markdown',
  contributions: {
    html: {
      elements: customElements.map((declaration) => ({
        name: declaration.tagName,
        description: tagDescription(declaration),
        attributes: (declaration.attributes ?? []).map((attribute) => {
          const description = attributeDescriptionText(attribute);
          const value = webTypesAttributeValue(attribute);
          return {
            name: attribute.name,
            ...(description ? { description } : {}),
            ...(value ? { value } : {}),
          };
        }),
      })),
    },
    css: {
      properties: cssProperties.map(({ name, descriptionText }) => ({ name, description: descriptionText })),
    },
  },
};

writeFileSync(webTypesPath, `${JSON.stringify(webTypes, null, 2)}\n`);

console.log(
  `Wrote ${customElements.length} tags to vscode-html-data.json, ${cssData.properties.length} custom properties to vscode-css-data.json, and both to web-types.json`,
);
