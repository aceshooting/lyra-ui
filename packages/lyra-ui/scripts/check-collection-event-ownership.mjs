import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { API, SignatureKind } from 'typescript/unstable/sync';
import * as ts from 'typescript/unstable/ast';

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const configPath = path.join(packageRoot, 'tsconfig.json');
const api = new API({ cwd: packageRoot });
const snapshot = api.updateSnapshot({ openProjects: [configPath] });
const project = snapshot.getProject(configPath) ?? snapshot.getProjects()[0];
if (!project) throw new Error(`TypeScript did not load ${configPath}`);
const program = project.program;
const checker = project.checker;

/** Event-map entries intentionally declared by a pure event conduit rather than emitted locally. */
const FORWARDED_EVENT_EXEMPTIONS = new Set([
  'src/components/retrieval/entity-dossier/entity-dossier.class.ts#LyraEntityDossier#lr-chunk-open',
  'src/components/retrieval/provenance-panel/provenance-panel.class.ts#LyraProvenancePanel#lr-chunk-open',
  'src/components/conversation/message-parts/message-parts.class.ts#LyraMessageParts#lr-text-select',
  'src/components/conversation/agent-workspace/agent-workspace.class.ts#LyraAgentWorkspace#lr-citation-select',
  'src/components/data/tree/tree.class.ts#LyraTree#lr-expand',
  'src/components/data/tree/tree.class.ts#LyraTree#lr-after-expand',
  'src/components/data/tree/tree.class.ts#LyraTree#lr-collapse',
  'src/components/data/tree/tree.class.ts#LyraTree#lr-after-collapse',
  'src/components/data/tree/tree.class.ts#LyraTree#lr-lazy-change',
  'src/components/data/tree/tree.class.ts#LyraTree#lr-lazy-load',
]);

function hasStatic(modifiers) {
  return modifiers?.some(
    (modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword,
  );
}

function unwrapInitializer(initializer) {
  let node = initializer;
  while (
    node &&
    (ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node))
  ) {
    node = node.expression;
  }
  if (
    node &&
    ts.isCallExpression(node) &&
    node.arguments.length > 0 &&
    node.expression.getText().endsWith('Object.freeze')
  ) {
    return unwrapInitializer(node.arguments[0]);
  }
  return node;
}

function staticArrayStrings(classNode, source, memberName) {
  for (const member of classNode.members) {
    if (
      !hasStatic(member.modifiers) ||
      !member.name ||
      member.name.getText(source) !== memberName
    ) {
      continue;
    }
    const initializer = unwrapInitializer(member.initializer);
    if (!initializer || !ts.isArrayLiteralExpression(initializer)) return [];
    return initializer.elements
      .filter(
        (entry) =>
          ts.isStringLiteral(entry) ||
          ts.isNoSubstitutionTemplateLiteral(entry),
      )
      .map((entry) => entry.text);
  }
  return [];
}

function collectionPaths(
  type,
  seen = new Set(),
  depth = 0,
  pathName = 'detail',
) {
  if (
    depth > 7 ||
    seen.has(type) ||
    ['any', 'unknown'].includes(checker.typeToString(type))
  ) {
    return [];
  }
  seen.add(type);
  const symbolName =
    type.getAliasSymbol()?.name ?? type.getSymbol()?.name ?? '';
  const stringType = checker.typeToString(type);
  if (
    checker.isArrayType(type) ||
    checker.isTupleType(type) ||
    /^(Readonly)?(Array|Map|Set)</.test(stringType) ||
    /^(Uint|Int|Float|BigInt|BigUint)\d+Array\b/.test(stringType) ||
    symbolName === 'ArrayBuffer' ||
    symbolName === 'DataView'
  ) {
    return [`${pathName}:${stringType}`];
  }
  if (type.isUnionType() || type.isIntersectionType()) {
    return (type.getTypes() ?? []).flatMap((part) =>
      collectionPaths(part, new Set(seen), depth + 1, pathName),
    );
  }
  if (
    !type.isObjectType() ||
    checker.getSignaturesOfType(type, SignatureKind.Call).length > 0
  ) {
    return [];
  }
  const declarations =
    type.getAliasSymbol()?.declarations ?? type.getSymbol()?.declarations ?? [];
  if (
    declarations.length > 0 &&
    declarations.every(
      (declaration) =>
        !declaration
          .resolve(project)
          ?.getSourceFile()
          .fileName.startsWith(packageRoot),
    )
  ) {
    return [];
  }
  const output = [];
  for (const property of checker.getPropertiesOfType(type)) {
    if (property.name === 'prototype' || property.name === 'constructor') {
      continue;
    }
    const declaration = (
      property.valueDeclaration ?? property.declarations?.[0]
    )?.resolve(project);
    if (!declaration) continue;
    const propertyType = checker.getTypeOfSymbolAtLocation(
      property,
      declaration,
    );
    output.push(
      ...collectionPaths(
        propertyType,
        new Set(seen),
        depth + 1,
        `${pathName}.${property.name}`,
      ),
    );
  }
  return output;
}

