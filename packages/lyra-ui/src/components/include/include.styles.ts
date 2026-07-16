import { css } from 'lit';

// No visual chrome of its own: the fetched fragment supplies whatever layout
// or design-token usage it needs once transcluded into the light DOM, so
// there is nothing here to express through --lyra-* custom properties.
export const styles = css`
  :host {
    display: contents;
  }

  [part='base'] {
    display: contents;
  }
`;
