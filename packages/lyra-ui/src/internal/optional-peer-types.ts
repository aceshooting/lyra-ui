/**
 * Optional integrations are loaded dynamically at runtime. Keeping their
 * implementation types opaque in emitted declarations lets consumers use the
 * core package without installing every optional peer first; applications
 * that install a peer can narrow the returned value to that peer's own types.
 */
export type OptionalPeerApi = any;
