/**
 * A theme input a token map may set: a `--lr-theme-*` custom property name. At run time a name
 * must also match `^--lr-theme-[a-z0-9]+(?:-[a-z0-9]+)*$`, be at most 80 characters long, and not be
 * `--lr-theme-accent`, which the accent runtime owns.
 */
export type LyraThemeTokenName = `--lr-theme-${string}`;

/**
 * A token's CSS value for both resolved modes, or a `{ light?, dark? }` pair. A `null` or omitted
 * branch leaves that mode to the stylesheets.
 */
export type LyraThemeTokenValue = string | { readonly light?: string | null; readonly dark?: string | null };

/**
 * Validated `--lr-theme-*` overrides, written inline on the document root. A map always replaces
 * the previous one wholesale; compose maps with object spread.
 */
export type LyraThemeTokens = { readonly [name: LyraThemeTokenName]: LyraThemeTokenValue };
