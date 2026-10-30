import { hostHeadCommentScript } from "@/components/layout/host-head-comment";

// What Netlify serves on *.netlify.app: `<meta charset>`, a line break, the comment, then the next tag.
const NETLIFY_COMMENT =
  " This site is hosted on Netlify. Anyone can build and deploy a site\n     like this one for free: https://netlify.new/ ";

function headWith(...nodes: Node[]) {
  document.head.replaceChildren(...nodes);
}
const meta = (name: string) => {
  const el = document.createElement("meta");
  el.setAttribute("name", name);
  return el;
};
const run = () => new Function(hostHeadCommentScript)();
const names = () => [...document.head.childNodes].map((n) => n.nodeName);

afterEach(() => document.head.replaceChildren());

describe("hostHeadCommentScript", () => {
  it("removes the line break and the Netlify comment as served, and nothing else", () => {
    headWith(meta("a"), document.createTextNode("\n"), document.createComment(NETLIFY_COMMENT), meta("b"));
    run();
    expect(names()).toEqual(["META", "META"]);
  });

  it("also removes whitespace that follows the comment", () => {
    headWith(meta("a"), document.createComment(NETLIFY_COMMENT), document.createTextNode("\n"), meta("b"));
    run();
    expect(names()).toEqual(["META", "META"]);
  });

  it("leaves other comments and text alone", () => {
    const other = document.createComment(" a comment of our own ");
    headWith(meta("a"), document.createTextNode("\n"), other, meta("b"));
    run();
    expect(document.head.contains(other)).toBe(true);
    expect(document.head.childNodes).toHaveLength(4);
  });

  it("does nothing when the comment is absent, and is safe to run twice", () => {
    headWith(meta("a"), meta("b"));
    run();
    run();
    expect(names()).toEqual(["META", "META"]);
  });

  it("keeps a text node that is not just whitespace", () => {
    headWith(document.createTextNode("kept"), document.createComment(NETLIFY_COMMENT));
    run();
    expect(document.head.textContent).toBe("kept");
  });

  it("copes with two adjacent Netlify comments", () => {
    headWith(meta("a"), document.createComment(NETLIFY_COMMENT), document.createComment(NETLIFY_COMMENT), meta("b"));
    run();
    expect(names()).toEqual(["META", "META"]);
  });

  it("does not leak variables into the page", () => {
    headWith(document.createTextNode("\n"), document.createComment(NETLIFY_COMMENT));
    run();
    expect("r" in globalThis).toBe(false);
    expect("h" in globalThis).toBe(false);
  });
});
