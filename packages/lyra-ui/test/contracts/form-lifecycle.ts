import { expect } from '@open-wc/testing';
import type { PropertyValues } from 'lit';
import { LyraElement } from '../../src/internal/lyra-element.js';

/** Proves a component's willUpdate override reaches the LyraElement base hook. */
export async function assertCallsBaseWillUpdate<T extends LyraElement>(
  tagName: string,
  mount: () => Promise<T>
): Promise<void> {
  const proto = LyraElement.prototype as unknown as {
    willUpdate: (changed: PropertyValues) => void;
  };
  const original = proto.willUpdate;
  let calledOnTarget = false;
  proto.willUpdate = function (this: LyraElement, changed: PropertyValues): void {
    if (this.localName === tagName) calledOnTarget = true;
    original.call(this, changed);
  };
  try {
    const element = await mount();
    await element.updateComplete;
    expect(calledOnTarget).to.be.true;
  } finally {
    proto.willUpdate = original;
  }
}

/** Runs one constructor contract with attachInternals missing or throwing, then restores it. */
export function withUnavailableInternals(run: () => void, error?: () => Error): void {
  const original = HTMLElement.prototype.attachInternals;
  if (error) {
    HTMLElement.prototype.attachInternals = function (): ElementInternals {
      throw error();
    };
  } else {
    // @ts-expect-error -- simulate a DOM implementation without ElementInternals
    delete HTMLElement.prototype.attachInternals;
  }
  try {
    run();
  } finally {
    HTMLElement.prototype.attachInternals = original;
  }
}
