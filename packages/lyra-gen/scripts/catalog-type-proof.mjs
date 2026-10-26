import assert from 'node:assert/strict';
import { SymbolFlags } from 'typescript/unstable/sync';

/** Compare the supported JSON schema subset with a source-resolved component property type. */
export function createSchemaTypeProof(project) {
  const checker = project.checker;
  function literals(type, seen = new Set()) {
    if (type?.isTypeParameter()) type = checker.getBaseConstraintOfType(type);
    if (!type || seen.has(type)) return null;
    seen.add(type);
    if (type.isStringLiteralType()) return [type.value];
    if (type.isNumberLiteralType()) return [type.value];
    if (type.isBooleanLiteralType()) return [type.value];
    if (type.isIntrinsicType() && type.intrinsicName === 'null') return [null];
    if (type.isIntrinsicType() && type.intrinsicName === 'undefined') return [];
    if (type.isUnionType()) {
      const branches = type.getTypes().map(branch => literals(branch, new Set(seen)));
      return branches.some(branch => branch === null) ? null : branches.flat();
    }
    return null;
  }
  function assignment(schema, target, location, trail = '') {
    if (target?.isTypeParameter()) target = checker.getBaseConstraintOfType(target);
    if (!target || target.isErrorType() || ['any', 'unknown'].includes(checker.typeToString(target))) return { status: 'unsupported', reason: 'The component type is unresolved or unconstrained.' };
    if ('anyOf' in schema) {
      const branches = schema.anyOf.map(branch => assignment(branch, target, location, trail));
      return branches.find(branch => branch.status !== 'verified') ?? { status: 'verified' };
    }
    if (schema.enum) {
      const allowed = literals(target);
      if (allowed) return schema.enum.every(value => allowed.includes(value)) ? { status: 'verified' } : { status: 'mismatch', reason: `Enum is outside ${checker.typeToString(target)}.` };
    }
    const primitive = schema.type === 'string' ? checker.getStringType() : ['number', 'integer'].includes(schema.type) ? checker.getNumberType() : schema.type === 'boolean' ? checker.getBooleanType() : schema.type === 'null' ? checker.getNullType() : null;
    if (primitive) return checker.isTypeAssignableTo(primitive, target) ? { status: 'verified' } : { status: 'mismatch', reason: `${schema.type} is not assignable to ${checker.typeToString(target)}.` };
    if (target.isUnionType()) {
      const branches = target.getTypes().map(branch => assignment(schema, branch, location, trail));
      return branches.find(branch => branch.status === 'verified') ?? branches.find(branch => branch.status === 'unsupported') ?? branches[0];
    }
    if (schema.type === 'array') {
      if (!checker.isArrayType(target) && !checker.isTupleType(target)) return { status: 'mismatch', reason: 'Array schema targets a non-array component property.' };
      const element = checker.getTypeArguments(target)[0];
      if (!element) return { status: 'unsupported', reason: 'Array element type did not resolve.' };
      return assignment(schema.items, element, location, `${trail}[]`);
    }
    if (schema.type === 'object') {
      if (!target.isObjectType() && !target.isIntersectionType()) return { status: 'unsupported', reason: `Object shape targets ${checker.typeToString(target)}.` };
      for (const [key, child] of Object.entries(schema.properties)) {
        const symbol = checker.getPropertyOfType(target, key);
        if (!symbol) return { status: 'mismatch', reason: `Object member ${trail}.${key} is absent from the component type.` };
        const type = checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration?.resolve(project) ?? location);
        const checked = assignment(child, type, location, `${trail}.${key}`);
        if (checked.status !== 'verified') return checked;
      }
      for (const symbol of checker.getPropertiesOfType(target)) {
        if (!(symbol.flags & SymbolFlags.Optional) && !(schema.required ?? []).includes(symbol.name)) return { status: 'unsupported', reason: `Required component member ${trail}.${symbol.name} is not required by the serialized schema.` };
      }
      return { status: 'verified' };
    }
    return { status: 'unsupported', reason: 'Unsupported component assignment shape.' };
  }

  return { assignment, literals };
}

/** Concrete generics and the serialized side of the trusted table adapter. */
export function createCatalogPropertyProof(project, source) {
  const checker = project.checker;
  const types = new Map(source.statements.filter(node => node.name).map(node => [node.name.text, checker.getTypeAtLocation(node)]));
  const get = name => {
    const type = types.get(name);
    assert.ok(type && !type.isErrorType(), `${name}: concrete catalog type must resolve`);
    assert.ok(!['any', 'unknown'].includes(checker.typeToString(type)), `${name}: concrete catalog type must be constrained`);
    return type;
  };
  const { assignment } = createSchemaTypeProof(project);
  return (property, schema) => {
    if (property === 'select.value') return assignment(schema, get('CatalogSelectValue'), source);
    if (property === 'table.rows') return assignment(schema, get('CatalogTableRows'), source);
    assert.equal(property, 'table.columns', 'Only the three declared concrete/adapter properties use this proof.');
    assert.equal(schema.type, 'array');
    assert.equal(schema.items.type, 'object');
    const { format, ...properties } = schema.items.properties;
    assert.ok(format, 'Table format metadata must remain an explicit serialized field.');
    assert.ok(checker.isTypeAssignableTo(get('CatalogPreparedColumns'), get('CatalogTableColumns')),
      'Prepared column shape and callback must be assignable to the actual component columns.');
    return assignment({ ...schema, items: { ...schema.items, properties,
      required: (schema.items.required ?? []).filter(key => key !== 'format'),
    } }, get('CatalogSerializedColumns'), source);
  };
}
