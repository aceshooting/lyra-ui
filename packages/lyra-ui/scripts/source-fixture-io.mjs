import fs from 'node:fs';
import path from 'node:path';

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

/** JSON.parse validates syntax; the token walk additionally rejects overwritten object keys. */
export function parseSourceJson(source, label) {
  const result = JSON.parse(source);
  const tokens = source.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g);
  let index = 0;
  function value() {
    const token = tokens[index++];
    if (token === '{') {
      const seen = new Set();
      while (tokens[index] !== '}') {
        const key = JSON.parse(tokens[index++]);
        invariant(!seen.has(key), `${label}: duplicate JSON key ${key}`);
        seen.add(key);
        index++; // colon; JSON.parse already checked the grammar.
        value();
        if (tokens[index] === ',') index++;
      }
      index++;
    } else if (token === '[') {
      while (tokens[index] !== ']') {
        value();
        if (tokens[index] === ',') index++;
      }
      index++;
    }
  }
  value();
  return result;
}

export function assertRegularSourcePath(packageDir, file, { missing = false, directory: isDirectory = false } = {}) {
  invariant(path.isAbsolute(packageDir) && fs.realpathSync(packageDir) === packageDir, 'Source root must be an absolute directory without symlinks');
  const relative = path.relative(packageDir, file);
  invariant(relative && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative), `Path escapes package: ${file}`);
  let current = packageDir;
  const segments = relative.split(path.sep);
  for (let index = 0; index < segments.length; index++) {
    current = path.join(current, segments[index]);
    const last = index === segments.length - 1;
    if (last && missing && !fs.existsSync(current)) {
      // existsSync follows links: a dangling link is still forbidden.
      try { fs.lstatSync(current); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
    }
    const stat = fs.lstatSync(current);
    invariant(!stat.isSymbolicLink() && (last && !isDirectory ? stat.isFile() : stat.isDirectory()), `Not a regular ${last && !isDirectory ? 'file' : 'directory'} (symlinks forbidden): ${current}`);
  }
}

export function readSourceSnapshot(packageDir, relative, { missing = false, binary = false } = {}) {
  const file = path.join(packageDir, relative);
  assertRegularSourcePath(packageDir, file, { missing });
  let descriptor;
  try { descriptor = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW); }
  catch (error) {
    if (missing && error.code === 'ENOENT') {
      assertRegularSourcePath(packageDir, file, { missing: true });
      return { file, original: null };
    }
    throw error;
  }
  try {
    invariant(fs.fstatSync(descriptor).isFile(), `Not a regular source file: ${file}`);
    return { file, original: fs.readFileSync(descriptor, binary ? undefined : 'utf8') };
  } finally { fs.closeSync(descriptor); }
}

/** Guard the complete read/write set before staging any replacement. */
export function commitSourceWritePlan(plan) {
  invariant(new Set(plan.entries.map(entry => entry.file)).size === plan.entries.length, 'Duplicate source write path');
  for (const entry of plan.entries) {
    // Binary authority is read-only. Writable fixtures keep their existing string semantics.
    if (Buffer.isBuffer(entry.original) || Buffer.isBuffer(entry.expected)) {
      invariant(Buffer.isBuffer(entry.original) && entry.expected === entry.original,
        `Binary source guards must be read-only: ${entry.file}`);
      continue;
    }
    invariant((typeof entry.original === 'string' || entry.original === null) &&
      (typeof entry.expected === 'string' || entry.expected === null), `Invalid source write bytes: ${entry.file}`);
    invariant(entry.expected !== null || entry.original === null, `Source write plans cannot delete files: ${entry.file}`);
  }
  const check = entry => {
    const binary = Buffer.isBuffer(entry.original);
    const actual = readSourceSnapshot(plan.root, path.relative(plan.root, entry.file), { missing: entry.original === null, binary }).original;
    invariant(binary ? actual.equals(entry.original) : actual === entry.original, `${entry.file}: changed while source fixtures were being prepared`);
  };
  plan.entries.forEach(check);
  const staged = [];
  const committed = [];
  let failure;
  const recoveryErrors = [];
  try {
    for (const entry of plan.entries.filter(entry => entry.original !== entry.expected)) {
      const temporary = `${entry.file}.source-${process.pid}-${staged.length}`;
      const descriptor = fs.openSync(temporary, 'wx', entry.original === null ? 0o644 : fs.statSync(entry.file).mode);
      staged.push({ ...entry, temporary });
      try { fs.writeFileSync(descriptor, entry.expected); }
      finally { fs.closeSync(descriptor); }
    }
    plan.entries.forEach(check);
    for (const entry of staged) {
      check(entry);
      fs.renameSync(entry.temporary, entry.file);
      committed.push(entry);
    }
  } catch (error) {
    failure = error;
    for (const entry of committed.reverse()) {
      try {
        // A concurrent deletion, link replacement or edit must not prevent independent files
        // from being restored, nor be overwritten by this transaction's rollback.
        const actual = readSourceSnapshot(plan.root, path.relative(plan.root, entry.file), { missing: true }).original;
        if (actual !== entry.expected) continue;
        if (entry.original === null) fs.unlinkSync(entry.file);
        else {
          const descriptor = fs.openSync(entry.temporary, 'wx', fs.statSync(entry.file).mode);
          try { fs.writeFileSync(descriptor, entry.original); }
          finally { fs.closeSync(descriptor); }
          assertRegularSourcePath(plan.root, entry.file);
          fs.renameSync(entry.temporary, entry.file);
        }
      } catch (recoveryError) { recoveryErrors.push(recoveryError); }
    }
  } finally {
    for (const entry of staged) {
      try {
        assertRegularSourcePath(plan.root, entry.temporary, { missing: true });
        fs.rmSync(entry.temporary, { force: true });
      } catch (recoveryError) { recoveryErrors.push(recoveryError); }
    }
  }
  if (recoveryErrors.length) throw new AggregateError(
    [...(failure ? [failure] : []), ...recoveryErrors],
    `${failure?.message ?? 'Source cleanup failed'}; some concurrent paths could not be restored or cleaned`,
  );
  if (failure) throw failure;
}
