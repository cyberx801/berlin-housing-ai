import type { Metadata, Viewport } from "next";
import { Archivo, Source_Serif_4 } from "next/font/google";
import { hostHeadCommentScript } from "@/components/layout/host-head-comment";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { chartPatternsScript } from "@/components/charts/chart-patterns";
import { ringDrawScript } from "@/components/maps/ring-draw";
import { rentModelConnected } from "@/lib/api/prediction/connected";
import { getPlates } from "@/lib/data/geo";
import { fitProjection, svgPath } from "@/lib/geo/svg";
import "@/styles/globals.css";

// Every page is fully prerendered; the build fails if anything becomes request-time work.
export const ensureStatic = "navigation";

const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
  style: ["normal", "italic"],
  variable: "--font-source-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Berlin Housing AI",
    template: "%s | Berlin Housing AI",
  },
  description: rentModelConnected
    ? "Read a Berlin flat against its city: explore the 97 Ortsteile, compare listings side by side, and try a demo rent model trained on synthetic data."
    : "Read a Berlin flat against its city: explore the 97 Ortsteile, compare listings side by side, and prepare an analysis for a rent model in development.",
};

export const viewport: Viewport = {
  themeColor: "#f3f5f4",
  colorScheme: "light",
};

function ringMarkPath() {
  const ring = getPlates().ring;
  return svgPath(fitProjection(ring, { width: 32, height: 32, padding: 2.5 }), ring);
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the head script may add data-ring-drawn and data-chart-patterns
    // to <html> before hydration.
    <html lang="en" className={`${archivo.variable} ${sourceSerif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: hostHeadCommentScript + ringDrawScript + chartPatternsScript }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-50 bg-ink px-4 py-3 text-on-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Skip to content
        </a>
        <SiteHeader ringMarkPath={ringMarkPath()} />
        <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
