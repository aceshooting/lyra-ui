import {
  resolveCssLength,
  type ResolveCssLengthOptions,
} from '../src/utilities/css-length.js';

const options: ResolveCssLengthOptions = {
  host: document.documentElement,
  percentBase: 320,
  viewportBasis: { inlineSize: 1024, blockSize: 768 },
};
const pixels: number | undefined = resolveCssLength('50%', options);

void pixels;

// @ts-expect-error percentage bases are finite numeric layout measurements.
resolveCssLength('50%', { percentBase: '320' });
// @ts-expect-error viewport geometry requires both numeric axes.
resolveCssLength('10vw', { viewportBasis: { inlineSize: 1024 } });
