import { expect } from "@open-wc/testing";
import { AnchoredValidityController, resolveValidityAnchor, VALIDITY_ANCHOR } from "./anchored-validity.js";

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
  const host = { addController: () => {} };
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
    { addController: () => {} },
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
    { addController: () => {} },
    internals as unknown as ElementInternals,
    () => anchor,
  );

  expect(() => controller.setValidity({ valueMissing: true }, "Required")).to.throw(error);
  anchor.remove();
});
