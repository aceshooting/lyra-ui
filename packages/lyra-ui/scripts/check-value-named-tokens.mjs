// Caps the value-named token family at its current size, so it can shrink but never grow.
//
// `--lr-size-1-25rem`, `--lr-size-2px`, `--lr-size-2-5ch` and 80-odd siblings name a token after its
// VALUE. The name is a lie the moment a theme retunes it, and the family exists only because
// `check-style-policy.mjs` forbids a raw dimension anywhere in `src/components/**/*.styles.ts`, so
// every one-off length had to be hoisted into a shared token to get past the gate.
//
// It is deliberately NOT emptied in 8.0.0, and that is a measured decision rather than an omission.
// Of the 89 tokens, only 13 have an existing semantic equivalent by VALUE, and checking ROLE kills
// most of those: `--lr-size-0-375rem` matches `--lr-radius` exactly and is never used as a radius
// (it is padding, gap and a dot size); `--lr-size-1px` matches `--lr-border-width-thin` and is also
// used for `gap`, `block-size` and a `background-image` stop. The remaining 76 are genuine one-offs
// -- `2.5ch` of monospace gutter, a `38rem` panel cap, a `-6px` optical nudge -- with no honest
// semantic name available. Renaming them onto a scale they do not belong to would trade a bad name
// for a WRONG one, and moving each into a component-local role-named property would add several
// hundred entries to the public `@cssprop` surface for no reader benefit.
//
// So: the family is frozen. An existing entry may be deleted (when a call site finds a real semantic
// home) but a new one may not be added, which is what stops the workaround from compounding.
//
// Run: node scripts/check-value-named-tokens.mjs

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const tokensPath = join(packageDir, 'src', 'internal', 'tokens.styles.ts');

// The ceiling, measured on the 8.0.0 branch after the --lr-font-size-m/-md collision was resolved.
// Lower it whenever the real count drops; never raise it.
const CEILING = 89;

const declared = [
  ...readFileSync(tokensPath, 'utf8').matchAll(/^\s*(--lr-size-[a-z0-9-]*[0-9][a-z0-9-]*):/gm),
].map((match) => match[1]);

if (declared.length === 0) {
  console.error('Value-named token check matched ZERO declarations -- the token sheet shape changed.');
  process.exitCode = 1;
} else if (declared.length > CEILING) {
  const excess = declared.length - CEILING;
  console.error(
    `Value-named token family grew by ${excess}: ${declared.length} declared, ceiling ${CEILING}.`,
  );
  console.error(
    '\nA token named after its own value cannot survive a theme retuning it. Point the call site at\n' +
      'an existing semantic token whose ROLE matches (--lr-space-*, --lr-border-width-*, --lr-radius*,\n' +
      '--lr-form-control-height-*, --lr-font-size-*), or give the component its own role-named\n' +
      'custom property. If neither fits, say so in review rather than adding to this family.',
  );
  process.exitCode = 1;
} else if (declared.length < CEILING) {
  console.log(
    `Value-named token family: ${declared.length} declared, below the ceiling of ${CEILING}. ` +
      `Lower CEILING in ${'scripts/check-value-named-tokens.mjs'} to lock the gain in.`,
  );
} else {
  console.log(`Value-named token family holding at its ceiling of ${CEILING} declarations.`);
}
