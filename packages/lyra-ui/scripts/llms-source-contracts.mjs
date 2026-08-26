// Public TypeScript interfaces and free functions do not appear in Custom Elements Manifest
// member tables. This module derives that missing public-contract census from the same explicit
// component/utility inventories that own package.json exports, then fingerprints declaration
// signatures so a new or changed contract cannot silently bypass the authored-reference gate.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parseSync } from 'oxc-parser';
import {
  CURATED_COMPONENT_HELPER_MODULES,
  CURATED_UTILITY_MODULES,
} from './generate-package-exports.mjs';

const POSITION_KEYS = new Set([
  'start',
  'end',
  'loc',
  'range',
  'scopeId',
  'symbolId',
  'referenceId',
  'raw',
]);

function identifierName(node) {
  if (node?.type === 'Identifier') return node.name;
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  return undefined;
}

function exportedName(specifier) {
  return identifierName(specifier?.exported);
}

function importedName(specifier) {
  if (specifier?.type === 'ImportSpecifier') return identifierName(specifier.imported);
  if (specifier?.type === 'ImportNamespaceSpecifier') return '*';
  return specifier?.type === 'ImportDefaultSpecifier' ? 'default' : undefined;
}

function localName(specifier) {
  return identifierName(specifier?.local);
}

function declarationName(declaration) {
  return identifierName(declaration?.id);
}

function contractKind(declaration) {
  if (declaration?.type === 'TSInterfaceDeclaration') return 'interface';
  if (
    declaration?.type === 'FunctionDeclaration' ||
    declaration?.type === 'TSDeclareFunction'
  ) {
    return 'function';
  }
  if (
    declaration?.type === 'VariableDeclarator' &&
    (declaration.init?.type === 'ArrowFunctionExpression' ||
      declaration.init?.type === 'FunctionExpression')
  ) {
    return 'function';
  }
  if (
    declaration?.type === 'ArrowFunctionExpression' ||
    declaration?.type === 'FunctionExpression'
  ) {
    return 'function';
  }
  if (declaration?.type === 'TSTypeAliasDeclaration') return 'type';
  // Non-callable values do not become census rows, but a public type may depend on one through
  // `typeof` (for example `(typeof KEYS)[number]`). Keep those declarations available to the
  // dependency fingerprint so changing the initializer cannot silently change the public type.
  if (declaration?.type === 'VariableDeclarator' && declaration.init) return 'value';
  return undefined;
}

function declarationContracts(declaration) {
  if (declaration?.type === 'VariableDeclaration') return declaration.declarations ?? [];
  return declaration ? [declaration] : [];
}

function publicPattern(node, isInternal = () => false) {
  if (!node || typeof node !== 'object') return null;
  if (node.type === 'Identifier') return { type: 'Identifier', name: node.name };
  if (node.type === 'AssignmentPattern') {
    return {
      type: 'AssignmentPattern',
      left: publicPattern(node.left, isInternal),
      right: canonicalNode(node.right, isInternal),
    };
  }
  if (node.type === 'RestElement') {
    return { type: 'RestElement', argument: publicPattern(node.argument, isInternal) };
  }
  if (node.type === 'ObjectPattern') {
    const properties = (node.properties ?? [])
      .filter((property) => !isInternal(property))
      .map((property) => {
        if (property.type === 'RestElement') return { type: 'RestElement' };
        const key = canonicalComputedPublicKey(property, isInternal) ??
          identifierName(property.key) ??
          canonicalNode(property.key, isInternal);
        const nested =
          property.value?.type === 'ObjectPattern' || property.value?.type === 'ArrayPattern'
            ? publicPattern(property.value, isInternal)
            : property.value?.type === 'AssignmentPattern'
              ? {
                  type: 'AssignmentPattern',
                  // An alias on the left is implementation-local; the property key above is the
                  // public option name. Retain only nested public patterns and the default value.
                  left:
                    property.value.left?.type === 'ObjectPattern' ||
                    property.value.left?.type === 'ArrayPattern'
                      ? publicPattern(property.value.left, isInternal)
                      : null,
                  right: canonicalNode(property.value.right, isInternal),
                }
              : null;
        return { type: 'Property', key, nested };
      })
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
    return {
      type: 'ObjectPattern',
      optional: node.optional === true,
      properties,
      typeAnnotation: canonicalNode(node.typeAnnotation, isInternal),
    };
  }
  if (node.type === 'ArrayPattern') {
    return {
      type: 'ArrayPattern',
      optional: node.optional === true,
      // Array binding names are implementation-local. Preserve only positional/nested public
      // shape; object keys nested inside an array pattern are still caller-authored vocabulary.
      elements: (node.elements ?? []).map((element) => {
        if (!element) return null;
        if (element.type === 'Identifier') return { type: 'Binding' };
        if (element.type === 'RestElement') {
          const argument = element.argument;
          return {
            type: 'RestElement',
            argument:
              argument?.type === 'ObjectPattern' || argument?.type === 'ArrayPattern'
                ? publicPattern(argument, isInternal)
                : null,
          };
        }
        if (element.type === 'AssignmentPattern') {
          return {
            type: 'AssignmentPattern',
            left:
              element.left?.type === 'ObjectPattern' || element.left?.type === 'ArrayPattern'
                ? publicPattern(element.left, isInternal)
                : { type: 'Binding' },
          };
        }
        return publicPattern(element, isInternal);
      }),
      typeAnnotation: canonicalNode(node.typeAnnotation, isInternal),
    };
  }
  return canonicalNode(node, isInternal);
}

function unsupportedComputedPublicKey(node) {
  return (
    node?.computed === true &&
    (node.type === 'Property' ||
      node.type === 'TSPropertySignature' ||
      node.type === 'TSMethodSignature') &&
    node.key?.type !== 'Literal'
  );
}

function canonicalComputedPublicKey(node, isInternal) {
  if (!unsupportedComputedPublicKey(node)) return undefined;
  const kind = isInternal.computedPublicKeyKind?.(node.key);
  if (!kind) {
    throw new Error(
      `Public source contract uses an unsupported computed public key: ` +
      `${identifierName(node.key) ?? node.key?.type ?? 'unknown'}`,
    );
  }
  return { type: 'ComputedPublicKey', kind };
}

