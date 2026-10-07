import { css } from 'lit';

/** Container thresholds follow the root type scale and switch strictly below the boundary. */
export const compactContainerQuery = css`(inline-size < 20rem)`;
export const mediumContainerQuery = css`(inline-size < 30rem)`;
export const wideContainerQuery = css`(inline-size < 40rem)`;
