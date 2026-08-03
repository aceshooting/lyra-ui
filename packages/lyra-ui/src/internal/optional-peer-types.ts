/**
 * Unknown value crossing an optional-peer module boundary.
 *
 * Keep the shared boundary honest: a loader must validate or narrow the
 * capability it consumes instead of turning every optional package into
 * `any`. Public component APIs expose owned structural interfaces rather than
 * this type, so importing Lyra's root declarations never requires every
 * optional peer package to be installed.
 */
export type OptionalPeerApi = unknown;
