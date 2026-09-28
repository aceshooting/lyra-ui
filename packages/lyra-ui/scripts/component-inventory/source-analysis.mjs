import fs from 'node:fs';
import path from 'node:path';
import { parseSync } from 'oxc-parser';
import { packageDir } from './paths.mjs';
import { familyFromModule, normalizeManifest } from '../component-inventory.mjs';

function resolveTypeScriptImport(importer, specifier) {
  const target = path.resolve(path.dirname(importer), specifier);
  const candidates = [
    target,
    target.replace(/\.js$/, '.ts'),
    path.join(target, 'index.ts'),
  ];
  return (
    candidates.find(
      (candidate) => fs.existsSync(candidate) && candidate.endsWith('.ts')
    ) || null
  );
}

/** Visit every ESTree-compatible node below `node`, including TypeScript-specific nodes. */
function visitNodes(node, visitor) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visitor(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent' || key === 'type' || key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) {
      for (const child of value) visitNodes(child, visitor);
    } else if (value && typeof value === 'object') visitNodes(value, visitor);
  }
}

function parseOptionalPeerProgram(source, file) {
  const parsed = parseSync(file, source);
  if (parsed.errors.length > 0) {
    const detail = parsed.errors.slice(0, 3).map((error) => error.message).join('; ');
    throw new Error(`${file}: optional-peer parser failed: ${detail}`);
  }
  return parsed.program;
}

