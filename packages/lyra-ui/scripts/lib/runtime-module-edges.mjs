/** Runtime edges in static-declaration order followed by dynamic-import preorder.
 * Parsing, resolution, registration and reachability policy belong to the caller.
 * Accepts the acyclic Oxc Program shape; duplicate specifiers remain separate edges.
 */
export function runtimeModuleEdges(program) {
  const edges = [];
  for (const statement of program.body) {
    if (statement.type === 'ImportDeclaration' && typeof statement.source?.value === 'string') {
      if (statement.importKind === 'type') continue;
      const values = statement.specifiers.filter(
        (specifier) => specifier.type !== 'ImportSpecifier' || specifier.importKind !== 'type',
      );
      // Empty imports still evaluate the target; all-type binding lists do not.
      if (statement.specifiers.length > 0 && values.length === 0) continue;
      edges.push({ specifier: statement.source.value,
        bindings: values.map((specifier) => specifier.local?.name).filter(Boolean), kind: 'static-import' });
    } else if (
      (statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportAllDeclaration') &&
      typeof statement.source?.value === 'string'
    ) {
      if (statement.exportKind === 'type') continue;
      if (statement.type === 'ExportNamedDeclaration' && statement.specifiers.length > 0 &&
        statement.specifiers.every((specifier) => specifier.exportKind === 'type')) continue;
      edges.push({ specifier: statement.source.value, bindings: [], kind: 're-export' });
    }
  }
  visitNodes(program, (node) => {
    if (node.type !== 'ImportExpression') return;
    if (node.source?.type === 'Literal' && typeof node.source.value === 'string') {
      edges.push({ specifier: node.source.value, bindings: [], kind: 'dynamic-import' });
    } else if (node.source?.type === 'TemplateLiteral' && node.source.expressions.length === 0 &&
      node.source.quasis.length === 1) {
      edges.push({ specifier: node.source.quasis[0].value.cooked, bindings: [], kind: 'dynamic-import' });
    }
  });
  return edges;
}

function visitNodes(node, visitor) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visitor(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent' || key === 'type' || key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) for (const child of value) visitNodes(child, visitor);
    else if (value && typeof value === 'object') visitNodes(value, visitor);
  }
}
