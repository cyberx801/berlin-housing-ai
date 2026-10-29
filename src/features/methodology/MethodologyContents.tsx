import { cx } from "@/lib/cx";
import { METHODOLOGY_SECTIONS } from "./sections";

const linkClass = "underline decoration-transparent underline-offset-4 hover:decoration-ink";

/**
 * "On this page": first in the DOM at every width, so the reading and focus order match the
 * drawing (above the article on phones, the left column from `lg`).
 */
export function MethodologyContents({ className }: { className?: string }) {
  return (
    <nav
      aria-labelledby="methodology-contents-title"
      className={cx(
        "flex min-w-0 flex-col gap-3 border-t border-ink pt-3",
        // Sticky beside the article; scrolls on its own if a short window can't fit it.
        "lg:sticky lg:top-[calc(var(--header-height)+1.5rem)] lg:max-h-[calc(100svh-var(--header-height)-3rem)] lg:self-start lg:overflow-y-auto",
        className,
      )}
    >
      <h2 id="methodology-contents-title" className="type-small font-[650] text-ink">
        On this page
      </h2>
      <ol className="flex flex-col gap-2 type-small">
        {METHODOLOGY_SECTIONS.map((section) => (
          <li key={section.id} className="flex flex-col gap-1">
            <a href={`#${section.id}`} className={cx(linkClass, "font-[560] text-ink")}>
              {section.title}
            </a>
            {"children" in section ? (
              <ol className="flex flex-col gap-1 border-l border-rule pl-3">
                {section.children.map((child) => (
                  <li key={child.id}>
                    <a href={`#${child.id}`} className={cx(linkClass, "text-ink-2")}>
                      {child.title}
                    </a>
                  </li>
                ))}
              </ol>
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
