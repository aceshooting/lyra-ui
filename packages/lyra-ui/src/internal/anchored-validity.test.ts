import { expect } from "@open-wc/testing";
import { AnchoredValidityController } from "./anchored-validity.js";

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
