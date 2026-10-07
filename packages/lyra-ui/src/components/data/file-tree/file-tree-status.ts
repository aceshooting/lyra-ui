export type GitStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked' | 'conflicted' | 'ignored';

export const GIT_STATUSES: ReadonlySet<GitStatus> = new Set<GitStatus>([
  'added',
  'modified',
  'deleted',
  'renamed',
  'untracked',
  'conflicted',
  'ignored',
]);
