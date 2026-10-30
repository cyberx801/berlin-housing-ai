import { hostHeadCommentScript } from "@/components/layout/host-head-comment";

// What Netlify serves after <meta charset> on *.netlify.app, followed by a line break.
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

afterEach(() => document.head.replaceChildren());

describe("hostHeadCommentScript", () => {
  it("removes the Netlify comment and the line break after it, and nothing else", () => {
    headWith(
      meta("a"),
      document.createComment(NETLIFY_COMMENT),
      document.createTextNode("\n"),
      meta("b"),
    );
    run();
    expect([...document.head.childNodes].map((n) => n.nodeName)).toEqual(["META", "META"]);
    expect(document.head.querySelectorAll("meta")).toHaveLength(2);
  });

  it("leaves other comments and text alone", () => {
    const other = document.createComment(" a comment of our own ");
    headWith(meta("a"), other, document.createTextNode("\n"), meta("b"));
    run();
    expect(document.head.contains(other)).toBe(true);
    expect(document.head.childNodes).toHaveLength(4);
  });

  it("does nothing when the comment is absent, and is safe to run twice", () => {
    headWith(meta("a"), meta("b"));
    run();
    run();
    expect(document.head.childNodes).toHaveLength(2);
  });

  it("keeps a text node that is not just whitespace", () => {
    headWith(document.createComment(NETLIFY_COMMENT), document.createTextNode("kept"));
    run();
    expect(document.head.textContent).toBe("kept");
  });

  it("does not leak variables into the page", () => {
    headWith(document.createComment(NETLIFY_COMMENT), document.createTextNode("\n"));
    run();
    expect("r" in globalThis).toBe(false);
    expect("h" in globalThis).toBe(false);
  });
});
