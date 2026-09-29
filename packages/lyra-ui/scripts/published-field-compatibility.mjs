import { jsonBytes, sha256, verifyGitEvidence } from './published-compatibility-io.mjs';

const root = 'packages/lyra-ui/';
const dist = 'package/dist/';
const noticeEqual = '/** @deprecated Use `expanded`, which carries the same value; removal not before 23.0.0. */';
const noticeInverse = '/** @deprecated Use `expanded`, its inverse; removal not before 23.0.0. */';
const noticeRead = '/** The inverse of `expanded`.\n   *  @deprecated Read `expanded` instead; removal not before 23.0.0. */';
const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const hashPattern = /^[a-f0-9]{64}$/u;
const oidPattern = /^[a-f0-9]{40}$/u;
const maxInputs = 96;
const maxMemberBytes = 8 * 1024 * 1024;
const maxArchiveBytes = 16 * 1024 * 1024;

const declarationSpecs = [
  ['layout/details/details.class.ts', 'LyraDetailsToggleDetail', 'open', 'equal', false, noticeEqual],
  ['layout/multi-split/multi-split.class.ts', 'LyraMultiSplitToggleDetail', 'open', 'equal', false, noticeEqual],
  ['layout/navigation-menu-item/navigation-menu-item.class.ts', 'LyraNavigationMenuToggleDetail', 'open', 'equal', false, noticeEqual],
  ['layout/dock-panel/dock-panel.class.ts', 'LyraDockPanelCollapseChangeDetail', 'collapsed', 'inverse', false, noticeInverse],
  ['layout/app-rail/app-rail-item.class.ts', 'LyraAppRailItemToggleDetail', 'open', 'equal', false, noticeEqual],
  ['layout/app-rail/app-rail.class.ts', 'LyraAppRailToggleDetail', 'open', 'equal', false, noticeEqual],
  ['layout/app-rail-group/app-rail-group.class.ts', 'LyraAppRailGroupToggleDetail', 'open', 'equal', false, noticeEqual],
  ['conversation/thread-list/thread-list.class.ts', 'ThreadGroupToggleDetail', 'collapsed', 'inverse', true, noticeRead],
  ['conversation/chat-message/chat-message.class.ts', 'ChatMessageToggleDetail', 'collapsed', 'inverse', false, noticeRead],
  ['conversation/code-block/code-block-shared.ts', 'LyraCodeBlockToggleDetail', 'collapsed', 'inverse', false, noticeRead],
];

const exposureSpecs = [
  ['lr-details', 'lr-toggle', 0, 'layout/details/details.class.ts'],
  ['lr-multi-split', 'lr-toggle-request', 1, 'layout/multi-split/multi-split.class.ts'],
  ['lr-multi-split', 'lr-toggle', 1, 'layout/multi-split/multi-split.class.ts'],
  ['lr-navigation-menu-item', 'lr-toggle', 2, 'layout/navigation-menu-item/navigation-menu-item.class.ts'],
  ['lr-dock-panel', 'lr-collapse-request', 3, 'layout/dock-panel/dock-panel.class.ts'],
  ['lr-dock-panel', 'lr-collapse-change', 3, 'layout/dock-panel/dock-panel.class.ts'],
  ['lr-app-rail-item', 'lr-toggle-request', 4, 'layout/app-rail/app-rail-item.class.ts'],
  ['lr-app-rail-item', 'lr-toggle', 4, 'layout/app-rail/app-rail-item.class.ts'],
  ['lr-app-rail', 'lr-toggle-request', 5, 'layout/app-rail/app-rail.class.ts'],
  ['lr-app-rail', 'lr-toggle', 5, 'layout/app-rail/app-rail.class.ts'],
  ['lr-app-rail-group', 'lr-toggle-request', 6, 'layout/app-rail-group/app-rail-group.class.ts'],
  ['lr-app-rail-group', 'lr-toggle', 6, 'layout/app-rail-group/app-rail-group.class.ts'],
  ['lr-thread-list', 'lr-group-toggle-request', 7, 'conversation/thread-list/thread-list.class.ts'],
  ['lr-thread-list', 'lr-group-toggle', 7, 'conversation/thread-list/thread-list.class.ts'],
  ['lr-chat-message', 'lr-toggle-request', 8, 'conversation/chat-message/chat-message.class.ts'],
  ['lr-chat-message', 'lr-toggle', 8, 'conversation/chat-message/chat-message.class.ts'],
  ['lr-code-block', 'lr-toggle-request', 9, 'conversation/code-block/code-block-base.class.ts'],
  ['lr-code-block', 'lr-toggle', 9, 'conversation/code-block/code-block-base.class.ts'],
  ['lr-code-block-core', 'lr-toggle-request', 9, 'conversation/code-block/code-block-base.class.ts'],
  ['lr-code-block-core', 'lr-toggle', 9, 'conversation/code-block/code-block-base.class.ts'],
];

