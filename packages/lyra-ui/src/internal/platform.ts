/** Navigator fields used to resolve the platform-neutral primary keyboard modifier. */
interface PlatformNavigator {
  readonly userAgentData?: { readonly platform?: string };
  readonly platform?: string;
  readonly userAgent?: string;
}

/** Concrete operating-system family needed by platform-neutral keyboard shortcuts. */
/**
 * Resolves the current operating-system family without depending on the deprecated
 * `navigator.platform` value alone. Client Hints is preferred when available, while the legacy
 * platform and reduced user-agent strings keep the result usable across current browser engines.
 */
export function detectPlatform(
  source: PlatformNavigator | null | undefined =
    typeof navigator === 'undefined' ? undefined : navigator
): 'mac' | 'windows' | 'linux' {
  const platform =
    source?.userAgentData?.platform || source?.platform || source?.userAgent || '';
  if (/mac|iphone|ipad|ipod/i.test(platform)) return 'mac';
  if (/win/i.test(platform)) return 'windows';
  return 'linux';
}
