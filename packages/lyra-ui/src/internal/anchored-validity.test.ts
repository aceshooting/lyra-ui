import { expect } from "@open-wc/testing";
import type { ReactiveControllerHost } from "lit";
import { AnchoredValidityController, resolveValidityAnchor, VALIDITY_ANCHOR } from "./anchored-validity.js";

function controllerHost(): ReactiveControllerHost {
  return {
    addController: () => {},
    removeController: () => {},
    requestUpdate: () => {},
    updateComplete: Promise.resolve(true),
  };
}

it("accepts only object/function providers with a callable anchor resolver", () => {
  const anchor = document.createElement("input");
  const provider = { [VALIDITY_ANCHOR]: () => anchor };

  expect(resolveValidityAnchor(null)).to.equal(undefined);
  expect(resolveValidityAnchor("not a provider")).to.equal(undefined);
  expect(resolveValidityAnchor({})).to.equal(undefined);
  expect(resolveValidityAnchor({ [VALIDITY_ANCHOR]: "not a function" })).to.equal(undefined);
  expect(resolveValidityAnchor({ [VALIDITY_ANCHOR]: () => null })).to.equal(undefined);
  expect(resolveValidityAnchor(provider)).to.equal(anchor);
});

it("falls back to host validity when the connected anchor is not a legal descendant", () => {
  const anchor = document.createElement("input");
  document.body.appendChild(anchor);
  const calls: unknown[][] = [];
  const host = controllerHost();
  const internals = {
    setValidity: (...args: unknown[]) => {
      calls.push(args);
      if (args.length === 3)
        throw new DOMException("Not a descendant", "NotFoundError");
    },
  };

  const controller = new AnchoredValidityController(
    host,
    internals as unknown as ElementInternals,
    () => anchor
  );
  controller.setValidity({ valueMissing: true }, "Required");

  expect(calls).to.have.length(2);
  expect(calls[1]?.slice(0, 2)).to.deep.equal([
    { valueMissing: true },
    "Required",
  ]);
  anchor.remove();
});

it("recognizes a foreign-realm NotFoundError without swallowing a lookalike", () => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const anchor = document.createElement("input");
  document.body.append(anchor);
  try {
    const foreignError = new frame.contentWindow!.DOMException("Not a descendant", "NotFoundError");
    expect(foreignError instanceof DOMException, "not the ambient-realm brand").to.be.false;
    const calls: unknown[][] = [];
    const internals = {
      setValidity: (...args: unknown[]) => {
        calls.push(args);
        if (args.length === 3) throw foreignError;
      },
    };
    const controller = new AnchoredValidityController(
      controllerHost(),
      internals as unknown as ElementInternals,
      () => anchor,
    );

    expect(() => controller.setValidity({ valueMissing: true }, "Required")).not.to.throw();
    expect(calls).to.have.length(2);

    const lookalike = { name: "NotFoundError" };
    const spoofingInternals = {
      setValidity: (...args: unknown[]) => {
        if (args.length === 3) throw lookalike;
      },
    };
    const spoofingController = new AnchoredValidityController(
      controllerHost(),
      spoofingInternals as unknown as ElementInternals,
      () => anchor,
    );
    let thrown: unknown;
    try {
      spoofingController.setValidity({ valueMissing: true }, "Required");
    } catch (error) {
      thrown = error;
    }
    expect(thrown === lookalike, "the lookalike is rethrown unchanged").to.be.true;

    const runtime = globalThis as unknown as { DOMException?: typeof DOMException };
    const NativeDOMException = runtime.DOMException;
    try {
      runtime.DOMException = undefined;
      let partialDomThrown: unknown;
      try {
        controller.setValidity({ valueMissing: true }, "Required");
      } catch (error) {
        partialDomThrown = error;
      }
      expect(
        partialDomThrown === foreignError,
        "without a brand-checking intrinsic, the foreign error is rethrown unchanged",
      ).to.be.true;
    } finally {
      runtime.DOMException = NativeDOMException;
    }
  } finally {
    anchor.remove();
    frame.remove();
  }
});

it("uses a connected descendant anchor without a host fallback", () => {
  const host = document.createElement("div");
  const anchor = document.createElement("input");
  host.append(anchor);
  document.body.append(host);
  const calls: unknown[][] = [];
  const internals = {
    setValidity: (...args: unknown[]) => calls.push(args),
  };

  const controller = new AnchoredValidityController(
    controllerHost(),
    internals as unknown as ElementInternals,
    () => anchor,
  );
  controller.setValidity({ valueMissing: true }, "Required");

  expect(calls).to.have.length(1);
  expect(calls[0]?.[2]).to.equal(anchor);
  host.remove();
});

it("rethrows validity errors other than a stale-anchor NotFoundError", () => {
  const anchor = document.createElement("input");
  document.body.append(anchor);
  const error = new Error("unexpected validity failure");
  const internals = {
    setValidity: () => {
      throw error;
    },
  };
  const controller = new AnchoredValidityController(
    controllerHost(),
    internals as unknown as ElementInternals,
    () => anchor,
  );

  expect(() => controller.setValidity({ valueMissing: true }, "Required")).to.throw(error);
  anchor.remove();
});