function classDeclarations(source) {
  const output = [];
  source.forEachChild((node) => {
    if (ts.isClassDeclaration(node) && node.name) output.push(node);
  });
  return output;
}

function sameFileSubclassEnrolls(
  source,
  classes,
  baseClassName,
  eventName,
) {
  return classes.some((candidate) => {
    if (candidate.name?.text === baseClassName) return false;
    const extendsText =
      candidate.heritageClauses
        ?.flatMap((clause) => clause.types)
        .map((entry) => entry.getText(source))
        .join(' ') ?? '';
    return (
      extendsText.includes(baseClassName) &&
      staticArrayStrings(
        candidate,
        source,
        'immutableEventDetails',
      ).includes(eventName)
    );
  });
}

const anchorTargetPath = path.join(
  packageRoot,
  'src/internal/anchor-target.ts',
);
const anchorTargetText = readFileSync(anchorTargetPath, 'utf8');
const anchorTargetOwnsTextSelect =
  /immutableEventDetails[\s\S]{0,160}['"]lr-text-select['"]/.test(
    anchorTargetText,
  );

function sharedAnchorTargetEnrolls(source, classNode, eventName) {
  if (eventName !== 'lr-text-select' || !anchorTargetOwnsTextSelect) return false;
  const sourceText = source.getFullText();
  const className = classNode.name?.text ?? '';
  const ownHeritage =
    classNode.heritageClauses
      ?.flatMap((clause) => clause.types)
      .map((entry) => entry.getText(source))
      .join(' ') ?? '';
  return (
    ownHeritage.includes('DocumentAnchorTarget(') ||
    ownHeritage.includes('TextViewerTarget(') ||
    new RegExp(`DocumentAnchorTarget\\(\\s*${className}\\s*\\)`).test(
      sourceText,
    ) ||
    new RegExp(`TextViewerTarget\\(\\s*${className}\\s*\\)`).test(sourceText)
  );
}

const failures = [];
let reviewedEventCount = 0;
let collectionEventCount = 0;
let inheritedEnrollmentCount = 0;
let forwardedExemptionCount = 0;

