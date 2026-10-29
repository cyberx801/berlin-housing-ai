"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cx } from "@/lib/cx";
import { NAV_ITEMS } from "./nav-items";

function isCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The header's logomark is the official Umweltzone outline (area within the S-Bahn ring). */
export function SiteHeader({ ringMarkPath }: { ringMarkPath: string }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);

  // Close the mobile menu whenever the route changes.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        document.getElementById("menu-toggle")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-paper/95 backdrop-blur-none">
      <div className="page-gutter flex h-[var(--header-height)] items-center justify-between gap-6">
        <Link
          href="/"
          className="group flex items-center gap-2.5 no-underline"
          aria-current={pathname === "/" ? "page" : undefined}
        >
          <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" className="shrink-0">
            <path d={ringMarkPath} fill="none" stroke="var(--color-ink)" strokeWidth="2.25" strokeLinejoin="round" />
          </svg>
          <span className="type-body leading-none">
            <span className="stretch-wide font-[760]">Berlin Housing</span>{" "}
            <span className="font-[450] text-ink-2">AI</span>
          </span>
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const current = isCurrent(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={cx(
                      "inline-flex min-h-11 items-center px-3 type-body no-underline transition-state",
                      current
                        ? "font-[640] text-ink underline decoration-2 decoration-ink underline-offset-[10px]"
                        : "text-ink-2 hover:text-ink hover:underline hover:decoration-line-strong hover:underline-offset-[10px]",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <button
          id="menu-toggle"
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-control px-3 type-body font-[600] text-ink hover:bg-sheet lg:hidden"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
          Menu
        </button>
      </div>

      <nav
        id="mobile-menu"
        aria-label="Main"
        hidden={!menuOpen}
        className="border-t border-rule bg-paper lg:hidden"
      >
        <ul className="page-gutter flex flex-col py-2">
          {NAV_ITEMS.map((item) => {
            const current = isCurrent(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  onNavigate={() => setMenuOpen(false)}
                  className={cx(
                    "flex min-h-12 items-center border-b border-rule type-title-3 stretch-wide no-underline",
                    current ? "text-ink underline decoration-2 underline-offset-8" : "text-ink-2",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