function canonicalNode(node, isInternal = () => false) {
  if (node === null || node === undefined) return null;
  if (typeof node !== 'object') return node;
  if (Array.isArray(node)) {
    return node.filter((child) => !isInternal(child)).map((child) => canonicalNode(child, isInternal));
  }
  if (isInternal(node)) return null;
  const computedPublicKey = canonicalComputedPublicKey(node, isInternal);
  if (node.type === 'ObjectPattern' || node.type === 'ArrayPattern') {
    return publicPattern(node, isInternal);
  }

  const result = {};
  for (const key of Object.keys(node).sort()) {
    if (POSITION_KEYS.has(key) || key === 'decorators' || key === 'comments') continue;
    if (key === 'key' && computedPublicKey) {
      result.key = computedPublicKey;
      continue;
    }
    // Function implementation statements are not part of the callable public signature. The
    // census rejects public functions without an explicit return annotation below, so dropping the
    // body cannot hide an inferred return-type change.
    if (
      (node.type === 'FunctionDeclaration' ||
        node.type === 'TSDeclareFunction' ||
        node.type === 'FunctionExpression' ||
        node.type === 'ArrowFunctionExpression') &&
      key === 'body'
    ) {
      continue;
    }
    const canonical = canonicalNode(node[key], isInternal);
    const membersAreOrderIndependent =
      Array.isArray(node[key]) &&
      (node.type === 'TSInterfaceBody' || node.type === 'TSTypeLiteral') &&
      (() => {
        const names = new Set();
        for (const member of node[key]) {
          if (
            member.type !== 'TSPropertySignature' &&
            member.type !== 'TSMethodSignature'
          ) {
            return false;
          }
          const name = identifierName(member.key);
          if (!name || names.has(name)) return false;
          names.add(name);
        }
        return true;
      })();
    result[key] =
      Array.isArray(canonical) &&
      ((node.type === 'TSUnionType' && key === 'types') ||
        membersAreOrderIndependent)
        ? canonical.slice().sort((left, right) =>
            JSON.stringify(left).localeCompare(JSON.stringify(right)),
          )
        : canonical;
  }
  return result;
}

function unwrapValueExpression(node) {
  let current = node;
  while (
    current &&
    (current.type === 'TSAsExpression' ||
      current.type === 'TSTypeAssertion' ||
      current.type === 'TSSatisfiesExpression' ||
      current.type === 'TSNonNullExpression' ||
      current.type === 'ParenthesizedExpression' ||
      current.type === 'ChainExpression')
  ) {
    current = current.expression;
  }
  return current;
}

function isObjectFreezeCall(node) {
  const expression = unwrapValueExpression(node);
  return (
    expression?.type === 'CallExpression' &&
    expression.arguments?.length === 1 &&
    expression.callee?.type === 'MemberExpression' &&
    expression.callee.computed === false &&
    expression.callee.object?.type === 'Identifier' &&
    expression.callee.object.name === 'Object' &&
    expression.callee.property?.type === 'Identifier' &&
    expression.callee.property.name === 'freeze'
  );
}

function explicitlyTypedCallable(node) {
  const callable = unwrapValueExpression(node);
  if (
    callable?.type !== 'ArrowFunctionExpression' &&
    callable?.type !== 'FunctionExpression'
  ) {
    return false;
  }
  return Boolean(
    callable.returnType &&
    (callable.params ?? []).every((parameter) =>
      Boolean(parameter.typeAnnotation ?? parameter.left?.typeAnnotation),
    )
  );
}

function syntacticallyCompleteValue(node, visited = new Set()) {
  const expression = unwrapValueExpression(node);
  if (!expression || visited.has(expression)) return false;
  visited.add(expression);
  if (expression.type === 'Literal' || expression.type === 'TemplateLiteral') return true;
  if (expression.type === 'UnaryExpression') {
    return syntacticallyCompleteValue(expression.argument, visited);
  }
  if (expression.type === 'ArrayExpression') {
    return (expression.elements ?? []).every((element) =>
      element === null ||
      (element.type !== 'SpreadElement' && syntacticallyCompleteValue(element, visited)),
    );
  }
  if (expression.type === 'ObjectExpression') {
    return (expression.properties ?? []).every((property) => {
      if (property.type !== 'Property' || unsupportedComputedPublicKey(property)) return false;
      return syntacticallyCompleteValue(property.value, visited);
    });
  }
  if (
    expression.type === 'ArrowFunctionExpression' ||
    expression.type === 'FunctionExpression'
  ) {
    return explicitlyTypedCallable(expression);
  }
  if (isObjectFreezeCall(expression)) {
    return syntacticallyCompleteValue(expression.arguments[0], visited);
  }
  return false;
}

function staticKeyofValueKeys(node) {
  let expression = unwrapValueExpression(node);
  if (isObjectFreezeCall(expression)) expression = unwrapValueExpression(expression.arguments[0]);
  if (expression?.type !== 'ObjectExpression') return undefined;
  const keys = [];
  for (const property of expression.properties ?? []) {
    if (property.type !== 'Property' || unsupportedComputedPublicKey(property)) return undefined;
    const key = identifierName(property.key);
    if (key === undefined) return undefined;
    keys.push(key);
  }
  return [...new Set(keys)].sort();
}

function assertSyntacticallyCompleteValueDependency(contract, valueMode) {
  if (contract.kind !== 'value') return;
  for (const declaration of contract.declarations) {
    if (declaration.type !== 'VariableDeclarator' || declaration.id?.typeAnnotation) continue;
    const complete = valueMode === 'keyof'
      ? staticKeyofValueKeys(declaration.init) !== undefined
      : syntacticallyCompleteValue(declaration.init);
    if (!complete) {
      throw new Error(
        `Public typeof value dependency requires an explicit or syntactically complete type: ` +
        `${contract.origin}#${contract.declarationName}`,
      );
    }
  }
}

function publicFunctionDeclarations(declarations) {
  const overloads = declarations.filter(
    (declaration) => declaration.type === 'TSDeclareFunction' ||
      (declaration.type === 'FunctionDeclaration' && !declaration.body),
  );
  return overloads.length > 0 ? overloads : declarations;
}

function hasExplicitReturnSignature(contract) {
  if (contract.kind !== 'function') return true;
  return publicFunctionDeclarations(contract.declarations).every((declaration) => {
    if (declaration.type === 'VariableDeclarator') {
      return Boolean(declaration.id?.typeAnnotation || declaration.init?.returnType);
    }
    return Boolean(declaration.returnType);
  });
}

function signatureFingerprint(declarations, isInternal) {
  const signatures = canonicalSignatures(declarations, isInternal);
  return createHash('sha256').update(JSON.stringify(signatures)).digest('hex').slice(0, 20);
}

function applyCanonicalSelector(signature, selector) {
  if (!selector || !signature) return signature;
  const members = signature.type === 'TSInterfaceDeclaration'
    ? signature.body?.body
    : signature.type === 'TSTypeAliasDeclaration' &&
        signature.typeAnnotation?.type === 'TSTypeLiteral'
      ? signature.typeAnnotation.members
      : undefined;
  if (!Array.isArray(members)) return signature;
  const filtered = members.filter((member) => {
    const name = identifierName(member.key);
    return !name || selectorIncludes(selector, name);
  });
  if (signature.type === 'TSInterfaceDeclaration') signature.body.body = filtered;
  else signature.typeAnnotation.members = filtered;
  return signature;
}

