import { spawn } from 'node:child_process';

/** Run one CI child process; captured output is included in failure diagnostics. */
export function run(command, args, cwd, label, { capture = false } = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, CI: 'true' },
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    let output = '';
    if (capture) {
      child.stdout?.setEncoding('utf8');
      child.stderr?.setEncoding('utf8');
      child.stdout?.on('data', (chunk) => {
        output += chunk;
      });
      child.stderr?.on('data', (chunk) => {
        output += chunk;
      });
    }
    child.once('error', rejectRun);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolveRun(output);
      } else {
        rejectRun(
          new Error(
            `${label} failed${signal ? ` (${signal})` : ` with exit code ${code}`}` +
              (output ? `\n${output.trim()}` : ''),
          ),
        );
      }
    });
  });
}
