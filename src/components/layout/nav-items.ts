// Shared by the client header and the server footer, so it lives outside the "use client" module.
export const NAV_ITEMS = [
  { href: "/analyze", label: "Analyze" },
  { href: "/explore", label: "Explore" },
  { href: "/market", label: "Market" },
  { href: "/neighborhoods", label: "Neighborhoods" },
  { href: "/compare", label: "Compare" },
  { href: "/methodology", label: "Methodology" },
] as const;