function canonicalSignatures(
  declarations,
  isInternal,
  selector = undefined,
  valueMode = undefined,
) {
  return publicFunctionDeclarations(declarations)
    .slice()
    .sort((left, right) => left.start - right.start)
    .map((declaration) => {
      if (
        valueMode === 'keyof' &&
        declaration.type === 'VariableDeclarator' &&
        !declaration.id?.typeAnnotation
      ) {
        return {
          type: 'KeyofValueDeclaration',
          keys: staticKeyofValueKeys(declaration.init),
        };
      }
      const signature = canonicalNode(declaration, isInternal);
      // Public identity lives in `{ module, exportName, kind }`. A local declaration name may be
      // aliased at the export boundary and can change without changing the consumer contract.
      if (signature?.id?.type === 'Identifier') delete signature.id.name;
      // A typed function-valued const publishes the declared callable type, not its initializer's
      // local parameter bindings or implementation expression.
      if (declaration.type === 'VariableDeclarator' && declaration.id?.typeAnnotation) {
        delete signature.init;
      }
      return applyCanonicalSelector(signature, selector);
    });
}

function patternNames(node, names) {
  if (!node) return;
  if (node.type === 'Identifier') {
    names.add(node.name);
    return;
  }
  if (node.type === 'AssignmentPattern') {
    patternNames(node.left, names);
    return;
  }
  if (node.type === 'RestElement') {
    patternNames(node.argument, names);
    return;
  }
  if (node.type === 'ObjectPattern') {
    for (const property of node.properties ?? []) {
      if (property.type === 'RestElement') {
        // The rest binding is local implementation vocabulary, not an object key callers pass.
        continue;
      }
      const key = identifierName(property.key);
      if (key) names.add(key);
      if (
        property.value?.type === 'ObjectPattern' ||
        property.value?.type === 'ArrayPattern'
      ) {
        patternNames(property.value, names);
      } else if (property.value?.type === 'AssignmentPattern') {
        const left = property.value.left;
        if (left?.type === 'ObjectPattern' || left?.type === 'ArrayPattern') {
          patternNames(left, names);
        }
      }
    }
    return;
  }
  if (node.type === 'ArrayPattern') {
    for (const element of node.elements ?? []) {
      const target = element?.type === 'AssignmentPattern' ? element.left : element;
      if (target?.type === 'ObjectPattern' || target?.type === 'ArrayPattern') {
        patternNames(target, names);
      } else if (
        target?.type === 'RestElement' &&
        (target.argument?.type === 'ObjectPattern' || target.argument?.type === 'ArrayPattern')
      ) {
        patternNames(target.argument, names);
      }
    }
  }
}

function nestedContractNames(node, names, isInternal = () => false, visited = new Set()) {
  if (!node || typeof node !== 'object' || visited.has(node) || isInternal(node)) return;
  visited.add(node);
  if (node.type === 'TSPropertySignature' || node.type === 'TSMethodSignature') {
    const supportedComputedKey = unsupportedComputedPublicKey(node) &&
      isInternal.computedPublicKeyKind?.(node.key);
    const name = typeof supportedComputedKey === 'string' && supportedComputedKey.startsWith('Symbol.')
      ? supportedComputedKey
      : supportedComputedKey
        ? undefined
        : identifierName(node.key);
    if (name) names.add(name);
  }
  if (
    node.type === 'TSFunctionType' ||
    node.type === 'TSMethodSignature' ||
    node.type === 'TSCallSignatureDeclaration'
  ) {
    for (const parameter of node.params ?? []) patternNames(parameter, names);
  }
  for (const [key, value] of Object.entries(node)) {
    if (POSITION_KEYS.has(key) || key === 'decorators' || key === 'comments') continue;
    if (Array.isArray(value)) {
      for (const child of value) nestedContractNames(child, names, isInternal, visited);
    } else {
      nestedContractNames(value, names, isInternal, visited);
    }
  }
}

function selectorIncludes(selector, name) {
  if (!selector) return true;
  return selector.kind === 'pick'
    ? selector.keys.includes(name)
    : !selector.keys.includes(name);
}

function composeSelectors(outer, inner) {
  if (!outer) return inner;
  if (!inner) return outer;
  const outerKeys = new Set(outer.keys);
  const innerKeys = new Set(inner.keys);
  if (outer.kind === 'omit' && inner.kind === 'omit') {
    return { kind: 'omit', keys: [...new Set([...outerKeys, ...innerKeys])].sort() };
  }
  if (outer.kind === 'pick' && inner.kind === 'pick') {
    return {
      kind: 'pick',
      keys: [...outerKeys].filter((key) => innerKeys.has(key)).sort(),
    };
  }
  if (outer.kind === 'pick' && inner.kind === 'omit') {
    return {
      kind: 'pick',
      keys: [...outerKeys].filter((key) => !innerKeys.has(key)).sort(),
    };
  }
  return {
    kind: 'pick',
    keys: [...innerKeys].filter((key) => !outerKeys.has(key)).sort(),
  };
}

function declarationMembers(declaration, isInternal, selector) {
  const members = declaration.type === 'TSInterfaceDeclaration'
    ? declaration.body?.body ?? []
    : declaration.type === 'TSTypeAliasDeclaration' &&
        declaration.typeAnnotation?.type === 'TSTypeLiteral'
      ? declaration.typeAnnotation.members ?? []
      : undefined;
  if (!members) return undefined;
  return members.filter((member) => {
    if (isInternal(member)) return false;
    const name = identifierName(member.key);
    return !name || selectorIncludes(selector, name);
  });
}

function namesForDeclarations(declarations, isInternal, selector = undefined) {
  const names = new Set();
  for (const declaration of publicFunctionDeclarations(declarations)) {
    if (declaration.type === 'TSInterfaceDeclaration') {
      for (const member of declarationMembers(declaration, isInternal, selector) ?? []) {
        nestedContractNames(member, names, isInternal);
      }
      continue;
    }
    if (declaration.type === 'TSTypeAliasDeclaration') {
      const members = declarationMembers(declaration, isInternal, selector);
      if (members) {
        for (const member of members) nestedContractNames(member, names, isInternal);
      } else {
        nestedContractNames(declaration.typeAnnotation, names, isInternal);
      }
      continue;
    }
    if (declaration.type === 'VariableDeclarator' && declaration.id?.typeAnnotation) {
      nestedContractNames(declaration.id.typeAnnotation, names, isInternal);
      continue;
    }
    const parameters = declaration.type === 'VariableDeclarator'
      ? declaration.init?.params ?? []
      : declaration.params ?? [];
    for (const parameter of parameters) {
      patternNames(parameter, names);
      nestedContractNames(
        parameter.typeAnnotation ?? parameter.left?.typeAnnotation,
        names,
        isInternal,
      );
    }
    const returnType = declaration.type === 'VariableDeclarator'
      ? declaration.init?.returnType
      : declaration.returnType;
    nestedContractNames(returnType, names, isInternal);
  }
  return [...names];
}

