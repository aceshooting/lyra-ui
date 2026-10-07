/** Exact coverage for the deliberately narrow generated package sideEffects globs. */
export function sideEffectsCover(entries, file) {
  if (entries.has(file)) return true;
  if (file.startsWith('./src/translations/') && file.endsWith('.ts') && entries.has('./src/translations/**/*.ts')) return true;
  if (file.startsWith('./dist/translations/') && file.endsWith('.js') && entries.has('./dist/translations/**/*.js')) return true;
  if (/^\.\/src\/components\/lr-[^/]+\.ts$/u.test(file) && entries.has('./src/components/lr-*.ts')) return true;
  if (/^\.\/dist\/components\/lr-[^/]+\.js$/u.test(file) && entries.has('./dist/components/lr-*.js')) return true;
  return false;
}
