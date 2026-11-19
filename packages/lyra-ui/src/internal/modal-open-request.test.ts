import { expect } from '@open-wc/testing';
import { ModalOpenRequest } from './modal-open-request.js';

describe('ModalOpenRequest', () => {
  it('passes requests through while idle', () => {
    const request = new ModalOpenRequest();
    expect(request.active).to.equal(false);
    expect(request.coalesce(true)).to.equal(false);
    expect(request.superseded(true)).to.equal(false);
  });

  it('coalesces same-direction reentry and lets the last opposite write supersede', () => {
    const request = new ModalOpenRequest();
    request.begin(true);
    expect(request.active).to.equal(true);
    expect(request.coalesce(true)).to.equal(true);
    expect(request.superseded(true)).to.equal(false);
    expect(request.coalesce(false)).to.equal(true);
    expect(request.superseded(true)).to.equal(true);
    expect(request.coalesce(true)).to.equal(true);
    expect(request.superseded(true)).to.equal(false);
    request.finish();
    expect(request.active).to.equal(false);
    expect(request.superseded(true)).to.equal(false);
  });

  it('clears captured writes when a new preflight begins', () => {
    const request = new ModalOpenRequest();
    request.begin(false);
    request.coalesce(true);
    request.begin(false);
    expect(request.superseded(false)).to.equal(false);
  });
});