function literalTypeKeys(node) {
  if (node?.type === 'TSLiteralType' && typeof node.literal?.value === 'string') {
    return [node.literal.value];
  }
  if (node?.type === 'TSUnionType') {
    const keys = node.types.flatMap((child) => literalTypeKeys(child) ?? []);
    return keys.length === node.types.length ? keys : undefined;
  }
  return undefined;
}

function effectiveFieldReferenceNodes(node, references) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'TSTypeAnnotation' || node.type === 'TSParenthesizedType') {
    effectiveFieldReferenceNodes(node.typeAnnotation, references);
    return;
  }
  if (node.type === 'TSIntersectionType') {
    for (const type of node.types ?? []) effectiveFieldReferenceNodes(type, references);
    return;
  }
  if (node.type !== 'TSInterfaceHeritage' && node.type !== 'TSTypeReference') return;
  const typeName = node.type === 'TSInterfaceHeritage' ? node.expression : node.typeName;
  const utility = typeReferenceName(typeName);
  const [target, keysNode] = node.typeArguments?.params ?? [];
  const keys = literalTypeKeys(keysNode);
  if (
    (utility === 'Omit' || utility === 'Pick') &&
    target?.type === 'TSTypeReference' &&
    keys
  ) {
    references.push({
      kind: 'type',
      node: target.typeName,
      selector: {
        kind: utility === 'Omit' ? 'omit' : 'pick',
        keys: [...new Set(keys)].sort(),
      },
    });
    return;
  }
  if (
    (utility === 'Readonly' ||
      utility === 'Required' ||
      utility === 'Partial' ||
      utility === 'NonNullable') &&
    target
  ) {
    effectiveFieldReferenceNodes(target, references);
    return;
  }
  references.push({ kind: 'type', node: typeName });
}

function referencedTypeNodes(node, references, visited = new Set()) {
  if (!node || typeof node !== 'object' || visited.has(node)) return;
  visited.add(node);
  if (
    node.type === 'TSTypeOperator' &&
    node.operator === 'keyof' &&
    node.typeAnnotation?.type === 'TSTypeQuery'
  ) {
    references.push({
      kind: 'value',
      node: node.typeAnnotation.exprName,
      valueMode: 'keyof',
    });
    referencedTypeNodes(node.typeAnnotation.typeArguments, references, visited);
    return;
  }
  if (node.type === 'TSInterfaceHeritage') {
    const utility = typeReferenceName(node.expression);
    const [target, keysNode] = node.typeArguments?.params ?? [];
    const keys = literalTypeKeys(keysNode);
    if (
      (utility === 'Omit' || utility === 'Pick') &&
      target?.type === 'TSTypeReference' &&
      keys
    ) {
      references.push({
        kind: 'type',
        node: target.typeName,
        selector: {
          kind: utility === 'Omit' ? 'omit' : 'pick',
          keys: [...new Set(keys)].sort(),
        },
      });
      referencedTypeNodes(target.typeArguments, references, visited);
      return;
    }
    references.push({ kind: 'type', node: node.expression });
  }
  if (node.type === 'TSIndexedAccessType') {
    const keys = literalTypeKeys(node.indexType);
    if (keys && node.objectType?.type === 'TSTypeReference') {
      references.push({
        kind: 'type',
        node: node.objectType.typeName,
        selector: { kind: 'pick', keys: [...new Set(keys)].sort() },
      });
      referencedTypeNodes(node.objectType.typeArguments, references, visited);
      return;
    }
  }
  if (node.type === 'TSTypeReference') {
    const utility = typeReferenceName(node.typeName);
    const [target, keysNode] = node.typeArguments?.params ?? [];
    const keys = literalTypeKeys(keysNode);
    if (
      (utility === 'Omit' || utility === 'Pick') &&
      target?.type === 'TSTypeReference' &&
      keys
    ) {
      references.push({
        kind: 'type',
        node: target.typeName,
        selector: {
          kind: utility === 'Omit' ? 'omit' : 'pick',
          keys: [...new Set(keys)].sort(),
        },
      });
      referencedTypeNodes(target.typeArguments, references, visited);
      return;
    }
    references.push({ kind: 'type', node: node.typeName });
  }
  if (node.type === 'TSTypeQuery') {
    references.push({ kind: 'value', node: node.exprName, valueMode: 'full' });
  }
  for (const [key, value] of Object.entries(node)) {
    if (POSITION_KEYS.has(key) || key === 'decorators' || key === 'comments') continue;
    if (
      key === 'body' &&
      (node.type === 'FunctionDeclaration' ||
        node.type === 'FunctionExpression' ||
        node.type === 'ArrowFunctionExpression')
    ) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const child of value) referencedTypeNodes(child, references, visited);
    } else {
      referencedTypeNodes(value, references, visited);
    }
  }
}

function referenceRoots(contract, selector = undefined) {
  return publicFunctionDeclarations(contract.declarations).flatMap((declaration) => {
    if (declaration.type === 'VariableDeclarator' && declaration.id?.typeAnnotation) {
      return [declaration.id.typeAnnotation];
    }
    const members = declarationMembers(declaration, contract.isInternal, selector);
    if (!members) return [declaration];
    // Heritage can supply selected effective fields, so keep it in the dependency walk. Direct
    // members are already projected here, preventing an omitted/indexed-out field's dependencies
    // from affecting the public fingerprint.
    return [...(declaration.extends ?? []), ...members];
  });
}

function typeReferenceName(node) {
  if (node?.type === 'Identifier') return node.name;
  if (node?.type === 'TSQualifiedName') return identifierName(node.right);
  return undefined;
}

function isEventType(node) {
  if (!node) return false;
  if (node.type === 'TSTypeAnnotation') return isEventType(node.typeAnnotation);
  if (node.type === 'TSTypeReference') {
    return /Event$/u.test(typeReferenceName(node.typeName) ?? '');
  }
  if (node.type === 'TSUnionType') {
    return node.types.length > 0 && node.types.every(isEventType);
  }
  // Native events are sometimes intersected with a compatibility `detail` record. The event side
  // still makes the complete value an Event; the object side only refines it.
  if (node.type === 'TSIntersectionType') return node.types.some(isEventType);
  return false;
}