const routeSpecs = [
  ['lr-details', 'layout/details/details.ts', 'LyraDetails', 'layout/details/details.class.ts'],
  ['lr-multi-split', 'layout/multi-split/multi-split.ts', 'LyraMultiSplit', 'layout/multi-split/multi-split.class.ts'],
  ['lr-navigation-menu-item', 'layout/navigation-menu-item/navigation-menu-item.ts', 'LyraNavigationMenuItem', 'layout/navigation-menu-item/navigation-menu-item.class.ts'],
  ['lr-dock-panel', 'layout/dock-panel/dock-panel.ts', 'LyraDockPanel', 'layout/dock-panel/dock-panel.class.ts'],
  ['lr-app-rail-item', 'layout/app-rail/app-rail-item.ts', 'LyraAppRailItem', 'layout/app-rail/app-rail-item.class.ts'],
  ['lr-app-rail', 'layout/app-rail/app-rail.ts', 'LyraAppRail', 'layout/app-rail/app-rail.class.ts'],
  ['lr-app-rail-group', 'layout/app-rail-group/app-rail-group.ts', 'LyraAppRailGroup', 'layout/app-rail-group/app-rail-group.class.ts'],
  ['lr-thread-list', 'conversation/thread-list/thread-list.ts', 'LyraThreadList', 'conversation/thread-list/thread-list.class.ts'],
  ['lr-chat-message', 'conversation/chat-message/chat-message.ts', 'LyraChatMessage', 'conversation/chat-message/chat-message.class.ts'],
  ['lr-code-block', 'conversation/code-block/code-block.ts', 'LyraCodeBlock', 'conversation/code-block/code-block.class.ts'],
  ['lr-code-block-core', 'conversation/code-block/code-block-core.ts', 'LyraCodeBlockCore', 'conversation/code-block/code-block-core.class.ts'],
];

const codeBlockSourceModules = [
  'conversation/code-block/code-block-base.class.ts',
  'conversation/code-block/code-block.class.ts',
  'conversation/code-block/code-block-core.class.ts',
];

const declarationKeyValue = ([module, detailType, field]) => ({ module, detailType, field });
const fieldContracts = declarationSpecs.map((spec, index) => ({
  index,
  key: declarationKeyValue(spec),
  relation: spec[3],
  expandedOptional: spec[4],
  notice: spec[5],
}));

function ensure(condition, message) { if (!condition) throw new Error(message); }
function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function asBytes(value, label) {
  const bytes = Buffer.isBuffer(value) ? value : typeof value === 'string' ? Buffer.from(value) : null;
  ensure(bytes && bytes.length > 0 && bytes.length <= maxMemberBytes, `Invalid or oversized ${label}`);
  return bytes;
}
function cleanRelativePath(value) {
  ensure(typeof value === 'string' && value.length > 0 && !value.startsWith('/') && !value.includes('\\') &&
    !/[\u0000-\u001f]/u.test(value) && value.split('/').every(part => part && part !== '.' && part !== '..'), 'Unsafe evidence path');
  return value;
}
function safeTarMember(value) {
  const normalized = value.endsWith('/') ? value.slice(0, -1) : value;
  cleanRelativePath(normalized);
  return value;
}
function stable(value) {
  ensure(typeof value === 'string' && stableVersion.test(value), `Invalid stable release version: ${String(value)}`);
  return value;
}
function parseTextFiles(files, expectedPaths, label) {
  ensure(plain(files), `Invalid ${label} file map`);
  const expected = new Set(expectedPaths);
  ensure(Object.keys(files).length === expected.size && Object.keys(files).every(path => expected.has(path)), `${label} input set is incomplete or contains unrelated files`);
  return Object.fromEntries(expectedPaths.map(path => [path, asBytes(files[path], `${label} file ${path}`).toString('utf8')]));
}

/** A declaration identity is a JSON tuple, so path/type/field separators cannot collide. */
export function fieldDeclarationKey(key) {
  ensure(plain(key) && ['module', 'detailType', 'field'].every(name => typeof key[name] === 'string' && key[name].length > 0), 'Invalid field declaration identity');
  cleanRelativePath(key.module);
  ensure(/^[A-Za-z_$][\w$]*$/u.test(key.detailType) && /^[A-Za-z_$][\w$]*$/u.test(key.field), 'Invalid field declaration identity');
  return JSON.stringify([key.module, key.detailType, key.field]);
}

