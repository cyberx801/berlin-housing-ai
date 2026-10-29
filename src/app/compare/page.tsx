import type { Metadata } from "next";
import { CompareView } from "@/features/property-comparison/CompareView";
import { getBezirkOptions, getOrtsteilOptions } from "@/lib/data/geo";

export const metadata: Metadata = {
  title: "Compare properties",
  description:
    "Put up to three Berlin listings side by side: the asking cold rent, €/m² worked out from your own entries, and every detail you know. Saved only in your browser.",
};

export default function ComparePage() {
  return (
    <>
      <div className="page-grid pt-8 pb-8 md:pt-10">
        <div className="col-span-full flex flex-col gap-3">
          <h1 className="type-title-1 stretch-wide">Compare up to three properties</h1>
          <p className="type-prose text-ink-2">
            Enter the listings you are weighing up and read them side by side. The €/m² comes from your own numbers, and
            everything you enter stays in this browser.
          </p>
        </div>
      </div>
      <CompareView bezirke={getBezirkOptions()} ortsteile={getOrtsteilOptions()} />
    </>
  );
}