function isEventMapDeclaration(declaration, isInternal) {
  if (declaration.type !== 'TSInterfaceDeclaration') return false;
  if (/EventMap$/u.test(declarationName(declaration) ?? '')) return true;
  const heritage = declaration.extends ?? [];
  if (
    heritage.some((entry) => /EventMap$/u.test(typeReferenceName(entry.expression) ?? ''))
  ) {
    return true;
  }
  const members = (declaration.body?.body ?? []).filter((member) => !isInternal(member));
  return members.length > 0 &&
    members.some((member) =>
      member.key?.type === 'Literal' &&
      typeof member.key.value === 'string' &&
      member.key.value.startsWith('lr-'),
    ) &&
    members.every((member) => {
    if (member.type !== 'TSPropertySignature' || !isEventType(member.typeAnnotation)) return false;
    // Event maps use event names as keys. A data contract whose sole field stores an originating
    // event (for example `originalEvent: MouseEvent`) is not itself a listener map.
    const key = identifierName(member.key);
    return member.key?.type === 'Literal' || !/Event$/u.test(key ?? '');
    });
}

function isEventMapContract(contract) {
  return contract.kind === 'interface' &&
    contract.declarations.length > 0 &&
    contract.declarations.every((declaration) =>
      isEventMapDeclaration(declaration, contract.isInternal),
    );
}

function resolveRelativeModule(packageDir, fromModule, specifier) {
  if (typeof specifier !== 'string' || !specifier.startsWith('.')) return undefined;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromModule), specifier));
  const candidates = [];
  if (/\.(?:mjs|cjs|js|ts)$/u.test(base)) {
    candidates.push(base.replace(/\.(?:mjs|cjs|js)$/u, '.ts'));
  } else {
    candidates.push(`${base}.ts`, path.posix.join(base, 'index.ts'));
  }
  return candidates.find((candidate) => existsSync(path.join(packageDir, candidate)));
}

function publicExportTargets(value, targets = []) {
  if (typeof value === 'string') targets.push(value);
  else if (value && typeof value === 'object') {
    for (const child of Object.values(value)) publicExportTargets(child, targets);
  }
  return targets;
}

function sourceFilesBelow(directory, packageDir) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFilesBelow(file, packageDir);
    if (
      !entry.name.endsWith('.ts') ||
      /\.(?:test|stories|styles)\.ts$/u.test(entry.name)
    ) {
      return [];
    }
    return [path.relative(packageDir, file).split(path.sep).join(path.posix.sep)];
  });
}

/** Authored TS owners reachable through package.json exports, including the root/AI surfaces. */
function publicPackageSourceModules(packageDir) {
  const packageFile = path.join(packageDir, 'package.json');
  if (!existsSync(packageFile)) return [];
  const manifest = JSON.parse(readFileSync(packageFile, 'utf8'));
  const modules = new Set();
  for (const target of publicExportTargets(manifest.exports)) {
    if (!target.startsWith('./dist/') || target.endsWith('.d.ts')) continue;
    if (target.includes('*')) {
      const prefix = target.slice('./dist/'.length, target.indexOf('*'));
      for (const file of sourceFilesBelow(path.join(packageDir, 'src', prefix), packageDir)) {
        modules.add(file);
      }
      continue;
    }
    if (!target.endsWith('.js')) continue;
    const sourceModule = `src/${target.slice('./dist/'.length, -'.js'.length)}.ts`;
    if (existsSync(path.join(packageDir, sourceModule))) modules.add(sourceModule);
  }
  return [...modules].sort();
}

class SourceContractScanner {
  constructor(packageDir) {
    this.packageDir = packageDir;
    this.moduleCache = new Map();
    this.exportCache = new Map();
  }

  moduleInfo(modulePath) {
    const cached = this.moduleCache.get(modulePath);
    if (cached) return cached;
    const file = path.join(this.packageDir, modulePath);
    if (!existsSync(file)) throw new Error(`Public source-contract module is missing: ${modulePath}`);
    const source = readFileSync(file, 'utf8');
    const parsed = parseSync(modulePath, source, { lang: 'ts', sourceType: 'module' });
    if (parsed.errors.length > 0) {
      throw new Error(`Unable to parse public source-contract module ${modulePath}`);
    }
    const info = {
      modulePath,
      source,
      statements: parsed.program.body,
      locals: new Map(),
      imports: new Map(),
      defaultContracts: [],
    };
    const exportedLocalNames = new Set();
    for (const statement of info.statements) {
      if (statement.type === 'ExportNamedDeclaration') {
        if (statement.declaration) {
          for (const contract of declarationContracts(statement.declaration)) {
            const name = declarationName(contract);
            if (name) exportedLocalNames.add(name);
          }
        } else if (!statement.source) {
          for (const specifier of statement.specifiers ?? []) {
            const name = localName(specifier);
            if (name) exportedLocalNames.add(name);
          }
        }
      } else if (
        statement.type === 'ExportDefaultDeclaration' &&
        statement.declaration?.type === 'Identifier'
      ) {
        exportedLocalNames.add(statement.declaration.name);
      }
    }
    const uniqueSymbolNames = new Set();
    for (const statement of info.statements) {
      const declaration = statement.type === 'ExportNamedDeclaration'
        ? statement.declaration
        : statement;
      const isConstDeclaration =
        declaration?.type === 'VariableDeclaration' && declaration.kind === 'const';
      for (const contract of declarationContracts(declaration)) {
        const hasExplicitUniqueSymbolType =
          contract.id?.typeAnnotation?.typeAnnotation?.type === 'TSTypeOperator' &&
          contract.id.typeAnnotation.typeAnnotation.operator === 'unique' &&
          contract.id.typeAnnotation.typeAnnotation.typeAnnotation?.type === 'TSSymbolKeyword';
        const hasInferredUniqueSymbolType =
          isConstDeclaration &&
          contract.init?.type === 'CallExpression' &&
          contract.init.callee?.type === 'Identifier' &&
          contract.init.callee.name === 'Symbol';
        if (
          contract.type === 'VariableDeclarator' &&
          contract.id?.type === 'Identifier' &&
          !exportedLocalNames.has(contract.id.name) &&
          (hasExplicitUniqueSymbolType || hasInferredUniqueSymbolType)
        ) {
          uniqueSymbolNames.add(contract.id.name);
        }
      }
    }
    const comments = (parsed.comments ?? []).slice().sort((left, right) => left.end - right.end);
    info.isInternal = (node) => {
      if (!node || typeof node.start !== 'number') return false;
      for (let index = comments.length - 1; index >= 0; index -= 1) {
        const comment = comments[index];
        if (comment.end > node.start) continue;
        if (source.slice(comment.end, node.start).trim().length > 0) return false;
        return /(?:^|\s)@internal(?:\s|$)/u.test(comment.value);
      }
      return false;
    };
    info.isInternal.computedPublicKeyKind = (key) => {
      if (key?.type === 'Identifier' && uniqueSymbolNames.has(key.name)) {
        return 'local-unique-symbol';
      }
      if (
        key?.type === 'MemberExpression' &&
        key.object?.type === 'Identifier' &&
        key.object.name === 'Symbol' &&
        key.property?.type === 'Identifier'
      ) {
        return `Symbol.${key.property.name}`;
      }
      return undefined;
    };
    this.moduleCache.set(modulePath, info);

    const addLocal = (
      declaration,
      exportedDeclaration = declaration,
      nameOverride = undefined,
    ) => {
      const name = nameOverride ?? declarationName(declaration);
      const kind = contractKind(declaration);
      if (!name || !kind || info.isInternal(exportedDeclaration)) return undefined;
      const entries = info.locals.get(name) ?? [];
      let entry = entries.find((candidate) => candidate.kind === kind);
      if (entry) {
        entry.declarations.push(declaration);
      } else {
        entry = {
          kind,
          origin: modulePath,
          declarationName: name,
          declarations: [declaration],
          isInternal: info.isInternal,
        };
        entries.push(entry);
        info.locals.set(name, entries);
      }
      return entry;
    };
    const addLocals = (declaration, exportedDeclaration = declaration) => {
      const entries = [];
      for (const contract of declarationContracts(declaration)) {
        const entry = addLocal(contract, exportedDeclaration);
        if (entry) entries.push(entry);
      }
      return entries;
    };
    for (const statement of info.statements) {
      if (statement.type === 'ExportNamedDeclaration' && statement.declaration) {
        addLocals(statement.declaration, statement);
      } else if (statement.type === 'ExportDefaultDeclaration') {
        const declaration = statement.declaration;
        if (declaration?.type !== 'Identifier') {
          const name = declarationName(declaration);
          const entry = name
            ? addLocal(declaration, statement)
            : addLocal(declaration, statement, 'default');
          if (entry) info.defaultContracts.push(entry);
        }
      } else {
        addLocals(statement);
      }
      if (statement.type !== 'ImportDeclaration') continue;
      const target = resolveRelativeModule(this.packageDir, modulePath, statement.source?.value);
      if (!target) continue;
      for (const specifier of statement.specifiers ?? []) {
        const local = localName(specifier);
        const imported = importedName(specifier);
        if (local && imported) info.imports.set(local, { target, imported });
      }
    }
    return info;
  }

