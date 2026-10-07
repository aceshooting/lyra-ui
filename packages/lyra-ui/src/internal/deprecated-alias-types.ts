/** Converts one side of a deprecated alias pair into the other side's value. */
export type LyraAliasMapping = (value: unknown) => unknown;

/**
 * A component's deprecated property aliases, keyed by the deprecated property name. The value is
 * the canonical property name, or a tuple of the canonical name, the alias-to-canonical mapping
 * and the canonical-to-alias mapping (both default to the identity).
 *
 * Both sides stay ordinary reactive properties with their own attribute, converter and reflection,
 * so a deprecated name keeps its exact public shape until it is removed.
 */
export type LyraDeprecatedAliases = Readonly<
  Record<string, string | readonly [canonical: string, toCanonical?: LyraAliasMapping, toAlias?: LyraAliasMapping]>
>;