for (const sourceFileName of program.getSourceFileNames()) {
  const source = program.getSourceFile(sourceFileName);
  if (!source) continue;
  if (
    !source.fileName.includes('/src/components/') ||
    source.fileName.endsWith('.test.ts')
  ) {
    continue;
  }
  const relativeFile = path.relative(packageRoot, source.fileName);
  const classes = classDeclarations(source);
  for (const classNode of classes) {
    const heritage =
      classNode.heritageClauses?.flatMap((clause) => clause.types) ?? [];
    const lyra = heritage.find((entry) =>
      entry.expression.getText(source).includes('LyraElement'),
    );
    if (!lyra?.typeArguments?.length || !classNode.name) continue;
    const eventMap = checker.getTypeFromTypeNode(lyra.typeArguments[0]);
    if (!eventMap) continue;
    const directEnrollmentList = staticArrayStrings(
      classNode,
      source,
      'immutableEventDetails',
    );
    const directEnrollments = new Set(directEnrollmentList);
    const eventProperties = checker.getPropertiesOfType(eventMap);
    const eventNames = new Set(eventProperties.map((property) => property.name));
    for (const enrolledName of directEnrollmentList) {
      if (!eventNames.has(enrolledName)) {
        failures.push(
          `${relativeFile} ${classNode.name.text}.${enrolledName}: immutableEventDetails names no event-map entry`,
        );
      }
    }
    for (const candidate of classes) {
      if (candidate === classNode) continue;
      const extendsText =
        candidate.heritageClauses
          ?.flatMap((clause) => clause.types)
          .map((entry) => entry.getText(source))
          .join(' ') ?? '';
      if (!extendsText.includes(classNode.name.text)) continue;
      for (const enrolledName of staticArrayStrings(
        candidate,
        source,
        'immutableEventDetails',
      )) {
        if (!eventNames.has(enrolledName)) {
          failures.push(
            `${relativeFile} ${candidate.name?.text ?? '<anonymous>'}.${enrolledName}: inherited immutableEventDetails names no base event-map entry`,
          );
        }
      }
    }

    for (const eventProperty of eventProperties) {
      const declaration =
        (
          eventProperty.valueDeclaration ??
          eventProperty.declarations?.[0]
        )?.resolve(project) ?? classNode;
      const eventType = checker.getTypeOfSymbolAtLocation(
        eventProperty,
        declaration,
      );
      if (!eventType) continue;
      const detailProperty = checker.getPropertyOfType(eventType, 'detail');
      if (!detailProperty) continue;
      const detailDeclaration =
        (
          detailProperty.valueDeclaration ??
          detailProperty.declarations?.[0]
        )?.resolve(project) ?? declaration;
      const detailType = checker.getTypeOfSymbolAtLocation(
        detailProperty,
        detailDeclaration,
      );
      if (!detailType) continue;
      const paths = [...new Set(collectionPaths(detailType))];
      if (paths.length === 0 && !directEnrollments.has(eventProperty.name)) {
        continue;
      }
      reviewedEventCount += 1;
      if (paths.length === 0) continue;
      collectionEventCount += 1;

      const eventName = eventProperty.name;
      const inherited =
        sameFileSubclassEnrolls(
          source,
          classes,
          classNode.name.text,
          eventName,
        ) || sharedAnchorTargetEnrolls(source, classNode, eventName);
      if (inherited) inheritedEnrollmentCount += 1;
      const exemptionKey = `${relativeFile}#${classNode.name.text}#${eventName}`;
      const forwarded = FORWARDED_EVENT_EXEMPTIONS.has(exemptionKey);
      if (forwarded) forwardedExemptionCount += 1;

      if (!directEnrollments.has(eventName) && !inherited && !forwarded) {
        failures.push(
          `${relativeFile} ${classNode.name.text}.${eventName}: ${paths.join(', ')}`,
        );
      }
    }
  }
}

for (const exemption of FORWARDED_EVENT_EXEMPTIONS) {
  const [relativeFile, , eventName] = exemption.split('#');
  const sourceText = readFileSync(path.join(packageRoot, relativeFile), 'utf8');
  const emitPattern = new RegExp(
    `\\.emit\\(\\s*['"]${eventName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`,
  );
  if (emitPattern.test(sourceText)) {
    failures.push(
      `${exemption}: forwarded exemption is invalid because the component emits this event locally`,
    );
  }
}

if (failures.length > 0) {
  console.error(
    `Collection-event ownership check failed (${failures.length} unenrolled path${
      failures.length === 1 ? '' : 's'
    }):`,
  );
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Collection-event ownership check passed (${reviewedEventCount} reviewed event contracts; ` +
      `${collectionEventCount} collection-bearing; ` +
      `${inheritedEnrollmentCount} inherited enrollments; ${forwardedExemptionCount} reviewed conduit exemption).`,
  );
}

snapshot.dispose();
api.close();