  resolveLocalContracts(modulePath, name) {
    const info = this.moduleInfo(modulePath);
    const direct = info.locals.get(name);
    if (direct) return direct;
    const imported = info.imports.get(name);
    if (!imported || imported.imported === '*') return [];
    return this.exportsFor(imported.target).get(imported.imported);
  }

  resolveReference(modulePath, typeName, kind = 'type') {
    let candidates;
    if (typeName?.type === 'Identifier') {
      candidates = this.resolveLocalContracts(modulePath, typeName.name);
    } else {
      if (typeName?.type !== 'TSQualifiedName') return undefined;
      const parts = [];
      let current = typeName;
      while (current?.type === 'TSQualifiedName') {
        parts.unshift(identifierName(current.right));
        current = current.left;
      }
      if (current?.type !== 'Identifier' || parts.some((part) => !part)) return undefined;
      const imported = this.moduleInfo(modulePath).imports.get(current.name);
      if (!imported || imported.imported !== '*' || parts.length !== 1) return undefined;
      candidates = this.exportsFor(imported.target).get(parts[0]);
    }
    if (!Array.isArray(candidates)) return undefined;
    return kind === 'value'
      ? candidates.find((candidate) => candidate.kind === 'value' || candidate.kind === 'function')
      : candidates.find((candidate) => candidate.kind === 'interface' || candidate.kind === 'type');
  }

  referencesFor(contract, selector = undefined, { heritageOnly = false } = {}) {
    const references = [];
    for (const declaration of publicFunctionDeclarations(contract.declarations)) {
      const roots = heritageOnly && declaration.type === 'TSInterfaceDeclaration'
        ? declaration.extends ?? []
        : declaration.type === 'VariableDeclarator' && declaration.id?.typeAnnotation
          ? [declaration.id.typeAnnotation]
          : declarationMembers(declaration, contract.isInternal, selector)
            ? [...(declaration.extends ?? []), ...declarationMembers(
                declaration,
                contract.isInternal,
                selector,
              )]
            : [declaration];
      for (const root of roots) {
        const found = [];
        referencedTypeNodes(root, found);
        const inheritSelector = selector &&
          (contract.kind === 'type' || root.type === 'TSInterfaceHeritage')
          ? selector
          : undefined;
        for (const reference of found) {
          references.push({
            ...reference,
            selector: composeSelectors(inheritSelector, reference.selector),
          });
        }
      }
    }
    return references;
  }

  effectiveFieldReferencesFor(contract, selector = undefined) {
    const references = [];
    for (const declaration of publicFunctionDeclarations(contract.declarations)) {
      const roots = declaration.type === 'TSInterfaceDeclaration'
        ? declaration.extends ?? []
        : declaration.type === 'TSTypeAliasDeclaration'
          ? [declaration.typeAnnotation]
          : [];
      for (const root of roots) {
        const found = [];
        effectiveFieldReferenceNodes(root, found);
        const inheritedSelector = selector &&
          (contract.kind === 'type' || root.type === 'TSInterfaceHeritage')
          ? selector
          : undefined;
        for (const reference of found) {
          references.push({
            ...reference,
            selector: composeSelectors(inheritedSelector, reference.selector),
          });
        }
      }
    }
    return references;
  }

  contractClosure(contract) {
    const closure = [];
    const visited = new Set();
    const visit = (current, selector = undefined, valueMode = undefined) => {
      const key =
        `${current.origin}\u0000${current.declarationName}\u0000${current.kind}\u0000` +
        `${JSON.stringify(selector ?? null)}\u0000${valueMode ?? ''}`;
      if (visited.has(key)) return;
      visited.add(key);
      closure.push({ contract: current, selector, valueMode });
      for (const reference of this.referencesFor(current, selector)) {
        const dependency = this.resolveReference(current.origin, reference.node, reference.kind);
        if (dependency) visit(dependency, reference.selector, reference.valueMode);
      }
    };
    visit(contract);
    return closure;
  }

