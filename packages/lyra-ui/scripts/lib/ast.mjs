import { parseSync } from 'oxc-parser';

/** Parse source with the common checker diagnostic. */
export function parseProgram(file, source) {
  const result = parseSync(file, source);
  if (result.errors.length > 0) {
    const details = result.errors.map((error) => error.message ?? String(error)).join('\n');
    throw new SyntaxError(`${file} could not be parsed:\n${details}`);
  }
  return result.program;
}

/** Visit ESTree-compatible nodes, including TypeScript nodes. */
export function visitAst(node, visitor) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visitor(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) {
      for (const child of value) visitAst(child, visitor);
    } else if (value && typeof value === 'object') {
      visitAst(value, visitor);
    }
  }
}

/** Whether an abrupt statement prevents later statements in its sequence from running. */
export function statementAlwaysStopsFollowingStatements(statement) {
  if (
    statement.type === 'ReturnStatement' ||
    statement.type === 'ThrowStatement' ||
    statement.type === 'BreakStatement' ||
    statement.type === 'ContinueStatement'
  ) {
    return true;
  }
  if (statement.type === 'BlockStatement') {
    return statement.body.some((child) => statementAlwaysStopsFollowingStatements(child));
  }
  if (statement.type === 'TryStatement') {
    // A completing finally controls whether execution can continue after the try statement. When
    // it falls through, an abrupt try still stays abrupt unless a catch can handle the throw. A
    // return cannot be caught; conservatively treat every abrupt try body with no catch as final.
    if (statement.finalizer && statementAlwaysStopsFollowingStatements(statement.finalizer)) return true;
    return !statement.handler && statementAlwaysStopsFollowingStatements(statement.block);
  }
  return false;
}
