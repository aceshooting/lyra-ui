import { expect } from "@open-wc/testing";
import jsonGrammar from "shiki/langs/json.mjs";
import { loadShikiHighlighter, loadShikiLanguage } from "./code-loader.js";
import { loadShikiHighlighterCore } from "./shiki-types.js";

/**
 * Building the shared highlighter — importing shiki, compiling its regex engine, parsing both seed
 * themes — takes ~2s on an idle machine but far longer once the full 461-file suite saturates the
 * CPU. Charged to a test, that one-time cost blew the budgets here and cascaded: the first test
 * (20s) timed out while the module-level promise was still in flight, and every later test then
 * awaited that same pending promise on the tighter 6s project default and timed out too. Both
 * always passed when this file ran alone, which is what made it read as flakiness.
 *
 * A root-level `before()` runs ahead of every test in this file regardless of source order and
 * carries its own timeout, so the cold load is paid once here and each test below hits the warm
 * cache. Mirrors the same-directory precedent in `code-block.test.ts`. It deliberately loads no
 * grammar, so the zero-languages assertion in the first test still observes a freshly seeded
 * highlighter.
 */
before(async function () {
  this.timeout(120_000);
  await loadShikiHighlighter();
});

it("resolves a highlighter seeded with the light+dark themes and zero language grammars", async function () {
  this.timeout(20_000);
  const hl = await loadShikiHighlighter();
  expect(hl).to.not.be.null;
  expect(hl!.getLoadedThemes()).to.include.members([
    "github-light",
    "github-dark",
  ]);
  expect(hl!.getLoadedLanguages()).to.deep.equal([]);
});

it("caches the highlighter — a second call returns the same promise result", async () => {
  const a = await loadShikiHighlighter();
  const b = await loadShikiHighlighter();
  expect(a).to.equal(b);
});

describe("loadShikiLanguage", () => {
  it("loads a recognized language on demand and reports it as loaded afterward", async () => {
    const hl = await loadShikiHighlighter();
    expect(hl!.getLoadedLanguages()).to.not.include("python");

    const ok = await loadShikiLanguage(hl!, "python");
    expect(ok).to.be.true;
    expect(hl!.getLoadedLanguages()).to.include("python");
  });

  it("loads the built-in GreyCat grammar through both gcl and greycat aliases", async () => {
    const hl = await loadShikiHighlighter();
    const ok = await loadShikiLanguage(hl!, "greycat");
    expect(ok).to.be.true;
    expect(hl!.getLoadedLanguages()).to.include.members(["gcl", "greycat"]);

    const aliasOk = await loadShikiLanguage(hl!, "GCL");
    expect(aliasOk).to.be.true;
  });

  it("normalizes common filename-style language values", async () => {
    const hl = await loadShikiHighlighter();
    const ok = await loadShikiLanguage(hl!, ".PYTHON");
    expect(ok).to.be.true;
    expect(hl!.getLoadedLanguages()).to.include("python");
  });

  it("supports the requested common language families through Shiki", async () => {
    const hl = await loadShikiHighlighter();
    for (const language of [
      "python",
      "c",
      "java",
      "javascript",
      "typescript",
      "html",
    ]) {
      expect(await loadShikiLanguage(hl!, language), language).to.be.true;
    }
  });

  it("resolves true immediately (no reload) for a language already loaded", async () => {
    const hl = await loadShikiHighlighter();
    await loadShikiLanguage(hl!, "json");
    expect(hl!.getLoadedLanguages()).to.include("json");

    const ok = await loadShikiLanguage(hl!, "json");
    expect(ok).to.be.true;
  });

  it('resolves an alias (e.g. "js" for javascript) as loaded, since shiki registers aliases alongside the canonical id', async () => {
    const hl = await loadShikiHighlighter();
    await loadShikiLanguage(hl!, "javascript");
    expect(hl!.getLoadedLanguages()).to.include("js");
  });

  it("resolves false for an unrecognized language id and does not throw", async () => {
    const hl = await loadShikiHighlighter();
    const ok = await loadShikiLanguage(hl!, "not-a-real-language-xyz");
    expect(ok).to.be.false;
  });

  it("remembers an unrecognized language and resolves false again on a second call without hanging", async () => {
    const hl = await loadShikiHighlighter();
    const first = await loadShikiLanguage(hl!, "also-not-a-real-language");
    const second = await loadShikiLanguage(hl!, "also-not-a-real-language");
    expect(first).to.be.false;
    expect(second).to.be.false;
  });
});

describe("loadShikiHighlighterCore", () => {
  it("seeds a fine-grained highlighter with exactly the pre-supplied grammars, bypassing loadLanguage()’s dynamic-import path entirely", async () => {
    // "not-a-real-shiki-bundled-id" is not a language id/alias shiki's own
    // bundled map recognizes (unlike the real "json" name) -- so the
    // *ordinary* dynamic-import path (`loadLanguage('not-a-real-shiki-
    // bundled-id')`, which resolves a string against shiki's bundled
    // ~200-language map) could never have produced a loaded grammar for it.
    // A grammar registers under its own `name`/`aliases` regardless of the
    // map key it was filed under here, so seeing "json" among the loaded
    // languages proves `createHighlighterCore()`'s upfront `langs` list —
    // populated straight from this `languages` map's values, never from a
    // dynamic per-name import — is what supplied it.
    const languages = { "not-a-real-shiki-bundled-id": jsonGrammar };
    const hl = await loadShikiHighlighterCore(languages);
    expect(hl).to.not.be.null;
    expect(hl!.getLoadedLanguages()).to.include("json");
    expect(hl!.getLoadedThemes()).to.include.members([
      "github-light",
      "github-dark",
    ]);
  });

  it("does not make an absent language available — only what was actually supplied is pre-loaded, unlike the ordinary dynamic loadLanguage() path", async () => {
    const languages = { "not-a-real-shiki-bundled-id": jsonGrammar };
    const hl = await loadShikiHighlighterCore(languages);
    expect(hl!.getLoadedLanguages()).to.not.include("python");

    // 'python' is a real shiki-recognized id though, so the *ordinary*
    // dynamic loadLanguage() path (unchanged, still used for languages
    // absent from the `languages` map) still handles it fine.
    const full = await loadShikiHighlighter();
    const ok = await loadShikiLanguage(full!, "python");
    expect(ok).to.be.true;
    expect(full!.getLoadedLanguages()).to.include("python");
  });

  it("caches the core highlighter — a second call with the same `languages` object returns the same promise result", async () => {
    const languages = { "not-a-real-shiki-bundled-id": jsonGrammar };
    const a = await loadShikiHighlighterCore(languages);
    const b = await loadShikiHighlighterCore(languages);
    expect(a).to.equal(b);
  });
});