  exportsFor(modulePath) {
    const cached = this.exportCache.get(modulePath);
    if (cached) return cached;
    const result = new Map();
    const priorities = new Map();
    // Cache before following edges so barrel cycles terminate without recursion overflow.
    this.exportCache.set(modulePath, result);
    const info = this.moduleInfo(modulePath);

    const add = (name, contracts, priority) => {
      if (!name || !contracts) return;
      const incoming = Array.isArray(contracts) ? contracts : [contracts];
      if (incoming.length === 0) return;
      const previousPriority = priorities.get(name);
      if (previousPriority === undefined || priority > previousPriority) {
        result.set(name, incoming.slice());
        priorities.set(name, priority);
        return;
      }
      if (priority < previousPriority) return;
      const existing = result.get(name);
      for (const contract of incoming) {
        const match = existing.find(
          (candidate) =>
            candidate.origin === contract.origin &&
            candidate.declarationName === contract.declarationName &&
            candidate.kind === contract.kind,
        );
        if (!match) {
          // TypeScript permits a type and value with the same public name. Preserve both distinct
          // contract kinds; two competing declarations of the same kind remain ambiguous.
          if (existing.some((candidate) => candidate.kind === contract.kind)) {
            throw new Error(`${modulePath}: duplicate public source contract export ${name}`);
          }
          existing.push(contract);
          continue;
        }
        for (const declaration of contract.declarations) {
          if (!match.declarations.includes(declaration)) match.declarations.push(declaration);
        }
      }
    };

    for (const statement of info.statements) {
      if (statement.type === 'ExportNamedDeclaration') {
        if (statement.declaration) {
          for (const declaration of declarationContracts(statement.declaration)) {
            const name = declarationName(declaration);
            add(name, name ? info.locals.get(name) : undefined, 2);
          }
          continue;
        }
        const target = resolveRelativeModule(
          this.packageDir,
          modulePath,
          statement.source?.value,
        );
        const targetExports = target ? this.exportsFor(target) : undefined;
        for (const specifier of statement.specifiers ?? []) {
          const publicName = exportedName(specifier);
          const imported = localName(specifier);
          add(
            publicName,
            targetExports && imported
              ? targetExports.get(imported)
              : imported
                ? this.resolveLocalContracts(modulePath, imported)
                : undefined,
            2,
          );
        }
        continue;
      }
      if (statement.type === 'ExportDefaultDeclaration') {
        const declaration = statement.declaration;
        add(
          'default',
          declaration?.type === 'Identifier'
            ? this.resolveLocalContracts(modulePath, declaration.name)
            : info.defaultContracts,
          2,
        );
        continue;
      }
      if (statement.type === 'ExportAllDeclaration') {
        const target = resolveRelativeModule(
          this.packageDir,
          modulePath,
          statement.source?.value,
        );
        if (!target) continue;
        if (statement.exported) {
          throw new Error(
            `${modulePath}: unsupported namespace source-contract export ${identifierName(statement.exported) ?? '*'}`,
          );
        }
        for (const [name, contracts] of this.exportsFor(target)) {
          if (name !== 'default') add(name, contracts, 1);
        }
      }
    }
    return result;
  }
}

export function publicSourceContractModules(packageDir, inventoryOverride) {
  const inventory =
    inventoryOverride ??
    JSON.parse(
      readFileSync(path.join(packageDir, 'scripts/fixtures/component-inventory.json'), 'utf8'),
    );
  if (!Array.isArray(inventory?.components)) {
    throw new Error('Public source-contract census requires component inventory entries');
  }
  const families = new Set();
  const inventoryRoutes = [];
  for (const component of inventory.components) {
    if (
      typeof component?.tag !== 'string' ||
      typeof component?.family !== 'string' ||
      typeof component?.classModule !== 'string' ||
      typeof component?.registrationModule !== 'string'
    ) {
      throw new Error('Public source-contract census requires complete component route entries');
    }
    families.add(component.family);
    inventoryRoutes.push(
      component.classModule,
      component.registrationModule,
      `src/components/${component.tag}.ts`,
    );
  }
  return {
    componentModules: [
      ...new Set([
        ...inventoryRoutes,
        ...[...families].map((family) => `src/components/${family}/index.ts`),
        ...publicPackageSourceModules(packageDir),
        ...CURATED_COMPONENT_HELPER_MODULES,
      ]),
    ].sort(),
    utilityModules: [...CURATED_UTILITY_MODULES].sort(),
  };
}

export function sourceContractKey(contract) {
  return `${contract.module}\u0000${contract.exportName}\u0000${contract.kind}`;
}