function runtimeModuleSpecifiersFromProgram(program) {
  const specifiers = [];
  for (const statement of program.body) {
    if (statement.type === 'ImportDeclaration' && typeof statement.source?.value === 'string') {
      if (statement.importKind === 'type') continue;
      const runtimeBindings = statement.specifiers.filter(
        (specifier) => specifier.type !== 'ImportSpecifier' || specifier.importKind !== 'type'
      );
      if (statement.specifiers.length > 0 && runtimeBindings.length === 0) continue;
      specifiers.push(statement.source.value);
    } else if (
      (statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportAllDeclaration') &&
      typeof statement.source?.value === 'string'
    ) {
      if (statement.exportKind === 'type') continue;
      if (
        statement.type === 'ExportNamedDeclaration' &&
        statement.specifiers.length > 0 &&
        statement.specifiers.every((specifier) => specifier.exportKind === 'type')
      ) continue;
      specifiers.push(statement.source.value);
    }
  }
  visitNodes(program, (node) => {
    if (node.type !== 'ImportExpression') return;
    if (node.source?.type === 'Literal' && typeof node.source.value === 'string') {
      specifiers.push(node.source.value);
    } else if (
      node.source?.type === 'TemplateLiteral' &&
      node.source.expressions.length === 0 &&
      node.source.quasis.length === 1
    ) {
      specifiers.push(node.source.quasis[0].value.cooked);
    }
  });
  return specifiers;
}

/** Runtime module specifiers only; comments, examples, strings and type-only edges never count. */
export function runtimeModuleSpecifiers(source, file = 'component.ts') {
  return runtimeModuleSpecifiersFromProgram(parseOptionalPeerProgram(source, file));
}

const REMOTE_ICON_CAPABILITY_REGISTRATIONS = new Set([
  path.join(packageDir, 'src/components/utility/icon/icon.ts'),
  path.join(packageDir, 'src/components/forms/icon-button/icon-button.ts'),
]);

function rootAuthorSettablePropertyNames(component, rootFile) {
  const names = new Set(
    (component.surface?.properties ?? [])
      .filter(({ readonly }) => readonly !== true)
      .map(({ name }) => name)
  );
  if (names.size > 0) return names;
  const classFile = rootFile.replace(/\.ts$/, '.class.ts');
  if (!fs.existsSync(classFile)) return names;
  const program = parseOptionalPeerProgram(fs.readFileSync(classFile, 'utf8'), classFile);
  visitNodes(program, (node) => {
    const hasPublicPropertyDecorator = (node.decorators ?? []).some(({ expression }) => {
      const callee = expression?.type === 'CallExpression' ? expression.callee : expression;
      return callee?.type === 'Identifier' && callee.name === 'property';
    });
    const isSettableField =
      (node.type === 'PropertyDefinition' || node.type === 'AccessorProperty') &&
      node.readonly !== true &&
      hasPublicPropertyDecorator;
    const isSetter = node.type === 'MethodDefinition' && node.kind === 'set';
    if (
      (isSettableField || isSetter) &&
      node.accessibility !== 'private' &&
      node.accessibility !== 'protected' &&
      node.key?.type === 'Identifier'
    ) {
      names.add(node.key.name);
    }
  });
  return names;
}

function expressionReadsAuthorSettableProperty(expression, propertyNames) {
  let found = false;
  visitNodes(expression, (node) => {
    if (found || node.type !== 'MemberExpression' || node.object?.type !== 'ThisExpression') return;
    const name = node.computed
      ? node.property?.type === 'Literal' && typeof node.property.value === 'string'
        ? node.property.value
        : null
      : node.property?.type === 'Identifier'
        ? node.property.name
        : null;
    if (name && propertyNames.has(name)) found = true;
  });
  return found;
}

const RAW_TEXT_TAGS = new Set([
  'script',
  'style',
  'textarea',
  'title',
  'xmp',
  'iframe',
  'noembed',
  'noframes',
  'noscript',
  'plaintext',
]);

function currentLiveStaticStartTag(prefix) {
  let mode = 'data';
  let tagState = null;
  let tagName = '';
  let start = -1;
  let quote = null;
  let rawTextTag = null;

  const closeStartTag = () => {
    // A trailing slash does not make a non-void HTML raw-text element self-closing.
    mode = RAW_TEXT_TAGS.has(tagName) ? 'raw-text' : 'data';
    rawTextTag = mode === 'raw-text' ? tagName : null;
    tagState = null;
    tagName = '';
    start = -1;
    quote = null;
  };

  for (let index = 0; index < prefix.length; index += 1) {
    const character = prefix[index];

    if (mode === 'comment') {
      if (prefix.startsWith('-->', index)) {
        mode = 'data';
        index += 2;
      }
      continue;
    }

    if (mode === 'raw-text') {
      if (
        rawTextTag !== 'plaintext' &&
        character === '<' &&
        prefix.slice(index + 2, index + 2 + rawTextTag.length).toLowerCase() === rawTextTag &&
        /[\t\n\f\r />]/.test(prefix[index + 2 + rawTextTag.length] ?? '') &&
        prefix[index + 1] === '/'
      ) {
        mode = 'ignored-tag';
        rawTextTag = null;
      }
      continue;
    }

    if (mode === 'ignored-tag') {
      if (character === '>') mode = 'data';
      continue;
    }

    if (mode === 'data') {
      if (prefix.startsWith('<!--', index)) {
        mode = 'comment';
        index += 3;
      } else if (character === '<') {
        if (/[A-Za-z]/.test(prefix[index + 1] ?? '')) {
          mode = 'start-tag';
          tagState = 'tag-name';
          tagName = '';
          start = index;
        } else if (['/', '!', '?'].includes(prefix[index + 1])) {
          mode = 'ignored-tag';
        }
      }
      continue;
    }

    if (tagState === 'quoted-value') {
      if (character === quote) {
        quote = null;
        tagState = 'before-attribute';
      }
      continue;
    }

    if (tagState === 'tag-name') {
      if (/[\t\n\f\r ]/.test(character)) tagState = 'before-attribute';
      else if (character === '/') tagState = 'self-closing';
      else if (character === '>') closeStartTag();
      else tagName += character.toLowerCase();
      continue;
    }

    if (tagState === 'before-attribute') {
      if (/[\t\n\f\r ]/.test(character)) continue;
      if (character === '/') tagState = 'self-closing';
      else if (character === '>') closeStartTag();
      else tagState = 'attribute-name';
      continue;
    }

    if (tagState === 'attribute-name') {
      if (/[\t\n\f\r ]/.test(character)) tagState = 'after-attribute-name';
      else if (character === '=') tagState = 'before-value';
      else if (character === '/') tagState = 'self-closing';
      else if (character === '>') closeStartTag();
      continue;
    }

    if (tagState === 'after-attribute-name') {
      if (/[\t\n\f\r ]/.test(character)) continue;
      if (character === '=') tagState = 'before-value';
      else if (character === '/') tagState = 'self-closing';
      else if (character === '>') closeStartTag();
      else tagState = 'attribute-name';
      continue;
    }

    if (tagState === 'before-value') {
      if (/[\t\n\f\r ]/.test(character)) continue;
      if (character === '"' || character === '\'') {
        quote = character;
        tagState = 'quoted-value';
      } else if (character === '>') closeStartTag();
      else tagState = 'unquoted-value';
      continue;
    }

    if (tagState === 'unquoted-value') {
      if (/[\t\n\f\r ]/.test(character)) tagState = 'before-attribute';
      else if (character === '>') closeStartTag();
      continue;
    }

    if (tagState === 'self-closing') {
      if (character === '>') closeStartTag();
      else if (!/[\t\n\f\r ]/.test(character)) tagState = 'before-attribute';
    }
  }
  return mode === 'start-tag' && start >= 0 ? prefix.slice(start) : '';
}

function programForwardsRemoteIconCapability(program, propertyNames) {
  if (propertyNames.size === 0) return false;
  let forwards = false;
  visitNodes(program, (node) => {
    if (
      forwards ||
      node.type !== 'TaggedTemplateExpression' ||
      node.tag?.type !== 'Identifier' ||
      node.tag.name !== 'html'
    ) return;
    const { expressions, quasis } = node.quasi;
    let prefix = '';
    for (let index = 0; index < expressions.length; index += 1) {
      prefix += quasis[index]?.value?.cooked ?? quasis[index]?.value?.raw ?? '';
      const openTag = currentLiveStaticStartTag(prefix);
      const bindsRemoteCapability =
        /^<\s*lr-(?:icon-button|icon)(?=[\s/>])/i.test(openTag) &&
        /(?:^|[\t\n\f\r ])\.?(?:src|library)\s*=\s*["']?\s*$/i.test(
          quasis[index]?.value?.cooked ?? quasis[index]?.value?.raw ?? ''
        );
      if (
        bindsRemoteCapability &&
        expressionReadsAuthorSettableProperty(expressions[index], propertyNames)
      ) {
        forwards = true;
        return;
      }
      prefix += '\uFFFC';
    }
  });
  return forwards;
}

export function sourceForwardsRemoteIconCapability(
  source,
  propertyNames,
  file = 'component.ts'
) {
  return programForwardsRemoteIconCapability(
    parseOptionalPeerProgram(source, file),
    propertyNames
  );
}

function programDefinesComponent(program) {
  return program.body.some(
    (statement) =>
      statement.type === 'ExpressionStatement' &&
      statement.expression?.type === 'CallExpression' &&
      statement.expression.callee?.type === 'Identifier' &&
      statement.expression.callee.name === 'defineElement'
  );
}

/**
 * Root registration follows the component's reviewed optional-peer policy, never the generated
 * allowlist. Peer-free components are safe to enroll automatically. A new peer-bearing component
 * remains fail-closed until its root behavior is reviewed; existing reviewed lazy-peer inclusion
 * and optional-peer-family exclusion decisions are retained.
 */
export function rootRegistrationMetadata(
  previous,
  optionalPeers,
  tag = previous?.tag ?? 'component'
) {
  if (!Array.isArray(optionalPeers))
    throw new TypeError(`${tag}: optionalPeers must be an array`);
  const priorExclusion = previous?.rootExclusion;
  if (
    ![undefined, null, 'optional-peer-family', 'unreviewed'].includes(
      priorExclusion
    )
  ) {
    throw new Error(
      `${tag}: unsupported root exclusion ${String(priorExclusion)}`
    );
  }
  if (optionalPeers.length === 0)
    return { rootIncluded: true, rootExclusion: null };
  if (priorExclusion === 'optional-peer-family') {
    return { rootIncluded: false, rootExclusion: 'optional-peer-family' };
  }
  if (previous?.rootIncluded === true && priorExclusion === null) {
    return { rootIncluded: true, rootExclusion: null };
  }
  return { rootIncluded: false, rootExclusion: 'unreviewed' };
}

/** A hard rename may inherit only the predecessor's reviewed root-registration policy. Component
 * maturity, qualification, dependencies, and public surface still start from the new tag itself. */
export function rootRegistrationPredecessorTag(tag) {
  return tag === 'lr-geojson-viewer' ? 'lr-geojson-view' : null;
}

export function optionalPeersForComponent(component, packageJson) {
  const peers = Object.keys(packageJson.peerDependencies ?? {}).filter(
    (peer) => packageJson.peerDependenciesMeta?.[peer]?.optional === true
  );
  const found = new Set();
  const seen = new Set();
  const programs = new Map();
  const rootFile = path.join(packageDir, component.registrationModule);
  const propertyNames = rootAuthorSettablePropertyNames(component, rootFile);
  const queue = [{ file: rootFile, rootOwned: true }];
  const deferredRemoteRegistrations = new Map();
  const pendingRootPrograms = [];
  let remoteCapabilityGateReached = false;
  let forwardsRemoteIconCapability = false;
  const checkPendingRootPrograms = () => {
    if (forwardsRemoteIconCapability || pendingRootPrograms.length === 0) return;
    forwardsRemoteIconCapability = pendingRootPrograms.some((program) =>
      programForwardsRemoteIconCapability(program, propertyNames)
    );
    pendingRootPrograms.length = 0;
    if (forwardsRemoteIconCapability) {
      queue.push(...deferredRemoteRegistrations.values());
      deferredRemoteRegistrations.clear();
    }
  };

  while (queue.length) {
    const entry = queue.pop();
    if (!entry || !fs.existsSync(entry.file)) continue;
    const { file } = entry;
    let { rootOwned } = entry;
    let program = programs.get(file);
    if (!program) {
      program = parseOptionalPeerProgram(fs.readFileSync(file, 'utf8'), file);
      programs.set(file, program);
    }

    if (file !== rootFile && REMOTE_ICON_CAPABILITY_REGISTRATIONS.has(file)) {
      rootOwned = false;
      if (!forwardsRemoteIconCapability) {
        remoteCapabilityGateReached = true;
        checkPendingRootPrograms();
      }
      if (!forwardsRemoteIconCapability) {
        deferredRemoteRegistrations.set(file, { file, rootOwned, program });
        continue;
      }
    } else if (rootOwned && file !== rootFile && programDefinesComponent(program)) {
      rootOwned = false;
    }

    const visitKey = `${rootOwned ? 'root' : 'child'}\0${file}`;
    if (seen.has(visitKey)) continue;
    seen.add(visitKey);

    if (rootOwned && !forwardsRemoteIconCapability) {
      pendingRootPrograms.push(program);
      if (remoteCapabilityGateReached) checkPendingRootPrograms();
    }

    for (const specifier of runtimeModuleSpecifiersFromProgram(program)) {
      for (const peer of peers) {
        if (specifier === peer || specifier.startsWith(`${peer}/`)) found.add(peer);
      }
      if (!specifier.startsWith('.')) continue;
      const resolved = resolveTypeScriptImport(file, specifier);
      if (resolved) queue.push({ file: resolved, rootOwned });
    }
  }
  return [...found].sort();
}

export function retainedComponentQualityMetadata(previous) {
  return {
    qualification: structuredClone(
      previous?.qualification ?? {
        status: 'pending-generation',
        humanReview: 'pending',
        reviewer: null,
        reviewedAt: null,
        accessibility: 'not-recorded',
        ledger: 'scripts/fixtures/component-qualification.json',
      }
    ),
    dependencies: structuredClone(
      previous?.dependencies ?? {
        direct: [],
        transitive: [],
        ledger: 'scripts/fixtures/component-integration.json',
      }
    ),
  };
}

export function lyraComponents(manifest, existing, packageJson) {
  const normalized = normalizeManifest(manifest, { ecosystem: 'lyra' });
  const existingByTag = new Map(
    (existing?.components ?? []).map((component) => [component.tag, component])
  );

  return normalized.map((entry) => {
    const classModule = entry.module;
    const registrationModule = classModule.replace(/\.class\.ts$/, '.ts');
    const previous = existingByTag.get(entry.tag);
    const predecessorTag = rootRegistrationPredecessorTag(entry.tag);
    const previousRootRegistration =
      previous ??
      (predecessorTag ? existingByTag.get(predecessorTag) : undefined);
    const component = {
      tag: entry.tag,
      family: familyFromModule(classModule),
      classModule,
      registrationModule,
      rootIncluded: false,
      rootExclusion: 'unreviewed',
      optionalPeers: [],
      maturity: previous?.maturity ?? entry.maturity,
      ...retainedComponentQualityMetadata(previous),
      counterparts: [],
      surface: entry.surface,
    };
    component.optionalPeers = optionalPeersForComponent(component, packageJson);
    Object.assign(
      component,
      rootRegistrationMetadata(
        previousRootRegistration,
        component.optionalPeers,
        entry.tag
      )
    );
    return component;
  });
}