/** Exposure identity is a tuple and includes the exact nested declaration it exposes. */
export function fieldExposureKey(key) {
  ensure(plain(key) && typeof key.tag === 'string' && /^lr-[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(key.tag) && typeof key.event === 'string' && key.event.startsWith('lr-'), 'Invalid event-detail exposure identity');
  return JSON.stringify([key.tag, key.event, fieldDeclarationKey(key.declaration)]);
}

/** Exact required releases; a missing attachment is an error, never an empty declaration set. */
export const REQUIRED_FIELD_RELEASES = Object.freeze(['lyra-ui@22.0.0', 'lyra-ui@22.1.0', 'lyra-ui@23.0.0']);

const toSourcePath = relative => `${root}src/components/${relative}`;
const sourceDeclarationPaths = declarationSpecs.map(([module]) => toSourcePath(module));
const sourceCodeBlockPaths = codeBlockSourceModules.map(toSourcePath);
const sourceRoutePaths = routeSpecs.flatMap(([, registration, , classModule]) => {
  const fileTag = routeSpecs.find(entry => entry[1] === registration)?.[0];
  return [toSourcePath(registration), ...(fileTag ? [`${root}src/components/${fileTag}.ts`] : []), toSourcePath(classModule)];
});
const sourcePaths = [...new Set([...sourceDeclarationPaths, ...sourceCodeBlockPaths, ...sourceRoutePaths])].sort();

const packedClassDtsPaths = [...new Set([
  ...declarationSpecs.map(([module]) => `${dist}components/${module.replace(/\.ts$/u, '.d.ts')}`),
  ...codeBlockSourceModules.map(module => `${dist}components/${module.replace(/\.ts$/u, '.d.ts')}`),
])];
const packedRuntimePaths = [...new Set([
  ...declarationSpecs.filter(([, detailType]) => detailType !== 'LyraCodeBlockToggleDetail').map(([module]) => `${dist}components/${module.replace(/\.ts$/u, '.js')}`),
  ...codeBlockSourceModules.map(module => `${dist}components/${module.replace(/\.ts$/u, '.js')}`),
  ...routeSpecs.map(([, registration]) => `${dist}components/${registration.replace(/\.ts$/u, '.js')}`),
  ...routeSpecs.map(([tag]) => `${dist}components/${tag}.js`),
])];

function findInterface(source, name) {
  const match = new RegExp(`\\bexport\\s+interface\\s+${name}\\b(?:\\s+extends\\s+[^{]+)?\\s*\\{`, 'u').exec(source);
  ensure(match, `Missing exported detail interface ${name}`);
  let index = match.index + match[0].length; let depth = 1;
  for (; index < source.length && depth; index++) {
    if (source[index] === '{') depth++;
    else if (source[index] === '}') depth--;
  }
  ensure(depth === 0, `Unclosed detail interface ${name}`);
  return source.slice(match.index, index);
}
function propertyShape(interfaceText, field) {
  const pattern = new RegExp(`(?<readonly>readonly\\s+)?\\b${field}(?<optional>\\?)?\\s*:\\s*(?<type>[A-Za-z_$][\\w$]*(?:\\s*\\|\\s*[A-Za-z_$][\\w$]*)*)\\s*;`, 'gu');
  const matches = [...interfaceText.matchAll(pattern)];
  ensure(matches.length === 1, `Expected exactly one ${field} field`);
  const item = matches[0].groups;
  const preceding = interfaceText.slice(0, matches[0].index);
  const docStart = preceding.lastIndexOf('/**');
  const docEnd = preceding.lastIndexOf('*/');
  const docText = docStart >= 0 && docEnd > docStart && /^\s*$/u.test(preceding.slice(docEnd + 2)) ? preceding.slice(docStart, docEnd + 2).trim() : null;
  return { type: item.type.replace(/\s+/gu, ''), optional: Boolean(item.optional), readonly: Boolean(item.readonly), notice: docText };
}
function normalizedNotice(value) {
  return value?.replace(/^\/\*\*|\*\/$/gu, '').replace(/^\s*\*\s?/gmu, '').replace(/\s+/gu, ' ').trim() ?? null;
}
function extractDeclaration(files, path, key) {
  const text = files[path];
  ensure(typeof text === 'string', `Missing declaration evidence ${path}`);
  const interfaceText = findInterface(text, key.detailType);
  const deprecated = propertyShape(interfaceText, key.field);
  const expanded = propertyShape(interfaceText, 'expanded');
  return { deprecated, expanded };
}
function relationPattern(relation, field) {
  if (relation === 'equal') {
    return new RegExp(`(?:\\b${field}\\s*:\\s*([A-Za-z_$][\\w$]*(?:\\.[A-Za-z_$][\\w$]*)?)\\s*,\\s*expanded\\s*:\\s*\\1\\b|\\b${field}\\s*:\\s*expanded\\s*,\\s*expanded(?:\\s*[,}])|\\b${field}\\s*,\\s*expanded\\s*:\\s*${field}\\b|\\bexpanded\\s*:\\s*([A-Za-z_$][\\w$]*(?:\\.[A-Za-z_$][\\w$]*)?)\\s*,\\s*${field}\\s*:\\s*\\2\\b|\\bexpanded\\s*:\\s*${field}\\s*,\\s*${field}(?:\\s*[,}]))`, 'u');
  }
  return new RegExp(`(?:\\b${field}\\s*:\\s*([A-Za-z_$][\\w$]*(?:\\.[A-Za-z_$][\\w$]*)?)\\s*,\\s*expanded\\s*:\\s*!\\s*\\1\\b|\\bexpanded\\s*:\\s*!\\s*([A-Za-z_$][\\w$]*(?:\\.[A-Za-z_$][\\w$]*)?)\\s*,\\s*${field}\\s*:\\s*\\2\\b|\\bexpanded\\s*:\\s*([A-Za-z_$][\\w$]*(?:\\.[A-Za-z_$][\\w$]*)?)\\s*,\\s*${field}\\s*:\\s*!\\s*\\3\\b|\\bexpanded\\s*:\\s*!\\s*${field}\\s*,\\s*${field}(?:\\s*[,}])|\\b${field}\\s*,\\s*expanded\\s*:\\s*!\\s*${field}\\b|\\bexpanded\\s*:\\s*${field}\\s*,\\s*${field}\\s*:\\s*!\\s*${field}\\b)`, 'u');
}
function normalizedJs(text) { return text.replace(/\s+/gu, ' '); }
function hasRuntimeContract(text, event, field, relation) {
  const compact = normalizedJs(text);
  ensure(compact.includes(event), `Missing runtime emitter event ${event}`);
  ensure(relationPattern(relation, field).test(compact), `Runtime payload does not preserve ${relation} ${field}/expanded values for ${event}`);
  return true;
}
function hasEventType(text, event, detailType) {
  return new RegExp(`['\"]${event}['\"]\\s*:\\s*CustomEvent\\s*<\\s*${detailType}\\s*>`, 'u').test(text);
}
function routeForTag(tag, packageJson) {
  const entry = packageJson?.exports?.[`./components/${tag}.js`];
  ensure(plain(entry) && typeof entry.default === 'string' && typeof entry.types === 'string', `Missing public package route for ${tag}`);
  ensure(entry.default === `./dist/components/${tag}.js` && entry.types.startsWith('./dist/'), `Unexpected public route for ${tag}`);
  cleanRelativePath(entry.default.slice(2)); cleanRelativePath(entry.types.slice(2));
  return { runtimePath: entry.default.slice('./dist/'.length), declarationPath: entry.types.slice('./dist/'.length) };
}

const routeSourcePath = tag => `${root}src/components/${tag}.ts`;
const sourcePackagePath = relative => `${root}src/components/${relative}`;
const packedPath = relative => `${dist}components/${relative}`;

/**
 * Extracts the ten nested declarations and twenty typed/runtime exposures from explicitly closed
 * source and packed module maps. Static emitter evidence proves bytes/shape only; browser behavior
 * such as veto/order remains the installed consumer gate's responsibility.
 */
export function derivePublishedFieldFacts({ sourceRelease, sourceVersion, packageJson, sourceFiles, packedFiles }) {
  stable(sourceVersion);
  ensure(sourceRelease === `lyra-ui@${sourceVersion}` && packageJson?.name === '@aceshooting/lyra-ui' && packageJson?.version === sourceVersion, 'Field-evidence release identity mismatch');
  const source = parseTextFiles(sourceFiles, sourcePaths, 'source');
  const requiredPacked = [...new Set([
    ...packedClassDtsPaths,
    ...packedRuntimePaths,
    ...routeSpecs.map(([tag]) => {
      const route = routeForTag(tag, packageJson);
      return route.runtimePath.startsWith('components/') ? `package/dist/${route.runtimePath}` : `package/dist/${route.runtimePath}`;
    }),
    ...routeSpecs.map(([tag]) => `package/dist/${routeForTag(tag, packageJson).declarationPath}`),
  ])].sort();
  const packed = parseTextFiles(packedFiles, requiredPacked, 'packed');
  for (const path of Object.keys(packed)) ensure(path.startsWith('package/dist/'), 'Packed field evidence must use package dist paths');

  const declarationFacts = fieldContracts.map(contract => {
    const sourcePath = sourcePackagePath(contract.key.module);
    const packedDeclarationPath = packedPath(contract.key.module.replace(/\.ts$/u, '.d.ts'));
    const sourceShape = extractDeclaration(source, sourcePath, contract.key);
    const packedShape = extractDeclaration(packed, packedDeclarationPath, contract.key);
    for (const shape of [sourceShape, packedShape]) {
      ensure(shape.deprecated.type === 'boolean' && shape.deprecated.optional === false, `Deprecated field shape changed: ${fieldDeclarationKey(contract.key)}`);
      ensure(shape.expanded.type === 'boolean' && shape.expanded.optional === contract.expandedOptional, `Expanded field shape changed: ${fieldDeclarationKey(contract.key)}`);
      const normalized = normalizedNotice(shape.deprecated.notice);
      const expectedNotice = normalizedNotice(contract.notice);
      ensure(normalized === expectedNotice && /removal not before 23\.0\.0\./u.test(normalized), `Deprecated field notice changed: ${fieldDeclarationKey(contract.key)} (expected ${JSON.stringify(expectedNotice)}, found ${JSON.stringify(normalized)})`);
    }
    ensure(normalizedNotice(sourceShape.deprecated.notice) === normalizedNotice(packedShape.deprecated.notice), `Source and package field notices disagree: ${fieldDeclarationKey(contract.key)}`);
    ensure(sourceShape.deprecated.readonly === packedShape.deprecated.readonly && sourceShape.expanded.readonly === packedShape.expanded.readonly, `Source and package readonly shape disagree: ${fieldDeclarationKey(contract.key)}`);
    return {
      key: contract.key,
      notice: normalizedNotice(sourceShape.deprecated.notice),
      noticeJSDoc: sourceShape.deprecated.notice,
      noticeFloor: '23.0.0',
      relation: contract.relation,
      deprecatedField: sourceShape.deprecated,
      expandedField: sourceShape.expanded,
      sourcePath,
      packedDeclarationPath,
      sourceSha256: sha256(Buffer.from(source[sourcePath])),
      packedSha256: sha256(Buffer.from(packed[packedDeclarationPath])),
    };
  });

  const exposureFacts = exposureSpecs.map(([tag, event, declarationIndex, eventModule]) => {
    const contract = fieldContracts[declarationIndex];
    const emitterSourcePath = sourcePackagePath(eventModule);
    const emitterPackedPath = packedPath(eventModule.replace(/\.ts$/u, '.js'));
    const aliasSourcePath = routeSourcePath(tag);
    const routeSpec = routeSpecs.find(([routeTag]) => routeTag === tag);
    const registrationSourcePath = sourcePackagePath(routeSpec[1]);
    const route = routeForTag(tag, packageJson);
    const typeRoutePath = `package/dist/${route.declarationPath}`;
    const runtimeRoutePath = `package/dist/${route.runtimePath}`;
    const declarationDtsPath = packedPath(routeSpec[3].replace(/\.ts$/u, '.d.ts'));
    const alias = source[aliasSourcePath]; const registration = source[registrationSourcePath];
    ensure(alias && registration && alias.includes(`./${routeSpec[1].replace(/\.ts$/u, '.js')}`), `Source tag alias no longer reaches ${tag}`);
    ensure(registration.includes(`defineElement('${tag.slice(3)}', ${routeSpec[2]})`) && registration.includes(`./${routeSpec[3].split('/').at(-1).replace(/\.ts$/u, '.js')}`), `Source registration route changed for ${tag}`);
    const classEventSource = source[emitterSourcePath];
    if (tag.startsWith('lr-code-block')) {
      const wrapperPath = sourcePackagePath(routeSpec[3]);
      ensure(source[wrapperPath].includes('export type { LyraCodeBlockToggleDetail }') && source[wrapperPath].includes('LyraCodeBlockBaseEventMap'), `Code-block type route changed for ${tag}`);
      ensure(hasEventType(classEventSource, event, contract.key.detailType), `Source shared event detail route changed for ${tag}/${event}`);
    } else ensure(hasEventType(classEventSource, event, contract.key.detailType), `Source event detail route changed for ${tag}/${event}`);
    const emitterDeclarationPath = packedPath(eventModule.replace(/\.ts$/u, '.d.ts'));
    ensure(hasEventType(packed[emitterDeclarationPath], event, contract.key.detailType), `Packed event detail route changed for ${tag}/${event}`);
    const classModuleName = `./${routeSpec[3].split('/').at(-1).replace(/\.ts$/u, '.js')}`;
    ensure(packed[typeRoutePath]?.includes(classModuleName) && packed[declarationDtsPath], `Packed public type route is missing for ${tag}: ${typeRoutePath}, expected ${classModuleName}, class declaration ${Boolean(packed[declarationDtsPath])}`);
    const emitterRuntimePath = packedPath(eventModule.replace(/\.ts$/u, '.js'));
    hasRuntimeContract(source[emitterSourcePath], event, contract.key.field, contract.relation);
    hasRuntimeContract(packed[emitterRuntimePath], event, contract.key.field, contract.relation);
    const registrationPackedPath = `${dist}components/${routeSpec[1].replace(/\.ts$/u, '.js')}`;
    const registrationSpecifier = `./${routeSpec[1].replace(/\.ts$/u, '.js')}`;
    ensure(packed[runtimeRoutePath]?.includes(registrationSpecifier) && packed[registrationPackedPath], `Packed registration route is missing for ${tag}`);
    const key = { tag, event, declaration: contract.key };
    return {
      key,
      role: event.endsWith('-request') ? 'request' : 'settled',
      emitterPath: eventModule,
      emitterPackedPath,
      registrationPath: registrationSourcePath,
      tagEntryPath: aliasSourcePath,
      publicRuntimePath: runtimeRoutePath,
      publicDeclarationPath: typeRoutePath,
      relation: contract.relation,
      staticBehaviorEvidence: 'source-and-packed-emitter-bytes-only',
      sourceSha256: sha256(Buffer.from(source[emitterSourcePath])),
      packedSha256: sha256(Buffer.from(packed[emitterPackedPath])),
      tagEntrySha256: sha256(Buffer.from(alias)),
      registrationSourceSha256: sha256(Buffer.from(registration)),
      packedRegistrationSha256: sha256(Buffer.from(packed[registrationPackedPath])),
      publicRuntimeSha256: sha256(Buffer.from(packed[runtimeRoutePath])),
      publicDeclarationSha256: sha256(Buffer.from(packed[typeRoutePath])),
    };
  });
  ensure(declarationFacts.length === 10 && exposureFacts.length === 20, 'Field evidence inventory count mismatch');
  ensure(new Set(declarationFacts.map(item => fieldDeclarationKey(item.key))).size === 10, 'Duplicate field declaration');
  ensure(new Set(exposureFacts.map(item => fieldExposureKey(item.key))).size === 20, 'Duplicate field exposure');
  return { schemaVersion: 1, sourceRelease, sourceVersion, declarations: declarationFacts, exposures: exposureFacts };
}

export function buildFieldEvidenceIndex(attachments, requiredReleases = REQUIRED_FIELD_RELEASES) {
  ensure(Array.isArray(requiredReleases) && JSON.stringify(requiredReleases) === JSON.stringify(REQUIRED_FIELD_RELEASES), 'Invalid required field release set');
  const byRelease = new Map();
  for (const { attachment, descriptorSha256 } of attachments) {
    ensure(!byRelease.has(attachment.sourceRelease), `Duplicate field attachment ${attachment.sourceRelease}`);
    ensure(requiredReleases.includes(attachment.sourceRelease) && hashPattern.test(descriptorSha256), 'Unexpected field attachment release or descriptor hash');
    byRelease.set(attachment.sourceRelease, descriptorSha256);
  }
  ensure(byRelease.size === requiredReleases.length, 'Field-evidence index requires every required release');
  return { schemaVersion: 1, requiredReleases: [...requiredReleases], attachments: requiredReleases.filter(release => byRelease.has(release)).map(sourceRelease => ({ sourceRelease, descriptorSha256: byRelease.get(sourceRelease) })) };
}

export function validateFieldEvidenceIndex(index, attachments) {
  ensure(index?.schemaVersion === 1 && JSON.stringify(index.requiredReleases) === JSON.stringify(REQUIRED_FIELD_RELEASES) && Array.isArray(index.attachments), 'Unsupported or altered field-evidence index');
  ensure(index.attachments.length === REQUIRED_FIELD_RELEASES.length, 'Field-evidence index is missing a required release');
  const expected = new Map(index.attachments.map(item => [item.sourceRelease, item.descriptorSha256]));
  ensure(expected.size === index.attachments.length && expected.size === REQUIRED_FIELD_RELEASES.length, 'Duplicate field-evidence index release');
  ensure(attachments.length === REQUIRED_FIELD_RELEASES.length, 'Field-evidence attachment set is incomplete');
  const actual = new Map(attachments.map(({ attachment, descriptorSha256 }) => [attachment.sourceRelease, descriptorSha256 ?? attachment.descriptorSha256]));
  ensure(actual.size === attachments.length && REQUIRED_FIELD_RELEASES.every(release => actual.has(release) && expected.get(release) === actual.get(release)), 'Field-evidence descriptors disagree with index');
  ensure([...actual.keys()].every(release => REQUIRED_FIELD_RELEASES.includes(release)), 'Unexpected field-evidence release');
  return true;
}

/** Continuity only: deliberately produces no field retirement or eligibility decision. */
export function verifyPublishedFieldContinuity({ captures, attachments, requiredReleases = REQUIRED_FIELD_RELEASES }) {
  ensure(Array.isArray(captures) && Array.isArray(attachments), 'Invalid field continuity inputs');
  ensure(JSON.stringify(requiredReleases) === JSON.stringify(REQUIRED_FIELD_RELEASES), 'Field continuity release set differs from the approved exact set');
  const captureByRelease = new Map(captures.map(value => [value.capture?.sourceRelease ?? value.sourceRelease, value]));
  const attachmentByRelease = new Map(attachments.map(value => [value.attachment?.sourceRelease ?? value.sourceRelease, value]));
  ensure(captureByRelease.size === captures.length && attachmentByRelease.size === attachments.length, 'Duplicate field continuity release');
  ensure(captures.length === requiredReleases.length && attachments.length === requiredReleases.length, 'Field continuity requires every published release witness');
  const normalized = [];
  for (const release of requiredReleases) {
    const capture = captureByRelease.get(release); const attached = attachmentByRelease.get(release);
    ensure(capture && attached, `Missing field continuity release ${release}`);
    const ordinary = capture.capture ?? capture;
    const attachment = attached.attachment ?? attached;
    ensure(attachment.sourceRelease === ordinary.sourceRelease && attachment.sourceVersion === ordinary.sourceVersion, `Field evidence does not bind ordinary capture ${release}`);
    ensure(attachment.git?.commit === ordinary.git?.commit && attachment.git?.tagObject === ordinary.git?.tagObject, `Field source tag differs from ordinary capture ${release}`);
    ensure(attachment.captureDescriptorSha256 === sha256(jsonBytes(ordinary)), `Field attachment is not pinned to ordinary capture ${release}`);
    ensure(attachment.package?.tarballSha256 === ordinary.package?.tarballSha256 && attachment.package?.registryIntegrity === ordinary.package?.registryIntegrity, `Field npm package evidence differs from ordinary capture ${release}`);
    const facts = attached.facts ?? attached.verified?.facts;
    ensure(facts?.sourceRelease === release && facts.declarations?.length === 10 && facts.exposures?.length === 20, `Incomplete field facts ${release}`);
    normalized.push(facts);
  }
  const shape = facts => ({
    declarations: facts.declarations.map(({ key, notice, noticeFloor, relation, deprecatedField, expandedField }) => ({ key, notice, noticeFloor, relation, deprecatedField, expandedField })),
    exposures: facts.exposures.map(({ key, role, relation, publicRuntimePath, publicDeclarationPath }) => ({ key, role, relation, publicRuntimePath, publicDeclarationPath })),
  });
  const baseline = JSON.stringify(shape(normalized[0]));
  ensure(normalized.slice(1).every(facts => JSON.stringify(shape(facts)) === baseline), 'Nested event-detail field contract changed across published releases');
  return normalized.map(facts => ({ sourceRelease: facts.sourceRelease, declarationCount: facts.declarations.length, exposureCount: facts.exposures.length, observed: true, facts: structuredClone(facts) }));
}

/** Validates an attachment from exact bytes without consulting a mutable repository or registry. */
export function validatePublishedFieldAttachment({ attachment, facts, evidence, evidenceArchiveBytes, ordinaryCapture, ordinaryCaptureBytes, tarMembers, packageJson }) {
  ensure(attachment?.schemaVersion === 1 && attachment.extractorVersion === 1 && evidence?.schemaVersion === 1, 'Unsupported field attachment schema');
  ensure(REQUIRED_FIELD_RELEASES.includes(attachment.sourceRelease) && attachment.sourceRelease === `lyra-ui@${attachment.sourceVersion}` && stable(attachment.sourceVersion) === attachment.sourceVersion, 'Field attachment release identity mismatch');
  ensure(attachment.package?.name === '@aceshooting/lyra-ui' && attachment.package.version === attachment.sourceVersion, 'Field attachment package identity mismatch');
  ensure(hashPattern.test(attachment.package.tarballSha256) && /^sha512-[A-Za-z0-9+/]{86}==$/u.test(attachment.package.registryIntegrity), 'Invalid field attachment npm proof pins');
  ensure(oidPattern.test(attachment.git?.tagObject) && oidPattern.test(attachment.git?.commit), 'Invalid field attachment Git identity');
  ensure(hashPattern.test(attachment.captureDescriptorSha256) && hashPattern.test(attachment.evidenceArchiveSha256) && hashPattern.test(attachment.factsSha256), 'Invalid field attachment hash');
  ensure((Buffer.isBuffer(evidenceArchiveBytes) || evidenceArchiveBytes instanceof Uint8Array) && sha256(Buffer.from(evidenceArchiveBytes)) === attachment.evidenceArchiveSha256, 'Field evidence archive hash mismatch');
  ensure(sha256(jsonBytes(ordinaryCapture)) === attachment.captureDescriptorSha256, 'Field attachment capture descriptor pin mismatch');
  ensure(ordinaryCapture.sourceRelease === attachment.sourceRelease && ordinaryCapture.sourceVersion === attachment.sourceVersion && ordinaryCapture.git?.commit === attachment.git.commit && ordinaryCapture.git?.tagObject === attachment.git.tagObject, 'Field attachment Git release differs from ordinary capture');
  ensure(JSON.stringify(ordinaryCapture.package) === JSON.stringify(attachment.package), 'Field attachment npm identity differs from ordinary capture');
  ensure(sha256(Buffer.from(ordinaryCaptureBytes)) === attachment.captureDescriptorSha256, 'Ordinary capture descriptor bytes mismatch');
  ensure(Array.isArray(tarMembers) && new Set(tarMembers).size === tarMembers.length, 'Duplicate tar member');
  const safeMembers = tarMembers.map(safeTarMember);
  ensure(new Set(safeMembers.map(value => value.endsWith('/') ? value.slice(0, -1) : value)).size === safeMembers.length, 'Duplicate canonical tar member');
  ensure(attachment.tarball?.memberCount === safeMembers.length && sha256(jsonBytes(tarMembers)) === attachment.tarball.membersSha256, 'Field tar member inventory hash mismatch');
  const expected = expectedFieldInputPaths(packageJson);
  ensure(Array.isArray(attachment.inputs) && attachment.inputs.length === expected.length && attachment.inputs.length <= maxInputs, 'Field attachment input inventory is incomplete or oversized');
  const expectedSet = new Set(expected.map(item => `${item.origin}:${item.path}`));
  const usedInputs = new Set(); const usedPayloads = new Set(); const gitInputs = []; const sourceFiles = Object.create(null); const packedFiles = Object.create(null);
  for (const input of attachment.inputs) {
    ensure(plain(input) && ['source', 'packed'].includes(input.origin) && ['source-declaration', 'source-runtime', 'packed-declaration', 'packed-runtime'].includes(input.role) && typeof input.path === 'string', 'Invalid field attachment input');
    cleanRelativePath(input.path);
    const inputKey = `${input.origin}:${input.path}`;
    ensure(expectedSet.has(inputKey) && !usedInputs.has(inputKey), `Unexpected or duplicate field input ${inputKey}`);
    const expectedRole = expected.find(item => item.origin === input.origin && item.path === input.path)?.role;
    ensure(input.role === expectedRole, `Field input role changed for ${input.path}`);
    ensure(hashPattern.test(input.sha256) && Number.isSafeInteger(input.bytes) && input.bytes >= 1 && input.bytes <= maxMemberBytes, 'Invalid field input hash or byte length');
    const encoded = evidence.payloads?.[input.sha256];
    ensure(typeof encoded === 'string', `Missing field input payload ${input.path}`);
    const bytes = Buffer.from(encoded, 'base64');
    ensure(bytes.toString('base64') === encoded && bytes.length === input.bytes && sha256(bytes) === input.sha256, `Field input bytes disagree ${input.path}`);
    if (input.origin === 'source') {
      ensure(input.path.startsWith(root) && oidPattern.test(input.gitBlob), 'Source input has no Git blob identity');
      gitInputs.push({ ...input, data: encoded });
      sourceFiles[input.path] = bytes;
    } else {
      ensure(input.path.startsWith('package/') && input.gitBlob === null && safeMembers.includes(input.path), 'Packed input has no matching tar member');
      packedFiles[input.path] = bytes;
    }
    usedInputs.add(inputKey); usedPayloads.add(input.sha256);
  }
  ensure(expectedSet.size === usedInputs.size && Object.keys(evidence.payloads).length === usedPayloads.size, 'Field evidence includes missing inputs or unrelated payloads');
  verifyGitEvidence({ pin: { ...attachment.git, tag: attachment.sourceRelease }, objects: evidence.gitObjects, inputs: gitInputs });
  ensure(sha256(jsonBytes(facts)) === attachment.factsSha256, 'Field facts hash mismatch');
  const derived = derivePublishedFieldFacts({ sourceRelease: attachment.sourceRelease, sourceVersion: attachment.sourceVersion, packageJson, sourceFiles, packedFiles });
  ensure(JSON.stringify(derived) === JSON.stringify(facts), 'Field facts do not match exact source and packed evidence');
  return { facts: derived, verified: true };
}

/** Exact allowlist shared by capture and hermetic attachment validation. */
export function expectedFieldInputPaths(packageJson) {
  const declarationSources = new Set(sourceDeclarationPaths);
  const source = sourcePaths.map(path => ({ origin: 'source', role: declarationSources.has(path) ? 'source-declaration' : 'source-runtime', path }));
  const packed = new Set([...packedClassDtsPaths, ...packedRuntimePaths]);
  for (const [tag] of routeSpecs) {
    const route = routeForTag(tag, packageJson);
    packed.add(`package/dist/${route.runtimePath}`);
    packed.add(`package/dist/${route.declarationPath}`);
  }
  const packedInputs = [...packed].map(path => ({ origin: 'packed', role: path.endsWith('.d.ts') ? 'packed-declaration' : 'packed-runtime', path }));
  const result = [...source, ...packedInputs].sort((a, b) => `${a.origin}:${a.path}`.localeCompare(`${b.origin}:${b.path}`));
  ensure(result.length <= maxInputs && new Set(result.map(item => `${item.origin}:${item.path}`)).size === result.length, 'Invalid field evidence allowlist');
  return result;
}

export const FIELD_DECLARATION_KEYS = Object.freeze(fieldContracts.map(item => item.key));
export const FIELD_EXPOSURE_KEYS = Object.freeze(exposureSpecs.map(([tag, event, index]) => ({ tag, event, declaration: fieldContracts[index].key })));