function normalizedDocumentPath(document) {
  return path.posix.normalize(document.replaceAll('\\', '/')).replace(/^\.\//u, '');
}

function documentLocatorKey(document, locator) {
  const normalizedDocument = normalizedDocumentPath(document);
  if (locator.kind === 'utility') {
    return JSON.stringify([
      normalizedDocument,
      'utility',
      locator.name,
      locator.declaration,
    ]);
  }
  if (locator.kind === 'component') {
    return JSON.stringify([
      normalizedDocument,
      'component',
      locator.tag,
      locator.declaration,
    ]);
  }
  return JSON.stringify([normalizedDocument, 'declaration', locator.name]);
}

/** Derives every exported non-EventMap interface/free function reachable from public owner routes. */
export function sourceContractCensus(
  packageDir,
  { componentModules, utilityModules } = publicSourceContractModules(packageDir),
) {
  const scanner = new SourceContractScanner(packageDir);
  const records = new Map();
  const analysisCache = new Map();
  const utilitySet = new Set(utilityModules);
  const analyze = (contract) => {
    const analysisKey = `${contract.origin}\u0000${contract.declarationName}\u0000${contract.kind}`;
    const cached = analysisCache.get(analysisKey);
    if (cached) return cached;
    if (!hasExplicitReturnSignature(contract)) {
      throw new Error(
        `Public source function requires an explicit return annotation: ${contract.origin}#${contract.declarationName}`,
      );
    }
    const closure = scanner.contractClosure(contract);
    for (const { contract: dependency, valueMode } of closure) {
      if (!hasExplicitReturnSignature(dependency)) {
        throw new Error(
          `Public source function requires an explicit return annotation: ${dependency.origin}#${dependency.declarationName}`,
        );
      }
      assertSyntacticallyCompleteValueDependency(dependency, valueMode);
    }
    const dependencyEdges = [];
    for (const { contract: owner, selector: ownerSelector } of closure) {
      for (const reference of scanner.referencesFor(owner, ownerSelector)) {
        const dependency = scanner.resolveReference(
          owner.origin,
          reference.node,
          reference.kind,
        );
        if (!dependency) continue;
        dependencyEdges.push({
          owner: {
            module: owner.origin,
            name: owner.declarationName,
            kind: owner.kind,
          },
          reference: {
            name: typeReferenceName(reference.node),
            kind: reference.kind,
            selector: reference.selector ?? null,
            valueMode: reference.valueMode ?? null,
          },
          target: {
            module: dependency.origin,
            name: dependency.declarationName,
            kind: dependency.kind,
            signature: canonicalSignatures(
              dependency.declarations,
              dependency.isInternal,
              reference.selector,
              reference.valueMode,
            ),
          },
        });
      }
    }
    const uniqueDependencyEdges = [...new Map(
      dependencyEdges.map((edge) => [JSON.stringify(edge), edge]),
    ).values()].sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    );
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({
        signature: canonicalSignatures(contract.declarations, contract.isInternal),
        dependencies: uniqueDependencyEdges,
      }))
      .digest('hex')
      .slice(0, 20);
    const names = new Set();
    const addNames = (dependency, selector = undefined) => {
      for (const name of namesForDeclarations(
        dependency.declarations,
        dependency.isInternal,
        selector,
      )) names.add(name);
    };
    addNames(contract);
    if (contract.kind === 'interface') {
      // An interface's inherited members are its own effective fields. Follow only heritage/type-
      // alias composition here; ordinary property value types are named dependencies whose own
      // fields do not need to be copied into this declaration's authored signature.
      const visitedHeritage = new Set();
      const addHeritage = (dependency, selector = undefined) => {
        const key =
          `${dependency.origin}\u0000${dependency.declarationName}\u0000${dependency.kind}\u0000` +
          JSON.stringify(selector ?? null);
        if (visitedHeritage.has(key)) return;
        visitedHeritage.add(key);
        addNames(dependency, selector);
        for (const reference of scanner.effectiveFieldReferencesFor(dependency, selector)) {
          const next = scanner.resolveReference(
            dependency.origin,
            reference.node,
            reference.kind,
          );
          if (next) addHeritage(next, reference.selector);
        }
      };
      for (const reference of scanner.effectiveFieldReferencesFor(contract)) {
        const dependency = scanner.resolveReference(
          contract.origin,
          reference.node,
          reference.kind,
        );
        if (dependency) addHeritage(dependency, reference.selector);
      }
    } else if (
      contract.declarations.every(
        (declaration) => declaration.type === 'VariableDeclarator' && declaration.id?.typeAnnotation,
      )
    ) {
      // A callable const publishes the annotated callable type rather than initializer-local
      // bindings, so the referenced type supplies its parameter/option names.
      for (const { contract: dependency, selector } of closure.slice(1)) {
        addNames(dependency, selector);
      }
    }
    const analysis = { fingerprint, names: [...names] };
    analysisCache.set(analysisKey, analysis);
    return analysis;
  };
  for (const publicModule of [...componentModules, ...utilityModules]) {
    for (const [exportName, contracts] of scanner.exportsFor(publicModule)) {
      for (const contract of contracts) {
        if (contract.kind !== 'interface' && contract.kind !== 'function') continue;
        if (isEventMapContract(contract)) continue;
        const { fingerprint, names } = analyze(contract);
        const record = {
          module: contract.origin,
          exportName,
          kind: contract.kind,
          fingerprint,
          names,
          routes: [],
          utilityRoutes: [],
        };
        const key = sourceContractKey(record);
        const existing = records.get(key);
        if (existing && existing.fingerprint !== record.fingerprint) {
          throw new Error(`${key}: conflicting public source-contract signatures`);
        }
        const target = existing ?? record;
        if (!target.routes.includes(publicModule)) target.routes.push(publicModule);
        if (utilitySet.has(publicModule) && !target.utilityRoutes.includes(publicModule)) {
          target.utilityRoutes.push(publicModule);
        }
        records.set(key, target);
      }
    }
  }
  return [...records.values()]
    .map((record) => ({
      ...record,
      routes: record.routes.sort(),
      utilityRoutes: record.utilityRoutes.sort(),
    }))
    .sort((left, right) => sourceContractKey(left).localeCompare(sourceContractKey(right)));
}

/** Exact census/baseline reconciliation. Legacy signature changes require promotion, never a
 * blanket baseline rewrite; every utility contract must have a documented mapping. */
export function validateSourceContractBaseline(census, baseline) {
  const findings = [];
  if (baseline?.schemaVersion !== 1) {
    return ['source-contract baseline schemaVersion must be 1'];
  }
  const expected = new Map();
  const documentedKeys = new Set();
  const locatorOwners = new Map();
  for (const [status, entries] of [
    ['documented', baseline.documented],
    ['legacy', baseline.legacy],
  ]) {
    if (!Array.isArray(entries)) {
      findings.push(`source-contract baseline ${status} entries must be an array`);
      continue;
    }
    for (const entry of entries) {
      const key = sourceContractKey(entry);
      if (expected.has(key)) {
        findings.push(`duplicate source-contract baseline owner ${key}`);
        continue;
      }
      expected.set(key, { ...entry, status });
      if (
        !Array.isArray(entry.routes) ||
        entry.routes.length === 0 ||
        entry.routes.some((route) => typeof route !== 'string') ||
        new Set(entry.routes).size !== entry.routes.length
      ) {
        findings.push(`source-contract baseline owner lacks exact routes: ${key}`);
      }
      if (status === 'documented') {
        documentedKeys.add(key);
        const locator = entry.locator;
        const validLocator =
          typeof entry.document === 'string' &&
          locator &&
          ((locator.kind === 'utility' &&
            typeof locator.name === 'string' &&
            typeof locator.declaration === 'string') ||
            (locator.kind === 'component' &&
              typeof locator.tag === 'string' &&
              typeof locator.declaration === 'string') ||
            (locator.kind === 'declaration' && typeof locator.name === 'string'));
        if (!validLocator) {
          findings.push(`documented source contract lacks a stable locator: ${key}`);
          continue;
        }
        const locatorKey = documentLocatorKey(entry.document, locator);
        const previous = locatorOwners.get(locatorKey);
        if (previous && previous !== key) {
          findings.push(`duplicate source-contract document locator ${locatorKey}`);
        } else {
          locatorOwners.set(locatorKey, key);
        }
      }
    }
  }

  const actual = new Map(census.map((contract) => [sourceContractKey(contract), contract]));
  for (const [key, contract] of actual) {
    const entry = expected.get(key);
    if (!entry) {
      findings.push(`uncatalogued public source contract ${key}`);
    } else if (entry.fingerprint !== contract.fingerprint) {
      findings.push(
        entry.status === 'legacy'
          ? `legacy public source contract changed; promote it to documented enrollment: ${key}`
          : `documented public source contract signature changed: ${key}`,
      );
    }
    if (
      Array.isArray(entry?.routes) &&
      JSON.stringify(entry.routes.slice().sort()) !== JSON.stringify(contract.routes)
    ) {
      findings.push(
        entry.status === 'legacy'
          ? `legacy public source contract changed; promote it to documented enrollment: ${key} (routes)`
          : `public source-contract routes changed: ${key}`,
      );
    }
    if (contract.utilityRoutes.length > 0 && !documentedKeys.has(key)) {
      findings.push(`public utility contract lacks documented enrollment: ${key}`);
    }
  }
  for (const key of expected.keys()) {
    if (!actual.has(key)) findings.push(`stale public source-contract baseline owner ${key}`);
  }
  return findings.sort();
}

export function readSourceContractBaseline(packageDir) {
  return JSON.parse(
    readFileSync(
      path.join(packageDir, 'scripts/fixtures/llms-source-contracts.json'),
      'utf8',
    ),
  );
}
